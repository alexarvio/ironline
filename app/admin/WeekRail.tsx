"use client";

import { useEffect, useRef, useState } from "react";
import { addProgramWeekAction } from "../lib/actions";
import { placePopover, type Placement } from "../components/popover";

const ADD_POP_WIDTH = 172;

export type RailDay = { dayOfWeek: number; state: "trained" | "missed" | "rest"; title: string };
export type RailWeek = {
  weekNumber: number;
  label: string;
  days: RailDay[];
  meta: string;
  isLive: boolean;
  hasNew?: boolean;
};

// The week rail: one capsule per week of the programme. Removing a week is
// not done here: the bin sat on the capsule's corner and crowded it, so it
// is on the selected week's heading row under the rail (ProgramBuilderShell).
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
  const railRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // It was pinned to the left edge of the rail at a hard-coded 66px down,
  // which on a five-week programme opened it a whole rail away from the
  // button that was clicked. It belongs under that button.
  const [addPos, setAddPos] = useState<Placement | null>(null);
  const placeAdd = () => setAddPos(placePopover(addRef.current, { width: ADD_POP_WIDTH, maxHeight: 200, minHeight: 120 }));

  useEffect(() => {
    if (!addOpen) return;
    // The rail scrolls sideways; keep the popover with its button.
    window.addEventListener("scroll", placeAdd, true);
    window.addEventListener("resize", placeAdd);
    return () => {
      window.removeEventListener("scroll", placeAdd, true);
      window.removeEventListener("resize", placeAdd);
    };
  }, [addOpen]);

  // When a week is added the rail grows past the right edge and the new
  // capsule is off screen, so the coach loses count. On growth, scroll the
  // rail to its end and select the new week so what was just added is what
  // is being looked at. Tracks the count so a re-render from anything else
  // (a set logged, a rename) leaves the scroll position alone.
  const prevCount = useRef(weeks.length);
  useEffect(() => {
    if (weeks.length > prevCount.current) {
      const last = weeks[weeks.length - 1];
      onSelect(last.weekNumber);
      setAddOpen(false);
      const rail = railRef.current;
      if (rail) {
        // Now, and again a tick later once the new capsule has its width
        // (a timeout, not requestAnimationFrame, which never fires while the
        // tab is in the background).
        rail.scrollLeft = rail.scrollWidth;
        setTimeout(() => {
          rail.scrollLeft = rail.scrollWidth;
        }, 60);
      }
    }
    prevCount.current = weeks.length;
  }, [weeks, onSelect]);

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
      <div className="pb-rail" ref={railRef}>
        {weeks.map((w) => (
          <div key={w.weekNumber} className={`pb-week-wrap${w.weekNumber === selectedWeek ? " selected" : ""}`}>
            <button
              type="button"
              className={`pb-week-capsule${w.weekNumber === selectedWeek ? " selected" : ""}`}
              onClick={() => onSelect(w.weekNumber)}
              aria-pressed={w.weekNumber === selectedWeek}
            >
              <span className="pb-week-top">
                <span className="pb-week-label">{w.label}</span>
                {w.isLive && <span className="pb-week-dot" title="Current week" aria-hidden="true" />}
                {w.hasNew && <span className="ad-new-dot" title="Something new from the client in this week" />}
              </span>
              <span className="pb-week-ticks">
                {w.days.map((d) => (
                  <span key={d.dayOfWeek} className={`pb-week-tick ${d.state}`} title={d.title} />
                ))}
              </span>
              <span className="pb-week-meta">{w.meta}</span>
            </button>
          </div>
        ))}

        <button
          ref={addRef}
          type="button"
          className={`pb-week-capsule pb-week-add${addOpen ? " open" : ""}`}
          onClick={() => {
            if (!addOpen) placeAdd();
            setAddOpen((o) => !o);
          }}
          aria-expanded={addOpen}
        >
          <span className="pb-week-add-label">+ Add week</span>
          <span className="pb-week-meta">Week {nextWeekNumber}</span>
        </button>
      </div>

      {addOpen && (
        <div
          className="pb-add-pop"
          role="dialog"
          aria-label={`Add week ${nextWeekNumber}`}
          style={addPos ?? undefined}
        >
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
