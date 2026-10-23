// The Feed's data (feedBoard.ts has the shape and what each part means): one read of the store for the coach's Feed,
// every client at once, and the note of when the coach looked, so "Since 20/10" and the New rows count from the visit
// before this one. Never throws: a coach with no clients, no logs and no calls gets nulls, zeros and empty lists.

import type { ActivityKind, ActivityRow, FeedBoard, NeedRow } from "./feedBoard";
import { getData, persist, type Data } from "./db";
import {
  activityWords,
  callThing,
  getActivityFeed,
  getClientHome,
  getDeployedProgram,
  getProgramCurrentWeekIndex,
  listMeetings,
  localDateStr,
  workoutFed,
  type FeedEvent,
  type HomeAction,
} from "./queries";
import { activityMarkOf } from "./activityMark";
import { SERVER_TZ, zonedToUtc } from "./timezones";
import { feedHref, needView } from "../admin/redesign/loaders";

type UserRow = Data["users"][number];
type ClientData = Data["clients"][number];
type ProgramDayRow = Data["program_days"][number];
type AssignmentRow = Data["workout_assignments"][number];
type ProgramRow = Data["training_programs"][number];
type CallRow = ReturnType<typeof listMeetings>[number];

/** Two looks closer than this are one visit. */
const VISIT_GAP_MS = 30 * 60000;
/** Within a visit, the look's time moves on at most once a minute, so a page re-read after every save doesn't write the store each time. */
const LOOK_STEP_MS = 60000;
/** Activity keeps each kind's newest this many rows, so a kind pages through its own history while the page stays bounded. */
const KIND_ROWS = 200;
/** A sign-in lock lasts this long (lib/loginLockout.ts). */
const LOCK_MS = 15 * 60000;

// ---- Dates ----------------------------------------------------------------------

const parseDay = (iso: string) => new Date(`${iso}T00:00:00`);
const LOCAL_STAMP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A stored stamp as epoch ms: "2026-10-21 14:05:00" (server-local, as localStamp writes) or ISO. NaN when unreadable. */
function stampMs(at: string | null | undefined): number {
  if (!at) return NaN;
  const m = LOCAL_STAMP.exec(at);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime();
  if (PLAIN_DAY.test(at)) return parseDay(at).getTime();
  return new Date(at).getTime();
}
/** The local day a stamp falls on. */
function stampDay(at: string): string {
  if (LOCAL_STAMP.test(at) || PLAIN_DAY.test(at)) return at.slice(0, 10);
  const t = new Date(at).getTime();
  return Number.isFinite(t) ? localDateStr(new Date(t)) : at.slice(0, 10);
}
const iso = (ms: number | null | undefined) => (ms != null && Number.isFinite(ms) ? new Date(ms).toISOString() : null);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A line the store writes with "a · b": its parts (a Needs-you item's title). Never cut inside “…”: the client's own words stay whole. */
function parts(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "“") depth++;
    else if (s[i] === "”") depth = Math.max(0, depth - 1);
    else if (depth === 0 && s.startsWith(" · ", i)) {
      out.push(s.slice(from, i));
      from = i + 3;
      i += 2;
    }
  }
  out.push(s.slice(from));
  return out.map((p) => p.trim()).filter(Boolean);
}

// ---- One read of the store --------------------------------------------------------

