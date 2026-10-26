import { getCoachProfile, getPlanData, listClientEvents, listClients, listEventCategories, localDateStr, weekStart, type PlanPhaseRow, type PlanProgramOption } from "../../../lib/queries";
import { phaseLastDay } from "../../../lib/phases";
import type { OverviewEvent, OverviewPhase } from "./timeline";

// Every client's phases and events for the Phases overview (PhasesOverview.tsx):
// plain data, days as yyyy-mm-dd. What is "ending soon", who needs attention
// and the order of the clients are worked out on the page (timeline.ts), from
// this same data, so the list, the toggle's count and the timeline agree.
// Each client's plan rows ride along for the New phase dialog, which checks
// a new phase against the rest of the plan and offers the programmes.

export type OverviewClient = {
  id: number;
  name: string;
  avatarPath: string | null;
  phases: OverviewPhase[];
  events: OverviewEvent[];
  plan: { phases: PlanPhaseRow[]; programs: PlanProgramOption[] };
};
export type PhasesOverviewData = {
  today: string;
  /** This week's Monday. */
  thisWeek: string;
  /** How far through this week it is, 0 to 1, from the server so both renders agree (the Plan's). */
  intoWeek: number;
  coachId: number;
  /** The coach's name and face, for an event's "Added by" (23 Oct). */
  coach: { name: string; avatarPath: string | null };
  clients: OverviewClient[];
  /** The event dialog's categories. */
  categories: { id: string; label: string; color: string; custom: boolean }[];
};

/** How far through the week it is, 0 (Monday 00:00) to 1, in server-local time: the Plan's (loaders.ts), so the NOW line sits where it does there. */
const intoWeek = () => {
  const now = new Date();
  return (((now.getDay() + 6) % 7) + (now.getHours() + now.getMinutes() / 60) / 24) / 7;
};

export function loadPhasesOverview(coachId: number): PhasesOverviewData {
  const today = localDateStr();
  const clients = listClients(coachId).map((c) => {
    const plan = getPlanData(c.id);
    const phases: OverviewPhase[] = plan.phases.map((p) => ({
      id: p.id,
      track: p.track,
      name: p.name,
      start: p.start_week,
      end: phaseLastDay(p.end_week),
      endWeek: p.end_week,
      draft: p.draft || p.program?.status === "draft",
      objectives: p.objectives ?? [],
      programId: p.program?.id ?? null,
      gap: p.gap,
      openEnded: !!p.openEnded,
    }));
    const events: OverviewEvent[] = listClientEvents(c.id).map((e) => ({ id: e.id, kind: e.kind, title: e.title, start: e.start_date, end: e.end_date, note: e.note, addedBy: e.added_by === "client" ? "client" : "coach", createdAt: String(e.created_at ?? "").slice(0, 10), repeat: e.repeat ?? null }));
    return { id: c.id, name: c.name ?? "Client", avatarPath: c.avatar_path ?? null, phases, events, plan: { phases: plan.phases, programs: plan.programs } };
  });
  const profile = getCoachProfile(coachId);
  const coach = { name: profile?.display_name?.trim() || "You", avatarPath: profile?.avatar_path ?? null };
  return { today, thisWeek: weekStart(today), intoWeek: intoWeek(), coachId, coach, clients, categories: listEventCategories(coachId) };
}
