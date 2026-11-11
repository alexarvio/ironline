import { clerkClient } from "@clerk/nextjs/server";
import { clerkOn } from "../../../lib/clerk";
import { B64URL, redeemCode } from "../../../lib/nativeAuth";

// The app trades the one-time code from /auth/native/finish and its secret for a Clerk sign-in ticket (good for a minute),
// which it signs in with in its own view. Once per code; a wrong secret spends the code.
export const dynamic = "force-dynamic";

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!clerkOn()) return json({ error: "off" }, 404);
  let body: { code?: unknown; verifier?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const code = typeof body.code === "string" ? body.code : "";
  const verifier = typeof body.verifier === "string" ? body.verifier : "";
  if (!B64URL.test(code) || !B64URL.test(verifier)) return json({ error: "bad_request" }, 400);
  const userId = redeemCode(code, verifier);
  if (!userId) return json({ error: "expired" }, 400);
  try {
    const token = await (await clerkClient()).signInTokens.createSignInToken({ userId, expiresInSeconds: 60 });
    return json({ ticket: token.token });
  } catch (error) {
    console.error("[native sign-in] ticket failed:", error instanceof Error ? error.message : error);
    return json({ error: "ticket" }, 500);
  }
}
