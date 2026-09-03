// "What the client did" — the column the coach actually reads.
//
// A mini-grid: one column per set, one row per week, this week over last.
// Each set is judged against the target of THE WEEK IT BELONGS TO, not the
// load currently being typed into the prescription. That distinction is the
// whole point: if last week's sets were measured against this week's new
// target, every normal progression would paint the client's history amber
// and it would look like they had been failing all along.

export type LoggedSetCell = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
};

export type LoggedWeekRow = {
  weekLabel: string;
  /** The prescription that was live for this row's week. */
  targetWeightKg: number | null;
  sets: LoggedSetCell[];
  /** The week being edited, shown at full contrast; earlier weeks dim. */
  current: boolean;
};

// Weight and reps always; RPE only when there's room for it. At four or more
// sets the cells get narrow enough that "142.5×13 @8" truncates to "142.5×…",
// which loses the reps — the more useful half. RPE stays in the tooltip.
function setText(set: LoggedSetCell, withRpe: boolean): string {
  const weight = set.weightKg ?? "–";
  const reps = set.reps ?? "–";
  return withRpe && set.rpe != null ? `${weight}×${reps} @${set.rpe}` : `${weight}×${reps}`;
}

// Green when they met or beat the target, amber when short. No verdict at
// all when there was no target to measure against — an uncoloured chip is
// honest, a green one would be flattery.
function verdict(set: LoggedSetCell, target: number | null): "met" | "under" | null {
  if (target == null || set.weightKg == null) return null;
  return set.weightKg >= target ? "met" : "under";
}

export default function LoggedSetsGrid({ rows }: { rows: LoggedWeekRow[] }) {
  const widest = rows.reduce((max, r) => Math.max(max, r.sets.length), 0);
  if (widest === 0) {
    return <span className="pb-logged-empty">Nothing logged yet</span>;
  }
  const setNumbers = Array.from({ length: widest }, (_, i) => i + 1);
  const showRpe = widest <= 3;

  return (
    <div className="pb-logged-grid">
      <div className="pb-logged-head">
        <span className="pb-logged-wk" />
        {setNumbers.map((n) => (
          <span key={n} className="pb-logged-cell">
            S{n}
          </span>
        ))}
      </div>

      {rows.map((row) => (
        <div key={row.weekLabel} className={`pb-logged-row${row.current ? " current" : ""}`}>
          <span className="pb-logged-wk">{row.weekLabel}</span>
          {setNumbers.map((n) => {
            const set = row.sets.find((s) => s.setNumber === n);
            if (!set) {
              return (
                <span key={n} className="pb-logged-cell" title="Not logged">
                  ·
                </span>
              );
            }
            const v = verdict(set, row.targetWeightKg);
            const rpePart = set.rpe != null ? ` at RPE ${set.rpe}` : "";
            const title =
              row.targetWeightKg == null
                ? `Set ${n}: ${set.weightKg ?? "–"}kg × ${set.reps ?? "–"}${rpePart}. No weight target set for ${row.weekLabel}`
                : `Set ${n}: ${set.weightKg ?? "–"}kg × ${set.reps ?? "–"}${rpePart}. ${
                    v === "met" ? "Met or beat" : "Under"
                  } the ${row.targetWeightKg}kg target for ${row.weekLabel}`;
            return (
              <span key={n} className={`pb-logged-cell${v ? ` ${v}` : ""}`} title={title}>
                {setText(set, showRpe)}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
