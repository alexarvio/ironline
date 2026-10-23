// The Home board's data (homeBoard.ts has the shape and what each part means): one read of the store for the admin's
// Home tab, and the note of when the coach looked, so "Since 18/10" counts from the visit before this one.
// Never throws: a client with no programme, no phases, no weight and no logs gets nulls and zeros.

import type { ConsistencyDay, ConsistencyWeek, HomeBoard, MuscleGroup, MuscleWindow, PerGroup, StrengthWindow } from "./homeBoard";
import { getData, persist, type Data, type PhaseTrack } from "./db";
import {
  coachGroups,
  getActivityCalendar,
  getCoachSettings,
  getCurrentPhase,
  getDeployedProgram,
  getNutritionGoalsSummary,
  getProgramCurrentWeekIndex,
  getWeek,
  getWeightSeriesAll,
  invoiceRepeatViews,
  isSessionComplete,
  listMeetings,
  localDateStr,
  weekStart,
  workoutFed,
  type ActivityDay,
} from "./queries";
import { phaseLastDay, phaseWeekIndex, phaseWeeks } from "./phases";
import { invoicingFor } from "./countries";
import { clientStartDay } from "./businessBoardData";

type ProgramDayRow = Data["program_days"][number];
type AssignmentRow = Data["workout_assignments"][number];
type SetLogRow = Data["set_logs"][number];
type ClientRow = Data["clients"][number];
type PhaseRow = Data["client_phases"][number];

/** In homeBoard.ts's order (kept here as well, so this file reads nothing but types from there: no import cycle). */
const GROUPS: MuscleGroup[] = ["Back", "Chest", "Shoulders", "Arms", "Legs", "Core"];
const TRACK_ORDER: PhaseTrack[] = ["lifestyle", "training", "nutrition"];
/** Two looks closer than this are one visit. */
const VISIT_GAP_MS = 30 * 60000;
/** Within a visit, the look's time moves on at most once a minute, so a page re-read after every save doesn't write the store each time. */
const LOOK_STEP_MS = 60000;

// An exercise's first muscle tag to its group (homeBoard.ts). The library's own slugs and the older per-muscle tags.
const TAG_GROUP: Record<string, MuscleGroup> = {
  back: "Back",
  lats: "Back",
  traps: "Back",
  "upper back": "Back",
  "lower back": "Back",
  "rear delts": "Back",
  chest: "Chest",
  pecs: "Chest",
  shoulders: "Shoulders",
  delts: "Shoulders",
  "front delts": "Shoulders",
  "side delts": "Shoulders",
  arms: "Arms",
  biceps: "Arms",
  triceps: "Arms",
  forearms: "Arms",
  legs: "Legs",
  quads: "Legs",
  hamstrings: "Legs",
  glutes: "Legs",
  calves: "Legs",
  adductors: "Legs",
  abductors: "Legs",
  abs: "Core",
  core: "Core",
  obliques: "Core",
};
// The library files shoulder work under Arms (queries.ts MUSCLE_GROUPS: "Shoulders sit under Arms"), so an exercise
// tagged plain "arms" whose name is a shoulder movement counts as Shoulders; otherwise that axis would always be empty.
const SHOULDER_NAME = /shoulder|overhead press|military press|arnold|lateral raise|side raise|front raise|delt|upright row|\bohp\b/i;

// ---- Dates ----------------------------------------------------------------------

const DAY_MS = 86400000;
const parseDay = (iso: string) => new Date(`${iso}T00:00:00`);
const addDays = (iso: string, n: number) => {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
};
const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY_MS);
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
/** A reading's period as a day: a date as it is, a month ("2026-10") as its first. */
function readingDay(period: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(period)) return period.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
  return null;
}

const r1 = (n: number) => Math.round(n * 10) / 10 || 0;
const zero = (): PerGroup => ({ Back: 0, Chest: 0, Shoulders: 0, Arms: 0, Legs: 0, Core: 0 });
const plural = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;

// ---- One read of the store --------------------------------------------------------

/** A logged set, with what it counts toward. */
type LoggedSet = {
  assignmentId: number;
  day: string;
  ms: number;
  group: MuscleGroup | null;
  /** The exercise as done (a swap's library exercise; null for one typed in by name), and its variation, for strength. */
  exerciseKey: string | null;
  weight: number | null;
  reps: number | null;
  /** A set with reps or weight. */
  counts: boolean;
  /** weight × reps, when both are there. */
  volume: number;
};

type Ctx = {
  clientId: number;
  today: string;
  client: ClientRow | undefined;
  phases: Record<PhaseTrack, PhaseRow | null>;
  calendar: Map<string, ActivityDay>;
  days: ProgramDayRow[];
  byDay: Map<number, AssignmentRow[]>;
  logsByAssignment: Map<number, SetLogRow[]>;
  sets: LoggedSet[];
  /** Per day, the counted sets and the volume by group. */
  perDay: Map<string, { sets: PerGroup; volume: PerGroup }>;
  /** Weight readings, a day each, oldest first. */
  weights: { date: string; value: number }[];
  /** When each weight reading was saved (epoch ms; NaN for a reading saved before rows carried a stamp), by its day. */
  weightStamps: Map<string, number>;
  /** The client's metrics the workout answers (workoutFed): not check-ins, so never counted as one. Ids, and names. */
  fedIds: Set<number>;
  fedNames: Set<string>;
};

