// The Feed's data (feedBoard.ts has the shape and what each part means): one read of the store for the coach's Feed,
// every client at once, and the note of when the coach looked, so "Since 20/10" and the New rows count from the visit
// before this one. Never throws: a coach with no clients, no logs and no calls gets nulls, zeros and empty lists.

import type { ActivityKind, ActivityRow, ClientDay, ClientPill, ClientRow, FeedBoard, NeedRow } from "./feedBoard";
import { getData, persist, type Data, type PhaseTrack } from "./db";
import {
  getActivityFeed,
  getClientHome,
  getCurrentPhase,
  getDeployedProgram,
  getProgramCurrentWeekIndex,
  getWeek,
  isSessionComplete,
  listClientPhases,
  listMeetings,
  localDateStr,
  mediaWords,
  weekStart,
  workoutFed,
  type FeedEvent,
  type HomeAction,
} from "./queries";
import { phaseLastDay } from "./phases";
import { dayMonth } from "./dayMonth";
import { SERVER_TZ, zonedToUtc } from "./timezones";
import { endingSoon, type OverviewPhase } from "../admin/redesign/phases/timeline";
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
/** The strip on a client's row: their last 14 days. */
const STRIP_DAYS = 14;
/** Activity keeps each kind's newest this many rows, so a kind pages through its own history while the page stays bounded. */
const KIND_ROWS = 200;
/** A sign-in lock lasts this long (lib/loginLockout.ts). */
const LOCK_MS = 15 * 60000;
const TRACK_ORDER: PhaseTrack[] = ["lifestyle", "training", "nutrition"];
const TRACK_NAME: Record<PhaseTrack, string> = { lifestyle: "Lifestyle", training: "Training", nutrition: "Nutrition" };
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---- Dates ----------------------------------------------------------------------

