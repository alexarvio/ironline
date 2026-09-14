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

// The weight at one of the client's other gyms. Empty means that gym starts
// from the home gym's weight, which the placeholder shows. Only inside a day
// card: the pending bar is the one way it saves.
export function GymWeightInput({ assignmentId, gymId, placeholder }: { assignmentId: number; gymId: number; placeholder?: string }) {
  const pending = usePendingDay();
  if (!pending) return null;
  const value = pending.gymValue(assignmentId, gymId);
  const changed = value !== (pending.assignments.find((a) => a.id === assignmentId)?.gyms?.[gymId] ?? "");
  return (
    <input
      type="number"
      step={0.5}
      value={value}
      placeholder={placeholder}
      className={changed ? "pb-changed" : undefined}
      onChange={(e) => pending.setGym(assignmentId, gymId, e.target.value)}
    />
  );
}
