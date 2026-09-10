// "What the client did": the column the coach actually reads.
//
// Two lanes, this week over last, each set judged against the target of THE
// WEEK IT BELONGS TO, not the load currently being typed into the
// prescription. That distinction is the whole point: if last week's sets
// were measured against this week's new target, every normal progression
// would paint the client's history amber and it would look like they had
// been failing all along.

export type LoggedSetCell = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
};

export type PreviousLane =
  /** Same exercise, same day, the week before. */
  | { kind: "logged"; targetWeightKg: number | null; repsLow: number | null; sets: LoggedSetCell[] }
  /** The exercise was not on last week's day. */
  | { kind: "absent" };

/** The low end of a rep prescription: "8-10" → 8, "12" → 12, "AMRAP" → null. */
export function repsLowOf(reps: string | null | undefined): number | null {
  const m = (reps ?? "").trim().match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function best(sets: LoggedSetCell[]): number | null {
  const weights = sets.map((s) => s.weightKg).filter((w): w is number => w != null);
  return weights.length ? Math.max(...weights) : null;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

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
      {set.weightKg ?? "–"}
      <span className={`pb-log-reps${repsShort ? " short" : ""}`}>×{set.reps ?? "–"}</span>
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
}: {
  weekNumber: number;
  /** This week's prescription. */
  targetWeightKg: number | null;
  repsLow: number | null;
  plannedSets: number;
  /** What the client logged this week, in set order. */
  sets: LoggedSetCell[];
  /** Last week's lane; null when there is no last week to show (week 1). */
  previous: PreviousLane | null;
}) {
  const logged = sets.length > 0;
  const bestNow = best(sets);
  const target = targetWeightKg;

  // Verdict against this week's target: green only when every set made it.
  let verdict: { text: string; tone: "met" | "under" | "none" };
  if (!logged) verdict = { text: "Not logged", tone: "none" };
  else if (target == null || bestNow == null) verdict = { text: "No target", tone: "none" };
  else if (sets.every((s) => s.weightKg == null || s.weightKg >= target)) {
    verdict = bestNow > target ? { text: `+${fmt(bestNow - target)} kg over`, tone: "met" } : { text: "On target", tone: "met" };
  } else {
    // The shortfall is the weakest set's, so a day with one good set and
    // one short one still says how far the short one missed by.
    const lowest = Math.min(...sets.map((s) => s.weightKg).filter((w): w is number => w != null));
    verdict = { text: `${fmt(target - lowest)} kg under`, tone: "under" };
  }

  // Week over week: best weight this week against best weight last week.
  let delta: { text: string; tone: "met" | "under" | "none" } | null = null;
  if (previous?.kind === "logged") {
    const bestPrev = best(previous.sets);
    if (bestNow != null && bestPrev != null) {
      delta =
        bestNow > bestPrev
          ? { text: `▲ ${fmt(bestNow - bestPrev)} kg vs W${weekNumber - 1}`, tone: "met" }
          : bestNow < bestPrev
          ? { text: `▼ ${fmt(bestPrev - bestNow)} kg vs W${weekNumber - 1}`, tone: "under" }
          : { text: `= W${weekNumber - 1}`, tone: "none" };
    }
  }

  return (
    <div className="pb-log">
      <span className="pb-log-wk now">W{weekNumber}</span>
      <div className="pb-log-sets">
        {logged
          ? sets.map((s) => <SetChip key={s.setNumber} set={s} target={target} repsLow={repsLow} dim={false} />)
          : Array.from({ length: Math.max(1, plannedSets) }, (_, i) => (
              <span key={i} className="pb-log-set planned" title="Not logged yet">
                — × —
              </span>
            ))}
      </div>
      <span className={`pb-log-verdict ${verdict.tone}`}>{verdict.text}</span>

      {previous && (
        <>
          <span className="pb-log-wk">W{weekNumber - 1}</span>
          <div className="pb-log-sets">
            {previous.kind === "absent" ? (
              <span className="pb-log-note">New this week</span>
            ) : previous.sets.length === 0 ? (
              <span className="pb-log-note">Not logged</span>
            ) : (
              previous.sets.map((s) => (
                <SetChip key={s.setNumber} set={s} target={previous.targetWeightKg} repsLow={previous.repsLow} dim />
              ))
            )}
          </div>
          <span className={`pb-log-delta ${delta?.tone ?? "none"}`}>{delta?.text ?? ""}</span>
        </>
      )}
    </div>
  );
}
