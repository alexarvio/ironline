"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { updateAssignmentAction } from "../lib/actions";

// The coach's note on one prescribed exercise.
//
// A note is prose — "keep the ribs down and stop the set the moment the low
// back rounds" — and a one-line text input in a 96px column showed the coach
// about four words of it, with the rest scrolled off to the right where it
// couldn't be read or edited. So the cell shows what fits and opens a proper
// editor when clicked: the whole note, room to write more, saved explicitly.
//
// There is no "kind" selector any more. Labelling a note Form / Load / Tempo
// was a second decision for every note written, it changed nothing about how
// the note behaved, and a coach who wants to say "form:" can type it.
export default function ExerciseNoteCell({
  assignmentId,
  exerciseName,
  note,
}: {
  assignmentId: number;
  exerciseName: string;
  note: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        type="button"
        className={`pb-note-cell${note ? " set" : ""}`}
        onClick={() => setOpen(true)}
        title={note || `Add a note for ${exerciseName}`}
      >
        {note || <span className="pb-note-placeholder">Add a note</span>}
      </button>

      {open && mounted &&
        createPortal(
          <NoteDialog
            assignmentId={assignmentId}
            exerciseName={exerciseName}
            note={note}
            onClose={() => setOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

function NoteDialog({
  assignmentId,
  exerciseName,
  note,
  onClose,
}: {
  assignmentId: number;
  exerciseName: string;
  note: string;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const el = areaRef.current;
    if (el) {
      el.focus();
      // Caret at the end, not selecting the whole note — this dialog is
      // usually opened to add to an existing note, not replace it.
      el.setSelectionRange(el.value.length, el.value.length);
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal" role="dialog" aria-modal="true" aria-label={`Note for ${exerciseName}`}>
        <div className="pb-modal-head">
          <div>
            <span className="ad-microlabel">Note</span>
            <h2 className="pb-modal-title">{exerciseName}</h2>
          </div>
          <button type="button" className="pb-modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form
          action={(fd) =>
            start(async () => {
              await updateAssignmentAction(fd);
              onClose();
            })
          }
        >
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <textarea
            ref={areaRef}
            name="notes"
            defaultValue={note}
            className="pb-note-area"
            placeholder="What should they keep in mind on this movement?"
            aria-label={`Note for ${exerciseName}`}
          />
          <p className="pb-demo-hint">The client reads this under the exercise in their app.</p>
          <div className="pb-modal-foot">
            <button type="button" className="ad-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ad-btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
