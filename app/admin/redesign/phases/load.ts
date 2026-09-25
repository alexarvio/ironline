import { listClientEvents, listClientPhases, listClients, listEventCategories, listPrograms, localDateStr } from "../../../lib/queries";
import { phaseCovers, phaseLastDay, phaseWeekIndex, phaseWeeks } from "../../../lib/phases";
import type { PhaseState } from "../../phaseChrome";

// Every client's phases and events, for the Phases board (PhasesBoard.tsx):
// plain data, days as yyyy-mm-dd, the window worked out on the page.

export type BoardPhase = {
  id: number;
  track: "training" | "nutrition" | "lifestyle";
  name: string;
  /** First and last day. */
  start: string;
  end: string;
  state: PhaseState;
  weeks: number;
  /** "Week 3 of 8" while it runs. */
  weekOf: string | null;
  weeksLeft: number | null;
  /** Running, in its last two weeks, with nothing planned after it on that track. */
  soon: boolean;
};
export type BoardEvent = { id: number; kind: string | null; title: string; start: string; end: string; note: string };
export type BoardClient = { id: number; name: string; phases: BoardPhase[]; events: BoardEvent[] };
export type BoardCategory = { id: string; label: string; color: string };
export type PhasesBoardData = { today: string; clients: BoardClient[]; categories: BoardCategory[] };

/** A running phase with this many weeks left, or fewer, is "ending soon". */
const SOON_WEEKS = 2;
/** The Monday after a week's Monday. */
const weekAfter = (monday: string) => {
  const d = new Date(`${monday}T00:00:00`);
  d.setDate(d.getDate() + 7);
  return localDateStr(d);
};

export function loadPhasesBoard(coachId: number): PhasesBoardData {
  const today = localDateStr();
  const clients = listClients(coachId).map((c) => {
    const drafts = new Set(listPrograms(c.id).filter((p) => p.status === "draft").map((p) => p.id));
    const all = listClientPhases(c.id);
    const phases: BoardPhase[] = all.map((p) => {
      const isDraft = !!p.draft || (p.program_id != null && drafts.has(p.program_id));
      const running = phaseCovers(p.start_week, p.end_week, today);
      const end = phaseLastDay(p.end_week);
      const weeks = phaseWeeks(p.start_week, p.end_week);
      const weeksLeft = running ? phaseWeeks(today, p.end_week) : null;
      // Something already planned to follow it on the same track takes the worry away.
      const followed = all.some((q) => q.track === p.track && q.id !== p.id && q.start_week > p.start_week && q.start_week <= weekAfter(p.end_week));
      return {
        id: p.id,
        track: p.track,
        name: p.name,
        start: p.start_week,
        end,
        state: isDraft ? "draft" : running ? "live" : p.start_week > today ? "scheduled" : "past",
        weeks,
        weekOf: running ? `Week ${phaseWeekIndex(p.start_week, p.end_week, today)} of ${weeks}` : null,
        weeksLeft,
        soon: running && !isDraft && weeksLeft != null && weeksLeft <= SOON_WEEKS && !followed,
      };
    });
    const events: BoardEvent[] = listClientEvents(c.id).map((e) => ({ id: e.id, kind: e.kind, title: e.title, start: e.start_date, end: e.end_date, note: e.note }));
    return { id: c.id, name: c.name ?? "Client", phases, events };
  });
  const categories = listEventCategories(coachId).map(({ id, label, color }) => ({ id, label, color }));
  return { today, clients, categories };
}
