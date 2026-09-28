import { redirect } from "next/navigation";
import { clerkIdentity, clerkOn } from "../../lib/clerk";
import { getSessionUser } from "../../lib/auth";
import { finishCoachSignUpAction } from "../../lib/auth-actions";
import { CoachDetailsScreen } from "../../login/SignInScreens";

// "About you": right after a coach signs up, before they wait for approval.
export const dynamic = "force-dynamic";

export default async function CoachDetailsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!clerkOn()) redirect("/login");
  if (await getSessionUser()) redirect("/auth/continue");
  const who = await clerkIdentity();
  if (!who?.emails[0]) redirect("/login");
  const { error } = await searchParams;
  return <CoachDetailsScreen action={finishCoachSignUpAction} name={who.name ?? ""} email={who.emails[0]} error={error === "name" ? "Add your name to carry on." : null} />;
}
