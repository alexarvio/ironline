"use client";

import { useState } from "react";
import { saveNutritionTargetsAction } from "../lib/actions";
import AutosaveNote from "./AutosaveNote";

type Macros = { protein: number | null; carbs: number | null; fats: number | null };

const KCAL = { protein: 4, carbs: 4, fats: 9 } as const;

// Each macro keeps its own colour so a coach can read the bars without a
// legend — the same three, in the same order, on both day types.
const MACRO = [
  { key: "protein", label: "Protein", colour: "#2f5d8f" },
  { key: "carbs", label: "Carbs", colour: "#3f6e46" },
  { key: "fats", label: "Fat", colour: "#9a5a33" },
] as const;

// Daily targets: one card, with a Training day / Rest day switch rather than
// both side by side. Calories are DERIVED from the macros and update as you
// type — a coach entering both macros and a calorie figure can only ever
// disagree with themselves.
export default function NutritionTargets({
  clientId,
  training,
  rest,
  waterL,
  renderedAt,
  phaseId = null,
}: {
  clientId: number;
  training: Macros;
  rest: Macros;
  /** The nutrition phase these targets belong to; null for the client-level plan. */
  phaseId?: number | null;
  /** Server render stamp; lets the note beside Save say "Saved" only once the
      action has landed. */
  renderedAt: number;
  waterL: number | null;
}) {
  const [day, setDay] = useState<"training" | "rest">("training");
  const [values, setValues] = useState({ training, rest });
  // Linked days: one set of macros for both. Starts on when the two already
  // match; turning it on copies the day being edited onto the other, and
  // while it is on every edit lands on both.
  const same = (a: Macros, b: Macros) => a.protein === b.protein && a.carbs === b.carbs && a.fats === b.fats;
  const [linked, setLinked] = useState(() => same(training, rest));

  const current = values[day];
  const kcal =
    (current.protein ?? 0) * KCAL.protein + (current.carbs ?? 0) * KCAL.carbs + (current.fats ?? 0) * KCAL.fats;

  // Bars are scaled against the largest macro in THIS card, so they compare
  // to each other rather than to an invisible target.
  const largest = Math.max(current.protein ?? 0, current.carbs ?? 0, current.fats ?? 0, 1);

  const set = (key: "protein" | "carbs" | "fats", raw: string) => {
    const n = raw.trim() === "" ? null : Number(raw);
    setValues((v) => {
      const next = { ...v[day], [key]: n };
      return linked ? { training: next, rest: next } : { ...v, [day]: next };
    });
  };

  return (
    <form action={saveNutritionTargetsAction} className="nt-card">
      <input type="hidden" name="clientId" value={clientId} />
      {phaseId != null && <input type="hidden" name="phaseId" value={phaseId} />}
      {/* Both day types post every time, so switching tabs mid-edit never
          silently drops the half you can't see. */}
      {(["training", "rest"] as const).map((d) =>
        (["protein", "carbs", "fats"] as const).map((m) => (
          <input
            key={`${d}_${m}`}
            type="hidden"
            name={`${d === "training" ? "t" : "r"}_${m}`}
            value={values[d][m] ?? ""}
          />
        ))
      )}

      <div className="nt-card-head">
        <span className="ad-microlabel">Daily targets</span>
        <div className="nt-daytoggle" role="group" aria-label="Day type">
          {(["training", "rest"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`nt-daybtn${day === d ? " on" : ""}`}
              onClick={() => setDay(d)}
              aria-pressed={day === d}
            >
              {d === "training" ? "Training day" : "Rest day"}
            </button>
          ))}
        </div>
      </div>

      {/* One switch links the two day types: on, the macros are the same on
          both and editing either changes both. */}
      <label className="nt-link-days">
        <input
          type="checkbox"
          checked={linked}
          onChange={(e) => {
            const on = e.target.checked;
            setLinked(on);
            if (on) setValues((v) => ({ training: { ...v[day] }, rest: { ...v[day] } }));
          }}
        />
        <span>Same macros on training and rest days</span>
      </label>

      <div className="nt-kcal-block">
        <span className="ad-microlabel">Calories</span>
        <div className="nt-kcal-row">
          <span className="nt-kcal-value">{kcal.toLocaleString("en-US")}</span>
          <span className="nt-kcal-unit">kcal</span>
        </div>
      </div>

      <div className="nt-macros">
        {MACRO.map((m) => {
          const value = current[m.key] ?? 0;
          const pct = kcal > 0 ? Math.round(((value * KCAL[m.key]) / kcal) * 100) : 0;
          return (
            <div key={m.key} className="nt-macro">
              <span className="ad-microlabel">{m.label}</span>
              <div className="nt-macro-input">
                <input
                  type="number"
                  min={0}
                  value={current[m.key] ?? ""}
                  onChange={(e) => set(m.key, e.target.value)}
                  aria-label={`${m.label} grams`}
                />
                <span className="nt-macro-unit">g</span>
              </div>
              <div className="nt-bar">
                <span
                  className="nt-bar-fill"
                  style={{ width: `${Math.min(100, (value / largest) * 100)}%`, background: m.colour }}
                />
              </div>
              <span className="nt-macro-pct">{pct}% of kcal</span>
            </div>
          );
        })}
      </div>

      {/* A stated goal, not a tracker — one hairline row inside the card. */}
      <div className="nt-water-row">
        <span className="nt-water-label">Water goal</span>
        <input
          name="water"
          type="number"
          step="0.1"
          min={0}
          defaultValue={waterL ?? ""}
          className="nt-water-input"
          aria-label="Water goal in litres"
        />
        <span className="nt-water-unit">L a day</span>
      </div>

      <div className="nt-card-foot">
        {/* Confirmation right where the coach is looking: the button itself. */}
        <AutosaveNote renderedAt={renderedAt} savedText="Up to date" idleText="Up to date" idleAsSaved />
        <button type="submit" className="ad-btn-primary">
          Save targets
        </button>
      </div>
    </form>
  );
}
