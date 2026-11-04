// Who is in the app right now (9 Oct): every signed-in request touches a
// row in memory, the pages say where they are, and /admin/presence lists
// them. Memory only: one server, and a restart (a deploy) clears it, which
// is the moment it is for anyway. Nothing here is stored.

import type { SessionUser } from "./auth";
import { chatChanged } from "./chatBus";
import { getData, persist } from "./db";
import { getClient } from "./queries";

type Entry = { key: string; role: "coach" | "client"; id: number; lastSeen: number; where: string | null };
const entries = new Map<string, Entry>();
const KEEP_MS = 24 * 60 * 60 * 1000;

/** A request from this user: now, and where they are when the page says. */
export function touchPresence(user: Pick<SessionUser, "id" | "role" | "client_id"> | null | undefined, where?: string | null) {
  if (!user) return;
  const role: "coach" | "client" = user.role === "coach" ? "coach" : "client";
  const id = role === "client" ? (user.client_id ?? user.id) : user.id;
  const key = `${role}:${id}`;
  const was = entries.get(key);
  entries.set(key, { key, role, id, lastSeen: Date.now(), where: where ?? was?.where ?? null });
  // Old rows go, so the map never grows past a day of visitors.
  if (entries.size > 500) for (const [k, e] of entries) if (Date.now() - e.lastSeen > KEEP_MS) entries.delete(k);
  // The client's own use alone (4 Nov, Alex): a client account, never a coach previewing their app (?phone=1, or the
  // coach's own login on /client: both are the coach's role, so they never reach here).
  if (user.role === "client" && user.client_id != null) noteClientActive(user.client_id);
}

// ---- Last active (4 Nov, Alex: "so the coach knows whether the client is using the app") --------------------------
// Kept on the client's row (last_active_at), so it outlives a deploy. Written at most once every 5 minutes a client:
// the time held in memory says when it was last written, and the stored one covers the first request after a restart.
const ACTIVE_EVERY_MS = 5 * 60 * 1000;
// On globalThis, as chatBus.ts: server actions and route handlers can load this module twice, and both must share them.
const g = globalThis as unknown as { __norcoachActive?: { written: Map<number, number>; seen: Map<number, number> } };
const active = (g.__norcoachActive ??= { written: new Map(), seen: new Map() });
const activeWritten = active.written;
// Their latest request, between writes (memory only, as the rest of this file).
const activeSeen = active.seen;

function noteClientActive(clientId: number) {
  const now = Date.now();
  activeSeen.set(clientId, now);
  if (now - (activeWritten.get(clientId) ?? 0) < ACTIVE_EVERY_MS) return;
  activeWritten.set(clientId, now);
  const client = getData().clients.find((c) => c.id === clientId);
  if (!client) return;
  const stored = client.last_active_at ? Date.parse(client.last_active_at) : NaN;
  if (Number.isFinite(stored) && now - stored < ACTIVE_EVERY_MS) return;
  client.last_active_at = new Date(now).toISOString();
  persist();
  // An open chat with them reads itself again, so the coach sees "Active now" as they come in (chatBus.ts).
  chatChanged(clientId);
}

/** When the client was last in the app (ISO), or null when never since this was kept: the later of the stored time and
 *  this server's own memory of their last request, so a client in the app now reads "Active now" between writes. */
export function clientLastActive(clientId: number): string | null {
  const stored = getData().clients.find((c) => c.id === clientId)?.last_active_at ?? null;
  const seen = activeSeen.get(clientId) ?? 0;
  const storedMs = stored ? Date.parse(stored) : 0;
  if (seen > (Number.isFinite(storedMs) ? storedMs : 0)) return new Date(seen).toISOString();
  return stored;
}

export type PresenceRow = { key: string; role: "coach" | "client"; name: string; where: string | null; lastSeen: number; secondsAgo: number };

/** Everyone seen in the last day, most recent first, named. */
export function listPresence(): PresenceRow[] {
  const now = Date.now();
  const data = getData();
  const out: PresenceRow[] = [];
  for (const e of entries.values()) {
    if (now - e.lastSeen > KEEP_MS) continue;
    let name = "";
    if (e.role === "client") name = getClient(e.id)?.name ?? `Client ${e.id}`;
    else {
      // The coach as the profile names them, else the email's first word, as the client app does.
      const set = data.coach_profiles.find((pr) => pr.coach_id === e.id)?.display_name?.trim();
      const email = data.users.find((u) => u.id === e.id)?.email ?? "";
      const word = (email.split("@")[0] ?? "").split(/[._-]+/).filter(Boolean)[0] ?? "";
      name = set || (word ? word.charAt(0).toUpperCase() + word.slice(1) : `Coach ${e.id}`);
    }
    out.push({ key: e.key, role: e.role, name, where: e.where, lastSeen: e.lastSeen, secondsAgo: Math.round((now - e.lastSeen) / 1000) });
  }
  return out.sort((a, b) => b.lastSeen - a.lastSeen);
}
