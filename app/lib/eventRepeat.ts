// Repeating events (19 Oct, Alex: "sports twice a week, every week"): an
// event that comes back on the same weekdays from its start, until a date or
// with no end. It stays one event, drawn as one stretch from its start to its
// end ("Padel · Tue & Thu"); end_date is the until, or, with no end, a year
// out that listClientEvents keeps moving forward. Shared by both apps.

export type EventRepeat = {
  /** ISO weekdays, 1 Monday … 7 Sunday, in order. */
  days: number[];
  /** The last day it can happen; null, no end. */
  until: string | null;
};

const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** 1 Monday … 7 Sunday for an ISO date. */
export const isoWeekday = (iso: string) => ((new Date(`${iso}T00:00:00`).getDay() + 6) % 7) + 1;

export function cleanRepeat(r: unknown): EventRepeat | null {
  if (!r || typeof r !== "object") return null;
  const v = r as { days?: unknown; until?: unknown };
  const days = Array.isArray(v.days) ? [...new Set(v.days.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b) : [];
  if (days.length === 0) return null;
  const until = typeof v.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.until) ? v.until : null;
  return { days, until };
}

const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} & ${xs[xs.length - 1]}`);

/** "Tue & Thu", "Weekdays", "Every day". */
export function repeatDays(days: number[]): string {
  if (days.length === 7) return "Every day";
  if (days.length === 5 && days.every((d) => d <= 5)) return "Weekdays";
  if (days.length === 2 && days[0] === 6 && days[1] === 7) return "Weekends";
  return join(days.map((d) => SHORT[d - 1]));
}

/** "Every Tue & Thu"; "Every day"; the same with " · until 20 Dec" when it ends. */
export function repeatWords(r: EventRepeat, opts: { until?: boolean } = {}): string {
  const days = repeatDays(r.days);
  const every = days === "Every day" || days === "Weekdays" || days === "Weekends" ? days : `Every ${days}`;
  if (opts.until === false || !r.until) return every;
  return `${every} · until ${new Date(`${r.until}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

/** The first day on or after `from` it happens, inside its start and end; null when none is left. */
export function nextOccurrence(start: string, end: string, r: EventRepeat, from: string): string | null {
  const d = new Date(`${(from > start ? from : start)}T00:00:00`);
  for (let i = 0; i < 7; i++) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (iso > end) return null;
    if (r.days.includes(isoWeekday(iso))) return iso;
    d.setDate(d.getDate() + 1);
  }
  return null;
}

/** With no end the stored end is a year after the later of its start and today. */
export function openEnd(start: string, today: string): string {
  const d = new Date(`${(today > start ? today : start)}T00:00:00`);
  d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
