"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { saveWorkoutAction, type WorkoutSaveResult } from "../lib/actions";
import { newOnceKey } from "../lib/onceKey";
import { fresh, type SessionDay } from "../client/workoutShared";

// Nothing logged in the gym is lost (7 Nov, Alex: "Build offline saving"; the website says "What they log is kept on the
// phone and sent as soon as the signal comes back"). Every save a client makes while training (a set, a warm-up, a note,
// a swap, the cardio, the gym, the start, the end, a discard, Couldn't train) is written here first, on the phone
// (localStorage), and leaves only once the server has answered for it. A closed app, a reload or a deploy keeps it; it
// goes again by itself when the signal or the app comes back and on the next opening, in the order made, as one batch
// (saveWorkoutAction), so a session goes up whole. Sent twice it lands once: a set is a value, and the server checks a
// start, an end and a discard against the session as it stands. While a save waits, the screens draw what was logged on
// top of the server's days (applyWorkoutOutbox), so nothing snaps back. The chat's outbox (chatOutbox.ts) is the model;
// this one holds data, not actions, so what an older deploy left still goes after a fresh load.
// Not here: what adds a row whose id later saves need (a rogue session, its exercises, a new gym) and media; they still
// need signal. A coach's phone preview neither shows nor sends any of it; a coach in the client's own app sends as the
// old actions let them (no notes, no chat note on the end). Two tabs on one client share the phone's copy (below).

export type CardioField = "time" | "pace" | "incline" | "distance";

type EntryBase = {
  /** Its address in the server's answer. */
  id: string;
  /** When it was made, on the phone. */
  at: string;
  /** What it sets: a later entry with the same slot right after it takes its place. */
  slot: string;
  dayId: number;
  /** The start of the session it belongs to, as the screen knew it; null for a day never started. */
  startedAt: string | null;
};

export type WorkoutChange =
  | { kind: "set"; assignmentId: number; setNumber: number; gymId: number | null; weight: number | null; reps: number | null; rpe: number | null; unit: "kg" | "lb" }
  /** How many sets the exercise has now (`− Remove a set`, 10 Nov, Alex): a value; sets past it go. */
  | { kind: "rows"; assignmentId: number; rows: number }
  | { kind: "warmups"; assignmentId: number; sets: { weight_kg: number | null; reps: number | null }[] }
  | { kind: "note"; assignmentId: number; gymId: number | null; text: string }
  | { kind: "unit"; assignmentId: number; unit: "kg" | "lb" }
  /** Both null: the swap taken back. `name` is what the page draws. */
  | { kind: "swap"; assignmentId: number; libraryExerciseId: number | null; customName: string | null; name: string | null }
  | { kind: "cardioDone"; cardioId: number; done: boolean }
  | { kind: "cardioSwap"; cardioId: number; name: string | null }
  | { kind: "cardioFigure"; cardioId: number; field: CardioField; value: string }
  | { kind: "gym"; gymId: number }
  | { kind: "start" }
  /** endAt: the phone's stamp; an edit passes the old end (and the server keeps the one it has). */
  | { kind: "end"; note: string; answers: { id: string; value: number | string | null }[]; endAt: string; edit: boolean }
  | { kind: "discard" }
  | { kind: "skip"; text: string };

export type WorkoutEntry = EntryBase & WorkoutChange;
export type WorkoutChangeIn = WorkoutChange & { dayId: number; startedAt: string | null };

/** Saves the server refused, a day each: shown on its row in rust until the row is opened. */
export type NotSaved = { dayId: number; sets: number; other: number; start: boolean; why: string; at: string };

export type OutboxView = {
  /** Waiting, in the order made. */
  entries: readonly WorkoutEntry[];
  /** What the screens lay over the server's days: the just answered, then the waiting. */
  overlay: readonly WorkoutEntry[];
  notSaved: readonly NotSaved[];
  /** What the server refused or found stale on this page, by slot, until that thing is saved again ("stale" for a
      session thrown away or begun again). */
  refused: Readonly<Record<string, string>>;
};

