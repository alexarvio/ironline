import { redirect } from "next/navigation";
import { changePasswordAction } from "../../lib/auth-actions";
import { getSessionUser } from "../../lib/auth";

// Shown once, after a coach hands out a temporary password. Every guard
// redirects here while must_change_password is set, so there's no way to
// reach the rest of the app on a password the coach has seen.
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.must_change_password) {
    redirect(user.role === "coach" ? "/admin" : "/client");
  }

  const { error } = await searchParams;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Ironline</div>
        <h1 className="auth-title">Choose a password</h1>
        <p className="auth-note auth-note-top">
          You&rsquo;re signed in with a temporary password. Pick your own to continue.
        </p>

        {error === "short" && <p className="auth-error">Use at least 8 characters.</p>}
        {error === "match" && <p className="auth-error">Those two didn&rsquo;t match.</p>}

        <form action={changePasswordAction} className="auth-form">
          <label className="auth-field">
            <span>New password</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus
            />
          </label>
          <label className="auth-field">
            <span>Confirm password</span>
            <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="btn auth-submit" type="submit">
            Save and continue
          </button>
        </form>
      </div>
    </div>
  );
}
