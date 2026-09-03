import Image from "next/image";
import { redirect } from "next/navigation";
import { loginAction } from "../lib/auth-actions";
import { ensureCoachFromEnv, getSessionUser, resetCoachFromEnv, resetWorkspaceFromEnv } from "../lib/auth";
import { getBranding } from "../lib/queries";

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
  // Blank-canvas wipe: fires once per new WORKSPACE_RESET_TOKEN value, see auth.ts.
  resetWorkspaceFromEnv();

  // Already signed in? Send them where they belong rather than showing a
  // login form they'd have no reason to fill in.
  const user = await getSessionUser();
  if (user && !user.must_change_password) {
    redirect(user.role === "coach" ? "/admin" : "/client");
  }

  const { error } = await searchParams;

  const branding = getBranding();

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          {branding.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element -- coach-uploaded file
            <img src={branding.logo_path} alt="" className="auth-brand-logo" />
          ) : (
            <Image src="/brand/logo.png" alt="" width={19} height={32} priority />
          )}
          {branding.coach_name || "Ironline"}
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
