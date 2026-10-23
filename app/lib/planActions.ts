"use server";

import { revalidatePath } from "next/cache";
import { coachForClient } from "./auth";
import { coachIdOfClient } from "./tenancy";
import { addCoachPlan, setClientPlan } from "./coachPlans";

// The coach's plans from a client's Details (23 Oct, Alex): make one from the dropdown's foot and put the client on it,
// or pick one, or none. The plans are the client's coach's own, whoever is looking.

/** A new plan by its name, and the client put on it. Gives back the plan, or null when refused. */
export async function addClientPlanAction(clientId: number, name: string): Promise<{ id: string; name: string } | null> {
  if (!(await coachForClient(Number(clientId)))) return null;
  const coachId = coachIdOfClient(Number(clientId));
  if (coachId == null) return null;
  const plan = addCoachPlan(coachId, name);
  if (!plan) return null;
  setClientPlan(coachId, Number(clientId), plan.id);
  revalidatePath("/admin");
  return { id: plan.id, name: plan.name };
}

/** Put the client on one of their coach's plans, or on none (null). */
export async function setClientPlanAction(clientId: number, planId: string | null): Promise<boolean> {
  if (!(await coachForClient(Number(clientId)))) return false;
  const coachId = coachIdOfClient(Number(clientId));
  if (coachId == null) return false;
  const ok = setClientPlan(coachId, Number(clientId), planId == null ? null : String(planId));
  revalidatePath("/admin");
  return ok;
}
