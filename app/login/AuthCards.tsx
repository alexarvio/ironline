import Image from "next/image";
import Link from "next/link";
import { changePasswordAction, loginAction } from "../lib/auth-actions";
import PasswordInput from "./PasswordInput";

// The sign-in and choose-a-password cards, without the guards around them:
// the pages add those (who is signed in, where they belong), and the
// onboarding board shows the same cards as they are.

export function LoginCard({ error, deleted, reset, canReset }: { error?: string; deleted?: string; reset?: string; /** "Forgot your password?" shows once email is set up. */ canReset: boolean }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Image src="/brand/logo.png" alt="" width={19} height={32} priority />
          Ironline
        </div>
        <h1 className="auth-title">Sign in</h1>

        {deleted && <p className="auth-ok">Your account and everything in it has been deleted.</p>}
        {reset && <p className="auth-ok">Password saved. Sign in with your new one.</p>}
        {error === "locked" ? (
          <p className="auth-error">Too many attempts. Try again in 15 minutes.</p>
        ) : (
          error && <p className="auth-error">Wrong email or password.</p>
        )}

        <form action={loginAction} className="auth-form">
          <label className="auth-field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <PasswordInput name="password" autoComplete="current-password" />
          </label>
          <button className="btn auth-submit" type="submit">
            Sign in
          </button>
        </form>

        {canReset && (
          <p className="auth-note">
            <Link href="/login/forgot">Forgot your password?</Link>
          </p>
        )}
        <p className="auth-note">
          Don&rsquo;t have an account? Your coach creates it for you.
        </p>
        <p className="auth-note auth-legal">
          <Link href="/privacy">Privacy policy</Link> · <Link href="/support">Support</Link>
        </p>
      </div>
    </div>
  );
}

export function ChangePasswordCard({ error }: { error?: string }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Image src="/brand/logo.png" alt="" width={19} height={32} priority />
          Ironline
        </div>
        <h1 className="auth-title">Choose a password</h1>
        <p className="auth-note auth-note-top">
          You&rsquo;re signed in with a temporary password. Pick your own to continue.
        </p>

        {error === "short" && <p className="auth-error">Use at least 8 characters.</p>}
        {error === "match" && <p className="auth-error">Those two didn&rsquo;t match.</p>}

        <form action={changePasswordAction} className="auth-form">
          <label className="auth-field">
            <span>New password</span>
            <PasswordInput name="password" autoComplete="new-password" minLength={8} autoFocus />
          </label>
          <label className="auth-field">
            <span>Confirm password</span>
            <PasswordInput name="confirm" autoComplete="new-password" minLength={8} />
          </label>
          <button className="btn auth-submit" type="submit">
            Save and continue
          </button>
        </form>
      </div>
    </div>
  );
}
