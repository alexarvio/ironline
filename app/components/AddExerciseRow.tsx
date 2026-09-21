"use client";

import { useState } from "react";
import ExercisePicker, { type ExerciseOption, type Group } from "./ExercisePicker";
import { DayColumn, FieldKey, usePendingDay } from "./DayPending";

const EMPTY_FIELDS: Record<FieldKey, string> = { sets: "", reps: "", targetWeight: "", rpe: "", tempo: "", rest: "", distance: "", time: "", notes: "" };

// The add-exercise row at the foot of a day's table: only the picker.
// Picking an exercise queues it on the pending-changes bar straight away, as
// a row above this one with its first box focused, so the coach types its
// targets there and picks the next. There was an Add button to press after
// every pick; choosing the exercise already says it is wanted. Nothing is
// written until the coach applies.
export default function AddExerciseRow({
  columns,
  groups,
  exercisesByGroup,
}: {
  columns: DayColumn[];
  groups: readonly Group[];
  exercisesByGroup: Record<string, ExerciseOption[]>;
}) {
  const pending = usePendingDay();
  // A fresh picker after each pick, back on "Add exercise…".
  const [pickerKey, setPickerKey] = useState(0);
  const pick = (ex: ExerciseOption) => {
    if (!pending) return;
    pending.add({ exerciseId: ex.id, exerciseName: ex.name, fields: { ...EMPTY_FIELDS } });
    setPickerKey((k) => k + 1);
  };

  return (
    <tr className="add-exercise-row">
      <td aria-hidden="true"></td>
      <td>
        <ExercisePicker key={pickerKey} groups={groups} exercisesByGroup={exercisesByGroup} onPick={pick} />
      </td>
      {columns.map((col) => (
        <td key={col.id} aria-hidden="true"></td>
      ))}
      <td aria-hidden="true"></td>
    </tr>
  );
}
