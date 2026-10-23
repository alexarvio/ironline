import { allocId, getData, persist, type ClientFocus } from "./db";
import { isClientCall } from "./calendarKinds";
import { SERVER_TZ } from "./timezones";
import { inZone } from "./viewZone";

// To focus on (23 Oct, Alex: "the coach can add some micro goals for the client for the upcoming week or until the next
// meeting"): one current list a client, up to three goals. The coach sets it on completing a call ("How did the call
// go?") or on a call's To focus on tab, and replaces or edits it there; the client ticks and unticks on Home, where it
// is the first thing under the greeting. A call completed with goals replaces the whole list, every tick reset (23 Oct,
// Alex: "every time this is set on a new call the old ones get overridden"); only an edit on the To focus on tab between
// calls keeps a goal's tick when its words stay. It runs until the client's next scheduled call.
// The rows live in `client_focus` (db.ts, kept in kv on Postgres).

export const FOCUS_MAX = 3;
export const FOCUS_CHARS = 80;
/** How the notification reads (Notifications: "Finlay set what to focus on" over the goals); Home's Latest knows it by this. */
export const FOCUS_NOTE = "Set what to focus on";

export type FocusGoalView = { id: number; text: string; done: boolean };
/** The coach's side (Meetings): the list and where it came from. */
export type CoachFocus = { goals: FocusGoalView[]; meetingId: number | null; setAt: string };
/** The client's Home: the list, and the next call it runs until (in the phone's zone; time "" for one with none). */
export type HomeFocus = { goals: FocusGoalView[]; until: { date: string; time: string } | null };

const rows = (): ClientFocus[] => {
  const data = getData();
  if (!data.client_focus) data.client_focus = [];
  return data.client_focus;
};

const rowOf = (clientId: number) => rows().find((r) => r.client_id === clientId) ?? null;
/** The same words, whatever the spacing or case: what keeps a tick through an edit. */
const sameWords = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
const view = (r: ClientFocus): FocusGoalView[] => r.goals.map((g) => ({ id: g.id, text: g.text, done: g.done }));

/** The lines as they are kept: trimmed, cut to 80, empty ones and repeats dropped, three at most. */
export function cleanFocusLines(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  const out: string[] = [];
  for (const l of lines) {
    const t = String(l ?? "").trim().replace(/\s+/g, " ").slice(0, FOCUS_CHARS);
    if (t && !out.some((x) => sameWords(x, t))) out.push(t);
    if (out.length === FOCUS_MAX) break;
  }
  return out;
}

export function getCoachFocus(clientId: number): CoachFocus | null {
  const r = rowOf(clientId);
  return r && r.goals.length ? { goals: view(r), meetingId: r.meeting_id, setAt: r.set_at } : null;
}

/**
 * Sets the client's list to these lines. `meetingId`: the call it came from (completing one), and every goal is new, no
 * tick kept. Left out (an edit between calls), a line with a goal's words keeps that goal (its id and its tick), the rest
 * are new, and the list keeps the call it had (none, from empty).
 * Says how many goals there were and are, whether the words changed, and the row's id (the notification's subject).
 */
export function setFocus(clientId: number, lines: string[], meetingId?: number | null): { before: number; after: number; changed: boolean; id: number } {
  const texts = cleanFocusLines(lines);
  let r = rowOf(clientId);
  const before = r?.goals.length ?? 0;
  const old = r?.goals ?? [];
  const changed = texts.length !== old.length || texts.some((t, i) => t !== old[i].text);
  if (!r) {
    if (!texts.length) return { before: 0, after: 0, changed: false, id: 0 };
    r = { id: allocId("client_focus"), client_id: clientId, goals: [], set_at: new Date().toISOString(), meeting_id: null };
    rows().push(r);
  }
  if (!changed && meetingId === undefined) return { before, after: before, changed: false, id: r.id };
  const taken = new Set<number>();
  r.goals = texts.map((text) => {
    const kept = meetingId === undefined ? old.find((g) => !taken.has(g.id) && sameWords(g.text, text)) : undefined;
    if (kept) {
      taken.add(kept.id);
      return { ...kept, text };
    }
    return { id: allocId("client_focus_goals"), text, done: false, done_at: null };
  });
  r.set_at = new Date().toISOString();
  if (meetingId !== undefined) r.meeting_id = meetingId;
  else if (before === 0) r.meeting_id = null;
  persist();
  return { before, after: r.goals.length, changed, id: r.id };
}

/** The client ticks a goal, or takes the tick back. False when it isn't theirs (or no longer there). */
export function tickFocusGoal(clientId: number, goalId: number, done: boolean): boolean {
  const g = rowOf(clientId)?.goals.find((x) => x.id === goalId);
  if (!g) return false;
  if (g.done === done) return true;
  g.done = done;
  g.done_at = done ? new Date().toISOString() : null;
  persist();
  return true;
}

/** The client's next scheduled call (a client call, today or later), its date and time in the phone's zone when known. */
export function nextClientCall(clientId: number, today: string, phoneTz: string | null): { date: string; time: string } | null {
  const next = getData()
    .meetings.filter((m) => m.client_id === clientId && isClientCall(m.category) && m.status === "scheduled" && m.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1))[0];
  if (!next) return null;
  const time = next.all_day ? "" : next.time;
  return phoneTz && time ? inZone(next.date, time, next.tz || SERVER_TZ, phoneTz) : { date: next.date, time };
}

/** Home's To focus on: null while there are no goals. */
export function homeFocus(clientId: number, today: string, phoneTz: string | null): HomeFocus | null {
  const r = rowOf(clientId);
  if (!r || !r.goals.length) return null;
  return { goals: view(r), until: nextClientCall(clientId, today, phoneTz) };
}
