"use server";

import { revalidatePath } from "next/cache";
import { coachForClient, getSessionUser } from "./auth";
import { getData } from "./db";
import { focusHolder, noteFocus, setFocus, setFocusDraft, setFocusFromCall, setFocusOnHolder, tickFocusGoal } from "./focus";

// To focus on (23 Oct, Alex; lib/focus.ts): the coach sets the list from Meetings, the client ticks it on Home.

/** The lines sent as JSON; null when they can't be read. */
function linesOf(formData: FormData): string[] | null {
  try {
    const lines: unknown = JSON.parse(String(formData.get("goals") ?? "[]"));
    return Array.isArray(lines) ? lines.map(String) : [];
  } catch {
    return null;
  }
}

/**
 * The coach sets the client's list: `goals` the lines as JSON. With `meetingId` and `fromCall` it is the "How did the
 * call go?" pop-up's, on a call just completed: the list goes to the client and the call keeps it. With `holderId` it is
 * an edit on the past call that holds the list (Past calls, between calls). The client hears of it (Home's Latest and
 * Notifications, a push) only when the list comes in from none, or with a call completed with goals: never for a word
 * changed.
 */
export async function saveFocusAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!clientId || !(await coachForClient(clientId))) return;
  const lines = linesOf(formData);
  if (!lines) return;
  const meetingId = Number(formData.get("meetingId")) || null;
  const meeting = meetingId ? getData().meetings.find((m) => m.id === meetingId && m.client_id === clientId) : null;
  if (meetingId && !meeting) return;
  const fromCall = formData.get("fromCall") === "1" && meeting?.status === "completed";
  const holderId = Number(formData.get("holderId")) || null;
  // An edit from a page that hasn't seen the list move on (a call completed in another window since) changes nothing:
  // the call it was typed on no longer holds the list.
  if (!fromCall && holderId !== (focusHolder(clientId)?.id ?? null)) return;
  const r = fromCall && meetingId ? setFocusFromCall(clientId, meetingId, lines) : holderId ? setFocusOnHolder(clientId, holderId, lines) : setFocus(clientId, lines);
  noteFocus(clientId, r, fromCall ? meetingId : null);
  revalidatePath("/admin");
  revalidatePath("/client");
}

/** The next list, drafted on a call still to come (its To focus on tab): kept with the call, never sent to the client;
 *  completing the call sends it. */
export async function saveFocusDraftAction(formData: FormData) {
  const meetingId = Number(formData.get("meetingId"));
  const clientId = getData().meetings.find((m) => m.id === meetingId)?.client_id ?? null;
  if (!meetingId || clientId == null || !(await coachForClient(clientId))) return;
  const lines = linesOf(formData);
  if (!lines) return;
  if (setFocusDraft(clientId, meetingId, lines)) revalidatePath("/admin");
}

/** The client ticks a goal on Home, or takes the tick back. Theirs alone: a coach looking (the phone preview) changes nothing. */
export async function tickFocusAction(goalId: number, done: boolean) {
  const user = await getSessionUser();
  if (!user || user.role !== "client" || user.client_id == null || user.must_change_password) return false;
  if (!Number.isInteger(goalId) || typeof done !== "boolean") return false;
  const ok = tickFocusGoal(user.client_id, goalId, done);
  if (ok) revalidatePath("/client");
  return ok;
}
