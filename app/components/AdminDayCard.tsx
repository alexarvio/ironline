"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "./icons";
import { useExpandSignal } from "../admin/BuilderContext";

// Collapsible day container for the coach/admin program builder — same
// accordion idea as the client-side TrainingDayCard, but the header needs
// to hold an editable label input (DayLabelForm) alongside static text, so
// the toggle is a clickable div rather than a literal <button> (a <button>
// can't legally contain an <input>). Clicks inside labelSlot and restSlot
// are stopped from bubbling so editing the label or marking a rest day
// doesn't also collapse the card; the chevron has its own button for a
// clear, dedicated toggle target too.
export default function AdminDayCard({
  dayName,
  labelSlot,
  restSlot,
  statusPill,
  summary,
  isRest,
  defaultOpen,
  children,
}: {
  dayName: string;
  labelSlot: ReactNode;
  restSlot?: ReactNode;
  statusPill?: ReactNode;
  summary: string;
  isRest: boolean;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // "Expand all" / "Collapse all" in the builder toolbar. The signal is a
  // counter rather than a boolean so pressing the same option twice still
  // reaches a card the coach has since toggled by hand.
  const expand = useExpandSignal();
  const lastSignal = useRef(expand?.signal ?? 0);
  useEffect(() => {
    if (!expand || expand.signal === lastSignal.current) return;
    lastSignal.current = expand.signal;
    setOpen(expand.open);
  }, [expand]);

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
        <button
          type="button"
          className="admin-day-chevron-btn"
          aria-label={open ? `Collapse ${dayName}` : `Expand ${dayName}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          <span className={`admin-day-chevron${open ? " open" : ""}`}>
            <ChevronDownIcon />
          </span>
        </button>
        <div className="admin-day-card-head-left">
          <span className="day-name">{dayName}</span>
          <div className="inline-row" onClick={(e) => e.stopPropagation()}>
            {labelSlot}
          </div>
        </div>
        <div className="admin-day-card-head-right">
          <span className="admin-day-summary">{summary}</span>
          {statusPill}
          {restSlot && (
            <div className="inline-row" onClick={(e) => e.stopPropagation()}>
              {restSlot}
            </div>
          )}
        </div>
      </div>
      {open && <div className="admin-day-card-body">{children}</div>}
    </div>
  );
}
