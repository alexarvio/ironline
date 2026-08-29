"use client";

import { useState } from "react";
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
      {scheduling ? (
        <form action={scheduleProgramDeployAction} className="plan-schedule-form">
          <input type="hidden" name="programId" value={programId} />
          <input type="date" name="date" required />
          <input type="time" name="time" defaultValue="09:00" required />
          <button className="btn secondary btn-sm" type="submit">
            Schedule
          </button>
          <button type="button" className="btn secondary btn-sm" onClick={() => setScheduling(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="btn secondary btn-sm" onClick={() => setScheduling(true)}>
          Schedule for later…
        </button>
      )}
    </div>
  );
}
