import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// Back from Apple or Google: Clerk finishes the sign-in (or the sign-up, for
// an account it doesn't know yet) and goes on to /auth/continue.
export default function SsoCallbackPage() {
  return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/auth/continue" signUpFallbackRedirectUrl="/auth/continue" />;
}
