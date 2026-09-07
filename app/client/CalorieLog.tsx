"use client";

import { useState } from "react";
import { logCaloriesAction } from "../lib/actions";

// The client's own calories for the day, logged right under the targets
// they are measured against. One number, one Save. Below it, the last few
// days so a missed day is visible and can be filled in by tapping it.
//
// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx).
export type CalorieDay = { date: string; label: string; kcal: number | null };

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

  const isToday = editing.date === today.date;
  const stored = editing.kcal != null ? String(editing.kcal) : "";
  const value = draft ?? stored;
  const isSaved = value !== "" && value === stored;

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
                setEditingDate(editing.date === d.date ? today.date : d.date);
              }}
              aria-label={`${d.label}: ${d.kcal != null ? `${d.kcal} kcal` : "not logged"}. Tap to ${d.kcal != null ? "change" : "log"}`}
            >
              <span className="cl-day-label">{d.label}</span>
              <span className="cl-day-value">{d.kcal != null ? `${d.kcal.toLocaleString("en-US")} kcal` : "not logged"}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
