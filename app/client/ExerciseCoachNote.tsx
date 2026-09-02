"use client";

import { useState } from "react";
import { markExerciseNoteReadAction } from "../lib/actions";

// The coach's note on one exercise — a posture fix off a submitted video, a
// load instruction after an easy week.
//
// Collapsed by default so it costs no vertical space on a screen the athlete
// uses mid-set: just a speech bubble at the end of the exercise name row,
// with negative margins so the 44px hit area doesn't make the row taller.
// An unread note carries a dot; opening it clears the dot optimistically and
// tells the server, so it stays cleared on the next load.
export default function ExerciseCoachNote({
  assignmentId,
  dateLabel,
  text,
  unread,
}: {
  assignmentId: number;
  dateLabel: string;
  text: string;
  unread: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(!unread);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !seen) {
      setSeen(true);
      // Fire and forget: the dot is already gone locally, and a failed write
      // only means it comes back on the next load — better than blocking the
      // panel from opening.
      void markExerciseNoteReadAction(assignmentId);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`ex-note-btn${open ? " open" : ""}`}
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? "Hide your coach's note" : "Read your coach's note"}
      >
        <span className="ex-note-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 4v-4H5.5A1.5 1.5 0 0 1 4 14.5v-9Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {!seen && <span className="ex-note-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="ex-note-panel">
          <div className="ex-note-panel-top">
            {/* No kind label. The coach no longer classifies a note as
                Form / Load / Tempo — it was a second decision per note that
                changed nothing, and the note itself says what it is. */}
            <span className="ex-note-kind">Finlay</span>
            <span className="ex-note-date">{dateLabel}</span>
          </div>
          <p className="ex-note-text">{text}</p>
        </div>
      )}
    </>
  );
}
