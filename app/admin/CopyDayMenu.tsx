"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { copyProgramDayAction } from "../lib/actions";

export type CopyDayProps = {
  fromDayId: number;
  /** "Session 3 · Push" */
  sourceName: string;
  /** The number a new session in this week would get; null when the week is full. */
  newSessionNumber: number | null;
  targets: { id: number; name: string; exerciseCount: number }[];
  /** How many weeks of the programme come after this one, and which ("W3–W5"). */
  remainingWeeks: number;
  remainingLabel: string;
};

// Copies a session: into a new session at the end of the week, or over
// another session of the week. A dialog rather than an inline strip, so
// every choice can say what it does ("Adds Session 6", "Replaces its 5
// exercises") and the button names the outcome. With later weeks in the
// programme, a tick does the same in each of them.
//
// Opened from Duplicate in the session's ⋯ menu (SessionMenu). It mounts
// fresh each time, so it always opens on its first choice.
export function CopyDayDialog({
  fromDayId,
  sourceName,
  newSessionNumber,
  targets,
  remainingWeeks,
  remainingLabel,
  onClose,
}: CopyDayProps & { onClose: () => void }) {
  // A full week can only copy over one of its sessions.
  const [to, setTo] = useState<string>(newSessionNumber != null ? "new" : String(targets[0]?.id ?? ""));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const target = targets.find((t) => String(t.id) === to) ?? null;
  const submitLabel = !target
    ? newSessionNumber != null
      ? `Add as Session ${newSessionNumber}`
      : "Copy"
    : target.exerciseCount > 0
    ? `Replace ${target.name.split(" · ")[0]}`
    : `Copy to ${target.name.split(" · ")[0]}`;
  const weeksText = remainingWeeks === 1 ? `the remaining week (${remainingLabel})` : `the ${remainingWeeks} remaining weeks (${remainingLabel})`;

  return createPortal(
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        action={copyProgramDayAction}
        onSubmit={() => setTimeout(onClose, 0)}
        className="pb-modal pb-modal-sm"
        role="dialog"
        aria-modal="true"
        aria-label={`Duplicate ${sourceName}`}
      >
        <input type="hidden" name="fromDayId" value={fromDayId} />
        <h2 className="pb-confirm-title">Duplicate {sourceName}</h2>
        <p className="pb-confirm-body">Where should the copy go?</p>

        <div className="pb-copy-options" role="radiogroup">
          {newSessionNumber != null ? (
            <label className={`pb-copy-option${to === "new" ? " on" : ""}`}>
              <input type="radio" name="toDayId" value="new" checked={to === "new"} onChange={() => setTo("new")} />
              <span>
                <b>New session</b>
                <small>Adds Session {newSessionNumber} to this week</small>
              </span>
            </label>
          ) : (
            <p className="pb-copy-full">This week has the most sessions a week can hold, so the copy replaces one.</p>
          )}
          {targets.map((t) => (
            <label key={t.id} className={`pb-copy-option${to === String(t.id) ? " on" : ""}`}>
              <input type="radio" name="toDayId" value={t.id} checked={to === String(t.id)} onChange={() => setTo(String(t.id))} />
              <span>
                <b>{t.name}</b>
                <small>{t.exerciseCount > 0 ? `Replaces its ${t.exerciseCount} exercise${t.exerciseCount === 1 ? "" : "s"}` : "Empty session"}</small>
              </span>
            </label>
          ))}
        </div>

        {remainingWeeks > 0 && (
          <label className="pb-copy-later">
            <input type="checkbox" name="applyToRemainingWeeks" value="1" />
            <span>{to === "new" ? `Also add it to ${weeksText}` : `Also do this in ${weeksText}`}</span>
          </label>
        )}

        <div className="pb-modal-foot">
          <button type="button" className="ad-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ad-btn-primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
