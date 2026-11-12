"use client";

import { useDiaryDay } from "./CheckInContext";
import { ChevronRightIcon } from "../components/icons";

export type LastWeekDay = {
  date: string;
  label: string;
  type: string;
  note: string;
  kcal: number;
  delta: { text: string; tone: string };
};

// Nutrition's Last 7 days, at the foot of the diary (12 Nov, Alex: a tap opens the day in the diary): a tap moves the
// diary above to that day, the screen going back to its top, where its meals are as on any day. Outside the diary
// (nothing to open it in), the rows are figures alone.
export default function LastWeekDays({ days }: { days: LastWeekDay[] }) {
  const showDay = useDiaryDay();
  return (
    <>
      {days.map((d) => {
        const figures = (
          <>
            <span>
              <span className="nd-day-date">{d.label}</span>
              <span className="nd-day-type">{d.type}</span>
            </span>
            <span className="nd-day-note">
              {showDay && (
                <span className="nd-day-chev" aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              )}
              {d.note}
            </span>
            <span className="nd-day-kcal">{d.kcal.toLocaleString("en-US")}</span>
            <span className={`nd-day-delta ${d.delta.tone}`}>{d.delta.text}</span>
          </>
        );
        // Each in its own wrap, so rows are parted by space alone, never the old lines between neighbours.
        return (
          <div key={d.date} className="nd-day-wrap">
            {showDay ? (
              <button type="button" className="nd-day nd-day-btn" onClick={() => showDay(d.date)}>
                {figures}
              </button>
            ) : (
              <div className="nd-day">{figures}</div>
            )}
          </div>
        );
      })}
    </>
  );
}
