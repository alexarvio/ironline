import { redirect } from "next/navigation";
import { getSessionUser } from "../../lib/auth";
import { ChangePasswordCard } from "../AuthCards";
import { clerkOn } from "../../lib/clerk";

// Shown once, after a coach hands out a temporary password. Every guard
// redirects here while must_change_password is set, so there's no way to
// reach the rest of the app on a password the coach has seen.
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // No passwords with Clerk.
  if (clerkOn()) redirect("/auth/continue");
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.must_change_password) {
    redirect(user.role === "coach" ? "/admin/redesign" : "/client");
  }

  const { error } = await searchParams;
  return <ChangePasswordCard error={error} />;
}
