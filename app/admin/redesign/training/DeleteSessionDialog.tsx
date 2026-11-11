"use client";

import { useRef, useState } from "react";
import { DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { ConfirmChoice, ConfirmText } from "../ConfirmParts";
import { dayMonth } from "../../../lib/dayMonth";
import { SepJoin } from "../Sep";

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
  // What goes with it, as plain sentences: its exercises and cardio, then the client's logged sets when there are any.
  const parts = [exercises ? plural(exercises, "exercise") : null, cardioBlocks ? `${cardioBlocks} cardio` : null].filter(Boolean);
  const text = [
    parts.length ? `Its ${parts.join(" and ")} ${parts.length > 1 || exercises + cardioBlocks > 1 ? "are" : "is"} deleted with it.` : null,
    gated ? `${firstName}’s logged sets come out of their history and progress charts.${hasUploads ? " Their videos stay in Media." : ""}` : null,
  ]
    .filter(Boolean)
    .join(" ");

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
      aria-describedby={text ? "dlh-desc" : undefined}
      onOpenAutoFocus={(ev) => {
        // Cancel takes the focus (a beat after the mount, past the dialog's own focus move).
        ev.preventDefault();
        setTimeout(() => cancelRef.current?.focus(), 60);
      }}
    >
      <div className="dlh-head">
        <DialogTitle className="dlh-title">{name ? <>Delete the session &ldquo;{name}&rdquo;?</> : `Delete Session ${number}?`}</DialogTitle>
        <button type="button" className="dlh-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {/* What goes with it, in plain sentences (11 Nov, Alex: A of docs/boards/popup-anatomy-mockup.html). */}
      {text && <ConfirmText id="dlh-desc">{text}</ConfirmText>}
      {/* A gate: Delete wakes once it is ticked. */}
      {gated && (
        <ConfirmChoice
          id="dlh-ack"
          checked={agreed}
          onChange={setAgreed}
          title={`I understand ${firstName}’s logged sets are deleted`}
          sub={<SepJoin parts={[plural(loggedSets, "set"), lastLoggedAt ? `last ${dayMonth(lastLoggedAt)}` : null]} />}
        />
      )}
      {/* The same session in the weeks after, too (20 Oct, Alex). */}
      {laterLabel && <ConfirmChoice checked={alsoLater} onChange={setAlsoLater} title="Also delete it from the weeks after" sub={laterLabel.charAt(0).toUpperCase() + laterLabel.slice(1)} />}
      {error && <p className="dlh-error">{error}</p>}
      <div className="dlh-foot">
        <button ref={cancelRef} type="button" className="dlh-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="dlh-danger" disabled={!can || busy} aria-describedby={gated ? "dlh-ack" : undefined} onClick={() => void del()}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </DialogContent>
  );
}