const WEEK_MS = 7 * 86_400_000;
const SETTLE_MS = 20_000;
const BATCH = 100;
const BACKOFF_MS = [5_000, 30_000, 120_000];
/** How many answered ids the phone remembers, so another tab never sends one again. */
const GONE_MAX = 300;
/** Another tab is sending: look again after this. */
const LOCK_WAIT_MS = 3_000;
const storeKey = (clientId: number) => `norcoach.workout.v1.${clientId}`;
const lockName = (clientId: number) => `norcoach.workout.send.${clientId}`;
/** A note and a unit are the exercise's, not the session's: a discard never takes them (as on the server). */
const outlivesSession = (e: { kind: string }) => e.kind === "note" || e.kind === "unit";

/** A set taken off: what the server said of it goes with it, so a set added back in its place starts clean. */
export function forgetRefused(slot: string) {
  if (!refusedSlots[slot]) return;
  refusedSlots = Object.fromEntries(Object.entries(refusedSlots).filter(([k]) => k !== slot));
  write();
}

export function slotOf(c: WorkoutChangeIn): string {
  switch (c.kind) {
    case "set":
      return `set:${c.assignmentId}:${c.setNumber}`;
    case "rows":
      return `rows:${c.assignmentId}`;
    case "warmups":
      return `warm:${c.assignmentId}`;
    case "note":
      return `note:${c.assignmentId}:${c.gymId ?? ""}`;
    case "unit":
      return `unit:${c.assignmentId}`;
    case "swap":
      return `swap:${c.assignmentId}`;
    case "cardioDone":
      return `cdone:${c.cardioId}`;
    case "cardioSwap":
      return `cswap:${c.cardioId}`;
    case "cardioFigure":
      return `cfig:${c.cardioId}:${c.field}`;
    case "gym":
      return `gym:${c.dayId}`;
    case "start":
      return `start:${c.dayId}`;
    case "end":
      return `end:${c.dayId}`;
    case "discard":
      return `discard:${c.dayId}`;
    case "skip":
      return `skip:${c.dayId}`;
  }
}

// ---- The store: one a page, for the client the runner is mounted for. Inactive (no runner, or the coach's read-only
// preview) it holds nothing and takes nothing.

// Two tabs (or windows) on one client share the phone's copy: every write first takes in what the other wrote (by
// entry id), what either has let go is remembered by id (`gone`), so neither brings it back, and a `storage` event
// takes in the other's changes at once. Only one tab sends at a time (a Web Lock), the other taking what is left.

type Settled = { entry: WorkoutEntry; until: number };
type Stored = { entries: WorkoutEntry[]; notSaved: NotSaved[]; gone: [string, number][]; cleared: Record<string, string> };
const EMPTY: OutboxView = { entries: [], overlay: [], notSaved: [], refused: {} };
let active: number | null = null;
let entries: WorkoutEntry[] = [];
let notSaved: NotSaved[] = [];
let settled: Settled[] = [];
/** Ids answered, replaced or dropped, here or in another tab, with when: never taken back in from storage. */
let gone = new Map<string, number>();
/** A day's refusals read, by day: none from before it comes back from another tab. */
let cleared: Record<string, string> = {};
let refusedSlots: Record<string, string> = {};
const inFlight = new Set<string>();
/** Sessions thrown away on this page, by day and start. */
const discarded = new Set<string>();
let view: OutboxView = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  view = active == null ? EMPTY : { entries, overlay: [...settled.map((s) => s.entry), ...entries], notSaved, refused: refusedSlots };
  listeners.forEach((l) => l());
}

/** When made; two made in one millisecond (a set flushed as the session ends) keep the order they were queued in. */
const byMade = (a: WorkoutEntry, b: WorkoutEntry) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

function letGo(list: readonly WorkoutEntry[]) {
  const now = Date.now();
  for (const e of list) gone.set(e.id, now);
}

