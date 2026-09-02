import crypto from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { allocId, getData, persist } from "./db";

// Authentication and authorization for Ironline.
//
// Two roles, and the distinction matters for every query in the app:
//   - "coach"  — Finlay. Full access to the CRM (/admin, /coach) and to every
//                client's data.
//   - "client" — one person, pinned to exactly one Client record via
//                user.client_id. They may only ever see and mutate that one
//                client's data.
//
// Deliberately dependency-free: scrypt and HMAC both come from node:crypto,
// which avoids a native module (bcrypt) that would break the "npm install
// works on any machine" property this project has kept from the start.
//
// SECURITY NOTE — the load-bearing rule of this file:
// Server Actions are public HTTP endpoints. Anyone who can reach the app can
// POST to any action with any form body they like. Guarding a *page* does not
// guard the actions that page renders. So every action must call one of the
// require* helpers below, and any action reachable by a client must take the
// client id from the returned session — NEVER from form data.

export type Role = "coach" | "client";

export type SessionUser = {
  id: number;
  email: string;
  role: Role;
  client_id: number | null;
  must_change_password: boolean;
};

const COOKIE_NAME = "ironline_session";
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    // Failing loudly here is deliberate. A weak or missing secret means
    // session tokens can be forged, which would let anyone mint a coach
    // session — strictly worse than the app refusing to boot.
    throw new Error("AUTH_SECRET is missing or too short (need >= 32 chars)");
  }
  return s;
}

// ---- Passwords ----------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, want] = stored.split(":");
  if (!salt || !want) return false;
  const got = crypto.scryptSync(password, salt, 64).toString("hex");
  // Constant-time compare so a timing signal can't be used to guess the hash.
  const a = Buffer.from(got, "hex");
  const b = Buffer.from(want, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Session token ------------------------------------------------------
//
// Stateless signed token: "<userId>.<expiryMs>.<hmac>". No session table, so
// nothing to clean up. The tradeoff is that a token can't be revoked before
// it expires — acceptable at this stage, and the reason the lifetime is 30
// days rather than a year. Changing a password rotates nothing today; if that
// matters later, add a per-user token version into the signed payload.

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function makeToken(userId: number): string {
  const expiry = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${userId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idStr, expiryStr, mac] = parts;
  const payload = `${idStr}.${expiryStr}`;

  const expected = sign(payload);
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  if (Number(expiryStr) < Date.now()) return null;
  const id = Number(idStr);
  return Number.isFinite(id) ? id : null;
}

export async function startSession(userId: number) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

// ---- Reading the current user -------------------------------------------

// cache() memoizes this for the duration of one render pass, so a page that
// calls requireClient() and then five queries doesn't re-read and re-verify
// the cookie six times.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const userId = readToken(token);
  if (userId == null) return null;

  // Re-read the user on every request rather than trusting the role baked
  // into the token: a role change or a deleted account then takes effect
  // immediately instead of lingering until the cookie expires.
  const user = getData().users.find((u) => u.id === userId);
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    client_id: user.client_id,
    must_change_password: user.must_change_password,
  };
});

// ---- Guards -------------------------------------------------------------

/** Coach-only. Use in /admin, /coach, and every coach-side server action. */
export async function requireCoach(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/client");
  if (user.must_change_password) redirect("/login/change-password");
  return user;
}

/**
 * Client-only. Returns the session with a non-null clientId — the single
 * client this user is allowed to touch. Callers must use the returned
 * clientId and ignore any client id present in form data.
 */
export async function requireClient(): Promise<SessionUser & { clientId: number }> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "client" || user.client_id == null) redirect("/admin");
  if (user.must_change_password) redirect("/login/change-password");
  return { ...user, clientId: user.client_id };
}

/**
 * Either role, but resolved to a specific client. Coaches pass the client id
 * they're acting on (they may act on anyone); clients get their own and the
 * requested id is ignored entirely. This is what actions shared between the
 * two sides (e.g. sending a chat message) should use.
 */
export async function requireClientAccess(requestedClientId: number): Promise<number> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/login/change-password");
  if (user.role === "coach") return requestedClientId;
  if (user.client_id == null) redirect("/login");
  return user.client_id;
}

