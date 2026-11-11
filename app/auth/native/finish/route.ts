import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { clerkOn } from "../../../lib/clerk";
import { B64URL, issueCode } from "../../../lib/nativeAuth";

// The end of the iPhone app's Google sign-in in the secure sheet (11 Nov, Alex). Only for a sign-in that began on
// /auth/native/start in this sheet and whose Clerk session was made after it began (review of 2e029fe: an older website
// session must never be handed on, nor signed out): the signed-in user is kept under a one-time code (app/lib/
// nativeAuth.ts) and the sheet ends on norcoach://auth with that code and the app's state. The app trades the code
// and its secret for a ticket. The sheet's own session is ended, as the sheet is thrown away.
export const dynamic = "force-dynamic";

const CLEAR = "Path=/auth/native; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
function back(params: Record<string, string>) {
  const headers = new Headers({ Location: `norcoach://auth?${new URLSearchParams(params).toString()}`, "Cache-Control": "no-store" });
  for (const name of ["norcoach_native_state", "norcoach_native_challenge", "norcoach_native_started"]) headers.append("Set-Cookie", `${name}=; ${CLEAR}`);
  return new Response(null, { status: 302, headers });
}

export async function GET(request: Request) {
  // A real page load only; a background fetch (a router prefetch or push) does nothing.
  if (request.headers.get("rsc") || request.headers.get("next-router-prefetch") || (request.headers.get("sec-fetch-dest") ?? "document") !== "document") {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  if (!clerkOn()) return back({ error: "off" });
  const jar = await cookies();
  const state = jar.get("norcoach_native_state")?.value ?? "";
  const challenge = jar.get("norcoach_native_challenge")?.value ?? "";
  const started = Number(jar.get("norcoach_native_started")?.value ?? "");
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(state) || !B64URL.test(challenge) || !Number.isFinite(started)) return back({ error: "no_state" });
  const { userId, sessionId } = await auth();
  if (!userId || !sessionId) return back({ error: "signin", state });
  try {
    const client = await clerkClient();
    const session = await client.sessions.getSession(sessionId);
    // Made in this sheet, after the start (a little leeway for the clocks).
    if (session.createdAt < started - 5000) return back({ error: "old_session", state });
    const code = issueCode(userId, challenge);
    await client.sessions.revokeSession(sessionId).catch(() => null);
    return back({ code, state });
  } catch (error) {
    console.error("[native sign-in] finish failed:", error instanceof Error ? error.message : error);
    return back({ error: "finish", state });
  }
}
