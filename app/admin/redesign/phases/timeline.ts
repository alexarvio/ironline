// The Phases overview's maths (14 Oct), with no React in it: the window,
// where a day lands in it, which phases are ending soon, which clients need
// attention, how events stack so their labels never overlap, and when a bar
// is too small to label. The list, the toggle's count and the timeline all
// read the same data through these, so they always agree.

import type { PhaseTrack } from "../../../lib/db";

export type OverviewPhase = {
  id: number;
  track: PhaseTrack;
  name: string;
  /** First day. */
  start: string;
  /** Last day. */
  end: string;
  /** What is stored (lib/phases.ts): the Monday of the last week, or the last day minus 6. */
  endWeek: string;
  draft: boolean;
};
export type OverviewEvent = { id: number; kind: string | null; title: string; start: string; end: string; note: string; addedBy: "coach" | "client" };

export const TRACKS: PhaseTrack[] = ["lifestyle", "training", "nutrition"];
/** The tracks' colours on this page: lifestyle gold, training indigo, nutrition green. */
export const TRACK_COLOR: Record<PhaseTrack, { c: string; rgb: string }> = {
  lifestyle: { c: "#a8761f", rgb: "168,118,31" },
  training: { c: "#4c42a8", rgb: "76,66,168" },
  nutrition: { c: "#1f7a4d", rgb: "31,122,77" },
};
export const EVENTS_COLOR = { c: "#2f5d8f", rgb: "47,93,143" };

/** A running phase with this many days left, or fewer, and nothing after it, is ending soon. */
export const SOON_DAYS = 14;

