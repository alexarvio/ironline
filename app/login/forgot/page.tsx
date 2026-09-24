import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requestPasswordResetAction } from "../../lib/auth-actions";
import { resetsAvailable } from "../../lib/passwordReset";

// "Forgot password": ask for the email, send a link (lib/passwordReset.ts).
// The page after sending says the same thing whatever the email was.
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  if (!resetsAvailable()) redirect("/login");
  const { sent } = await searchParams;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Image src="/brand/logo.png" alt="" width={19} height={32} priority />
          Ironline
        </div>
        <h1 className="auth-title">Reset your password</h1>

        {sent ? (
          <p className="auth-ok">If that email has an Ironline account, a link to choose a new password is on its way. It works for the next hour.</p>
        ) : (
          <>
            <p className="auth-note auth-note-top">Enter the email you sign in with, and we&rsquo;ll send you a link to choose a new password.</p>
            <form action={requestPasswordResetAction} className="auth-form">
              <label className="auth-field">
                <span>Email</span>
                <input name="email" type="email" autoComplete="username" required autoFocus />
              </label>
              <button className="btn auth-submit" type="submit">
                Send link
              </button>
            </form>
          </>
        )}

        <p className="auth-note">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
