"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { clearSwapAction, logSetAction, saveExerciseNoteAction, saveWarmupSetsAction, swapExerciseAction } from "../lib/actions";
import { displayToKg, fmtWeight, kgToDisplay, planToDisplay, stepFor, unitLabel as labelOf, type Unit } from "../lib/units";
import SwapExerciseDialog from "./workout/SwapExerciseDialog";
import { VideoAskSheet, VideoGlyph } from "./VideoAskSheet";
import { CoachNote, shownName, type SessionExercise } from "./workoutShared";
import CoachMark from "./CoachMark";
import { Bars } from "./Bars";
import RingEdge from "../components/RingEdge";

// One exercise, as a page of the workout (13 Oct, "Stepper sheet"): logging
// is the whole screen. The sets card holds one row a set; exactly one is
// open, with very large numbers and − / + for weight, reps and RPE (one tap,
// one step: 0.5 kg; anything bigger is typed). The
// plan sits in the open set as grey numbers: a tap takes one, the set's
// badge takes them all. A set saves itself as soon as weight and reps are
// in, folds into a green row 1.4s later and the next set opens. When every
// set is in, the workout slides on to the next exercise by itself. The
// coach's demo is a full-width row above the card. Warm-ups are rows of
// the same kind above set 1, labelled W1, W2, never counted.

export const MAX_WARMUPS = 8;

/** What the workout's ⋯ menu asks of the exercise on screen; n makes each ask new. */
export type ExerciseRequest = { kind: "note" | "warmup" | "swap" | "media"; n: number };

type Field = "weight" | "reps" | "rpe";
type Vals = { weightKg: number | null; reps: number | null; rpe: number | null };
const EMPTY: Vals = { weightKg: null, reps: null, rpe: null };
type RowId = string;
type Row = { id: RowId; kind: "warm" | "work"; n: number; label: string; plan: Vals; entered: Vals; saved: boolean; extra: boolean };

const ADVANCE_MS = 1400;
const SAVE_DEBOUNCE_MS = 300;

const buzz = (ms = 6) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

/** A file the app can play itself (an upload, or a plain video file). */
const playable = (url: string) => url.startsWith("/uploads/") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