const DAY_MS = 86400000;
const parseDay = (iso: string) => new Date(`${iso}T00:00:00`);
const addDays = (iso: string, n: number) => {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
};
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
/** "October", or "October 2025" when not this year; a month ("2026-10") or a day in it. */
function monthName(period: string): string | null {
  if (!/^\d{4}-\d{2}/.test(period)) return null;
  const name = MONTH_LONG[+period.slice(5, 7) - 1];
  if (!name) return null;
  return period.slice(0, 4) === String(new Date().getFullYear()) ? name : `${name} ${period.slice(0, 4)}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** The parts kept: empty ones go, so Sep leaves no bar over. */
const clean = (xs: (string | null | undefined | false)[]) => xs.map((x) => (x || "").trim()).filter(Boolean);

/** A line the store writes with "a · b": its parts. Never cut inside “…”: the client's own words stay whole (as Home's Activity reads them). */
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
  const empty: FeedBoard = { today, since: null, needs: [], clients: { rows: [], activeThisWeek: 0, quiet: 0 }, activity: [] };
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
    clients: safe("clients", () => clientsOf(ctx), empty.clients),
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

  // Sessions ended since, and those completed by their sets since (never ended, every set in): as Home counts them.
  let sessions = 0;
  for (const d of ctx.daysById.values()) {
    if (d.session_ended_at) {
      if (stampMs(d.session_ended_at) > prev) sessions++;
      continue;
    }
    if ((ctx.lastLogByDay.get(d.id) ?? -Infinity) > prev && isSessionComplete(d.id)) sessions++;
  }

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

// ---- Clients ----------------------------------------------------------------------------------------

/** Each client's own latest doing (epoch ms): the newest of their activity (not an invoice the coach changed) and their newest set. */
function lastActiveAll(ctx: Ctx): Map<number, number> {
  const out = new Map(ctx.lastSet);
  for (const e of ctx.feed) {
    if (e.category === "billing" || e.target?.kind === "gone") continue;
    if (e.at > (out.get(e.clientId) ?? -Infinity)) out.set(e.clientId, e.at);
  }
  return out;
}

/** Every client's last 14 days in one pass, as Home's Consistency counts a day (getActivityCalendar, read here for all at
    once): trained (a counted set, or a session the calendar has on the day: ended there, done in full, or kept from before
    a coach's edit), food (the diary, or a typed day's calories), checked in (anything but what the workout answers). */
function stripsOf(ctx: Ctx): Map<number, ClientDay[]> {
  const { data, ids, today } = ctx;
  const dates = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i - (STRIP_DAYS - 1)));
  const from = dates[0];
  type Marks = Map<number, Set<string>>;
  const trained: Marks = new Map();
  const food: Marks = new Map();
  const checkIn: Marks = new Map();
  const has = (m: Marks, clientId: number, day: string) => !!m.get(clientId)?.has(day);
  const mark = (m: Marks, clientId: number, day: string) => {
    if (day < from || day > today) return;
    let s = m.get(clientId);
    if (!s) m.set(clientId, (s = new Set()));
    s.add(day);
  };

  for (const [clientId, days] of ctx.setDays) for (const d of days) mark(trained, clientId, d);
  for (const d of ctx.daysById.values()) {
    if (d.session_ended_at) {
      mark(trained, d.client_id, stampDay(d.session_ended_at));
      continue;
    }
    const last = ctx.lastLogByDay.get(d.id);
    if (last == null) continue;
    const day = localDateStr(new Date(last));
    if (day >= from && day <= today && !has(trained, d.client_id, day) && isSessionComplete(d.id)) mark(trained, d.client_id, day);
  }
  for (const c of ctx.clients) {
    const fed = ctx.fedNames.get(c.id);
    for (const k of c.kept_activity ?? []) {
      if (k.kind === "training") mark(trained, c.id, k.date);
      else if (!fed?.has(k.name)) mark(checkIn, c.id, k.date);
    }
  }

  for (const f of data.food_entries ?? []) if (ids.has(f.client_id)) mark(food, f.client_id, f.date);
  for (const c of data.calorie_logs) if (ids.has(c.client_id) && c.kcal > 0) mark(food, c.client_id, c.date);

  const defs = new Map(data.metric_definitions.filter((m) => ids.has(m.client_id) && !ctx.fedIds.get(m.client_id)?.has(m.id)).map((m) => [m.id, m] as const));
  for (const e of data.metric_entries) {
    const def = defs.get(e.metric_definition_id);
    if (!def || e.value == null) continue;
    const day = def.frequency === "daily" ? (e.period ?? "").slice(0, 10) : e.logged_at ? stampDay(e.logged_at) : null;
    if (day) mark(checkIn, def.client_id, day);
  }
  const fields = new Map(data.measurement_fields.filter((f) => ids.has(f.client_id)).map((f) => [f.id, f] as const));
  for (const v of data.measurement_values) {
    const f = fields.get(v.field_id);
    if (f && v.value != null && !ctx.fedNames.get(f.client_id)?.has(f.name)) mark(checkIn, f.client_id, v.date.slice(0, 10));
  }

  return new Map(ctx.clients.map((c) => [c.id, dates.map((date) => ({ date, checkIn: has(checkIn, c.id, date), trained: has(trained, c.id, date), food: has(food, c.id, date) }))] as const));
}

/** This week's sessions in the live programme, as Home's training tile counts them: one with an exercise is planned, one
    with a set logged is done. Null with no live programme, or nothing planned this week (that is a Needs-you row). */
function sessionsOf(ctx: Ctx, clientId: number): ClientRow["sessions"] {
  const program = getDeployedProgram(clientId);
  if (!program) return null;
  const week = program.start_week + getProgramCurrentWeekIndex(program) - 1;
  let planned = 0;
  let done = 0;
  for (const d of getWeek(clientId, week)) {
    const as = ctx.byDay.get(d.id) ?? [];
    if (!as.length) continue;
    planned++;
    if (as.some((a) => (ctx.logCount.get(a.id) ?? 0) > 0)) done++;
  }
  return planned ? { done, planned } : null;
}

/** Every phase of the client's as the Phases overview reads it, for "ending with nothing after" (Business's rule). */
function overviewPhases(ctx: Ctx, clientId: number): OverviewPhase[] {
  const programs = new Map((ctx.programsByClient.get(clientId) ?? []).map((p) => [p.id, p] as const));
  return ctx.data.client_phases
    .filter((p) => p.client_id === clientId)
    .map((p) => {
      const program = p.program_id != null ? programs.get(p.program_id) : undefined;
      // A draft: the phase's own flag, or its programme still a draft (phases/load.ts).
      const programDraft = !!program && program.status !== "deployed" && !program.scheduled_at;
      return {
        id: p.id,
        track: p.track,
        name: p.name,
        start: p.start_week,
        end: phaseLastDay(p.end_week),
        endWeek: p.end_week,
        draft: !!p.draft || programDraft,
        objectives: p.objectives ?? [],
        programId: program?.id ?? null,
        gap: null,
      };
    });
}

/** The row's pills, the coach's side first, at most two. */
function pillsOf(ctx: Ctx, clientId: number, lastMs: number | null): ClientPill[] {
  const actions = ctx.actions.get(clientId) ?? [];
  const live = Object.fromEntries(TRACK_ORDER.map((t) => [t, !!getCurrentPhase(clientId, t)])) as Record<PhaseTrack, boolean>;
  const coach: ClientPill[] = [];
  const client: ClientPill[] = [];

  // No phase: nothing live on any track (a Lifestyle phase alone is a phase running, so never No phase beside Quiet).
  const noneLive = !live.lifestyle && !live.training && !live.nutrition;
  // New until they have a phase or programme of any state (22 Oct, Alex), as the rail tags them; then No phase.
  const isNew = listClientPhases(clientId).length === 0 && !ctx.data.training_programs.some((p) => p.client_id === clientId);
  if (isNew) coach.push({ text: "New", side: "coach", href: tab("plan", clientId) });
  else if (noneLive) coach.push({ text: "No phase", side: "coach", href: tab("plan", clientId) });
  // A running phase ending within 14 days with nothing after it on its track, soonest first: their Plan, to plan the next.
  const phases = overviewPhases(ctx, clientId);
  for (const p of phases.filter((x) => endingSoon(x, phases, ctx.today)).sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0))) {
    coach.push({ text: `${TRACK_NAME[p.track]} ends ${dayMonth(p.end)}`, side: "coach", href: tab("plan", clientId), track: p.track });
  }

  // The client's side, from their Home's check items. Quiet and a missing check-in say nothing while no phase is live at
  // all: nothing is asked of them, the same fact as No phase.
  const missed = actions.find((a) => a.id === "missed-sessions");
  const m = missed ? /Missed (\d+) of (\d+)/.exec(missed.title) : null;
  if (m) {
    const w = liveWeek(clientId);
    client.push({ text: `Missed ${m[1]} of ${m[2]}`, side: "client", href: w && w.index > 1 ? tab("training", clientId, `&program=${w.programId}&week=${w.index - 1}`) : tab("training", clientId), track: "training" });
  }
  if (!noneLive) {
    // Quiet by the row's own Last active (every set counts, invoices don't), 7 days and more, as the header counts it.
    const quietDays = lastMs != null ? Math.floor((ctx.now - lastMs) / DAY_MS) : null;
    if (quietDays != null && quietDays >= 7) client.push({ text: `Quiet ${quietDays} days`, side: "client", href: tab("messages", clientId) });
    if (actions.some((a) => a.id.startsWith("checkin-"))) client.push({ text: "Check-in missing", side: "client", href: tab("measurements", clientId), track: "lifestyle" });
  }
  return [...coach, ...client].slice(0, 2);
}

function clientsOf(ctx: Ctx): FeedBoard["clients"] {
  const monday = weekStart(ctx.today);
  const weekAgo = ctx.now - 7 * DAY_MS;
  let activeThisWeek = 0;
  let quiet = 0;
  const last = safe("lastActive", () => lastActiveAll(ctx), new Map<number, number>());
  const strips = safe("days", () => stripsOf(ctx), new Map<number, ClientDay[]>());
  const blank = Array.from({ length: STRIP_DAYS }, (_, i): ClientDay => ({ date: addDays(ctx.today, i - (STRIP_DAYS - 1)), checkIn: false, trained: false, food: false }));
  const rows = ctx.clients.map((c): { row: ClientRow; ms: number | null } => {
    const ms = last.get(c.id) ?? null;
    if (ms != null && localDateStr(new Date(ms)) >= monday) activeThisWeek++;
    if (ms == null || ms < weekAgo) quiet++;
    const pills = safe(`pills ${c.id}`, () => pillsOf(ctx, c.id, ms), []);
    const row: ClientRow = {
      clientId: c.id,
      name: c.name ?? "Client",
      avatarPath: c.avatar_path ?? null,
      days: strips.get(c.id) ?? blank,
      sessions: safe(`sessions ${c.id}`, () => sessionsOf(ctx, c.id), null),
      lastActive: iso(ms),
      pills,
      attention: pills.length > 0,
      href: tab("home", c.id),
    };
    return { row, ms };
  });
  // Last active first; never active last, by name.
  rows.sort((a, b) => (a.ms == null ? (b.ms == null ? a.row.name.localeCompare(b.row.name) : 1) : b.ms == null ? -1 : b.ms - a.ms || a.row.name.localeCompare(b.row.name)));
  return { rows: rows.map((r) => r.row), activeThisWeek, quiet };
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

type Told = { title: string; rest: string[]; quote: string | null };

/** "Session 2", or "Rogue session" for one the client made up. */
const sessionName = (d: ProgramDayRow) => (d.free ? "Rogue session" : `Session ${d.day_of_week}`);
/** The session's week inside its programme ("Week 3"). */
function weekOf(ctx: Ctx, d: ProgramDayRow): string {
  const p = (ctx.programsByClient.get(d.client_id) ?? []).find((x) => d.week_number >= x.start_week && d.week_number < x.start_week + x.total_weeks);
  return `Week ${p ? d.week_number - p.start_week + 1 : d.week_number}`;
}
/** A day it is about, when that isn't the day the row is dated: "for 20/10". */
const forDay = (day: string, at: number) => (PLAIN_DAY.test(day) && day !== localDateStr(new Date(at)) ? `for ${dayMonth(day)}` : null);

/** The thing, the rest of it and the client's words, read from what the event is about (its id names it). */
function toldExact(ctx: Ctx, e: FeedEvent): Told | null {
  const { data } = ctx;
  const id = e.id;
  let m: RegExpExecArray | null;
  if ((m = /^workout-(\d+)$/.exec(id))) {
    const d = ctx.daysById.get(Number(m[1]));
    if (!d) return null;
    const sets = /(\d+ sets?)$/.exec(e.text)?.[1] ?? null;
    return { title: sessionName(d), rest: clean([!d.free && d.label, weekOf(ctx, d), e.text.startsWith("ended ") && "ended early", sets]), quote: e.note };
  }
  if ((m = /^skip-(\d+)$/.exec(id))) {
    const d = ctx.daysById.get(Number(m[1]));
    if (!d) return null;
    return { title: `Couldn't do ${sessionName(d)}`, rest: clean([!d.free && d.label, weekOf(ctx, d)]), quote: e.note };
  }
  if ((m = /^cardio-(\d+)$/.exec(id))) {
    const log = (data.cardio_logs ?? []).find((l) => l.id === Number(m![1]));
    const entry = log ? (data.cardio_entries ?? []).find((c) => c.id === log.cardio_entry_id) : undefined;
    const d = entry ? ctx.daysById.get(entry.program_day_id) : undefined;
    // A bare number gets its unit, as a cardio row's figures do on save (design rules 8): older rows kept "20".
    const unit = (v: string | undefined, u: string) => (v && /^\d+(?:[.,]\d+)?$/.test(v.trim()) ? `${v.trim()} ${u}` : v);
    return { title: "Cardio", rest: clean([entry?.swap?.name || entry?.name, unit(entry?.time, "min"), unit(entry?.distance, "km"), d && (d.label?.trim() || sessionName(d)), d && weekOf(ctx, d)]), quote: e.note };
  }
  if ((m = /^calories-(\d+)$/.exec(id))) {
    const c = data.calorie_logs.find((x) => x.id === Number(m![1]));
    if (!c) return null;
    return { title: "Food", rest: clean([`${Math.round(c.kcal).toLocaleString("en-GB")} kcal`, forDay(c.date, e.at)]), quote: e.note };
  }
  if ((m = /^food-\d+-(\d{4}-\d{2}-\d{2})$/.exec(id))) {
    // "logged food for 21/10 · 2,340 kcal, 5 items": the totals after the bar.
    return { title: "Food", rest: clean([...(parts(e.text)[1] ?? "").split(", "), forDay(m[1], e.at)]), quote: e.note };
  }
  if ((m = /^checkin-\d+-(daily|weekly|monthly|measurements)-(.+)$/.exec(id))) {
    const [, kind, period] = m;
    const count = /· (\d+ metrics?)$/.exec(e.text)?.[1] ?? null;
    const values = kind === "measurements" && e.text.startsWith("logged measurements") && e.text.includes(": ") ? e.text.slice(e.text.indexOf(": ") + 2) : null;
    const when = kind === "weekly" ? (PLAIN_DAY.test(period) ? `Week of ${dayMonth(period)}` : null) : kind === "monthly" ? monthName(period) : forDay(period.slice(0, 10), e.at);
    return { title: kind === "measurements" ? "Measurements" : `${cap(kind)} check-in`, rest: clean([when, count, values]), quote: e.note };
  }
  if (id.startsWith("photos-")) {
    return { title: "Shape update", rest: e.thumbs.length ? [plural(e.thumbs.length, "photo")] : [], quote: e.note };
  }
  if ((m = /^video-(\d+)-/.exec(id))) {
    const v = (data.video_requests ?? []).find((x) => x.id === Number(m![1]));
    const a = v ? data.workout_assignments.find((w) => w.id === v.assignment_id) : undefined;
    const d = a ? ctx.daysById.get(a.program_day_id) : undefined;
    if (!v || !a) return null;
    const name = data.exercises.find((x) => x.id === a.exercise_id)?.name ?? "an exercise";
    return { title: `${v.media === "photo" ? "Photo" : "Video"} of ${v.about === "swap" ? `a swap for ${name}` : name}`, rest: clean([d && (d.label?.trim() || sessionName(d)), d && weekOf(ctx, d)]), quote: null };
  }
  if ((m = /^program-note-(\d+)$/.exec(id))) {
    const n = (data.client_program_notes ?? []).find((x) => x.id === Number(m![1]));
    const program = n ? data.training_programs.find((p) => p.id === n.program_id) : undefined;
    return { title: `Note on ${program?.name?.trim() || "their programme"}`, rest: [], quote: e.note };
  }
  if ((m = /^chat-(\d+)$/.exec(id))) {
    const msg = data.chat_messages.find((x) => x.id === Number(m![1]));
    return { title: e.note ? "Message" : cap(mediaWords(msg?.media_type ?? null).replace(/^an? /, "")), rest: [], quote: e.note };
  }
  if ((m = /^meeting-request-(\d+)$/.exec(id))) {
    const r = (data.meeting_requests ?? []).find((x) => x.id === Number(m![1]));
    if (!r) return null;
    return { title: "Asked for a call", rest: clean([r.when_suits]), quote: r.about?.trim() || null };
  }
  if ((m = /^event-(\d+)$/.exec(id))) {
    const ev = data.client_events.find((x) => x.id === Number(m![1]));
    if (!ev) return null;
    // Two dates get the faint arrow with air either side (rule 8), not a dash.
    const when = ev.start_date === ev.end_date ? dayMonth(ev.start_date) : `${dayMonth(ev.start_date)} → ${dayMonth(ev.end_date)}`;
    return { title: "Event", rest: clean([ev.title, when]), quote: ev.note?.trim() || null };
  }
  if (id.startsWith("account-deleted-")) return { title: "Deleted their account", rest: [], quote: null };
  return null;
}

