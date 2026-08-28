"use client";

import { useMemo, useState } from "react";
import { LineChart, Point } from "../components/LineChart";

const RANGE_DAYS: Record<"month" | "quarter" | "all", number> = { month: 30, quarter: 90, all: 3650 };
const RANGE_LABEL: Record<"month" | "quarter" | "all", string> = {
  month: "Last month",
  quarter: "Last 3 months",
  all: "All time",
};

// Collapsible so it doesn't compete with the day cards for attention by
// default — a dedicated place to see strength trend over time, either
// overall (every exercise's volume summed per day) or drilled into one
// specific exercise, independent of which training week is being viewed.
export default function StrengthProgressPanel({
  overall,
  exercises,
  byExercise,
}: {
  overall: Point[];
  exercises: { id: number; name: string }[];
  byExercise: Record<number, Point[]>;
}) {
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState<"overall" | number>("overall");
  const [range, setRange] = useState<"month" | "quarter" | "all">("quarter");

  const points = exerciseId === "overall" ? overall : byExercise[exerciseId] ?? [];

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return points.filter((p) => p.date >= cutoffStr);
  }, [points, range]);

  return (
    <div className="nutrition-table-wrap builder-card">
      <button type="button" className="strength-progress-toggle" onClick={() => setOpen((o) => !o)}>
        <h3 className="builder-pill-heading" style={{ margin: 0 }}>
          Strength progress
        </h3>
        <span className="exercise-meta">{open ? "Hide" : "Show"} — overall + per-exercise trend</span>
      </button>

      {open && (
        <div style={{ marginTop: 16 }}>
          <div className="graph-controls">
            <div className="toggle-group" role="group" aria-label="Exercise">
              <select
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value === "overall" ? "overall" : Number(e.target.value))}
                style={{ border: "none", background: "none", fontSize: "0.78rem", padding: "6px 10px" }}
              >
                <option value="overall">Overall (all exercises)</option>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="toggle-group" role="group" aria-label="Time range">
              {(Object.keys(RANGE_LABEL) as Array<"month" | "quarter" | "all">).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`toggle-btn${range === key ? " active" : ""}`}
                  onClick={() => setRange(key)}
                >
                  {RANGE_LABEL[key]}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="graph-empty">
              {exercises.length === 0
                ? "No sets logged yet — this fills in once the client logs training."
                : "No sets logged for this exercise in this range yet."}
            </div>
          ) : (
            <LineChart points={filtered} />
          )}
        </div>
      )}
    </div>
  );
}
