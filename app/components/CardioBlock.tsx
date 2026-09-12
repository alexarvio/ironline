"use client";

import { useState } from "react";
import { CardioKey, EMPTY_CARDIO, usePendingDay } from "./DayPending";

// Cardio for the day, under the exercise table: its own rows with its own
// columns (time, pace, incline, notes). Edits queue on the day's pending
// bar with everything else. The activity is free text: a treadmill walk,
// a bike, a swim, whatever the coach wants to call it.
const COLS: { key: CardioKey; label: string; width: string }[] = [
  { key: "time", label: "Time", width: "110px" },
  { key: "pace", label: "Pace", width: "130px" },
  { key: "incline", label: "Incline", width: "110px" },
];

export default function CardioBlock() {
  const pending = usePendingDay();
  const [draft, setDraft] = useState<Record<CardioKey, string>>({ ...EMPTY_CARDIO });
  if (!pending) return null;
  const rows = pending.cardio.filter((c) => !pending.isCardioRemoved(c.id));
  const added = pending.draft.cardio.added;
  const submit = () => {
    if (!draft.name.trim()) return;
    pending.addCardio({ ...draft, name: draft.name.trim() });
    setDraft({ ...EMPTY_CARDIO });
  };

  return (
    <div className="pb-cardio">
      <div className="pb-cardio-head">
        <span className="pb-cardio-title">Cardio</span>
        <span className="pb-cardio-hint">Time, pace and incline as you would say them: 20 min, 6.5 km/h, 4%</span>
      </div>
      <table className="exercise-table pb-cardio-table">
        <thead>
          <tr>
            <th aria-hidden="true" style={{ width: "22px" }}></th>
            <th>Activity</th>
            {COLS.map((c) => (
              <th key={c.key} style={{ width: c.width }}>
                {c.label}
              </th>
            ))}
            <th>Notes</th>
            <th aria-hidden="true" style={{ width: "58px" }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="pb-row">
              <td aria-hidden="true"></td>
              <td>
                <input
                  type="text"
                  value={pending.cardioValue(c.id, "name")}
                  onChange={(e) => pending.setCardioField(c.id, "name", e.target.value)}
                  aria-label="Activity"
                  className={pending.draft.cardio.fields[c.id]?.name != null ? "pb-changed" : undefined}
                />
              </td>
              {COLS.map((col) => (
                <td key={col.key}>
                  <input
                    type="text"
                    value={pending.cardioValue(c.id, col.key)}
                    onChange={(e) => pending.setCardioField(c.id, col.key, e.target.value)}
                    aria-label={col.label}
                    className={pending.draft.cardio.fields[c.id]?.[col.key] != null ? "pb-changed" : undefined}
                  />
                </td>
              ))}
              <td className="notes-cell">
                <input
                  type="text"
                  value={pending.cardioValue(c.id, "notes")}
                  onChange={(e) => pending.setCardioField(c.id, "notes", e.target.value)}
                  placeholder="Add a note"
                  aria-label="Notes"
                  className={pending.draft.cardio.fields[c.id]?.notes != null ? "pb-changed" : undefined}
                />
              </td>
              <td>
                <button type="button" className="row-icon-btn row-icon-danger" aria-label={`Remove ${pending.cardioValue(c.id, "name") || "cardio"}`} title="Remove" onClick={() => pending.removeCardio(c.id)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
          {added.map((n) => (
            <tr key={`new-${n.tempId}`} className="pb-row pb-row-new">
              <td aria-hidden="true"></td>
              <td>
                <input type="text" value={n.fields.name} onChange={(e) => pending.setAddedCardioField(n.tempId, "name", e.target.value)} aria-label="Activity" className="pb-changed" />
              </td>
              {COLS.map((col) => (
                <td key={col.key}>
                  <input type="text" value={n.fields[col.key]} onChange={(e) => pending.setAddedCardioField(n.tempId, col.key, e.target.value)} aria-label={col.label} className="pb-changed" />
                </td>
              ))}
              <td className="notes-cell">
                <input type="text" value={n.fields.notes} onChange={(e) => pending.setAddedCardioField(n.tempId, "notes", e.target.value)} placeholder="Add a note" aria-label="Notes" className="pb-changed" />
              </td>
              <td>
                <button type="button" className="row-icon-btn" aria-label="Undo adding cardio" title="Undo" onClick={() => pending.unaddCardio(n.tempId)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
          <tr className="add-exercise-row">
            <td aria-hidden="true"></td>
            <td>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Add cardio, e.g. Treadmill walk…"
                aria-label="New cardio activity"
              />
            </td>
            {COLS.map((col) => (
              <td key={col.key}>
                <input type="text" value={draft[col.key]} onChange={(e) => setDraft((d) => ({ ...d, [col.key]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && submit()} aria-label={col.label} />
              </td>
            ))}
            <td className="notes-cell">
              <input type="text" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="optional" aria-label="Notes" />
            </td>
            <td>
              <button className="pb-add-btn" type="button" onClick={submit} disabled={!draft.name.trim()} title={draft.name.trim() ? undefined : "Name the activity first"}>
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
