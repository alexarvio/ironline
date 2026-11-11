import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { clerkOn } from "../../../lib/clerk";

// Back from Google in the app's secure sign-in sheet: Clerk finishes the sign-in (or the sign-up, for a Google account
// it doesn't know yet) and goes on to /auth/native/done with the start's secret number, which makes the one real load
// of /auth/native/finish.
export const dynamic = "force-dynamic";

export default async function NativeCallbackPage() {
  if (!clerkOn()) redirect("/login");
  const nonce = (await cookies()).get("norcoach_native_nonce")?.value ?? "";
  const done = /^[A-Za-z0-9_-]{32}$/.test(nonce) ? `/auth/native/done?n=${nonce}` : "/auth/native/done";
  return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl={done} signUpFallbackRedirectUrl={done} />;
}
