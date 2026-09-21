"use client";

import type { CSSProperties } from "react";
import type { PhaseChrome } from "./phaseChrome";

// The phase dialog's calendar.
//
// Always six rows. It used to count the rows from the month — October five,
// November six — so the dialog jumped in height as the coach paged through
// months. Now the grid starts on the Monday on or before the 1st and is
// always 42 days; the neighbouring months' days fill the gaps in grey and
// can still be clicked. The month bar never changes the dialog's height by
// a pixel.
//
// The first column is the ISO week, which is what explains whole-week
// snapping without a line of help text: the rows inside the selection
// number themselves in the state's colour.
//
// What is picked is drawn in the phase's STATE colours (phaseChrome): a band
// with a solid pill at each end, and for a draft a dashed edge as well —
// dashed means draft and nothing else. Other phases on the same track are a
// short grey bar under the date, never an outline or a fill, so they can
// never be read as the selection; inside the selection that bar turns red.
//
// It only draws and reports clicks. Which end a click sets is the dialog's
// business: it knows which field is armed.

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => new Date(`${s}T00:00:00`);
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const mondayOf = (s: string) => addDays(s, -((parse(s).getDay() + 6) % 7));
export const isoWeek = (day: string) => {
  const thursday = parse(addDays(mondayOf(day), 3));
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1.getTime()) / 86400000 / 7) + 1;
};
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Another phase on the track, first day to last day. */
export type PlannedRange = { name: string; from: string; to: string };
/** The month on show: its year and 0-based month. */
export type CalMonth = { y: number; m: number };

export const monthOf = (day: string): CalMonth => {
  const d = parse(day);
  return { y: d.getFullYear(), m: d.getMonth() };
};

export default function PhaseCalendar({
  month,
  onMonth,
  from,
  to,
  onPick,
  planned,
  chrome,
}: {
  month: CalMonth;
  onMonth: (m: CalMonth) => void;
  /** The selection's first and last day; empty while nothing is picked. */
  from: string;
  to: string;
  onPick: (day: string) => void;
  planned: PlannedRange[];
  chrome: PhaseChrome;
}) {
  const gridStart = mondayOf(iso(new Date(month.y, month.m, 1)));
  // 42 days, unconditionally: six rows whatever the month.
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const step = (n: number) => {
    const d = new Date(month.y, month.m + n, 1);
    onMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const inRange = (day: string) => !!from && !!to && day >= from && day <= to;
  const label = (day: string) => parse(day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const vars = { "--sel-band": chrome.band, "--sel-edge": chrome.edge } as CSSProperties;

  return (
    <div className={`pl-cal${chrome.dashed ? " draft" : ""}`} style={vars}>
      <div className="pl-cal-month">
        <button type="button" className="pl-cal-nav" onClick={() => step(-1)} aria-label="Previous month">
          ‹
        </button>
        <span>{new Date(month.y, month.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
        <button type="button" className="pl-cal-nav" onClick={() => step(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="pl-cal-weekdays" aria-hidden="true">
        <span />
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="pl-cal-grid">
        {Array.from({ length: 6 }, (_, row) => {
          const week = days.slice(row * 7, row * 7 + 7);
          const rowIn = week.some(inRange);
          return [
            <span key={`w${row}`} className={`pl-cal-wk${rowIn ? " in" : ""}`} aria-hidden="true">
              W{isoWeek(week[0])}
            </span>,
            ...week.map((day, col) => {
              const picked = inRange(day);
              const isFrom = picked && day === from;
              const isTo = picked && day === to;
              const busy = planned.find((p) => day >= p.from && day <= p.to);
              const cls = [
                "pl-cal-day",
                parse(day).getMonth() === month.m ? "" : "out",
                picked ? "in" : "",
                isFrom || isTo ? "end" : "",
                // Rounded at the selection's two ends and at each row's edges,
                // so every selected week reads as one bar.
                picked && (isFrom || col === 0) ? "l" : "",
                picked && (isTo || col === 6) ? "r" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={day}
                  type="button"
                  className={cls}
                  onClick={() => onPick(day)}
                  aria-label={label(day)}
                  aria-pressed={picked}
                  title={busy ? `${busy.name} is planned here` : undefined}
                >
                  {parse(day).getDate()}
                  {busy && <i className={`pl-cal-planned${picked ? " clash" : ""}`} aria-hidden="true" />}
                </button>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}
