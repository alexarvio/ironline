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

  // The calorie log, one entry per day for the last 30 days, judged against
  // that weekday's training or rest target.
  const trainingDows = new Set(
    getWeek(clientId, getCurrentWeekNumber(clientId))
      .filter((d) => getAssignmentsForDay(d.id).length > 0)
      .map((d) => d.day_of_week)
  );
  const byDate = new Map(listCalorieLogs(clientId, 60).map((c) => [c.date, c] as const));
  const logs: NwLogDay[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - i);
    const date = localDateStr(d);
    const isTraining = trainingDows.has(d.getDay() || 7);
    const target = (isTraining ? derived.trainingKcal : derived.restKcal) || null;
    const c = byDate.get(date);
    return { date, kcal: c?.kcal ?? null, isTraining, target, note: c?.note ?? null };
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
      supplementsVisible={stored.supplements_visible !== false}
      logs={logs}
      liveSince={running?.start_week ?? null}
    />
  );
}