type Ctx = {
  coachId: number;
  today: string;
  now: number;
  data: Data;
  coach: UserRow | undefined;
  /** The coach's previous visit to the Feed (epoch ms); null on a first one. */
  prev: number | null;
  /** The coach's clients, by name. */
  clients: ClientData[];
  ids: Set<number>;
  /** Everything their clients logged, newest first (getActivityFeed). */
  feed: FeedEvent[];
  byEventId: Map<string, FeedEvent>;
  /** Each client's open Needs-you items, as their Home spells them (getClientHome). */
  actions: Map<number, HomeAction[]>;
  daysById: Map<number, ProgramDayRow>;
  programsByClient: Map<number, ProgramRow[]>;
  byDay: Map<number, AssignmentRow[]>;
  /** Sets logged per assignment. */
  logCount: Map<number, number>;
  /** The newest set logged on a session (epoch ms). */
  lastLogByDay: Map<number, number>;
  /** Per client, the days with a counted set (reps or weight), as Home's Consistency counts a trained day. */
  setDays: Map<number, Set<string>>;
  /** Per client, the newest set they logged (epoch ms): activity the feed only carries once a session is done. */
  lastSet: Map<number, number>;
  /** Per client, the metrics the workout answers (workoutFed): never a check-in. Ids and names. */
  fedIds: Map<number, Set<number>>;
  fedNames: Map<number, Set<string>>;
};

function context(coachId: number, today: string): Ctx {
  const data = getData();
  const now = Date.now();
  const coach = data.users.find((u) => u.id === coachId && u.role === "coach");
  const prev = coach?.feed_looked?.prev;
  const clients = data.clients.filter((c) => c.coach_id === coachId).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  const ids = new Set(clients.map((c) => c.id));

  const feed = getActivityFeed(coachId);
  const byEventId = new Map(feed.map((e) => [e.id, e] as const));
  const actions = new Map<number, HomeAction[]>();
  for (const c of clients) {
    try {
      actions.set(c.id, getClientHome(c.id, feed).actions);
    } catch (e) {
      console.error(`[feedBoard] home ${c.id}:`, e);
      actions.set(c.id, []);
    }
  }

  const daysById = new Map<number, ProgramDayRow>();
  for (const d of data.program_days) if (ids.has(d.client_id)) daysById.set(d.id, d);
  const programsByClient = new Map<number, ProgramRow[]>();
  for (const p of data.training_programs) {
    if (!ids.has(p.client_id)) continue;
    const list = programsByClient.get(p.client_id);
    if (list) list.push(p);
    else programsByClient.set(p.client_id, [p]);
  }
  const byDay = new Map<number, AssignmentRow[]>();
  const assignments = new Map<number, AssignmentRow>();
  for (const a of data.workout_assignments) {
    if (!daysById.has(a.program_day_id)) continue;
    assignments.set(a.id, a);
    const list = byDay.get(a.program_day_id);
    if (list) list.push(a);
    else byDay.set(a.program_day_id, [a]);
  }
  const logCount = new Map<number, number>();
  const lastLogByDay = new Map<number, number>();
  const setDays = new Map<number, Set<string>>();
  const lastSet = new Map<number, number>();
  for (const l of data.set_logs) {
    const a = assignments.get(l.workout_assignment_id);
    if (!a) continue;
    const day = daysById.get(a.program_day_id)!;
    logCount.set(a.id, (logCount.get(a.id) ?? 0) + 1);
    const ms = stampMs(l.logged_at);
    if (Number.isFinite(ms)) {
      if (ms > (lastLogByDay.get(day.id) ?? -Infinity)) lastLogByDay.set(day.id, ms);
      if (ms > (lastSet.get(day.client_id) ?? -Infinity)) lastSet.set(day.client_id, ms);
    }
    const counts = (typeof l.reps === "number" && l.reps > 0) || (typeof l.weight_kg === "number" && l.weight_kg > 0);
    if (counts && l.logged_at) {
      let s = setDays.get(day.client_id);
      if (!s) setDays.set(day.client_id, (s = new Set()));
      s.add(stampDay(l.logged_at));
    }
  }

  const fedIds = new Map<number, Set<number>>();
  const fedNames = new Map<number, Set<string>>();
  for (const m of data.metric_definitions) {
    if (!ids.has(m.client_id)) continue;
    let fed = false;
    try {
      fed = workoutFed(m.client_id, m.name);
    } catch {
      fed = false;
    }
    if (!fed) continue;
    if (!fedIds.has(m.client_id)) fedIds.set(m.client_id, new Set());
    if (!fedNames.has(m.client_id)) fedNames.set(m.client_id, new Set());
    fedIds.get(m.client_id)!.add(m.id);
    fedNames.get(m.client_id)!.add(m.name);
  }

  return {
    coachId,
    today,
    now,
    data,
    coach,
    prev: prev != null && Number.isFinite(prev) ? prev : null,
    clients,
    ids,
    feed,
    byEventId,
    actions,
    daysById,
    programsByClient,
    byDay,
    logCount,
    lastLogByDay,
    setDays,
    lastSet,
    fedIds,
    fedNames,
  };
}

