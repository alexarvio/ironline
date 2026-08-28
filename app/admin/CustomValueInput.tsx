"use client";

import { setAssignmentCustomValueAction } from "../lib/actions";

export default function CustomValueInput({
  assignmentId,
  columnId,
  value,
}: {
  assignmentId: number;
  columnId: number;
  value: string;
}) {
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
