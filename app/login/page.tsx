import { redirect } from "next/navigation";
import { resetsAvailable } from "../lib/passwordReset";
import { ensureCoachFromEnv, ensureOwnerFromEnv, getSessionUser, resetCoachFromEnv, resetWorkspaceFromEnv } from "../lib/auth";
import { LoginCard } from "./AuthCards";
import { clerkOn } from "../lib/clerk";
import { SignInFlow } from "./ClerkFlows";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string; reset?: string }>;
}) {
  // A fresh deployment has no accounts and no signup, so the very first
  // request to the login page is where the bootstrap coach gets created
  // from the environment. No-op once any coach exists.
  ensureCoachFromEnv();
  // The owner's login, from OWNER_EMAIL / OWNER_PASSWORD, once; see auth.ts.
  ensureOwnerFromEnv();
  // Lockout recovery: fires once per new COACH_RESET_TOKEN value, see auth.ts.
  resetCoachFromEnv();
  // Blank-canvas wipe: fires once per new WORKSPACE_RESET_TOKEN value, see auth.ts.
  resetWorkspaceFromEnv();

  // Already signed in? Send them where they belong rather than showing a
  // login form they'd have no reason to fill in.
  const user = await getSessionUser();
  if (user && !user.must_change_password) {
    redirect(user.role === "coach" ? "/admin/redesign" : "/client");
  }

  const { error, deleted, reset } = await searchParams;
  // Sign-in through Clerk: no passwords (lib/clerk.ts).
  if (clerkOn()) return <SignInFlow notice={deleted ? "Your account and everything in it has been deleted." : null} />;
  return <LoginCard error={error} deleted={deleted} reset={reset} canReset={resetsAvailable()} />;
}