function parse(raw: string | null): Stored {
  const none: Stored = { entries: [], notSaved: [], gone: [], cleared: {} };
  if (!raw) return none;
  try {
    const v = JSON.parse(raw) as { v?: number; entries?: unknown; notSaved?: unknown; gone?: unknown; cleared?: unknown };
    if (v?.v !== 1) return none;
    const list = Array.isArray(v.entries) ? (v.entries as WorkoutEntry[]).filter((e) => e && typeof e.id === "string" && typeof e.kind === "string" && typeof e.dayId === "number" && typeof e.at === "string") : [];
    const ns = Array.isArray(v.notSaved) ? (v.notSaved as NotSaved[]).filter((n) => n && typeof n.dayId === "number" && typeof n.at === "string") : [];
    const g = Array.isArray(v.gone) ? (v.gone as unknown[]).filter((x): x is [string, number] => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "number") : [];
    const c: Record<string, string> = {};
    if (v.cleared && typeof v.cleared === "object") for (const [k, at] of Object.entries(v.cleared as Record<string, unknown>)) if (typeof at === "string") c[k] = at;
    return { entries: list, notSaved: ns, gone: g, cleared: c };
  } catch {
    return none;
  }
}

/** The answered ids kept, the newest GONE_MAX, in one order for every tab. */
function goneKept(): [string, number][] {
  const list = [...gone.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).slice(0, GONE_MAX);
  return list.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** What another tab wrote, taken in. What it let go leaves here too, drawn a moment longer as an answered one is. */
function takeIn(s: Stored) {
  for (const [id, at] of s.gone) if (!gone.has(id)) gone.set(id, at);
  const goneHere = entries.filter((e) => gone.has(e.id) && !inFlight.has(e.id));
  if (goneHere.length) {
    const until = Date.now() + SETTLE_MS;
    goneHere.forEach((e) => settled.push({ entry: e, until }));
    entries = entries.filter((e) => !goneHere.includes(e));
  }
  const have = new Set(entries.map((e) => e.id));
  const foreign = s.entries.filter((e) => !have.has(e.id) && !gone.has(e.id));
  entries = (foreign.length ? [...entries, ...foreign] : [...entries]).sort(byMade);
  for (const [k, at] of Object.entries(s.cleared)) if (!(cleared[k] >= at)) cleared[k] = at;
  // A day's refusals by reason, the latest word on each kept.
  const byKey = new Map<string, NotSaved>();
  for (const n of [...notSaved, ...s.notSaved]) {
    const k = `${n.dayId}|${n.why}`;
    const was = byKey.get(k);
    if (!was || was.at < n.at) byKey.set(k, n);
  }
  notSaved = [...byKey.values()].filter((n) => !(cleared[n.dayId] >= n.at)).sort((a, b) => a.dayId - b.dayId || (a.why < b.why ? -1 : a.why > b.why ? 1 : 0));
}

/** Whether this tab holds anything the stored copy lacks (so writing it back changes something). */
function aheadOf(s: Stored): boolean {
  const ids = new Set(s.entries.map((e) => e.id));
  if (entries.some((e) => !ids.has(e.id))) return true;
  const g = new Set(s.gone.map((x) => x[0]));
  if (goneKept().some(([id]) => !g.has(id))) return true;
  if (notSaved.some((n) => !s.notSaved.some((m) => m.dayId === n.dayId && m.why === n.why && m.at === n.at && m.sets === n.sets && m.other === n.other))) return true;
  if (s.notSaved.length !== notSaved.length) return true;
  return Object.entries(cleared).some(([k, at]) => !(s.cleared[k] >= at));
}

/**
 * The phone's copy brought up to date: what another tab wrote taken in first, then all of it written. `always` false
 * (another tab's write heard) writes only when this tab holds more, so two tabs never answer each other for ever.
 */
function write(always = true) {
  if (active == null) return;
  // A full or blocked storage keeps them in memory: the page works as it always did.
  try {
    const key = storeKey(active);
    const stored = parse(window.localStorage.getItem(key));
    takeIn(stored);
    const keep = goneKept();
    gone = new Map(keep);
    // A day read more than a fortnight ago has nothing left to hold back.
    const fortnight = new Date(Date.now() - 2 * WEEK_MS).toISOString();
    if (Object.values(cleared).some((at) => at < fortnight)) cleared = Object.fromEntries(Object.entries(cleared).filter(([, at]) => at >= fortnight));
    if (!always && !aheadOf(stored)) return;
    if (entries.length || notSaved.length || keep.length) window.localStorage.setItem(key, JSON.stringify({ v: 1, entries, notSaved, gone: keep, cleared }));
    else window.localStorage.removeItem(key);
  } catch {}
}

/** What another tab wrote, taken in without writing; the screens told when it changed what waits. */
function sync() {
  if (active == null) return;
  const was = entries.map((e) => e.id).join();
  const wasNs = JSON.stringify(notSaved);
  try {
    takeIn(parse(window.localStorage.getItem(storeKey(active))));
  } catch {}
  if (entries.map((e) => e.id).join() !== was || JSON.stringify(notSaved) !== wasNs) {
    emit();
    pruneSettled();
  }
}

/** A refusal (or a week too old) counted on its day's row. */
function countNotSaved(list: WorkoutEntry[], why: string) {
  for (const e of list) {
    const i = notSaved.findIndex((n) => n.dayId === e.dayId && n.why === why);
    const was = i >= 0 ? notSaved[i] : { dayId: e.dayId, sets: 0, other: 0, start: false, why, at: new Date().toISOString() };
    const next = { ...was, sets: was.sets + (e.kind === "set" ? 1 : 0), other: was.other + (e.kind === "set" ? 0 : 1), start: was.start || e.kind === "start", at: new Date().toISOString() };
    notSaved = i >= 0 ? notSaved.map((n, j) => (j === i ? next : n)) : [...notSaved, next];
  }
}

/**
 * A save made: on the phone first, then on its way. Right after a change of the same thing not yet sent, it takes that
 * one's place (typing folds into one set); otherwise it goes at the end, so the order made is the order sent. A discard
 * takes the day's unsent changes with it (never a note or a unit, which outlive the session), and when its start was
 * among them nothing ever reached the server, so the discard itself is not sent either.
 */
export function enqueueWorkout(change: WorkoutChangeIn, at: string = new Date().toISOString()) {
  if (active == null) return;
  const entry = { ...change, id: newOnceKey(), at, slot: slotOf(change) } as WorkoutEntry;
  // A save that was still on its way out of a page as its session was thrown away (a set's 300ms) belongs to nothing.
  if (entry.kind !== "start" && !outlivesSession(entry) && entry.startedAt != null && discarded.has(`${entry.dayId}|${entry.startedAt}`)) return;
  // Saved again: what the server refused for it is no longer what the screen says.
  if (refusedSlots[entry.slot]) refusedSlots = Object.fromEntries(Object.entries(refusedSlots).filter(([k]) => k !== entry.slot));
  // Another tab's latest first, so the order (and what this replaces) is the shared one.
  sync();
  if (entry.kind === "discard") {
    if (entry.startedAt != null) discarded.add(`${entry.dayId}|${entry.startedAt}`);
    const dropped = entries.filter((e) => e.dayId === entry.dayId && !inFlight.has(e.id) && !outlivesSession(e));
    letGo(dropped);
    entries = entries.filter((e) => !dropped.includes(e));
    if (!dropped.some((e) => e.kind === "start")) entries = [...entries, entry];
  } else {
    const last = entries[entries.length - 1];
    // A lower count deletes sets, so it is never folded into a higher one after it (10 Nov: remove then add, offline).
    if (last && last.slot === entry.slot && !inFlight.has(last.id) && !(last.kind === "rows" && entry.kind === "rows" && entry.rows > last.rows)) {
      letGo([last]);
      entries = [...entries.slice(0, -1), entry];
    } else entries = [...entries, entry];
  }
  write();
  emit();
  // Given up on throws (a long outage with the signal on): a new save tries once more, a moment later.
  if (gaveUp) {
    gaveUp = false;
    throws = BACKOFF_MS.length;
    if (!retryTimer)
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void flush();
      }, BACKOFF_MS[0]);
  }
  void flush();
}

