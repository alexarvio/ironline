// Sign-in lockout, so a password can't be guessed by trying it over and over.
//
// Two counts, both over a rolling 15 minutes:
// - one device (IP) on one account: 3 wrong tries lock that device out of
//   that account for 15 minutes. Tight, and it can't be used to lock the real
//   person out from their own device.
// - one account from anywhere: 10 wrong tries lock the account everywhere for
//   15 minutes, so spreading guesses across many addresses doesn't get round
//   the first count.
// An email with no account counts the same as a real one, so the lockout
// never reveals which emails exist. A correct sign-in clears both counts.
//
// Kept in the server's memory: one Railway instance serves the app, and a
// restart clearing the counts is harmless.

export const MAX_TRIES_PER_DEVICE = 3;
export const MAX_TRIES_PER_ACCOUNT = 10;
export const LOCK_MS = 15 * 60 * 1000;

type Entry = { fails: number[]; lockedUntil: number };

const g = globalThis as unknown as { _loginLockout?: Map<string, Entry> };
const store = (g._loginLockout ??= new Map<string, Entry>());

export type LockScope = "device" | "account";

const keysFor = (email: string, ip: string): { key: string; limit: number; scope: LockScope }[] => {
  const account = email.trim().toLowerCase();
  return [
    { key: `device:${account}|${ip}`, limit: MAX_TRIES_PER_DEVICE, scope: "device" },
    { key: `account:${account}`, limit: MAX_TRIES_PER_ACCOUNT, scope: "account" },
  ];
};

/** Whether sign-in for this email from this IP is locked right now. */
export function isLoginLocked(email: string, ip: string, now = Date.now()): boolean {
  return keysFor(email, ip).some(({ key }) => (store.get(key)?.lockedUntil ?? 0) > now);
}

/**
 * A wrong email or password: counts toward both locks. Returns the lock this
 * try started ("account" when both did), or null when it started none.
 */
export function recordLoginFailure(email: string, ip: string, now = Date.now()): LockScope | null {
  let started: LockScope | null = null;
  for (const { key, limit, scope } of keysFor(email, ip)) {
    const entry = store.get(key) ?? { fails: [], lockedUntil: 0 };
    entry.fails = entry.fails.filter((t) => now - t < LOCK_MS);
    entry.fails.push(now);
    if (entry.fails.length >= limit) {
      entry.lockedUntil = now + LOCK_MS;
      entry.fails = [];
      started = scope;
    }
    store.set(key, entry);
  }
  // Forget counts nobody is using any more, so the map doesn't grow forever.
  if (store.size > 2000) {
    for (const [key, entry] of store) {
      if (entry.lockedUntil <= now && entry.fails.every((t) => now - t >= LOCK_MS)) store.delete(key);
    }
  }
  return started;
}

/** Every count and lock on this email, from any device: its password was reset. */
export function clearLockoutsFor(email: string) {
  const account = email.trim().toLowerCase();
  for (const key of [...store.keys()]) {
    if (key === `account:${account}` || key.startsWith(`device:${account}|`)) store.delete(key);
  }
}

/** A correct sign-in: the person knows the password, so both counts reset. */
export function clearLoginFailures(email: string, ip: string) {
  for (const { key } of keysFor(email, ip)) store.delete(key);
}
