// Weight goals (2 Nov, Alex: "a goal for the weight… how far away are we and if we are on track"; mockup B + C,
// docs/boards/weight-goal-mockup.html). A goal is a weight by a date. A planned straight line runs from where the
// client was when it was set (start_kg on start_date) to the goal (target_kg on by_date); a milestone set after
// another starts where that one ends. The client's last 7 days' average is held against where that line is today:
// it is the plan they agreed on, not a forecast (no prediction, 23 Oct).
//
// Pure: no store, no queries. The coach's and the client's screens and the server all read it.

/** The weight goal's own colour and mark (2 Nov, Alex): lifestyle beige and a target. */
export const GOAL_COLOR = "#a08a5c";
export const GOAL_TINT = "#efede6";
export const GOAL_RGB = "160,138,92";
/** The target: two rings and a dot, drawn in a 24 box at stroke 1.6, round, no fill. */
export const TARGET_ICON = "M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16zM12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8zM12 12h.01";

/** Within this of the planned line reads On track. */
export const ON_TRACK_BAND_KG = 0.8;
/** Under this much change a goal holds its weight rather than losing or gaining. */
const HOLD_KG = 0.5;
/** Days after its date a goal waits for a late weigh-in before it is settled. */
const SETTLE_DAYS = 3;
/** No reading for this long: no verdict. Longer for a client asked weekly or monthly (by the gaps between their readings). */
const staleDaysOf = (readings: { date: string }[]) => {
  const gaps = readings.slice(-5).map((r, i, a) => (i ? daysBetween(a[i - 1].date, r.date) : 0)).slice(1).sort((x, y) => x - y);
  const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 1;
  return typical >= 20 ? 40 : typical >= 5 ? 21 : 14;
};

export type WeightGoalVerdict = "on" | "ahead" | "behind" | "early" | "reached" | "missed" | "stale";
export const VERDICT_WORD: Record<WeightGoalVerdict, string> = {
  on: "On track",
  ahead: "Ahead",
  behind: "Behind",
  early: "Too early",
  reached: "Reached",
  missed: "Missed",
  stale: "No weigh-in",
};
/** good green, warn rust, plain grey: the state pill's and the verdict word's tone. */
export const VERDICT_TONE: Record<WeightGoalVerdict, "good" | "warn" | ""> = {
  on: "good",
  ahead: "good",
  reached: "good",
  behind: "warn",
  early: "",
  missed: "",
  stale: "",
};

/** What a goal is, as stored (the fields the rule needs). */
export type WeightGoalLike = {
  id: number;
  target_kg: number;
  unit: "kg" | "lbs";
  by_date: string;
  start_kg: number;
  start_date: string;
  added_by: "coach" | "client";
  added_by_id: number | null;
  note: string;
};

/** A goal as every screen reads it: all weights in kg, plain JSON. */
export type WeightGoalView = {
  id: number;
  targetKg: number;
  /** How it was typed, for the form. */
  unit: "kg" | "lbs";
  byDate: string;
  startKg: number;
  startDate: string;
  addedBy: "coach" | "client";
  addedById: number | null;
  note: string;
  /** The goal being worked on now: the earliest not yet reached or missed. One at a time. */
  active: boolean;
  /** Reached or missed. */
  settled: boolean;
  /** The active goal's verdict, and a settled one's (reached / missed); a later milestone has none. */
  verdict: WeightGoalVerdict | null;
  /** The last 7 days' average, kg. */
  nowKg: number | null;
  /** Where the planned line is on that average's day, kg. */
  planNowKg: number | null;
  /** Left to go from the average to the goal, kg (0 once past it). */
  toGoKg: number | null;
  /** The day it was reached. */
  reachedOn: string | null;
  /** How far off it ended, kg, when missed. */
  missedByKg: number | null;
  /** Share of start → goal covered by the average, 0..1. */
  done: number;
  /** Share of start date → goal date gone by today, 0..1. */
  elapsed: number;
};

const DAY = 86_400_000;
const dayMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDaysIso = (iso: string, n: number) => isoOf(dayMs(iso) + n * DAY);
export const daysBetween = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The planned line's weight on a day: the start before it begins, the goal once its date is past. */
export function planKgAt(g: { startKg: number; startDate: string; targetKg: number; byDate: string }, day: string): number {
  const span = daysBetween(g.startDate, g.byDate);
  if (span <= 0) return g.targetKg;
  const t = clamp01(daysBetween(g.startDate, day) / span);
  return g.startKg + (g.targetKg - g.startKg) * t;
}

/** -1 to lose, +1 to gain, 0 to hold. */
const dirOf = (startKg: number, targetKg: number) => (Math.abs(targetKg - startKg) < HOLD_KG ? 0 : targetKg < startKg ? -1 : 1);

type Reading = { date: string; kg: number };

/** The average of the readings in the 7 days up to `day` (or a window of days), and the average of their days. */
function meanUpTo(readings: Reading[], day: string, from?: string): { kg: number; day: string; n: number } | null {
  const lo = from ?? addDaysIso(day, -6);
  const inWin = readings.filter((r) => r.date >= lo && r.date <= day);
  if (!inWin.length) return null;
  const kg = inWin.reduce((s, r) => s + r.kg, 0) / inWin.length;
  const ms = inWin.reduce((s, r) => s + dayMs(r.date), 0) / inWin.length;
  return { kg, day: isoOf(Math.round(ms / DAY) * DAY), n: inWin.length };
}

