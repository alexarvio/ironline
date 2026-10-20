"use client";

import { useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { CalendarIcon } from "../../components/icons";
import DateText from "./DateText";
import { MonthRange } from "./MonthRange";

// One date, typed or picked (20 Oct, Alex: every date field is the same:
// digits only, the slashes filling in, and the calendar on its icon). The
// field is a DateText, so the format lives in one place; the icon opens the
// phase pop-up's calendar (MonthRange, 21 Oct, Alex: one calendar, a week per
// wheel step) with the one day picked, in ink, and Today at its foot. Takes
// the place of every <input type="date"> in the admin.

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function DatePick({ value, onChange, label, disabled = false, clearable = false, className = "", min }: { value: string; onChange: (v: string) => void; label: string; /** Kept for callers; a typed field shows the format instead. */ placeholder?: string; disabled?: boolean; clearable?: boolean; className?: string; /** The earliest day it takes (yyyy-mm-dd). */ min?: string }) {
  const today = isoOf(new Date());
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState((value || today).slice(0, 7));
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
          {/* One day: from = to = the day, neutral (plain, no key). */}
          <MonthRange from={value} to={value} onPick={pick} planned={[]} cursor={cursor} setCursor={setCursor} today={today} min={min} plain legend={null} />
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
