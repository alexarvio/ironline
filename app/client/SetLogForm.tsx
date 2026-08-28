"use client";

import { useId, useState } from "react";
import { logSetAction } from "../lib/actions";

// Renders as a single <tr> so it drops straight into the sets <table> next
// to the already-logged rows, instead of a separate card below it. A <form>
// can't span table cells by wrapping them, so the visible weight/reps/rpe
// inputs and the submit button use the HTML5 `form` attribute to associate
// with a <form> tucked inside the last cell alongside the hidden fields.
export default function SetLogForm({
  assignmentId,
  nextSetNumber,
  targetWeight,
  targetReps,
  targetRpe,
}: {
  assignmentId: number;
  nextSetNumber: number;
  // The coach's target for this exercise, shown as placeholder text in each
  // input so the client sees what to aim for right where they're typing —
  // not just once in a badge above the table.
  targetWeight?: number | null;
  targetReps?: string | null;
  targetRpe?: number | null;
}) {
  const [pending, setPending] = useState(false);
  const formId = useId();

  return (
    <tr className="training-set-row training-set-row-active">
      <td className="training-set-cell-num">{nextSetNumber}</td>
      <td>
        <input
          form={formId}
          name="weight"
          type="number"
          step="0.5"
          placeholder={targetWeight != null ? `${targetWeight}kg` : "kg"}
          required
        />
      </td>
      <td>
        <input
          form={formId}
          name="reps"
          type="number"
          placeholder={targetReps ? targetReps : "reps"}
          required
        />
      </td>
      <td>
        <input
          form={formId}
          name="rpe"
          type="number"
          step="0.5"
          placeholder={targetRpe != null ? String(targetRpe) : "—"}
        />
      </td>
      <td className="training-set-cell-action">
        <form
          id={formId}
          action={async (formData) => {
            setPending(true);
            await logSetAction(formData);
            setPending(false);
          }}
        >
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="setNumber" value={nextSetNumber} />
        </form>
        <button className="btn btn-sm" form={formId} type="submit" disabled={pending}>
          {pending ? "…" : "Log"}
        </button>
      </td>
    </tr>
  );
}
