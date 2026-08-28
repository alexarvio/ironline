"use client";

import { useState } from "react";
import { removeMetricDefinitionAction, updateMetricDefinitionAction } from "../lib/actions";
import { PencilIcon, TrashIcon } from "../components/icons";

type MetricValue = { period: string; value: number | null };

// One row of the Overview table. Normally it's just read-only numbers, with
// a small pencil/trash pair tucked on the far right — click the pencil to
// turn the row into an inline edit form, click the trash to get a
// "delete this?" confirm before anything actually happens. This replaces
// the old always-visible "Category / Name / Unit / Save / remove" row that
// used to sit under "Add a metric", which just duplicated what the Overview
// table already shows.
export default function TrackerMetricRow({
  def,
  values,
}: {
  def: { id: number; category: string; name: string; unit: string };
  values: MetricValue[];
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");

  // Only worth showing once there's enough logged history for an average to
  // mean something — a single entry isn't a trend.
  const logged = values.filter((v): v is { period: string; value: number } => v.value != null);
  const average = logged.length >= 3 ? logged.reduce((sum, v) => sum + v.value, 0) / logged.length : null;

  if (mode === "edit") {
    return (
      <tr>
        <td className="tracker-metric-col" colSpan={values.length + 2}>
          <form action={updateMetricDefinitionAction} className="add-invoice-form tracker-inline-edit-form">
            <input type="hidden" name="id" value={def.id} />
            <input name="category" type="text" defaultValue={def.category} placeholder="Category" />
            <input name="name" type="text" defaultValue={def.name} required />
            <input name="unit" type="text" defaultValue={def.unit} placeholder="unit" />
            <button className="btn secondary" type="submit" onClick={() => setMode("view")}>
              Save
            </button>
            <button type="button" className="btn secondary" onClick={() => setMode("view")}>
              Cancel
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="exercise-name-cell tracker-metric-col">
        {def.name} {def.unit && <span className="exercise-meta">({def.unit})</span>}
        {average != null && (
          <span className="tracker-metric-avg" title={`Average of ${logged.length} logged entries`}>
            avg {average.toFixed(1)}
          </span>
        )}
      </td>
      {values.map((v) => (
        <td key={v.period} className="computed-cell">
          {v.value ?? "–"}
        </td>
      ))}
      <td className="row-actions-cell">
        {mode === "confirm-delete" ? (
          <div className="row-confirm-delete">
            <span>Delete?</span>
            <form action={removeMetricDefinitionAction}>
              <input type="hidden" name="id" value={def.id} />
              <button type="submit" className="row-confirm-yes">
                Yes
              </button>
            </form>
            <button type="button" className="row-confirm-no" onClick={() => setMode("view")}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="row-icon-actions">
            <button
              type="button"
              className="row-icon-btn"
              aria-label={`Edit ${def.name}`}
              onClick={() => setMode("edit")}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className="row-icon-btn row-icon-danger"
              aria-label={`Delete ${def.name}`}
              onClick={() => setMode("confirm-delete")}
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
