// The muscle map (2 Nov, Alex: "you see all the muscles there and the fibers… depending on the exercises, we have some
// muscles more highlighted than others"): per muscle, the sets it got and the exercises that gave them, for the training
// phase (sets logged since it began) and the split (the sets the programme's current week plans). Each exercise credits
// its sets to the muscles it works by weight (muscleWeights.json, an incline press mostly upper chest, some front delt and
// triceps); one not in that table falls back on its library tags (chest, back, legs…) spread over their muscles.
import { getData } from "./db";
import { getClientProfile, getCurrentPhase, getProgramCurrentWeekIndex, listClientPhases, localDateStr } from "./queries";
import WEIGHTS from "./muscleWeights.json";

import { MUSCLES, type MuscleKey, type MuscleLoad, type MuscleMapData } from "./muscles";
export { MUSCLES, type MuscleKey, type MuscleGroup, type MuscleLoad, type MuscleMapData } from "./muscles";

type Weights = Partial<Record<MuscleKey, number>>;
const BY_NAME = new Map<string, Weights>(Object.entries(WEIGHTS as Record<string, Weights>).map(([n, w]) => [n.trim().toLowerCase(), w]));
/** The library's coarse tags, spread over their muscles, for an exercise the table doesn't know yet. */
const BY_TAG: Record<string, Weights> = {
  chest: { chest_mid: 0.5, chest_upper: 0.25, chest_lower: 0.1, delt_front: 0.05, triceps: 0.1 },
  back: { lats: 0.45, mid_back: 0.35, biceps: 0.1, delt_rear: 0.1 },
  lats: { lats: 0.8, biceps: 0.2 },
  shoulders: { delt_side: 0.4, delt_front: 0.3, delt_rear: 0.3 },
  arms: { biceps: 0.5, triceps: 0.5 },
  biceps: { biceps: 0.85, forearms: 0.15 },
  triceps: { triceps: 1 },
  abs: { abs_upper: 0.5, abs_lower: 0.3, obliques: 0.2 },
  legs: { quads: 0.4, glutes: 0.25, hamstrings: 0.25, adductors: 0.1 },
  quads: { quads: 0.8, glutes: 0.2 },
  hamstrings: { hamstrings: 0.85, glutes: 0.15 },
  glutes: { glutes: 0.75, glute_med: 0.1, hamstrings: 0.15 },
  calves: { calves: 1 },
};

function weightsOf(name: string, tags: string | null | undefined): Weights {
  const own = BY_NAME.get(name.trim().toLowerCase());
  if (own && Object.keys(own).length) return own;
  if (own) return {}; // cardio, mobility: no muscle load
  const list = (tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter((t) => BY_TAG[t]);
  if (!list.length) return {};
  const out: Weights = {};
  for (const t of list) for (const [k, w] of Object.entries(BY_TAG[t]) as [MuscleKey, number][]) out[k] = (out[k] ?? 0) + w / list.length;
  return out;
}

const empty = (): Record<string, MuscleLoad> => Object.fromEntries(MUSCLES.map((m) => [m.key, { sets: 0, exercises: [] }]));
const r1 = (n: number) => Math.round(n * 10) / 10;

function credit(into: Record<string, MuscleLoad>, name: string, w: Weights, sets: number) {
  for (const [k, share] of Object.entries(w) as [MuscleKey, number][]) {
    if (!share || !into[k]) continue;
    into[k].sets += share * sets;
    const ex = into[k].exercises.find((e) => e.name === name);
    if (ex) ex.sets += share * sets;
    else into[k].exercises.push({ name, sets: share * sets });
  }
}

function tidy(into: Record<string, MuscleLoad>) {
  for (const m of Object.values(into)) {
    m.sets = r1(m.sets);
    m.exercises = m.exercises.map((e) => ({ name: e.name, sets: r1(e.sets) })).filter((e) => e.sets > 0).sort((a, b) => b.sets - a.sets);
  }
  return into;
}

/** The map for a client, the Split read off the programme on screen (`programId`), else their running one. */
export function muscleMapFor(clientId: number, programId: number | null): MuscleMapData {
  const data = getData();
  const today = localDateStr();
  const exercises = new Map(data.exercises.map((e) => [e.id, e]));
  const days = data.program_days.filter((d) => d.client_id === clientId);
  const dayById = new Map(days.map((d) => [d.id, d]));
  const assignments = data.workout_assignments.filter((a) => dayById.has(a.program_day_id));

  /** What an assignment is, as planned. */
  const planned = (a: (typeof assignments)[number]) => {
    const e = a.exercise_id ? exercises.get(a.exercise_id) : undefined;
    const name = e?.name ?? a.custom_name ?? "Exercise";
    return { name, w: weightsOf(name, e?.muscle_tags) };
  };
  /** What was done: a swap to a library exercise is that one, a swap typed by name is that name. */
  const done = (a: (typeof assignments)[number]) => {
    if (a.swap?.library_exercise_id != null) {
      const e = exercises.get(a.swap.library_exercise_id);
      if (e) return { name: e.name, w: weightsOf(e.name, e.muscle_tags) };
    }
    if (a.swap?.custom_name) {
      const base = a.exercise_id ? exercises.get(a.exercise_id) : undefined;
      return { name: a.swap.custom_name, w: weightsOf(a.swap.custom_name, base?.muscle_tags) };
    }
    return planned(a);
  };

  // Phase: every working set logged since the training phase began (the one over today, else the latest).
  const phases = listClientPhases(clientId).filter((p) => p.track === "training");
  const phase = getCurrentPhase(clientId, "training") ?? [...phases].sort((a, b) => (a.start_week < b.start_week ? 1 : -1))[0] ?? null;
  const phaseLoad = empty();
  if (phase) {
    const counted = new Map<number, number>();
    for (const l of data.set_logs) {
      const day = (l.logged_at ?? "").slice(0, 10);
      if (day < phase.start_week || day > today) continue;
      if (!((l.reps ?? 0) > 0 || (l.weight_kg ?? 0) > 0)) continue;
      counted.set(l.workout_assignment_id, (counted.get(l.workout_assignment_id) ?? 0) + 1);
    }
    for (const a of assignments) {
      const n = counted.get(a.id);
      const onDay = dayById.get(a.program_day_id);
      // A rogue session counts for nothing (9 Nov, Alex); a duplicate's sets are sets.
      if (!n || (onDay?.free && onDay.copy_of == null)) continue;
      const d = done(a);
      credit(phaseLoad, d.name, d.w, n);
    }
  }

  // Split: the sets the programme's current week plans.
  const program = data.training_programs.find((p) => p.id === programId && p.client_id === clientId) ?? null;
  const splitLoad = empty();
  let week: number | null = null;
  if (program) {
    week = Math.min(Math.max(getProgramCurrentWeekIndex(program), 1), program.total_weeks);
    const weekNumber = program.start_week + week - 1;
    for (const a of assignments) {
      const onDay = dayById.get(a.program_day_id);
      // What the programme plans: not a duplicate the client made (9 Nov).
      if (onDay?.week_number !== weekNumber || onDay.free) continue;
      const p = planned(a);
      credit(splitLoad, p.name, p.w, Math.max(0, Number(a.sets) || 0));
    }
  }

  const gender = (getClientProfile(clientId).gender ?? "").toLowerCase();
  return { phase: tidy(phaseLoad), split: tidy(splitLoad), phaseName: phase?.name ?? null, week, body: gender.startsWith("f") ? "female" : "male" };
}
