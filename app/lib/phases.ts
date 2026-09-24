// How a phase's span is said and checked, wherever it is: the coach's tabs
// and the client's app all read it from the same two stored values, and
// both sides of the server/client line need it, so it lives here rather than
// in a component.
//
// A phase is stored as `start_week` and `end_week` (see ClientPhase in
// db.ts). `start_week` is its first day, and `end_week + 6` is its last day.
// For a training phase, and every phase from before phases could start on
// any day, those are the Monday of its first week and the Monday of its
// last week. A nutrition or lifestyle phase can start and end on any day,
// and the same two rules still hold, so nothing here needs to know which.

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (day: string, n: number) => {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);

/** The phase's last day, from its stored end_week. */
export function phaseLastDay(endWeek: string): string {
  return addDays(endWeek, 6);
}

/** The end_week to store for a phase whose last day is `lastDay`. */
export function endWeekFor(lastDay: string): string {
  return addDays(lastDay, -6);
}

/** Whether `day` falls inside the phase, first and last day included. */
export function phaseCovers(startWeek: string, endWeek: string, day: string): boolean {
  return startWeek <= day && phaseLastDay(endWeek) >= day;
}

/** Days from the first day to the last, inclusive. */
export function phaseDays(startWeek: string, endWeek: string): number {
  return Math.max(1, daysBetween(startWeek, phaseLastDay(endWeek)) + 1);
}

/** "Aug 18 – Sep 28": the first day to the last. */
export function phaseRange(startWeek: string, endWeek: string): string {
  const fmt = (d: string) => parse(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(startWeek)} – ${fmt(phaseLastDay(endWeek))}`;
}

/** Its length in weeks, a started week counting as one: 3 for 21 days, 2 for 10. */
export function phaseWeeks(startWeek: string, endWeek: string): number {
  return Math.max(1, Math.ceil(phaseDays(startWeek, endWeek) / 7));
}

/** "3 weeks", or "3 weeks 2 days" when it doesn't come out even. */
export function phaseLengthLabel(startWeek: string, endWeek: string): string {
  const days = phaseDays(startWeek, endWeek);
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  const w = weeks ? `${weeks} ${weeks === 1 ? "week" : "weeks"}` : "";
  const d = rest ? `${rest} ${rest === 1 ? "day" : "days"}` : "";
  return [w, d].filter(Boolean).join(" ");
}

/** Which of the phase's weeks `today` falls in, counted from its first day, 1-based and clamped. */
export function phaseWeekIndex(startWeek: string, endWeek: string, today: string): number {
  const i = Math.floor(daysBetween(startWeek, today) / 7) + 1;
  return Math.min(Math.max(i, 1), phaseWeeks(startWeek, endWeek));
}
