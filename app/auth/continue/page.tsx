import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clerkIdentity, clerkOn } from "../../lib/clerk";
import { findUserByEmail, getSessionUser } from "../../lib/auth";

// Every sign-in through Clerk ends here: our own account for this person,
// and where it lives. Someone who came through the coach sign-up and has no
// account yet gets a coach account that waits for the owner's approval.
export const dynamic = "force-dynamic";

export default async function ContinuePage() {
  if (!clerkOn()) redirect("/login");
  const user = await getSessionUser();
  if (user) redirect(user.role === "client" ? "/client" : user.pending ? "/auth/waiting" : "/admin/redesign");

  const who = await clerkIdentity();
  if (!who) redirect("/login");
  const jar = await cookies();
  type Intent = { coach?: boolean };
  let intent: Intent | null;
  try {
    intent = JSON.parse(decodeURIComponent(jar.get("ironline_intent")?.value ?? "")) as Intent;
  } catch {
    intent = null;
  }
  const email = who.emails[0];
  // A coach sign-up: who they are, next.
  if (intent?.coach && email && !findUserByEmail(email)) redirect("/auth/coach-details");
  redirect("/auth/no-account");
}
