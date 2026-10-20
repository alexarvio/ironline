"use client";

import { useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { CalendarIcon, ChevronLeftIcon } from "../../components/icons";
import DateText from "./DateText";

// One date, typed or picked (20 Oct, Alex: every date field is the same:
// digits only, the slashes filling in, and the calendar on its icon). The
// field is a DateText, so the format lives in one place; the icon opens the
// same six-row month the dates dialogs draw, with Today at its foot. Takes
// the place of every <input type="date"> in the admin.

const parse = (d: string) => new Date(`${d}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return isoOf(x);
};
const mondayOf = (d: string) => addDays(d, -((parse(d).getDay() + 6) % 7));
const spoken = (d: string) => parse(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function DatePick({ value, onChange, label, disabled = false, clearable = false, className = "", min }: { value: string; onChange: (v: string) => void; label: string; /** Kept for callers; a typed field shows the format instead. */ placeholder?: string; disabled?: boolean; clearable?: boolean; className?: string; /** The earliest day it takes (yyyy-mm-dd). */ min?: string }) {
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
      <PopoverPrimitive.Anchor asChild>
        <span className={`rd-input rd-picker rdp-field rdp-typed ${className}`}>
          <PopoverPrimitive.Trigger className="rdp-cal-btn" aria-label={`${label}: calendar`} disabled={disabled}>
            <CalendarIcon />
          </PopoverPrimitive.Trigger>
          <DateText value={value} onChange={onChange} label={label} disabled={disabled} min={min} />
        </span>
      </PopoverPrimitive.Anchor>
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
              <button key={d} type="button" disabled={!!min && d < min} className={`rdd-cell${d === today ? " today" : ""}${d === value ? " start end" : ""}${parse(d).getMonth() !== mo - 1 ? " past" : ""}`} onClick={() => pick(d)} aria-label={spoken(d)} aria-pressed={d === value}>
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
