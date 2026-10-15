"use client";

import { useEffect, useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";

// Asking the client for a video of one exercise (15 Oct): the shared pop-up
// language, indigo because it is an exercise. The camera alone and big, a
// pill with the exercise, the session and its targets, a field for what to
// see (optional), and one switch: Ask every session. Opened again on a
// request already made, it edits it. Nothing else: no angle, set or preview.

const CAMERA = "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5";
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
  /** "3 × 8-10 · RPE 8": only what is set. */
  targets: string;
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

  // The field grows with the text, from 76px to 160.
  useEffect(() => {
    const el = text.current;
    if (!el) return;
    el.style.height = "76px";
    el.style.height = `${Math.min(160, Math.max(76, el.scrollHeight))}px`;
  }, [note]);

  const ask = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAsk(note.trim(), recurring);
    } catch {
      setError("That didn’t send. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <DialogContent
      className="avr"
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
      <span className="avr-glow" aria-hidden="true" />
      <span className="avr-wash" aria-hidden="true" />
      <div className="avr-body">
        <header className="avr-head">
          <span className="avr-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={38} height={38} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d={CAMERA} />
            </svg>
          </span>
          <div className="avr-head-text">
            <DialogTitle className="avr-title">{editing ? "Edit video request" : `Ask ${firstName} for a video`}</DialogTitle>
            <DialogDescription className="avr-context">
              <span className="avr-pill">{exerciseName}</span>
              <span className="avr-meta">
                {session} · Week {week}
                {targets ? ` · ${targets}` : ""}
              </span>
            </DialogDescription>
          </div>
          <button type="button" className="avr-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <label className="avr-field">
          <span className="avr-label">
            What you want to see <small>optional</small>
          </span>
          <span className="avr-text-wrap">
            <textarea ref={text} className={`avr-text${note.trim() ? " filled" : ""}`} value={note} onChange={(e) => setNote(e.target.value.slice(0, MAX))} placeholder="e.g. I want to see how far your elbows travel back" maxLength={MAX} rows={3} />
            {note.length > 240 && (
              <span className="avr-count" aria-live="polite">
                {note.length}/{MAX}
              </span>
            )}
          </span>
        </label>

        <button type="button" role="switch" aria-checked={recurring} className="avr-switch-row" onClick={() => setRecurring((r) => !r)}>
          <span className="avr-switch" aria-hidden="true">
            <i />
          </span>
          <span className="avr-switch-text">
            <b>Ask every session</b>
            <small>{recurring ? `Every ${session} session until you turn it off` : `Only this session (${session} · Week ${week})`}</small>
          </span>
        </button>

        {error && <p className="avr-error">{error}</p>}
      </div>

      <footer className="avr-foot">
        {editing && onWithdraw ? (
          <button type="button" className="avr-withdraw" onClick={onWithdraw}>
            Withdraw the request
          </button>
        ) : (
          <span className="avr-note">{firstName} can film or upload, up to 2 min.</span>
        )}
        <button type="button" className="avr-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="avr-ask" onClick={() => void ask()} disabled={busy}>
          {busy ? (
            <span className="avr-spin" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={CAMERA} />
            </svg>
          )}
          {editing ? "Update request" : `Ask ${firstName}`}
        </button>
      </footer>
    </DialogContent>
  );
}
