"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useTrainingFocus } from "./CheckInContext";

// Read-only week switcher for the client's own Training tab — every
// existing week's content is pre-rendered server-side (see TrainingTab in
// page.tsx) and handed in here; switching weeks is a pure client-side
// toggle, no navigation, so it can't disturb AppShell/HomeHub's own
// sub-view state. Defaults to whichever week getCurrentWeekNumber()
// computed, i.e. "current week deploys by default" every time the app opens.
//
// With `banner`, the week chips sit at the foot of the Training banner and
// the week's content (its Days trained card first) follows under it.
export default function ClientWeekSwitcher({
  weeks,
  currentWeek,
  contents,
  weekLabels,
  completedWeeks = [],
  banner,
}: {
  weeks: number[];
  currentWeek: number;
  contents: Record<number, ReactNode>;
  // Program-relative labels ("Week 1".."Week N") — falls back to the raw
  // week number when there's no deployed program to derive them from.
  weekLabels?: Record<number, string>;
  // Weeks where every planned set on every training day has been logged.
  // Ticked in the switcher so the client sees the programme filling in.
  completedWeeks?: number[];
  /** The banner's top (brand, programme, progress), rendered by the server page. */
  banner?: ReactNode;
}) {
  // A coach message's link can land on an earlier week; otherwise this one.
  const focus = useTrainingFocus();
  const [selected, setSelected] = useState(() =>
    focus?.week != null && weeks.includes(focus.week) && focus.week <= currentWeek ? focus.week : currentWeek
  );
  // With more weeks than fit, the strip scrolls and always opens with the
  // current week in the same place: just in from the left edge, with a sliver
  // of last week showing behind it so the row reads as scrollable. Week 1 has
  // nothing to peek at and sits flush left; near the end of the programme the
  // strip cannot scroll that far, so the current week drifts right on its own.
  const scrolls = weeks.length > 3;
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !scrolls) return;
    const anchor = strip.querySelector<HTMLElement>(`[data-week="${currentWeek}"]`);
    if (!anchor) return;
    // 20px of the previous chip plus the 8px gap. The browser clamps the
    // result to the scrollable range at both ends.
    const peek = 28;
    strip.scrollLeft += anchor.getBoundingClientRect().left - strip.getBoundingClientRect().left - peek;
  }, [currentWeek, scrolls]);

  // Weeks ahead of the current one are locked: the client can see the
  // programme has a Week 4, but not what is in it until that week arrives.
  // Training ahead of the plan defeats the coach's progression, and a
  // visible-but-locked week is a better promise than a hidden one.
  const isLocked = (w: number) => w > currentWeek;

  const strip =
    weeks.length > 1 ? (
      <div className={`tr-weeks${scrolls ? " scroll" : ""}`} ref={stripRef}>
        {weeks.map((w) => {
          const done = completedWeeks.includes(w);
          const locked = isLocked(w);
          return (
            <button
              key={w}
              type="button"
              data-week={w}
              className={`tr-wk${w === selected ? " on" : ""}${done ? " done" : ""}${locked ? " locked" : ""}`}
              onClick={() => setSelected(w)}
              aria-pressed={w === selected}
              aria-disabled={locked}
              title={locked ? "Unlocks when this week starts" : done ? "Week complete, every set logged" : undefined}
            >
              {weekLabels?.[w] ?? `Week ${w}`}
              {locked ? (
                <span className="tr-wk-lock" aria-label="Locked until this week starts">
                  <LockIcon />
                </span>
              ) : done ? (
                <span className="tr-wk-tick" aria-label="Week complete">
                  ✓
                </span>
              ) : (
                w === currentWeek && <span className="tr-wk-dot" aria-label="This week" />
              )}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div>
      {banner != null ? (
        <header className="tr-banner">
          <span className="tr-banner-glow" aria-hidden="true" />
          {banner}
          {strip}
        </header>
      ) : (
        strip
      )}
      {isLocked(selected) ? (
        <div className="week-locked-card">
          <span className="week-locked-icon" aria-hidden="true">
            <LockIcon />
          </span>
          <div>
            <div className="week-locked-title">{weekLabels?.[selected] ?? `Week ${selected}`} is locked</div>
            <div className="week-locked-sub">
              It opens when the week starts. Finish this week&rsquo;s sessions first. Your coach builds each
              week on the last.
            </div>
          </div>
        </div>
      ) : (
        contents[selected]
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
