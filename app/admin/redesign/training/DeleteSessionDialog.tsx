"use client";

import { useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";

// Deleting a session, in the admin hairline style (20 Oct, Alex): a white
// card with a hairline edge, the title, one line of what goes with it, the
// sessions after it moving up, and, when the client logged sets on it, an
// acknowledgment the coach has to tick before Delete wakes up. Red only on
// the Delete button and the warning. Cancel holds the focus; Enter never deletes.

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
  // Said only when something moves; the last session moves nothing.
  const renumber =
    after.length === 0
      ? ""
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
      className="dlh"
      role="alertdialog"
      aria-describedby="dlh-desc"
      onOpenAutoFocus={(ev) => {
        // Cancel takes the focus (a beat after the mount, past the dialog's own focus move).
        ev.preventDefault();
        setTimeout(() => cancelRef.current?.focus(), 60);
      }}
    >
      <div className="dlh-head">
        <DialogTitle className="dlh-title">Delete {name ?? `Session ${number}`}?</DialogTitle>
        <button type="button" className="dlh-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {/* What goes with it, as one quiet line (20 Oct, Alex: the hairline style). */}
      <DialogDescription id="dlh-desc" className="dlh-what">
        {[plural(exercises, "exercise"), cardioBlocks ? `${cardioBlocks} cardio` : null, loggedSets ? plural(loggedSets, "logged set") : "nothing logged"].filter(Boolean).join(" · ")}
      </DialogDescription>
      {gated && (
        <p className="dlh-warn">
          {firstName} logged this session{lastLoggedAt ? `, last on ${shortDate(lastLoggedAt)}` : ""}. Those sets come out of their history and progress charts.
          {hasUploads ? " Videos stay in Media." : ""}
        </p>
      )}
      {after.length > 0 && <p className="dlh-note">{renumber}</p>}
      {gated && (
        <button type="button" role="checkbox" aria-checked={agreed} id="dlh-ack" className="dlh-ack" onClick={() => setAgreed((x) => !x)}>
          <span className={`dlh-box${agreed ? " on" : ""}`} aria-hidden="true">
            {agreed ? "✓" : ""}
          </span>
          I understand {firstName}&rsquo;s {plural(loggedSets, "logged set")} will be deleted
        </button>
      )}
      {error && <p className="dlh-error">{error}</p>}
      <div className="dlh-foot">
        <span className="dlh-hint">Can&rsquo;t be undone</span>
        <button ref={cancelRef} type="button" className="dlh-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="dlh-delete" disabled={!can || busy} aria-describedby={gated ? "dlh-ack" : undefined} onClick={() => void del()}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </DialogContent>
  );
}
