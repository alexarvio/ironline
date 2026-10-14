import { getCoachProfile, getPlanData, listClientEvents, listClientPhases, listClients, listEventCategories, localDateStr, type PlanPhaseRow, type PlanProgramOption } from "../../../lib/queries";
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
export type PhasesOverviewData = { today: string; thisWeek: string; coachId: number; clients: OverviewClient[]; /** The event dialog's categories. */ categories: { id: string; label: string; color: string; custom: boolean }[]; /** For the "added by you" badge. */ coach: { name: string; photoPath: string | null } };

export function loadPhasesOverview(coachId: number, coachEmail = ""): PhasesOverviewData {
  const today = localDateStr();
  let thisWeek = today;
  const clients = listClients(coachId).map((c) => {
    const plan = getPlanData(c.id);
    const objectives = new Map(listClientPhases(c.id).map((p) => [p.id, p.objectives ?? []]));
    thisWeek = plan.thisWeek;
    const phases: OverviewPhase[] = plan.phases.map((p) => ({
      id: p.id,
      track: p.track,
      name: p.name,
      start: p.start_week,
      end: phaseLastDay(p.end_week),
      endWeek: p.end_week,
      draft: p.draft || p.program?.status === "draft",
      objectives: objectives.get(p.id) ?? [],
      programId: p.program?.id ?? null,
    }));
    const events: OverviewEvent[] = listClientEvents(c.id).map((e) => ({ id: e.id, kind: e.kind, title: e.title, start: e.start_date, end: e.end_date, note: e.note, addedBy: e.added_by === "client" ? "client" : "coach", createdAt: String(e.created_at ?? "").slice(0, 10) }));
    return { id: c.id, name: c.name ?? "Client", avatarPath: c.avatar_path ?? null, phases, events, plan: { phases: plan.phases, programs: plan.programs } };
  });
  const profile = getCoachProfile(coachId);
  const coach = { name: profile?.display_name?.trim() || coachEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/bw/g, (ch) => ch.toUpperCase()) || "Coach", photoPath: profile?.avatar_path ?? null };
  return { today, thisWeek, coachId, clients, categories: listEventCategories(coachId), coach };
}
