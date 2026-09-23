"use client";

import { useState } from "react";

// A date typed, beside a calendar that is clicked: the field reads
// 21/09/2026 and takes 21/09/2026, 21.9.2026, 21092026 or 2026-09-21. A
// whole real date is handed on the moment it is complete; anything else is
// left as typed until the field is left, when it shows the day it holds.

const parse = (d: string) => new Date(`${d}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shown = (iso: string) => (iso ? parse(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
/** The day typed, once it is a whole real date; null until then. */
export const typedDate = (raw: string): string | null => {
  const s = raw.trim();
  let d: number, m: number, y: number;
  let r = /^([0-9]{1,2})[/.\- ]([0-9]{1,2})[/.\- ]([0-9]{4})$/.exec(s);
  if (r) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^([0-9]{2})([0-9]{2})([0-9]{4})$/.exec(s))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/.exec(s))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  const date = new Date(y, m - 1, d);
  if (y < 2000 || y > 2100 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return isoOf(date);
};

export default function DateText({ value, onChange, label, disabled = false, onFocus }: { value: string; onChange: (iso: string) => void; label: string; disabled?: boolean; /** Arms this end in the calendar beside it. */ onFocus?: () => void }) {
  // What is being typed; null shows the day the field holds.
  const [typing, setTyping] = useState<string | null>(null);
  const text = typing ?? shown(value);
  const complete = typing != null && typing.replace(/[^0-9]/g, "").length >= 8;
  const bad = complete && !typedDate(typing);
  return (
    <input
      className={`rd-input rdt${bad ? " bad" : ""}`}
      value={text}
      disabled={disabled}
      inputMode="numeric"
      placeholder="dd/mm/yyyy"
      aria-label={label}
      aria-invalid={bad || undefined}
      onFocus={onFocus}
      onChange={(e) => {
        setTyping(e.target.value);
        const day = typedDate(e.target.value);
        if (day) onChange(day);
      }}
      onBlur={() => setTyping(null)}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}
