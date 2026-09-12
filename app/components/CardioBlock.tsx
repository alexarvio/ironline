"use client";

import { useState } from "react";
import { CardioKey, EMPTY_CARDIO, usePendingDay } from "./DayPending";
import ExercisePicker from "./ExercisePicker";
import { TrashIcon } from "./icons";

// Cardio for the day, under the exercise table and built on the same
// column skeleton, so its cells line up with the exercise cells above:
// grip, activity, then the day's prescription columns with Time, Pace,
// Incline and Distance taking the first four slots and Notes its own, then the logged
// band and the action column. The activity comes from the library's cardio
// group through the same picker the exercise rows use.
type ExerciseOption = { id: number; name: string };
type Group = { slug: string; label: string };
type Column = { id: number; kind: "builtin" | "custom"; key: string; label: string };

const CARDIO_FIELDS: { key: CardioKey; label: string }[] = [
  { key: "time", label: "Time" },
  { key: "pace", label: "Pace" },
  { key: "incline", label: "Incline" },
  { key: "distance", label: "Distance" },
];

// Which cardio field, if any, a given exercise column slot carries.
function slotFor(columns: Column[]): (CardioKey | null)[] {
  let n = 0;
  return columns.map((c) => {
    if (c.key === "notes") return "notes";
    if (n < CARDIO_FIELDS.length) return CARDIO_FIELDS[n++].key;
    return null;
  });
}

