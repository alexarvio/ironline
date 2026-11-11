import { redirect } from "next/navigation";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { clerkOn } from "../../../lib/clerk";

// Back from Google in the app's secure sign-in sheet: Clerk finishes the sign-in (or the sign-up, for a Google account
// it doesn't know yet) and goes on to /auth/native/finish, which hands the app its ticket.
export const dynamic = "force-dynamic";

export default function NativeCallbackPage() {
  if (!clerkOn()) redirect("/login");
  return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/auth/native/finish" signUpFallbackRedirectUrl="/auth/native/finish" />;
}