export default function ExercisePage({
  exercise,
  index,
  total,
  sessionLabel = "",
  gymId,
  coachName,
  coachPhoto = null,
  nextName = null,
  onNext,
  request = null,
  onSetLogged,
  tools = null,
  free = false,
}: {
  /** In a free session (19 Oct): no coach, so no targets line. */
  free?: boolean;
  /** The workout's chat and ⋯, on this exercise's own row (2 Oct): what is said there is about the exercise. */
  tools?: React.ReactNode;
  exercise: SessionExercise;
  index: number;
  total: number;
  /** The session's name, for the eyebrow ("Pull | Exercise 1 of 6"). */
  sessionLabel?: React.ReactNode;
  gymId: number | null;
  coachName: string;
  coachPhoto?: string | null;
  /** The exercise (or cardio) after this one. */
  nextName?: string | null;
  /** Every set is in: on to the next page, with a line for the toast. */
  onNext?: (toast?: string) => void;
  /** An ask from the workout's ⋯ menu, for this exercise. */
  request?: ExerciseRequest | null;
  /** A working set was saved: the dock's rest timer may want to know. */
  onSetLogged?: () => void;
}) {
  // ---- The unit, this exercise alone (13 Oct, Alex: one machine may be
  // marked in lbs while the rest is kg). Every exercise starts in kg; the
  // toggle on a set carries through the exercise's other sets, and a set
  // already logged in lbs this session keeps it in lbs on coming back.
  // Nothing is remembered for the next exercise or the next session.
  const [unit, setUnit] = useState<Unit>(exercise.unit ?? "kg");
  // Switched on the finish list (21 Oct): the sets' unit comes back from the server, and the page follows it.
  const [unitSeen, setUnitSeen] = useState<Unit | null>(exercise.unit ?? null);
  if ((exercise.unit ?? null) !== unitSeen) {
    setUnitSeen(exercise.unit ?? null);
    if (exercise.unit) setUnit(exercise.unit);
  }
  const uLabel = labelOf(unit);

  // The weight for the gym trained at: a machine there is its own machine,
  // so each gym carries its own weight forward.
  const gymWeight = (gymId != null ? exercise.gymTargets?.[gymId] : null) ?? exercise.targetWeight;
  // A free session always asks the weight: nothing prescribed says it's a bodyweight exercise.
  const askWeight = exercise.targetWeight != null || free;
  // Swapped for something else: the weight and RPE were set for the
  // prescribed exercise, so only the reps carry over.
  const swapped = exercise.swap != null;
  // The coach's note on the substitute picked, when it is one they suggested with a note.
  const swapNote = exercise.swap?.libraryExerciseId != null ? exercise.alternatives.find((a) => a.id === exercise.swap!.libraryExerciseId)?.note?.trim() || null : null;
  const targetWeight = swapped ? null : gymWeight;
  const targetRpe = swapped ? null : exercise.targetRpe;

  // ---- A figure far off this exercise (27 Oct, Alex: 608 kg typed for 17.5, 42 reps for 12): the set waits under its
  // numbers, unsaved, until the client says it is right, so nothing (the weight rule, next week) builds on a slip. A
  // weight over 40% (and 5 kg) above the best last time, else above the target; reps over double the target's top
  // (else last time's most). Lighter or fewer is never asked. A figure said right is not asked again this session.
  const lastBestKg = swapped ? 0 : Math.max(0, ...(exercise.lastSets?.sets ?? []).map((st) => st.weight ?? 0));
  const refKg = swapped ? null : lastBestKg > 0 ? lastBestKg : targetWeight;
  const refFrom: "last" | "target" = lastBestKg > 0 ? "last" : "target";
  const repTop = (() => {
    if (swapped) return null;
    const asked = (exercise.reps.match(/\d+/g) ?? []).map(Number);
    const top = asked.length ? Math.max(...asked) : Math.max(0, ...(exercise.lastSets?.sets ?? []).map((st) => st.reps ?? 0));
    return top > 0 ? top : null;
  })();
  const [doubt, setDoubt] = useState<{ n: number; weight: boolean; reps: boolean } | null>(null);
  // Asked once an exercise a session (27 Oct, Alex: "we should not have to answer yes every time"): a Yes on the weight
  // (or the reps) settles it for the rest of the exercise, and a set already logged today raises the bar for the others.
  const vouched = useRef({ weight: false, reps: false });
  const doubtOf = (v: Vals, todayKg: number, todayReps: number) => {
    const kgBar = Math.max(refKg ?? 0, todayKg);
    const repBar = Math.max(repTop ?? 0, todayReps);
    return {
      weight: !vouched.current.weight && v.weightKg != null && kgBar > 0 && v.weightKg > kgBar * 1.4 && v.weightKg - kgBar >= 5,
      reps: !vouched.current.reps && v.reps != null && repBar > 0 && v.reps > Math.max(repBar * 2, repBar + 8),
    };
  };
  // The unit a save goes out in, read when it goes (a switch to lbs from the question lands before its save).
  const unitNow = useRef(unit);
  useEffect(() => {
    unitNow.current = unit;
  }, [unit]);
  // RPE is off the set rows (14 Oct, Alex, after Strava): weight and reps only, side by side, typed (the − and + went the same day; the arrow keys still step). A figure logged before stays in the data.
  const askRpe = false;
  const last = exercise.lastSets;
  const lastOf = (n: number) => last?.sets.find((s) => s.setNumber === n) ?? null;
  // "8-10" → 8, "12" → 12: the reps the plan asks for.
  const repLow = (() => {
    const range = exercise.reps.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/);
    if (range) return Number(range[1]);
    const one = exercise.reps.match(/^\s*(\d+)\s*$/);
    return one ? Number(one[1]) : null;
  })();
  // One source of truth (15 Oct): the plan's weight is the coach's target,
  // which the server moves up itself from what was logged. The sheet adds
  // no rule of its own.
  const planWeight = targetWeight;

  // ---- Working sets. Extra sets (12 Oct): once every prescribed set is in,
  // the client can add one. It is logged as set N+1, an extra, never a
  // change to the plan: next week still shows the coach's count.
  const [extraAdded, setExtraAdded] = useState(0);
  const maxLogged = exercise.logs.reduce((m, l) => Math.max(m, l.setNumber), 0);
  const workCount = Math.max(exercise.sets + extraAdded, maxLogged);
  const logOf = (n: number) => exercise.logs.find((l) => l.setNumber === n) ?? null;
  // What the client stepped or typed on a set, over what the server has.
  const [drafts, setDrafts] = useState<Record<number, Partial<Vals>>>({});
  // The drafts as they stand this instant (25 Oct): a weight typed and the reps' + tapped in one go used to build the
  // set from the render before the weight landed, so it never counted as filled in and never saved.
  const draftsNow = useRef<Record<number, Partial<Vals>>>({});
  const enteredOf = (n: number, from: Record<number, Partial<Vals>> = drafts): Vals => {
    const log = logOf(n);
    return { ...(log ? { weightKg: log.weight, reps: log.reps, rpe: log.rpe } : EMPTY), ...(from[n] ?? {}) };
  };
  const isSaved = (v: Vals) => (!askWeight || v.weightKg != null) && v.reps != null;
  // A set's plan: the weight the set before it was just done at, this session (25 Oct, Alex: "for the next one it is
  // always the defaulted value"; a client who went up on set 1 saw set 2 back at the coach's figure); for the first
  // set, the coach's weight (one source of truth, 15 Oct). Reps and RPE from what this set was last session, else the
  // coach's figures; an extra set with no last-time twin follows the set before it.
  const planOf = (n: number): Vals => {
    const before = n > exercise.sets ? logOf(n - 1) : null;
    const prev = lastOf(n) ?? before;
    // The latest set done before it, so a set two ahead follows it too.
    let carried: number | null = null;
    for (let m = n - 1; m >= 1 && carried == null; m--) {
      const v = enteredOf(m);
      if (isSaved(v)) carried = v.weightKg;
    }
    return { weightKg: carried ?? planWeight ?? prev?.weight ?? null, reps: prev?.reps ?? repLow, rpe: prev?.rpe ?? targetRpe };
  };

  // ---- Warm-ups: rows of the same kind above set 1, the client's own, never
  // counted. This week's saved ones are in; last time's come back as the
  // plan (1 Oct) so a warm-up done once is a tap away the next week.
  // `own`: added from the menu this visit, so it stays even once the exercise is done.
  type Warm = { plan: Vals; entered: Vals; saved: boolean; own?: boolean };
  const warmFrom = (w: { weight: number | null; reps: number | null }, saved: boolean): Warm =>
    saved ? { plan: EMPTY, entered: { weightKg: w.weight, reps: w.reps, rpe: null }, saved: true } : { plan: { weightKg: w.weight, reps: w.reps, rpe: null }, entered: EMPTY, saved: false };
  const [warm, setWarm] = useState<Warm[]>(() => (exercise.warmups.length ? exercise.warmups.map((w) => warmFrom(w, true)) : exercise.lastWarmups.slice(0, MAX_WARMUPS).map((w) => warmFrom(w, false))));
  // By content: a refresh of the page hands in the same sets again, and
  // resetting on that wiped rows still being filled.
  const warmKey = JSON.stringify(exercise.warmups);
  const [seenWarm, setSeenWarm] = useState(warmKey);
  if (seenWarm !== warmKey) {
    setSeenWarm(warmKey);
    setWarm([...exercise.warmups.map((w) => warmFrom(w, true)), ...warm.filter((r) => !r.saved)]);
  }
  const [, startTransition] = useTransition();
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistWarm = (rows: Warm[]) => {
    if (warmTimer.current) clearTimeout(warmTimer.current);
    warmTimer.current = setTimeout(() => {
      const sets = rows.filter((r) => r.saved).map((r) => ({ weight_kg: r.entered.weightKg, reps: r.entered.reps }));
      startTransition(() => saveWarmupSetsAction(exercise.id, sets));
    }, SAVE_DEBOUNCE_MS);
  };
  const addWarm = () => {
    if (warm.length >= MAX_WARMUPS) return;
    const hint = exercise.lastWarmups[warm.length];
    const row: Warm = { plan: { weightKg: hint?.weight ?? planOf(1).weightKg, reps: hint?.reps ?? null, rpe: null }, entered: EMPTY, saved: false, own: true };
    setWarm([...warm, row]);
    setCurrent(`w${warm.length}`);
  };
  const removeWarm = (i: number) => {
    const rows = warm.filter((_, j) => j !== i);
    setWarm(rows);
    persistWarm(rows);
    if (current === `w${i}`) setCurrent(null);
  };

  // ---- The rows, in order: warm-ups, then the working sets.
  const workRows = Array.from({ length: workCount }, (_, i) => i + 1).map((n): Row => {
    const entered = enteredOf(n);
    // A set held on a question is not done (27 Oct, Alex: it read Saved and the exercise moved on).
    return { id: `s${n}`, kind: "work", n, label: String(n), plan: planOf(n), entered, saved: isSaved(entered) && doubt?.n !== n, extra: n > exercise.sets };
  });
  const doneCount = workRows.filter((r) => r.saved).length;
  const allDone = workRows.length > 0 && doneCount === workRows.length;
  // A warm-up left untouched goes once every set is in (28 Oct, Alex): it read as not finished, and came back open.
  // One logged stays, done in amber.
  const warmShown = (w: Warm) => !allDone || w.saved || w.own || w.entered.weightKg != null || w.entered.reps != null;
  const rows: Row[] = [
    ...warm.flatMap((w, i): Row[] => (warmShown(w) ? [{ id: `w${i}`, kind: "warm", n: i + 1, label: `W${i + 1}`, plan: w.plan, entered: w.entered, saved: w.saved, extra: true }] : [])),
    ...workRows,
  ];
  const firstUnsaved = (after: RowId | null = null) => {
    const from = after ? rows.findIndex((r) => r.id === after) + 1 : 0;
    return rows.slice(from).find((r) => !r.saved)?.id ?? rows.slice(0, from).find((r) => !r.saved)?.id ?? null;
  };
  // Exactly one set is open: the first still to do, or the one tapped.
  const [current, setCurrent] = useState<RowId | null>(() => firstUnsaved());
  const [exerciseKey] = useState(exercise.id);
  if (exerciseKey !== exercise.id) {
    /* a page is one exercise for its whole life */
  }

  // ---- Saving: 300ms after the last change, when weight and reps are in.
  const saveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [saving, setSaving] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  const sendSet = (n: number, v: Vals) => {
    const fd = new FormData();
    fd.set("assignmentId", String(exercise.id));
    fd.set("setNumber", String(n));
    fd.set("gymId", gymId == null ? "" : String(gymId));
    fd.set("weight", v.weightKg == null ? "" : String(v.weightKg));
    fd.set("reps", v.reps == null ? "" : String(v.reps));
    fd.set("rpe", v.rpe == null ? "" : String(v.rpe));
    fd.set("unit", unitNow.current);
    setSaving((s) => [...s, n]);
    logSetAction(fd)
      .then(() => {
        setFailed(false);
        onSetLogged?.();
      })
      .catch(() => setFailed(true))
      .finally(() => setSaving((s) => s.filter((m) => m !== n)));
  };
  const scheduleSave = (n: number, v: Vals) => {
    const t = saveTimers.current.get(n);
    if (t) clearTimeout(t);
    saveTimers.current.set(n, setTimeout(() => sendSet(n, v), SAVE_DEBOUNCE_MS));
  };
  // ---- Advancing: 1.4s after the open set is in (and still open), it folds
  // and the next one still to do opens. Another change restarts the wait.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest rows, for the timer: the one it was set from still had the
  // set it was folding as open, so the last set of an exercise used to
  // find itself and stay open (13 Oct).
  const liveFirstUnsaved = useRef(firstUnsaved);
  useEffect(() => {
    liveFirstUnsaved.current = firstUnsaved;
  });
  const scheduleAdvance = (id: RowId, ms = ADVANCE_MS) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      setCurrent((c) => (c === id ? liveFirstUnsaved.current(id) : c));
      buzz(4);
    }, ms);
  };
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      if (warmTimer.current) clearTimeout(warmTimer.current);
      saveTimers.current.forEach((t) => clearTimeout(t));
    },
    []
  );
  // Every working set in: 1.4s, then on to what is next.
  // Every working set in: 1.4s, then on to what is next. The latest onNext
  // and names sit in a ref, so the timer survives the re-renders of the
  // save landing and the server's refresh (13 Oct: they used to cancel it).
  const doneSeen = useRef(allDone);
  const latest = useRef({ onNext, line: nextName ? `${shownName(exercise)} done, on to ${nextName}` : undefined });
  useEffect(() => {
    latest.current = { onNext, line: nextName ? `${shownName(exercise)} done, on to ${nextName}` : undefined };
  });
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (allDone === doneSeen.current) return;
    doneSeen.current = allDone;
    if (jumpTimer.current) clearTimeout(jumpTimer.current);
    jumpTimer.current = null;
    if (!allDone) return;
    jumpTimer.current = setTimeout(() => {
      jumpTimer.current = null;
      latest.current.onNext?.(latest.current.line);
    }, ADVANCE_MS);
  }, [allDone]);
  useEffect(
    () => () => {
      if (jumpTimer.current) clearTimeout(jumpTimer.current);
    },
    []
  );

  // ---- A change on a row: the value lands, the save and the fold are scheduled.
  const applyRow = (row: Row, patch: Partial<Vals>) => {
    if (row.kind === "warm") {
      const i = row.n - 1;
      const entered = { ...warm[i].entered, ...patch };
      const saved = entered.weightKg != null && entered.reps != null;
      const rows = warm.map((r, j) => (j === i ? { ...r, entered, saved } : r));
      setWarm(rows);
      if (saved) {
        persistWarm(rows);
        scheduleAdvance(row.id);
      }
      return;
    }
    // Reps put in while the weight still shows the plan in grey: that weight is the one done (25 Oct, Alex: a weight
    // left as shown never saved, and the set with it).
    const now = enteredOf(row.n, draftsNow.current);
    if (patch.reps != null && askWeight && patch.weightKg === undefined && now.weightKg == null && row.plan.weightKg != null) patch = { ...patch, weightKg: row.plan.weightKg };
    draftsNow.current = { ...draftsNow.current, [row.n]: { ...(draftsNow.current[row.n] ?? {}), ...patch } };
    const entered = { ...now, ...patch };
    setDrafts((d) => ({ ...d, [row.n]: { ...(d[row.n] ?? {}), ...patch } }));
    if (isSaved(entered)) {
      // Far off: held, and asked under the set (27 Oct).
      const others = workRows.filter((r) => r.n !== row.n && r.saved);
      const d = doubtOf(entered, Math.max(0, ...others.map((r) => r.entered.weightKg ?? 0)), Math.max(0, ...others.map((r) => r.entered.reps ?? 0)));
      if (d.weight || d.reps) {
        const t = saveTimers.current.get(row.n);
        if (t) clearTimeout(t);
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
        setDoubt({ n: row.n, ...d });
        return;
      }
      if (doubt?.n === row.n) setDoubt(null);
      scheduleSave(row.n, entered);
      scheduleAdvance(row.id);
    } else if (doubt?.n === row.n) setDoubt(null);
  };
  // "Yes": the figures as they are, saved, and not asked again this session.
  const vouch = (row: Row) => {
    const v = enteredOf(row.n, draftsNow.current);
    if (doubt?.weight) vouched.current.weight = true;
    if (doubt?.reps) vouched.current.reps = true;
    setDoubt(null);
    scheduleSave(row.n, v);
    scheduleAdvance(row.id);
    buzz(10);
  };
  // "I meant lbs": the figure as typed, read in lbs; the exercise goes to lbs, and the set is checked again.
  const meantLbs = (row: Row) => {
    const v = enteredOf(row.n, draftsNow.current);
    if (v.weightKg == null) return;
    const typedFigure = kgToDisplay(v.weightKg, "kg");
    unitNow.current = "lb";
    setUnit("lb");
    setDoubt(null);
    applyRow(row, { weightKg: displayToKg(typedFigure, "lb") });
  };
  const step = (row: Row, field: Field, dir: 1 | -1) => {
    const have = row.entered[field === "weight" ? "weightKg" : field];
    const plan = row.plan[field === "weight" ? "weightKg" : field];
    if (field === "weight") {
      const baseKg = have ?? plan ?? 0;
      const shown = have != null ? kgToDisplay(baseKg, unit) : plan != null ? planToDisplay(baseKg, unit) : 0;
      const next = Math.max(0, Math.min(9999, shown + dir * stepFor(unit)));
      applyRow(row, { weightKg: displayToKg(next, unit) });
    } else if (field === "reps") {
      applyRow(row, { reps: Math.max(0, Math.min(9999, (have ?? plan ?? 0) + dir)) });
    } else {
      applyRow(row, { rpe: Math.max(1, Math.min(10, (have ?? plan ?? 7) + dir)) });
    }
    buzz();
  };
  // The badge: the whole set exactly as planned, then on.
  const acceptAll = (row: Row) => {
    const patch: Partial<Vals> = {};
    if (row.entered.weightKg == null && row.plan.weightKg != null) patch.weightKg = row.plan.weightKg;
    if (row.entered.reps == null && row.plan.reps != null) patch.reps = row.plan.reps;
    if (row.entered.rpe == null && row.plan.rpe != null) patch.rpe = row.plan.rpe;
    applyRow(row, patch);
    const entered = { ...row.entered, ...patch };
    if (row.kind === "work" ? isSaved(entered) : entered.weightKg != null && entered.reps != null) scheduleAdvance(row.id, 700);
    buzz(10);
  };
  // Typed in (a long press on a number): the figure as shown, in the unit shown.
  const typed = (row: Row, field: Field, text: string) => {
    const v = Number(text.replace(",", ".").trim());
    if (!Number.isFinite(v) || v < 0 || v > 9999) return;
    if (field === "weight") applyRow(row, { weightKg: displayToKg(v, unit) });
    else if (field === "reps") applyRow(row, { reps: Math.round(v) });
    else applyRow(row, { rpe: Math.max(1, Math.min(10, Math.round(v))) });
  };
  const addSet = () => {
    const n = workCount + 1;
    setExtraAdded((e) => Math.max(e, maxLogged - exercise.sets) + 1);
    if (!rows.some((r) => !r.saved)) setCurrent(`s${n}`);
  };
  const removeExtra = (row: Row) => {
    setExtraAdded((e) => Math.max(0, e - 1));
    const { [row.n]: _gone, ...rest } = draftsNow.current;
    void _gone;
    draftsNow.current = rest;
    setDrafts((d) => {
      const next = { ...d };
      delete next[row.n];
      return next;
    });
    if (current === row.id) setCurrent(firstUnsaved());
  };

  // ---- Your note: the one for the gym trained at; where that gym has none,
  // the home gym's, else the latest from any gym, so a note never seems gone.
  const storedNote = (gymId != null ? exercise.gymNotes?.[gymId] : "") || exercise.myNote;
  // Shown the moment Save is tapped (17 Oct, Alex: it took a second to appear), until the page's copy
  // catches up; the save runs behind it.
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [seenStored, setSeenStored] = useState(storedNote);
  if (seenStored !== storedNote) {
    setSeenStored(storedNote);
    setSavedNote(null);
  }
  const myNote = savedNote ?? storedNote;
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(myNote);
  const saveNote = () => {
    const next = noteDraft.trim();
    setNoteOpen(false);
    if (next === myNote.trim()) return;
    setSavedNote(next);
    const fd = new FormData();
    fd.set("assignmentId", String(exercise.id));
    fd.set("gymId", gymId == null ? "" : String(gymId));
    fd.set("text", next);
    startTransition(() => saveExerciseNoteAction(fd));
  };

  // ---- Swap, video, the demo.
  const [swapOpen, setSwapOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  // Sending a picture of the swap (9 Oct): the sheet opens from the swap sheet, marked so.
  const [mediaAbout, setMediaAbout] = useState<"swap" | null>(null);
  // The workout's ⋯ menu (note, warm-up, swap) lands here, once per ask.
  const [seenRequest, setSeenRequest] = useState(request?.n ?? 0);
  if (request && request.n !== seenRequest) {
    setSeenRequest(request.n);
    if (request.kind === "note") {
      setNoteDraft(myNote);
      setNoteOpen(true);
    } else if (request.kind === "warmup") addWarm();
    else if (request.kind === "media") {
      setMediaAbout(null);
      setVideoOpen(true);
    } else setSwapOpen(true);
  }
  const ask = exercise.videoRequest;
  const openDemo = () => {
    if (!exercise.videoUrl) return;
    if (playable(exercise.videoUrl)) setDemoOpen(true);
    else window.open(exercise.videoUrl, "_blank", "noopener");
  };

  // ---- Typing along a set (13 Oct, Alex): the big numbers are boxes; a tap
  // opens the keyboard, Next commits and hands the focus to the next box in
  // the same breath, so weight, reps and RPE are typed in one go.
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fieldOrder = (row: Row): Field[] => [...((askWeight || row.kind === "warm") ? (["weight"] as Field[]) : []), "reps", ...(askRpe && row.kind === "work" ? (["rpe"] as Field[]) : [])];
  const nextField = (row: Row, field: Field): Field | null => {
    const order = fieldOrder(row);
    return order[order.indexOf(field) + 1] ?? null;
  };
  const focusNext = (row: Row, field: Field) => {
    const next = nextField(row, field);
    const el = next ? fieldRefs.current[`${row.id}:${next}`] : null;
    if (el) el.focus();
    else fieldRefs.current[`${row.id}:${field}`]?.blur();
  };

  // ---- What a row shows: entered in ink, else the plan in grey.
  const shownOf = (row: Row, field: Field): { text: string; ghost: boolean; value: number | null } => {
    const key = field === "weight" ? "weightKg" : field;
    const have = row.entered[key];
    const plan = row.plan[key];
    if (have != null) return { text: field === "weight" ? fmtWeight(kgToDisplay(have, unit)) : String(have), ghost: false, value: have };
    if (plan != null) return { text: field === "weight" ? fmtWeight(planToDisplay(plan, unit)) : String(plan), ghost: true, value: plan };
    return { text: "–", ghost: true, value: null };
  };
  const summary = (row: Row) => {
    const w = shownOf(row, "weight");
    const r = shownOf(row, "reps");
    return askWeight || row.kind === "warm" ? `${w.text} ${uLabel} × ${r.text}` : `${r.text} reps`;
  };
  // The same, laid out (13 Oct): the weight in a right-aligned column, so "kg ×" lines up down the card.
  const summaryCells = (row: Row) => {
    const w = shownOf(row, "weight");
    const r = shownOf(row, "reps");
    if (!(askWeight || row.kind === "warm")) return <span className="lw-row-w wide">{r.text} reps</span>;
    return (
      <>
        <span className="lw-row-w">{w.text}</span>
        <span className="lw-row-u">{uLabel}</span>
        <span className="lw-row-x">×</span>
        <span className="lw-row-r">{r.text}</span>
      </>
    );
  };

  return (
    <div className="wo-page-inner lw" data-ex={exercise.id}>
      <div className="wo-ex-head">
        <div className="wo-eyebrow">
          <Bars
            parts={[
              sessionLabel && <span key="s" className="wo-eyebrow-session">{sessionLabel}</span>,
              <span key="c" className="wo-eyebrow-count">
                Exercise {index} of {total}
              </span>,
            ]}
          />
        </div>
        <div className="wo-ex-top">
          <h2 key={exercise.id} className="wo-ex-name">{shownName(exercise)}</h2>
          <div className="wo-ex-tools">{tools}</div>
        </div>
        <div className="wo-ex-title-row">
          {/* Next up only with an exercise ahead (19 Oct, Alex); a free session with nothing after says nothing, not "Last exercise". */}
          {(nextName || !free) && (
            <div className="wo-nextup">
              <span className="wo-nextup-label">{nextName ? "Next up" : "Last exercise"}</span>
              {nextName && <span className="wo-nextup-name">{nextName}</span>}
            </div>
          )}
        </div>
      </div>

      {exercise.swap && (
        <div className="wo-swap-banner">
          <span>
            Substitute for <b>{exercise.name}</b>
          </span>
          <button type="button" onClick={() => startTransition(() => clearSwapAction(exercise.id))}>
            Undo
          </button>
        </div>
      )}

      {/* Swapped (17 Oct, Alex): the coach's cue, the client's own note and the video asks belong to the exercise it replaced, so none of them show. */}
      {!swapped && <CoachNote assignmentId={exercise.id} note={exercise.note} />}
      {/* …but the coach's own note on the substitute they suggested does show (17 Oct, Alex). */}
      {swapNote && (
        <div className="ts-coachnote">
          <div className="ts-coachnote-top">
            <span className="ts-coachnote-label coach-eyebrow">
              <CoachMark />
              From your coach
            </span>
          </div>
          <p className="ts-coachnote-text">{swapNote}</p>
        </div>
      )}

      {/* The coach's demo, its own row; nothing at all without one. */}
      {exercise.videoUrl && (
        <button type="button" className="lw-demo" onClick={openDemo}>
          <span className="lw-demo-play" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
          Demo
        </button>
      )}


      {/* A coach's ask shows with or without a note (the note is optional since 15 Oct); a row the client started shows once something is in it. */}
      {ask && (!swapped || ask.about === "swap") && (!ask.fromClient || ask.note || ask.src || ask.reply) && (
        <button
          type="button"
          className={`wo-video${ask.reply ? " replied" : ask.src ? " sent" : " asked"}${ask.reply && !ask.reply.seen ? " unseen" : ""}`}
          onClick={() => {
            setMediaAbout(null);
            setVideoOpen(true);
          }}
        >
          <span className="wo-video-tile">
            <VideoGlyph />
          </span>
          <span className="wo-video-main">
            <b>{ask.reply ? (ask.carried ? `${coachName}'s reply on this exercise` : `${coachName} replied to your ${ask.media === "photo" ? "photo" : "video"}`) : ask.src ? (ask.media === "photo" ? (ask.about === "swap" ? "Photo of the substitute sent" : "Photo sent") : "Video sent") : `${coachName} wants a video`}</b>
            {/* A reply needs no second line (17 Oct, Alex): the title says it and Open opens it. */}
            {!ask.reply && <small>{/* Sent and its day alone (25 Oct, Alex: "waiting for Finlay is not necessary"). */}
            {ask.src ? (ask.sentAt ? `Sent ${new Date(ask.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Sent") : ask.note || "Of this exercise, this session"}</small>}
          </span>
          <span className="wo-video-action">{ask.reply ? "Open" : ask.src ? "View" : "Record"}</span>
        </button>
      )}

      {/* ---- The sets card. */}
      <div className="lw-card">
        {/* The coach's targets, big enough to read mid-set (17 Oct, Alex: the rep range faded into the Sets label): sets × reps, weight, RPE, time. */}
        {(() => {
          const reps = exercise.reps.trim().replace(/\s*(?:-|–|to)\s*/i, "–");
          const parts = [
            exercise.sets > 0 && reps ? `${exercise.sets} × ${reps} reps` : reps ? `${reps} reps` : exercise.sets > 0 ? `${exercise.sets} ${exercise.sets === 1 ? "set" : "sets"}` : null,
            targetWeight != null ? `${fmtWeight(planToDisplay(targetWeight, unit))} ${uLabel}` : null,
            targetRpe != null && String(targetRpe).trim() ? `RPE ${targetRpe}` : null,
            exercise.time?.trim() ? exercise.time.trim() : null,
          ].filter(Boolean) as string[];
          return parts.length && !free ? (
            <div className="lw-target">
              <span className="lw-target-label">Target</span>
              <span className="lw-target-vals">
                {parts.map((p, i) => (
                  <span key={i}>{p}</span>
                ))}
              </span>
            </div>
          ) : null;
        })()}
        <div className="lw-card-head">
          <span className="lw-eyebrow">Sets</span>
          <span className={`lw-progress${allDone ? " done" : ""}`}>
            {doneCount}/{workRows.length}
          </span>
          {/* KG / LBS on the card's row (13 Oct, back where it was): the exercise's unit, every set of it. */}
          {askWeight && (
            <div className="lw-unit" role="radiogroup" aria-label="Weight unit for this exercise">
              {(["kg", "lb"] as Unit[]).map((u) => (
                <button key={u} type="button" role="radio" aria-checked={unit === u} className={`lw-unit-btn${unit === u ? " on" : ""}`} onClick={() => setUnit(u)}>
                  {u === "kg" ? "KG" : "LBS"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lw-rows">
          {rows.map((row) => {
            const open = row.id === current;
            const state = open ? "open" : row.saved ? "done" : "todo";
            if (!open) {
              const rpe = shownOf(row, "rpe");
              return (
                <Fold key={row.id} state={state}>
                <button type="button" className={`lw-row${row.saved ? " done" : " upcoming"}${row.kind === "warm" ? " warm" : ""}${row.extra && row.kind === "work" && !free ? " extra" : ""}`} onClick={() => setCurrent(row.id)} aria-label={`${row.kind === "warm" ? "Warm-up" : "Set"} ${row.n}, ${summary(row)}${row.saved ? ", logged" : ", planned"}. Open`}>
                  <span className="lw-row-badge" aria-hidden="true">
                    {row.saved ? (
                      <svg viewBox="0 0 24 24">
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    ) : (
                      row.label
                    )}
                    <RingEdge size={36} stroke={row.saved ? 1.5 : 1} />
                  </span>
                  <span className="lw-row-sum">{summaryCells(row)}</span>
                  {/* The RPE slot is always there, empty on a warm-up, so the numbers line up down the card. */}
                  {askRpe && <span className="lw-row-rpe">{row.kind === "work" && rpe.value != null && (!rpe.ghost || !row.saved) ? `RPE ${rpe.text}` : ""}</span>}
                </button>
                </Fold>
              );
            }
            const busy = row.kind === "work" && saving.includes(row.n);
            return (
              <Fold key={row.id} state={state}>
              <div className={`lw-open${row.saved ? " saved" : ""}${row.kind === "warm" ? " warm" : ""}${row.extra && row.kind === "work" && !free ? " extra" : ""}`}>
                <div className="lw-open-head">
                  <button type="button" className="lw-badge" onClick={() => acceptAll(row)} aria-label={`Log ${row.kind === "warm" ? "warm-up" : "set"} ${row.n} as planned`} title="Log as planned">
                    {/* The ring as a vector (19 Oct): an inset shadow on a half-pixel spot came out thicker on one side on iOS. */}
                    <svg className="lw-badge-ring" viewBox="0 0 34 34" aria-hidden="true">
                      <circle cx="17" cy="17" r="16.25" />
                    </svg>
                    {row.label}
                  </button>
                  {/* The title folds the set (13 Oct): the next one still to do opens, or none. */}
                  <button type="button" className="lw-open-title" onClick={() => setCurrent(firstUnsaved(row.id) === row.id ? null : firstUnsaved(row.id))} aria-label={`Close ${row.kind === "warm" ? "warm-up" : "set"} ${row.n}`}>
                    {row.kind === "warm" ? `Warm-up ${row.n}` : `Set ${row.n}`}
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m6 15 6-6 6 6" />
                    </svg>
                  </button>
                  {row.saved && (
                    <span className="lw-saved" role="status">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                      {busy ? "Saving" : "Saved"}
                    </span>
                  )}
                  {row.extra && !row.saved && (
                    <button type="button" className="lw-remove" onClick={() => (row.kind === "warm" ? removeWarm(row.n - 1) : removeExtra(row))} aria-label={`Remove ${row.kind === "warm" ? "warm-up" : "extra set"} ${row.n}`}>
                      Remove
                    </button>
                  )}
                </div>
                {/* Weight and reps side by side (14 Oct): the figure big, its label under it, − and + below. */}
                <div className="lw-fields">
                {(askWeight || row.kind === "warm") && <Stepper row={row} field="weight" label={uLabel.toUpperCase()} shown={shownOf(row, "weight")} onStep={(d) => step(row, "weight", d)} onTyped={(t) => typed(row, "weight", t)} ariaUnit={unit === "kg" ? "kilograms" : "pounds"} inputRef={(el) => (fieldRefs.current[`${row.id}:weight`] = el)} hasNext={nextField(row, "weight") != null} onNext={() => focusNext(row, "weight")} />}
                <Stepper row={row} field="reps" label="REPS" shown={shownOf(row, "reps")} onStep={(d) => step(row, "reps", d)} onTyped={(t) => typed(row, "reps", t)} ariaUnit="reps" inputRef={(el) => (fieldRefs.current[`${row.id}:reps`] = el)} hasNext={nextField(row, "reps") != null} onNext={() => focusNext(row, "reps")} />
                </div>
                {/* Far off what this exercise is (27 Oct, Alex): asked here, the set saved only once answered. */}
                {doubt?.n === row.n && row.kind === "work" && (() => {
                  const v = enteredOf(row.n, draftsNow.current);
                  const w = v.weightKg != null ? `${fmtWeight(kgToDisplay(v.weightKg, unit))} ${uLabel}` : "";
                  const ref = refKg != null ? `${fmtWeight(kgToDisplay(refKg, unit))} ${uLabel}` : "";
                  const line = doubt.weight && doubt.reps
                    ? `${w} and ${v.reps} reps are far over ${refFrom === "last" ? "last time" : "the target"}.`
                    : doubt.weight
                      ? `${w} is far over ${refFrom === "last" ? "last time" : "the target"}, ${ref}.`
                      : `${v.reps} reps is far over the ${repTop} asked.`;
                  const yes = doubt.weight && doubt.reps ? "Yes, save it" : doubt.weight ? `Yes, ${w}` : `Yes, ${v.reps} reps`;
                  return (
                    <div className="lw-doubt" role="alert">
                      <p>{line}</p>
                      <div className="lw-doubt-btns">
                        <button type="button" className="lw-doubt-yes" onClick={() => vouch(row)}>
                          {yes}
                        </button>
                        {doubt.weight && unit === "kg" && (
                          <button type="button" className="lw-doubt-alt" onClick={() => meantLbs(row)}>
                            I meant lbs
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              </Fold>
            );
          })}
        </div>

        <button type="button" className="lw-addset" onClick={addSet}>
          + Add a set
        </button>
        {failed && <div className="lw-offline">Couldn&rsquo;t save. Trying again on your next change</div>}
      </div>

      {swapped ? null : noteOpen ? (
        <div className="wo-note editing">
          <span className="wo-note-label">Your note</span>
          <textarea className="wo-note-input" value={noteDraft} autoFocus rows={2} placeholder="Seat height, grip, cues. Only you see this." onChange={(e) => setNoteDraft(e.target.value)} onBlur={() => noteDraft.trim() === myNote.trim() && setNoteOpen(false)} />
          {/* Cancel and Save only once the note has changed (17 Oct, Alex). */}
          {noteDraft.trim() !== myNote.trim() && (
          <div className="wo-note-foot">
            <button
              type="button"
              className="wo-note-cancel"
              onClick={() => {
                setNoteDraft(myNote);
                setNoteOpen(false);
              }}
            >
              Cancel
            </button>
            <button type="button" className="wo-note-save" onClick={saveNote}>
              Save
            </button>
          </div>
          )}
        </div>
      ) : myNote.trim() ? (
        <button
          type="button"
          className="wo-note"
          onClick={() => {
            setNoteDraft(myNote);
            setNoteOpen(true);
          }}
        >
          <span className="wo-note-head">
            <span className="wo-note-pen" aria-hidden="true">
              <EditPen />
            </span>
            <span className="wo-note-label">Your note</span>
          </span>
          <span className="wo-note-text">{myNote}</span>
        </button>
      ) : null}

      {swapOpen && (
        <SwapExerciseDialog
          exercise={{ name: exercise.name, group: exercise.group }}
          targets={{ sets: exercise.sets, reps: exercise.reps, rpe: exercise.targetRpe, time: exercise.time }}
          suggestions={exercise.alternatives}
          current={exercise.swap}
          coach={{ firstName: coachName, photo: coachPhoto }}
          photoSent={!!exercise.videoRequest && exercise.videoRequest.about === "swap" && !!exercise.videoRequest.src}
          onSwap={(choice) => {
            setSwapOpen(false);
            startTransition(() => swapExerciseAction(exercise.id, choice));
          }}
          onPhoto={() => {
            setSwapOpen(false);
            setMediaAbout("swap");
            setVideoOpen(true);
          }}
          onClose={() => setSwapOpen(false)}
        />
      )}
      {videoOpen && <VideoAskSheet ask={ask} assignmentId={exercise.id} about={mediaAbout} exerciseName={shownName(exercise)} onClose={() => setVideoOpen(false)} />}
      {demoOpen && exercise.videoUrl && (
        <div className="lw-demo-modal" role="dialog" aria-label={`${shownName(exercise)} demo`} onClick={() => setDemoOpen(false)}>
          <button type="button" className="lw-demo-close" onClick={() => setDemoOpen(false)} aria-label="Close the demo">
            ✕
          </button>
          <video className="lw-demo-video" src={exercise.videoUrl} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ---- A row's box, its height easing from one state to the next (13 Oct):
// a set folding to a line and the next unfolding read as one movement,
// not a swap. The height is measured after each change and tweened from
// the last one; between tweens the box is free to size itself.
function Fold({ state, children }: { state: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.height = "";
    // Clipped only while the height eases (28 Oct, Alex): at rest the open set's pulse spreads past the box.
    el.style.overflow = "";
    const next = el.offsetHeight;
    const from = last.current;
    last.current = next;
    if (from == null || from === next || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.style.height = `${from}px`;
    el.style.overflow = "hidden";
    void el.offsetHeight;
    el.style.transition = "height 0.64s cubic-bezier(0.2, 0.8, 0.2, 1)";
    el.style.height = `${next}px`;
    const done = () => {
      el.style.height = "";
      el.style.transition = "";
      el.style.overflow = "";
      last.current = el.offsetHeight;
    };
    el.addEventListener("transitionend", done, { once: true });
    const t = setTimeout(done, 760);
    return () => {
      clearTimeout(t);
      el.removeEventListener("transitionend", done);
    };
  }, [state]);
  return (
    <div ref={ref} className="lw-fold">
      {children}
    </div>
  );
}

// ---- One stepper row: −, the number, +. The number is a box: the plan
// sits in it in grey as the placeholder until something is typed or
// stepped; a tap opens the keyboard with the figure selected; Next (or
// Enter) commits and moves to the next box of the set; tapping away
// commits too. Arrow keys step it.
function Stepper({
  row,
  field,
  label,
  shown,
  small = false,
  onStep,
  onTyped,
  ariaUnit,
  inputRef,
  hasNext,
  onNext,
}: {
  row: Row;
  field: Field;
  label: string;
  shown: { text: string; ghost: boolean; value: number | null };
  small?: boolean;
  onStep: (dir: 1 | -1) => void;
  onTyped: (text: string) => void;
  ariaUnit: string;
  inputRef: (el: HTMLInputElement | null) => void;
  hasNext: boolean;
  onNext: () => void;
}) {
  // What is being typed, while the box has the focus; null otherwise.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (shown.ghost ? "" : shown.text);
  const sizeOf = (t: string) => (t.length >= 5 ? " s5" : t.length === 4 ? " s4" : "");
  const size = sizeOf(text || shown.text);
  const name = `${row.kind === "warm" ? "Warm-up" : "Set"} ${row.n} ${field === "weight" ? "weight" : field}, ${ariaUnit}`;
  // Leaving the box takes what was typed, the plan's own figure included
  // (13 Oct: typing 40 over a planned 40 used to be ignored); an untouched
  // grey box left with Next takes the plan.
  const commit = () => {
    if (draft != null) {
      if (draft.trim() !== "") onTyped(draft);
      else if (shown.ghost && shown.value != null) onTyped(shown.text);
    }
    setDraft(null);
  };
  return (
    <div className={`lw-step${small ? " small" : ""}`}>
      <label className={`lw-value${shown.ghost && draft == null ? " ghost" : ""}`}>
        <input
          ref={inputRef}
          className={`lw-num lw-num-input${size}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint={hasNext ? "next" : "done"}
          value={text}
          placeholder={shown.ghost ? shown.text : ""}
          aria-label={shown.ghost ? `${name}. Planned ${shown.text}` : name}
          onFocus={(e) => {
            setDraft(e.currentTarget.value);
            const el = e.currentTarget;
            setTimeout(() => el.select(), 0);
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              onNext();
            } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
              e.preventDefault();
              onStep(1);
            } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
              e.preventDefault();
              onStep(-1);
            }
          }}
        />
        <span className="lw-num-label" aria-hidden="true">
          {label}
        </span>
      </label>
    </div>
  );
}


// A clean pencil, for editing the note.
function EditPen() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
