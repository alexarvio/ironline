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
}: {
  weeks: number[];
  currentWeek: number;
  contents: Record<number, ReactNode>;
  // Program-relative labels ("Week 1".."Week N") — falls back to the raw
  // week number when there's no deployed program to derive them from.
  weekLabels?: Record<number, string>;
}) {
  const [selected, setSelected] = useState(currentWeek);

  return (
    <div>
      {weeks.length > 1 && (
        <div className="week-switcher" style={{ marginBottom: 14 }}>
          {weeks.map((w) => (
            <button
              key={w}
              type="button"
              className={`toggle-btn${w === selected ? " active" : ""}`}
              onClick={() => setSelected(w)}
            >
              {weekLabels?.[w] ?? `Week ${w}`}
              {w === currentWeek && <span className="week-current-dot" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      {contents[selected]}
    </div>
  );
}
