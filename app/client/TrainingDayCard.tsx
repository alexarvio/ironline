"use client";

import { ReactNode, useState } from "react";
import { ChevronDownIcon } from "../components/icons";

// Collapsed-by-default day container — tap the header (or the chevron) to
// reveal that day's exercises. Keeps the Training tab scannable as a list of
// days instead of a wall of always-open cards; the exercise rows themselves
// are still rendered server-side (passed in as children) so this stays a
// thin client wrapper with no data-layer imports of its own.
export default function TrainingDayCard({
  name,
  label,
  doneCount,
  totalCount,
  defaultOpen = false,
  children,
}: {
  name: string;
  label: string | null;
  doneCount: number;
  totalCount: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const allDone = totalCount > 0 && doneCount === totalCount;

  return (
    <div className="training-day-card">
      <button
        type="button"
        className="training-day-card-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div>
          <div className="training-day-card-name">{name}</div>
          {label && <div className="training-day-card-label">{label}</div>}
        </div>
        <div className="training-day-card-toggle-right">
          <span className={`training-day-progress-pill${allDone ? " done" : ""}`}>
            {doneCount}/{totalCount} done
          </span>
          <span className={`training-day-chevron${open ? " open" : ""}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </button>
      {open && <div className="training-day-card-body">{children}</div>}
    </div>
  );
}
