import { connect, constants, type ClientHttp2Session, type ClientHttp2Stream } from "node:http2";
import { createPrivateKey, createSign, type KeyObject } from "node:crypto";
import type { PushMessage } from "./push";

// Apple's push service (APNs): how the iPhone app gets notifications (12 Nov,
// Alex: none came on his phone). The app's push plugin hands the page the
// phone's APNs device token, /api/push keeps it as a device of kind "apns"
// (lib/push.ts), and this sends to it over HTTP/2, signed with the team's
// APNs key. No Firebase on the iPhone.
//
// Sending needs an APNs key: developer.apple.com > Certificates, Identifiers &
// Profiles > Keys > +, tick Apple Push Notifications service (APNs), download
// the AuthKey_<id>.p8 once. Then, on the server:
//   APNS_KEY        the whole text of that .p8 file (or base64 of it)
//   APNS_KEY_ID     the key's 10-character Key ID
//   APNS_TEAM_ID    the team's 10-character id (Membership details); APPLE_TEAM_ID is read too
//   APNS_BUNDLE_ID  optional, the app's id, com.arvio.norcoach by default
//   APNS_ENV        optional, "sandbox" to try Apple's test service first (a build from Xcode); production by default
// Without the first three, iPhone push is off and apnsConfigured() is false.

type Key = { key: KeyObject; keyId: string; teamId: string; topic: string };

let loaded: Key | null | undefined;

