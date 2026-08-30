"use client";

import { useState } from "react";
import { removeMetricDefinitionAction, setMetricVisibleAction, togglePinMetricAction, updateMetricDefinitionAction } from "../lib/actions";
import { ChartIcon, EyeIcon, PencilIcon, PinIcon, TrashIcon } from "../components/icons";
import TrackerMetricTrendModal from "./TrackerMetricTrendModal";

type MetricValue = { period: string; value: number | null };

// One row of the Overview table. Normally it's just read-only numbers, with
// pin/chart/pencil/trash icons tucked on the far right — pin surfaces this
// metric on the Start Page, chart opens a trend view over time, pencil turns
// the row into an inline edit form, trash gets a "delete this?" confirm
// before anything actually happens.
export default function TrackerMetricRow({
  def,
  values,
  frequency,
  pinnedCount,
  pinLimit,
}: {
  def: { id: number; category: string; name: string; unit: string; pinned?: boolean; visible_to_client?: boolean };
  values: MetricValue[];
  frequency: "daily" | "weekly";
  pinnedCount: number;
  pinLimit: number;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [showTrend, setShowTrend] = useState(false);

  // Only worth showing once there's enough logged history for an average to
  // mean something — a single entry isn't a trend.
  const logged = values.filter((v): v is { period: string; value: number } => v.value != null);
  const average = logged.length >= 3 ? logged.reduce((sum, v) => sum + v.value, 0) / logged.length : null;
  const pinDisabled = !def.pinned && pinnedCount >= pinLimit;
  // Absent on metrics saved before the flag existed — those stay deployed.
  const visibleToClient = def.visible_to_client !== false;

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
            {/* Whether the client is asked for this metric at check-in.
                Hiding it leaves everything already logged intact. */}
            <form action={setMetricVisibleAction}>
              <input type="hidden" name="id" value={def.id} />
              <input type="hidden" name="visible" value={visibleToClient ? "false" : "true"} />
              <button
                type="submit"
                className={`row-icon-btn${visibleToClient ? " row-icon-active" : ""}`}
                aria-label={visibleToClient ? `Stop asking the client for ${def.name}` : `Ask the client for ${def.name}`}
                title={visibleToClient ? "On the client's check-in — tap to hide" : "Hidden from the client — tap to show"}
              >
                <EyeIcon off={!visibleToClient} />
              </button>
            </form>
            <form action={togglePinMetricAction}>
              <input type="hidden" name="id" value={def.id} />
              <button
                type="submit"
                className={`row-icon-btn${def.pinned ? " row-icon-active" : ""}`}
                aria-label={def.pinned ? `Unpin ${def.name}` : `Pin ${def.name}`}
                disabled={pinDisabled}
                title={pinDisabled ? `Only ${pinLimit} metrics can be pinned at once` : undefined}
              >
                <PinIcon filled={def.pinned} />
              </button>
            </form>
            <button
              type="button"
              className="row-icon-btn"
              aria-label={`View ${def.name} trend`}
              onClick={() => setShowTrend(true)}
              disabled={logged.length === 0}
            >
              <ChartIcon />
            </button>
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
      {showTrend && (
        <TrackerMetricTrendModal
          metricName={def.name}
          unit={def.unit}
          frequency={frequency}
          points={logged.map((v) => ({ date: v.period, value: v.value }))}
          onClose={() => setShowTrend(false)}
        />
      )}
    </tr>
  );
}
