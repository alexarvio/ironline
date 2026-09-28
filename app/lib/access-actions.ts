"use server";

import { revalidatePath } from "next/cache";
import { coachForClient, createUser, findUserByEmail, getUserForClient, setPassword } from "./auth";
import { mailConfigured, sendInviteEmail } from "./mail";
import { appUrl } from "./passwordReset";
import { getClient, getClientProfile, getCoachProfile } from "./queries";

// A client's way into the app, from the coach's side in the redesign
// (Home → App access). New clients start with no login: the coach builds
// their plan, then gives access here. A password is stored scrambled, so it
// can't be shown again: when a client can't get in, the coach
// sets a new temporary one here, copies it or emails it, and the client
// chooses their own at the next sign-in.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ClientAccess = {
  /** The email they sign in with; null when they have no login. */
  email: string | null;
  /** Signed in and chose their own password. */
  signedUp: boolean;
  /** Invite emails can be sent (Resend is set up). */
  mailReady: boolean;
  /** Sign-in is by email code (Clerk): no password to hand over. */
  codes: boolean;
  /** The address on their card, to offer when there is no login yet. */
  cardEmail: string | null;
};

export async function clientAccessAction(clientId: number): Promise<ClientAccess | null> {
  if (!(await coachForClient(clientId))) return null;
  const user = getUserForClient(clientId);
  return {
    email: user?.email ?? null,
    signedUp: !!user && !user.must_change_password,
    mailReady: mailConfigured(),
    codes: process.env.AUTH_PROVIDER === "clerk",
    cardEmail: getClientProfile(clientId)?.email ?? null,
  };
}

/**
 * Gives the client a new temporary password, or a first login when they
 * have none. They are asked to choose their own at the next sign-in, so a
 * password the coach has seen is never the one left in place.
 */
export async function setClientTempPasswordAction(
  clientId: number,
  password: string,
  opts: { email?: string; send?: boolean } = {}
): Promise<{ ok: true; emailed: boolean } | { ok: false; error: string }> {
  const coach = await coachForClient(clientId);
  if (!coach) return { ok: false, error: "Not your client." };
  const client = getClient(clientId);
  if (!client) return { ok: false, error: "No such client." };
  password = String(password ?? "");
  if (password.length < 8) return { ok: false, error: "The password needs at least 8 characters." };

  let user = getUserForClient(clientId);
  if (user) {
    setPassword(user.id, password, true);
  } else {
    const email = String(opts.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false, error: "That email doesn't look right." };
    if (findUserByEmail(email)) return { ok: false, error: "That email already has an account." };
    try {
      createUser(email, password, "client", clientId, true);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "The login could not be made." };
    }
    user = getUserForClient(clientId)!;
  }
  revalidatePath("/admin");

  if (!opts.send || !mailConfigured()) return { ok: true, emailed: false };
  const base = appUrl();
  const emailed = !!base && (await sendInviteEmail({
    to: user.email,
    firstName: (client.name ?? "").split(" ")[0] || "there",
    coachName: getCoachProfile(coach.id)?.display_name || "Your coach",
    coachEmail: coach.email,
    password,
    signInUrl: `${base}/login`,
  }));
  return { ok: true, emailed };
}