/** The day's refusals read: its row clears. */
export function clearNotSaved(dayId: number) {
  if (!notSaved.some((n) => n.dayId === dayId)) return;
  cleared = { ...cleared, [dayId]: new Date().toISOString() };
  notSaved = notSaved.filter((n) => n.dayId !== dayId);
  write();
  emit();
}

// ---- The runner: one batch at a time; what the server answered leaves, what it refused is counted, a throw keeps all.

let busy = false;
let throws = 0;
/** Not this page's to send (no access to this client): nothing more from it. */
let stopped = false;
/** Thrown four times running (5s, 30s and 2 min apart): nothing more until the signal comes back, the app comes back to
    the front, a new save is made, or the app opens again. */
let gaveUp = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lockTimer: ReturnType<typeof setTimeout> | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

function pruneSettled() {
  const now = Date.now();
  const kept = settled.filter((s) => s.until > now);
  if (kept.length !== settled.length) {
    settled = kept;
    emit();
  }
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = settled.length ? setTimeout(pruneSettled, Math.max(250, Math.min(...settled.map((s) => s.until)) - now)) : null;
}

/** One tab sends at a time: held by another, this one looks again shortly (that tab takes this one's saves meanwhile). */
async function flush(): Promise<void> {
  if (active == null || busy || stopped || gaveUp || retryTimer) return;
  sync();
  if (!entries.length) return;
  busy = true;
  let more = false;
  const locks = typeof navigator !== "undefined" && "locks" in navigator ? navigator.locks : undefined;
  let ran = false;
  try {
    if (locks && typeof locks.request === "function") {
      await locks.request(lockName(active), { ifAvailable: true }, async (lock) => {
        ran = true;
        if (!lock) {
          if (!lockTimer)
            lockTimer = setTimeout(() => {
              lockTimer = null;
              void flush();
            }, LOCK_WAIT_MS);
          return;
        }
        more = await sendOnce();
      });
    } else {
      ran = true;
      more = await sendOnce();
    }
  } catch {
    // The lock itself not to be had (an odd browser): sent without it.
    if (!ran) more = await sendOnce();
  } finally {
    busy = false;
  }
  if (more) void flush();
}

