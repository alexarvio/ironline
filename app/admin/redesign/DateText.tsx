"use client";

import { useState } from "react";

// A date typed, beside a calendar that is clicked: the field reads
// 21/09/2026 and takes digits only, the slashes filling in (21092026), or a pasted 2026-09-21. A
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

/**
 * As it is typed (21 Oct, Alex): digits only, the slashes put in by
 * themselves, so 0811 reads 08/11/ and 08112026 reads 08/11/2026. Deleting
 * leaves the slash out, so a backspace isn't undone. A pasted 2026-11-08
 * becomes 08/11/2026.
 */
export const maskDate = (raw: string, previous: string): string => {
  const iso = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(raw);
  if (iso) return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`;
  const d = raw.replace(/\D/g, "").slice(0, 8);
  const deleting = raw.length < previous.length;
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean);
  let out = parts.join("/");
  if (!deleting && (d.length === 2 || d.length === 4)) out += "/";
  return out;
};

export default function DateText({ value, onChange, label, disabled = false, onFocus, min }: { value: string; onChange: (iso: string) => void; label: string; disabled?: boolean; /** Arms this end in the calendar beside it. */ onFocus?: () => void; /** The earliest day it takes (yyyy-mm-dd); an earlier one reads as wrong and isn't handed on. */ min?: string }) {
  // What is being typed; null shows the day the field holds.
  const [typing, setTyping] = useState<string | null>(null);
  const text = typing ?? shown(value);
  const complete = typing != null && typing.replace(/[^0-9]/g, "").length >= 8;
  const okDay = (d: string | null) => !!d && (!min || d >= min);
  const bad = complete && !okDay(typedDate(typing));
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
        const next = maskDate(e.target.value, text);
        setTyping(next);
        const day = typedDate(next);
        if (day && okDay(day)) onChange(day);
      }}
      onBlur={() => setTyping(null)}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}
