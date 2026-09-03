"use client";

import { ReactNode, useState } from "react";

// Read-only week switcher for the client's own Training tab — every
// existing week's content is pre-rendered server-side (see TrainingTab in
// page.tsx) and handed in here; switching weeks is a pure client-side
// toggle, no navigation, so it can't disturb AppShell/HomeHub's own
// sub-view state. Defaults to whichever week getCurrentWeekNumber()
// computed, i.e. "current week deploys by default" every time the app opens.
export default function ClientWeekSwitcher({
  weeks,
  currentWeek,
  contents,
  weekLabels,
  completedWeeks = [],
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
}) {
  const [selected, setSelected] = useState(currentWeek);

  // Weeks ahead of the current one are locked: the client can see the
  // programme has a Week 4, but not what is in it until that week arrives.
  // Training ahead of the plan defeats the coach's progression, and a
  // visible-but-locked week is a better promise than a hidden one.
  const isLocked = (w: number) => w > currentWeek;

  return (
    <div>
      {weeks.length > 1 && (
        <div className="week-switcher" style={{ marginBottom: 14 }}>
          {weeks.map((w) => {
            const done = completedWeeks.includes(w);
            const locked = isLocked(w);
            return (
              <button
                key={w}
                type="button"
                className={`toggle-btn${w === selected ? " active" : ""}${done ? " done" : ""}${locked ? " locked" : ""}`}
                onClick={() => setSelected(w)}
                aria-disabled={locked}
                title={
                  locked
                    ? "Unlocks when this week starts"
                    : done
                      ? "Week complete, every set logged"
                      : undefined
                }
              >
                {weekLabels?.[w] ?? `Week ${w}`}
                {locked ? (
                  <span className="week-lock" aria-label="Locked until this week starts">
                    <LockIcon />
                  </span>
                ) : done ? (
                  <span className="week-done-tick" aria-label="Week complete">
                    ✓
                  </span>
                ) : (
                  w === currentWeek && <span className="week-current-dot" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
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
