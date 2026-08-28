"use client";

import { useState } from "react";
import { removePhotoSlotAction, updatePhotoSlotAction } from "../lib/actions";
import { PencilIcon, TrashIcon } from "../components/icons";

export default function PhotoSlotRow({ slot }: { slot: { id: number; label: string } }) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");

  if (mode === "edit") {
    return (
      <div className="invoice-row">
        <form action={updatePhotoSlotAction} className="add-invoice-form" style={{ flex: 1 }}>
          <input type="hidden" name="id" value={slot.id} />
          <input name="label" type="text" defaultValue={slot.label} required />
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
      <div className="invoice-desc">{slot.label}</div>
      {mode === "confirm-delete" ? (
        <div className="row-confirm-delete" style={{ marginLeft: "auto" }}>
          <span>Delete?</span>
          <form action={removePhotoSlotAction}>
            <input type="hidden" name="id" value={slot.id} />
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
          <button
            type="button"
            className="row-icon-btn"
            aria-label={`Edit ${slot.label}`}
            onClick={() => setMode("edit")}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="row-icon-btn row-icon-danger"
            aria-label={`Delete ${slot.label}`}
            onClick={() => setMode("confirm-delete")}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}