function context(clientId: number, today: string): Ctx {
  const data = getData();
  const client = data.clients.find((c) => c.id === clientId);
  const phases = Object.fromEntries(TRACK_ORDER.map((t) => [t, getCurrentPhase(clientId, t)])) as Record<PhaseTrack, PhaseRow | null>;

  const exercises = new Map(data.exercises.map((e) => [e.id, e] as const));
  // Asked once per exercise (it runs for every set): a coach's own group ("g-shoulders") counts by its name.
  const groupCache = new Map<number, MuscleGroup | null>();
  const groupOfExercise = (id: number | null | undefined): MuscleGroup | null => {
    if (id == null) return null;
    if (groupCache.has(id)) return groupCache.get(id)!;
    const e = exercises.get(id);
    let group: MuscleGroup | null = null;
    if (e) {
      const tag = (e.muscle_tags ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
      if (tag.startsWith("g-")) {
        const label = (coachGroups(e.coach_id).find((g) => g.slug === tag)?.label ?? tag.slice(2).replace(/-/g, " ")).trim().toLowerCase();
        group = TAG_GROUP[label] ?? TAG_GROUP[label.replace(/s$/, "")] ?? TAG_GROUP[`${label}s`] ?? (SHOULDER_NAME.test(label) ? "Shoulders" : null);
      } else {
        group = TAG_GROUP[tag] ?? null;
        if (group === "Arms" && tag === "arms" && SHOULDER_NAME.test(e.name ?? "")) group = "Shoulders";
      }
    }
    groupCache.set(id, group);
    return group;
  };
  const prescribedGroup = (a: AssignmentRow) => groupOfExercise(a.exercise_id);
  // What was done: a swap to a library exercise is that exercise; one typed in by name keeps the prescription's group.
  const doneGroup = (a: AssignmentRow) => (a.swap?.library_exercise_id != null ? groupOfExercise(a.swap.library_exercise_id) : prescribedGroup(a));
  const doneKey = (a: AssignmentRow): string | null => {
    if (a.swap) return a.swap.library_exercise_id != null ? `${a.swap.library_exercise_id}:` : null;
    return a.exercise_id && exercises.has(a.exercise_id) ? `${a.exercise_id}:${a.variation_id ?? ""}` : null;
  };

  const days = data.program_days.filter((d) => d.client_id === clientId);
  const dayIds = new Set(days.map((d) => d.id));
  const byDay = new Map<number, AssignmentRow[]>();
  const assignments = new Map<number, AssignmentRow>();
  for (const a of data.workout_assignments) {
    if (!dayIds.has(a.program_day_id)) continue;
    assignments.set(a.id, a);
    const list = byDay.get(a.program_day_id);
    if (list) list.push(a);
    else byDay.set(a.program_day_id, [a]);
  }
  const logsByAssignment = new Map<number, SetLogRow[]>();
  const sets: LoggedSet[] = [];
  const perDay = new Map<string, { sets: PerGroup; volume: PerGroup }>();
  for (const l of data.set_logs) {
    const a = assignments.get(l.workout_assignment_id);
    if (!a) continue;
    const list = logsByAssignment.get(a.id);
    if (list) list.push(l);
    else logsByAssignment.set(a.id, [l]);
    const weight = typeof l.weight_kg === "number" && Number.isFinite(l.weight_kg) ? l.weight_kg : null;
    const reps = typeof l.reps === "number" && Number.isFinite(l.reps) ? l.reps : null;
    const counts = (reps ?? 0) > 0 || (weight ?? 0) > 0;
    const volume = weight != null && reps != null && weight > 0 && reps > 0 ? weight * reps : 0;
    const day = stampDay(l.logged_at ?? "");
    const group = doneGroup(a);
    sets.push({ assignmentId: a.id, day, ms: stampMs(l.logged_at), group, exerciseKey: doneKey(a), weight, reps, counts, volume });
    if (group && counts) {
      let d = perDay.get(day);
      if (!d) perDay.set(day, (d = { sets: zero(), volume: zero() }));
      d.sets[group] += 1;
      d.volume[group] += volume;
    }
  }

  const byDate = new Map<string, number>();
  for (const p of getWeightSeriesAll(clientId)) {
    const date = readingDay(String(p.date ?? ""));
    const value = Number(p.value);
    if (date && Number.isFinite(value)) byDate.set(date, value);
  }
  const weights = [...byDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => (a.date < b.date ? -1 : 1));

  const fed = data.metric_definitions.filter((m) => m.client_id === clientId && workoutFed(clientId, m.name));

  return {
    clientId,
    today,
    client,
    phases,
    calendar: new Map(getActivityCalendar(clientId).map((d) => [d.date, d] as const)),
    days,
    byDay,
    logsByAssignment,
    sets,
    perDay,
    weights,
    weightStamps: weightStampsOf(data, clientId),
    fedIds: new Set(fed.map((m) => m.id)),
    fedNames: new Set(fed.map((m) => m.name)),
  };
}

/** When each weight reading was saved, from the same place getWeightSeriesAll reads the weight: the Weight measurement
    field if there is one, else the Weight metric (daily first, then weekly, then monthly). */
function weightStampsOf(data: Data, clientId: number): Map<string, number> {
  const out = new Map<string, number>();
  const field = data.measurement_fields
    .filter((f) => f.client_id === clientId)
    .sort((a, b) => a.order_index - b.order_index)
    .find((f) => f.name.toLowerCase().includes("weight"));
  if (field) {
    for (const v of data.measurement_values) if (v.field_id === field.id && v.value != null) out.set(v.date.slice(0, 10), stampMs(v.logged_at));
    return out;
  }
  const rank: Record<string, number> = { daily: 0, weekly: 1, monthly: 2 };
  const def = data.metric_definitions
    .filter((m) => m.client_id === clientId && m.name.toLowerCase().includes("weight"))
    .sort((a, b) => (rank[a.frequency] ?? 9) - (rank[b.frequency] ?? 9))[0];
  if (!def) return out;
  for (const e of data.metric_entries) {
    if (e.metric_definition_id !== def.id || e.value == null) continue;
    const day = readingDay(String(e.period ?? ""));
    if (day) out.set(day, stampMs(e.logged_at));
  }
  return out;
}

/** A part that fails reads as empty, never the whole board. */
function safe<T>(part: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (e) {
    console.error(`[homeBoard] ${part}:`, e);
    return fallback;
  }
}

// ---- The board ------------------------------------------------------------------------

export function getHomeBoard(clientId: number): HomeBoard {
  const today = localDateStr();
  const empty = emptyBoard(today);
  let ctx: Ctx;
  try {
    ctx = context(clientId, today);
  } catch (e) {
    console.error("[homeBoard] read:", e);
    return empty;
  }
  return {
    tracks: safe("tracks", () => tracksOf(ctx), empty.tracks),
    nextCall: safe("nextCall", () => nextCallOf(ctx), null),
    lastCall: safe("lastCall", () => lastCallOf(ctx), null),
    lastPaid: safe("lastPaid", () => lastPaidOf(ctx), null),
    outstanding: safe("outstanding", () => outstandingOf(ctx), null),
    nextInvoice: safe("nextInvoice", () => nextInvoiceOf(ctx), null),
    since: safe("since", () => sinceOf(ctx), null),
    muscles: safe("muscles", () => musclesOf(ctx), empty.muscles),
    strength: safe("strength", () => strengthOf(ctx), empty.strength),
    weight: safe("weight", () => weightOf(ctx), null),
    days: safe("days", () => thirtyDaysOf(ctx), empty.days),
    phaseDays: safe("phaseDays", () => phaseDaysOf(ctx), null),
  };
}

function emptyWindow(from: string, to: string): MuscleWindow {
  return { sets: zero(), prevSets: zero(), volume: zero(), prevVolume: zero(), from, to };
}

function emptyBoard(today: string): HomeBoard {
  return {
    tracks: TRACK_ORDER.map((track) => ({ track, phase: null, figure: null, note: null })),
    nextCall: null,
    lastCall: null,
    lastPaid: null,
    outstanding: null,
    nextInvoice: null,
    since: null,
    muscles: { "7d": emptyWindow(addDays(today, -6), today), "30d": emptyWindow(addDays(today, -29), today), phase: null },
    strength: { "7d": null, "30d": null, phase: null },
    weight: null,
    days: lastDays(today).map((date) => ({ date, trained: false, food: false, checkIn: false })),
    phaseDays: null,
  };
}

/** How many days Consistency shows (21 Oct, Alex: the last 30, not four weeks). */
const CONSISTENCY_DAYS = 30;
/** The last 30 days, today included, oldest first. */
const lastDays = (today: string) => Array.from({ length: CONSISTENCY_DAYS }, (_, i) => addDays(today, i - (CONSISTENCY_DAYS - 1)));

// ---- The three tracks ----------------------------------------------------------------------

function tracksOf(ctx: Ctx): HomeBoard["tracks"] {
  return TRACK_ORDER.map((track) => {
    const ph = ctx.phases[track];
    // A programme running with no training phase behind it (made before phases) is the phase: its name and weeks, never
    // "No phase" over its sessions (22 Oct).
    const prog = !ph && track === "training" ? safe("running programme", () => getDeployedProgram(ctx.clientId), null) : null;
    const phase = ph
      ? { name: ph.name, weekNow: phaseWeekIndex(ph.start_week, ph.end_week, ctx.today), weeks: phaseWeeks(ph.start_week, ph.end_week) }
      : prog
        ? { name: prog.name?.trim() || "Programme", weekNow: getProgramCurrentWeekIndex(prog), weeks: prog.total_weeks }
        : null;
    // No phase, no figure (22 Oct, Alex: "No phase" over "0 of 4 days checked in" read as a phase that wasn't there).
    const figure = phase ? safe(`figure ${track}`, () => (track === "lifestyle" ? lifestyleFigure(ctx) : track === "training" ? trainingFigure(ctx) : nutritionFigure(ctx)), null) : null;
    const note = track === "nutrition" ? safe("food note", () => foodNote(ctx), null) : null;
    return { track, phase, figure, note };
  });
}

/** Days this week, Monday to today, with a daily check-in: "3" + "of 4 days checked in". None asked daily: no figure.
    A metric the workout answers (enjoyment, adherence) is not a check-in: the client never fills it in as one. */
function lifestyleFigure(ctx: Ctx): { value: string; suffix: string } | null {
  const data = getData();
  const running = ctx.phases.lifestyle?.id ?? null;
  const asked = data.metric_definitions.filter(
    (m) => m.client_id === ctx.clientId && m.frequency === "daily" && m.visible_to_client !== false && (m.phase_id == null || m.phase_id === running) && !ctx.fedIds.has(m.id)
  );
  if (!asked.length) return null;
  const ids = new Set(asked.map((m) => m.id));
  // Across the phase (21 Oct, Alex): its days so far, today included (week 2, day 2: of 9); no phase, this week's.
  const start = ctx.phases.lifestyle?.start_week;
  const monday = start && start <= ctx.today ? start : weekStart(ctx.today);
  const soFar = daysBetween(monday, ctx.today) + 1;
  const seen = new Set<string>();
  for (const e of data.metric_entries) {
    if (!ids.has(e.metric_definition_id) || e.value == null) continue;
    const day = (e.period ?? "").slice(0, 10);
    if (day >= monday && day <= ctx.today) seen.add(day);
  }
  return { value: String(seen.size), suffix: `of ${soFar} ${plural(soFar, "day")} checked in` };
}

/** This week's sessions as the overview counts them: one with an exercise is planned, one with a set logged is trained. */
function trainingFigure(ctx: Ctx): { value: string; suffix: string } | null {
  const program = getDeployedProgram(ctx.clientId);
  if (!program) return null;
  const week = program.start_week + getProgramCurrentWeekIndex(program) - 1;
  let planned = 0;
  let trained = 0;
  for (const d of getWeek(ctx.clientId, week)) {
    const as = ctx.byDay.get(d.id) ?? [];
    if (!as.length) continue;
    planned++;
    if (as.some((a) => (ctx.logsByAssignment.get(a.id)?.length ?? 0) > 0)) trained++;
  }
  if (!planned) return null;
  return { value: String(trained), suffix: `of ${planned} ${plural(planned, "session")} this week` };
}

/** The training day's target: "2,900 kcal" + "P 200 | C 300 | F 80". */
function nutritionFigure(ctx: Ctx): { value: string; suffix: string } | null {
  const s = getNutritionGoalsSummary(ctx.clientId);
  const kcal = Math.round(Number(s.trainingKcal) || 0);
  if (kcal <= 0) return null;
  return { value: `${kcal.toLocaleString("en-US")} kcal`, suffix: `P ${s.trainingProtein} | C ${s.trainingCarbs} | F ${s.trainingFats}` };
}

/** What they ate on the last 7 days with food before today (today is still being logged), within the last four weeks
    (an older average says nothing about now). */
function foodNote(ctx: Ctx): string | null {
  const from = addDays(ctx.today, -27);
  const kcal = [...ctx.calendar.values()]
    .filter((d) => d.date >= from && d.date < ctx.today && d.food && d.food.kcal > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 7)
    .map((d) => d.food!.kcal);
  if (!kcal.length) return null;
  return `logged avg ${Math.round(kcal.reduce((t, k) => t + k, 0) / kcal.length).toLocaleString("en-US")}`;
}

// ---- The facts beside the tiles ------------------------------------------------------------

type CallRow = ReturnType<typeof listMeetings>[number];
/** A call's title as the Meetings tab shows it: the recap's title once written, else the topic, else the kind's name. */
const callTitle = (m: CallRow) =>
  m.summary_title?.trim() || m.topic?.trim() || (m.meeting_type === "review" ? "Review call" : m.meeting_type === "other" ? "Call" : "Check-in call");

function nextCallOf(ctx: Ctx): HomeBoard["nextCall"] {
  const next = listMeetings(ctx.clientId)
    .filter((m) => m.status === "scheduled" && m.date >= ctx.today)
    .sort((a, b) => (a.date === b.date ? (a.time ?? "").localeCompare(b.time ?? "") : a.date < b.date ? -1 : 1))[0];
  if (!next) return null;
  return { date: next.date, time: next.all_day ? null : (next.time ?? "").trim() || null, title: callTitle(next) };
}

/** The most recent call that is over: held (completed) or missed (no-show), on or before today. */
function lastCallOf(ctx: Ctx): HomeBoard["lastCall"] {
  // listMeetings comes newest first (by day, then time).
  const last = listMeetings(ctx.clientId).find((m) => (m.status === "completed" || m.status === "no-show") && m.date <= ctx.today);
  if (!last) return null;
  return { date: last.date, title: callTitle(last), missed: last.status === "no-show" };
}

/** The next invoice a series of theirs will make (not paused, the earliest next), at its total as the Invoices tab has it. */
function nextInvoiceOf(ctx: Ctx): HomeBoard["nextInvoice"] {
  const next = invoiceRepeatViews(ctx.clientId)
    .filter((r) => !r.paused && /^\d{4}-\d{2}-\d{2}$/.test(r.next))
    .sort((a, b) => (a.next < b.next ? -1 : a.next > b.next ? 1 : 0))[0];
  if (!next) return null;
  return { date: next.next, amount: next.total, currency: next.currency, every: next.every };
}

/** The coach's invoicing currency, for an invoice that carries none. */
function coachCurrency(ctx: Ctx): string {
  const s = getCoachSettings(ctx.client?.coach_id ?? 0);
  return invoicingFor(s.business ?? {}, s.invoicing ?? {}).currency;
}

function outstandingOf(ctx: Ctx): HomeBoard["outstanding"] {
  const owed = getData().invoices.filter((i) => i.client_id === ctx.clientId && (i.status === "sent" || i.status === "due"));
  if (!owed.length) return null;
  const amount = Math.round(owed.reduce((t, i) => t + (Number(i.amount) || 0), 0) * 100) / 100;
  const currency = owed.find((i) => i.currency)?.currency ?? coachCurrency(ctx);
  return { amount, currency, count: owed.length };
}

/** Their latest paid invoice: on the day it was paid (local), else its issue day (an older invoice: the day it was made). */
function lastPaidOf(ctx: Ctx): HomeBoard["lastPaid"] {
  let last: { date: string; ms: number; id: number; amount: number; currency: string | undefined } | null = null;
  for (const i of getData().invoices) {
    if (i.client_id !== ctx.clientId || i.status !== "paid") continue;
    const date = i.paid_at ? stampDay(i.paid_at) : (i.issue_date || stampDay(i.created_at ?? "")).slice(0, 10);
    if (!PLAIN_DAY.test(date)) continue;
    const ms = stampMs(i.paid_at);
    const row = { date, ms: Number.isFinite(ms) ? ms : 0, id: i.id, amount: Math.round((Number(i.amount) || 0) * 100) / 100, currency: i.currency || undefined };
    // The later day wins; on one day, the later stamp, then the later invoice.
    if (!last || row.date > last.date || (row.date === last.date && (row.ms > last.ms || (row.ms === last.ms && row.id > last.id)))) last = row;
  }
  if (!last) return null;
  return { date: last.date, amount: last.amount, currency: last.currency ?? coachCurrency(ctx) };
}

// ---- Since the coach last looked ------------------------------------------------------------

function sinceOf(ctx: Ctx): HomeBoard["since"] {
  const prev = ctx.client?.home_looked?.prev;
  if (prev == null || !Number.isFinite(prev)) return null;
  const data = getData();
  const from = localDateStr(new Date(prev));

  // Sessions ended since, and those completed by their sets since (never ended, every set in).
  let sessions = 0;
  for (const d of ctx.days) {
    if (d.session_ended_at) {
      if (stampMs(d.session_ended_at) > prev) sessions++;
      continue;
    }
    const as = ctx.byDay.get(d.id) ?? [];
    const last = Math.max(-Infinity, ...as.flatMap((a) => (ctx.logsByAssignment.get(a.id) ?? []).map((l) => stampMs(l.logged_at)).filter(Number.isFinite)));
    if (last > prev && isSessionComplete(d.id)) sessions++;
  }

  // Anything saved after the look counts, by its stamp; a row saved before rows carried one, by its day (after the look's).
  const savedSince = (at: string | null | undefined, day: string) => (at && Number.isFinite(stampMs(at)) ? stampMs(at) > prev : day > from);

  // Days with a check-in sent since: a daily reading on its day, a weekly or monthly one on the day it was sent (as
  // Consistency counts them), a measurement on its date. What the workout answers is not a check-in.
  const checkInDays = new Set<string>();
  const defs = new Map(data.metric_definitions.filter((m) => m.client_id === ctx.clientId && !ctx.fedIds.has(m.id)).map((m) => [m.id, m] as const));
  for (const e of data.metric_entries) {
    const def = defs.get(e.metric_definition_id);
    if (!def || e.value == null) continue;
    if (def.frequency === "daily") {
      const day = (e.period ?? "").slice(0, 10);
      if (day <= ctx.today && savedSince(e.logged_at, day)) checkInDays.add(day);
    } else if (e.logged_at && stampMs(e.logged_at) > prev) checkInDays.add(stampDay(e.logged_at));
  }
  const fields = new Set(data.measurement_fields.filter((f) => f.client_id === ctx.clientId).map((f) => f.id));
  for (const v of data.measurement_values) {
    if (fields.has(v.field_id) && v.value != null && v.date <= ctx.today && savedSince(v.logged_at, v.date)) checkInDays.add(v.date.slice(0, 10));
  }

  // Days with food logged since: a diary entry, or a typed day's calories.
  const food = new Set<string>();
  for (const f of data.food_entries) if (f.client_id === ctx.clientId && f.date <= ctx.today && savedSince(f.logged_at, f.date)) food.add(f.date);
  for (const c of data.calorie_logs) if (c.client_id === ctx.clientId && c.kcal > 0 && c.date <= ctx.today && savedSince(c.logged_at, c.date)) food.add(c.date);

  const messages = data.chat_messages.filter((m) => m.client_id === ctx.clientId && m.sender === "client" && (m.text?.trim() || m.media_path) && stampMs(m.created_at) > prev).length;

  // The latest weigh-in saved since, against the reading before it that was already in; none since, no change.
  const upToToday = ctx.weights.filter((w) => w.date <= ctx.today);
  const isNew = (w: { date: string }) => {
    const at = ctx.weightStamps.get(w.date);
    return at != null && Number.isFinite(at) ? at > prev : w.date > from;
  };
  const latest = upToToday.filter(isNew).at(-1) ?? null;
  const base = latest ? upToToday.filter((w) => w.date < latest.date && !isNew(w)).at(-1) ?? null : null;
  const weightChange = latest && base ? r1(latest.value - base.value) : null;

  return { from, sessions, checkIns: checkInDays.size, foodDays: food.size, messages, weightChange };
}

// ---- Muscle balance -----------------------------------------------------------------------------

function sumDays(ctx: Ctx, from: string, to: string): { sets: PerGroup; volume: PerGroup } {
  const sets = zero();
  const volume = zero();
  for (const [day, d] of ctx.perDay) {
    if (day < from || day > to) continue;
    for (const g of GROUPS) {
      sets[g] += d.sets[g];
      volume[g] += d.volume[g];
    }
  }
  for (const g of GROUPS) volume[g] = Math.round(volume[g]);
  return { sets, volume };
}

/** from..to against the same number of days just before it. */
function windowOf(ctx: Ctx, from: string, to: string): MuscleWindow {
  const n = daysBetween(from, to) + 1;
  const cur = sumDays(ctx, from, to);
  const before = sumDays(ctx, addDays(from, -n), addDays(from, -1));
  return { sets: cur.sets, prevSets: before.sets, volume: cur.volume, prevVolume: before.volume, from, to };
}

function musclesOf(ctx: Ctx): HomeBoard["muscles"] {
  const { today } = ctx;
  const training = ctx.phases.training;
  return {
    "7d": windowOf(ctx, addDays(today, -6), today),
    "30d": windowOf(ctx, addDays(today, -29), today),
    phase: training && training.start_week <= today ? windowOf(ctx, training.start_week, today) : null,
  };
}

// ---- Strength --------------------------------------------------------------------------------------

/** Each exercise's % change to one window: per group, their mean (one decimal), best group first. Null with none. */
function strengthWindow(since: string, changes: { group: MuscleGroup; pct: number }[]): StrengthWindow | null {
  const byGroup = new Map<MuscleGroup, number[]>();
  for (const c of changes) {
    const list = byGroup.get(c.group);
    if (list) list.push(c.pct);
    else byGroup.set(c.group, [c.pct]);
  }
  const groups = GROUPS.filter((g) => byGroup.has(g))
    .map((g) => {
      const pcts = byGroup.get(g)!;
      // One decimal: the screen shows +3.4% under 10%, and a real +0.4% is not 0.
      return { group: g, pct: r1(pcts.reduce((t, p) => t + p, 0) / pcts.length), exercises: pcts.length };
    })
    .sort((a, b) => b.pct - a.pct);
  return groups.length ? { since, groups } : null;
}

function strengthOf(ctx: Ctx): HomeBoard["strength"] {
  const { today } = ctx;
  const phaseSince = ctx.phases.training?.start_week ?? addDays(today, -55);
  // The 30 days before the last 30 is the furthest back a rolling window reads.
  const rollBack = addDays(today, -59);
  const earliest = phaseSince < rollBack ? phaseSince : rollBack;
  // One pass over the sets: each exercise's best estimated one-rep max a day (Epley).
  const best = new Map<string, { group: MuscleGroup; byDay: Map<string, number> }>();
  for (const s of ctx.sets) {
    if (!s.group || !s.exerciseKey || s.day < earliest || s.day > today) continue;
    if (s.weight == null || s.reps == null || !(s.weight > 0) || !(s.reps > 0)) continue;
    const e1rm = s.weight * (1 + s.reps / 30);
    let ex = best.get(s.exerciseKey);
    if (!ex) best.set(s.exerciseKey, (ex = { group: s.group, byDay: new Map() }));
    if (e1rm > (ex.byDay.get(s.day) ?? 0)) ex.byDay.set(s.day, e1rm);
  }
  const exercises = [...best.values()];

  // 7d and 30d: this window's best against the window just before's (the same length), for exercises done in both.
  const rolling = (n: number): StrengthWindow | null => {
    const from = addDays(today, -(n - 1));
    const prevFrom = addDays(from, -n);
    const changes: { group: MuscleGroup; pct: number }[] = [];
    for (const ex of exercises) {
      let cur = 0;
      let prev = 0;
      for (const [day, v] of ex.byDay) {
        if (day >= from) cur = Math.max(cur, v);
        else if (day >= prevFrom) prev = Math.max(prev, v);
      }
      if (cur > 0 && prev > 0) changes.push({ group: ex.group, pct: ((cur - prev) / prev) * 100 });
    }
    return strengthWindow(from, changes);
  };

  // Phase: since the training phase began (else the last 8 weeks), each exercise's first day against its latest.
  const phaseChanges: { group: MuscleGroup; pct: number }[] = [];
  for (const ex of exercises) {
    const days = [...ex.byDay.keys()].filter((d) => d >= phaseSince).sort();
    if (days.length < 2) continue;
    const first = ex.byDay.get(days[0])!;
    const last = ex.byDay.get(days[days.length - 1])!;
    if (!(first > 0)) continue;
    phaseChanges.push({ group: ex.group, pct: ((last - first) / first) * 100 });
  }

  // No training phase, no Phase window (22 Oct: it was quietly the last 8 weeks under the word Phase), as Muscle balance.
  return { "7d": rolling(7), "30d": rolling(30), phase: ctx.phases.training ? strengthWindow(phaseSince, phaseChanges) : null };
}

// ---- Weight ----------------------------------------------------------------------------------------

function weightOf(ctx: Ctx): HomeBoard["weight"] {
  const upToToday = ctx.weights.filter((w) => w.date <= ctx.today);
  if (!upToToday.length) return null;
  const phase = ctx.phases.nutrition ?? ctx.phases.training ?? ctx.phases.lifestyle;
  const since = phase?.start_week ?? addDays(ctx.today, -55);
  const points = upToToday.filter((w) => w.date >= since).map((w) => ({ date: w.date, value: r1(w.value) }));
  const latest = upToToday[upToToday.length - 1];
  const now = r1(latest.value);

  // What they weighed going in: the reading nearest the span's first day, either side, within a month (as the overview reads it).
  const startMs = parseDay(since).getTime();
  const nearest = upToToday.reduce((b, w) => (Math.abs(parseDay(w.date).getTime() - startMs) < Math.abs(parseDay(b.date).getTime() - startMs) ? w : b));
  const change = Math.abs(parseDay(nearest.date).getTime() - startMs) <= 31 * DAY_MS && nearest.date !== latest.date ? r1(latest.value - nearest.value) : null;

  // Where the rate so far lands on the phase's last day: a least-squares line through the phase's points. Only with a
  // real trend (4+ readings across two weeks or more), and never further ahead than twice the span read: a few days of
  // water stretched across a 12-week phase says nothing.
  let projection: { date: string; value: number } | null = null;
  const lastDay = phase ? phaseLastDay(phase.end_week) : null;
  const span = points.length ? daysBetween(points[0].date, points[points.length - 1].date) : 0;
  if (lastDay && lastDay > ctx.today && points.length >= 4 && span >= 14 && daysBetween(ctx.today, lastDay) <= span * 2) {
    const xs = points.map((p) => daysBetween(since, p.date));
    const ys = points.map((p) => p.value);
    const n = points.length;
    const sx = xs.reduce((t, x) => t + x, 0);
    const sy = ys.reduce((t, y) => t + y, 0);
    const sxy = xs.reduce((t, x, i) => t + x * ys[i], 0);
    const sxx = xs.reduce((t, x) => t + x * x, 0);
    const den = n * sxx - sx * sx;
    if (den !== 0) {
      const slope = (n * sxy - sx * sy) / den;
      const intercept = (sy - slope * sx) / n;
      const value = intercept + slope * daysBetween(since, lastDay);
      if (Number.isFinite(value)) projection = { date: lastDay, value: r1(value) };
    }
  }
  return { points, now, change, since, projection };
}

// ---- Consistency ------------------------------------------------------------------------------------

/** Trained: a counted set logged that day (as the training tile counts a session), or a session the calendar has on it
    (ended there, done in full, or kept from before a coach's edit). Checked in: anything but what the workout answers. */
function daysOf(ctx: Ctx, dates: string[] = lastDays(ctx.today)): HomeBoard["days"] {
  const setDays = new Set(ctx.sets.filter((s) => s.counts).map((s) => s.day));
  return dates.map((date) => {
    const d = ctx.calendar.get(date);
    return { date, trained: !!d?.sessions.length || setDays.has(date), food: !!d?.food, checkIn: !!d?.checkIns.some((n) => !ctx.fedNames.has(n)) };
  });
}

/** The 30 days (21 Oct, Alex: the last 30). A client newer than that starts at the left (23 Oct, Alex: their first
    day sat at the far right): from their first day (as Business counts it, or an earlier day with something on it), the
    days still to come quieter, filling in as they pass, as a young phase does. */
function thirtyDaysOf(ctx: Ctx): HomeBoard["days"] {
  const last = daysOf(ctx);
  const floor = last[0].date;
  const start = clientStartDay(ctx.clientId);
  if (!start || start <= floor) return last;
  const firstActive = last.find((d) => d.trained || d.food || d.checkIn)?.date;
  let since = firstActive && firstActive < start ? firstActive : start;
  if (since > ctx.today) since = ctx.today;
  if (since <= floor) return last;
  const dates: string[] = [];
  for (let d = since; d <= ctx.today; d = addDays(d, 1)) dates.push(d);
  const ahead: ConsistencyDay[] = [];
  for (let d = addDays(ctx.today, 1); dates.length + ahead.length < CONSISTENCY_DAYS; d = addDays(d, 1)) ahead.push({ date: d, trained: false, food: false, checkIn: false, future: true });
  return [...daysOf(ctx, dates), ...ahead];
}

/** The phase for the consistency strip: the live ones together, from the earliest first day to the latest last day.
    Up to 8 weeks it goes by day, from its first day (at most 120 days back) to today; longer, by week (21 Oct, Alex). */
const PHASE_DAYS_MAX = 120;
const PHASE_BY_DAY_MAX = 56;
const PHASE_WEEKS_MAX = 53;
function phaseDaysOf(ctx: Ctx): HomeBoard["phaseDays"] {
  const live = [ctx.phases.lifestyle, ctx.phases.training, ctx.phases.nutrition].filter((p): p is PhaseRow => !!p && p.start_week <= ctx.today);
  if (!live.length) return null;
  const starts = live.map((p) => p.start_week).sort();
  const ends = live.map((p) => phaseLastDay(p.end_week)).sort();
  const first = starts[0];
  const last = ends[ends.length - 1] < ctx.today ? ctx.today : ends[ends.length - 1];
  if (daysBetween(first, last) + 1 > PHASE_BY_DAY_MAX) return { since: first, by: "week", weeks: weeksOf(ctx, first, last) };
  const floor = addDays(ctx.today, -(PHASE_DAYS_MAX - 1));
  const since = first < floor ? floor : first;
  const dates: string[] = [];
  for (let d = since; d <= ctx.today; d = addDays(d, 1)) dates.push(d);
  // Always 30 at least: a young phase runs on into the days still to come, empty, filling in as they pass.
  const ahead: ConsistencyDay[] = [];
  for (let d = addDays(ctx.today, 1); dates.length + ahead.length < CONSISTENCY_DAYS; d = addDays(d, 1)) ahead.push({ date: d, trained: false, food: false, checkIn: false, future: true });
  return { since, by: "day", days: [...daysOf(ctx, dates), ...ahead] };
}

/** Every week (Monday to Sunday) of a long phase, the weeks to come included: of its days in the phase up to today, how
    many had each. Over a year, the 53 weeks up to this one. */
function weeksOf(ctx: Ctx, since: string, until: string): ConsistencyWeek[] {
  const firstMonday = weekStart(since);
  const thisMonday = weekStart(ctx.today);
  let from = firstMonday;
  const yearBack = addDays(thisMonday, -7 * (PHASE_WEEKS_MAX - 1));
  if (from < yearBack) from = yearBack;
  const weeks: ConsistencyWeek[] = [];
  for (let monday = from; monday <= until && weeks.length < PHASE_WEEKS_MAX; monday = addDays(monday, 7)) {
    const week = Math.round(daysBetween(firstMonday, monday) / 7) + 1;
    if (monday > ctx.today) {
      weeks.push({ start: monday, week, days: 0, trained: 0, food: 0, checkIn: 0, future: true });
      continue;
    }
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      if (d >= since && d <= until && d <= ctx.today) dates.push(d);
    }
    const flags = daysOf(ctx, dates);
    weeks.push({
      start: monday,
      week,
      days: dates.length,
      trained: flags.filter((f) => f.trained).length,
      food: flags.filter((f) => f.food).length,
      checkIn: flags.filter((f) => f.checkIn).length,
    });
  }
  return weeks;
}

// ---- The coach's look -------------------------------------------------------------------------------

/**
 * The coach has this client on screen (loadHome, any of their tabs): a look more than 30 minutes after the last starts a
 * new visit, and the visit before becomes what "Since" counts from. Call before getHomeBoard: a new visit moves the last
 * look into prev first, so the board counts from the previous visit on its first render too (and on every re-read in it).
 */
export function noteHomeLooked(clientId: number): void {
  try {
    const client = getData().clients.find((c) => c.id === clientId);
    if (!client) return;
    const now = Date.now();
    const had = client.home_looked;
    if (!had || !Number.isFinite(had.at) || now - had.at > VISIT_GAP_MS) {
      client.home_looked = { at: now, prev: had && Number.isFinite(had.at) ? had.at : null };
      persist();
    } else if (now - had.at >= LOOK_STEP_MS) {
      client.home_looked = { at: now, prev: had.prev ?? null };
      persist();
    }
  } catch (e) {
    console.error("[homeBoard] noteHomeLooked:", e);
  }
}
