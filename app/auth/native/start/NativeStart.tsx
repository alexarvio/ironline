"use client";

import { useEffect, useRef, useState } from "react";
import { useSignIn } from "@clerk/nextjs/legacy";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { AuthShell } from "../../../login/SignInScreens";

// In the secure sheet: the app's state is kept for /auth/native/finish to give back (so a ticket only ever goes to the
// sign-in the app itself started), then Clerk takes the person to Google.
export function NativeStart({ state }: { state: string }) {
  const { isLoaded, signIn } = useSignIn();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    document.cookie = `norcoach_native_state=${state}; Path=/auth/native; Max-Age=900; SameSite=Lax; Secure`;
    signIn
      .authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/auth/native/callback", redirectUrlComplete: "/auth/native/finish" })
      .catch((e) => {
        // Signed in already in this sheet: straight to the ticket.
        if (isClerkAPIResponseError(e) && e.errors.some((x) => x.code === "session_exists")) {
          window.location.replace("/auth/native/finish");
          return;
        }
        setError(isClerkAPIResponseError(e) ? (e.errors[0]?.longMessage ?? e.errors[0]?.message ?? "Couldn't open Google") : "Couldn't open Google");
      });
  }, [isLoaded, signIn, state]);
  return (
    <AuthShell>
      <p className="auth-sub" style={{ textAlign: "center" }}>
        {error ?? "Opening Google"}
      </p>
    </AuthShell>
  );
}
