import { and, eq, inArray, sql } from "drizzle-orm";
import webpush from "web-push";
import { pg } from "./pg/direct";
import { push_subscriptions } from "./pg/schema";

// Push notifications: the lock-screen kind, delivered while the app is shut.
//
// A device that says yes gets an address from its delivery service (the
// browser's push service today; Apple's for the native app later). The app
// posts that address to /api/push, it is kept in push_subscriptions, and
// sendPush() hands a short message to the delivery service for every device
// the user has. An address the service reports as gone (the app was removed,
// or notifications turned off) is deleted on the spot.
//
// Web push needs a VAPID key pair, which identifies this server to the push
// services: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, made once with
//   npx web-push generate-vapid-keys
// Without them, or without Postgres, push is off and every call here is a
// quiet no-op, so nothing else depends on it being set up.

export type PushMessage = {
  title: string;
  body: string;
  // Where tapping the notification opens.
  url: string;
  // Notifications with the same tag replace each other on the lock screen
  // instead of piling up.
  tag?: string;
};

export type WebSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

/** The public half of the key pair, which the browser needs to subscribe; null when push is off. */
export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

function vapid() {
  const publicKey = pushPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  // Push services want a way to reach whoever runs the server.
  const owner = process.env.OWNER_EMAIL?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || (owner ? `mailto:${owner}` : "mailto:push@ironline.invalid");
  return { subject, publicKey, privateKey };
}

/** Saves a device's subscription for this user; the same device signing in as someone else moves to them. */
export async function saveWebSubscription(userId: number, sub: WebSubscription, userAgent: string | null) {
  const db = await pg();
  if (!db) return;
  const row = { user_id: userId, kind: "web" as const, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent };
  await db
    .insert(push_subscriptions)
    .values(row)
    .onConflictDoUpdate({ target: push_subscriptions.endpoint, set: { user_id: row.user_id, p256dh: row.p256dh, auth: row.auth, user_agent: row.user_agent } });
}

/** Forgets a device (the user turned notifications off on it). Only their own. */
export async function removeSubscription(userId: number, endpoint: string) {
  const db = await pg();
  if (!db) return;
  await db.delete(push_subscriptions).where(and(eq(push_subscriptions.user_id, userId), eq(push_subscriptions.endpoint, endpoint)));
}

/** Forgets every device of these users (their account is being deleted). */
export async function removeAllSubscriptions(userIds: number[]) {
  const db = await pg();
  if (!db || userIds.length === 0) return;
  await db.delete(push_subscriptions).where(inArray(push_subscriptions.user_id, userIds));
}

/** Whether this device is subscribed for this user. */
export async function hasSubscription(userId: number, endpoint: string): Promise<boolean> {
  const db = await pg();
  if (!db) return false;
  const rows = await db
    .select({ id: push_subscriptions.id })
    .from(push_subscriptions)
    .where(and(eq(push_subscriptions.user_id, userId), eq(push_subscriptions.endpoint, endpoint)));
  return rows.length > 0;
}

/** Sends to every device the user has; returns how many took it. */
export async function sendPush(userId: number, message: PushMessage): Promise<number> {
  const keys = vapid();
  const db = await pg();
  if (!keys || !db) return 0;
  const devices = await db.select().from(push_subscriptions).where(eq(push_subscriptions.user_id, userId));
  const web = devices.filter((d) => d.kind === "web" && d.p256dh && d.auth);
  if (web.length === 0) return 0;

  const payload = JSON.stringify(message);
  const gone: number[] = [];
  const sent: number[] = [];
  await Promise.all(
    web.map(async (d) => {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh!, auth: d.auth! } }, payload, {
          vapidDetails: keys,
          // Hold it for a day if the phone is off; after that it's stale news.
          TTL: 24 * 60 * 60,
          urgency: "normal",
        });
        sent.push(d.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: the address no longer exists. Anything else is the push
        // service having a bad moment; the device stays for next time.
        if (status === 404 || status === 410) gone.push(d.id);
        else console.error(`[push] sending to device ${d.id} failed (${status ?? "no status"}):`, error instanceof Error ? error.message : error);
      }
    })
  );
  if (gone.length) await db.delete(push_subscriptions).where(inArray(push_subscriptions.id, gone));
  if (sent.length) await db.update(push_subscriptions).set({ last_sent_at: sql`now()` }).where(inArray(push_subscriptions.id, sent));
  return sent.length;
}

/** sendPush for callers that can't wait: never throws, errors go to the log and Sentry. */
export function sendPushInBackground(userId: number, message: PushMessage) {
  sendPush(userId, message).catch((error) => {
    console.error("[push] send failed:", error);
    import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  });
}
