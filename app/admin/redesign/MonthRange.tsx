"use client";

import "./month-range.css";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { ChevronLeftIcon } from "../../components/icons";
import type { phaseChrome } from "../phaseChrome";
import { dayMonth } from "../../lib/dayMonth";

// The one calendar in the admin (21 Oct, Alex: "use the one in phases, make
// them all scrollable"): the phase pop-up's month, also behind the Dates /
// Schedule pop-up, every DatePick and the meeting scheduler. Six weeks on
// screen; the arrows step a month, the wheel or a trackpad steps a week.
// Neutral unless the pop-up it sits in gives it a category's colour (the
// phase pop-up's track, the event pop-up's kind, via --npd-c in
// phase-dialog.css). Styles: month-range.css (rdd-).

const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return isoOf(x);
};
const mondayOf = (d: string) => addDays(d, -((parse(d).getDay() + 6) % 7));
const spokenDay = (d: string) => parse(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/** Six rows of weeks, the picked days marked, other phases on the track as a grey mark. One day picked: from = to = the day. */
export function MonthRange({
  from,
  to,
  onPick,
  chrome,
  planned,
  cursor,
  setCursor,
  today,
  plain = false,
  legend = "New phase",
  min,
  marks,
}: {
  from: string;
  to: string;
  onPick: (day: string) => void;
  /** The range's own colours, drawn inline; only read without `plain`. */
  chrome?: ReturnType<typeof phaseChrome>;
  planned: { name: string; from: string; to: string; draft?: boolean }[];
  cursor: string;
  setCursor: (m: string) => void;
  today: string;
  /** No colours of its own (20 Oct): the calendar's CSS draws the range, in ink unless the pop-up gives it a category's colour. */
  plain?: boolean;
  /** What the range is called under the month; null for none (an event's range needs no key). */
  legend?: string | null;
  /** The earliest day it takes (yyyy-mm-dd); days before it can't be picked. */
  min?: string;
  /** Something small under a day's number (the meeting scheduler's booking dots); null for nothing. */
  marks?: (day: string) => React.ReactNode;
}) {
  // Six weeks on screen from `view.start`. The arrows step a month; the wheel or a trackpad over the days steps a
  // week at a time (21 Oct, Alex). A day picked (the parent moves `cursor` to its month) leaves the weeks where they
  // are while that month is still on screen; a date typed further off brings its month up.
  const monthStart = (c: string) => mondayOf(`${c}-01`);
  const [view, setView] = useState({ cursor, start: monthStart(cursor) });
  let gridStart = view.start;
  if (view.cursor !== cursor) {
    const mid = `${cursor}-15`;
    gridStart = mid >= view.start && mid <= addDays(view.start, 41) ? view.start : monthStart(cursor);
    setView({ cursor, start: gridStart });
  }
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // The month named in the head, and the days that are dark: the one the middle of the six weeks falls in.
  const first = (() => {
    const mid = parse(addDays(gridStart, 17));
    return new Date(mid.getFullYear(), mid.getMonth(), 1);
  })();
  const mo = first.getMonth() + 1;
  const move = (n: number) => {
    const c = isoOf(new Date(first.getFullYear(), first.getMonth() + n, 1)).slice(0, 7);
    setCursor(c);
    setView({ cursor: c, start: monthStart(c) });
  };
  const gridRef = useRef<HTMLDivElement>(null);
  const wheel = useRef(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // A trackpad sends many small deltas: a week per 40px or so; a mouse notch is one week.
      wheel.current += e.deltaY;
      if (Math.abs(wheel.current) < 40) return;
      const step = wheel.current > 0 ? 1 : -1;
      wheel.current = 0;
      setView((v) => ({ ...v, start: addDays(v.start, step * 7) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const tinted = !plain && !!chrome;
  // What a day is to the new phase (15 Oct): taken by another phase on the track, in the new range, both (an overlap), or free.
  const kindOf = (x: string) => {
    const b = planned.some((p) => x >= p.from && x <= p.to);
    const r = !!from && !!to && x >= from && x <= to;
    return b && r ? "overlap" : r ? "new" : b ? "taken" : "free";
  };
  return (
    <div className="rdd-cal">
      <div className="rdd-cal-head">
        <b>{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
        <span className="rdd-cal-nav">
          <button type="button" className="rd-btn ghost sm" onClick={() => move(-1)} aria-label="Previous month">
            <ChevronLeftIcon />
          </button>
          <button type="button" className="rd-btn ghost sm next" onClick={() => move(1)} aria-label="Next month">
            <ChevronLeftIcon />
          </button>
        </span>
      </div>
      <div ref={gridRef} className="rdd-cal-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="rdd-dow">
            {d}
          </span>
        ))}
        {/* Taken days as grey stripes, the new phase solid at its ends and tinted between, an overlap in red stripes (15 Oct). Runs read as bars per week row. */}
        {days.map((d, i) => {
          const inR = !!from && !!to && d >= from && d <= to;
          const busy = planned.find((p) => d >= p.from && d <= p.to);
          const kind = kindOf(d);
          const col = i % 7;
          const prevSame = col > 0 && kindOf(days[i - 1]) === kind;
          const nextSame = col < 6 && kindOf(days[i + 1]) === kind;
          const run = kind === "free" ? "" : !prevSame && !nextSame ? " run-one" : !prevSame ? " run-start" : !nextSame ? " run-end" : " run-mid";
          const edge = d === from || d === to;
          const overlap = kind === "overlap";
          const tip = busy ? `${busy.name} · ${dayMonth(busy.from)} – ${dayMonth(busy.to)}${busy.draft ? " · draft" : ""}` : undefined;
          const mark = marks?.(d);
          const before = !!min && d < min;
          // Said after the day: what it is to the range or the track; nothing more when there is nothing to say.
          const status = overlap ? `overlaps ${busy!.name}` : inR ? (legend != null ? `in ${legend.toLowerCase()}` : from === to ? "picked" : "in range") : busy ? `taken by ${busy.name}` : planned.length > 0 ? "free" : "";
          return (
            <button
              key={d}
              type="button"
              className={`rdd-cell${d === today ? " today" : ""}${inR && !overlap ? " in" : ""}${overlap ? " overlap" : kind === "taken" ? " taken" : ""}${d === from ? " start" : ""}${d === to ? " end" : ""}${run}${parse(d).getMonth() !== mo - 1 ? " past" : ""}${before ? " before" : ""}`}
              style={tinted && inR && !overlap ? { background: edge ? chrome.edge : `rgba(${rgbOf(chrome.edge)}, 0.12)`, color: edge ? "#fff" : chrome.edge } : undefined}
              onClick={() => onPick(d)}
              disabled={before}
              aria-label={status ? `${spokenDay(d)}, ${status}` : spokenDay(d)}
              aria-pressed={edge}
              title={tip}
            >
              {Number(d.slice(8))}
              {mark != null && mark !== false && (
                <span className="rdd-marks" aria-hidden="true">
                  {mark}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {(planned.length > 0 || (!!from && !!to && legend != null)) && (
        <div className="rdd-legend" aria-hidden="true">
          {planned.length > 0 && (
            <span>
              <i className="taken" /> {planned.length === 1 ? `${planned[0].name} (taken)` : "Taken by other phases"}
            </span>
          )}
          {!!from && !!to && legend != null && (
            <span>
              <i className={tinted ? undefined : "new"} style={tinted ? { background: chrome.edge } : undefined} /> {legend}
            </span>
          )}
          {days.some((d) => kindOf(d) === "overlap") && (
            <span>
              <i className="overlap" /> Overlap
            </span>
          )}
        </div>
      )}
    </div>
  );
}
