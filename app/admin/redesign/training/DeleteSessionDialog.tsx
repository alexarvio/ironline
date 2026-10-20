"use client";

import { useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { dayMonth } from "../../../lib/dayMonth";

// Deleting a session, in the admin hairline style (20 Oct, Alex): the title,
// one line of what goes with it, and, when the client logged sets on it, a
// warning and a tick before Delete wakes up. Delete is red words; Cancel holds
// the focus; Enter never deletes.

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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
  laterLabel,
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
  /** "weeks 4–6": the programme's weeks after this one, for "also from"; empty in the last week. */
  laterLabel: string;
  onDelete: (alsoLater: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [alsoLater, setAlsoLater] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gated = loggedSets > 0;
  const can = !gated || agreed;

  const del = async () => {
    if (!can || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(alsoLater);
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
          {firstName} logged this session{lastLoggedAt ? `, last on ${dayMonth(lastLoggedAt)}` : ""}. Those sets come out of their history and progress charts.
          {hasUploads ? " Videos stay in Media." : ""}
        </p>
      )}
      {gated && (
        <button type="button" role="checkbox" aria-checked={agreed} id="dlh-ack" className="dlh-ack" onClick={() => setAgreed((x) => !x)}>
          <span className={`dlh-box${agreed ? " on" : ""}`} aria-hidden="true">
            {agreed ? "✓" : ""}
          </span>
          I understand {firstName}&rsquo;s {plural(loggedSets, "logged set")} will be deleted
        </button>
      )}
      {/* The same session in the weeks after, too (20 Oct, Alex). */}
      {laterLabel && (
        <button type="button" role="checkbox" aria-checked={alsoLater} className="dlh-ack" onClick={() => setAlsoLater((x) => !x)}>
          <span className={`dlh-box ink${alsoLater ? " on" : ""}`} aria-hidden="true">
            {alsoLater ? "✓" : ""}
          </span>
          Also delete it from {laterLabel}
        </button>
      )}
      {error && <p className="dlh-error">{error}</p>}
      <div className="dlh-foot">
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
