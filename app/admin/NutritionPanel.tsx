import {
  getAssignmentsForDay,
  getClient,
  getCurrentWeekNumber,
  getLatestWeight,
  getNutritionGoalsSummary,
  getNutritionPlan,
  getStoredNutritionPlan,
  getWeek,
  listCalorieLogs,
  listClientPhases,
  getClientProfile,
  listNutritionPhases,
  localDateStr,
} from "../lib/queries";
import NutritionWorkspace, { type NwLogDay, type NwPhase } from "./NutritionWorkspace";

// The Nutrition tab. Gathers the targets per nutrition phase, the
// supplements and the calorie log, and hands them to the workspace.
//
// Two things this deliberately does NOT do: water is a stated goal rather
// than a tracker, and supplements are a reference list rather than a
// checklist. Neither has any per-day state, and neither should grow a
// tick box.
export default function NutritionPanel({ clientId }: { clientId: number }) {
  const today = localDateStr();
  const plan = getNutritionPlan(clientId);
  const stored = getStoredNutritionPlan(clientId);
  const derived = getNutritionGoalsSummary(clientId);
  const clientName = getClient(clientId)?.name ?? "the client";

  // A plan built on the older six-meal model has no day targets yet; the
  // totals are derived from those meals so the fields are not blank.
  const training = plan.day_targets?.training ?? { protein: derived.trainingProtein || null, carbs: derived.trainingCarbs || null, fats: derived.trainingFats || null };
  const rest = plan.day_targets?.rest ?? { protein: derived.restProtein || null, carbs: derived.restCarbs || null, fats: derived.restFats || null };

  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endOfWeek = (monday: string) => {
    const d = new Date(`${monday}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return localDateStr(d);
  };
  const nutritionPhases = listNutritionPhases(clientId);
  const phases: NwPhase[] = nutritionPhases.length
    ? nutritionPhases.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        startLabel: fmt(p.start_week),
        range: `${fmt(p.start_week)} – ${fmt(endOfWeek(p.end_week))}`,
        // A phase without its own numbers starts from the client-level plan.
        training: p.nutrition?.day_targets.training ?? stored.day_targets?.training ?? training,
        rest: p.nutrition?.day_targets.rest ?? stored.day_targets?.rest ?? rest,
        note: p.nutrition?.coach_notes ?? stored.coach_notes ?? "",
        phase: p,
      }))
    : [
        {
          id: 0,
          name: "Targets",
          status: "now",
          startLabel: "",
          range: "",
          training,
          rest,
          note: plan.coach_notes ?? "",
          phase: { id: 0, client_id: clientId, track: "nutrition", name: "Targets", start_week: today, end_week: today },
        },
      ];
  const running = nutritionPhases.find((p) => p.status === "now") ?? null;

  // The calorie log, one entry per day back to the client's first entry (at
  // least 15 days, so the first page is full), judged against that weekday's
  // training or rest target. Each day names the nutrition phase it fell in.
  const trainingDows = new Set(
    getWeek(clientId, getCurrentWeekNumber(clientId))
      .filter((d) => getAssignmentsForDay(d.id).length > 0)
      .map((d) => d.day_of_week)
  );
  const allLogs = listCalorieLogs(clientId, 10000);
  const byDate = new Map(allLogs.map((c) => [c.date, c] as const));
  // Back to the first entry or the day coaching started, whichever is earlier.
  const coachingStart = getClientProfile(clientId).coaching_start_date || null;
  const firstLog = allLogs.length ? allLogs[allLogs.length - 1].date : today;
  const earliest = coachingStart && coachingStart < firstLog ? coachingStart : firstLog;
  const spanDays = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${earliest}T00:00:00`).getTime()) / 86400000) + 1;
  const nutritionAll = listClientPhases(clientId).filter((ph) => ph.track === "nutrition");
  // A phase's end_week is the Monday of its last week, so the week runs six more days.
  const phaseOn = (date: string) => {
    const hit = nutritionAll.find((ph) => {
      const end = new Date(`${ph.end_week}T00:00:00`);
      end.setDate(end.getDate() + 6);
      return ph.start_week <= date && date <= localDateStr(end);
    });
    return hit?.name ?? null;
  };
  const logs: NwLogDay[] = Array.from({ length: Math.max(15, spanDays) }, (_, i) => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - i);
    const date = localDateStr(d);
    const isTraining = trainingDows.has(d.getDay() || 7);
    const target = (isTraining ? derived.trainingKcal : derived.restKcal) || null;
    const c = byDate.get(date);
    return { date, kcal: c?.kcal ?? null, isTraining, target, note: c?.note ?? null, phase: phaseOn(date) };
  });

  return (
    <NutritionWorkspace
      clientId={clientId}
      clientName={clientName}
      today={today}
      phases={phases}
      waterL={stored.water_l ?? null}
      latestWeightKg={getLatestWeight(clientId)}
      supplements={(stored.supplement_rows ?? []).map((r) => ({ id: r.id, name: r.name, quantity: r.quantity, timing: r.timing, notes: r.notes }))}
      logs={logs}
      liveSince={running?.start_week ?? null}
    />
  );
}
