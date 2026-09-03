import Image from "next/image";
import { redirect } from "next/navigation";
import { loginAction } from "../lib/auth-actions";
import { ensureCoachFromEnv, getSessionUser, resetCoachFromEnv } from "../lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // A fresh deployment has no accounts and no signup, so the very first
  // request to the login page is where the bootstrap coach gets created
  // from the environment. No-op once any coach exists.
  ensureCoachFromEnv();
  // Lockout recovery: fires once per new COACH_RESET_TOKEN value, see auth.ts.
  resetCoachFromEnv();

  // Already signed in? Send them where they belong rather than showing a
  // login form they'd have no reason to fill in.
  const user = await getSessionUser();
  if (user && !user.must_change_password) {
    redirect(user.role === "coach" ? "/admin" : "/client");
  }

  const { error } = await searchParams;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Image src="/brand/logo.png" alt="" width={19} height={32} priority />
          Ironline
        </div>
        <h1 className="auth-title">Sign in</h1>

        {error && <p className="auth-error">Wrong email or password.</p>}

        <form action={loginAction} className="auth-form">
          <label className="auth-field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn auth-submit" type="submit">
            Sign in
          </button>
        </form>

        <p className="auth-note">
          Don&rsquo;t have an account? Your coach creates it for you.
        </p>
      </div>
    </div>
  );
}
