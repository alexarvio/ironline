"use client";

import { ReactNode, useState } from "react";
import { ChevronDownIcon } from "./icons";

// Collapsible day container for the coach/admin program builder — same
// accordion idea as the client-side TrainingDayCard, but the header needs
// to hold an editable label input (DayLabelForm) alongside static text, so
// the toggle is a clickable div rather than a literal <button> (a <button>
// can't legally contain an <input>). Clicks inside labelSlot are stopped
// from bubbling so editing the label doesn't also collapse the card; the
// chevron has its own button for a clear, dedicated toggle target too.
export default function AdminDayCard({
  dayName,
  labelSlot,
  statusPill,
  summary,
  isRest,
  defaultOpen,
  children,
}: {
  dayName: string;
  labelSlot: ReactNode;
  statusPill: ReactNode;
  summary: string;
  isRest: boolean;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`admin-day-card${isRest ? " rest" : ""}`}>
      <div
        className="admin-day-card-toggle"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <div className="admin-day-card-head-left">
          <span className="day-name">{dayName}</span>
          <div className="inline-row" onClick={(e) => e.stopPropagation()}>
            {labelSlot}
          </div>
        </div>
        <div className="admin-day-card-head-right">
          <span className="admin-day-summary">{summary}</span>
          {statusPill}
          <button
            type="button"
            className="admin-day-chevron-btn"
            aria-label={open ? "Collapse day" : "Expand day"}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
          >
            <span className={`admin-day-chevron${open ? " open" : ""}`}>
              <ChevronDownIcon />
            </span>
          </button>
        </div>
      </div>
      {open && <div className="admin-day-card-body">{children}</div>}
    </div>
  );
}
