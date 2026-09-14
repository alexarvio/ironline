"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLoginLocked, recordLoginFailure } from "./loginLockout";
import { recordLoginLock } from "./queries";
import {
  clearLoginLockouts,
  coachForClient,
  createUser,
  deleteCoachAccount,
  endSession,
  findUserByEmail,
  getSessionUser,
  getUserForClient,
  requireOwner,
  setPassword,
  startSession,
  verifyPassword,
} from "./auth";
import { getData } from "./db";
import { deleteUserForClient } from "./auth";

// Server actions for logging in and out, and for the coach handing a client
// their credentials. Kept separate from actions.ts so the auth surface is
// small enough to audit in one read.

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // Railway's proxy puts the caller's address first in x-forwarded-for.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Too many wrong tries: stop here, without checking the password at all.
  if (isLoginLocked(email, ip)) redirect("/login?error=locked");

  const user = findUserByEmail(email);

  // Same message and same work either way — revealing "no such account"
  // would let anyone enumerate which emails are clients here.
  if (!user || !verifyPassword(password, user.password_hash)) {
    // A lock that starts on this try is written down, so the coach and the
    // owner see it in the Feed.
    const locked = recordLoginFailure(email, ip);
    if (locked) recordLoginLock(email, ip, locked);
    redirect(isLoginLocked(email, ip) ? "/login?error=locked" : "/login?error=1");
  }

  // The right password: whatever was counted against this account goes.
  clearLoginLockouts(email);
  await startSession(user.id);

  if (user.must_change_password) redirect("/login/change-password");
  redirect(user.role === "coach" ? "/admin" : "/client");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) redirect("/login/change-password?error=short");
  if (password !== confirm) redirect("/login/change-password?error=match");

  setPassword(user.id, password, false);
  redirect(user.role === "coach" ? "/admin" : "/client");
}

// ---- Coach-side account management --------------------------------------

export async function createClientLoginAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) redirect("/admin");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!clientId || !email || password.length < 8) {
    redirect(`/admin?client=${clientId}&loginError=invalid`);
  }
  if (getUserForClient(clientId)) {
    redirect(`/admin?client=${clientId}&loginError=exists`);
  }

  try {
    createUser(email, password, "client", clientId, true);
  } catch {
    redirect(`/admin?client=${clientId}&loginError=taken`);
  }

  redirect(`/admin?client=${clientId}&loginOk=1`);
}

export async function resetClientPasswordAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) redirect("/admin");
  const password = String(formData.get("password") ?? "");

  const user = getUserForClient(clientId);
  if (!user || password.length < 8) {
    redirect(`/admin?client=${clientId}&loginError=invalid`);
  }

  // Forces the client through a password change on their next login, so a
  // password the coach has seen is never the one left in place.
  setPassword(user.id, password, true);
  redirect(`/admin?client=${clientId}&loginOk=reset`);
}

// ---- Owner: coach accounts -------------------------------------------------
// Only the owner (OWNER_EMAIL) reaches these; requireOwner sends anyone else
// back to their admin. A new coach starts with an empty client list, their own
// copy of the presets, and a temporary password they must change at sign-in.

const COACHES = "/admin?view=coaches";

export async function createCoachAction(formData: FormData) {
  await requireOwner();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) redirect(`${COACHES}&coachError=invalid`);
  try {
    createUser(email, password, "coach", null, true);
  } catch {
    redirect(`${COACHES}&coachError=taken`);
  }
  redirect(`${COACHES}&coachOk=added`);
}

export async function resetCoachPasswordAction(formData: FormData) {
  const owner = await requireOwner();
  const coachId = Number(formData.get("coachId"));
  const password = String(formData.get("password") ?? "");
  const coach = getData().users.find((u) => u.id === coachId && u.role === "coach");
  if (!coach || password.length < 8) redirect(`${COACHES}&coachError=invalid`);
  if (coach.id === owner.id) redirect(`${COACHES}&coachError=self`);
  // A password the owner has seen is never the one left in place.
  setPassword(coach.id, password, true);
  redirect(`${COACHES}&coachOk=reset`);
}

export async function removeCoachAction(formData: FormData) {
  const owner = await requireOwner();
  const coachId = Number(formData.get("coachId"));
  if (coachId === owner.id) redirect(`${COACHES}&coachError=self`);
  if (!deleteCoachAccount(coachId)) redirect(`${COACHES}&coachError=hasclients`);
  redirect(`${COACHES}&coachOk=removed`);
}

export async function removeClientLoginAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) redirect("/admin");
  deleteUserForClient(clientId);
  redirect(`/admin?client=${clientId}&loginOk=removed`);
}
