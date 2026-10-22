"use server";

import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { approveCoachAction, createCoachAction, declineCoachAction, removeCoachAction, resetCoachPasswordAction } from "../../../lib/auth-actions";

// Coaches in the redesign runs the old admin's own account actions, unchanged (same owner check, same validation,
// same saving). Each of them answers by sending the owner back to /admin?view=coaches with coachOk / coachError;
// here that answer is read and handed back instead, so the page stays where it is and says it in a toast. Any other
// redirect (signed out, not the owner) goes ahead as it would.

export type CoachOutcome = { ok: string | null; error: string | null };

async function answer(run: () => Promise<void>): Promise<CoachOutcome> {
  try {
    await run();
  } catch (e) {
    const to = getURLFromRedirectError(e as Parameters<typeof getURLFromRedirectError>[0]);
    if (to && to.startsWith("/admin?view=coaches")) {
      const q = new URLSearchParams(to.slice(to.indexOf("?") + 1));
      return { ok: q.get("coachOk"), error: q.get("coachError") };
    }
    throw e;
  }
  return { ok: null, error: null };
}

const form = (fields: Record<string, string | number>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, String(v));
  return fd;
};

export async function addCoach(email: string, password: string): Promise<CoachOutcome> {
  return answer(() => createCoachAction(form({ email, password })));
}

export async function resetCoachPassword(coachId: number, password: string): Promise<CoachOutcome> {
  return answer(() => resetCoachPasswordAction(form({ coachId, password })));
}

export async function removeCoach(coachId: number): Promise<CoachOutcome> {
  return answer(() => removeCoachAction(form({ coachId })));
}

export async function approveSignUp(coachId: number): Promise<CoachOutcome> {
  return answer(() => approveCoachAction(form({ coachId })));
}

export async function declineSignUp(coachId: number): Promise<CoachOutcome> {
  return answer(() => declineCoachAction(form({ coachId })));
}