/** One batch out and its answer taken. True when more waits to go now. */
async function sendOnce(): Promise<boolean> {
  if (active == null) return false;
  const clientId = active;
  // Another tab may have answered some of these while this one waited for the lock.
  sync();
  const batch = entries.slice(0, BATCH);
  if (!batch.length) return false;
  batch.forEach((e) => inFlight.add(e.id));
  let answer: Awaited<ReturnType<typeof saveWorkoutAction>>;
  try {
    // With no signal useOffline holds this pending and sends it again once it is back; busy stays set meanwhile, so
    // no second copy goes.
    answer = await saveWorkoutAction(clientId, batch);
  } catch {
    // A server error or a failed database write (all kept, tried again later), or a page from before a deploy
    // ("Failed to find Server Action"), which FreshBuild reloads onto the new build, the saves kept on the phone.
    batch.forEach((e) => inFlight.delete(e.id));
    throws += 1;
    if (throws > BACKOFF_MS.length) gaveUp = true;
    else if (!retryTimer)
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void flush();
      }, BACKOFF_MS[throws - 1]);
    return false;
  }
  batch.forEach((e) => inFlight.delete(e.id));
  if (active !== clientId) return false;
  if (!answer || answer.ok !== true) {
    // Signed out (a token gone stale after a long time offline): all kept, the next open or signal tries again.
    if (answer?.ok === false && answer.reason === "not-client") {
      // Not this page's client to write: nothing it holds for them can ever go, so none of it is kept or drawn.
      stopped = true;
      letGo(entries);
      entries = [];
      write();
      emit();
    }
    return false;
  }
  throws = 0;
  const results = Array.isArray(answer.results) ? answer.results : [];
  const answered = new Set<string>();
  const refusedNow: Record<string, string> = {};
  const now = Date.now();
  batch.forEach((e, i) => {
    const r: WorkoutSaveResult | undefined = results[i];
    if (r === undefined) return;
    answered.add(e.id);
    if (r === "stale") {
      refusedNow[e.slot] = "stale";
      return;
    }
    if (r === "done" || (typeof r === "object" && "done" in r)) {
      settled.push({ entry: e, until: now + SETTLE_MS });
      // The session was already going from another start: what waits for it goes with that start.
      if (typeof r === "object" && "startedAt" in r && r.startedAt && r.startedAt !== e.startedAt) {
        const from = e.startedAt;
        entries = entries.map((x) => (x.dayId === e.dayId && x.startedAt === from && !batch.includes(x) ? { ...x, startedAt: r.startedAt } : x));
      }
      return;
    }
    countNotSaved([e], r.refused);
    refusedNow[e.slot] = r.refused;
    // A start refused: what was logged on it since, still here, goes with it, said the same way (never let go quietly
    // as a session that is no more). A note or a unit is the exercise's and still goes.
    if (e.kind === "start") {
      const after = entries.filter((x) => x.dayId === e.dayId && x.startedAt === e.startedAt && !batch.includes(x) && !outlivesSession(x));
      after.forEach((x) => {
        answered.add(x.id);
        refusedNow[x.slot] = r.refused;
      });
      countNotSaved(after, r.refused);
    }
  });
  letGo(entries.filter((e) => answered.has(e.id)));
  entries = entries.filter((e) => !answered.has(e.id));
  // A slot saved again while this batch was out keeps its newer word (none yet).
  for (const [slot, why] of Object.entries(refusedNow)) if (!entries.some((e) => e.slot === slot)) refusedSlots = { ...refusedSlots, [slot]: why };
  write();
  emit();
  pruneSettled();
  return entries.length > 0;
}