/** A part that fails reads as empty, never the whole board. */
function safe<T>(part: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (e) {
    console.error(`[feedBoard] ${part}:`, e);
    return fallback;
  }
}

// ---- The board ------------------------------------------------------------------------

export function getFeedBoard(coachId: number): FeedBoard {
  const today = localDateStr();
  const empty: FeedBoard = { today, since: null, needs: [], activity: [] };
  let ctx: Ctx;
  try {
    ctx = context(coachId, today);
  } catch (e) {
    console.error("[feedBoard] read:", e);
    return empty;
  }
  return {
    today,
    since: safe("since", () => sinceOf(ctx), null),
    needs: safe("needs", () => needsOf(ctx), []),
    activity: safe("activity", () => activityOf(ctx), []),
  };
}

// ---- Since the coach last looked ------------------------------------------------------------

function sinceOf(ctx: Ctx): FeedBoard["since"] {
  const prev = ctx.prev;
  if (prev == null) return null;
  const { data, ids, today } = ctx;
  const from = localDateStr(new Date(prev));
  // Anything saved after the look counts, by its stamp; a row saved before rows carried one, by its day (after the look's).
  const savedSince = (at: string | null | undefined, day: string) => (at && Number.isFinite(stampMs(at)) ? stampMs(at) > prev : day > from);

  // Sessions completed (every set and cardio in) or ended since, as Activity's one row a session dates them
  // (sessionNews; 23 Oct, Alex): a session counts once, its cardio in it, and one done in part not at all. As Home counts.
  const sessions = ctx.feed.filter((e) => (e.session === "completed" || e.session === "ended") && e.at > prev).length;

  // Days with a check-in sent since, client by client: a daily reading on its day, a weekly or monthly one on the day it
  // was sent, a measurement on its date. What the workout answers is not a check-in.
  const checkIns = new Set<string>();
  const defs = new Map(data.metric_definitions.filter((m) => ids.has(m.client_id) && !ctx.fedIds.get(m.client_id)?.has(m.id)).map((m) => [m.id, m] as const));
  for (const e of data.metric_entries) {
    const def = defs.get(e.metric_definition_id);
    if (!def || e.value == null) continue;
    if (def.frequency === "daily") {
      const day = (e.period ?? "").slice(0, 10);
      if (day <= today && savedSince(e.logged_at, day)) checkIns.add(`${def.client_id}:${day}`);
    } else if (e.logged_at && stampMs(e.logged_at) > prev) checkIns.add(`${def.client_id}:${stampDay(e.logged_at)}`);
  }
  const fields = new Map(data.measurement_fields.filter((f) => ids.has(f.client_id)).map((f) => [f.id, f.client_id] as const));
  for (const v of data.measurement_values) {
    const clientId = fields.get(v.field_id);
    if (clientId == null || v.value == null || v.date > today) continue;
    if (savedSince(v.logged_at, v.date)) checkIns.add(`${clientId}:${v.date.slice(0, 10)}`);
  }

  // Days with food logged since: a diary entry, or a typed day's calories.
  const food = new Set<string>();
  for (const f of data.food_entries ?? []) if (ids.has(f.client_id) && f.date <= today && savedSince(f.logged_at, f.date)) food.add(`${f.client_id}:${f.date}`);
  for (const c of data.calorie_logs) if (ids.has(c.client_id) && c.kcal > 0 && c.date <= today && savedSince(c.logged_at, c.date)) food.add(`${c.client_id}:${c.date}`);

  const messages = data.chat_messages.filter((m) => ids.has(m.client_id) && m.sender === "client" && (m.text?.trim() || m.media_path) && stampMs(m.created_at) > prev).length;

  // Shape updates: each sheet a photo came in on since.
  const slots = new Map(data.photo_slots.filter((s) => ids.has(s.client_id)).map((s) => [s.id, s.client_id] as const));
  const sheets = new Set<string>();
  for (const u of data.photo_uploads) {
    const clientId = slots.get(u.slot_id);
    if (clientId != null && stampMs(u.uploaded_at) > prev) sheets.add(`${clientId}:${u.period}`);
  }

  const out = { from, sessions, checkIns: checkIns.size, foodDays: food.size, messages, shapeUpdates: sheets.size };
  return out.sessions || out.checkIns || out.foodDays || out.messages || out.shapeUpdates ? out : null;
}

