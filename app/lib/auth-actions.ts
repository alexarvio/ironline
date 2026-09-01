"use server";

import { redirect } from "next/navigation";
import {
  createUser,
  endSession,
  findUserByEmail,
  getSessionUser,
  getUserForClient,
  requireCoach,
  setPassword,
  startSession,
  verifyPassword,
} from "./auth";
import { deleteUserForClient } from "./auth";

// Server actions for logging in and out, and for the coach handing a client
// their credentials. Kept separate from actions.ts so the auth surface is
// small enough to audit in one read.

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const user = findUserByEmail(email);

  // Same message and same work either way — revealing "no such account"
  // would let anyone enumerate which emails are clients here.
  if (!user || !verifyPassword(password, user.password_hash)) {
    redirect("/login?error=1");
  }

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
  await requireCoach();

  const clientId = Number(formData.get("clientId"));
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
  await requireCoach();

  const clientId = Number(formData.get("clientId"));
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

export async function removeClientLoginAction(formData: FormData) {
  await requireCoach();

  const clientId = Number(formData.get("clientId"));
  deleteUserForClient(clientId);
  redirect(`/admin?client=${clientId}&loginOk=removed`);
}
