import { clerkOn } from "../../../lib/clerk";
import { randomBytes } from "node:crypto";
import { B64URL } from "../../../lib/nativeAuth";

// The iPhone app's Google sign-in begins here (11 Nov, Alex), in Apple's secure sign-in sheet (mobile/ios
// SceneDelegate.swift, NorcoachAuth.openSignIn). Kept in this sheet's own cookies, out of the page's reach: the app's
// state, the SHA-256 of its secret (app/lib/nativeAuth.ts) and when this began, so /auth/native/finish answers only a
// sign-in that happened in this sheet after this moment. Then on to /auth/native/go, which takes them to Google.
export const dynamic = "force-dynamic";

const COOKIE = "Path=/auth/native; Max-Age=300; HttpOnly; Secure; SameSite=Lax";
const toApp = (error: string) => new Response(null, { status: 302, headers: { Location: `norcoach://auth?error=${error}`, "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  if (!clerkOn()) return toApp("off");
  const q = new URL(request.url).searchParams;
  const state = q.get("state") ?? "";
  const challenge = q.get("challenge") ?? "";
  // Google alone: Apple signs in natively in the app, with no page.
  if (q.get("provider") !== "google" || !/^[A-Za-z0-9_-]{16,128}$/.test(state) || !B64URL.test(challenge)) return toApp("bad_request");
  const headers = new Headers({ Location: "/auth/native/go", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", `norcoach_native_state=${state}; ${COOKIE}`);
  headers.append("Set-Cookie", `norcoach_native_challenge=${challenge}; ${COOKIE}`);
  headers.append("Set-Cookie", `norcoach_native_started=${Date.now()}; ${COOKIE}`);
  // A number no page or other site can read (second review of the sign-in): /go sends it round through Clerk's Google
  // return address, and /finish answers only when it comes back, so cookies planted by another site trigger nothing.
  const nonce = randomBytes(24).toString("base64url");
  headers.append("Set-Cookie", `norcoach_native_nonce=${nonce}; ${COOKIE}`);
  return new Response(null, { status: 303, headers });
}