// ---- Needs you ----------------------------------------------------------------------------------

/** A call's title as the Meetings tab shows it: the recap's title once written, else the topic, else the kind's name. */
const callTitle = (m: CallRow) =>
  m.summary_title?.trim() || m.topic?.trim() || (m.meeting_type === "review" ? "Review call" : m.meeting_type === "other" ? "Call" : "Check-in call");
const tab = (name: string, clientId: number, rest = "") => `/admin/redesign/${name}?client=${clientId}${rest}`;

/** The live programme and the week it is in, for a link to a week on Training. */
function liveWeek(clientId: number): { programId: number; index: number } | null {
  const p = getDeployedProgram(clientId);
  return p ? { programId: p.id, index: getProgramCurrentWeekIndex(p) } : null;
}

/** When a client's lock started: the newest lock on their login still within its 15 minutes. */
function lockSince(ctx: Ctx, clientId: number): string | null {
  const user = ctx.data.users.find((u) => u.role === "client" && u.client_id === clientId);
  if (!user) return null;
  let at: number | null = null;
  for (const e of ctx.data.login_lock_events ?? []) {
    if (e.email !== user.email || e.cleared) continue;
    const ms = new Date(e.at).getTime();
    if (Number.isFinite(ms) && ms + LOCK_MS > ctx.now && (at == null || ms > at)) at = ms;
  }
  return iso(at);
}

/** One Needs-you item as a row, or null when the Feed doesn't list it (an invoice, a standing state shown as a pill). */
function needFrom(ctx: Ctx, c: ClientData, a: HomeAction): NeedRow | null {
  const base = { key: `${c.id}:${a.id}`, clientId: c.id, client: c.name ?? "Client", avatarPath: c.avatar_path ?? null, time: null, dismissId: a.id };
  const open = needView(c.id, a, ctx.byEventId).open;
  if (a.id === "week") {
    const live = liveWeek(c.id);
    return { ...base, kind: "week", what: a.title, words: null, since: null, action: "Add sessions", href: live ? tab("training", c.id, `&program=${live.programId}&week=${live.index}`) : tab("training", c.id) };
  }
  if (a.id === "locked") {
    // No Done: the lock stands until it ends or is reset (Home stamps it afresh on every read, so a dismissal never holds).
    return { ...base, kind: "locked", what: a.title, words: null, since: lockSince(ctx, c.id) ?? iso(a.at), action: "Unlock", href: open, dismissId: null };
  }
  if (/^reply-\d+$/.test(a.id)) {
    const n = Number(/^(\d+) messages/.exec(a.title)?.[1]) || 1;
    // One with no words: what it was ("A photo", "A voice message").
    const what = n > 1 ? `${n} messages` : a.quote ? "1 message" : cap(a.detail.replace(/^Sent /, "").replace(/\.$/, ""));
    return { ...base, kind: "reply", what, words: a.quote ? a.detail : null, since: iso(a.at), action: "Reply", href: open };
  }
  if (/^reply-video-\d+$/.test(a.id)) {
    return { ...base, kind: "video", what: a.title.replace(/ waiting for your reply$/, ""), words: null, since: iso(a.at), action: "Review", href: open };
  }
  const ask = /^call-(\d+)$/.exec(a.id);
  if (ask) {
    const r = (ctx.data.meeting_requests ?? []).find((x) => x.id === Number(ask[1]));
    return { ...base, kind: "ask-call", what: "Asked for a call", words: r?.about?.trim() || null, since: iso(a.at), action: "Book", href: open };
  }
  if (a.id.startsWith("read-")) {
    // The thing in the store's words, its first part: "Couldn't do Session 3", "Wrote a note on Hypertrophy".
    const what = (parts(a.title)[0] ?? a.title).replace(/\s*\(Week \d+\)$/, "");
    return { ...base, kind: "read", what, words: a.detail?.trim() || null, since: iso(a.at), action: "Read", href: open };
  }
  return null;
}

