import { redirect } from "next/navigation";
import { clerkIdentity, clerkOn } from "../../lib/clerk";
import { getSessionUser } from "../../lib/auth";
import { NoAccountScreen } from "../../login/SignInScreens";

// Signed in to Clerk, but nobody here has that email: not invited by a coach,
// and not a coach. Says so, rather than a blank app.
export const dynamic = "force-dynamic";

export default async function NoAccountPage() {
  if (!clerkOn()) redirect("/login");
  if (await getSessionUser()) redirect("/auth/continue");
  const who = await clerkIdentity();
  if (!who) redirect("/login");
  return <NoAccountScreen email={who.emails[0] ?? "this account"} signOut={<a href="/auth/signout">Use a different email</a>} />;
}
