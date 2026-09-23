"use client";

import { useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { CalendarIcon, ChevronLeftIcon } from "../../components/icons";

// One date, picked from a month in the drafts' own sheet rather than the
// browser's. The field reads the day; open, it is the same six-row month the
// dates dialogs draw, with Today at its foot. Takes the place of every
// <input type="date"> in the drafts.

const parse = (d: string) => new Date(`${d}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return isoOf(x);
};
const mondayOf = (d: string) => addDays(d, -((parse(d).getDay() + 6) % 7));
const fmt = (d: string) => parse(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default function DatePick({ value, onChange, label, placeholder = "Pick a day", disabled = false, clearable = false, className = "" }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; disabled?: boolean; clearable?: boolean; className?: string }) {
  const today = isoOf(new Date());
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState((value || today).slice(0, 7));
  const [y, mo] = cursor.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const gridStart = mondayOf(isoOf(first));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const move = (n: number) => setCursor(isoOf(new Date(y, mo - 1 + n, 1)).slice(0, 7));
  const pick = (d: string) => {
    onChange(d);
    setOpen(false);
  };
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setCursor((value || today).slice(0, 7));
      }}
    >
      <PopoverPrimitive.Trigger className={`rd-input rd-picker rdp-field ${className}`} aria-label={label} disabled={disabled}>
        <CalendarIcon />
        <span className={value ? "" : "rdp-empty"}>{value ? fmt(value) : placeholder}</span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={6} className="pb-menu rdp-pop">
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
            {days.map((d) => (
              <button key={d} type="button" className={`rdd-cell${d === today ? " today" : ""}${d === value ? " start end" : ""}${parse(d).getMonth() !== mo - 1 ? " past" : ""}`} onClick={() => pick(d)} aria-label={fmt(d)} aria-pressed={d === value}>
                {Number(d.slice(8))}
              </button>
            ))}
          </div>
          <div className="rdp-foot">
            {clearable && value ? (
              <button type="button" className="rd-btn ghost wide" onClick={() => pick("")}>
                Clear
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="rd-btn ghost wide" onClick={() => pick(today)}>
              Today
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
