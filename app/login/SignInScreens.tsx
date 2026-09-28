"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";

// The sign-in screens for the switch to Clerk (26 Sep): no passwords, an
// email code or Apple or Google, for coaches and clients alike. Each screen
// only draws and reports what was typed or pressed; ClerkFlows.tsx runs
// Clerk behind them, and the onboarding board shows them with nothing
// wired (every handler optional).

type Busy = { busy?: boolean; error?: string | null };
type Oauth = { onApple?: () => void; onGoogle?: () => void };

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card au-card">
        <div className="auth-brand">
          <Image src="/brand/logo.png" alt="" width={19} height={32} priority />
          Ironline
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorLine({ error }: { error?: string | null }) {
  return error ? <p className="auth-error au-error">{error}</p> : null;
}

/** Apple and Google, then "or", then the email box. */
function Providers({ verb = "Continue", onApple, onGoogle, busy }: Oauth & { verb?: string; busy?: boolean }) {
  return (
    <div className="au-providers">
      <button type="button" className="au-provider apple" onClick={onApple} disabled={busy}>
        <AppleGlyph />
        {verb} with Apple
      </button>
      <button type="button" className="au-provider" onClick={onGoogle} disabled={busy}>
        <GoogleGlyph />
        {verb} with Google
      </button>
    </div>
  );
}

function Or() {
  return (
    <div className="au-or" role="separator">
      <span>or</span>
    </div>
  );
}

/** Signing in, coach or client: Apple, Google, or an email that gets a code. */
export function SignInScreen({ onEmail, onApple, onGoogle, busy, error, notice, signupHref = "/signup" }: Oauth & Busy & { onEmail?: (email: string) => void; notice?: string | null; signupHref?: string }) {
  const [email, setEmail] = useState("");
  return (
    <AuthShell>
      <h1 className="auth-title">Sign in</h1>
      {notice && <p className="auth-ok">{notice}</p>}
      <ErrorLine error={error} />
      <Providers onApple={onApple} onGoogle={onGoogle} busy={busy} />
      <Or />
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) onEmail?.(email.trim());
        }}
      >
        <label className="auth-field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {/* Where Clerk puts its bot check when a new account is made (sign-up protection). */}
        <div id="clerk-captcha" />
        <button className="btn auth-submit" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Email me a code"}
        </button>
      </form>
      <p className="auth-note">
        Coaching others? <a href={signupHref}>Create a coach account</a>
      </p>
      <p className="auth-note auth-legal">
        <a href="/privacy">Privacy policy</a> · <a href="/support">Support</a>
      </p>
    </AuthShell>
  );
}

/** The six digits from the email. Typing moves along; a pasted code fills them all, and the last digit sends. */
export function CodeScreen({ email, title = "Check your email", onVerify, onResend, onBack, busy, error }: Busy & { email: string; title?: string; onVerify?: (code: string) => void; onResend?: () => void; onBack?: () => void }) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const done = (next: string[]) => {
    if (next.every((x) => x)) onVerify?.(next.join(""));
  };
  const put = (i: number, value: string) => {
    const only = value.replace(/\D/g, "");
    const next = [...digits];
    if (only.length > 1) {
      only.slice(0, 6 - i).split("").forEach((d, k) => (next[i + k] = d));
      setDigits(next);
      boxes.current[Math.min(5, i + only.length)]?.focus();
      done(next);
      return;
    }
    next[i] = only;
    setDigits(next);
    if (only && i < 5) boxes.current[i + 1]?.focus();
    if (only) done(next);
  };
  return (
    <AuthShell>
      <h1 className="auth-title">{title}</h1>
      <p className="auth-note auth-note-top">
        We sent a 6-digit code to <b>{email}</b>.
      </p>
      <ErrorLine error={error} />
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          done(digits);
        }}
      >
        <div className="au-code" role="group" aria-label="The code from the email">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              autoFocus={i === 0}
              maxLength={6}
              aria-label={`Digit ${i + 1}`}
              onChange={(e) => put(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus();
              }}
            />
          ))}
        </div>
        <button className="btn auth-submit" type="submit" disabled={busy || digits.some((x) => !x)}>
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
      <p className="auth-note">
        Nothing there? Check spam, or{" "}
        <button type="button" className="au-link" onClick={onResend} disabled={busy}>
          send a new code
        </button>
      </p>
      <p className="auth-note">
        <button type="button" className="au-link" onClick={onBack}>
          Use a different email
        </button>
      </p>
    </AuthShell>
  );
}

/** A coach making their own account: how they sign in, first. Who they are comes next (CoachDetailsScreen). */
export function CoachSignUpScreen({ onEmail, onApple, onGoogle, busy, error }: Oauth & Busy & { onEmail?: (email: string) => void }) {
  const [email, setEmail] = useState("");
  return (
    <AuthShell>
      <h1 className="auth-title">Create a coach account</h1>
      <ErrorLine error={error} />
      <Providers verb="Sign up" onApple={onApple} onGoogle={onGoogle} busy={busy} />
      <Or />
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) onEmail?.(email.trim());
        }}
      >
        <label className="auth-field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {/* Where Clerk puts its bot check when a new account is made (sign-up protection). */}
        <div id="clerk-captcha" />
        <button className="btn auth-submit" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Email me a code"}
        </button>
      </form>
      <p className="auth-note">
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </AuthShell>
  );
}

