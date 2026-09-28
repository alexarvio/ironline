import { redirect } from "next/navigation";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { clerkOn } from "../lib/clerk";

// Back from Apple or Google: Clerk finishes the sign-in (or the sign-up, for
// an account it doesn't know yet) and goes on to /auth/continue. Drawn per
// request, never at build time: without Clerk (no keys on the server) there
// is no ClerkProvider to render its callback in, so it goes to the login.
export const dynamic = "force-dynamic";

export default function SsoCallbackPage() {
  if (!clerkOn()) redirect("/login");
  return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/auth/continue" signUpFallbackRedirectUrl="/auth/continue" />;
}
