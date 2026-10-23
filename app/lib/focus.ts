import { allocId, getData, persist, type ClientFocus, type Data } from "./db";
import { isClientCall } from "./calendarKinds";
import { SERVER_TZ } from "./timezones";
import { inZone } from "./viewZone";
import { localDateStr, logCoachActivity } from "./queries";

// To focus on (23 Oct, Alex: "the coach can add some micro goals for the client for the upcoming week or until the next
// meeting"): one current list a client, up to three goals. The client ticks and unticks it on Home, where it is the
// first thing under the greeting. It runs until the client's next scheduled call.
// Where the coach keeps it (23 Oct, Alex: "the To focus on is deployed the moment I mark as completed this meeting, and
// then I can still edit it once it goes down to past calls until I set a new sheet of to focus on on the next call"):
//   - a call still to come drafts the next list on its To focus on tab (`focus_draft` on the call), never sent;
//   - completing the call sends its list: it replaces the whole list, every tick reset (23 Oct, Alex: "every time this is
//     set on a new call the old ones get overridden"), and the call keeps it (`focus_goals`);
//   - that completed call then holds the live list (`focusHolder`): its row in Past calls is where the list is edited,
//     a goal kept with the same words keeping its tick, until another call is completed; the one before keeps its list
//     as it ended, ticks and all, read only.
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

/** The list as the coach sees it, with the call holding it; null when the client never had one. An emptied list stays
 *  on the call that held it, so it is still there to type a new one into. */
export function getCoachFocus(clientId: number): CoachFocus | null {
  const r = rowOf(clientId);
  return r ? { goals: view(r), meetingId: r.meeting_id, setAt: r.set_at } : null;
}

type Call = Data["meetings"][number];
/** The client's calls, as their Meetings tab lists them. */
const callsOf = (clientId: number) => getData().meetings.filter((m) => m.client_id === clientId && isClientCall(m.category));
const latestFirst = (a: Call, b: Call) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.time !== b.time ? (a.time < b.time ? 1 : -1) : b.id - a.id);

/** The completed call that holds the live list: the one it came from, else the latest completed call. `except`: leave
 *  this one out (the call being completed now). The Meetings tab works it out the same way. */
export function focusHolder(clientId: number, except?: number): Call | null {
  const done = callsOf(clientId).filter((m) => m.status === "completed" && m.id !== except);
  const from = rowOf(clientId)?.meeting_id;
  return done.find((m) => m.id === from) ?? done.sort(latestFirst)[0] ?? null;
}

/** The live list onto a call, as it keeps it: the words and the client's ticks. */
function keepOn(call: Call, clientId: number) {
  const goals = (rowOf(clientId)?.goals ?? []).map((g) => ({ text: g.text, done: g.done }));
  if (goals.length) call.focus_goals = goals;
  else delete call.focus_goals;
}

/**
 * A call completed with its list ("How did the call go?"): the call that held the list until now keeps it as it ended,
 * ticks and all; the lines replace the whole list, every tick reset (setFocus with the call); the call keeps them, and
 * its draft goes. Says what setFocus says.
 */
export function setFocusFromCall(clientId: number, meetingId: number, lines: string[]) {
  const before = focusHolder(clientId, meetingId);
  if (before && rowOf(clientId)) keepOn(before, clientId);
  const r = setFocus(clientId, lines, meetingId);
  const call = callsOf(clientId).find((m) => m.id === meetingId);
  if (call) {
    keepOn(call, clientId);
    delete call.focus_draft;
  }
  persist();
  return r;
}

/** A call completed somewhere that doesn't send the list itself (the old admin's Complete): its draft goes, else the live
 *  list as it is, as the Meetings tab's Complete sends it. Null when it isn't a client call that is completed. */
export function setFocusOnComplete(clientId: number, meetingId: number) {
  const call = callsOf(clientId).find((m) => m.id === meetingId && m.status === "completed");
  if (!call) return null;
  return setFocusFromCall(clientId, meetingId, call.focus_draft?.length ? call.focus_draft : (rowOf(clientId)?.goals ?? []).map((g) => g.text));
}

/**
 * The client hears of a list (Home's Latest and Notifications, a push) only when it comes in from none, or with a call
 * completed with goals (`fromCall`, the call's id): never for a word changed. actionRef is the list (every notification
 * carries its subject); it opens Home, where the list is at the top. A call's list has a key of its own: a replaced row
 * never pushes, and the call's goals are news even after a set that same day.
 */
export function noteFocus(clientId: number, r: { before: number; after: number; id: number }, fromCall: number | null) {
  if (!(r.after > 0 && (r.before === 0 || fromCall != null))) return;
  const goals = rowOf(clientId)?.goals.map((g) => g.text) ?? [];
  const dedupeKey = fromCall != null ? `focus:call${fromCall}` : `focus:${localDateStr()}`;
  logCoachActivity(clientId, `${FOCUS_NOTE}: ${goals.join(" · ")}`, { kind: "general", actionTab: "home", actionLabel: "See it", actionRef: r.id, dedupeKey, replace: true, push: true });
}

/**
 * An edit on the call that holds the list, between calls: a line with a goal's words keeps that goal and its tick
 * (setFocus without a call); the call holds the list from now, and keeps it as it is. `holderId` must be one of the
 * client's completed calls, else the list is set alone.
 */
export function setFocusOnHolder(clientId: number, holderId: number, lines: string[]) {
  const call = callsOf(clientId).find((m) => m.id === holderId && m.status === "completed");
  const r = setFocus(clientId, lines);
  const row = rowOf(clientId);
  if (call && row) {
    row.meeting_id = call.id;
    keepOn(call, clientId);
    persist();
  }
  return r;
}

/** The next list, drafted on a call still to come: kept with the call, never sent (completing the call sends it). False
 *  when the call isn't the client's, or isn't still to come. */
export function setFocusDraft(clientId: number, meetingId: number, lines: string[]): boolean {
  const call = callsOf(clientId).find((m) => m.id === meetingId && m.status === "scheduled");
  if (!call) return false;
  const texts = cleanFocusLines(lines);
  if (texts.length) call.focus_draft = texts;
  else delete call.focus_draft;
  persist();
  return true;
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
