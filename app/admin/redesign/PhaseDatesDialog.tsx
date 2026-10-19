"use client";

import "./phase-dates.css";
import { useState } from "react";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { ChevronLeftIcon, ChevronRightIcon } from "../../components/icons";
import DateText from "./DateText";

// When a programme or phase reaches the client: a month to click the dates
// on, and the same dates as fields to type into. A programme runs Monday to
// Sunday, so a click snaps to its week, and its length is however many weeks
// are on its rail, so only its start is picked and the end follows. A
// nutrition or lifestyle phase (byDay) has both ends open, on any day.
// In the admin hairline style (20 Oct, Alex): the title, one quiet line of
// the length and the dates, the name and the dates as clean lines, the month
// in ink and grey. No explanations. Classes are pdh-, in phase-dates.css.

const DAY = 86400000;
const parse = (d: string) => new Date(`${d}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (d: string, days: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + days);
  return isoOf(x);
};
const mondayOf = (d: string) => shift(d, -((parse(d).getDay() + 6) % 7));
const sundayOf = (d: string) => shift(mondayOf(d), 6);
const weeksBetween = (start: string, end: string) => Math.max(1, Math.round((parse(end).getTime() - parse(start).getTime() + DAY) / (7 * DAY)));
const fmt = (d: string) => parse(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fmtShort = (d: string) => parse(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const today = () => isoOf(new Date());

export default function PhaseDatesDialog({
  title,
  name,
  weeks,
  start,
  end,
  confirm,
  onConfirm,
  byDay = false,
}: {
  title: string;
  /** Editable when given: a draft programme is named here too. */
  name?: string;
  /** A set length in weeks (a programme's rail); the end follows the start. Absent: both ends are picked. */
  weeks?: number | null;
  start: string | null;
  end: string | null;
  /** Who and what it reaches: no longer said in the dialog (2 Oct); still passed. */
  firstName?: string;
  what?: string;
  confirm: string;
  /** `end` is the last day; `weeks`, how many weeks that makes (a programme's new length). */
  onConfirm: (v: { name: string; start: string; end: string; weeks: number }) => void;
  /** Any day, not whole weeks: a nutrition or lifestyle phase. `end` (given) is still its stored end_week. */
  byDay?: boolean;
}) {
  const fixed = weeks != null && weeks > 0;
  const nextMonday = mondayOf(shift(today(), 7));
  const initialStart = start ?? nextMonday;
  const [nm, setNm] = useState(name ?? "");
  const snap = (d: string) => (byDay ? d : mondayOf(d));
  const [from, setFrom] = useState(snap(initialStart));
  const [to, setTo] = useState(
    fixed ? shift(mondayOf(initialStart), weeks * 7 - 1) : byDay ? (end ? shift(end, 6) : shift(initialStart, 27)) : sundayOf(end && end >= initialStart ? end : shift(initialStart, 27))
  );
  // Opens on this month; a phase still to come opens on the month it starts.
  const [cursor, setCursor] = useState(() => (from > today() ? from : today()).slice(0, 7));
  // With both ends open, the first click sets the start and the next the end.
  const [picking, setPicking] = useState<"start" | "end">("start");

  // A programme keeps its length when its start moves (the length as it
  // stands, the rail's or changed here); its end can be typed too (2 Oct),
  // which changes how many weeks it has.
  const setStart = (d: string) => {
    const s = snap(d);
    setFrom(s);
    if (fixed) setTo(shift(s, weeksBetween(from, to) * 7 - 1));
    else if (to < s) setTo(byDay ? s : sundayOf(s));
    setCursor(s.slice(0, 7));
  };
  const setEnd = (d: string) => {
    const e = byDay ? d : sundayOf(d);
    if (e < from) {
      if (!fixed) setStart(d);
      return;
    }
    setTo(e);
  };
  const pick = (d: string) => {
    if (fixed || picking === "start") {
      setStart(d);
      if (!fixed) setPicking("end");
    } else {
      setEnd(d);
      setPicking("start");
    }
  };

  const [y, mo] = cursor.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(y, mo, 0).getDate();
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => isoOf(new Date(y, mo - 1, i + 1)))];
  // Always six rows, so the month never changes height as it turns.
  while (cells.length < 42) cells.push(null);
  const move = (n: number) => setCursor(isoOf(new Date(y, mo - 1 + n, 1)).slice(0, 7));
  const length = weeksBetween(from, to);
  const days = Math.round((parse(to).getTime() - parse(from).getTime()) / DAY) + 1;
  const lengthLabel = byDay
    ? [Math.floor(days / 7), days % 7].map((n, i) => (n ? `${n} ${i === 0 ? "week" : "day"}${n === 1 ? "" : "s"}` : "")).filter(Boolean).join(" ")
    : `${length} ${length === 1 ? "week" : "weeks"}`;
  const ok = (!name || nm.trim().length > 0) && from <= to;
  const now = today();

  return (
    <DialogContent className="pdh">
      <div className="pdh-head">
        <DialogTitle className="pdh-title">{title}</DialogTitle>
      </div>
      {/* The one fact line: how long, from when to when (20 Oct: no explanations). */}
      <DialogDescription className="pdh-what">{[lengthLabel, `${fmtShort(from)} – ${fmtShort(to)}`].filter(Boolean).join(" · ")}</DialogDescription>
      {name !== undefined && (
        <label className="pdh-field pdh-name">
          <span className="pdh-label">Name</span>
          <input className="pdh-input" value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Strength Block" maxLength={60} />
        </label>
      )}
      <div className="pdh-cols">
        <div className="pdh-cal">
          <div className="pdh-cal-head">
            <b>{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
            <span className="pdh-cal-nav">
              <button type="button" className="pdh-nav" onClick={() => move(-1)} aria-label="Previous month">
                <ChevronLeftIcon />
              </button>
              <button type="button" className="pdh-nav" onClick={() => move(1)} aria-label="Next month">
                <ChevronRightIcon />
              </button>
            </span>
          </div>
          <div className="pdh-grid">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} className="pdh-dow">
                {d}
              </span>
            ))}
            {cells.map((d, i) =>
              d ? (
                <button
                  key={i}
                  type="button"
                  className={`pdh-cell${d === now ? " today" : ""}${d >= from && d <= to ? " in" : ""}${d === from ? " start" : ""}${d === to ? " end" : ""}${d < now ? " past" : ""}`}
                  onClick={() => pick(d)}
                  aria-label={fmt(d)}
                  aria-pressed={d === from || d === to}
                >
                  {Number(d.slice(8))}
                </button>
              ) : (
                <span key={i} />
              )
            )}
          </div>
        </div>
        {/* With both ends open, the end the next click sets has its label in ink (no "click a day" line). */}
        <div className="pdh-fields">
          <label className={`pdh-field${!fixed && picking === "start" ? " armed" : ""}`}>
            <span className="pdh-label">Starts</span>
            <DateText value={from} onChange={setStart} label="Starts" onFocus={() => setPicking("start")} />
          </label>
          <label className={`pdh-field${!fixed && picking === "end" ? " armed" : ""}`}>
            <span className="pdh-label">Ends</span>
            <DateText value={to} onChange={setEnd} label="Ends" onFocus={() => setPicking("end")} />
          </label>
          {/* One quick move (2 Oct): a week longer, on the end. */}
          <button type="button" className="pdh-more" onClick={() => setTo(shift(to, 7))}>
            + 1 week
          </button>
        </div>
      </div>
      <div className="pdh-foot">
        <DialogClose className="pdh-cancel">Cancel</DialogClose>
        <button type="button" className="pdh-primary" disabled={!ok} onClick={() => onConfirm({ name: nm.trim(), start: from, end: to, weeks: length })}>
          {confirm}
        </button>
      </div>
      {/* Last in the order, so the first field still takes the focus as it opens; drawn top right. */}
      <DialogClose className="pdh-x" aria-label="Close">
        ✕
      </DialogClose>
    </DialogContent>
  );
}
