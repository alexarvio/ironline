import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clerkIdentity, clerkOn } from "../../lib/clerk";
import { findUserByEmail, getSessionUser } from "../../lib/auth";

// Every sign-in through Clerk ends here: our own account for this person,
// and where it lives. Someone who came through the coach sign-up and has no
// account yet gets a coach account that waits for the owner's approval.
export const dynamic = "force-dynamic";

// The page they were sent to sign in from (?next=, proxy.ts), when it fits the account (26 Oct, Alex: the coach phone
// app, /coach, signed in to the admin): a coach back to the phone app or an admin screen, a client to their app. A
// path on this site only, never another address.
function backTo(next: string | undefined, role: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  const path = next.split(/[?#]/)[0];
  const fits = role === "client" ? path === "/client" || path.startsWith("/client/") : path === "/coach" || path.startsWith("/coach/") || path.startsWith("/admin");
  return fits ? next : null;
}

export default async function ContinuePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!clerkOn()) redirect("/login");
  const { next } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(user.pending ? "/auth/waiting" : (backTo(next, user.role) ?? (user.role === "client" ? "/client" : "/admin/redesign")));

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
