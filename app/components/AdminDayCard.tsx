"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDownIcon, DumbbellIcon, HeartbeatIcon } from "./icons";
import { useExpandSignal } from "../admin/BuilderContext";
import { markSeenAction } from "../lib/actions";

// Collapsible day container for the coach/admin program builder — same
// accordion idea as the client-side TrainingDayCard, but the header needs
// to hold an editable label input (DayLabelForm) alongside static text, so
// the toggle is a clickable div rather than a literal <button> (a <button>
// can't legally contain an <input>). Clicks inside labelSlot and restSlot
// are stopped from bubbling so editing the label or marking a rest day
// doesn't also collapse the card; the chevron has its own button for a
// clear, dedicated toggle target too.
//
// A session holds two tables with nothing in common but the session: what
// the client lifts and their cardio. They used to sit one under the other,
// the cardio table squeezed into the exercise table's columns. Now the
// header has a dumbbell / heart toggle and the body shows one at a time,
// each with its own columns. Both stay mounted (one hidden), so a half-typed
// add row survives a look at the other.
export type SessionMode = "exercises" | "cardio";

export default function AdminDayCard({
  dayName,
  labelSlot,
  restSlot,
  menuSlot,
  footSlot,
  statusPill,
  gymSlot,
  summary,
  isRest,
  defaultOpen,
  defaultMode = "exercises",
  news,
  exercises,
  cardio,
}: {
  dayName: string;
  labelSlot: ReactNode;
  restSlot?: ReactNode;
  /** The session's ⋯ menu (duplicate, delete); always the last thing in the header. */
  menuSlot?: ReactNode;
  /** Rendered under the body, open or closed: the pending-changes bar. */
  footSlot?: ReactNode;
  statusPill?: ReactNode;
  /** Where the client trained this session, when they have more than one gym. */
  gymSlot?: ReactNode;
  summary: string;
  isRest: boolean;
  defaultOpen: boolean;
  /** Set while this session has news the coach has not opened: the card
      carries the dot, and opening it is having seen it. */
  news?: { clientId: number; dayId: number };
  /** Which table the session opens on: cardio only when it has cardio and no exercises. */
  defaultMode?: SessionMode;
  exercises: ReactNode;
  cardio: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<SessionMode>(defaultMode);
  // Picking a table on a folded session opens it on that table.
  const show = (m: SessionMode) => {
    setMode(m);
    setOpen(true);
  };

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

  const newsDay = news?.dayId ?? null;
  const newsClient = news?.clientId ?? null;
  useEffect(() => {
    if (open && newsDay != null && newsClient != null) void markSeenAction(newsClient, { dayId: newsDay });
  }, [open, newsDay, newsClient]);

  return (
    <div className={`admin-day-card${isRest ? " rest" : ""}${open ? " open" : ""}`}>
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
          {/* The name IS the title: unnamed it reads "Session 1", named it
              reads the name. Clicking it turns it into a field. */}
          <div className="inline-row day-name" onClick={(e) => e.stopPropagation()}>
            {labelSlot}
            {news && <span className="ad-new-dot" title="Something new from the client on this session" />}
          </div>
          {statusPill}
        </div>
        {/* The name has the left to itself, whole; what is in the session
            ("5 exercises · 1 cardio", or "Nothing yet") sits on the right
            with the toggle and the ⋯. */}
        <div className="admin-day-card-head-right">
          {gymSlot}
          <span className="admin-day-summary">{summary}</span>
          {restSlot && (
            <div className="inline-row" onClick={(e) => e.stopPropagation()}>
              {restSlot}
            </div>
          )}
          {/* Clicks and keys stop here: the whole header is the fold toggle,
              and Enter on one of these must not fold the card instead. */}
          <div className="pb-mode" role="group" aria-label="Show" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <button type="button" className={mode === "exercises" ? "on" : undefined} aria-pressed={mode === "exercises"} aria-label="Exercises" title="Exercises" onClick={() => show("exercises")}>
              <DumbbellIcon />
            </button>
            <button type="button" className={mode === "cardio" ? "on" : undefined} aria-pressed={mode === "cardio"} aria-label="Cardio" title="Cardio" onClick={() => show("cardio")}>
              <HeartbeatIcon />
            </button>
          </div>
          {menuSlot && (
            <div className="inline-row" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {menuSlot}
            </div>
          )}
        </div>
      </div>
      {open && (
        <div className="admin-day-card-body">
          <div hidden={mode !== "exercises"}>{exercises}</div>
          <div hidden={mode !== "cardio"}>{cardio}</div>
        </div>
      )}
      {footSlot}
    </div>
  );
}
