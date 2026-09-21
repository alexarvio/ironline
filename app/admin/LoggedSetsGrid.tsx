// "What the client did": the column the coach actually reads.
//
// Two lanes, this week over last, each set judged against the target of THE
// WEEK IT BELONGS TO, not the load currently being typed into the
// prescription. That distinction is the whole point: if last week's sets
// were measured against this week's new target, every normal progression
// would paint the client's history amber and it would look like they had
// been failing all along.

import type { ReactNode } from "react";
import { BuilderUnit, BuilderWeight } from "./BuilderContext";

export type LoggedSetCell = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
};

export type PreviousLane =
  /** Same exercise, same day, the week before; with gyms, the last visit to the same gym. */
  | { kind: "logged"; weekNumber: number; gymName?: string | null; targetWeightKg: number | null; repsLow: number | null; sets: LoggedSetCell[] }
  /** The exercise was not on last week's day, or never done at this gym (`note` says which). */
  | { kind: "absent"; note?: string };

/** The low end of a rep prescription: "8-10" → 8, "12" → 12, "AMRAP" → null. */
export function repsLowOf(reps: string | null | undefined): number | null {
  const m = (reps ?? "").trim().match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function best(sets: LoggedSetCell[]): number | null {
  const weights = sets.map((s) => s.weightKg).filter((w): w is number => w != null);
  return weights.length ? Math.max(...weights) : null;
}

// Figures below are drawn by BuilderWeight / BuilderUnit, so they follow the
// toolbar's kg / lbs switch. Hover titles stay in kg.

function SetChip({
  set,
  target,
  repsLow,
  dim,
}: {
  set: LoggedSetCell;
  target: number | null;
  repsLow: number | null;
  dim: boolean;
}) {
  const met = target == null || set.weightKg == null ? null : set.weightKg >= target;
  const repsShort = repsLow != null && set.reps != null && set.reps < repsLow;
  const title = `${set.weightKg ?? "–"} kg × ${set.reps ?? "–"}${set.rpe != null ? ` @ RPE ${set.rpe}` : ""}${
    target == null ? "" : met ? ` · met the ${target} kg target` : ` · under the ${target} kg target`
  }${repsShort ? ` · below ${repsLow} reps` : ""}`;
  return (
    <span className={`pb-log-set${dim ? " dim" : met == null ? "" : met ? " met" : " under"}`} title={title}>
      {set.weightKg != null ? <BuilderWeight kg={set.weightKg} /> : "–"}
      <span className={`pb-log-reps${repsShort ? " short" : ""}`}>×{set.reps ?? "–"}</span>
      {set.rpe != null && <span className="pb-log-rpe">@{set.rpe}</span>}
    </span>
  );
}

export default function LoggedSetsGrid({
  weekNumber,
  targetWeightKg,
  repsLow,
  plannedSets,
  sets,
  previous,
  firstVisit = false,
}: {
  weekNumber: number;
  /** This week's prescription (at the gym the sets were done). */
  targetWeightKg: number | null;
  repsLow: number | null;
  plannedSets: number;
  /** What the client logged this week, in set order. */
  sets: LoggedSetCell[];
  /** Last week's lane; null when there is no last week to show (week 1). */
  previous: PreviousLane | null;
  /** The first time at this gym: nothing to be under yet. */
  firstVisit?: boolean;
}) {
  const logged = sets.length > 0;
  const bestNow = best(sets);
  const target = firstVisit ? null : targetWeightKg;

  // Verdict against this week's target: green only when every set made it.
  let verdict: { text: ReactNode; tone: "met" | "under" | "none" };
  // Nothing said when nothing is logged: the dashed boxes say it already.
  if (!logged) verdict = { text: "", tone: "none" };
  else if (firstVisit) verdict = { text: "First visit", tone: "none" };
  else if (target == null || bestNow == null) verdict = { text: "No target", tone: "none" };
  else if (sets.every((s) => s.weightKg == null || s.weightKg >= target)) {
    verdict =
      bestNow > target
        ? {
            text: (
              <>
                +<BuilderWeight kg={bestNow - target} /> <BuilderUnit /> over
              </>
            ),
            tone: "met",
          }
        : { text: "On target", tone: "met" };
  } else {
    // The shortfall is the weakest set's, so a day with one good set and
    // one short one still says how far the short one missed by.
    const lowest = Math.min(...sets.map((s) => s.weightKg).filter((w): w is number => w != null));
    verdict = {
      text: (
        <>
          <BuilderWeight kg={target - lowest} /> <BuilderUnit /> under
        </>
      ),
      tone: "under",
    };
  }

  // Week over week: best weight this week against best weight last week.
  let delta: { text: ReactNode; tone: "met" | "under" | "none" } | null = null;
  if (previous?.kind === "logged") {
    const bestPrev = best(previous.sets);
    if (bestNow != null && bestPrev != null) {
      delta =
        bestNow > bestPrev
          ? {
              text: (
                <>
                  ▲ <BuilderWeight kg={bestNow - bestPrev} /> <BuilderUnit /> vs W{previous.weekNumber}
                </>
              ),
              tone: "met",
            }
          : bestNow < bestPrev
          ? {
              text: (
                <>
                  ▼ <BuilderWeight kg={bestPrev - bestNow} /> <BuilderUnit /> vs W{previous.weekNumber}
                </>
              ),
              tone: "under",
            }
          : { text: `= W${previous.weekNumber}`, tone: "none" };
    }
  }

  // Three fixed places: the week tags on the left, the verdicts in a column
  // of their own on the right, and the sets between them in one area that
  // scrolls sideways when a week has more than fit. The verdict used to sit
  // straight after the last set, so "On target" moved with every row's set
  // count and no two rows lined up.
  return (
    <div className={`pb-log${previous ? " two" : ""}`}>
      <span className="pb-log-wk now">W{weekNumber}</span>
      {previous && <span className="pb-log-wk prev">W{previous.kind === "logged" ? previous.weekNumber : weekNumber - 1}</span>}
      <div className="pb-log-scroll">
        <div className="pb-log-sets">
          {logged
            ? sets.map((s) => <SetChip key={s.setNumber} set={s} target={target} repsLow={repsLow} dim={false} />)
            : Array.from({ length: Math.max(1, plannedSets) }, (_, i) => (
                <span key={i} className="pb-log-set planned" title="Not logged yet">
                  — × —
                </span>
              ))}
        </div>
        {previous && (
          <div className="pb-log-sets prev">
            {previous.kind === "absent" ? (
              <span className="pb-log-note">{previous.note ?? "New this week"}</span>
            ) : previous.sets.length === 0 ? (
              <span className="pb-log-note">Not logged</span>
            ) : (
              previous.sets.map((s) => <SetChip key={s.setNumber} set={s} target={previous.targetWeightKg} repsLow={previous.repsLow} dim />)
            )}
          </div>
        )}
      </div>
      <span className={`pb-log-verdict ${verdict.tone}`}>{verdict.text}</span>
      {previous && <span className={`pb-log-delta ${delta?.tone ?? "none"}`}>{delta?.text ?? ""}</span>}
    </div>
  );
}
