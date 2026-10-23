import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { allocId, DATA_DIR, getData, persist, type SupportMessage } from "./db";
import { isOwner, ownerEmail, type SessionUser } from "./auth";
import { getCoachProfileView } from "./queries";
import { dayMonth, logDate } from "./dayMonth";

// Support (23 Oct, Alex: "where the coaches can go in and talk to someone from the company or report an issue"): one
// thread a coach with the company, which lands with the owner. A coach writes from Settings' Support (a message, or a
// problem with where it happened and a screenshot); the owner answers from the Support inbox on Coaches and closes a
// problem with Done. A coach only ever sees their own thread; the owner has none of their own. The rows live in
// `support_messages` (db.ts, kept in kv on Postgres); a screenshot under uploads/support/<coachId>/ and, with the
// bucket on, in the bucket (putUpload), served by /api/support/<id> to that coach and the owner alone.

/** One line of a thread, as the viewer sees it: `mine` is the viewer's own side. */
export type SupportLine = {
  id: number;
  mine: boolean;
  kind: "message" | "problem";
  text: string;
  where: string | null;
  /** The screenshot, "/api/support/<id>" (add ?w=480 for the thumbnail). */
  image: string | null;
  /** The day's heading: Today, Yesterday, else `Tue, 21 Oct`. */
  day: string;
  /** 14:05 */
  time: string;
  /** A problem the owner closed. */
  done: boolean;
  /** From the other side, not yet seen by the viewer. */
  unread: boolean;
};

/** A coach's thread, a row of the owner's inbox. */
export type SupportInboxRow = {
  coachId: number;
  name: string;
  avatarPath: string | null;
  /** The last line's words. */
  last: string;
  lastFrom: "coach" | "owner";
  /** The time today, else 9/11. */
  when: string;
  at: string;
  /** The coach's lines the owner hasn't seen. */
  unread: number;
  /** Problems not yet closed. */
  problems: number;
};

/** What Settings' Support part needs (SupportSection): the coach's thread. The owner has none (loadSupportSection). */
export type SupportSectionData = { thread: SupportLine[] };

/** A screenshot's ceiling, a chat photo's (20 MB). */
export const SUPPORT_IMAGE_BYTES = 20 * 1024 * 1024;
// No HEIC: most browsers can't draw it and it gets no small copy (storage.ts); an iPhone hands over a JPEG instead.
export const SUPPORT_IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
/** A type a screenshot may be: an own key only, never one off the prototype ("__proto__", "constructor"). */
export const isSupportImageType = (type: string) => Object.hasOwn(SUPPORT_IMAGE_TYPES, type);
const MAX_TEXT = 4000;
const MAX_WHERE = 200;

const rows = (): SupportMessage[] => {
  const data = getData();
  if (!data.support_messages) data.support_messages = [];
  return data.support_messages;
};

/** The owner's own account id (OWNER_EMAIL), or null when none is set. */
function ownerId(): number | null {
  const email = ownerEmail();
  return email ? (getData().users.find((u) => u.role === "coach" && u.email === email)?.id ?? null) : null;
}

/** A coach account that can hold a thread: a coach, let in, not the owner. */
export function isSupportCoach(coachId: number): boolean {
  const u = getData().users.find((x) => x.id === coachId && x.role === "coach");
  return !!u && !u.pending && u.id !== ownerId();
}

// ---- Reading -------------------------------------------------------------------------------------------------------

