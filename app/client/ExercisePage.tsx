"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { clearSwapAction, logSetAction, saveExerciseNoteAction, saveWarmupSetsAction, swapExerciseAction } from "../lib/actions";
import { displayToKg, fmtWeight, kgToDisplay, planToDisplay, stepFor, unitLabel as labelOf, type Unit } from "../lib/units";
import AlternativesSheet from "./AlternativesSheet";
import { VideoAskSheet, VideoGlyph } from "./VideoAskSheet";
import { CoachNote, shownName, type SessionExercise } from "./workoutShared";

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
  gymId,
  coachName,
  nextName = null,
  onNext,
  request = null,
  onSetLogged,
  tools = null,
}: {
  /** The workout's chat and ⋯, on this exercise's own row (2 Oct): what is said there is about the exercise. */
  tools?: React.ReactNode;
  exercise: SessionExercise;
  index: number;
  total: number;
  gymId: number | null;
  coachName: string;
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
  const uLabel = labelOf(unit);

  // The weight for the gym trained at: a machine there is its own machine,
  // so each gym carries its own weight forward.
  const gymWeight = (gymId != null ? exercise.gymTargets?.[gymId] : null) ?? exercise.targetWeight;
  const askWeight = exercise.targetWeight != null;
  // Swapped for something else: the weight and RPE were set for the
  // prescribed exercise, so only the reps carry over.
  const swapped = exercise.swap != null;
  const targetWeight = swapped ? null : gymWeight;
  const targetRpe = swapped ? null : exercise.targetRpe;
  const askRpe = targetRpe != null || exercise.logs.some((l) => l.rpe != null);
  const last = exercise.lastSets;
  const lastOf = (n: number) => last?.sets.find((s) => s.setNumber === n) ?? null;
  // "8-10" → 8, "12" → 12: the reps the plan asks for.
  const repLow = (() => {
    const range = exercise.reps.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/);
    if (range) return Number(range[1]);
    const one = exercise.reps.match(/^\s*(\d+)\s*$/);
    return one ? Number(one[1]) : null;
  })();
  // Progression (9 Oct): last session every working set made the reps at a
  // weight above this week's target: the plan rises to that weight.
  const progressed = (() => {
    if (!last || repLow == null || targetWeight == null || swapped) return null;
    const rows = Array.from({ length: exercise.sets }, (_, i) => lastOf(i + 1));
    if (rows.some((r) => !r || r.reps == null || r.weight == null || r.reps < repLow)) return null;
    const held = Math.min(...rows.map((r) => r!.weight!));
    return held > targetWeight ? held : null;
  })();
  const planWeight = progressed ?? targetWeight;

  // ---- Working sets. Extra sets (12 Oct): once every prescribed set is in,
  // the client can add one. It is logged as set N+1, an extra, never a
  // change to the plan: next week still shows the coach's count.
  const [extraAdded, setExtraAdded] = useState(0);
  const maxLogged = exercise.logs.reduce((m, l) => Math.max(m, l.setNumber), 0);
  const workCount = Math.max(exercise.sets + extraAdded, maxLogged);
  const logOf = (n: number) => exercise.logs.find((l) => l.setNumber === n) ?? null;
  // What the client stepped or typed on a set, over what the server has.
  const [drafts, setDrafts] = useState<Record<number, Partial<Vals>>>({});
  // A set's plan: what this set was last session, else the coach's figures;
  // an extra set with no last-time twin follows the set before it.
  const planOf = (n: number): Vals => {
    const before = n > exercise.sets ? logOf(n - 1) : null;
    const prev = lastOf(n) ?? before;
    return { weightKg: prev?.weight ?? planWeight, reps: prev?.reps ?? repLow, rpe: prev?.rpe ?? targetRpe };
  };
  const enteredOf = (n: number): Vals => {
    const log = logOf(n);
    return { ...(log ? { weightKg: log.weight, reps: log.reps, rpe: log.rpe } : EMPTY), ...(drafts[n] ?? {}) };
  };
  const isSaved = (v: Vals) => (!askWeight || v.weightKg != null) && v.reps != null;

  // ---- Warm-ups: rows of the same kind above set 1, the client's own, never
  // counted. This week's saved ones are in; last time's come back as the
  // plan (1 Oct) so a warm-up done once is a tap away the next week.
  type Warm = { plan: Vals; entered: Vals; saved: boolean };
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
    const row: Warm = { plan: { weightKg: hint?.weight ?? planOf(1).weightKg, reps: hint?.reps ?? null, rpe: null }, entered: EMPTY, saved: false };
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
  const rows: Row[] = [
    ...warm.map((w, i): Row => ({ id: `w${i}`, kind: "warm", n: i + 1, label: `W${i + 1}`, plan: w.plan, entered: w.entered, saved: w.saved, extra: true })),
    ...Array.from({ length: workCount }, (_, i) => i + 1).map((n): Row => {
      const entered = enteredOf(n);
      return { id: `s${n}`, kind: "work", n, label: String(n), plan: planOf(n), entered, saved: isSaved(entered), extra: n > exercise.sets };
    }),
  ];
  const workRows = rows.filter((r) => r.kind === "work");
  const doneCount = workRows.filter((r) => r.saved).length;
  const allDone = workRows.length > 0 && doneCount === workRows.length;
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
    fd.set("unit", unit);
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
  const scheduleAdvance = (id: RowId, ms = ADVANCE_MS) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      setCurrent((c) => (c === id ? firstUnsaved(id) : c));
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
  const latest = useRef({ onNext, line: nextName ? `${shownName(exercise)} done · on to ${nextName}` : undefined });
  useEffect(() => {
    latest.current = { onNext, line: nextName ? `${shownName(exercise)} done · on to ${nextName}` : undefined };
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
    const entered = { ...row.entered, ...patch };
    setDrafts((d) => ({ ...d, [row.n]: { ...(d[row.n] ?? {}), ...patch } }));
    if (isSaved(entered)) {
      scheduleSave(row.n, entered);
      scheduleAdvance(row.id);
    }
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
    setDrafts((d) => {
      const next = { ...d };
      delete next[row.n];
      return next;
    });
    if (current === row.id) setCurrent(firstUnsaved());
  };

  // ---- Your note: the one for the gym trained at; where that gym has none,
  // the home gym's, else the latest from any gym, so a note never seems gone.
  const myNote = (gymId != null ? exercise.gymNotes?.[gymId] : "") || exercise.myNote;
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(myNote);
  const saveNote = () => {
    const next = noteDraft.trim();
    setNoteOpen(false);
    if (next === myNote.trim()) return;
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
        <div className="wo-ex-top">
          <div className="wo-kicker">
            Exercise {index} of {total}
          </div>
          <div className="wo-ex-tools">{tools}</div>
        </div>
        <div className="wo-ex-title-row">
          <h2 className="wo-ex-name">{shownName(exercise)}</h2>
          <div className="wo-nextup">
            <span className="wo-nextup-label">{nextName ? "Next up" : "Last exercise"}</span>
            {nextName && <span className="wo-nextup-name">{nextName}</span>}
          </div>
        </div>
      </div>

      {exercise.swap && (
        <div className="wo-swap-banner">
          <span>
            Swapped from <b>{exercise.name}</b>. {coachName} will see this.
          </span>
          <button type="button" onClick={() => startTransition(() => clearSwapAction(exercise.id))}>
            Undo
          </button>
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

      <CoachNote assignmentId={exercise.id} note={exercise.note} />

      {ask && (ask.note || ask.src || ask.reply) && (
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
            <b>{ask.reply ? (ask.carried ? `${coachName}'s reply on this exercise` : `${coachName} replied to your ${ask.media === "photo" ? "photo" : "video"}`) : ask.src ? (ask.media === "photo" ? (ask.about === "swap" ? "Photo of the swap sent" : "Photo sent") : "Video sent") : `${coachName} wants a video`}</b>
            <small>{ask.reply ? (ask.carried ? "From last time · tap to watch again" : "Tap to see the reply") : ask.src ? (ask.sentAt ? `Sent ${new Date(ask.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · waiting for ${coachName}` : `Waiting for ${coachName}`) : ask.note || "Of this exercise, this session"}</small>
          </span>
          <span className="wo-video-action">{ask.reply ? "Open" : ask.src ? "View" : "Record"}</span>
        </button>
      )}

      {/* ---- The sets card. */}
      <div className="lw-card">
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
                <button type="button" className={`lw-row${row.saved ? " done" : " upcoming"}${row.kind === "warm" ? " warm" : ""}`} onClick={() => setCurrent(row.id)} aria-label={`${row.kind === "warm" ? "Warm-up" : "Set"} ${row.n}, ${summary(row)}${row.saved ? ", logged" : ", planned"}. Open`}>
                  <span className="lw-row-badge" aria-hidden="true">
                    {row.saved ? (
                      <svg viewBox="0 0 24 24">
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    ) : (
                      row.label
                    )}
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
              <div className={`lw-open${row.saved ? " saved" : ""}${row.kind === "warm" ? " warm" : ""}`}>
                <div className="lw-open-head">
                  <button type="button" className="lw-badge" onClick={() => acceptAll(row)} aria-label={`Log ${row.kind === "warm" ? "warm-up" : "set"} ${row.n} as planned`} title="Log as planned">
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
                {(askWeight || row.kind === "warm") && <Stepper row={row} field="weight" label={uLabel.toUpperCase()} shown={shownOf(row, "weight")} min={0} max={9999} onStep={(d) => step(row, "weight", d)} onTyped={(t) => typed(row, "weight", t)} ariaUnit={unit === "kg" ? "kilograms" : "pounds"} />}
                <Stepper row={row} field="reps" label="REPS" shown={shownOf(row, "reps")} min={0} max={9999} onStep={(d) => step(row, "reps", d)} onTyped={(t) => typed(row, "reps", t)} ariaUnit="reps" />
                {askRpe && row.kind === "work" && <Stepper row={row} field="rpe" label="RPE" shown={shownOf(row, "rpe")} min={1} max={10} small onStep={(d) => step(row, "rpe", d)} onTyped={(t) => typed(row, "rpe", t)} ariaUnit="RPE" />}
              </div>
              </Fold>
            );
          })}
        </div>

        <button type="button" className="lw-addset" onClick={addSet}>
          + Add a set
        </button>
        {failed && <div className="lw-offline">Couldn&rsquo;t save · trying again on your next change</div>}
      </div>

      {noteOpen ? (
        <div className="wo-note editing">
          <span className="wo-note-label">Your note</span>
          <textarea className="wo-note-input" value={noteDraft} autoFocus rows={2} placeholder="Seat height, grip, cues. Only you see this." onChange={(e) => setNoteDraft(e.target.value)} />
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
        <AlternativesSheet
          exerciseName={exercise.name}
          coachName={coachName}
          suggested={exercise.alternatives}
          swapped={exercise.swap}
          onPick={(choice) => {
            setSwapOpen(false);
            startTransition(() => swapExerciseAction(exercise.id, choice));
          }}
          onClear={() => {
            setSwapOpen(false);
            startTransition(() => clearSwapAction(exercise.id));
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
    const next = el.offsetHeight;
    const from = last.current;
    last.current = next;
    if (from == null || from === next || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.style.height = `${from}px`;
    void el.offsetHeight;
    el.style.transition = "height 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)";
    el.style.height = `${next}px`;
    const done = () => {
      el.style.height = "";
      el.style.transition = "";
      last.current = el.offsetHeight;
    };
    el.addEventListener("transitionend", done, { once: true });
    const t = setTimeout(done, 400);
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

// ---- One stepper row: −, the number (the plan in grey until taken), +.
// Press and hold − / + repeats, faster after a second and a half. A long
// press on the number opens a box to type a big jump. Arrow keys step it.
function Stepper({
  row,
  field,
  label,
  shown,
  min,
  max,
  small = false,
  onStep,
  onTyped,
  ariaUnit,
}: {
  row: Row;
  field: Field;
  label: string;
  shown: { text: string; ghost: boolean; value: number | null };
  min: number;
  max: number;
  small?: boolean;
  onStep: (dir: 1 | -1) => void;
  onTyped: (text: string) => void;
  ariaUnit: string;
}) {
  const [typing, setTyping] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (typing != null) inputRef.current?.focus();
  }, [typing]);
  const size = shown.text.length >= 5 ? " s5" : shown.text.length === 4 ? " s4" : "";
  const name = `${row.kind === "warm" ? "Warm-up" : "Set"} ${row.n} ${field === "weight" ? "weight" : field}, ${ariaUnit}`;
  const commit = () => {
    if (typing != null && typing.trim() !== "") onTyped(typing);
    setTyping(null);
  };
  return (
    <div className={`lw-step${small ? " small" : ""}`}>
      <StepButton className="lw-minus" onFire={() => onStep(-1)} label={`${name}: less`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </StepButton>
      {typing != null ? (
        <input
          ref={inputRef}
          className={`lw-type${size}`}
          value={typing}
          inputMode="decimal"
          aria-label={name}
          onChange={(e) => setTyping(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setTyping(null);
          }}
        />
      ) : (
        <HoldButton
          className={`lw-value${shown.ghost ? " ghost" : ""}`}
          role="spinbutton"
          ariaLabel={shown.ghost ? `${name}. Planned ${shown.text}, tap to type` : `${name}, tap to type`}
          ariaNow={shown.value}
          min={min}
          max={max}
          onTap={() => setTyping(shown.value == null ? "" : shown.text)}
          onHold={() => setTyping(shown.value == null ? "" : shown.text)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowRight") {
              e.preventDefault();
              onStep(1);
            } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
              e.preventDefault();
              onStep(-1);
            }
          }}
        >
          <span className={`lw-num${size}`}>{shown.text}</span>
          <span className="lw-num-label" aria-hidden="true">
            {label}
          </span>
        </HoldButton>
      )}
      <StepButton className="lw-plus" onFire={() => onStep(1)} label={`${name}: more`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </StepButton>
    </div>
  );
}

/** − / +: one tap, one step (13 Oct: no repeat while held, it felt like it ran away; a big jump is typed). */
function StepButton({ className, onFire, label, children }: { className: string; onFire: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} aria-label={label} onClick={onFire} onContextMenu={(e) => e.preventDefault()}>
      {children}
    </button>
  );
}

/** A tap does one thing, a half-second hold another. */
function HoldButton({ className, role, ariaLabel, ariaNow, min, max, onTap, onHold, onKeyDown, children }: { className: string; role: string; ariaLabel: string; ariaNow: number | null; min: number; max: number; onTap: () => void; onHold: () => void; onKeyDown: (e: React.KeyboardEvent) => void; children: React.ReactNode }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  return (
    <button
      type="button"
      className={className}
      role={role}
      aria-label={ariaLabel}
      aria-valuenow={ariaNow ?? undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={() => {
        clear();
        held.current = false;
        timer.current = setTimeout(() => {
          held.current = true;
          buzz(10);
          onHold();
        }, 500);
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onTap();
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </button>
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
