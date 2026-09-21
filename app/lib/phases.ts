// How a phase's span is said, wherever it is said: the coach's three tabs
// all print the same range from the same two Mondays, and both sides of the
// server/client line need it — so it lives here rather than in the header
// component, which is a client module.
//
// A phase is stored as its first Monday and its last Monday. What a coach
// reads is the span it actually covers, so the end shown is that last week's
// Sunday, not the Monday it began on.

/** "Aug 18 – Sep 28" from a phase's first and last Monday. */
export function phaseRange(startWeek: string, endWeek: string): string {
  const last = new Date(`${endWeek}T00:00:00`);
  last.setDate(last.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(new Date(`${startWeek}T00:00:00`))} – ${fmt(last)}`;
}

/** Whole weeks from the first Monday to the last, inclusive. */
export function phaseWeeks(startWeek: string, endWeek: string): number {
  const ms = new Date(`${endWeek}T00:00:00`).getTime() - new Date(`${startWeek}T00:00:00`).getTime();
  return Math.max(1, Math.round(ms / (7 * 86400000)) + 1);
}

/** Which of the phase's weeks `today` falls in, 1-based and clamped to it. */
export function phaseWeekIndex(startWeek: string, endWeek: string, today: string): number {
  const monday = new Date(`${today}T00:00:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const i = Math.floor((monday.getTime() - new Date(`${startWeek}T00:00:00`).getTime()) / (7 * 86400000)) + 1;
  return Math.min(Math.max(i, 1), phaseWeeks(startWeek, endWeek));
}