/** A coach's thread, oldest first. */
export function listSupportThread(coachId: number): SupportMessage[] {
  return rows()
    .filter((m) => m.coach_id === coachId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
}

/** Every coach's thread for the owner, the newest word first: coaches still on the app, never the owner's own. */
export function listSupportThreads(): SupportInboxRow[] {
  const by = new Map<number, SupportMessage[]>();
  for (const m of rows()) {
    const list = by.get(m.coach_id) ?? [];
    list.push(m);
    by.set(m.coach_id, list);
  }
  const now = new Date();
  const out: SupportInboxRow[] = [];
  for (const [coachId, list] of by) {
    if (!isSupportCoach(coachId)) continue;
    const last = list.reduce((a, b) => (b.created_at > a.created_at || (b.created_at === a.created_at && b.id > a.id) ? b : a));
    const profile = getCoachProfileView(coachId);
    const at = new Date(last.created_at);
    out.push({
      coachId,
      name: profile?.displayName ?? getData().users.find((u) => u.id === coachId)?.email ?? "Coach",
      avatarPath: profile?.avatarPath ?? null,
      last: last.text,
      lastFrom: last.from,
      when: at.toDateString() === now.toDateString() ? clock(at) : dayMonth(at),
      at: last.created_at,
      unread: list.filter((m) => m.from === "coach" && !m.seen_by_owner).length,
      problems: list.filter((m) => m.kind === "problem" && !m.done).length,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

const clock = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function dayHeading(d: Date, now: Date): string {
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return logDate(d);
}

/** A thread as one side sees it. */
export function supportThreadView(coachId: number, viewer: "coach" | "owner"): SupportLine[] {
  const now = new Date();
  return listSupportThread(coachId).map((m) => {
    const at = new Date(m.created_at);
    return {
      id: m.id,
      mine: m.from === viewer,
      kind: m.kind,
      text: m.text,
      where: m.kind === "problem" ? (m.where?.trim() || null) : null,
      image: m.image_path ? `/api/support/${m.id}` : null,
      day: dayHeading(at, now),
      time: clock(at),
      done: m.kind === "problem" && !!m.done,
      unread: m.from !== viewer && !(viewer === "owner" ? m.seen_by_owner : m.seen_by_coach),
    };
  });
}

/** The owner's lines a coach hasn't seen (the rail's count, later). */
export function supportUnreadForCoach(coachId: number): number {
  return rows().filter((m) => m.coach_id === coachId && m.from === "owner" && !m.seen_by_coach).length;
}

/** The coaches' lines the owner hasn't seen, every thread together (the rail's count, later). */
export function supportUnreadForOwner(): number {
  return rows().filter((m) => m.from === "coach" && !m.seen_by_owner && isSupportCoach(m.coach_id)).length;
}

/** Problems the owner hasn't closed, every thread together. */
export function supportOpenProblems(): number {
  return rows().filter((m) => m.kind === "problem" && !m.done && isSupportCoach(m.coach_id)).length;
}

/** Settings' Support part, for the signed-in coach: their thread. Null for the owner, who answers from Coaches and
    has no Support section. */
export function loadSupportSection(coach: SessionUser): SupportSectionData | null {
  if (isOwner(coach)) return null;
  return { thread: supportThreadView(coach.id, "coach") };
}

// ---- Writing -------------------------------------------------------------------------------------------------------

/** Adds a line to a coach's thread; the side that wrote it has seen it. */
export function addSupportMessage(input: { coachId: number; from: "coach" | "owner"; kind: "message" | "problem"; text: string; where?: string | null; imagePath?: string | null }): SupportMessage {
  const problem = input.kind === "problem" && input.from === "coach";
  const m: SupportMessage = {
    id: allocId("support_messages"),
    coach_id: input.coachId,
    from: input.from,
    kind: problem ? "problem" : "message",
    text: input.text.trim().slice(0, MAX_TEXT),
    where: problem ? input.where?.trim().slice(0, MAX_WHERE) || null : null,
    image_path: problem ? input.imagePath ?? null : null,
    created_at: new Date().toISOString(),
    seen_by_owner: input.from === "owner",
    seen_by_coach: input.from === "coach",
    done: problem ? false : undefined,
  };
  rows().push(m);
  persist();
  return m;
}

/** Marks the other side's lines in a coach's thread seen by `by`. Returns how many changed. */
export function markSupportSeen(coachId: number, by: "coach" | "owner"): number {
  let n = 0;
  for (const m of rows()) {
    if (m.coach_id !== coachId || m.from === by) continue;
    if (by === "owner" && !m.seen_by_owner) {
      m.seen_by_owner = true;
      n += 1;
    } else if (by === "coach" && !m.seen_by_coach) {
      m.seen_by_coach = true;
      n += 1;
    }
  }
  if (n) persist();
  return n;
}

/** The owner closes a problem. Returns it, or null when there is no such open problem. */
export function markSupportProblemDone(id: number): SupportMessage | null {
  const m = rows().find((x) => x.id === id && x.kind === "problem");
  if (!m) return null;
  if (!m.done) {
    m.done = true;
    m.done_at = new Date().toISOString();
    // Closing it is reading it.
    m.seen_by_owner = true;
    persist();
  }
  return m;
}

/** A support line by id (the screenshot route). */
export function getSupportMessage(id: number): SupportMessage | null {
  return rows().find((m) => m.id === id) ?? null;
}

/** Writes a screenshot to the disk, as the app's other uploads are; returns its stored path. The caller copies it to
    the bucket (putUpload). */
export function saveSupportImage(coachId: number, buffer: Buffer, mimeType: string): string {
  const ext = isSupportImageType(mimeType) ? SUPPORT_IMAGE_TYPES[mimeType] : "png";
  const dir = path.join(DATA_DIR, "uploads", "support", String(coachId));
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/support/${coachId}/${filename}`;
}
