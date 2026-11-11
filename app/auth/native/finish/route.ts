import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { clerkOn } from "../../../lib/clerk";

// The end of the iPhone app's Google sign-in in the secure sheet (11 Nov, Alex): the person is signed in to Clerk in the
// sheet, so they get a one-time ticket, good for two minutes, and the sheet ends on norcoach://auth with it; the app
// signs in with it in its own view. Only for a sign-in the app started: the state it opened /auth/native/start with,
// kept there in this sheet's own cookie, must be here, and goes back with the ticket for the app to check. The sheet's
// own session is ended, as the sheet is thrown away anyway.
export const dynamic = "force-dynamic";

const back = (params: Record<string, string>) =>
  new Response(null, { status: 302, headers: { Location: `norcoach://auth?${new URLSearchParams(params).toString()}`, "Cache-Control": "no-store" } });

export async function GET() {
  if (!clerkOn()) return back({ error: "off" });
  const jar = await cookies();
  const state = jar.get("norcoach_native_state")?.value ?? "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(state)) return back({ error: "no_state" });
  const { userId, sessionId } = await auth();
  if (!userId) return back({ error: "signin", state });
  try {
    const client = await clerkClient();
    const token = await client.signInTokens.createSignInToken({ userId, expiresInSeconds: 120 });
    if (sessionId) await client.sessions.revokeSession(sessionId).catch(() => null);
    const res = back({ ticket: token.token, state });
    res.headers.append("Set-Cookie", "norcoach_native_state=; Path=/auth/native; Max-Age=0; SameSite=Lax; Secure");
    return res;
  } catch (error) {
    console.error("[native sign-in] ticket failed:", error instanceof Error ? error.message : error);
    return back({ error: "ticket", state });
  }
}
