import type { ReactNode } from "react";

// When a phase or an event runs, big enough to read at a glance (23 Oct, Alex: "dates a bit clearer", the pop-ups
// felt empty): each day as the Meetings tile does it, the month over the day, its weekday under, the end after a
// faint arrow; how long and where it stands beside them. One part for the Phases screen's two pop-ups.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Day({ date, year }: { date: string; year: boolean }) {
  const d = new Date(`${date}T12:00:00`);
  return (
    <span className="dsp-day">
      <small>
        {MONTHS[d.getMonth()]}
        {year ? ` ${d.getFullYear()}` : ""}
      </small>
      <b>{d.getDate()}</b>
      <em>{WEEKDAYS[d.getDay()]}</em>
    </span>
  );
}

/** start and end as yyyy-mm-dd; end null for a repeat with no end ("No end" in its place). */
export default function DateSpan({ start, end, today, facts }: { start: string; end: string | null; today: string; /** How long over where it stands, on the right (24 Oct, Alex: a single day only where it stands). */ facts: ReactNode[] }) {
  const thisYear = today.slice(0, 4);
  const shown = facts.filter((f) => f != null && f !== false && f !== "");
  return (
    <div className="dsp">
      <span className="dsp-days">
        <Day date={start} year={start.slice(0, 4) !== thisYear} />
        {end !== start && (
          <>
            <span className="dsp-arrow" aria-hidden="true">
              →
            </span>
            {end ? (
              <Day date={end} year={end.slice(0, 4) !== thisYear} />
            ) : (
              <span className="dsp-day open">
                <b>No end</b>
              </span>
            )}
          </>
        )}
      </span>
      {shown.length > 0 && (
        <span className="dsp-facts">
          {shown.map((f, i) => (
            <span key={i}>{f}</span>
          ))}
        </span>
      )}
    </div>
  );
}