export default function CardioBlock({
  groups,
  exercisesByGroup,
  widths,
}: {
  groups: readonly Group[];
  exercisesByGroup: Record<string, ExerciseOption[]>;
  widths: Record<string, string>;
}) {
  const pending = usePendingDay();
  const [draft, setDraft] = useState<Record<CardioKey, string>>({ ...EMPTY_CARDIO });
  const [pickerKey, setPickerKey] = useState(0);
  if (!pending) return null;
  const columns = pending.columns;
  const slots = slotFor(columns);
  // Fields with no column slot (a day with fewer than four prescription
  // columns) fall into the logged band, so nothing is ever unreachable.
  const overflow = CARDIO_FIELDS.filter((f) => !slots.includes(f.key));
  const hasNotesSlot = slots.includes("notes");
  const rows = pending.cardio.filter((c) => !pending.isCardioRemoved(c.id));
  const added = pending.draft.cardio.added;
  const submit = () => {
    if (!draft.name.trim()) return;
    pending.addCardio({ ...draft, name: draft.name.trim() });
    setDraft({ ...EMPTY_CARDIO });
    setPickerKey((k) => k + 1);
  };
  const labelOf = (key: CardioKey) => CARDIO_FIELDS.find((f) => f.key === key)?.label ?? "Notes";

  const cell = (
    key: CardioKey | null,
    value: (k: CardioKey) => string,
    set: (k: CardioKey, v: string) => void,
    changed: (k: CardioKey) => boolean,
    tdKey: string,
    onEnter?: () => void
  ) =>
    key ? (
      <td key={tdKey} className={key === "notes" ? "notes-cell" : undefined}>
        <input
          type="text"
          value={value(key)}
          onChange={(e) => set(key, e.target.value)}
          onKeyDown={onEnter ? (e) => e.key === "Enter" && onEnter() : undefined}
          placeholder={key === "notes" ? "Add a note" : undefined}
          aria-label={labelOf(key)}
          className={changed(key) ? "pb-changed" : undefined}
        />
      </td>
    ) : (
      <td key={tdKey} aria-hidden="true"></td>
    );

  const overflowCell = (value: (k: CardioKey) => string, set: (k: CardioKey, v: string) => void, changed: (k: CardioKey) => boolean, onEnter?: () => void) => (
    <td className="logged-col">
      <div className="pb-cardio-overflow">
      {overflow.map((f) => (
        <label key={f.key} className="pb-cardio-inline">
          <span>{f.label}</span>
          <input type="text" value={value(f.key)} onChange={(e) => set(f.key, e.target.value)} onKeyDown={onEnter ? (e) => e.key === "Enter" && onEnter() : undefined} aria-label={f.label} className={changed(f.key) ? "pb-changed" : undefined} />
        </label>
      ))}
      {!hasNotesSlot && (
        <label className="pb-cardio-inline">
          <span>Notes</span>
          <input type="text" value={value("notes")} onChange={(e) => set("notes", e.target.value)} onKeyDown={onEnter ? (e) => e.key === "Enter" && onEnter() : undefined} aria-label="Notes" className={changed("notes") ? "pb-changed" : undefined} />
        </label>
      )}
      </div>
    </td>
  );

  return (
    <div className="pb-cardio">
      <div className="exercise-table-wrap">
      <table className="exercise-table pb-cardio-table">
        <thead>
          <tr>
            <th aria-hidden="true" style={{ width: "22px" }}></th>
            <th>Cardio</th>
            {columns.map((col, i) => (
              <th key={col.id} style={{ width: widths[col.key] ?? "90px" }}>
                {slots[i] ? labelOf(slots[i]!) : ""}
              </th>
            ))}
            <th className="logged-col"></th>
            <th aria-hidden="true" style={{ width: "58px" }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="pb-row">
              <td className="pb-grip-cell" aria-hidden="true"></td>
              <td className="exercise-name-cell">
                <div className="pb-exercise-title">
                  <span className="pb-row-new-name">{pending.cardioValue(c.id, "name")}</span>
                </div>
              </td>
              {columns.map((col, i) =>
                cell(
                  slots[i],
                  (k) => pending.cardioValue(c.id, k),
                  (k, v) => pending.setCardioField(c.id, k, v),
                  (k) => pending.draft.cardio.fields[c.id]?.[k] != null,
                  String(col.id)
                )
              )}
              {overflowCell(
                (k) => pending.cardioValue(c.id, k),
                (k, v) => pending.setCardioField(c.id, k, v),
                (k) => pending.draft.cardio.fields[c.id]?.[k] != null
              )}
              <td>
                <button type="button" className="row-icon-btn row-icon-danger" aria-label={`Remove ${pending.cardioValue(c.id, "name") || "cardio"}`} title="Remove (applies with the other changes)" onClick={() => pending.removeCardio(c.id)}>
                  <TrashIcon />
                </button>
              </td>
            </tr>
          ))}
          {added.map((n) => (
            <tr key={`new-${n.tempId}`} className="pb-row pb-row-new">
              <td className="pb-grip-cell" aria-hidden="true"></td>
              <td className="exercise-name-cell">
                <div className="pb-exercise-title">
                  <span className="pb-row-new-name">{n.fields.name}</span>
                </div>
              </td>
              {columns.map((col, i) =>
                cell(
                  slots[i],
                  (k) => n.fields[k],
                  (k, v) => pending.setAddedCardioField(n.tempId, k, v),
                  () => true,
                  String(col.id)
                )
              )}
              {overflowCell(
                (k) => n.fields[k],
                (k, v) => pending.setAddedCardioField(n.tempId, k, v),
                () => true
              )}
              <td>
                <button type="button" className="row-icon-btn row-icon-danger" aria-label={`Undo adding ${n.fields.name}`} title="Undo" onClick={() => pending.unaddCardio(n.tempId)}>
                  <TrashIcon />
                </button>
              </td>
            </tr>
          ))}
          <tr className="add-exercise-row">
            <td aria-hidden="true"></td>
            <td>
              <ExercisePicker key={pickerKey} groups={groups} exercisesByGroup={exercisesByGroup} onPick={(ex) => setDraft((d) => ({ ...d, name: ex.name }))} />
            </td>
            {columns.map((col, i) =>
              cell(
                slots[i],
                (k) => draft[k],
                (k, v) => setDraft((d) => ({ ...d, [k]: v })),
                () => false,
                String(col.id),
                submit
              )
            )}
            {overflowCell(
              (k) => draft[k],
              (k, v) => setDraft((d) => ({ ...d, [k]: v })),
              () => false,
              submit
            )}
            <td>
              <button className="pb-add-btn" type="button" onClick={submit} disabled={!draft.name.trim()} title={draft.name.trim() ? undefined : "Pick a cardio activity first"}>
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}
