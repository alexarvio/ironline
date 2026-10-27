import { auth, clerkClient } from "@clerk/nextjs/server";
import { clerkOn } from "./clerk";

// Settings, Account & security with the sign-in through Clerk (27 Oct, Alex: "only email, and that's it"): the logins
// linked to the account (Google, later Apple) and the devices it is signed in on, each read from Clerk when the page
// is drawn. Nothing kept on our side. Null while Clerk is off or not reachable, and the section shows the email alone.

export type LinkedLogin = { id: string; provider: string; email: string };
export type SignedInDevice = { id: string; current: boolean; device: string; browser: string; place: string; lastActive: number };
export type AccountSecurity = { logins: LinkedLogin[]; devices: SignedInDevice[] };

/** "oauth_google" → "google". */
const providerOf = (p: string) => p.replace(/^oauth_/, "");

export async function loadAccountSecurity(): Promise<AccountSecurity | null> {
  if (!clerkOn()) return null;
  try {
    const { userId, sessionId } = await auth();
    if (!userId) return null;
    const clerk = await clerkClient();
    const [user, sessions] = await Promise.all([clerk.users.getUser(userId), clerk.sessions.getSessionList({ userId, status: "active", limit: 50 })]);
    const logins = user.externalAccounts.map((a) => ({ id: a.id, provider: providerOf(a.provider), email: a.emailAddress }));
    const devices = sessions.data
      .map((s) => {
        const a = s.latestActivity;
        const device = a?.deviceType || (a?.isMobile ? "Phone" : "Computer");
        const place = [a?.city, a?.country].filter(Boolean).join(", ");
        return { id: s.id, current: s.id === sessionId, device, browser: a?.browserName ?? "", place, lastActive: s.lastActiveAt };
      })
      // This device first, then the most recent.
      .sort((x, y) => Number(y.current) - Number(x.current) || y.lastActive - x.lastActive);
    return { logins, devices };
  } catch (error) {
    console.error("[account] could not read sign-in from Clerk:", error instanceof Error ? error.message : error);
    return null;
  }
}
