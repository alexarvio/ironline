"use client";

import { setAssignmentCustomValueAction } from "../lib/actions";
import { usePendingDay } from "../components/DayPending";

export default function CustomValueInput({
  assignmentId,
  columnId,
  value,
}: {
  assignmentId: number;
  columnId: number;
  value: string;
}) {
  const pending = usePendingDay();
  if (pending) {
    const current = pending.customValue(assignmentId, columnId);
    return (
      <input
        type="text"
        value={current}
        className={`custom-column-input${current !== value ? " pb-changed" : ""}`}
        onChange={(e) => pending.setCustom(assignmentId, columnId, e.target.value)}
      />
    );
  }
  return (
    <form action={setAssignmentCustomValueAction}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="columnId" value={columnId} />
      <input
        name="value"
        type="text"
        defaultValue={value}
        className="custom-column-input"
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}
