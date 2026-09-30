import { NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth";
import { fcmConfigured } from "../../lib/fcm";
import { hasSubscription, pushPublicKey, removeSubscription, saveFcmToken, saveWebSubscription, type WebSubscription } from "../../lib/push";

// A device turning push notifications on or off (see lib/push.ts). Always
// for the signed-in user: the user id comes from the session, never the body.
//   POST   { endpoint, keys: { p256dh, auth } }   subscribe this browser
//   POST   { fcm: token }                         subscribe the Android app
//   DELETE { endpoint }                           unsubscribe it (a URL or an FCM token)
//   PUT    { endpoint }                           is it subscribed? { on }
export const dynamic = "force-dynamic";

async function signedIn() {
  const user = await getSessionUser();
  return user && !user.must_change_password ? user : null;
}

const isUrl = (v: unknown): v is string => typeof v === "string" && v.startsWith("https://") && v.length < 2048;
const isFcmToken = (v: unknown): v is string => typeof v === "string" && /^[\w:-]{20,4096}$/.test(v);
const isEndpoint = (v: unknown): v is string => isUrl(v) || isFcmToken(v);
const isKey = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length < 256;

export async function POST(request: Request) {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as (Partial<WebSubscription> & { fcm?: unknown }) | null;
  if (body && "fcm" in body) {
    if (!fcmConfigured()) return NextResponse.json({ error: "Push notifications aren't set up on this server" }, { status: 503 });
    if (!isFcmToken(body.fcm)) return NextResponse.json({ error: "Not a push token" }, { status: 400 });
    await saveFcmToken(user.id, body.fcm, request.headers.get("user-agent")?.slice(0, 300) ?? null);
    return NextResponse.json({ on: true });
  }
  if (!pushPublicKey()) return NextResponse.json({ error: "Push notifications aren't set up on this server" }, { status: 503 });
  if (!body || !isUrl(body.endpoint) || !isKey(body.keys?.p256dh) || !isKey(body.keys?.auth)) {
    return NextResponse.json({ error: "Not a push subscription" }, { status: 400 });
  }
  const sub = { endpoint: body.endpoint, keys: { p256dh: body.keys.p256dh, auth: body.keys.auth } };
  await saveWebSubscription(user.id, sub, request.headers.get("user-agent")?.slice(0, 300) ?? null);
  return NextResponse.json({ on: true });
}

export async function DELETE(request: Request) {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!body || !isEndpoint(body.endpoint)) return NextResponse.json({ error: "No endpoint" }, { status: 400 });
  await removeSubscription(user.id, body.endpoint);
  return NextResponse.json({ on: false });
}

export async function PUT(request: Request) {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!body || !isEndpoint(body.endpoint)) return NextResponse.json({ on: false });
  return NextResponse.json({ on: await hasSubscription(user.id, body.endpoint) });
}
