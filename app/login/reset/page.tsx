import Image from "next/image";
import Link from "next/link";
import { completePasswordResetAction } from "../../lib/auth-actions";
import { resetTokenValid } from "../../lib/passwordReset";
import PasswordInput from "../PasswordInput";

// Where the emailed link lands: choose a new password (lib/passwordReset.ts).
// A used, expired or made-up link gets a way to ask for a new one instead.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  const valid = error !== "expired" && (await resetTokenValid(token));

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Image src="/brand/logo.png" alt="" width={19} height={32} priority />
          Ironline
        </div>
        <h1 className="auth-title">Choose a new password</h1>

        {valid ? (
          <>
            {error === "short" && <p className="auth-error">Use at least 8 characters.</p>}
            {error === "match" && <p className="auth-error">Those two didn&rsquo;t match.</p>}
            <form action={completePasswordResetAction} className="auth-form">
              <input type="hidden" name="token" value={token} />
              <label className="auth-field">
                <span>New password</span>
                <PasswordInput name="password" autoComplete="new-password" minLength={8} autoFocus />
              </label>
              <label className="auth-field">
                <span>Confirm password</span>
                <PasswordInput name="confirm" autoComplete="new-password" minLength={8} />
              </label>
              <button className="btn auth-submit" type="submit">
                Save password
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="auth-error">This link has expired or was already used.</p>
            <p className="auth-note">
              <Link href="/login/forgot">Send a new link</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