/** The thing and the rest: read exactly from what it is about, else split from the store's words as Home's Activity does. */
function told(ctx: Ctx, e: FeedEvent): Told {
  try {
    const t = toldExact(ctx, e);
    if (t) return t;
  } catch (err) {
    console.error(`[feedBoard] told ${e.id}:`, err);
  }
  const [title = "", ...rest] = parts(cap(e.text));
  return { title, rest, quote: e.note };
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
  // What each row is, cheaply; its words and its link are read only for the rows kept (each kind's newest KIND_ROWS).
  type Item = { kind: ActivityKind; at: number; id: string; feed: FeedEvent | null; call: { clientId: number; client: string; m: CallRow; time: string } | null };
  const items: Item[] = [];
  for (const e of ctx.feed) {
    const kind = kindOf(e);
    if (kind) items.push({ kind, at: e.at, id: e.id, feed: e, call: null });
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

  const rows: ActivityRow[] = [];
  for (const r of kept) {
    if (r.feed) {
      const e = r.feed;
      const t = told(ctx, e);
      // A client who deleted their account has no tab to open: the departure is on Business.
      const href = safe(`href ${e.id}`, () => feedHref(e), null) ?? (e.target?.kind === "gone" ? "/admin/redesign/business" : tab("home", e.clientId));
      rows.push({ id: e.id, clientId: e.clientId, client: e.clientName, kind: r.kind, at: new Date(e.at).toISOString(), timeKnown: e.timeKnown, title: t.title, rest: t.rest, quote: t.quote, href, isNew: isNew(e.at) });
    } else if (r.call) {
      const { m, time } = r.call;
      rows.push({
        id: r.id,
        clientId: r.call.clientId,
        client: r.call.client,
        kind: "meetings",
        at: new Date(r.at).toISOString(),
        timeKnown: !!time,
        title: callTitle(m),
        rest: m.status === "no-show" ? ["missed"] : m.status === "scheduled" ? ["not marked"] : [],
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
