"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import "./time-pick.css";

// One time field (3 Nov, Alex: the Calendar's, now everywhere a coach picks a time): a rounded box in the .npd
// pop-up's row (`.npd-date`), ringed in ink while open, the list floating under it: a typed line on top ("1530",
// Enter takes it), then a row a quarter hour, six then it scrolls, the picked one ink. Never the browser's time
// field and no "24h". The Calendar's entry, Schedule a meeting and Schedule a programme. Styles: time-pick.css.

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** Every quarter hour from 05:00 to 22:00, the list's rows. */
export const TIME_SLOTS = Array.from({ length: ((22 - 5) * 60) / 15 + 1 }, (_, i) => hhmm(5 * 60 + i * 15));

/** "1530", "15.30", "3pm" and "15:30" all read as 15:30. */
export function parseTime(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(am|pm)?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const mm = Number(m[2] ?? 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || mm > 59) return null;
  return hhmm(h * 60 + mm);
}

export function TimePick({
  value,
  onPick,
  head,
  label,
  slots = TIME_SLOTS,
  parse = parseTime,
  autoFocus = false,
  className = "",
}: {
  /** "HH:MM", or "" for none yet (a dash, the list opening on 09:00). */
  value: string;
  /** A time typed or picked; false keeps the list open (a time that doesn't fit, as an end before the start). */
  onPick: (t: string) => boolean | void;
  /** The box's small caps head (Starts, Time, At). */
  head: ReactNode;
  /** What the box is, read out with its time. */
  label: string;
  slots?: string[];
  /** How a typed time is read; null leaves it. */
  parse?: (raw: string) => string | null;
  /** The typed line takes the keyboard as the list opens. */
  autoFocus?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const take = (t: string) => {
    if (onPick(t) === false) return;
    setTyped("");
    setOpen(false);
  };
  // The list opens on the time picked, else on a working morning: centred once as it opens, never again while typing.
  const anchor = value || "09:00";
  const centre = useCallback(
    (list: HTMLDivElement | null) => {
      const el = list?.querySelector<HTMLElement>(`[data-t="${anchor}"]`);
      if (list && el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
    },
    [anchor],
  );
  return (
    <PopoverPrimitive.Root
      open={open}
      modal
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTyped("");
      }}
    >
      <PopoverPrimitive.Trigger className={`npd-date tpk${className ? ` ${className}` : ""}`} aria-label={`${label}, ${value || "none"}`}>
        <span className="npd-date-head">{head}</span>
        <b className={value ? undefined : "tpk-none"}>{value || "—"}</b>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={6} className="tpk-pop">
          <input
            className="tpk-type"
            value={typed}
            onChange={(x) => setTyped(x.target.value)}
            placeholder="1530"
            aria-label={`Type ${label.toLowerCase()}`}
            autoFocus={autoFocus}
            onKeyDown={(x) => {
              if (x.key === "Enter") {
                x.preventDefault();
                const t = parse(typed);
                if (t) take(t);
              }
            }}
          />
          <div className="tpk-list" ref={centre} aria-label={label}>
            {slots.map((t) => (
              <button key={t} type="button" data-t={t} aria-current={t === value || undefined} className={`tpk-time${t === value ? " on" : ""}`} onClick={() => take(t)}>
                {t}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
