// Dates and times in the client app, one way (3 Nov, Alex: the audit; docs/boards/dates-times-mockup.html): the day
// before the month, no commas, `2 Nov`, `Mon 2 Nov`, `Monday 2 November`; the year only when it isn't this one; times
// 24-hour whatever the phone is set to, `18:00`. Every client screen writes its dates and times through these, so a
// new screen can't pick a format of its own. (The coach admin writes d/m numerals: dayMonth.ts.)

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A yyyy-mm-dd day (read as that calendar day), a timestamp or a Date. */
const toDate = (d: string | Date): Date => (typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d) : d);
const otherYear = (x: Date) => x.getFullYear() !== new Date().getFullYear();

/**
 * A day in words. `dayWords(d)` → `2 Nov`; `{ weekday: "short" }` → `Mon 2 Nov`; `{ weekday: "long", long: true }` →
 * `Monday 2 November`; `{ long: true }` → `2 November`. The year after it only when it isn't this one (`year: true`
 * always adds it, `year: false` never, for a caller that knows its own "this year", as Events' today).
 */
export function dayWords(d: string | Date, o: { weekday?: "short" | "long"; long?: boolean; year?: boolean } = {}): string {
  const x = toDate(d);
  const month = o.long ? MONTHS[x.getMonth()] : MONTHS[x.getMonth()].slice(0, 3);
  const day = o.weekday === "long" ? `${DAYS[x.getDay()]} ` : o.weekday === "short" ? `${DAYS[x.getDay()].slice(0, 3)} ` : "";
  return `${day}${x.getDate()} ${month}${(o.year ?? otherYear(x)) ? ` ${x.getFullYear()}` : ""}`;
}

/** A month in words: `November 2026` (`{ short: true }` → `Nov 2026`; `{ year: false }` → `November`). */
export function monthWords(d: string | Date, o: { short?: boolean; year?: boolean } = {}): string {
  const x = toDate(d);
  const month = o.short ? MONTHS[x.getMonth()].slice(0, 3) : MONTHS[x.getMonth()];
  return o.year === false ? month : `${month} ${x.getFullYear()}`;
}

/** A weekday alone: `Monday` (`{ short: true }` → `Mon`). */
export function weekdayWords(d: string | Date, o: { short?: boolean } = {}): string {
  const name = DAYS[toDate(d).getDay()];
  return o.short ? name.slice(0, 3) : name;
}

/** A time, 24-hour on every phone: `18:00`. */
export function clock(d: string | Date): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}

/** A span of time: `18:00 – 18:30`. */
export function clockRange(from: string | Date, to: string | Date): string {
  return `${clock(from)} – ${clock(to)}`;
}
