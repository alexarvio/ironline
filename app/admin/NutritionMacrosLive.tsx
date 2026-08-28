"use client";

import { useState } from "react";
import { MealMacros } from "../lib/queries";

// Standard macro→kcal conversion (protein 4, carbs 4, fat 9) — mirrors the
// formula used server-side when the plan is saved, so what the coach sees
// while typing always matches what gets stored. Everything on this page that
// depends on kcal (per-meal, per-day, weekly total) recomputes live as the
// coach types, spreadsheet-style, rather than only after saving.
type Row = { protein: number; fats: number; carbs: number };

function mealKcal(m: Row) {
  return m.protein * 4 + m.carbs * 4 + m.fats * 9;
}

function toRows(meals: MealMacros[]): Row[] {
  return meals.map((m) => ({ protein: m.protein ?? 0, fats: m.fats ?? 0, carbs: m.carbs ?? 0 }));
}

function MacroRows({
  prefix,
  rows,
  onChange,
}: {
  prefix: "td" | "rd";
  rows: Row[];
  onChange: (i: number, field: keyof Row, raw: string) => void;
}) {
  const totalProtein = rows.reduce((s, r) => s + r.protein, 0);
  const totalFats = rows.reduce((s, r) => s + r.fats, 0);
  const totalCarbs = rows.reduce((s, r) => s + r.carbs, 0);
  const totalKcal = rows.reduce((s, r) => s + mealKcal(r), 0);

  const fieldRow = (label: string, field: keyof Row, total: number) => (
    <tr>
      <td className="exercise-name-cell">{label}</td>
      {rows.map((r, i) => (
        <td key={i}>
          <input
            name={`${prefix}_${field === "protein" ? "p" : field === "fats" ? "f" : "c"}_${i + 1}`}
            type="number"
            step="1"
            value={r[field] || ""}
            onChange={(e) => onChange(i, field, e.target.value)}
          />
        </td>
      ))}
      <td className="totals-cell">{total}</td>
    </tr>
  );

  return (
    <div className="exercise-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th></th>
            {rows.map((_, i) => (
              <th key={i}>Meal {i + 1}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {fieldRow("Protein (g)", "protein", totalProtein)}
          {fieldRow("Fats (g)", "fats", totalFats)}
          {fieldRow("Carbs (g)", "carbs", totalCarbs)}
          <tr>
            <td className="exercise-name-cell">Kcal</td>
            {rows.map((r, i) => (
              <td key={i} className="computed-cell">
                {mealKcal(r) || "–"}
              </td>
            ))}
            <td className="totals-cell">{totalKcal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function NutritionMacrosLive({
  trainingMeals,
  restMeals,
  trainingDaysBuilt,
  maintenanceKcal,
  ebf,
}: {
  trainingMeals: MealMacros[];
  restMeals: MealMacros[];
  trainingDaysBuilt: number;
  maintenanceKcal: number | null;
  ebf: number | null;
}) {
  const [trainingRows, setTrainingRows] = useState<Row[]>(toRows(trainingMeals));
  const [restRows, setRestRows] = useState<Row[]>(toRows(restMeals));

  const update = (setter: typeof setTrainingRows) => (i: number, field: keyof Row, raw: string) => {
    const value = raw === "" ? 0 : Number(raw);
    setter((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: Number.isFinite(value) ? value : 0 } : r)));
  };

  const trainingKcal = trainingRows.reduce((s, r) => s + mealKcal(r), 0);
  const restKcal = restRows.reduce((s, r) => s + mealKcal(r), 0);
  const averageKcal = Math.round((trainingKcal + restKcal) / 2);
  const totalPerWeek = trainingKcal * trainingDaysBuilt + restKcal * (7 - trainingDaysBuilt);

  return (
    <>
      <div className="nutrition-summary">
        <div className="client-stat">
          <span className="stat-label">Training day</span>
          <span className="stat-value">{trainingKcal || "–"} kcal</span>
        </div>
        <div className="client-stat">
          <span className="stat-label">Rest day</span>
          <span className="stat-value">{restKcal || "–"} kcal</span>
        </div>
        <div className="client-stat">
          <span className="stat-label">Average</span>
          <span className="stat-value">{averageKcal || "–"} kcal</span>
        </div>
        <div className="client-stat">
          <span className="stat-label">Total per week</span>
          <span className="stat-value">
            {totalPerWeek || "–"} kcal
            <span className="exercise-meta" style={{ display: "block", fontWeight: 400 }}>
              ({trainingDaysBuilt} training / {7 - trainingDaysBuilt} rest)
            </span>
          </span>
        </div>
        <div className="client-stat">
          <span className="stat-label">Maintenance</span>
          <input
            name="maintenance"
            type="number"
            step="1"
            defaultValue={maintenanceKcal ?? ""}
            placeholder="kcal"
            className="inline-number-input"
          />
        </div>
        <div className="client-stat">
          <span className="stat-label">Energy balance factor</span>
          <input
            name="ebf"
            type="number"
            step="0.01"
            defaultValue={ebf ?? ""}
            placeholder="e.g. 0.8"
            className="inline-number-input"
          />
        </div>
      </div>

      <div className="nutrition-table-wrap">
        <h3>Macros — training day</h3>
        <MacroRows prefix="td" rows={trainingRows} onChange={update(setTrainingRows)} />
      </div>
      <div className="nutrition-table-wrap">
        <h3>Macros — rest day</h3>
        <MacroRows prefix="rd" rows={restRows} onChange={update(setRestRows)} />
      </div>
    </>
  );
}
