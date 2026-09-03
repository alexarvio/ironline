"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cancelProgramScheduleAction, deployProgramAction, scheduleProgramDeployAction } from "../lib/actions";

// Lives in the Draft program card's header: deploy the whole program right
// now, or pick a future date/time — there's no background job runner in
// this app, so a scheduled deploy actually fires the next time anyone loads
// the app after that time (see applyDueProgramDeployments), not at the
// exact second. Once something is scheduled, this collapses to just a
// "Scheduled for ..." readout + cancel.
export default function ProgramDeployControls({
  programId,
  scheduledAt,
}: {
  programId: number;
  scheduledAt: string | null;
}) {
  // The dialog only exists after a click, so it never renders on the server
  // and the portal needs no mounted guard.
  const [scheduling, setScheduling] = useState(false);

  if (scheduledAt) {
    const when = new Date(scheduledAt);
    return (
      <div className="plan-deploy-controls">
        <span className="plan-scheduled-note">
          Scheduled for{" "}
          {when.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at{" "}
          {when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </span>
        <form action={cancelProgramScheduleAction}>
          <input type="hidden" name="programId" value={programId} />
          <button className="btn secondary btn-sm" type="submit">
            Cancel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="plan-deploy-controls">
      <form action={deployProgramAction}>
        <input type="hidden" name="programId" value={programId} />
        <button className="deploy-btn" type="submit">
          Deploy now
        </button>
      </form>
      <button type="button" className="btn secondary btn-sm" onClick={() => setScheduling(true)}>
        Schedule for later…
      </button>
      {/* The date and time live in a dialog, not inline: expanding here grew
          the editing bar and shoved the week rail down under the pointer. */}
      {scheduling &&
        createPortal(<ScheduleDialog programId={programId} onClose={() => setScheduling(false)} />, document.body)}
    </div>
  );
}

function ScheduleDialog({ programId, onClose }: { programId: number; onClose: () => void }) {
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    dateRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label="Schedule this programme">
        <h2 className="pb-confirm-title">Schedule this programme</h2>
        <p className="pb-confirm-body">
          It goes live for the client at the date and time you pick. Until then it stays a draft you can keep
          editing.
        </p>
        <form action={scheduleProgramDeployAction} className="plan-schedule-form plan-schedule-dialog">
          <input type="hidden" name="programId" value={programId} />
          <label className="plan-schedule-field">
            <span>Date</span>
            <input ref={dateRef} type="date" name="date" required />
          </label>
          <label className="plan-schedule-field">
            <span>Time</span>
            <input type="time" name="time" defaultValue="09:00" required />
          </label>
          <div className="pb-modal-foot">
            <button type="button" className="ad-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ad-btn-primary">
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
