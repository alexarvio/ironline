"use client";

import { useState } from "react";
import ExercisePicker, { type ExerciseOption, type Group } from "./ExercisePicker";
import { DayColumn, FieldKey, usePendingDay } from "./DayPending";

// The add-exercise row at the foot of a day's table. Picking an exercise and
// pressing Add queues it on the pending-changes bar; the row then clears for
// the next one. Nothing is written until the coach applies.
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
  const [picked, setPicked] = useState<ExerciseOption | null>(null);
  const [fields, setFields] = useState<Record<FieldKey, string>>({ sets: "", reps: "", targetWeight: "", rpe: "", tempo: "", rest: "", distance: "", time: "", notes: "" });
  const [pickerKey, setPickerKey] = useState(0);
  const set = (key: FieldKey, value: string) => setFields((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!pending || !picked) return;
    pending.add({ exerciseId: picked.id, exerciseName: picked.name, fields });
    setPicked(null);
    setFields({ sets: "", reps: "", targetWeight: "", rpe: "", tempo: "", rest: "", distance: "", time: "", notes: "" });
    setPickerKey((k) => k + 1);
  };

  // Nothing pre-filled: the coach types every target for the new row.
  const input = (key: FieldKey, props: { type?: "text" | "number"; step?: string; min?: number; placeholder?: string }) => (
    <input
      {...props}
      value={fields[key]}
      onChange={(e) => set(key, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      }}
    />
  );

  return (
    <tr className="add-exercise-row">
      <td aria-hidden="true"></td>
      <td>
        <ExercisePicker key={pickerKey} groups={groups} exercisesByGroup={exercisesByGroup} onPick={setPicked} />
      </td>
      {columns.map((col) => {
        if (col.kind === "custom") return <td key={col.id} aria-hidden="true"></td>;
        switch (col.key) {
          case "sets":
            return <td key={col.id}>{input("sets", { type: "number", min: 1 })}</td>;
          case "reps":
            return <td key={col.id}>{input("reps", { type: "text" })}</td>;
          case "weight_goal":
            return <td key={col.id}>{input("targetWeight", { type: "number", step: "0.5", placeholder: "kg" })}</td>;
          case "rpe":
            return <td key={col.id}>{input("rpe", { type: "number", step: "0.5", placeholder: "RPE" })}</td>;
          case "tempo":
            return <td key={col.id}>{input("tempo", { type: "text", placeholder: "e.g. 3-1-1" })}</td>;
          case "rest":
            return <td key={col.id}>{input("rest", { type: "text", placeholder: "90s" })}</td>;
          case "distance":
            return <td key={col.id}>{input("distance", { type: "text", placeholder: "5 km" })}</td>;
          case "time":
            return <td key={col.id}>{input("time", { type: "text", placeholder: "20 min" })}</td>;
          case "notes":
            return <td key={col.id}>{input("notes", { type: "text", placeholder: "optional" })}</td>;
          default:
            return <td key={col.id} aria-hidden="true"></td>;
        }
      })}
      <td aria-hidden="true"></td>
      <td>
        <button className="pb-add-btn" type="button" onClick={submit} disabled={!picked} title={picked ? undefined : "Pick an exercise first"}>
          Add
        </button>
      </td>
    </tr>
  );
}
