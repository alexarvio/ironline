"use client";

import { useState } from "react";
import { addWeekSheetAction, deployNextWeekAction } from "../lib/actions";
import { PlusIcon } from "./icons";

// The "+" icon on the right of the week switcher — collapses the three
// week-creation actions (deploy/duplicate/blank) into one dropdown instead
// of three always-visible buttons competing with the week pills for space.
export default function WeekActionsMenu({ clientId, latestWeek }: { clientId: number; latestWeek: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="week-actions-menu-wrap">
      <button
        type="button"
        className="row-icon-btn"
        aria-label="Add or deploy a week"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <PlusIcon />
      </button>

      {open && (
        <>
          <div className="exercise-picker-backdrop" onClick={() => setOpen(false)} />
          <div className="week-actions-menu">
            <form action={deployNextWeekAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <button
                className="week-actions-menu-item"
                type="submit"
                title={`Duplicates week ${latestWeek} and deploys week ${latestWeek + 1} immediately`}
              >
                Deploy week {latestWeek + 1}
              </button>
            </form>
            <form action={addWeekSheetAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="fromWeek" value={latestWeek} />
              <button
                className="week-actions-menu-item"
                type="submit"
                title={`Adds week ${latestWeek + 1} as a draft, copied from week ${latestWeek}`}
              >
                + Sheet from week {latestWeek}
              </button>
            </form>
            <form action={addWeekSheetAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <button
                className="week-actions-menu-item"
                type="submit"
                title={`Adds week ${latestWeek + 1} as a blank draft`}
              >
                + Blank week {latestWeek + 1}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