/**
 * Assert the current session may act on this client. Coaches may act on
 * anyone; a client only on themselves. Returns false rather than throwing so
 * callers can quietly no-op — an action that silently does nothing gives a
 * prober less to work with than one that errors differently per case.
 */
export async function canAccessClient(clientId: number): Promise<boolean> {
  const user = await getSessionUser();
  if (!user || user.must_change_password) return false;
  if (user.role === "coach") return true;
  return user.client_id === clientId;
}

/**
 * Creates the first coach account from COACH_EMAIL / COACH_PASSWORD if the
 * store has no coach yet. This exists because a fresh deployment has no way
 * in: there is no signup, and running a one-off script against a container
 * needs shell access the deploy flow doesn't necessarily have.
 *
 * Idempotent, and does nothing once any coach exists — so rotating the env
 * vars later will NOT change an existing password (use the admin panel or
 * scripts/create-coach.ts for that). The bootstrap account is forced through
 * a password change on first login, so the value sitting in the environment
 * is never the password that ends up guarding the CRM.
 */
export function ensureCoachFromEnv() {
  const email = process.env.COACH_EMAIL?.trim().toLowerCase();
  const password = process.env.COACH_PASSWORD;
  if (!email || !password || password.length < 8) return;

  const data = getData();
  if (data.users.some((u) => u.role === "coach")) return;
  if (data.users.some((u) => u.email === email)) return;

  createUser(email, password, "coach", null, true);
}

/**
 * Lockout recovery without shell access. ensureCoachFromEnv only runs on an
 * empty store, so once the coach has changed their password the environment
 * variables are inert — and if that password is lost there is no reset email
 * to fall back on. Setting COACH_RESET_TOKEN to any value not seen before
 * makes the next login-page render set the COACH_EMAIL account's password to
 * COACH_PASSWORD (creating the coach account if that email has none), with a
 * forced password change on sign-in so the environment value is only ever a
 * temporary key. The token is recorded in the store so a variable left in
 * place doesn't keep re-resetting the account on every boot.
 */
export function resetCoachFromEnv() {
  const token = process.env.COACH_RESET_TOKEN?.trim();
  const email = process.env.COACH_EMAIL?.trim().toLowerCase();
  const password = process.env.COACH_PASSWORD;
  if (!token || !email || !password || password.length < 8) return;

  const data = getData();
  if (data.coach_reset_applied === token) return;

  const existing = data.users.find((u) => u.email === email);
  if (existing && existing.role !== "coach") return; // never hijack a client login
  if (existing) {
    setPassword(existing.id, password, true);
  } else {
    createUser(email, password, "coach", null, true);
  }
  data.coach_reset_applied = token;
  persist();
}

// ---- User records -------------------------------------------------------

export function findUserByEmail(email: string) {
  const target = email.trim().toLowerCase();
  return getData().users.find((u) => u.email === target) ?? null;
}

export function getUserForClient(clientId: number) {
  return getData().users.find((u) => u.role === "client" && u.client_id === clientId) ?? null;
}

export function createUser(
  email: string,
  password: string,
  role: Role,
  clientId: number | null,
  mustChangePassword: boolean
) {
  const data = getData();
  const normalized = email.trim().toLowerCase();
  if (data.users.some((u) => u.email === normalized)) {
    throw new Error("That email already has an account");
  }
  const user = {
    id: allocId("users"),
    email: normalized,
    password_hash: hashPassword(password),
    role,
    client_id: clientId,
    must_change_password: mustChangePassword,
    created_at: new Date().toISOString(),
  };
  data.users.push(user);
  persist();
  return user;
}

export function setPassword(userId: number, password: string, mustChange: boolean) {
  const data = getData();
  const user = data.users.find((u) => u.id === userId);
  if (!user) throw new Error("No such user");
  user.password_hash = hashPassword(password);
  user.must_change_password = mustChange;
  persist();
}

export function deleteUserForClient(clientId: number) {
  const data = getData();
  data.users = data.users.filter((u) => !(u.role === "client" && u.client_id === clientId));
  persist();
}
