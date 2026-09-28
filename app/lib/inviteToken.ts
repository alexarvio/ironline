import crypto from "crypto";

// The client an invite link is for, in the link (/invite?c=…), signed so a
// visitor can't change the number and read another client's and coach's
// names off the welcome screen. It opens nothing by itself: the Clerk ticket
// beside it is what signs the person in.

const sign = (payload: string) => crypto.createHmac("sha256", `${process.env.AUTH_SECRET ?? ""}:invite`).update(payload).digest("hex").slice(0, 32);

export function inviteToken(clientId: number): string {
  return `${clientId}.${sign(String(clientId))}`;
}

export function readInviteToken(token: string | undefined | null): number | null {
  const [id, mac] = (token ?? "").split(".");
  if (!id || !mac || !/^\d+$/.test(id)) return null;
  const want = sign(id);
  const a = Buffer.from(mac);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? Number(id) : null;
}
