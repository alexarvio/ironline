import { createHash, randomBytes } from "node:crypto";

// The iPhone app's Google sign-in (11 Nov, Alex), PKCE-shaped (review of 2e029fe: a link in a normal browser could
// mint a ticket for whoever was signed in there and send it to any app holding norcoach://). The app makes a secret
// and shows the site only its SHA-256 (/auth/native/start). After Google, /auth/native/finish keeps the signed-in user
// here under a one-time code and sends the app that code alone; the app trades the code and its secret for a Clerk
// ticket (/auth/native/exchange). An intercepted code is worth nothing without the secret, which never leaves the app.
// Kept in memory: one server, and a code lives two minutes.

type Pending = { userId: string; challenge: string; expires: number };
const store: Map<string, Pending> = ((globalThis as { __nativeAuth?: Map<string, Pending> }).__nativeAuth ??= new Map());

export const CODE_TTL_MS = 120_000;
/** base64url, as PKCE writes it. */
export const B64URL = /^[A-Za-z0-9_-]{43,128}$/;

const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const challengeOf = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());

function sweep(now: number) {
  for (const [code, p] of store) if (p.expires <= now) store.delete(code);
}

/** A one-time code for a user signed in by the sheet, to be traded with the app's secret. */
export function issueCode(userId: string, challenge: string): string {
  const now = Date.now();
  sweep(now);
  const code = b64url(randomBytes(32));
  store.set(code, { userId, challenge, expires: now + CODE_TTL_MS });
  return code;
}

/** The user behind a code, once, if the secret matches its fingerprint and the code is still fresh. */
export function redeemCode(code: string, verifier: string): string | null {
  const now = Date.now();
  sweep(now);
  const p = store.get(code);
  if (!p) return null;
  store.delete(code);
  if (p.expires <= now || challengeOf(verifier) !== p.challenge) return null;
  return p.userId;
}
