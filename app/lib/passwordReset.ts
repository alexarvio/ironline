import crypto from "crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { findUserByEmail, setPassword } from "./auth";
import { getData } from "./db";
import { mailConfigured, sendPasswordResetEmail } from "./mail";
import { pg } from "./pg/direct";
import { password_resets } from "./pg/schema";

// "Forgot password": an emailed link that lets someone choose a new password.
//
// The link carries a random token; only its SHA-256 is stored (password_resets
// in Postgres), so the table alone can't open anyone's account. A link works
// once, for an hour, and asking again or using one closes the others.
// Whether an email has an account is never revealed: the page says "if that
// email has an account, a link is on its way" either way.
//
// Needs email (RESEND_API_KEY + MAIL_FROM, see mail.ts) and Postgres; without
// either, resetsAvailable() is false and the login page doesn't offer it.

const LINK_MINUTES = 60;
// Per account per hour, so the form can't be used to flood someone's inbox.
const MAX_PER_HOUR = 3;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export function resetsAvailable(): boolean {
  return mailConfigured();
}

// Where links point. Never the request's Host header: that is the asker's to
// choose, and a link to their own domain would hand them the token.
function appUrl(): string | null {
  const set = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (set) return set;
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;
  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : null;
}

/** Emails a reset link if the email has an account. Silent either way. */
export async function requestPasswordReset(email: string): Promise<void> {
  const base = appUrl();
  const db = await pg();
  if (!resetsAvailable() || !base || !db) return;
  const user = findUserByEmail(email);
  if (!user) return;

  const recent = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(password_resets)
    .where(and(eq(password_resets.user_id, user.id), gt(password_resets.created_at, sql`now() - interval '1 hour'`)));
  if ((recent[0]?.n ?? 0) >= MAX_PER_HOUR) return;

  const token = crypto.randomBytes(32).toString("base64url");
  // A new link closes any still-open older one.
  await db.update(password_resets).set({ used_at: sql`now()` }).where(and(eq(password_resets.user_id, user.id), isNull(password_resets.used_at)));
  await db.insert(password_resets).values({
    user_id: user.id,
    token_hash: hash(token),
    expires_at: new Date(Date.now() + LINK_MINUTES * 60_000),
  });
  await sendPasswordResetEmail({ to: user.email, resetUrl: `${base}/login/reset?token=${encodeURIComponent(token)}` });
}

/** The open reset a token belongs to, or null if it's unknown, used or expired. */
async function openReset(token: string) {
  const db = await pg();
  if (!db || !token) return null;
  const rows = await db
    .select()
    .from(password_resets)
    .where(and(eq(password_resets.token_hash, hash(token)), isNull(password_resets.used_at), gt(password_resets.expires_at, sql`now()`)));
  return rows[0] ?? null;
}

export async function resetTokenValid(token: string): Promise<boolean> {
  return (await openReset(token)) != null;
}

/** Sets the new password if the token is still good; false if it isn't. */
export async function completePasswordReset(token: string, password: string): Promise<boolean> {
  const db = await pg();
  const reset = await openReset(token);
  if (!db || !reset) return false;
  // Claim the link first, so two tabs racing can't both use it.
  const claimed = await db
    .update(password_resets)
    .set({ used_at: sql`now()` })
    .where(and(eq(password_resets.id, reset.id), isNull(password_resets.used_at)))
    .returning({ id: password_resets.id });
  if (claimed.length === 0) return false;
  const user = getData().users.find((u) => u.id === reset.user_id);
  if (!user) return false;
  // Also ends any sign-in lock on the account.
  setPassword(user.id, password, false);
  return true;
}