/** Back to the front: a runner that gave up on throws starts over (the signal may never have gone). */
function again() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  online();
}
function online() {
  // The signal back: a runner that gave up on throws starts over.
  gaveUp = false;
  throws = 0;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  void flush();
}
/** Another tab wrote the phone's copy: its saves taken in here (and sent from here when this one is the sender). */
function onStorage(ev: StorageEvent) {
  if (active == null || ev.key !== storeKey(active)) return;
  write(false);
  emit();
  pruneSettled();
  if (entries.length) void flush();
}

/** Mounted once, in the app's shell. Disabled (the coach's phone preview), nothing is read, shown or sent. */
export function useWorkoutOutboxRunner(clientId: number, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    active = clientId;
    stopped = false;
    gaveUp = false;
    throws = 0;
    entries = [];
    notSaved = [];
    settled = [];
    gone = new Map();
    cleared = {};
    refusedSlots = {};
    sync();
    const cutoff = Date.now() - WEEK_MS;
    const old = entries.filter((e) => !(Date.parse(e.at) >= cutoff));
    if (old.length) {
      letGo(old);
      entries = entries.filter((e) => !old.includes(e));
      countNotSaved(old, "Over a week old");
      write();
    }
    emit();
    void flush();
    window.addEventListener("online", online);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", again);
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      if (lockTimer) clearTimeout(lockTimer);
      lockTimer = null;
      if (active === clientId) {
        active = null;
        entries = [];
        notSaved = [];
        settled = [];
        gone = new Map();
        cleared = {};
        refusedSlots = {};
        emit();
      }
    };
  }, [clientId, enabled]);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getView = () => view;
const getServerView = () => EMPTY;

/** The outbox as it stands: empty on the server and before the runner has read the phone, so hydration matches. */
export function useWorkoutOutbox(): OutboxView {
  return useSyncExternalStore(subscribe, getView, getServerView);
}

/** The server's days with what waits laid over them. */
export function useOverlaidDays(days: SessionDay[]): SessionDay[] {
  const { overlay } = useWorkoutOutbox();
  return useMemo(() => applyWorkoutOutbox(days, overlay), [days, overlay]);
}

/** When the change to this thing still waiting was made, or null. */
export function useWaiting(slot: string): string | null {
  const { entries: list } = useWorkoutOutbox();
  for (let i = list.length - 1; i >= 0; i--) if (list[i].slot === slot) return list[i].at;
  return null;
}

/** The day's changes still to reach the server, and what it refused. */
export function useDayWaiting(dayId: number): { waiting: number; notSaved: NotSaved[] } {
  const { entries: list, notSaved: ns } = useWorkoutOutbox();
  return { waiting: list.filter((e) => e.dayId === dayId).length, notSaved: ns.filter((n) => n.dayId === dayId) };
}

/** Whether a session is going, with what waits for it counted: a start makes it so, an end or a discard ends it. */
export function useDayLive(dayId: number | null, serverLive: boolean): boolean {
  const { overlay } = useWorkoutOutbox();
  let live = serverLive;
  if (dayId == null) return live;
  for (const e of overlay) {
    if (e.dayId !== dayId) continue;
    if (e.kind === "start") live = true;
    else if (e.kind === "end" || e.kind === "discard") live = false;
  }
  return live;
}

