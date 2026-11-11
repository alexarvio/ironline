"use client";

import { useEffect, useRef, useState } from "react";
import { useSignIn } from "@clerk/nextjs/legacy";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { AuthShell } from "../../../login/SignInScreens";

// In the secure sheet: Clerk takes the person to Google, back through /auth/native/callback to /auth/native/done. The
// sheet keeps nothing from before, so a session already here means this is not the app's sheet: it stops (review of
// 2e029fe: that path minted a ticket for a website session).
export function NativeStart() {
  const { isLoaded, signIn } = useSignIn();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    signIn.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/auth/native/callback", redirectUrlComplete: "/auth/native/done" }).catch((e) => {
      const already = isClerkAPIResponseError(e) && e.errors.some((x) => x.code === "session_exists");
      setError(already ? "Already signed in here. Close this and try again from the app." : isClerkAPIResponseError(e) ? (e.errors[0]?.longMessage ?? e.errors[0]?.message ?? "Couldn't open Google") : "Couldn't open Google");
    });
  }, [isLoaded, signIn]);
  return (
    <AuthShell>
      <p className="auth-sub" style={{ textAlign: "center" }}>
        {error ?? "Opening Google"}
      </p>
    </AuthShell>
  );
}
