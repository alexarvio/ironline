// A date in words, the coach admin's way (20 Oct, Alex): day/month numerals,
// "starts 9/11", "5/10 – 2/11", never "9 Nov" or "Mon 9 Nov"; the year only
// when it isn't this one ("9/11/2027"). Grids keep their month names (the
// timeline axes, the week rail, calendars); screen-reader labels keep words.

/** `9/11`, or `9/11/2027` in another year. Takes a yyyy-mm-dd day (read as that calendar day), a timestamp or a Date. */
export function dayMonth(d: string | Date): string {
  const x = typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d) : d;
  return `${x.getDate()}/${x.getMonth() + 1}${x.getFullYear() !== new Date().getFullYear() ? `/${x.getFullYear()}` : ""}`;
}

/** `9/11, 14:05`: a moment, as a chat line or a saved stamp shows it. */
export function dayMonthTime(d: string | Date): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${dayMonth(x)}, ${x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A feed's or a log's date (21 Oct, Alex): the weekday first, then the day and the month, `Tue, 21 Oct`; the year only
 * when it isn't this one (`Tue, 21 Oct 2025`). The first thing in every feed and log row (Home's Activity, the
 * after-workout check, check-ins, the Nutrition log, All sheets, past calls, the Events log), drawn as the after-workout
 * check's date: 13.5px, 500, body grey. Pills, fact lines and buttons keep `dayMonth` (9/11).
 */
export function logDate(d: string | Date): string {
  const x = typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d) : d;
  return `${WEEKDAYS[x.getDay()]}, ${x.getDate()} ${MONTHS[x.getMonth()]}${x.getFullYear() !== new Date().getFullYear() ? ` ${x.getFullYear()}` : ""}`;
}

/**
 * The width of a log's date column (21 Oct, Alex: the time in a column of its own, so every row's time lines up): the
 * widest `logDate` at .rd-logdate's 13.5px Archivo is 79px (`Wed, 28 May`), 112px with a year. Pass the whole list's
 * dates, not one page's, so the column keeps its width from page to page.
 */
export function logDateWidth(dates: (string | Date)[]): number {
  const year = new Date().getFullYear();
  return dates.some((d) => (typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d) : d).getFullYear() !== year) ? 116 : 84;
}

/**
 * A span of days in a log (27 Oct, Alex: no arrow between two dates): one short span, `4–28 Nov`, `28 Oct – 4 Nov`,
 * the year only when it isn't this one (`28 Dec 2026 – 4 Jan 2027`). Shown with `spanLength` after it in grey.
 */
export function logRange(start: string, end: string): string {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  const thisYear = new Date().getFullYear();
  const year = (x: Date) => (x.getFullYear() !== thisYear ? ` ${x.getFullYear()}` : "");
  if (a.getFullYear() !== b.getFullYear()) return `${a.getDate()} ${MONTHS[a.getMonth()]}${year(a) || ` ${a.getFullYear()}`} – ${b.getDate()} ${MONTHS[b.getMonth()]}${year(b) || ` ${b.getFullYear()}`}`;
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}${year(b)}`;
  return `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}${year(b)}`;
}

/** How many days a span covers, both ends in: `25 days`, `1 day`. */
export function spanLength(start: string, end: string): string {
  const days = Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) + 1;
  return `${days} ${days === 1 ? "day" : "days"}`;
}