// A hold goal is met within the same band it reads On track in, so On track all along never ends Missed.
const meets = (dir: number, kg: number, target: number) => (dir < 0 ? kg <= target : dir > 0 ? kg >= target : Math.abs(kg - target) <= ON_TRACK_BAND_KG);

/** Every goal of a client, read against their weigh-ins (kg, any order) on `today`, by date. */
export function weightGoalViews(goals: WeightGoalLike[], readingsIn: Reading[], today: string): WeightGoalView[] {
  const readings = [...readingsIn].filter((r) => r.date <= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const latest = readings.at(-1) ?? null;
  const now = latest ? meanUpTo(readings, latest.date) : null;
  let activeTaken = false;
  return [...goals]
    .sort((a, b) => (a.by_date < b.by_date ? -1 : a.by_date > b.by_date ? 1 : a.id - b.id))
    .map((g): WeightGoalView => {
      const base = { id: g.id, targetKg: g.target_kg, unit: g.unit, byDate: g.by_date, startKg: g.start_kg, startDate: g.start_date, addedBy: g.added_by, addedById: g.added_by_id, note: g.note };
      const line = { startKg: g.start_kg, startDate: g.start_date, targetKg: g.target_kg, byDate: g.by_date };
      const dir = dirOf(g.start_kg, g.target_kg);
      const settleDay = addDaysIso(g.by_date, SETTLE_DAYS);
      // Reached: the first weigh-in day, from its start to its settling, whose 7-day average meets the goal (a hold
      // goal only on its date). The whole 7 days, readings before the start too, so one low weigh-in on the day a goal
      // is set never settles it. It stays reached.
      let reachedOn: string | null = null;
      if (dir !== 0) {
        for (const r of readings) {
          if (r.date < g.start_date || r.date > settleDay) continue;
          const m = meanUpTo(readings, r.date);
          if (m && meets(dir, m.kg, g.target_kg)) {
            reachedOn = r.date > g.by_date ? g.by_date : r.date;
            break;
          }
        }
      }
      // Past its settling and not reached: read on the readings round its date.
      let missedByKg: number | null = null;
      let missed = false;
      if (!reachedOn && today > settleDay) {
        const end = meanUpTo(readings, settleDay, addDaysIso(g.by_date, -SETTLE_DAYS));
        if (end && meets(dir, end.kg, g.target_kg)) reachedOn = g.by_date;
        else {
          missed = true;
          missedByKg = end ? r2(Math.abs(end.kg - g.target_kg)) : null;
        }
      }
      const settled = !!reachedOn || missed;
      const active = !settled && !activeTaken;
      if (active) activeTaken = true;
      const nowKg = now ? r2(now.kg) : null;
      const planNowKg = now ? r2(planKgAt(line, now.day)) : null;
      const toGoKg = now == null ? null : dir === 0 ? r2(Math.abs(now.kg - g.target_kg)) : r2(Math.max(0, (now.kg - g.target_kg) * -dir));
      const span = g.start_kg - g.target_kg;
      const done = now && Math.abs(span) >= 0.01 ? clamp01((g.start_kg - now.kg) / span) : reachedOn ? 1 : 0;
      const elapsed = clamp01(daysBetween(g.start_date, today) / Math.max(1, daysBetween(g.start_date, g.by_date)));
      let verdict: WeightGoalVerdict | null = null;
      if (reachedOn) verdict = "reached";
      else if (missed) verdict = "missed";
      else if (active) {
        const since = readings.filter((r) => r.date >= g.start_date);
        if (!latest || daysBetween(latest.date, today) > staleDaysOf(readings)) verdict = "stale";
        // Too early: under a week in, or nothing weighed since it was set.
        else if (daysBetween(g.start_date, today) < 7 || since.length < 1 || !now) verdict = "early";
        else if (dir === 0) verdict = Math.abs(now.kg - g.target_kg) <= ON_TRACK_BAND_KG ? "on" : "behind";
        else {
          const gap = (now.kg - planKgAt(line, now.day)) * dir;
          verdict = gap > ON_TRACK_BAND_KG ? "ahead" : gap < -ON_TRACK_BAND_KG ? "behind" : "on";
        }
      }
      return { ...base, active, settled, verdict, nowKg, planNowKg, toGoKg, reachedOn, missedByKg, done: reachedOn ? 1 : done, elapsed };
    });
}

/** The goal shown when one is shown: the active one, else the latest settled. */
export const currentGoal = (views: WeightGoalView[]): WeightGoalView | null => views.find((v) => v.active) ?? views.filter((v) => v.settled).at(-1) ?? null;

// ---- Units: stored in kg; shown in a screen's unit to one decimal, "82 kg", "180.5 lbs".
const KG_PER_LB = 0.45359237;
export const kgIn = (kg: number, unit: "kg" | "lbs") => Math.round((unit === "lbs" ? kg / KG_PER_LB : kg) * 10) / 10;
export const kgFrom = (v: number, unit: "kg" | "lbs") => (unit === "lbs" ? v * KG_PER_LB : v);
export const goalWeightText = (kg: number, unit: "kg" | "lbs") => `${kgIn(kg, unit)} ${unit}`;

// ---- The client's timelines (Events, Home's row): a goal is a one-day item whose id is out of the events' and
// phases' range (events positive, phases -id, unsaved ones -Date.now(), the today row 0).
export const GOAL_ITEM_BASE = -1_000_000_000;
export const goalItemId = (goalId: number) => GOAL_ITEM_BASE - goalId;
export const goalIdOfItem = (itemId: number) => (itemId <= GOAL_ITEM_BASE && itemId > GOAL_ITEM_BASE * 2 ? GOAL_ITEM_BASE - itemId : null);
