"use client";

import { updateAssignmentAction } from "../lib/actions";

// Same auto-save-on-blur idiom as DayLabelForm/CustomValueInput — each field
// is its own tiny form so editing one target doesn't touch the others, and
// there's no separate "save" step to remember.
export default function AssignmentFieldInput({
  assignmentId,
  name,
  type = "text",
  defaultValue,
  placeholder,
  step,
  min,
}: {
  assignmentId: number;
  name: string;
  type?: "text" | "number";
  defaultValue: string | number;
  placeholder?: string;
  step?: number;
  min?: number;
}) {
  return (
    <form action={updateAssignmentAction}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input
        name={name}
        type={type}
        step={step}
        min={min}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}
