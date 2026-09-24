"use client";

import { useState } from "react";
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { ChevronLeftIcon } from "../../components/icons";
import DateText from "./DateText";

// When a programme or phase reaches the client: a month to click the dates
// on, and the same dates as fields to type into. A programme runs Monday to
// Sunday, so a click snaps to its week, and its length is however many weeks
// are on its rail, so only its start is picked and the end follows. A
// nutrition or lifestyle phase (byDay) has both ends open, on any day.

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
  firstName,
  what,
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
  firstName: string;
  /** "the programme", "these targets", "these metrics": what reaches the client. */
  what: string;
  confirm: string;
  /** `end` is the last day. */
  onConfirm: (v: { name: string; start: string; end: string }) => void;
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
  const [cursor, setCursor] = useState(from.slice(0, 7));
  // With both ends open, the first click sets the start and the next the end.
  const [picking, setPicking] = useState<"start" | "end">("start");

  const setStart = (d: string) => {
    const s = snap(d);
    setFrom(s);
    if (fixed) setTo(shift(s, weeks * 7 - 1));
    else if (to < s) setTo(byDay ? s : sundayOf(s));
    setCursor(s.slice(0, 7));
  };
  const setEnd = (d: string) => {
    const e = byDay ? d : sundayOf(d);
    if (e < from) {
      setStart(d);
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
  const startsNow = from <= now;

  return (
    <DialogContent className="rd-dlg rdd">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {fixed ? `Its length is the ${weeks} weeks on the rail; pick the week it starts. Weeks run Monday to Sunday.` : byDay ? "Pick the day it starts and the day it ends." : "Pick the week it starts and the week it ends. Weeks run Monday to Sunday."}
        </DialogDescription>
      </DialogHeader>
      {name !== undefined && (
        <label className="rd-field">
          <span>Name</span>
          <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Strength Block" maxLength={60} />
        </label>
      )}
      <div className="rdd-cols">
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
          <div className="rdd-cal-grid">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} className="rdd-dow">
                {d}
              </span>
            ))}
            {cells.map((d, i) =>
              d ? (
                <button
                  key={i}
                  type="button"
                  className={`rdd-cell${d === now ? " today" : ""}${d >= from && d <= to ? " in" : ""}${d === from ? " start" : ""}${d === to ? " end" : ""}${d < now ? " past" : ""}`}
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
          {!fixed && <p className="rdd-picking">{picking === "start" ? "Click a day for the start." : "Now click a day for the end."}</p>}
        </div>
        <div className="rdd-fields">
          <label className="rd-field">
            <span>Starts</span>
            <DateText value={from} onChange={setStart} label="Starts" onFocus={() => setPicking("start")} />
          </label>
          <label className="rd-field">
            <span>Ends</span>
            <DateText value={to} disabled={fixed} onChange={setEnd} label="Ends" onFocus={() => setPicking("end")} />
          </label>
          <div className="rd-field">
            <span>Length</span>
            <span className="rdd-length">
              {lengthLabel}
              <small>
                {fmtShort(from)} – {fmtShort(to)}
              </small>
            </span>
          </div>
          <div className="rd-field">
            <span>Quick</span>
            <div className="rdd-quick">
              <button type="button" className={`rd-chip${from === snap(now) ? " on" : ""}`} onClick={() => setStart(now)}>
                {byDay ? "Today" : "This week"}
              </button>
              <button type="button" className={`rd-chip${from === nextMonday ? " on" : ""}`} onClick={() => setStart(nextMonday)}>
                Next Monday
              </button>
              <button type="button" className={`rd-chip${from === snap(shift(now, 14)) ? " on" : ""}`} onClick={() => setStart(shift(now, 14))}>
                In two weeks
              </button>
            </div>
          </div>
        </div>
      </div>
      <DialogFooter>
        <span className="rd-dlg-hint grow">{startsNow ? `${firstName} sees ${what} straight away.` : `${firstName} sees ${what} from ${fmt(from)}; until then only you see it.`}</span>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!ok} onClick={() => onConfirm({ name: nm.trim(), start: from, end: to })}>
          {confirm}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}
