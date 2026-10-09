// Dates for the client's events (9 Oct): where an event stands against
// today, how its range reads, and how far off it is. Every date is a
// yyyy-mm-dd calendar day in the client's own timezone; nothing here looks
// at the clock. A single day has start === end; it is a milestone, never
// "now".

export type EventStatus = "next" | "now" | "past";
export type Dated = { start: string; end: string };

const DAY = 86400000;
const dayNum = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY;
/** Whole days from a to b; negative when b is earlier. */
export const daysBetween = (a: string, b: string) => Math.round(dayNum(b) - dayNum(a));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const isSingleDay = (e: Dated) => e.start === e.end;

export function statusOf(e: Dated, today: string): EventStatus {
  if (e.start > today) return "next";
  if (!isSingleDay(e) && today <= e.end) return "now";
  return "past";
}

/** "20 Oct", with the year when it isn't today's. */
export function shortDay(iso: string, today: string): string {
  const d = `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
  return iso.slice(0, 4) === today.slice(0, 4) ? d : `${d} ${iso.slice(0, 4)}`;
}

/** "20 Oct – 20 Nov"; a single day "25 Aug", or "From 13 Oct" when still to come. */
export function rangeLabel(e: Dated, today: string): string {
  if (!isSingleDay(e)) return `${shortDay(e.start, today)} – ${shortDay(e.end, today)}`;
  return e.start > today ? `From ${shortDay(e.start, today)}` : shortDay(e.start, today);
}

/** "ended 5 days ago" style roll-ups: days, weeks from three, the month past ninety. */
function ago(n: number, today: string, iso: string): string {
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 21) return `${n} days ago`;
  if (n <= 90) return `${Math.round(n / 7)} weeks ago`;
  const m = MONTHS_LONG[Number(iso.slice(5, 7)) - 1];
  return iso.slice(0, 4) === today.slice(0, 4) ? `back in ${m}` : `back in ${m} ${iso.slice(0, 4)}`;
}

/** Where it stands: "in 12 days", "Day 8 of 22", "ended 5 days ago", "3 weeks ago". */
export function relativeLabel(e: Dated, today: string): string {
  const s = statusOf(e, today);
  if (s === "next") {
    const n = daysBetween(today, e.start);
    if (n === 1) return "tomorrow";
    if (n >= 21) return `in ${Math.round(n / 7)} weeks`;
    return `in ${n} days`;
  }
  if (s === "now") {
    const { day, total } = dayOf(e, today);
    return `Day ${day} of ${total}`;
  }
  const n = daysBetween(e.end, today);
  return isSingleDay(e) ? ago(n, today, e.end) : `ended ${ago(n, today, e.end)}`;
}

/** For a stretch running now: which day of how many. */
export function dayOf(e: Dated, today: string): { day: number; total: number } {
  const total = daysBetween(e.start, e.end) + 1;
  const day = Math.min(total, Math.max(1, daysBetween(e.start, today) + 1));
  return { day, total };
}

/** The TODAY line's "THU 8 OCT", and its long form for the screen reader. */
export function todayLabel(today: string): { short: string; long: string } {
  const d = new Date(`${today}T00:00:00Z`);
  const wd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
  const day = Number(today.slice(8, 10));
  const m = Number(today.slice(5, 7)) - 1;
  return { short: `${wd.slice(0, 3)} ${day} ${MONTHS[m]}`.toUpperCase(), long: `Today, ${wd} ${day} ${MONTHS_LONG[m]}` };
}

/** yyyy-mm-dd plus n days. */
export function addDays(iso: string, n: number): string {
  return new Date((dayNum(iso) + n) * DAY).toISOString().slice(0, 10);
}

/** The sheet's duration chip: "12 days · starts in 12 days", "Today", "3 days ago". */
export function durationLabel(start: string, end: string, today: string): string {
  const k = daysBetween(today, start);
  if (start === end) return k === 0 ? "Today" : k > 0 ? `In ${k} day${k === 1 ? "" : "s"}` : `${-k} day${k === -1 ? "" : "s"} ago`;
  const n = daysBetween(start, end) + 1;
  const days = `${n} day${n === 1 ? "" : "s"}`;
  if (k === 0) return `${days} · starts today`;
  return k > 0 ? `${days} · starts in ${k} day${k === 1 ? "" : "s"}` : `${days} · started ${-k} day${k === -1 ? "" : "s"} ago`;
}

/** "Thursday 8 October", for a date field's spoken label. */
export function longDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()]} ${Number(iso.slice(8, 10))} ${MONTHS_LONG[Number(iso.slice(5, 7)) - 1]}`;
}