/**
 * Right after signing up: who the coach is. The name comes filled in from
 * Apple or Google when they shared it. A plain form posting to the server
 * (finishCoachSignUpAction), which makes the account that waits for approval.
 */
export function CoachDetailsScreen({ action, name, email, error }: { action?: (formData: FormData) => void | Promise<void>; name: string; email: string; error?: string | null }) {
  return (
    <AuthShell>
      <h1 className="auth-title">About you</h1>
      <p className="auth-note auth-note-top">
        Signed up as <b>{email}</b>. This is how you&rsquo;ll appear to your clients.
      </p>
      <ErrorLine error={error} />
      <form className="auth-form" action={action}>
        <label className="auth-field">
          <span>Your name</span>
          <input name="name" autoComplete="name" placeholder="Finlay Chedd" defaultValue={name} required maxLength={80} autoFocus={!name} />
        </label>
        <label className="auth-field">
          <span>Business name</span>
          <input name="business" autoComplete="organization" placeholder="Full Potential Coaching" maxLength={120} autoFocus={!!name} />
        </label>
        <button className="btn auth-submit" type="submit">
          Continue
        </button>
      </form>
    </AuthShell>
  );
}

/** A new coach, signed up and waiting for the owner to let them in. */
export function WaitingScreen({ name, signOut }: { name: string; signOut?: ReactNode }) {
  return (
    <AuthShell>
      <h1 className="auth-title">Thanks, {name}</h1>
      <p className="au-lead">Your coach account is waiting for approval. We&rsquo;ll email you as soon as you&rsquo;re in, usually within a day.</p>
      <p className="auth-note">{signOut ?? <a href="#">Sign out</a>}</p>
    </AuthShell>
  );
}

/** Signed in, but this email has no Ironline account. */
export function NoAccountScreen({ email, signOut }: { email: string; signOut?: ReactNode }) {
  return (
    <AuthShell>
      <h1 className="auth-title">No account yet</h1>
      <p className="au-lead">
        There&rsquo;s no Ironline account for <b>{email}</b>. If you train with a coach, ask them to invite you with this email. Coaching others yourself?{" "}
        <a href="/signup">Create a coach account</a>.
      </p>
      <p className="auth-note">{signOut ?? <a href="#">Use a different email</a>}</p>
    </AuthShell>
  );
}

/** Where the invite link lands: who invited them, then how they want to get in. */
export function InviteWelcomeScreen({
  firstName,
  email,
  coachName,
  coachPhoto,
  onAccept,
  onApple,
  onGoogle,
  busy,
  error,
}: Oauth & Busy & { firstName: string; email: string | null; coachName: string; coachPhoto: string | null; onAccept?: () => void }) {
  const coachFirst = coachName.split(" ")[0];
  return (
    <AuthShell>
      <div className="au-invite">
        <span className="au-coach" aria-hidden="true">
          {coachPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- the coach's own upload, served by the app
            <img src={coachPhoto} alt="" />
          ) : (
            coachName.charAt(0).toUpperCase()
          )}
        </span>
        <h1 className="auth-title au-invite-title">
          {firstName}, {coachFirst} invited you
        </h1>
        <p className="au-lead">Your training, food and check-ins with {coachFirst}, in one app.</p>
      </div>
      <ErrorLine error={error} />
      <Providers onApple={onApple} onGoogle={onGoogle} busy={busy} />
      <Or />
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          onAccept?.();
        }}
      >
        {email && (
          <label className="auth-field">
            <span>Email</span>
            <input name="email" type="email" value={email} readOnly />
          </label>
        )}
        <div id="clerk-captcha" />
        <button className="btn auth-submit" type="submit" disabled={busy}>
          {busy ? "One moment…" : "Continue with email"}
        </button>
      </form>
    </AuthShell>
  );
}

/** The owner's list of coaches waiting to be let in. */
export function ApprovalsScreen({ waiting }: { waiting: { name: string; business: string; email: string; when: string }[] }) {
  return (
    <div className="au-approvals">
      <h2 className="au-approvals-title">Waiting for approval</h2>
      <div className="au-approvals-list">
        {waiting.map((w) => (
          <div key={w.email} className="au-approval">
            <span className="au-approval-main">
              <b>{w.name}</b>
              <small>
                {w.business} · {w.email} · signed up {w.when}
              </small>
            </span>
            <button type="button" className="au-btn">
              Decline
            </button>
            <button type="button" className="au-btn primary">
              Approve
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The client's invite email: from the coach by name, one button. */
export function InviteEmailScreen({ firstName, coachName, email }: { firstName: string; coachName: string; email: string }) {
  return (
    <div className="ob-mail">
      <div className="ob-mail-head">
        <span className="ob-mail-subject">{coachName} invited you to Ironline</span>
        <span className="ob-mail-from">
          {coachName} &lt;hello@ironline.app&gt; · to {email}
        </span>
      </div>
      <div className="ob-mail-body">
        <p>Hi {firstName},</p>
        <p>{coachName} has set you up on Ironline, where your training, food and check-ins live.</p>
        <p>
          <a className="au-mail-btn" href="#">
            Accept the invite
          </a>
        </p>
        <p className="au-mail-small">The link works for 30 days. Questions? Just reply to this email and it goes to {coachName.split(" ")[0]}.</p>
      </div>
    </div>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.57c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.33-3.55zM14.18 6.1c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.93 2.69.98.08 1.98-.5 2.59-1.23z" />
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
