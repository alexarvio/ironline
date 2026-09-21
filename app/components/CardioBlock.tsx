"use client";

import { ReactNode, useState } from "react";
import { CardioKey, EMPTY_CARDIO, usePendingDay } from "./DayPending";
import ExercisePicker from "./ExercisePicker";
import { TrashIcon } from "./icons";
import { useRowDrag } from "./useRowDrag";

// Cardio for the day, in a table of its own: the session card shows it or the
// exercises, never both (the heart in the session's header). It asks for
// different things than a lift does — time, pace, incline, distance — so it
// has its own columns, which the coach picks the same way they pick the
// exercise ones. Notes are always there, as on an exercise row. The activity
// comes from the library's cardio group through the same picker the
// exercise rows use.
type ExerciseOption = { id: number; name: string };
type Group = { slug: string; label: string };
export type CardioColumn = { key: string; field: "time" | "pace" | "incline" | "distance"; label: string; visible: boolean };

export default function CardioBlock({
  groups,
  exercisesByGroup,
  columns: allColumns,
}: {
  groups: readonly Group[];
  exercisesByGroup: Record<string, ExerciseOption[]>;
  /** The client's cardio columns, on and off; only the on ones are shown. */
  columns: CardioColumn[];
}) {
  const pending = usePendingDay();
  const [draft, setDraft] = useState<Record<CardioKey, string>>({ ...EMPTY_CARDIO });
  const [pickerKey, setPickerKey] = useState(0);
  // Rows drag into a new order by the grip, like the exercise rows; the new
  // order waits on the session's Apply bar with every other change.
  const { dragging, liftedIndex, shiftFor, rowRef, grip } = useRowDrag(pending?.cardioOrder ?? [], (next, moved) => pending?.setCardioOrder(next, moved));
  if (!pending) return null;
  const columns = allColumns.filter((c) => c.visible);
  // Its own columns, not the exercise table's: each cardio field the coach
  // has on, then the notes, which take whatever width is left.
  const slots: ("notes" | CardioColumn)[] = [...columns, "notes"];
  const byId = new Map(pending.cardio.map((c) => [c.id, c] as const));
  const rows = pending.cardioOrder.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  const added = pending.draft.cardio.added;
  const submit = () => {
    if (!draft.name.trim()) return;
    pending.addCardio({ ...draft, name: draft.name.trim() });
    setDraft({ ...EMPTY_CARDIO });
    setPickerKey((k) => k + 1);
  };

  const cells = (
    value: (k: CardioKey) => string,
    set: (k: CardioKey, v: string) => void,
    changed: (k: CardioKey) => boolean,
    onEnter: (() => void) | undefined,
    // The row's bin or Add, at the end of Notes: the table has no column of
    // its own for it.
    end: ReactNode
  ) => (
    <>
      {slots.map((slot, i) => {
        const field: CardioKey = slot === "notes" ? "notes" : slot.field;
        const input = (
          <input
            type="text"
            value={value(field)}
            onChange={(e) => set(field, e.target.value)}
            onKeyDown={onEnter ? (e) => e.key === "Enter" && onEnter() : undefined}
            placeholder={slot === "notes" ? "Add a note" : undefined}
            aria-label={slot === "notes" ? "Notes" : slot.label}
            className={changed(field) ? "pb-changed" : undefined}
          />
        );
        return (
          <td key={i} className={slot === "notes" ? "notes-cell" : undefined}>
            {slot === "notes" ? (
              <div className="pb-cell-end">
                <div className="pb-cell-main">{input}</div>
                {end}
              </div>
            ) : (
              input
            )}
          </td>
        );
      })}
    </>
  );

  return (
    <div className="pb-cardio">
      <div className="exercise-table-wrap">
        {/* Grip and Activity are 22 + 210, as in the exercise table; Notes takes the spare width, with the row's bin at its end. */}
        <table className="exercise-table pb-cardio-table" style={{ minWidth: 22 + 210 + columns.length * 120 + 220 + 58 }}>
          <colgroup>
            <col style={{ width: "22px" }} />
            <col style={{ width: "210px" }} />
            {columns.map((c) => (
              <col key={c.key} style={{ width: "120px" }} />
            ))}
            <col />
          </colgroup>
          <thead>
            <tr>
              <th aria-hidden="true"></th>
              <th>Activity</th>
              {slots.map((slot, i) => (
                <th key={i}>{slot === "notes" ? "Notes" : slot.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className={dragging ? "pb-reordering" : undefined}>
            {rows.map((c, index) => (
              <tr key={c.id} ref={rowRef(c.id)} className={`pb-row${liftedIndex === index ? " lifted" : ""}`} style={{ transform: shiftFor(index) }}>
                <td className="pb-grip-cell">
                  <span className="pb-grip" title="Drag to reorder" aria-hidden="true" {...grip(index)}>
                    ⋮⋮
                  </span>
                </td>
                <td className="exercise-name-cell">
                  <div className="pb-exercise-title">
                    <span className="pb-row-new-name">{pending.cardioValue(c.id, "name")}</span>
                  </div>
                </td>
                {cells(
                  (k) => pending.cardioValue(c.id, k),
                  (k, v) => pending.setCardioField(c.id, k, v),
                  (k) => pending.draft.cardio.fields[c.id]?.[k] != null,
                  undefined,
                  <button
                    type="button"
                    className="row-icon-btn row-icon-danger"
                    aria-label={`Remove ${pending.cardioValue(c.id, "name") || "cardio"}`}
                    title="Remove (applies with the other changes)"
                    onClick={() => pending.removeCardio(c.id)}
                  >
                    <TrashIcon />
                  </button>
                )}
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
                {cells(
                  (k) => n.fields[k],
                  (k, v) => pending.setAddedCardioField(n.tempId, k, v),
                  () => true,
                  undefined,
                  <button type="button" className="row-icon-btn row-icon-danger" aria-label={`Undo adding ${n.fields.name}`} title="Undo" onClick={() => pending.unaddCardio(n.tempId)}>
                    <TrashIcon />
                  </button>
                )}
              </tr>
            ))}
            <tr className="add-exercise-row">
              <td aria-hidden="true"></td>
              <td>
                <ExercisePicker key={pickerKey} groups={groups} exercisesByGroup={exercisesByGroup} onPick={(ex) => setDraft((d) => ({ ...d, name: ex.name }))} />
              </td>
              {cells(
                (k) => draft[k],
                (k, v) => setDraft((d) => ({ ...d, [k]: v })),
                () => false,
                submit,
                <button className="pb-add-btn" type="button" onClick={submit} disabled={!draft.name.trim()} title={draft.name.trim() ? undefined : "Pick a cardio activity first"}>
                  + Add
                </button>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
