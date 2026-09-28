"use client";

import { useEffect, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { AuthShell, CodeScreen, CoachSignUpScreen, InviteWelcomeScreen, SignInScreen } from "./SignInScreens";

// Clerk behind the sign-in screens (26 Sep). One way in for everyone: an
// email code, or Apple or Google. An email Clerk doesn't know yet (anyone
// from before the switch, a newly invited client) is signed up on the spot
// with the same code, so the person never has to know which it was.
// Whatever happens, the last stop is /auth/continue, which looks up our own
// account for them and sends them on (lib/clerk.ts links the two).

const CONTINUE = "/auth/continue";
const INTENT = "ironline_intent";

/** Clerk's own message for what went wrong, in a sentence. */
function says(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (isClerkAPIResponseError(error)) {
    const e = error.errors[0];
    if (e?.code === "form_code_incorrect") return "That code isn't right. Check the email and try again.";
    if (e?.code === "verification_expired") return "That code has expired. Send a new one.";
    return e?.longMessage || e?.message || fallback;
  }
  return fallback;
}
const notFound = (error: unknown) => isClerkAPIResponseError(error) && error.errors.some((e) => e.code === "form_identifier_not_found");
const exists = (error: unknown) => isClerkAPIResponseError(error) && error.errors.some((e) => e.code === "form_identifier_exists");

/** After Clerk says yes: a full page load, so the server sees the new session. */
// eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load on purpose: the server must read the new session cookie
const land = () => window.location.assign(CONTINUE);

/**
 * The email-code steps, shared by sign-in and coach sign-up: send a code to
 * the address (signing in if Clerk knows it, signing up if not), then check it.
 */
function useEmailCode() {
  const { isLoaded: inLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: upLoaded, signUp } = useSignUp();
  // "in2": Clerk asked for a second code after the first (a new device, say).
  const [step, setStep] = useState<{ email: string; via: "in" | "up" | "in2" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = inLoaded && upLoaded;

  const send = async (email: string) => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: email });
      const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === "email_code");
      if (!factor || !("emailAddressId" in factor)) throw new Error("no email code");
      await attempt.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
      setStep({ email, via: "in" });
    } catch (e) {
      if (!notFound(e)) {
        setError(says(e));
        setBusy(false);
        return;
      }
      // Not in Clerk yet: the same code signs them up.
      try {
        await signUp.create({ emailAddress: email });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep({ email, via: "up" });
      } catch (e2) {
        setError(says(e2));
      }
    }
    setBusy(false);
  };

  const verify = async (code: string) => {
    if (!ready || !step) return;
    setBusy(true);
    setError(null);
    try {
      const done =
        step.via === "in"
          ? await signIn.attemptFirstFactor({ strategy: "email_code", code })
          : step.via === "in2"
            ? await signIn.attemptSecondFactor({ strategy: "email_code", code })
            : await signUp.attemptEmailAddressVerification({ code });
      if (done.status === "complete" && done.createdSessionId) {
        await setActive({ session: done.createdSessionId });
        land();
        return;
      }
      // One more check (a sign-in from a new device): a second code to the same email.
      if ("supportedSecondFactors" in done && (done.status === "needs_second_factor" || done.status === "needs_client_trust")) {
        const second = done.supportedSecondFactors?.find((f) => f.strategy === "email_code");
        if (second && "emailAddressId" in second) {
          await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: second.emailAddressId });
          setStep({ email: step.email, via: "in2" });
          setError("One more check: we sent a new code to the same email.");
          setBusy(false);
          return;
        }
      }
      setError(`Almost: Clerk wants one more step (${done.status}). Tell the coach.`);
    } catch (e) {
      setError(says(e));
    }
    setBusy(false);
  };

  const oauth = (strategy: "oauth_apple" | "oauth_google") => {
    if (!ready) return;
    setBusy(true);
    // A Google or Apple account Clerk doesn't know yet is signed up on the way back.
    signIn.authenticateWithRedirect({ strategy, redirectUrl: "/sso-callback", redirectUrlComplete: CONTINUE }).catch((e) => {
      setError(says(e));
      setBusy(false);
    });
  };

  // Busy only while something is on its way; before Clerk has loaded a tap simply waits.
  return { step, busy, error, send, verify, oauth, back: () => (setStep(null), setError(null)) };
}