/** "2 sets not saved", or the start, or the rest, for a day's row. */
export function notSavedWords(n: NotSaved): [string, string] {
  const what = n.sets > 0 ? `${n.sets} set${n.sets === 1 ? "" : "s"} not saved` : n.start ? "Not started" : "Not saved";
  return [what, n.why === "gone" ? "No longer in the plan" : n.why];
}

// ---- The overlay: the days as they will be once what waits has landed. Pure; a value the server already has changes
// nothing.

export function applyWorkoutOutbox(days: SessionDay[], list: readonly WorkoutEntry[]): SessionDay[] {
  if (!list.length) return days;
  let out = days;
  const gone = new Set<number>();
  for (const e of list) {
    const di = out.findIndex((d) => d.key === e.dayId);
    if (di < 0) continue;
    const d = out[di];
    let next: SessionDay = d;
    switch (e.kind) {
      case "set":
      case "rows":
      case "warmups":
      case "note":
      case "unit":
      case "swap": {
        const xi = d.exercises.findIndex((x) => x.id === e.assignmentId);
        if (xi < 0) break;
        const x = d.exercises[xi];
        let y = x;
        if (e.kind === "set") {
          const kept = x.logs.find((l) => l.setNumber === e.setNumber);
          const log = { id: kept?.id ?? -(e.assignmentId * 100 + e.setNumber), setNumber: e.setNumber, weight: e.weight, reps: e.reps, rpe: e.rpe };
          y = { ...x, unit: e.unit, logs: kept ? x.logs.map((l) => (l.setNumber === e.setNumber ? log : l)) : [...x.logs, log] };
        } else if (e.kind === "rows") y = { ...x, sets: Math.min(x.coachSets ?? x.sets, e.rows), logs: x.logs.filter((l) => l.setNumber <= e.rows) };
        else if (e.kind === "warmups") y = { ...x, warmups: e.sets.map((w) => ({ weight: w.weight_kg, reps: w.reps })) };
        else if (e.kind === "note") y = e.gymId != null ? { ...x, gymNotes: { ...(x.gymNotes ?? {}), [e.gymId]: e.text } } : { ...x, myNote: e.text };
        else if (e.kind === "unit") y = { ...x, unit: e.unit };
        else y = { ...x, swap: e.libraryExerciseId == null && !e.customName ? null : { libraryExerciseId: e.libraryExerciseId, name: e.name ?? e.customName ?? "Another exercise" } };
        next = { ...d, exercises: d.exercises.map((z, j) => (j === xi ? y : z)) };
        break;
      }
      case "cardioDone":
      case "cardioSwap":
      case "cardioFigure": {
        const ci = d.cardio.findIndex((c) => c.id === e.cardioId);
        if (ci < 0) break;
        const c = d.cardio[ci];
        const y = e.kind === "cardioDone" ? { ...c, done: e.done } : e.kind === "cardioSwap" ? { ...c, swap: e.name, done: e.name ? true : c.done } : { ...c, [e.field]: e.value };
        next = { ...d, cardio: d.cardio.map((z, j) => (j === ci ? y : z)) };
        break;
      }
      case "gym":
        next = { ...d, gymId: e.gymId };
        break;
      case "start":
        // A session the server has going keeps its own start.
        next = d.startedAt && !d.endedAt ? d : { ...d, startedAt: e.at, endedAt: null };
        break;
      case "end": {
        const answers: Record<string, number | string> = {};
        for (const a of e.answers) if (a.value != null && a.value !== "") answers[a.id] = a.value;
        next = { ...d, startedAt: d.startedAt ?? e.endAt, endedAt: e.edit ? d.endedAt ?? e.endAt : e.endAt, sessionNote: e.note.trim(), answers };
        break;
      }
      case "discard":
        // A rogue session discarded is gone altogether, as on the server.
        if (d.free || d.copy) gone.add(d.key);
        next = fresh(d);
        break;
      case "skip":
        next = { ...d, skipReason: e.text.trim() };
        break;
    }
    if (next !== d) out = out.map((z, j) => (j === di ? next : z));
  }
  return gone.size ? out.filter((d) => !gone.has(d.key)) : out;
}
