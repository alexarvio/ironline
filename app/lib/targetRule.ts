import { isAssisted } from "./progressRules";

// The weight goal that writes itself forward, in one place: the server that moves the weights (progressTargetFromLogs,
// queries.ts) and the Apply confirm that says what a copy will land as (applyPreviewData.ts) both read it, so the list
// and the button never disagree with what the server does.
//
// A logged row that meets its weight moves every later occurrence of the exercise up to what was lifted (the least, on
// an assisted lift, whose kg is help). Each gym is a lane of its own: the home gym's weight is target_weight_kg, another
// gym's its entry in gym_targets.
//
// A weight the coach sets while the client is logging the exercise is a reset point for its lane (23 Oct, Alex: "if I
// set a new one in week 4, I want that weight to override any count the system was taking into account from previous
// weights"). Lifts from before it never move a row after it (stopAfter); its number goes on to the rows after it
// (carryReset, queries.ts); from it on, what the client lifts moves them again.
//
// A weight moves up only on a set that is heavier and in the range (4 Nov, Alex: "it has to have a higher weight, but it
// also needs to be within the range"; 10 Nov, Alex: "keep it within rep range"): a set counts only when its reps sit
// inside the logged row's target reps (repWindow), so 70 kg × 8 and 70 kg × 15 against 10–12 move nothing, and a single
// figure is a goal to reach (12 or more against "12"). And the coach's own figure is kept beside a raised one (coach_kg,
// set at the first raise, cleared when the coach types the weight again), so the Apply confirm compares the coach's
// numbers alone (applyPreviewData.ts) and never reads the rule's raise as a change of theirs.

/** A gym lane: null is the home gym, a gym id that gym. */
export type Lane = number | null;

/**
 * `coach_kg`: the coach's own figure before the rule first raised this weight (null: none of theirs; on a gym, it
 * followed the home weight). Absent while the weight is the coach's own.
 */
type GymEntry = { kg: number | null; set_at?: string | null; pinned?: boolean; coach_kg?: number | null };
/** A row's weights, as stored. `coach_kg` as a gym entry's, for the home lane. */
export type Weights = { target_weight_kg: number | null; target_set_at?: string | null; target_pinned?: boolean; coach_kg?: number | null; gym_targets?: Record<string, GymEntry> };

/** The reps a set needs to count for the weight. `max` is Infinity when the target has no top. */
export type RepWindow = { min: number; max: number };

/**
 * The reps a set needs to count for the weight (4 Nov and 10 Nov, Alex): "10-12" and "10–12" 10 to 12, "8-10/side" 8
 * to 10, "3x8-10" 8 to 10. A single figure is a goal to reach, no top: "12" and "12+" 12 or more, "3x10" 10 or more.
 * Null asks nothing: AMRAP, empty, no number, or a time ("30s", "1 min", "0:45"), whose reps aren't reps.
 */
export function repWindow(reps: string | null | undefined): RepWindow | null {
  const t = (reps ?? "").trim();
  if (!t || /:\d|\d\s*(?:s|secs?|seconds?|m|mins?|minutes?)\b/i.test(t)) return null;
  // "3x10" is sets by reps: the reps.
  const rest = t.replace(/^\d+\s*[x×]\s*(?=\d)/i, "");
  const range = /(\d+)\s*(?:-|–|—|to)\s*(\d+)/i.exec(rest);
  const first = range ? Number(range[1]) : Number(/(\d+)/.exec(rest)?.[1] ?? 0);
  if (!(first > 0)) return null;
  const top = range ? Number(range[2]) : 0;
  return { min: first, max: top >= first ? top : Infinity };
}

/** The coach's own figure in a lane: the one kept beside a raise, else the lane's weight as it is. */
export function coachKg(row: Weights, lane: Lane): number | null {
  if (lane == null) return row.coach_kg !== undefined ? row.coach_kg : row.target_weight_kg;
  const e = row.gym_targets?.[lane];
  return e ? (e.coach_kg !== undefined ? e.coach_kg : e.kg) : null;
}
/** Where a row sits in the plan: its week and its session. */
export type Slot = { week_number: number; day_of_week: number };
/** A row of the exercise where it sits: every planned one, logged or not. */
export type Occurrence = { slot: Slot; row: Weights };
/** What a logged row carries forward in a lane: the best lifted, and when its last set went in. */
export type Lift = { best: number; last: number };

/** "YYYY-MM-DD HH:MM:SS" is server-local time (localStamp), anything else an ISO instant. As queries' stampMs. */
export function stampMs(at: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(at);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : new Date(at).getTime();
}

/** `a` comes after `b` in the plan: a later week, or a later session of the same week. */
export const laterSlot = (a: Slot, b: Slot) => a.week_number > b.week_number || (a.week_number === b.week_number && a.day_of_week > b.day_of_week);

/** The lane a set went in: no gym, or the home gym, is the home lane. */
export const laneOfGym = (gymId: number | null | undefined, home: number | null): Lane => (gymId == null || gymId === home ? null : gymId);

/** An assisted lift (23 Oct, Alex): the exercise or the variation asked for says so. */
export function assistedRow(ex: { name: string; variations?: { id: number; name: string }[] } | undefined, variationId: number | null | undefined): boolean {
  return isAssisted(ex?.name) || (variationId != null && isAssisted(ex?.variations?.find((v) => v.id === variationId)?.name));
}

/** The lane's own weight (a gym with none follows the home gym's). */
export const laneKg = (row: Weights, lane: Lane): number | null => (lane == null ? row.target_weight_kg : row.gym_targets?.[lane]?.kg ?? null);

