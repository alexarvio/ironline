"use client";

import { useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";

// Deleting a session (15 Oct), in the shared pop-up language, red: what goes
// with it in three figures, the sessions after it moving up, and, when the
// client logged sets on it, an acknowledgment the coach has to tick before
// Delete wakes up. Cancel holds the focus; Enter never deletes.

const TRASH = "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function DeleteSessionDialog({
  number,
  name,
  programme,
  firstName,
  exercises,
  cardioBlocks,
  loggedSets,
  lastLoggedAt,
  hasUploads,
  sessionsAfter,
  onDelete,
  onClose,
}: {
  number: number;
  /** The coach's own name for the session; null when it only has its number. */
  name: string | null;
  programme: string;
  firstName: string;
  exercises: number;
  cardioBlocks: number;
  loggedSets: number;
  lastLoggedAt: string | null;
  hasUploads: boolean;
  /** The numbers of the sessions after this one in the week. */
  sessionsAfter: number[];
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gated = loggedSets > 0;
  const can = !gated || agreed;
  const after = sessionsAfter;
  const renumber =
    after.length === 0
      ? "It’s the last session, so nothing else changes."
      : after.length === 1
        ? `Session ${after[0]} moves up to ${number}.`
        : after.length === 2
          ? `Sessions ${after[0]} and ${after[1]} move up to ${after[0] - 1} and ${after[1] - 1}.`
          : `Sessions ${after[0]}–${after[after.length - 1]} move up to ${after[0] - 1}–${after[after.length - 1] - 1}.`;

  const del = async () => {
    if (!can || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch {
      setError("That didn’t delete. Try again.");
      setBusy(false);
    }
  };

  return (
    <DialogContent
      className="dls"
      role="alertdialog"
      aria-describedby="dls-desc"
      onOpenAutoFocus={(ev) => {
        // Cancel takes the focus (a beat after the mount, past the dialog's own focus move).
        ev.preventDefault();
        setTimeout(() => cancelRef.current?.focus(), 60);
      }}
    >
      <span className="dls-glow" aria-hidden="true" />
      <span className="dls-wash" aria-hidden="true" />
      <div className="dls-body">
        <header className="dls-head">
          <span className="dls-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={34} height={34} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d={TRASH} />
            </svg>
          </span>
          <div className="dls-head-text">
            <DialogTitle className="dls-title">Delete Session {number}?</DialogTitle>
            <div className="dls-context">
              {name && <span className="dls-pill">{name}</span>}
              <span className="dls-meta">
                {programme} · {firstName}
              </span>
            </div>
          </div>
          <button type="button" className="dls-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <DialogDescription id="dls-desc" className="dls-section">
          <span className="dls-label">What goes with it</span>
          <span className="dls-stats">
            <span className="dls-stat">
              <b>{exercises}</b>
              <small>{exercises === 1 ? "exercise" : "exercises"}</small>
            </span>
            <span className="dls-stat">
              <b>{cardioBlocks}</b>
              <small>{cardioBlocks === 1 ? "cardio block" : "cardio blocks"}</small>
            </span>
            <span className={`dls-stat${gated ? " danger" : ""}`}>
              <b>{loggedSets}</b>
              <small>logged sets</small>
            </span>
          </span>
          {gated && (
            <span className="dls-logged">
              {firstName} logged this session{lastLoggedAt ? `, last on ${shortDate(lastLoggedAt)}` : ""}. Those sets come out of their history and progress charts.
              {hasUploads ? " Videos stay in Media." : ""}
            </span>
          )}
        </DialogDescription>

        <div className="dls-renumber">
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
          <span>{renumber}</span>
        </div>

        {gated && (
          <button type="button" role="checkbox" aria-checked={agreed} id="dls-ack" className="dls-ack" onClick={() => setAgreed((a) => !a)}>
            <span className={`dls-box${agreed ? " on" : ""}`} aria-hidden="true">
              {agreed && (
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              )}
            </span>
            <span>
              I understand {firstName}’s {plural(loggedSets, "logged set")} will be deleted
            </span>
          </button>
        )}

        {error && <p className="dls-error">{error}</p>}
      </div>

      <footer className="dls-foot">
        <span className="dls-note">This can’t be undone.</span>
        <button ref={cancelRef} type="button" className="dls-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="dls-delete" disabled={!can || busy} aria-describedby={gated ? "dls-ack" : undefined} onClick={() => void del()}>
          {busy ? <span className="dls-spin" aria-hidden="true" /> : null}
          Delete session
        </button>
      </footer>
    </DialogContent>
  );
}
