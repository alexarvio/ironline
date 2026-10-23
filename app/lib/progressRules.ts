// How an exercise's progress is judged (15 Oct), for the coach's progress
// pop-up: the estimated one-rep max per session, the verdict and its
// thresholds, the tip under it, and how a set or a session reads against
// the rep range. One place, so the numbers can be tuned.

export const RULES = {
  /** Fewer sessions than this in the range: not enough data. */
  minSessions: 3,
  /** The latest e1RM this far under the range's best: dropping. */
  dropBelowBest: 0.05,
  /** No new all-time best within this many sessions: stalling. */
  stallSessions: 3,
  /** The weight step a stalling tip suggests, when the plan has none. */
  stepKg: 2.5,
};

export type SetLog = { weight: number; reps: number; rpe: number | null };
export type Session = { date: string | null; planWeek: number; sets: SetLog[] };
export type Verdict = "progressing" | "stalling" | "dropping" | "none";

/** Epley: the weight times one plus the reps over thirty. */
export const e1rmOf = (w: number, r: number) => w * (1 + r / 30);

/** An assisted exercise (23 Oct, Alex): its kg is help, so less is stronger. Known by its name ("Assisted Pull-Up",
    "Band-assisted dip"). */
export const isAssisted = (name: string | null | undefined) => /assist/i.test(name ?? "");

/** What was lifted: the kg; for an assisted lift, the body weight less the help. Null when that can't be known (no body
    weight, or help as much as the body), so the set stays out of any comparison. */
export function liftedKg(kg: number, assisted: boolean, bodyKg: number | null): number | null {
  if (!assisted) return kg;
  if (bodyKg == null || !(bodyKg > kg)) return null;
  return bodyKg - kg;
}

/** The kg a set is weighed by: as logged, or what an assisted lift really lifted (liftedKg). */
export type LoadOf = (kg: number) => number | null;
const asLogged: LoadOf = (kg) => kg;

/** The set with the highest e1RM, and that e1RM. */
export function bestSet(sets: SetLog[], load: LoadOf = asLogged): { set: SetLog; e1rm: number } | null {
  let best: { set: SetLog; e1rm: number } | null = null;
  for (const s of sets) {
    const kg = load(s.weight);
    if (kg == null) continue;
    const e = e1rmOf(kg, s.reps);
    if (!best || e > best.e1rm) best = { set: s, e1rm: e };
  }
  return best;
}

export type Judged = {
  verdict: Verdict;
  /** Sessions in the range, oldest first, each with its best set and e1RM. */
  sessions: (Session & { best: { set: SetLog; e1rm: number } })[];
  /** Index (in `sessions`) of the one that set the range's best e1RM. */
  bestAt: number;
  /** e1RM first to last in the range, as a fraction; null with one session. */
  change: number | null;
};

/** The verdict for the sessions given (already filtered to the range and gym). */
export function judge(all: Session[], load: LoadOf = asLogged): Judged {
  const sessions = all
    .map((s) => ({ ...s, best: bestSet(s.sets, load)! }))
    .filter((s) => s.best)
    .sort((a, b) => (a.date ?? "") < (b.date ?? "") ? -1 : (a.date ?? "") > (b.date ?? "") ? 1 : a.planWeek - b.planWeek);
  if (sessions.length === 0) return { verdict: "none", sessions, bestAt: -1, change: null };
  let bestAt = 0;
  for (let i = 1; i < sessions.length; i++) if (sessions[i].best.e1rm > sessions[bestAt].best.e1rm) bestAt = i;
  const first = sessions[0].best.e1rm;
  const last = sessions[sessions.length - 1].best.e1rm;
  const change = sessions.length > 1 && first > 0 ? (last - first) / first : null;
  if (sessions.length < RULES.minSessions) return { verdict: "none", sessions, bestAt, change };
  const best = sessions[bestAt].best.e1rm;
  if (last < best * (1 - RULES.dropBelowBest)) return { verdict: "dropping", sessions, bestAt, change };
  // A new best within the last few sessions: the best was set there (ties go to the earliest, so a repeat is not "new").
  const newBest = bestAt >= sessions.length - RULES.stallSessions;
  if (!newBest) return { verdict: "stalling", sessions, bestAt, change };
  return { verdict: "progressing", sessions, bestAt, change };
}

