"use client";

import { useState } from "react";

// Deliberately does NOT import from ../lib/queries — see HomeHub.tsx for why
// a "use client" file importing queries.ts breaks the dev server. Both
// day types' targets are precomputed server-side; this just toggles which
// one is on screen, no server round trip needed.
export type NutritionTargetSet = {
  kcalLabel: string;
  caption: string;
  macros: { id: string; name: string; grams: number; barPct: number; share: string }[];
};

export default function NutritionDayToggle({
  dateLabel,
  training,
  rest,
  initialIsTraining,
}: {
  dateLabel: string;
  training: NutritionTargetSet;
  rest: NutritionTargetSet;
  initialIsTraining: boolean;
}) {
  const [isTraining, setIsTraining] = useState(initialIsTraining);
  const active = isTraining ? training : rest;

  return (
    <div>
      <div className="nd-kicker">
        {dateLabel} · {isTraining ? "training day" : "rest day"}
      </div>
      <div className="nd-kcal-row">
        <span className="nd-kcal">{active.kcalLabel}</span>
        <span className="nd-kcal-unit">kcal target</span>
      </div>
      <div className="nd-caption">{active.caption}</div>

      <div className="nd-toggle-row">
        <button
          type="button"
          className={`nd-toggle-btn${isTraining ? " active" : ""}`}
          onClick={() => setIsTraining(true)}
        >
          Training day
        </button>
        <button
          type="button"
          className={`nd-toggle-btn${isTraining ? "" : " active"}`}
          onClick={() => setIsTraining(false)}
        >
          Rest day
        </button>
      </div>

      <div className="nd-hr" />

      <div className="nd-macros">
        {active.macros.map((m) => (
          <div key={m.id} className="nd-macro">
            <div className="nd-macro-label">{m.name}</div>
            <div className="nd-macro-value-row">
              <span className="nd-macro-value">{m.grams}</span>
              <span className="nd-macro-unit">g</span>
            </div>
            <div className="nd-bar">
              <div className="nd-bar-fill" style={{ width: `${m.barPct}%` }} />
            </div>
            <div className="nd-macro-share">{m.share}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
