"use client";

import { useState } from "react";
import { removeMeasurementFieldAction, setMeasurementFieldVisibleAction, updateMeasurementFieldAction } from "../lib/actions";
import { EyeIcon, PencilIcon, TrashIcon } from "../components/icons";

// One row in the "Check-in columns" list — normally just the column's name
// and unit, with a pencil/trash pair on the right. Pencil turns the row
// into an inline edit form; trash asks "delete this?" before it actually
// removes the column. (Fields don't have their own per-row spot in the
// Check-ins table — there, each field is a *column* — so this list is
// where the coach edits/removes them.)
export default function MeasurementFieldRow({
  field,
}: {
  field: { id: number; name: string; unit: string; visible_to_client?: boolean };
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");

  if (mode === "edit") {
    return (
      <div className="invoice-row">
        <form action={updateMeasurementFieldAction} className="add-invoice-form" style={{ flex: 1 }}>
          <input type="hidden" name="id" value={field.id} />
          <input name="name" type="text" defaultValue={field.name} required />
          <input name="unit" type="text" defaultValue={field.unit} placeholder="unit" />
          <button className="btn secondary" type="submit" onClick={() => setMode("view")}>
            Save
          </button>
          <button type="button" className="btn secondary" onClick={() => setMode("view")}>
            Cancel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="invoice-row">
      <div className="invoice-desc">
        {field.name} {field.unit && <span className="exercise-meta">({field.unit})</span>}
      </div>
      {mode === "confirm-delete" ? (
        <div className="row-confirm-delete" style={{ marginLeft: "auto" }}>
          <span>Delete?</span>
          <form action={removeMeasurementFieldAction}>
            <input type="hidden" name="id" value={field.id} />
            <button type="submit" className="row-confirm-yes">
              Yes
            </button>
          </form>
          <button type="button" className="row-confirm-no" onClick={() => setMode("view")}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="row-icon-actions" style={{ marginLeft: "auto" }}>
          {/* Whether the client is asked for this column at check-in.
              Hiding it leaves everything already logged intact. */}
          <form action={setMeasurementFieldVisibleAction}>
            <input type="hidden" name="id" value={field.id} />
            <input type="hidden" name="visible" value={field.visible_to_client === false ? "true" : "false"} />
            <button
              type="submit"
              className={`row-icon-btn${field.visible_to_client === false ? "" : " row-icon-active"}`}
              aria-label={
                field.visible_to_client === false
                  ? `Ask the client for ${field.name}`
                  : `Stop asking the client for ${field.name}`
              }
              title={
                field.visible_to_client === false
                  ? "Hidden from the client — tap to show"
                  : "On the client's check-in — tap to hide"
              }
            >
              <EyeIcon off={field.visible_to_client === false} />
            </button>
          </form>
          <button
            type="button"
            className="row-icon-btn"
            aria-label={`Edit ${field.name}`}
            onClick={() => setMode("edit")}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="row-icon-btn row-icon-danger"
            aria-label={`Delete ${field.name}`}
            onClick={() => setMode("confirm-delete")}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}
