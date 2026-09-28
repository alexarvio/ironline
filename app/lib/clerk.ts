import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { getData, persist } from "./db";

// Sign-in through Clerk (26 Sep): no passwords, an email code or Apple or
// Google. Clerk only answers "who is this"; our users table still says what
// they are (coach or client, which client, approved or not), so every
// guard in auth.ts reads the same as before.
//
// Off unless AUTH_PROVIDER=clerk and both keys are set, so the live app keeps
// its own sign-in until the switch is made on purpose.

export function clerkOn(): boolean {
  return process.env.AUTH_PROVIDER === "clerk" && !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

/** The Clerk account signed in on this request, with its verified emails. */
export async function clerkIdentity(): Promise<{ userId: string; emails: string[]; name: string | null } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  if (!user) return null;
  const emails = user.emailAddresses.filter((e) => e.verification?.status === "verified").map((e) => e.emailAddress.trim().toLowerCase());
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
  return { userId, emails, name };
}

/**
 * Our user row for whoever Clerk says is signed in. The first time a Clerk
 * account arrives, it is matched to our row by a verified email and the two
 * are linked, which is how every account from before the switch carries on
 * (they sign in once with an email code; no password moves across).
 */
export async function clerkUserRow() {
  const { userId } = await auth();
  if (!userId) return null;
  const data = getData();
  const linked = data.users.find((u) => u.clerk_user_id === userId);
  if (linked) return linked;
  const who = await clerkIdentity();
  if (!who) return null;
  const match = data.users.find((u) => !u.clerk_user_id && who.emails.includes(u.email));
  if (!match) return null;
  match.clerk_user_id = userId;
  persist();
  return match;
}

/** Ends the Clerk session on the server; the cookies go with the redirect that follows. */
export async function clerkSignOut() {
  const { sessionId } = await auth();
  if (!sessionId) return;
  try {
    await (await clerkClient()).sessions.revokeSession(sessionId);
  } catch (error) {
    console.error("[clerk] sign-out failed:", error instanceof Error ? error.message : error);
  }
}

/** Deletes the Clerk account behind one of ours (account deletion, a removed coach or client). */
export async function deleteClerkUser(clerkUserId: string | null | undefined) {
  if (!clerkUserId || !clerkOn()) return;
  try {
    await (await clerkClient()).users.deleteUser(clerkUserId);
  } catch (error) {
    console.error("[clerk] delete user failed:", error instanceof Error ? error.message : error);
  }
}

/** Emails a client their invite link (Clerk sends it). False when it didn't go. */
export async function sendClerkInvite(email: string, redirectUrl: string): Promise<boolean> {
  try {
    await (await clerkClient()).invitations.createInvitation({ emailAddress: email, redirectUrl, notify: true, ignoreExisting: true, expiresInDays: 30 });
    return true;
  } catch (error) {
    console.error("[clerk] invite failed:", error instanceof Error ? error.message : error);
    return false;
  }
}
