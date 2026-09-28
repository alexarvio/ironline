import { redirect } from "next/navigation";
import { clerkOn } from "../lib/clerk";
import { getSessionUser } from "../lib/auth";
import { CoachSignUpFlow } from "../login/ClerkFlows";

// A coach makes their own account (sign-in through Clerk only). They wait
// for the owner's approval before the coach side opens (/auth/waiting).
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (!clerkOn()) redirect("/login");
  const user = await getSessionUser();
  if (user) redirect("/auth/continue");
  return <CoachSignUpFlow />;
}
