"use client";

import "./ask-video.css";
import { useEffect, useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { SepJoin } from "../Sep";

// Asking the client for a video of one exercise, in the admin hairline style
// (20 Oct, Alex): the title, one quiet line of facts (the exercise, the
// session, the week, its targets), the note as a clean line, one switch: Ask
// every session. No explanations. Opened again on a request already made, it
// edits it.

const MAX = 280;

export default function AskVideoDialog({
  firstName,
  exerciseName,
  session,
  week,
  targets,
  existing,
  onAsk,
  onWithdraw,
  onClose,
}: {
  firstName: string;
  /** The exercise as the client sees it: a variation's or substitute's name when they are on one. */
  exerciseName: string;
  /** The session's name ("Push") and the week it is in. */
  session: string;
  week: number;
  /** ["3 × 8-10", "RPE 8"]: only what is set. */
  targets: string[];
  /** A request already on this exercise: edit it. */
  existing: { note: string; recurring: boolean } | null;
  onAsk: (note: string, recurring: boolean) => Promise<void>;
  onWithdraw?: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState(existing?.note ?? "");
  const [recurring, setRecurring] = useState(existing?.recurring ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const editing = !!existing;

  // The line grows with the text, up to 160px (the border under it counted).
  useEffect(() => {
    const el = text.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(160, el.scrollHeight + 1)}px`;
  }, [note]);

  const ask = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAsk(note.trim(), recurring);
    } catch {
      setError("That didn’t send. Try again.");
      setBusy(false);
    }
  };

  return (
    <DialogContent
      className="avh"
      aria-describedby={undefined}
      onOpenAutoFocus={(ev) => {
        ev.preventDefault();
        requestAnimationFrame(() => text.current?.focus());
      }}
      onKeyDown={(ev) => {
        if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
          ev.preventDefault();
          void ask();
        }
      }}
    >
      <div className="avh-head">
        <DialogTitle className="avh-title">{editing ? "Edit video request" : `Ask ${firstName} for a video`}</DialogTitle>
        <button type="button" className="avh-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <DialogDescription className="avh-what">
        <SepJoin parts={[exerciseName, session, `Week ${week}`, ...targets]} />
      </DialogDescription>

      <div className="avh-field">
        <textarea
          ref={text}
          className="avh-text"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX))}
          placeholder="What you want to see"
          aria-label="What you want to see"
          maxLength={MAX}
          rows={1}
        />
        {note.length > 240 && (
          <span className="avh-count" aria-live="polite">
            {note.length}/{MAX}
          </span>
        )}
      </div>

      <button type="button" role="switch" aria-checked={recurring} className="avh-switch-row" onClick={() => setRecurring((r) => !r)}>
        Ask every session
        <span className="avh-switch" aria-hidden="true">
          <i />
        </span>
      </button>

      {error && <p className="avh-error">{error}</p>}

      <div className="avh-foot">
        {editing && onWithdraw && (
          <button type="button" className="avh-withdraw" onClick={onWithdraw}>
            Withdraw request
          </button>
        )}
        <button type="button" className="avh-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="avh-ask" onClick={() => void ask()} disabled={busy}>
          {busy ? (editing ? "Saving…" : "Asking…") : editing ? "Update request" : `Ask ${firstName}`}
        </button>
      </div>
    </DialogContent>
  );
}
