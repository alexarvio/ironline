"use client";

import { useState } from "react";
import { logCaloriesAction } from "../lib/actions";
import { ChevronLeftIcon } from "../components/icons";

// Calories, one day at a time. The arrows in the header step back through the
// last month (and forward again, never past today), since a day's figure is
// only known once it is over and people forget. For the day showing, the
// client picks Training day or Rest day (it starts on training when a set was
// logged that date), types the figure, can add a note for the coach (why the
// day went 400 over, say) and saves. A logged day locks: green, the tick and
// the figure, with Edit to open it again. The day type and the note are saved
// with the log, so the coach's Calories logged table and the last seven days
// read the day the way the client called it.
//
// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx).
type DayType = "training" | "rest";
export type CalorieDay = {
  date: string;
  /** "Today", "Yesterday", "7 September". */
  label: string;
  kcal: number | null;
  /** The day type saved with the log, if the client picked one. */
  dayType: DayType | null;
  note: string | null;
  /** Where the choice starts when nothing is saved: training if a set was logged that date. */
  defaultDayType: DayType;
  /** That date's kcal target for each day type; null where there is none. */
  targets: Record<DayType, number | null>;
};

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const dayLabel = (t: DayType) => (t === "training" ? "Training day" : "Rest day");

export default function CalorieLogCard({
  clientId,
  days,
  coachName,
}: {
  clientId: number;
  /** Today first, then each day before it. */
  days: CalorieDay[];
  coachName: string;
}) {
  const [index, setIndex] = useState(0);
  const day = days[index] ?? days[0];
  if (!day) return null;

  const stepper = (
    <div className="nd-date-step">
      <button
        type="button"
        className="nd-date-btn"
        onClick={() => setIndex((i) => Math.min(days.length - 1, i + 1))}
        disabled={index >= days.length - 1}
        aria-label="Previous day"
      >
        <ChevronLeftIcon />
      </button>
      <span className="nd-date-label" aria-live="polite">
        {day.label}
      </span>
      <button
        type="button"
        className="nd-date-btn next"
        onClick={() => setIndex((i) => Math.max(0, i - 1))}
        disabled={index === 0}
        aria-label="Next day"
      >
        <ChevronLeftIcon />
      </button>
    </div>
  );

  // Keyed by date, so each day opens with its own saved values and no draft
  // carried over from the day before.
  return <DayLog key={day.date} clientId={clientId} day={day} coachName={coachName} stepper={stepper} />;
}

function DayLog({ clientId, day, coachName, stepper }: { clientId: number; day: CalorieDay; coachName: string; stepper: React.ReactNode }) {
  const savedType = day.dayType ?? day.defaultDayType;
  const [editing, setEditing] = useState(false);
  const [dayType, setDayType] = useState<DayType>(savedType);
  // What has been typed but not saved; null shows the stored value.
  const [draft, setDraft] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set by a save on this screen, so the lock animates then and not when a
  // day that was already logged is opened.
  const [justSaved, setJustSaved] = useState(false);

  const storedText = day.kcal != null ? String(day.kcal) : "";
  const value = draft ?? storedText;
  const figureChanged = value !== storedText;
  const savedNote = day.note ?? "";
  const noteValue = noteDraft ?? savedNote;
  const noteChanged = noteValue.trim() !== savedNote.trim();
  const changed = figureChanged || (day.kcal != null && (dayType !== savedType || noteChanged));

  const head = (
    <div className="nd-card-head nd-log-head">
      <h2 className="nd-card-title">Calories</h2>
      {stepper}
    </div>
  );

  if (day.kcal != null && !editing) {
    return (
      <section className={`nd-card nd-locked-card${justSaved ? " just" : ""}`} aria-label={`Calories ${day.label}: ${n(day.kcal)} kcal, logged`}>
        {head}
        <div className="nd-locked">
          <span className="nd-locked-check" aria-hidden="true">
            <svg viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="20" />
              <path d="M12 20.5l5.5 5.5L28 15" />
            </svg>
          </span>
          <div className="nd-locked-main">
            <span className="nd-locked-figure">
              {n(day.kcal)}
              <small>kcal</small>
            </span>
          </div>
          <button
            type="button"
            className="nd-link"
            onClick={() => {
              setDraft(null);
              setNoteDraft(null);
              setDayType(savedType);
              setJustSaved(false);
              setEditing(true);
            }}
          >
            Edit
          </button>
        </div>
        {day.note && (
          <div className="nd-locked-note">
            <span className="nd-locked-note-label">Your note</span>
            <p>{day.note}</p>
          </div>
        )}
      </section>
    );
  }

  const target = day.targets[dayType];
  return (
    <section className="nd-card">
      {head}
      <form
        className="nd-log-body"
        action={async (formData) => {
          setPending(true);
          try {
            await logCaloriesAction(formData);
            setJustSaved(true);
          } finally {
            setPending(false);
            setDraft(null);
            setNoteDraft(null);
            setEditing(false);
          }
        }}
      >
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="date" value={day.date} />
        <input type="hidden" name="dayType" value={dayType} />
        <div className="nd-daytype" role="radiogroup" aria-label="What kind of day it was">
          {(["training", "rest"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={dayType === t}
              className={`nd-daytype-btn${dayType === t ? " on" : ""}`}
              onClick={() => setDayType(t)}
            >
              {dayLabel(t)}
            </button>
          ))}
        </div>
        <div className="nd-log-row">
          <input
            name="kcal"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={value}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
            aria-label={`Calories eaten ${day.label.toLowerCase()}`}
            className={`nd-eaten-input${figureChanged ? " dirty" : ""}`}
          />
          <span className="nd-eaten-unit">kcal</span>
          {day.kcal != null && !changed ? (
            <button type="button" className="nd-save ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          ) : (
            <button type="submit" className="nd-save" disabled={pending || value === "" || !changed}>
              {pending ? "Saving…" : "Save"}
            </button>
          )}
        </div>
        {target != null && <span className="nd-log-target">Target {n(target)} kcal</span>}
        {/* Sent with the calories every time, so clearing it clears the note. */}
        <input
          name="note"
          type="text"
          autoComplete="off"
          maxLength={500}
          value={noteValue}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder={`Note for ${coachName} (optional), e.g. why the day went over`}
          aria-label={`Note for ${coachName}`}
          className="nd-log-note"
        />
      </form>
    </section>
  );
}