/** When the coach typed the lane's weight, or a reset was carried to it. */
export const laneTypedAt = (row: Weights, lane: Lane): string | null => (lane == null ? row.target_set_at : row.gym_targets?.[lane]?.set_at) ?? null;

/** The coach set the lane's weight while the client was logging the exercise: a reset point. */
export const isReset = (row: Weights, lane: Lane): boolean => (lane == null ? !!row.target_pinned : !!row.gym_targets?.[lane]?.pinned);

/**
 * The sets of a logged row that count in a lane: on a reset, only those logged from the coach's weight on. What was
 * lifted on that row before it is what the reset overrides.
 */
export function setsSinceReset<S extends { logged_at: string }>(sets: S[], row: Weights, lane: Lane): S[] {
  const typed = isReset(row, lane) ? laneTypedAt(row, lane) : null;
  if (!typed) return sets;
  const from = stampMs(typed);
  return sets.filter((s) => stampMs(s.logged_at) >= from);
}

/**
 * What one logged row's sets in a lane carry forward, or null. Only sets whose reps sit inside `range` (the row's
 * repWindow; null asks none) count (4 Nov and 10 Nov, Alex). The home lane needs a weight met; another gym with no
 * weight of its own takes what was lifted there as its weight going forward.
 */
export function liftOf(sets: { weight_kg: number | null; reps?: number | null; logged_at: string }[], own: number | null, lane: Lane, assisted: boolean, range: RepWindow | null): Lift | null {
  const counted = sets.filter((s) => s.weight_kg != null && (range == null || (s.reps != null && s.reps >= range.min && s.reps <= range.max)));
  const weights = counted.map((s) => s.weight_kg as number);
  if (weights.length === 0) return null;
  const best = assisted ? Math.min(...weights) : Math.max(...weights);
  const met = own != null && (assisted ? best <= own : best >= own);
  if (lane == null ? !met : own != null && !met) return null;
  // When the counted sets went in (4 Nov): a set out of the range logged after the coach typed a weight is no lift
  // that came after it, so it never lets an earlier one move the coach's figure (raisedTo).
  return { best, last: Math.max(...counted.map((s) => stampMs(s.logged_at))) };
}

/**
 * Where lifts from `from` stop in a lane: the first reset of the coach's after it. Null: nothing stops them. A weight
 * the coach cleared is no reset: it has no number to go on, so the lifts before it still pass.
 */
export function stopAfter(from: Slot, rows: Occurrence[], lane: Lane): Slot | null {
  let stop: Slot | null = null;
  for (const o of rows) {
    if (laterSlot(o.slot, from) && isReset(o.row, lane) && laneKg(o.row, lane) != null && (!stop || laterSlot(stop, o.slot))) stop = o.slot;
  }
  return stop;
}

/** A lift stopped at `stop` still reaches `slot`: it comes before the stop. */
export const beforeStop = (slot: Slot, stop: Slot | null) => !stop || laterSlot(stop, slot);

/**
 * A later, unlogged row's lane once a lift that reaches it has passed: the kg it moves to (the better of its own and
 * what was lifted), or null when it stays. It stays when it is a reset, when the coach typed it (or a reset was carried
 * to it) at or after the lift's last set, and, on another gym's lane, when its home weight is a reset and the gym has a
 * weight of its own (as it held before gyms had resets of their own).
 */
export function raisedTo(row: Weights, lane: Lane, lift: Lift, assisted: boolean): number | null {
  if (isReset(row, lane)) return null;
  const kg = laneKg(row, lane);
  if (lane != null && row.target_pinned && kg != null) return null;
  const typed = laneTypedAt(row, lane);
  if (typed && stampMs(typed) >= lift.last) return null;
  const next = kg == null ? lift.best : assisted ? Math.min(kg, lift.best) : Math.max(kg, lift.best);
  return next === kg ? null : next;
}

/**
 * Moves a lane's weight (raisedTo): when it was typed, and whether it is a reset, stay as they were. The first raise
 * keeps the coach's own figure beside it (coach_kg, 4 Nov, Alex), and later raises never overwrite it: the coach typing
 * the weight again clears it (typeWeight, carryReset in queries.ts).
 */
export function writeLane(row: Weights, lane: Lane, kg: number): void {
  if (lane == null) {
    if (row.coach_kg === undefined) row.coach_kg = row.target_weight_kg;
    row.target_weight_kg = kg;
    return;
  }
  const entry = row.gym_targets?.[lane];
  const coach = entry?.coach_kg !== undefined ? entry.coach_kg : entry?.kg ?? null;
  row.gym_targets = { ...(row.gym_targets ?? {}), [lane]: { ...entry, kg, set_at: entry?.set_at ?? null, coach_kg: coach } };
}

/**
 * A row as a copy lands (Apply to the rest, a session copied on): the coach's weights and when they were typed, never
 * the reset itself. The reset stays the one row the coach typed on, so the copies after it move with the client's
 * lifts from it on, as the rows its number was carried to do. The coach's own figure beside a raised one goes with it
 * (coach_kg, 4 Nov).
 */
export function copiedWeights<T extends Weights>(row: T): T {
  const gyms =
    row.gym_targets &&
    Object.fromEntries(Object.entries(row.gym_targets).map(([gym, e]) => [gym, { kg: e.kg, set_at: e.set_at ?? null, ...(e.coach_kg !== undefined ? { coach_kg: e.coach_kg } : {}) }]));
  return { ...row, target_pinned: undefined, gym_targets: gyms };
}
