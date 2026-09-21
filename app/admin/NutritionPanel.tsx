import {
  trainingDates,
  getLatestWeight,
  getNutritionGoalsSummary,
  getNutritionPlan,
  getStoredNutritionPlan,
  getLoggedDays,
  listClientPhases,
  listNutritionPhases,
  localDateStr,
} from "../lib/queries";
import NutritionWorkspace, { type NwPhase } from "./NutritionWorkspace";

const EMPTY_MACROS = { protein: null, carbs: null, fats: null };

// The Nutrition tab. Gathers the targets per nutrition phase, the
// supplements and the calorie log, and hands them to the workspace.
//
// Two things this deliberately does NOT do: water is a stated goal rather
// than a tracker, and supplements are a reference list rather than a
// checklist. Neither has any per-day state, and neither should grow a
// tick box.
export default function NutritionPanel({ clientId, phaseParam }: { clientId: number; phaseParam?: string }) {
  const today = localDateStr();
  const plan = getNutritionPlan(clientId);
  const stored = getStoredNutritionPlan(clientId);
  const derived = getNutritionGoalsSummary(clientId);

  // A plan built on the older six-meal model has no day targets yet; the
  // totals are derived from those meals so the fields are not blank.
  const training = plan.day_targets?.training ?? { protein: derived.trainingProtein || null, carbs: derived.trainingCarbs || null, fats: derived.trainingFats || null };
  const rest = plan.day_targets?.rest ?? { protein: derived.restProtein || null, carbs: derived.restCarbs || null, fats: derived.restFats || null };

  const endOfWeek = (monday: string) => {
    const d = new Date(`${monday}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return localDateStr(d);
  };
  const nutritionPhases = listNutritionPhases(clientId);
  // A linked phase (`?phase=`) opens straight away; an id from another
  // track, or one that has scrolled out of the window, falls back to the
  // default the workspace would have picked anyway.
  const asked = phaseParam && /^\d+$/.test(phaseParam) ? Number(phaseParam) : null;
  const phases: NwPhase[] = nutritionPhases.length
    ? nutritionPhases.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
// A draft is a blank sheet: nothing of its own means nothing on screen.
        // Falling back to the live phase's numbers made a new draft look
        // filled in, and a coach who scheduled it sent figures they had never
        // actually chosen. A phase that IS running keeps the client-level
        // plan as its fallback, since that is what the client is on.
        training: p.nutrition?.day_targets.training ?? (p.status === "draft" ? EMPTY_MACROS : stored.day_targets?.training ?? training),
        rest: p.nutrition?.day_targets.rest ?? (p.status === "draft" ? EMPTY_MACROS : stored.day_targets?.rest ?? rest),
        note: p.nutrition?.coach_notes ?? (p.status === "draft" ? "" : stored.coach_notes ?? ""),
        phase: p,
      }))
    : [
        {
          id: 0,
          name: "Targets",
          status: "now",
          training,
          rest,
          note: plan.coach_notes ?? "",
          phase: { id: 0, client_id: clientId, track: "nutrition", name: "Targets", start_week: today, end_week: today },
        },
      ];
  const running = nutritionPhases.find((p) => p.status === "now") ?? null;

  // What the client actually ate, for each phase on the rail: the days
  // inside that phase, with their meals. Read-only for the coach.
  const loggedByPhase: Record<number, ReturnType<typeof getLoggedDays>> = {};
  for (const ph of phases) {
    const end = ph.id === 0 ? today : endOfWeek(ph.phase.end_week);
    const start = ph.id === 0 ? today : ph.phase.start_week;
    loggedByPhase[ph.id] = getLoggedDays(clientId, start, end > today ? today : end);
  }

  return (
    <NutritionWorkspace
      clientId={clientId}
      today={today}
      phases={phases}
      initialPhaseId={asked && nutritionPhases.some((p) => p.id === asked) ? asked : null}
      waterL={stored.water_l ?? null}
      latestWeightKg={getLatestWeight(clientId)}
      supplements={(stored.supplement_rows ?? []).map((r) => ({ id: r.id, name: r.name, quantity: r.quantity, timing: r.timing, notes: r.notes }))}
      loggedByPhase={loggedByPhase}
      liveSince={running?.start_week ?? null}
    />
  );
}
