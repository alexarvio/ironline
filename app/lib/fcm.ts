import { createSign } from "node:crypto";
import type { PushMessage } from "./push";

// Firebase Cloud Messaging: how the Android app gets notifications (lib/push.ts
// keeps each phone's FCM token as a device of kind "fcm").
//
// Sending needs the Firebase project's service account, the JSON file from
// Project settings > Service accounts > Generate new private key, in
// FCM_SERVICE_ACCOUNT (the file's contents, or base64 of them). Without it,
// Android push is off and fcmConfigured() is false.

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

let account: ServiceAccount | null | undefined;

function serviceAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  const raw = process.env.FCM_SERVICE_ACCOUNT?.trim();
  let found: ServiceAccount | null = null;
  if (raw) {
    try {
      const json = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
      if (json.project_id && json.client_email && json.private_key) found = json;
      else console.error("[fcm] FCM_SERVICE_ACCOUNT is missing project_id, client_email or private_key");
    } catch {
      console.error("[fcm] FCM_SERVICE_ACCOUNT isn't JSON");
    }
  }
  account = found;
  return found;
}

export function fcmConfigured(): boolean {
  return serviceAccount() != null;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

// Google's access tokens last an hour; one is reused until five minutes before.
let cached: { token: string; until: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && Date.now() < cached.until) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(sa.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${signature}` }),
  });
  if (!res.ok) throw new Error(`[fcm] token request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, until: Date.now() + (json.expires_in - 300) * 1000 };
  return json.access_token;
}

/** "sent", "gone" (the token no longer exists: forget the device) or "failed" (try again next time). */
export async function sendFcm(token: string, message: PushMessage): Promise<"sent" | "gone" | "failed"> {
  const sa = serviceAccount();
  if (!sa) return "failed";
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(sa)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: message.title, body: message.body },
        // Read by the app when the notification is tapped (NativePush.tsx).
        data: { url: message.url },
        android: {
          // Held a day if the phone is off, like web push.
          ttl: "86400s",
          ...(message.tag ? { collapse_key: message.tag } : {}),
          notification: { channel_id: "ironline", ...(message.tag ? { tag: message.tag } : {}) },
        },
      },
    }),
  });
  if (res.ok) return "sent";
  const text = await res.text();
  // UNREGISTERED (404) is an uninstalled app or a token turned off; a 400
  // about the token is one that was never valid.
  if (res.status === 404 || (res.status === 400 && /not a valid FCM registration token/i.test(text))) return "gone";
  console.error(`[fcm] send failed (${res.status}):`, text.slice(0, 300));
  return "failed";
}
