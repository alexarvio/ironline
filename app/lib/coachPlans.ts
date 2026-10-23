import { getData, persist, type CoachPlan } from "./db";

// The plans a coach offers, and which one a client is on (23 Oct, Alex: picked on the client's Details, "good for
// invoice set up and all later"). A skeleton for now: a plan is a name, made from the Details dropdown's foot; its
// price and how often it bills are kept when given, for the invoices to use later. Plans live on the coach's own
// settings (users.coach_settings.plans), a client's pick on their profile (client_profiles.coaching_plan_id).

const coachRow = (coachId: number) => getData().users.find((u) => u.id === coachId && u.role === "coach");

/** The coach's plans, oldest first; archived ones only when asked for (a client still on one shows it). */
export function listCoachPlans(coachId: number, withArchived = false): CoachPlan[] {
  const plans = coachRow(coachId)?.coach_settings?.plans ?? [];
  return withArchived ? plans : plans.filter((p) => !p.archived);
}

/** A new plan by its name; the same name again (any case) gives back the one there is. */
export function addCoachPlan(coachId: number, name: string): CoachPlan | null {
  const user = coachRow(coachId);
  const clean = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!user || !clean) return null;
  const plans = user.coach_settings?.plans ?? [];
  const same = plans.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (same) {
    if (same.archived) {
      same.archived = false;
      persist();
    }
    return same;
  }
  const plan: CoachPlan = { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: clean, created_at: new Date().toISOString() };
  user.coach_settings = { ...(user.coach_settings ?? {}), plans: [...plans, plan] };
  persist();
  return plan;
}

/** The plan a client is on, or null. */
export function clientPlanId(clientId: number): string | null {
  return getData().client_profiles.find((p) => p.client_id === clientId)?.coaching_plan_id ?? null;
}

/** Put a client on one of their coach's plans, or on none (null). A plan that isn't the coach's is refused. */
export function setClientPlan(coachId: number, clientId: number, planId: string | null): boolean {
  const data = getData();
  if (planId != null && !listCoachPlans(coachId, true).some((p) => p.id === planId)) return false;
  const profile = data.client_profiles.find((p) => p.client_id === clientId);
  if (!profile) return false;
  if ((profile.coaching_plan_id ?? null) === planId) return true;
  profile.coaching_plan_id = planId;
  persist();
  return true;
}