/** /login: Apple, Google or an email code. */
export function SignInFlow({ notice }: { notice?: string | null }) {
  const f = useEmailCode();
  if (f.step) return <CodeScreen key={f.step.via} email={f.step.email} onVerify={f.verify} onResend={() => f.send(f.step!.email)} onBack={f.back} busy={f.busy} error={f.error} />;
  return <SignInScreen onEmail={f.send} onApple={() => f.oauth("oauth_apple")} onGoogle={() => f.oauth("oauth_google")} busy={f.busy} error={f.error} notice={notice} />;
}

/**
 * /signup: a coach makes their own account. First only how they sign in; a
 * short-lived cookie tells /auth/continue this was a coach sign-up, and it
 * asks who they are next (/auth/coach-details), whichever way they came.
 */
export function CoachSignUpFlow() {
  const f = useEmailCode();
  const remember = () => {
    document.cookie = `${INTENT}=${encodeURIComponent(JSON.stringify({ coach: true }))}; path=/; max-age=3600; samesite=lax`;
  };
  if (f.step) return <CodeScreen key={f.step.via} email={f.step.email} title="Confirm your email" onVerify={f.verify} onResend={() => f.send(f.step!.email)} onBack={f.back} busy={f.busy} error={f.error} />;
  return (
    <CoachSignUpScreen
      busy={f.busy}
      error={f.error}
      onEmail={(email) => {
        remember();
        f.send(email);
      }}
      onApple={() => {
        remember();
        f.oauth("oauth_apple");
      }}
      onGoogle={() => {
        remember();
        f.oauth("oauth_google");
      }}
    />
  );
}

/**
 * /invite: where a client's invite link lands. "Continue with email" uses the
 * ticket in the link, which already proves the address: no code to type.
 * Apple or Google work too, when that account has the same email.
 */
export function InviteFlow({ ticket, firstName, email, coachName, coachPhoto }: { ticket: string | null; firstName: string; email: string | null; coachName: string; coachPhoto: string | null }) {
  const { isLoaded: inLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: upLoaded, signUp } = useSignUp();
  const code = useEmailCode();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = inLoaded && upLoaded;

  const accept = async () => {
    if (!ready) return;
    // No ticket (an old link, or opened twice): the email code instead.
    if (!ticket) {
      if (email) code.send(email);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const done = await signUp.create({ strategy: "ticket", ticket });
      if (done.status === "complete" && done.createdSessionId) {
        await setActive({ session: done.createdSessionId });
        return land();
      }
      setError("Almost: Clerk wants one more step we don't ask for yet. Tell your coach.");
    } catch (e) {
      // Already has a Clerk account: the ticket signs them in instead.
      if (exists(e)) {
        try {
          const done = await signIn.create({ strategy: "ticket", ticket });
          if (done.status === "complete" && done.createdSessionId) {
            await setActive({ session: done.createdSessionId });
            return land();
          }
        } catch (e2) {
          setError(says(e2));
        }
      } else if (email) {
        // A used or expired ticket: fall back to a code to the same address.
        code.send(email);
      } else {
        setError(says(e, "This invite link has expired. Ask your coach to send a new one."));
      }
    }
    setBusy(false);
  };

  if (code.step) return <CodeScreen key={code.step.via} email={code.step.email} onVerify={code.verify} onResend={() => code.send(code.step!.email)} onBack={code.back} busy={code.busy} error={code.error} />;
  return (
    <InviteWelcomeScreen
      firstName={firstName}
      email={email}
      coachName={coachName}
      coachPhoto={coachPhoto}
      busy={busy || code.busy}
      error={error ?? code.error}
      onAccept={accept}
      onApple={() => code.oauth("oauth_apple")}
      onGoogle={() => code.oauth("oauth_google")}
    />
  );
}

/** /auth/signout: Clerk signs out in the browser, then the sign-in screen. */
export function SignOutNow({ to = "/login" }: { to?: string }) {
  const { signOut } = useClerk();
  const { isLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    // Once Clerk has loaded: sign out if signed in, else straight on.
    if (!isLoaded) return;
    // Our own leftover goes too: the coach sign-up note.
    document.cookie = `${INTENT}=; path=/; max-age=0`;
    if (isSignedIn) signOut({ redirectUrl: to });
    else window.location.replace(to);
  }, [isLoaded, isSignedIn, signOut, to]);
  return (
    <AuthShell>
      <p className="au-lead">Signing out…</p>
    </AuthShell>
  );
}
