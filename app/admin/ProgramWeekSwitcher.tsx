"use client";

import { ReactNode, useState } from "react";

// Lives inside one program card: every week's days are pre-rendered
// server-side (see renderDays in ProgramBuilder) and handed in here as
// weekContents, so switching weeks is a pure client-side toggle — no
// navigation, no data fetch, and independent of any other program card's
// own week switcher on the same page. Mirrors the client's own
// ClientWeekSwitcher for the same reason: only the currently-selected
// week's content needs to exist in the DOM.
export default function ProgramWeekSwitcher({
  totalWeeks,
  defaultWeek,
  weekContents,
}: {
  totalWeeks: number;
  defaultWeek: number;
  weekContents: Record<number, ReactNode>;
}) {
  const [selected, setSelected] = useState(defaultWeek);
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <div>
      {totalWeeks > 1 && (
        <div className="week-switcher" style={{ marginBottom: 14 }}>
          {weeks.map((w) => (
            <button
              key={w}
              type="button"
              className={`toggle-btn${w === selected ? " active" : ""}`}
              onClick={() => setSelected(w)}
            >
              Week {w}
              {w === defaultWeek && <span className="week-current-dot" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      {weekContents[selected]}
    </div>
  );
}
