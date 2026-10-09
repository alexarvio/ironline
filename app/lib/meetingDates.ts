// Dates and times for the client's calls (9 Oct). A call is a UTC moment
// (startIso) and a length; everything here reads it in the phone's own
// timezone, from the phone's clock (`now`), so nothing is decided on the
// server with the wrong clock.

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Whole calendar days from now to the moment, in local time. */
export function daysUntil(startMs: number, now: number): number {
  const d = new Date(startMs);
  const t = new Date(now);
  const dayOf = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((dayOf(d) - dayOf(t)) / DAY);
}

/** "TODAY", "TOMORROW", "IN 4 DAYS": the next call's eyebrow. */
export function untilLabel(startMs: number, now: number): string {
  const n = daysUntil(startMs, now);
  if (n <= 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `In ${n} days`;
}

/** "today", "yesterday", "3 days ago", "2 weeks ago" from 14 days, "in March" past 60. */
export function agoLabel(startMs: number, now: number): string {
  const n = -daysUntil(startMs, now);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 14) return `${n} days ago`;
  if (n <= 60) return `${Math.round(n / 7)} weeks ago`;
  const d = new Date(startMs);
  const m = MONTHS_LONG[d.getMonth()];
  return d.getFullYear() === new Date(now).getFullYear() ? `in ${m}` : `in ${m} ${d.getFullYear()}`;
}

/** Ten minutes before the start until the end: the Join window. */
export function startingNow(startMs: number, durationMin: number, now: number): boolean {
  return now >= startMs - 10 * 60000 && now <= startMs + durationMin * 60000;
}

/** "18:00 – 18:30", in the phone's own hour style. */
export function timeRange(startMs: number, durationMin: number): string {
  const f = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${f(startMs)} – ${f(startMs + durationMin * 60000)}`;
}

/** The date tile: "TUE", "13", "OCT". */
export function tileParts(startMs: number): { weekday: string; day: string; month: string } {
  const d = new Date(startMs);
  return { weekday: DAYS[d.getDay()].toUpperCase(), day: String(d.getDate()), month: MONTHS[d.getMonth()].toUpperCase() };
}

/** "6 Oct", with the year when it isn't this one. */
export function shortDate(startMs: number, now: number): string {
  const d = new Date(startMs);
  const s = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? s : `${s} ${d.getFullYear()}`;
}

/** "TUE 13 OCT", the detail's eyebrow. */
export function eyebrowDate(startMs: number): string {
  const d = new Date(startMs);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`.toUpperCase();
}

/** The agreed points out of what the coach wrote: one per line, bullets
 *  stripped. A single block with no line breaks stays one paragraph (the
 *  caller tells by the array having one entry and `prose` true). */
export function agreedPoints(notes: string[] | string | null | undefined): { points: string[]; prose: boolean } {
  if (!notes) return { points: [], prose: false };
  if (Array.isArray(notes)) return { points: notes.map((s) => s.trim()).filter(Boolean), prose: false };
  const lines = notes
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•–—]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (lines.length <= 1) return { points: lines, prose: lines.length === 1 };
  return { points: lines, prose: false };
}

/** An .ics file for the call, as a data URL the phone can save. */
export function icsDataUrl(v: { title: string; startMs: number; durationMin: number; url: string | null; coach: string }): string {
  const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ironline//Meetings//EN",
    "BEGIN:VEVENT",
    `UID:ironline-${v.startMs}@ironline`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(v.startMs)}`,
    `DTEND:${stamp(v.startMs + v.durationMin * 60000)}`,
    `SUMMARY:${esc(v.title)}`,
    `DESCRIPTION:${esc(`Call with ${v.coach}${v.url ? `\n${v.url}` : ""}`)}`,
    ...(v.url ? [`URL:${v.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}
