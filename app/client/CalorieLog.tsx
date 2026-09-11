"use client";

import { useState } from "react";
import { logCaloriesAction } from "../lib/actions";

// The client's own calories for the day, logged right under the targets
// they are measured against. One number, one Save. Below it, the last few
// days so a missed day is visible and can be filled in by tapping it.
//
// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx).
export type CalorieDay = { date: string; label: string; kcal: number | null; note: string | null };

export default function CalorieLog({
  clientId,
  today,
  days,
  targetKcal,
}: {
  clientId: number;
  today: CalorieDay;
  /** Logged days before today, most recent first, at most seven. */
  days: CalorieDay[];
  /** Today's kcal target, for the "of N" hint. */
  targetKcal: number | null;
}) {
  // Which day the input is editing: today by default, or a recent day the
  // client tapped to fill in. Held as a date and looked up from props on
  // every render, so after a save (which re-renders with the stored value
  // and resets the form) the input shows what was just saved.
  const [editingDate, setEditingDate] = useState(today.date);
  const editing = editingDate === today.date ? today : (days.find((d) => d.date === editingDate) ?? today);
  const [pending, setPending] = useState(false);
  // What the client has typed but not saved; null means the field shows the
  // stored value. Saved state is derived from the two matching, so reopening
  // the app on a logged day reads "Saved ✓" rather than inviting a re-save.
  const [draft, setDraft] = useState<string | null>(null);
  // The note field opens when there is something to say; stays open once
  // a note exists for the day being edited.
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  const isToday = editing.date === today.date;
  const stored = editing.kcal != null ? String(editing.kcal) : "";
  const value = draft ?? stored;
  const storedNote = editing.note ?? "";
  const noteValue = noteDraft ?? storedNote;
  const showNote = noteOpen || storedNote !== "" || (noteDraft ?? "") !== "";
  const isSaved = value !== "" && value === stored;
  const noteSaved = noteValue.trim() === storedNote.trim();

  return (
    <section className="home-dark-section cl">
      <div className="home-dark-section-head">
        <span className="home-dark-section-title">Calories eaten</span>
        {targetKcal != null && <span className="home-dark-section-count">target {targetKcal.toLocaleString("en-US")} kcal</span>}
      </div>

      <form
        key={editing.date}
        className="cl-form"
        action={async (formData) => {
          setPending(true);
          await logCaloriesAction(formData);
          setPending(false);
          // The server re-renders with the stored value; the draft is done.
          setDraft(null);
          setNoteDraft(null);
        }}
      >
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="date" value={editing.date} />
        <label className="cl-field">
          <span className="cl-field-label">{isToday ? "Today" : editing.label}</span>
          <span className="cl-input-wrap">
            <input
              name="kcal"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="–"
              value={value}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
              aria-label={`Calories eaten ${isToday ? "today" : editing.label}`}
              className="cl-input"
            />
            <span className="cl-unit">kcal</span>
          </span>
        </label>
        <button type="submit" className={`cl-save${isSaved ? " saved" : ""}`} disabled={pending || isSaved || value === ""}>
          {pending ? "…" : isSaved ? "Saved ✓" : "Save"}
        </button>
        {showNote ? (
          <div className="cl-notebox">
            <span className="cl-field-label">Note for your coach</span>
            <div className="cl-notebox-row">
              <textarea
                name="note"
                className="cl-note"
                value={noteValue}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Ate out, rough estimate, felt low on energy…"
                aria-label="Note for your coach"
                maxLength={500}
                rows={2}
              />
              <button type="submit" className={`cl-save cl-note-save${noteSaved ? " saved" : ""}`} disabled={pending || noteSaved || value === ""}>
                {pending ? "…" : noteSaved ? "Saved ✓" : "Save"}
              </button>
            </div>
            {value === "" && !noteSaved && <span className="cl-note-hint">Enter your calories above first — the note is saved with them.</span>}
          </div>
        ) : (
          <button type="button" className="cl-note-add" onClick={() => setNoteOpen(true)}>
            + Add a note for your coach
          </button>
        )}
      </form>

      {days.length > 0 && (
        <div className="cl-days">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              className={`cl-day${editing.date === d.date ? " editing" : ""}${d.kcal == null ? " empty" : ""}`}
              onClick={() => {
                setDraft(null);
                setNoteDraft(null);
                setNoteOpen(false);
                setEditingDate(editing.date === d.date ? today.date : d.date);
              }}
              aria-label={`${d.label}: ${d.kcal != null ? `${d.kcal} kcal` : "not logged"}. Tap to ${d.kcal != null ? "change" : "log"}`}
            >
              <span className="cl-day-label">{d.label}</span>
              <span className="cl-day-value">{d.kcal != null ? `${d.kcal.toLocaleString("en-US")} kcal` : "not logged"}</span>
              {d.note && <span className="cl-day-note">{d.note}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
