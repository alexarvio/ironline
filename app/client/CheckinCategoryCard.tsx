"use client";

import { ReactNode, useState } from "react";
import { ChevronDownIcon } from "../components/icons";

// Collapsed-by-default category container for the client Tracker tab —
// same accordion pattern as TrainingDayCard, so "Daily check-in" and
// "Weekly check-in" read as two containers you open rather than one long
// wall of unlabeled inputs. The metrics inside each are passed as children
// (a plain-data list rendered by the server component that owns them), so
// this stays a thin client wrapper with no data-layer imports.
export default function CheckinCategoryCard({
  title,
  subtitle,
  statusLabel,
  statusDone,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle: string;
  statusLabel: string;
  statusDone: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="checkin-card">
      <button
        type="button"
        className="checkin-card-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div>
          <div className="checkin-card-title">{title}</div>
          <div className="checkin-card-subtitle">{subtitle}</div>
        </div>
        <div className="checkin-card-toggle-right">
          <span className={`checkin-status-pill${statusDone ? " done" : ""}`}>{statusLabel}</span>
          <span className={`checkin-chevron${open ? " open" : ""}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </button>
      {open && <div className="checkin-card-body">{children}</div>}
    </div>
  );
}
