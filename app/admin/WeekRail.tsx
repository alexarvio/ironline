"use client";

import { useEffect, useRef, useState } from "react";
import { addProgramWeekAction, removeProgramWeekAction } from "../lib/actions";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";

export type RailDay = { dayOfWeek: number; state: "trained" | "missed" | "rest"; title: string };
export type RailWeek = {
  weekNumber: number;
  label: string;
  days: RailDay[];
  meta: string;
  isLive: boolean;
  /** Shows the remove control. False for live/past weeks and for the only week. */
  removable: boolean;
};

// The week rail: one capsule per week of the programme.
//
// The ticks report what the client ACTUALLY trained, not what was planned.
// A day the coach built but the client skipped reads differently from a rest
// day, so adherence is visible at a glance rather than inferred by opening
// each week in turn.
export default function WeekRail({
  weeks,
  selectedWeek,
  nextWeekNumber,
  copyFromWeek,
  clientId,
  programId,
  onSelect,
}: {
  weeks: RailWeek[];
  selectedWeek: number;
  nextWeekNumber: number;
  /** The most recent week that has a split — the one worth cloning. */
  copyFromWeek: number | null;
  clientId: number;
  programId: number | null;
  onSelect: (week: number) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // A popover, not an expansion: the rail must never reflow while the coach
  // is aiming at it.
  useEffect(() => {
    if (!addOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAddOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setAddOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [addOpen]);

  return (
    <div className="pb-rail-wrap" ref={wrapRef}>
      <div className="pb-rail">
        {weeks.map((w) => (
          // Wrapper so the remove control can sit on the capsule's corner
          // without nesting a button inside a button.
          <div key={w.weekNumber} className="pb-week-wrap">
            <button
              type="button"
              className={`pb-week-capsule${w.weekNumber === selectedWeek ? " selected" : ""}`}
              onClick={() => onSelect(w.weekNumber)}
              aria-pressed={w.weekNumber === selectedWeek}
            >
              <span className="pb-week-top">
                <span className="pb-week-label">{w.label}</span>
                {w.isLive && <span className="pb-week-dot" title="Current week" aria-hidden="true" />}
              </span>
              <span className="pb-week-ticks">
                {w.days.map((d) => (
                  <span key={d.dayOfWeek} className={`pb-week-tick ${d.state}`} title={d.title} />
                ))}
              </span>
              <span className="pb-week-meta">{w.meta}</span>
            </button>
            {w.removable && programId != null && (
              <span className="pb-week-remove">
                <ConfirmDeleteButton
                  action={removeProgramWeekAction}
                  hiddenFields={{ clientId, programId, week: w.weekNumber }}
                  label={`Remove ${w.label}`}
                  description="Its exercises and anything logged on them are deleted, and the weeks after it move up one."
                />
              </span>
            )}
          </div>
        ))}

        <button
          type="button"
          className={`pb-week-capsule pb-week-add${addOpen ? " open" : ""}`}
          onClick={() => setAddOpen((o) => !o)}
          aria-expanded={addOpen}
        >
          <span className="pb-week-add-label">+ Add week</span>
          <span className="pb-week-meta">Week {nextWeekNumber}</span>
        </button>
      </div>

      {addOpen && (
        <div className="pb-add-pop" role="dialog" aria-label={`Add week ${nextWeekNumber}`}>
          <div className="pb-add-pop-top">
            <span className="pb-add-pop-title">Add week {nextWeekNumber}</span>
            <button type="button" className="pb-add-pop-x" onClick={() => setAddOpen(false)} aria-label="Cancel">
              ×
            </button>
          </div>
          <div className="pb-add-pop-actions">
            <form action={addProgramWeekAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="programId" value={programId ?? ""} />
              <button type="submit" className="pb-add-blank">
                Blank week
              </button>
            </form>
            {/* Clones the last week that has a split, not the trailing week —
                otherwise this is a no-op precisely when a coach reaches for
                it, which is right after adding an empty week. */}
            {copyFromWeek != null && (
              <form action={addProgramWeekAction}>
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="programId" value={programId ?? ""} />
                <input type="hidden" name="copyFrom" value={copyFromWeek} />
                <button type="submit" className="pb-add-copy">
                  Copy week {copyFromWeek} split
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