function needsOf(ctx: Ctx): NeedRow[] {
  // Each row with where it sorts: blockers (0), today's calls (1), the rest (2); then a moment, earliest first.
  const ranked: { row: NeedRow; rank: number; ms: number }[] = [];
  for (const c of ctx.clients) {
    for (const a of ctx.actions.get(c.id) ?? []) {
      const row = safe(`need ${c.id} ${a.id}`, () => needFrom(ctx, c, a), null);
      if (!row) continue;
      const blocker = row.kind === "week" || row.kind === "locked";
      ranked.push({ row, rank: blocker ? 0 : 2, ms: row.since ? new Date(row.since).getTime() : Infinity });
    }
    // Today's calls: Prep. They wait for no one, so no wait and no Done.
    const calls = safe(`calls ${c.id}`, () => listMeetings(c.id), []);
    for (const m of calls) {
      if (m.status !== "scheduled" || m.date !== ctx.today) continue;
      const time = m.all_day ? null : (m.time ?? "").trim() || null;
      const row: NeedRow = {
        key: `${c.id}:meeting-${m.id}`,
        clientId: c.id,
        client: c.name ?? "Client",
        avatarPath: c.avatar_path ?? null,
        kind: "call",
        what: callTitle(m),
        words: null,
        since: null,
        time,
        action: "Prep",
        href: tab("meetings", c.id),
        dismissId: null,
      };
      // By time; an all-day call after the timed ones.
      ranked.push({ row, rank: 1, ms: time ? Number(time.replace(":", "")) || 0 : Infinity });
    }
  }
  const kindRank: Partial<Record<NeedRow["kind"], number>> = { week: 0, locked: 1 };
  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.rank === 0 ? (kindRank[a.row.kind] ?? 9) - (kindRank[b.row.kind] ?? 9) : 0) ||
      (a.ms === b.ms ? 0 : a.ms < b.ms ? -1 : 1) ||
      a.row.client.localeCompare(b.row.client) ||
      (a.row.key < b.row.key ? -1 : 1)
  );
  return ranked.map((r) => r.row);
}

// ---- Activity ------------------------------------------------------------------------------------

/** A row's kind, as Home's Activity sorts one (HomeDraft FILTERS): a call asked for with the meetings, a note with the
    messages. An invoice is none: money lives on Business. */
function kindOf(e: { category: string; tab: string }): ActivityKind | null {
  if (e.category === "billing") return null;
  if (e.category === "training") return "training";
  if (e.category === "nutrition") return "nutrition";
  if (e.category === "measurements") return "lifestyle";
  if (e.category === "meetings" || e.tab === "meetings") return "meetings";
  return "messages";
}

/** A call's moment: a timed call at its time in its own zone, one with no time at its day's noon (as the feed files a day with no time). */
function callAt(date: string, time: string, tz: string | null | undefined): number {
  const noon = new Date(`${date}T12:00:00`).getTime();
  if (!time) return noon;
  const t = zonedToUtc(date, time, tz || SERVER_TZ).getTime();
  return Number.isFinite(t) ? t : noon;
}

