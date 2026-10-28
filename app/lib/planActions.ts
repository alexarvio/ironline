"use server";

import { revalidatePath } from "next/cache";
import { coachForClient, requireCoach } from "./auth";
import { coachIdOfClient } from "./tenancy";
import { addCoachPlan, deleteCoachPlan, setClientPlan, setCoachPlanArchived, updateCoachPlan, type PlanFields } from "./coachPlans";

// The coach's plans (coachPlans.ts): made, changed, archived and deleted in Settings, Plans (28 Oct, Alex), and from a
// client's Details (23 Oct): make one from the dropdown's foot and put the client on it, or pick one, or none. The
// plans are the client's coach's own, whoever is looking.

const planOut = (p: { id: string; name: string; price?: number | null; every?: PlanFields["every"] }) => ({ id: p.id, name: p.name, price: p.price ?? null, every: p.every ?? null });

/** A new plan, and the client put on it. Gives back the plan, or null when refused. */
export async function addClientPlanAction(clientId: number, v: PlanFields) {
  if (!(await coachForClient(Number(clientId)))) return null;
  const coachId = coachIdOfClient(Number(clientId));
  if (coachId == null) return null;
  const plan = addCoachPlan(coachId, v);
  if (!plan) return null;
  setClientPlan(coachId, Number(clientId), plan.id);
  revalidatePath("/admin");
  return planOut(plan);
}

/** Put the client on one of their coach's plans, or on none (null); a series billing a plan moves with them. */
export async function setClientPlanAction(clientId: number, planId: string | null): Promise<boolean> {
  if (!(await coachForClient(Number(clientId)))) return false;
  const coachId = coachIdOfClient(Number(clientId));
  if (coachId == null) return false;
  const ok = setClientPlan(coachId, Number(clientId), planId == null ? null : String(planId));
  revalidatePath("/admin");
  return ok;
}

/** Settings, Plans: a new plan. */
export async function addPlanAction(v: PlanFields) {
  const coach = await requireCoach();
  const plan = addCoachPlan(coach.id, v);
  revalidatePath("/admin/redesign", "layout");
  return plan ? planOut(plan) : null;
}

/** Settings, Plans: a plan's name, price and rhythm. Clients already billed keep their price. */
export async function updatePlanAction(id: string, v: PlanFields) {
  const coach = await requireCoach();
  const plan = updateCoachPlan(coach.id, String(id), v);
  revalidatePath("/admin/redesign", "layout");
  return plan ? planOut(plan) : null;
}

export async function setPlanArchivedAction(id: string, archived: boolean) {
  const coach = await requireCoach();
  const ok = setCoachPlanArchived(coach.id, String(id), !!archived);
  revalidatePath("/admin/redesign", "layout");
  return ok;
}

/** Only a plan no client is on. */
export async function deletePlanAction(id: string) {
  const coach = await requireCoach();
  const ok = deleteCoachPlan(coach.id, String(id));
  revalidatePath("/admin/redesign", "layout");
  return ok;
}