/** "8-10" → { min: 8, max: 10 }; "12" → { min: 12, max: 12 }; else null. */
export function repRange(reps: string): { min: number; max: number } | null {
  const m = /(\d+)\s*(?:-|–|to)\s*(\d+)/.exec(reps);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const one = /^\s*(\d+)\s*$/.exec(reps);
  return one ? { min: Number(one[1]), max: Number(one[1]) } : null;
}

export type SetStatus = "top" | "in" | "below" | "none";
/** A set against the rep range: reached the top, in range, or below the bottom. */
export function setStatus(reps: number, range: { min: number; max: number } | null): SetStatus {
  if (!range) return "none";
  if (reps >= range.max) return "top";
  if (reps >= range.min) return "in";
  return "below";
}

export type RowStatus = "top" | "on" | "below";
/** A session against the range and the target weight: every set at the top; every set in range at or above the target
    (an assisted lift: at or under its help); else below. */
export function rowStatus(sets: SetLog[], range: { min: number; max: number } | null, targetKg: number | null, assisted = false): RowStatus {
  if (sets.length === 0) return "below";
  if (range && sets.every((s) => s.reps >= range.max)) return "top";
  const inRange = range ? sets.every((s) => s.reps >= range.min) : true;
  const atTarget = targetKg == null || sets.every((s) => (assisted ? s.weight <= targetKg : s.weight >= targetKg));
  return inRange && atTarget ? "on" : "below";
}

const fmtKg = (kg: number) => (Math.round(kg * 2) / 2).toString();
/** The next load a stalling lift is asked for: a step heavier, or for an assisted lift a step less help. */
const nextLoad = (kg: number, stepKg: number, assisted: boolean) => (assisted ? `${fmtKg(Math.max(0, kg - stepKg))} kg of help` : `${fmtKg(kg + stepKg)} kg`);

/** The tip under a stalling or dropping verdict; null otherwise. */
export function tipFor(j: Judged, range: { min: number; max: number } | null, stepKg = RULES.stepKg, assisted = false): string | null {
  if (j.verdict === "dropping") return "Check sleep, recovery or form";
  if (j.verdict !== "stalling") return null;
  const b = j.sessions[j.bestAt].best.set;
  if (range && b.reps >= range.max && !(assisted && b.weight <= 0)) return `Try ${nextLoad(b.weight, stepKg, assisted)} for ${range.min}–${Math.max(range.min, range.max - 2)} reps next week`;
  return `Aim for ${b.reps + 1} reps at ${fmtKg(b.weight)} kg${assisted ? " of help" : ""}`;
}

/** The chat nudge the Message button starts with. */
export function nudgeFor(j: Judged, exercise: string, firstName: string, range: { min: number; max: number } | null, stepKg = RULES.stepKg, assisted = false): string {
  const name = exercise.charAt(0).toLowerCase() + exercise.slice(1);
  if (j.verdict === "progressing") return `${exercise} is moving nicely, up ${Math.round((j.change ?? 0) * 100)}% this month. Keep it going.`;
  if (j.verdict === "stalling") {
    const b = j.sessions[j.bestAt].best.set;
    const next = range && b.reps >= range.max && !(assisted && b.weight <= 0) ? `${nextLoad(b.weight, stepKg, assisted)} for ${range.min}–${Math.max(range.min, range.max - 2)}` : `${b.reps + 1} reps at ${fmtKg(b.weight)} kg${assisted ? " of help" : ""}`;
    return `Hey ${firstName}, ${name} has been at ${fmtKg(b.weight)} × ${b.reps} for a few sessions. Let’s try ${next} next session 💪`;
  }
  if (j.verdict === "dropping") return `Hey ${firstName}, ${name} has dipped a bit lately. How are sleep and recovery? Let’s look at it together.`;
  return `Hey ${firstName}, a few more sessions of ${name} and we’ll see where it’s heading.`;
}
