// Who is in the app right now (9 Oct): every signed-in request touches a
// row in memory, the pages say where they are, and /admin/presence lists
// them. Memory only: one server, and a restart (a deploy) clears it, which
// is the moment it is for anyway. Nothing here is stored.

import type { SessionUser } from "./auth";
import { getData } from "./db";
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