function activityOf(ctx: Ctx): ActivityRow[] {
  const prev = ctx.prev;
  const isNew = (at: number) => prev != null && at > prev;
  // What each row is, cheaply; its link is read only for the rows kept (each kind's newest KIND_ROWS). Words another row
  // quotes already (a session's note, sent to the chat too) are left out.
  type Item = { kind: ActivityKind; at: number; id: string; feed: FeedEvent | null; call: { clientId: number; client: string; m: CallRow; time: string } | null };
  const items: Item[] = [];
  for (const e of ctx.feed) {
    const kind = kindOf(e);
    if (kind && !e.echo) items.push({ kind, at: e.at, id: e.id, feed: e, call: null });
  }
  // The calls that are over, as Home's Activity has them (loadHome): held, missed, or past and never marked.
  for (const c of ctx.clients) {
    for (const m of safe(`past calls ${c.id}`, () => listMeetings(c.id), [])) {
      if (!(m.status === "completed" || m.status === "no-show" || (m.status === "scheduled" && m.date < ctx.today))) continue;
      const time = m.all_day ? "" : (m.time ?? "").trim();
      const at = callAt(m.date, time, m.tz);
      if (Number.isFinite(at)) items.push({ kind: "meetings", at, id: `meeting-${m.id}`, feed: null, call: { clientId: c.id, client: c.name ?? "Client", m, time } });
    }
  }
  items.sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1));
  const room: Partial<Record<ActivityKind, number>> = {};
  const kept = items.filter((r) => {
    const n = room[r.kind] ?? 0;
    if (n >= KIND_ROWS) return false;
    room[r.kind] = n + 1;
    return true;
  });

  // The thing alone and the client's own words (23 Oct, Alex: "only a subheading if the client left a note or sent a
  // message"), in Home's words: one row a session, its cardio in it.
  const rows: ActivityRow[] = [];
  for (const r of kept) {
    if (r.feed) {
      const e = r.feed;
      // A client who deleted their account has no tab to open: the departure is on Business.
      const href = safe(`href ${e.id}`, () => feedHref(e), null) ?? (e.target?.kind === "gone" ? "/admin/redesign/business" : tab("home", e.clientId));
      rows.push({ id: e.id, clientId: e.clientId, client: e.clientName, kind: r.kind, mark: activityMarkOf(e), at: new Date(e.at).toISOString(), timeKnown: e.timeKnown, title: e.thing || cap(e.text), quote: activityWords(e), href, isNew: isNew(e.at) });
    } else if (r.call) {
      const { m, time } = r.call;
      rows.push({
        id: r.id,
        clientId: r.call.clientId,
        client: r.call.client,
        kind: "meetings",
        mark: "meetings",
        at: new Date(r.at).toISOString(),
        // Its start (no call keeps when it was booked); a call with no time says All day, as the Calendar draws it.
        timeKnown: !!time,
        allDay: !time,
        title: callThing(m),
        quote: null,
        href: tab("meetings", r.call.clientId),
        isNew: isNew(r.at),
      });
    }
  }
  return rows;
}

// ---- The coach's look -------------------------------------------------------------------------------

/**
 * The coach has the Feed on screen: a look more than 30 minutes after the last starts a new visit, and the visit before
 * becomes what "Since" and New count from. Call before getFeedBoard: a new visit moves the last look into prev first, so
 * the board counts from the previous visit on its first render too (and on every re-read in it).
 */
export function noteFeedLooked(coachId: number): void {
  try {
    const coach = getData().users.find((u) => u.id === coachId && u.role === "coach");
    if (!coach) return;
    const now = Date.now();
    const had = coach.feed_looked;
    if (!had || !Number.isFinite(had.at) || now - had.at > VISIT_GAP_MS) {
      coach.feed_looked = { at: now, prev: had && Number.isFinite(had.at) ? had.at : null };
      persist();
    } else if (now - had.at >= LOOK_STEP_MS) {
      coach.feed_looked = { at: now, prev: had.prev ?? null };
      persist();
    }
  } catch (e) {
    console.error("[feedBoard] noteFeedLooked:", e);
  }
}
