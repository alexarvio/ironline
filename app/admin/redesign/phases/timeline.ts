// The Phases overview's maths (14 Oct), with no React in it: which phases are
// ending soon, which clients need attention, and the detail pop-up's weeks
// and neighbours. The list, the toggle's count and the timeline all read the
// same data through these, so they always agree. The timeline itself is the
// Plan's (plan/timelineParts.tsx, since 21 Oct). addDays and mondayOf are
// shared with Training (ScheduleDialog, TrainingDraft).

import type { PhaseTrack } from "../../../lib/db";
import type { EventRepeat } from "../../../lib/eventRepeat";

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
  /** The coach's objectives for it, as the client's Home card shows them. */
  objectives: string[];
  /** A training phase's programme, for the way to its Training tab. */
  programId: number | null;
  /** What it still lacks for the client (the Plan's warning sign on its bar, 20 Oct). */
  gap: string | null;
  /** No end (26 Oct): it runs on a week at a time. */
  openEnded?: boolean;
};
export type OverviewEvent = { id: number; kind: string | null; title: string; start: string; end: string; note: string; addedBy: "coach" | "client"; /** When it was added, yyyy-mm-dd. */ createdAt: string; /** Comes back on these weekdays (19 Oct), lib/eventRepeat.ts. */ repeat?: EventRepeat | null };

/** Lifestyle, Training, Nutrition (20 Oct, Alex): the order of the lanes everywhere. */
export const TRACKS: PhaseTrack[] = ["lifestyle", "training", "nutrition"];

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
  // Planned only when something is still to run; a client whose phases are all behind them has nothing planned.
  if (phasesOn(c, tracksOn).some((p) => p.end >= today)) return { kind: "planned" };
  return { kind: "none" };
}

/** Who the Needs attention view shows. Room for more reasons later (nothing planned, a phase ended with nothing after). */
export type AttentionReason = "ending-soon";
export function needsAttention(c: ClientLike, tracksOn: Set<PhaseTrack>, today: string, reasons: AttentionReason[] = ["ending-soon"]): boolean {
  return reasons.some((r) => r === "ending-soon" && soonPhases(c, tracksOn, today).length > 0);
}

// ---- The detail pop-up ---------------------------------------------------------

/** The phase that comes after this one on the same track, the nearest first. */
export function nextOnTrack(p: OverviewPhase, all: OverviewPhase[]): OverviewPhase | null {
  return all.filter((q) => q.track === p.track && q.id !== p.id && q.end > p.end).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))[0] ?? null;
}
/** The one before it on the same track. */
export function prevOnTrack(p: OverviewPhase, all: OverviewPhase[]): OverviewPhase | null {
  return all.filter((q) => q.track === p.track && q.id !== p.id && q.start < p.start).sort((a, b) => (a.end > b.end ? -1 : a.end < b.end ? 1 : 0))[0] ?? null;
}

/** The week segments: a column a week, the last one shorter when the days don't come out even. */
export function weekSegments(p: OverviewPhase, today: string): { days: number; fill: number }[] {
  const total = daysBetween(p.start, p.end) + 1;
  const elapsed = Math.min(total, Math.max(0, daysBetween(p.start, today) + 1));
  const out: { days: number; fill: number }[] = [];
  for (let d = 0; d < total; d += 7) {
    const days = Math.min(7, total - d);
    out.push({ days, fill: Math.min(1, Math.max(0, (elapsed - d) / days)) });
  }
  return out;
}