/** The .p8 as pasted, put back in shape: Windows line endings, quotes, literal \n, a missing BEGIN line or a base64 paste. */
function pemOf(raw: string): string | null {
  let text = raw.replace(/\r/g, "").trim().replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n");
  if (!text.includes("BEGIN")) {
    const decoded = Buffer.from(text.replace(/\s+/g, ""), "base64").toString("utf8");
    if (decoded.includes("BEGIN")) text = decoded.replace(/\r/g, "").trim();
  }
  const body = text.replace(/-----(BEGIN|END)[^-]*-----/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
  if (body.length < 100) return null;
  return `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

function apnsKey(): Key | null {
  if (loaded !== undefined) return loaded;
  const raw = process.env.APNS_KEY?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = (process.env.APNS_TEAM_ID || process.env.APPLE_TEAM_ID)?.trim();
  const topic = process.env.APNS_BUNDLE_ID?.trim() || "com.arvio.norcoach";
  let found: Key | null = null;
  if (raw && keyId && teamId) {
    const pem = pemOf(raw);
    try {
      if (!pem) throw new Error("no key in it");
      found = { key: createPrivateKey(pem), keyId, teamId, topic };
    } catch (error) {
      console.error("[apns] APNS_KEY isn't an APNs .p8 key:", error instanceof Error ? error.message : error);
    }
  } else if (raw || keyId) {
    console.error("[apns] APNS_KEY, APNS_KEY_ID and APNS_TEAM_ID are all needed; iPhone push is off");
  }
  loaded = found;
  return found;
}

export function apnsConfigured(): boolean {
  return apnsKey() != null;
}

// Apple wants the signed token reused for 20 to 60 minutes; a new one every 40.
let jwt: { token: string; until: number } | null = null;

function providerToken(k: Key): string {
  if (jwt && Date.now() < jwt.until) return jwt.token;
  const head = Buffer.from(JSON.stringify({ alg: "ES256", kid: k.keyId })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: k.teamId, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const signature = createSign("SHA256").update(`${head}.${claims}`).sign({ key: k.key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  jwt = { token: `${head}.${claims}.${signature}`, until: Date.now() + 40 * 60 * 1000 };
  return jwt.token;
}

const HOSTS = { production: "https://api.push.apple.com", sandbox: "https://api.sandbox.push.apple.com" } as const;
type Env = keyof typeof HOSTS;

// One connection a host, kept while it is in use and closed after ten idle minutes, as Apple asks.
const sessions = new Map<Env, ClientHttp2Session>();

function session(env: Env): ClientHttp2Session {
  const open = sessions.get(env);
  if (open && !open.closed && !open.destroyed) return open;
  const s = connect(HOSTS[env]);
  const drop = () => {
    if (sessions.get(env) === s) sessions.delete(env);
  };
  s.on("error", (error) => {
    console.error(`[apns] ${env} connection:`, error.message);
    drop();
  });
  s.on("goaway", drop);
  s.on("close", drop);
  s.setTimeout(10 * 60 * 1000, () => s.close());
  sessions.set(env, s);
  return s;
}

// An idle connection never keeps the process alive (a script that sent a push can end); one with a send on its way does.
const inFlight = new Map<ClientHttp2Session, number>();

function post(env: Env, path: string, headers: Record<string, string>, body: string): Promise<{ status: number; reason: string | null }> {
  return new Promise((resolve, reject) => {
    let s: ClientHttp2Session;
    let req: ClientHttp2Stream;
    try {
      s = session(env);
      req = s.request({ ":method": "POST", ":path": path, ...headers });
    } catch (error) {
      return reject(error);
    }
    inFlight.set(s, (inFlight.get(s) ?? 0) + 1);
    s.ref();
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      const left = (inFlight.get(s) ?? 1) - 1;
      if (left > 0) inFlight.set(s, left);
      else {
        inFlight.delete(s);
        if (!s.destroyed) s.unref();
      }
      fn();
    };
    let status = 0;
    let data = "";
    req.setEncoding("utf8");
    req.setTimeout(15_000, () => {
      done(() => reject(new Error("APNs took too long")));
      req.close(constants.NGHTTP2_CANCEL);
    });
    req.on("response", (h) => {
      status = Number(h[":status"]) || 0;
    });
    req.on("data", (chunk: string) => {
      data += chunk;
    });
    req.on("end", () => {
      let reason: string | null = null;
      try {
        reason = data ? ((JSON.parse(data) as { reason?: string }).reason ?? null) : null;
      } catch {}
      done(() => resolve({ status, reason }));
    });
    req.on("error", (error) => done(() => reject(error)));
    req.on("close", () => done(() => reject(new Error("APNs closed the request"))));
    req.end(body);
  });
}

/** A string cut to at most `bytes` of UTF-8, on a whole character: Apple takes 4 KB a notification. */
function clip(s: string, bytes: number): string {
  if (Buffer.byteLength(s) <= bytes) return s;
  let out = s;
  while (Buffer.byteLength(out) > bytes - 3) out = out.slice(0, Math.floor(out.length * 0.9));
  return `${out.trimEnd()}…`;
}

/** "sent", "gone" (the token no longer exists: forget the device) or "failed" (try again next time). */
export async function sendApns(token: string, message: PushMessage): Promise<"sent" | "gone" | "failed"> {
  const k = apnsKey();
  if (!k) return "failed";
  const payload = JSON.stringify({
    aps: { alert: { title: clip(message.title, 300), body: clip(message.body, 2500) }, sound: "default" },
    // Read by the app when the notification is tapped (NativePush.tsx).
    url: message.url,
  });
  const headers: Record<string, string> = {
    authorization: `bearer ${providerToken(k)}`,
    "apns-topic": k.topic,
    "apns-push-type": "alert",
    "apns-priority": "10",
    // Held a day if the phone is off, like web push.
    "apns-expiration": String(Math.floor(Date.now() / 1000) + 24 * 60 * 60),
  };
  // Same tag, the newer one replaces the older on the lock screen (Apple takes 64 bytes).
  if (message.tag && Buffer.byteLength(message.tag) <= 64) headers["apns-collapse-id"] = message.tag;
  const path = `/3/device/${token.toLowerCase()}`;

  // A build from Xcode has a test-service token, TestFlight and the App Store a production one: each says the
  // other's token is a BadDeviceToken, so that one is tried on the other service before the token counts as gone.
  const first: Env = process.env.APNS_ENV?.trim() === "sandbox" ? "sandbox" : "production";
  const order: Env[] = [first, first === "production" ? "sandbox" : "production"];
  for (const env of order) {
    const r = await post(env, path, headers, payload);
    if (r.status === 200) return "sent";
    // Unregistered: the app was removed or notifications turned off for it.
    if (r.status === 410) return "gone";
    if (r.status === 400 && r.reason === "BadDeviceToken") continue;
    if (r.status === 403 && (r.reason === "ExpiredProviderToken" || r.reason === "InvalidProviderToken")) jwt = null;
    console.error(`[apns] ${env} send failed (${r.status} ${r.reason ?? ""})`);
    return "failed";
  }
  return "gone";
}