const DAY = 86400000;
const parse = (d: string) => new Date(`${d}T00:00:00`);
export const dayNum = (s: string) => Math.round(parse(s).getTime() / DAY);
export const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const mondayOf = (d: string) => addDays(d, -((parse(d).getDay() + 6) % 7));
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);
export const shortDate = (d: string) => parse(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// ---- The window --------------------------------------------------------------

export type Months = 3 | 6 | 12;
export type Range = { start: string; end: string; days: number; months: Months };

/** The 1st of the month `shift` months from today's. */
export function monthAnchor(today: string, shift = 0): string {
  const d = parse(today);
  d.setDate(1);
  d.setMonth(d.getMonth() + shift);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** From the 1st of `anchor`'s month, `months` months on; `end` is the first day after. */
export function rangeOf(anchor: string, months: Months): Range {
  const d = parse(anchor);
  d.setDate(1);
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  d.setMonth(d.getMonth() + months);
  const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end, days: daysBetween(start, end), months };
}

/** Where a day sits in the window, 0 to 1, clamped. */
export const xOf = (day: string, r: Range) => Math.min(1, Math.max(0, daysBetween(r.start, day) / r.days));

/** A bar from `start` to `end` (both inclusive): left and width as fractions, and which ends are cut by the window. */
export function spanOf(start: string, end: string, r: Range) {
  const a = xOf(start, r);
  const b = xOf(addDays(end, 1), r);
  return { left: a, width: Math.max(0, b - a), clipStart: start < r.start, clipEnd: addDays(end, 1) > r.end, visible: b > a };
}

/** The month starts inside the window, with their labels. */
export function monthMarks(r: Range): { day: string; label: string; x: number }[] {
  const out: { day: string; label: string; x: number }[] = [];
  const d = parse(r.start);
  while (true) {
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    if (day >= r.end) break;
    out.push({ day, label: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(), x: xOf(day, r) });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** The faint verticals: every week at 3 months, every two at 6, monthly at 12. */
export function gridLines(r: Range): number[] {
  if (r.months === 12) return monthMarks(r).map((m) => m.x);
  const step = r.months === 3 ? 7 : 14;
  const out: number[] = [];
  for (let d = mondayOf(r.start); d < r.end; d = addDays(d, step)) if (d > r.start) out.push(xOf(d, r));
  return out;
}

// ---- Phases ------------------------------------------------------------------

export type PhaseStatus = "draft" | "running" | "upcoming" | "done";

export function phaseStatus(p: OverviewPhase, today: string): PhaseStatus {
  if (p.draft) return "draft";
  if (p.end < today) return "done";
  if (p.start > today) return "upcoming";
  return "running";
}

/** Days from today to the phase's last day: 0 on its last day. */
export const daysLeft = (p: OverviewPhase, today: string) => daysBetween(today, p.end);

/** Something on the same track planned after it, drafts included. */
export const followed = (p: OverviewPhase, all: OverviewPhase[]) => all.some((q) => q.track === p.track && q.id !== p.id && q.end > p.end);

/** Running today, its last day within 14 days, nothing planned after it on the track. */
export function endingSoon(p: OverviewPhase, all: OverviewPhase[], today: string): boolean {
  if (phaseStatus(p, today) !== "running") return false;
  const left = daysLeft(p, today);
  return left >= 0 && left <= SOON_DAYS && !followed(p, all);
}

/** Elapsed over the whole phase, 0 to 1. */
export function progressOf(p: OverviewPhase, today: string): number {
  const total = daysBetween(p.start, p.end) + 1;
  return Math.min(1, Math.max(0, (daysBetween(p.start, today) + 1) / total));
}
export const weeksOf = (p: OverviewPhase) => Math.max(1, Math.ceil((daysBetween(p.start, p.end) + 1) / 7));
export const weekIndexOf = (p: OverviewPhase, today: string) => Math.min(weeksOf(p), Math.max(1, Math.floor(daysBetween(p.start, today) / 7) + 1));

/** "3 days left", "1 day left", "Ends today". */
export function leftLabel(days: number): string {
  if (days <= 0) return "Ends today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}
/** The tag on an ending-soon bar: "last week" or "{n} wks left". */
export const soonTag = (days: number) => (days <= 7 ? "last week" : `${Math.ceil(days / 7)} wks left`);

/** Below this share of the track a bar has no label; below `hide`, no bar at all. */
export const TINY = { label: 0.09, hide: 0.03 };

// ---- Clients -----------------------------------------------------------------

export type ClientLike = { id: number; name: string; phases: OverviewPhase[]; events: OverviewEvent[] };
export type ClientStatus = { kind: "soon"; track: PhaseTrack; days: number } | { kind: "planned" } | { kind: "none" };

/** The phases on the tracks that are switched on. */
export const phasesOn = (c: ClientLike, tracksOn: Set<PhaseTrack>) => c.phases.filter((p) => tracksOn.has(p.track));

export function soonPhases(c: ClientLike, tracksOn: Set<PhaseTrack>, today: string): OverviewPhase[] {
  // Judged against every phase of the client's (a follow-up on a hidden track still counts), listed only for the tracks shown.
  return phasesOn(c, tracksOn)
    .filter((p) => endingSoon(p, c.phases, today))
    .sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
}

export function clientStatus(c: ClientLike, tracksOn: Set<PhaseTrack>, today: string): ClientStatus {
  const soon = soonPhases(c, tracksOn, today)[0];
  if (soon) return { kind: "soon", track: soon.track, days: daysLeft(soon, today) };
  if (phasesOn(c, tracksOn).length > 0) return { kind: "planned" };
  return { kind: "none" };
}

/** Who the Needs attention view shows. Room for more reasons later (nothing planned, a phase ended with nothing after). */
export type AttentionReason = "ending-soon";
export function needsAttention(c: ClientLike, tracksOn: Set<PhaseTrack>, today: string, reasons: AttentionReason[] = ["ending-soon"]): boolean {
  return reasons.some((r) => r === "ending-soon" && soonPhases(c, tracksOn, today).length > 0);
}

/** Ending soon first, then those with phases, then the rest; A to Z inside each. */
export function sortClients<T extends ClientLike>(clients: T[], tracksOn: Set<PhaseTrack>, today: string): T[] {
  const rank = (c: T) => {
    const s = clientStatus(c, tracksOn, today).kind;
    return s === "soon" ? 0 : s === "planned" ? 1 : 2;
  };
  return [...clients].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

// ---- Events ------------------------------------------------------------------

export const EVENT_ROWS_MAX = 3;
/** Roughly what a label takes: its letters, the marker and the gaps. */
export const eventReserve = (title: string) => title.length * 6.5 + 36;

export type StackedEvent = { event: OverviewEvent; row: number; x: number; x1: number };
export type EventOverflow = { x: number; events: OverviewEvent[] };

/**
 * Events in rows: each reserves its marker plus label, or its dates,
 * whichever is longer; one that starts inside a reserved stretch drops to
 * the next row. Past three rows they gather in a "+n" chip at that spot.
 */
export function stackEvents(events: OverviewEvent[], r: Range, widthPx: number): { placed: StackedEvent[]; overflow: EventOverflow[] } {
  const w = Math.max(200, widthPx);
  const rows: number[] = []; // where each row's reservation ends, as a fraction
  const placed: StackedEvent[] = [];
  const overflow: EventOverflow[] = [];
  const sorted = [...events].filter((e) => spanOf(e.start, e.end, r).visible || (e.start >= r.start && e.start < r.end)).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id));
  for (const e of sorted) {
    const x = xOf(e.start, r);
    const byLabel = x + eventReserve(e.title) / w;
    const byDates = e.end > e.start ? xOf(addDays(e.end, 1), r) : x;
    const x1 = Math.max(byLabel, byDates);
    let row = rows.findIndex((end) => end <= x - 0.002);
    if (row === -1) {
      if (rows.length < EVENT_ROWS_MAX) {
        row = rows.length;
        rows.push(0);
      } else {
        // Into the chip nearest this spot, or a new one.
        const near = overflow.find((o) => Math.abs(o.x - x) < 24 / w);
        if (near) near.events.push(e);
        else overflow.push({ x, events: [e] });
        continue;
      }
    }
    rows[row] = x1;
    placed.push({ event: e, row, x, x1 });
  }
  return { placed, overflow };
}
