"use server";

import { revalidatePath } from "next/cache";
import { coachForClient, getSessionUser } from "./auth";
import { getData } from "./db";
import { FOCUS_NOTE, setFocus, tickFocusGoal } from "./focus";
import { localDateStr, logCoachActivity } from "./queries";

// To focus on (23 Oct, Alex; lib/focus.ts): the coach sets the list from Meetings, the client ticks it on Home.

/**
 * The coach sets the client's list: `goals` the lines as JSON. With `meetingId` and `fromCall` it is the "How did the
 * call go?" pop-up's, on a call just completed. The client hears of it (Home's Latest and Notifications, a push) only
 * when the list comes in from none, or with a call completed with goals: never for a word changed.
 */
export async function saveFocusAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!clientId || !(await coachForClient(clientId))) return;
  let lines: unknown = [];
  try {
    lines = JSON.parse(String(formData.get("goals") ?? "[]"));
  } catch {
    return;
  }
  const meetingId = Number(formData.get("meetingId")) || null;
  const meeting = meetingId ? getData().meetings.find((m) => m.id === meetingId && m.client_id === clientId) : null;
  if (meetingId && !meeting) return;
  const fromCall = formData.get("fromCall") === "1" && meeting?.status === "completed";
  const r = setFocus(clientId, Array.isArray(lines) ? lines.map(String) : [], fromCall ? meetingId : undefined);
  if (r.after > 0 && (r.before === 0 || fromCall)) {
    const goals = getData().client_focus?.find((x) => x.id === r.id)?.goals.map((g) => g.text) ?? [];
    // actionRef is the list (every notification carries its subject); it opens Home, where the list is at the top. A call's
    // list has a key of its own: a replaced row never pushes, and the call's goals are news even after a set that same day.
    const dedupeKey = fromCall ? `focus:call${meetingId}` : `focus:${localDateStr()}`;
    logCoachActivity(clientId, `${FOCUS_NOTE}: ${goals.join(" · ")}`, { kind: "general", actionTab: "home", actionLabel: "See it", actionRef: r.id, dedupeKey, replace: true, push: true });
  }
  revalidatePath("/admin");
  revalidatePath("/client");
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
