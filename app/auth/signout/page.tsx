import { redirect } from "next/navigation";
import { clerkOn } from "../../lib/clerk";
import { SignOutNow } from "../../login/ClerkFlows";

// Signing out through Clerk happens in the browser (it holds the session);
// every "Sign out" in the app lands here when Clerk is on.
export default async function SignOutPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  if (!clerkOn()) redirect("/login");
  const { deleted } = await searchParams;
  return <SignOutNow to={deleted ? "/login?deleted=1" : "/login"} />;
}
