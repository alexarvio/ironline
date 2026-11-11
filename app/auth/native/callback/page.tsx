import { redirect } from "next/navigation";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { clerkOn } from "../../../lib/clerk";

// Back from Google in the app's secure sign-in sheet: Clerk finishes the sign-in (or the sign-up, for a Google account
// it doesn't know yet) and goes on to /auth/native/done, which makes the one real load of /auth/native/finish.
export const dynamic = "force-dynamic";

export default function NativeCallbackPage() {
  if (!clerkOn()) redirect("/login");
  return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/auth/native/done" signUpFallbackRedirectUrl="/auth/native/done" />;
}
