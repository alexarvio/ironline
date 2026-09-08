"use client";

import { updateAssignmentAction } from "../lib/actions";
import { FieldKey, usePendingDay } from "./DayPending";

// One editable target on an exercise row. Inside a day card the value goes
// to the pending-changes bar and is written when the coach applies; outside
// one (no provider) it keeps the old save-on-blur behaviour.
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
  name: FieldKey;
  type?: "text" | "number";
  defaultValue: string | number;
  placeholder?: string;
  step?: number;
  min?: number;
}) {
  const pending = usePendingDay();
  if (pending) {
    const value = pending.fieldValue(assignmentId, name);
    const changed = value !== (pending.assignments.find((a) => a.id === assignmentId)?.fields[name] ?? "");
    return (
      <input
        name={name}
        type={type}
        step={step}
        min={min}
        value={value}
        placeholder={placeholder}
        className={changed ? "pb-changed" : undefined}
        onChange={(e) => pending.setField(assignmentId, name, e.target.value)}
      />
    );
  }
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
