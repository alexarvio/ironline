import Link from "next/link";
import { redirect } from "next/navigation";
import { requestPasswordResetAction } from "../../lib/auth-actions";
import { resetsAvailable } from "../../lib/passwordReset";
import { clerkOn } from "../../lib/clerk";
import { NorCoachLogo } from "../../components/NorCoachLogo";

// "Forgot password": ask for the email, send a link (lib/passwordReset.ts).
// The page after sending says the same thing whatever the email was.
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  // No passwords to forget with Clerk; nor without email set up.
  if (clerkOn() || !resetsAvailable()) redirect("/login");
  const { sent } = await searchParams;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <NorCoachLogo />
        </div>
        <h1 className="auth-title">Reset your password</h1>

        {sent ? (
          <p className="auth-ok">If that email has an NorCoach account, a link to choose a new password is on its way. It works for the next hour.</p>
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
