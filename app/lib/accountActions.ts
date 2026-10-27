"use server";

import { revalidatePath } from "next/cache";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { requireCoach } from "./auth";
import { clerkOn } from "./clerk";

// Settings, Account & security (27 Oct, Alex): sign a device out, sign out everywhere else, and take a linked login
// (Google) off the account. Each acts on the signed-in person's own Clerk account only, and at once (no Save): the
// email stays a way in, so taking Google off never locks anyone out.

type Done = { ok: boolean; error?: string };

async function who() {
  await requireCoach();
  if (!clerkOn()) return null;
  const { userId, sessionId } = await auth();
  return userId ? { userId, sessionId } : null;
}

/** One device signed out (never this one: Sign out on the page does that). */
export async function signOutDeviceAction(id: string): Promise<Done> {
  const me = await who();
  if (!me) return { ok: false, error: "Signed out. Sign in again." };
  if (id === me.sessionId) return { ok: false, error: "That's this device." };
  try {
    const clerk = await clerkClient();
    const s = await clerk.sessions.getSession(id);
    if (s.userId !== me.userId) return { ok: false, error: "Not your device." };
    await clerk.sessions.revokeSession(id);
  } catch {
    return { ok: false, error: "Couldn't sign it out. Try again." };
  }
  revalidatePath("/admin/redesign/settings");
  return { ok: true };
}

/** Every other device signed out; this one stays. */
export async function signOutOtherDevicesAction(): Promise<Done> {
  const me = await who();
  if (!me) return { ok: false, error: "Signed out. Sign in again." };
  try {
    const clerk = await clerkClient();
    const list = await clerk.sessions.getSessionList({ userId: me.userId, status: "active", limit: 50 });
    await Promise.all(list.data.filter((s) => s.id !== me.sessionId).map((s) => clerk.sessions.revokeSession(s.id)));
  } catch {
    return { ok: false, error: "Couldn't sign them out. Try again." };
  }
  revalidatePath("/admin/redesign/settings");
  return { ok: true };
}

/** A linked login (Google) taken off the account. */
export async function disconnectLoginAction(externalAccountId: string): Promise<Done> {
  const me = await who();
  if (!me) return { ok: false, error: "Signed out. Sign in again." };
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(me.userId);
    if (!user.externalAccounts.some((a) => a.id === externalAccountId)) return { ok: false, error: "Not on your account." };
    await clerk.users.deleteUserExternalAccount({ userId: me.userId, externalAccountId });
  } catch {
    return { ok: false, error: "Couldn't disconnect it. Try again." };
  }
  revalidatePath("/admin/redesign/settings");
  return { ok: true };
}
