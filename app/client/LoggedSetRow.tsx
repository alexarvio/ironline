"use client";

import { useId, useState } from "react";
import { updateSetAction } from "../lib/actions";

// Same rule as the log form: digits and one dot, comma becomes dot.
function tidyDecimal(e: React.FormEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  let out = "";
  let seenDot = false;
  for (const ch of el.value) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if ((ch === "." || ch === ",") && !seenDot) {
      out += ".";
      seenDot = true;
    }
  }
  if (out !== el.value) el.value = out;
}

// A set the client has already logged. Reads as a plain row with a tick;
// tapping Edit turns the figures into inputs in the same cells so a wrong
// entry can be corrected without deleting and re-logging. Mirrors the
// check-in, where a saved section reopens for a fix and folds back up.
export default function LoggedSetRow({
  setLogId,
  setNumber,
  weight,
  reps,
  rpe,
  showTempoColumn,
}: {
  setLogId: number;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  showTempoColumn?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const formId = useId();

  if (!editing) {
    return (
      <tr className="training-set-row">
        <td className="training-set-cell-num">{setNumber}</td>
        <td>{weight != null ? `${weight}kg` : "-"}</td>
        <td>{reps ?? "-"}</td>
        <td>{rpe ?? "-"}</td>
        {showTempoColumn && <td>-</td>}
        <td className="training-set-cell-action">
          <button
            type="button"
            className="training-set-edit"
            onClick={() => setEditing(true)}
            aria-label={`Edit set ${setNumber}`}
          >
            <span aria-hidden="true">✓</span>
            <span className="training-set-edit-label">Edit</span>
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="training-set-row training-set-row-active">
      <td className="training-set-cell-num">{setNumber}</td>
      <td>
        <input
          form={formId}
          name="weight"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          onInput={tidyDecimal}
          defaultValue={weight ?? ""}
          aria-label="Weight"
          required
        />
      </td>
      <td>
        <input form={formId} name="reps" type="number" defaultValue={reps ?? ""} aria-label="Reps" required />
      </td>
      <td>
        <input
          form={formId}
          name="rpe"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          onInput={tidyDecimal}
          defaultValue={rpe ?? ""}
          aria-label="RPE"
        />
      </td>
      {showTempoColumn && <td>-</td>}
      <td className="training-set-cell-action">
        <form
          id={formId}
          action={async (formData) => {
            setPending(true);
            await updateSetAction(formData);
            setPending(false);
            setEditing(false);
          }}
        >
          <input type="hidden" name="setLogId" value={setLogId} />
        </form>
        <div className="training-set-edit-actions">
          <button className="btn btn-sm" form={formId} type="submit" disabled={pending}>
            {pending ? "…" : "Save"}
          </button>
          <button type="button" className="training-set-cancel" onClick={() => setEditing(false)} disabled={pending}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
