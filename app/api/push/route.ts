import { NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth";
import { hasSubscription, pushPublicKey, removeSubscription, saveWebSubscription, type WebSubscription } from "../../lib/push";

// A device turning push notifications on or off (see lib/push.ts). Always
// for the signed-in user: the user id comes from the session, never the body.
//   POST   { endpoint, keys: { p256dh, auth } }   subscribe this device
//   DELETE { endpoint }                           unsubscribe it
//   PUT    { endpoint }                           is it subscribed? { on }
export const dynamic = "force-dynamic";

async function signedIn() {
  const user = await getSessionUser();
  return user && !user.must_change_password ? user : null;
}

const isUrl = (v: unknown): v is string => typeof v === "string" && v.startsWith("https://") && v.length < 2048;
const isKey = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length < 256;

export async function POST(request: Request) {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!pushPublicKey()) return NextResponse.json({ error: "Push notifications aren't set up on this server" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as Partial<WebSubscription> | null;
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
  if (!body || !isUrl(body.endpoint)) return NextResponse.json({ error: "No endpoint" }, { status: 400 });
  await removeSubscription(user.id, body.endpoint);
  return NextResponse.json({ on: false });
}

export async function PUT(request: Request) {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!body || !isUrl(body.endpoint)) return NextResponse.json({ on: false });
  return NextResponse.json({ on: await hasSubscription(user.id, body.endpoint) });
}
