"use client";

import { useEffect, useRef, useState } from "react";
import { enqueueWorkout } from "../components/workoutOutbox";
import SwapExerciseDialog from "./workout/SwapExerciseDialog";
import ExerciseCoachNote from "./ExerciseCoachNote";
import type { VideoAsk } from "./VideoAskSheet";
import type { GymOption } from "./GymPickerDialog";
import { Bars } from "./Bars";
import { fmtWeight, planToDisplay, unitLabel } from "../lib/units";
import { dayWords } from "../lib/clientDates";

// What the client's Training tab, a session's overview and the workout all
// share: the shapes the server page hands over, the unit rules, and the
// small pieces (cardio card, skip reason) that appear on more than one
// screen. The server actions are the same as before; nothing stored changes
// shape except what the session itself adds (begun, ended, note, swap).

export type SessionSet = { id: number; setNumber: number; weight: number | null; reps: number | null; rpe: number | null };
/** swap: what the client did instead (the bike was taken); alternatives: what the coach offers. */
export type SessionCardio = { id: number; name: string; time: string; pace: string; incline: string; distance: string; notes: string; done: boolean; swap: string | null; alternatives: { name: string; note: string | null }[] };
export type LastSet = { setNumber: number; weight: number | null; reps: number | null; rpe: number | null };
export type HistoryEntry = { date: string; gym: string | null; sets: LastSet[] };

export type SessionExercise = {
  id: number;
  /** The prescribed exercise. */
  name: string;
  /** What the client did instead, when they swapped. */
  swap: { libraryExerciseId: number | null; name: string } | null;
  /** What the coach offers instead when the machine is taken. */
  alternatives: { id: number; name: string; note: string | null; /** The substitute's demo (14 Oct), for the thumb on the swap pop-up. */ video: string | null }[];
  /** The exercise's muscle group (14 Oct): the swap pop-up's colour. */
  group: string;
  sets: number;
  reps: string;
  targetWeight: number | null;
  /** Kg or lbs, as this exercise was last logged; null when no set says. */
  unit?: WeightUnit | null;
  targetRpe: number | null;
  tempo: string | null;
  /** Prescribed rest between sets, in seconds. */
  rest: number | null;
  distance: string | null;
  time: string | null;
  videoUrl: string | null;
  logs: SessionSet[];
  /** The coach's note on this prescription. */
  note: { text: string | null; dateLabel: string; unread: boolean };
  /** The client's own note on this exercise: settings, cues. */
  myNote: string;
  /** Warm-up sets the client added, in kg. Optional, never counted. */
  warmups: { weight: number | null; reps: number | null }[];
  /** The warm-up from the last time the client had this exercise. */
  lastWarmups: { weight: number | null; reps: number | null }[];
  /** The coach asked for a video of this exercise in this session. */
  videoRequest: VideoAsk | null;
  /** With gyms: the weight target and "My notes" at each gym, by gym id. */
  gymTargets?: Record<number, number | null>;
  gymNotes?: Record<number, string>;
  /** The sets from the last time the client did this exercise. */
  lastSets: { date: string; sets: LastSet[] } | null;
  /** Last time at each gym (9 Nov, Alex): the gym you are at first, so a switch of gym shows its numbers at once. */
  lastSetsAt?: Record<number, { date: string; sets: LastSet[] } | null>;
  /** An assisted lift (its library exercise or variation says so): more weight is more help. */
  assisted?: boolean;
  /** The last few sessions of it, most recent first. */
  history: HistoryEntry[];
};

export type SessionDay = {
  key: number;
  /** Its place in the week, from 1. */
  index: number;
  week: number;
  title: string;
  exercises: SessionExercise[];
  cardio: SessionCardio[];
  skipReason: string;
  startedAt: string | null;
  endedAt: string | null;
  sessionNote: string;
  /** What the coach asks before ending (the workout questionnaire): 1 to 10, a number, or words. */
  questions: { id: string; label: string; kind?: "scale" | "number" | "text"; unit?: string }[];
  /** What was answered, by question id: a number, or the words. */
  answers: Record<string, number | string>;
  gyms: GymOption[];
  gymId: number | null;
  /** The client's own session off the plan (19 Oct): no targets, exercises added as they go. */
  free?: boolean;
  /** A duplicate of a planned session (9 Nov, Alex): trained as one, gone if left unstarted or discarded. */
  copy?: boolean;
};

/** The coach's library as a free session offers it: what can be added. */
export type LibraryPick = { id: number; name: string; group: string };

/** The exercise as it reads to the client: the swap's name when there is one. */
export const shownName = (ex: SessionExercise) => ex.swap?.name ?? ex.name;
/** Last time as read at the gym the session is at now (9 Nov, Alex). */
export const lastSetsHere = (ex: SessionExercise, gymId: number | null) => (gymId != null && ex.lastSetsAt && gymId in ex.lastSetsAt ? ex.lastSetsAt[gymId] : ex.lastSets);

/** A session as a discard leaves it (discardSession in queries.ts): not started, nothing logged, no swaps or warm-ups. */
export const fresh = (d: SessionDay): SessionDay => ({
  ...d,
  startedAt: null,
  endedAt: null,
  sessionNote: "",
  answers: {},
  exercises: d.exercises.map((e) => ({ ...e, logs: [], warmups: [], swap: null })),
  cardio: d.cardio.map((c) => ({ ...c, done: false, swap: null })),
});

// ---- Units. Weights are stored in kg; a machine marked in lbs is one tap
// away. An exercise opens in what it was last logged in (kept with the
// sets, so it holds week to week and on any phone); until a set says, in
// what this phone remembers for it.
export type WeightUnit = "kg" | "lb";
const KG_PER_LB = 0.45359237;
export const roundTo = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
// Shown weights always round up: kg to the next quarter, lbs to the next
// half. Tidied to two decimals first, so the ten-thousandths a figure saved
// from lbs carries don't tip it to the next step.
const ceilTo = (n: number, step: number) => roundTo(Math.ceil(roundTo(n, 2) / step - 1e-9) * step, 2);
export const kgToUnit = (kg: number, unit: WeightUnit) => (unit === "kg" ? ceilTo(kg, 0.25) : ceilTo(kg / KG_PER_LB, 0.5));
// Four decimals in kg, so a figure typed in lbs reads back as the same figure.
export const unitToKg = (value: number, unit: WeightUnit) => (unit === "kg" ? value : roundTo(value * KG_PER_LB, 4));
const unitStorageKey = (exerciseName: string) => `ironline:weight-unit:${exerciseName.trim().toLowerCase()}`;

export function useWeightUnit(exerciseName: string, logged: WeightUnit | null = null): [WeightUnit, (unit: WeightUnit) => void] {
  const [unit, setUnit] = useState<WeightUnit>(logged ?? "kg");
  useEffect(() => {
    if (logged) return;
    // Read after mount: the server render has no storage, and kg is the default.
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(unitStorageKey(exerciseName)) === "lb") setUnit("lb");
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [exerciseName, logged]);
  const choose = (next: WeightUnit) => {
    setUnit(next);
    try {
      if (next === "lb") localStorage.setItem(unitStorageKey(exerciseName), "lb");
      else localStorage.removeItem(unitStorageKey(exerciseName));
    } catch {}
  };
  return [unit, choose];
}

/** A phone-only setting, remembered in localStorage. */
export function useLocalFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(initial);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = localStorage.getItem(key);
        if (v === "1") setOn(true);
        else if (v === "0") setOn(false);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [key]);
  const set = (v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {}
  };
  return [on, set];
}

// Digits and one dot; a typed comma becomes the dot.
export function tidyDecimal(e: React.FormEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  let out = "";
  let seenDot = false;
  for (const ch of el.value) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if ((ch === "." || ch === ",") && !seenDot) {
      out += ".";
      seenDot = true;
    }
  }
  if (out !== el.value) el.value = out;
}

// ---- Progress.
export const hasSet = (ex: SessionExercise, n: number) => ex.logs.some((l) => l.setNumber === n);
export const loggedCount = (ex: SessionExercise) => Array.from({ length: ex.sets }, (_, i) => i + 1).filter((n) => hasSet(ex, n)).length;
export const isDone = (ex: SessionExercise) => ex.sets > 0 && loggedCount(ex) >= ex.sets;
export const plannedSets = (day: SessionDay) => day.exercises.reduce((s, ex) => s + ex.sets, 0);
export const loggedSets = (day: SessionDay) => day.exercises.reduce((s, ex) => s + loggedCount(ex), 0);
/** Σ kg × reps over the logged working sets. */
export const volumeKg = (day: SessionDay) => day.exercises.reduce((s, ex) => s + ex.logs.reduce((t, l) => t + (l.weight ?? 0) * (l.reps ?? 0), 0), 0);
export const volumeLabel = (kg: number) => (kg >= 1000 ? `${roundTo(kg / 1000, 1)} t` : `${Math.round(kg)} kg`);
export const allLogged = (day: SessionDay) =>
  day.exercises.length + day.cardio.length > 0 && day.exercises.every(isDone) && day.cardio.every((c) => c.done);
/** A rough length for a session not yet done: sets × (rest + a set), to 5 minutes. */
export const estimateMinutes = (day: SessionDay) => {
  const s = day.exercises.reduce((t, ex) => t + ex.sets * ((ex.rest ?? 90) + 45), 0);
  return Math.max(5, Math.round(s / 60 / 5) * 5);
};

export type SessionStatus = "done" | "unfinished" | "live" | "skipped" | "missed" | "upcoming";
/** Derived, never stored. A day logged before sessions were begun on the app
    counts as done once every set is in. */
export function sessionStatus(day: SessionDay, pastWeek: boolean): SessionStatus {
  // Ended with sets or cardio still to do: unfinished, as the coach sees it
  // (the admin says Complete only when every set is in).
  if (day.endedAt) return allLogged(day) ? "done" : "unfinished";
  if (day.startedAt) return "live";
  if (day.skipReason) return "skipped";
  if (allLogged(day)) return "done";
  if (pastWeek && loggedSets(day) === 0) return "missed";
  return "upcoming";
}

// ---- Time.
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
export const durationMinutes = (day: { startedAt: string | null; endedAt: string | null }) =>
  day.startedAt && day.endedAt ? Math.max(0, Math.round((Date.parse(day.endedAt) - Date.parse(day.startedAt)) / 60000)) : null;
export const shortDate = (iso: string) => dayWords(iso, { weekday: "short" });

/** A once-a-second tick while `active`; recomputed when the app comes back
    to the front, so a backgrounded phone catches up at once. */
export function useTicker(active: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active]);
  return now;
}
export const elapsedMs = (startedAt: string | null, endedAt: string | null, now: number | null) => {
  if (!startedAt) return 0;
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : now ?? start;
  return Math.max(0, end - start);
};

// ---- Pieces shared by the overview and the workout.

/** The coach's note on an exercise, with the read tracking it always had. */
export function CoachNote({ assignmentId, note }: { assignmentId: number | null; note: SessionExercise["note"] }) {
  return <ExerciseCoachNote assignmentId={assignmentId} dateLabel={note.dateLabel} text={note.text} unread={note.unread} />;
}

// Cardio: the targets as tiles, the coach's note, one button to tick it
// off, a second tap to undo. Bike taken: Swap says what was done instead
// (the coach's alternatives, or typed), which ticks it off too (28 Sep).
export function CardioCard({ cardio, index, session, readOnly = false, coachName = "Coach", sessionLabel = null, position = null, free = false, nextName = null, request = null, onNext }: { /** The ⋯ menu asking for the substitute (9 Nov, Alex: Mark as done alone on the page). */ request?: { n: number } | null; cardio: SessionCardio; index: number; /** The session it is in, as the screen knows it: its saves are kept on the phone until sent (7 Nov, workoutOutbox.ts). */ session: { dayId: number; startedAt: string | null }; readOnly?: boolean; coachName?: string; /** The workout's eyebrow (19 Oct): the session, and which cardio of how many. */ sessionLabel?: React.ReactNode; position?: { n: number; total: number } | null; /** A free session's cardio (19 Oct): no targets; the client fills in what they did. */ free?: boolean; /** What comes after it, for the line on the way there. */ nextName?: string | null; /** On to what's next, as an exercise moves on once its last set is in (23 Oct, Alex: Done on a cardio stayed put). */ onNext?: (line?: string) => void }) {
  // Done, the swap and the figures as the outbox has them: shown at once, sent behind (7 Nov), so nothing waits on the signal.
  const save = (c: { kind: "cardioDone"; done: boolean } | { kind: "cardioSwap"; name: string | null } | { kind: "cardioFigure"; field: "time" | "pace" | "incline" | "distance"; value: string }) =>
    enqueueWorkout({ ...c, cardioId: cardio.id, dayId: session.dayId, startedAt: session.startedAt });
  // Marked done: 1.4s, as an exercise's last set, then on to the next; taking it back in that time stays here.
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestNext = useRef({ onNext, line: nextName ? `${cardio.swap ?? cardio.name} done, on to ${nextName}` : undefined });
  useEffect(() => {
    latestNext.current = { onNext, line: nextName ? `${cardio.swap ?? cardio.name} done, on to ${nextName}` : undefined };
  });
  useEffect(
    () => () => {
      if (nextTimer.current) clearTimeout(nextTimer.current);
    },
    []
  );
  const toggleDone = () => {
    const marking = !cardio.done;
    if (nextTimer.current) clearTimeout(nextTimer.current);
    nextTimer.current = null;
    save({ kind: "cardioDone", done: marking });
    if (marking && latestNext.current.onNext) {
      nextTimer.current = setTimeout(() => {
        nextTimer.current = null;
        latestNext.current.onNext?.(latestNext.current.line);
      }, 1400);
    }
  };
  // What was done, typed in (a free session): kept here, saved as each box is left.
  const [did, setDid] = useState({ time: cardio.time, distance: cardio.distance, pace: cardio.pace, incline: cardio.incline });
  const saveDid = (k: keyof typeof did) => {
    if (did[k] !== cardio[k]) save({ kind: "cardioFigure", field: k, value: did[k] });
  };
  const [swapOpen, setSwapOpen] = useState(false);
  const [seenRequest, setSeenRequest] = useState(request?.n ?? 0);
  if (request && request.n !== seenRequest) {
    setSeenRequest(request.n);
    setSwapOpen(true);
  }
  const done = cardio.done;
  // Drawn like an exercise page (19 Oct, Alex: the cardio was still the old boxed card): the eyebrow,
  // the name large, the targets as the exercise page's table (3 Nov, Alex), the coach's note, then Mark as done.
  return (
    <div className={`wo-cardio${done ? " done" : ""}`} data-index={index}>
      <div className="wo-ex-head">
        <div className="wo-eyebrow">
          <Bars
            parts={[
              sessionLabel && <span key="s" className="wo-eyebrow-session">{sessionLabel}</span>,
              <span key="c" className="wo-eyebrow-count">
                {position ? `Cardio ${position.n} of ${position.total}` : "Cardio"}
              </span>,
            ]}
          />
        </div>
        <div className="wo-ex-top">
          <h2 className="wo-ex-name">{cardio.swap ?? cardio.name}</h2>
        </div>
      </div>
      {cardio.swap && (
        <div className="wo-swap-banner">
          <span>
            Instead of <b>{cardio.name}</b>
          </span>
          {!readOnly && (
            <button type="button" onClick={() => save({ kind: "cardioSwap", name: null })}>
              Undo
            </button>
          )}
        </div>
      )}
      {free && (
        <div className="wo-cardio-did">
          {(
            [
              ["time", "Minutes"],
              ["distance", "Km"],
              ["pace", "Km/h"],
              ["incline", "Incline %"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="wo-cardio-field">
              <input value={did[k]} onChange={(e) => setDid((d) => ({ ...d, [k]: e.target.value }))} onBlur={() => saveDid(k)} inputMode="decimal" placeholder="–" aria-label={label} disabled={readOnly} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
      {/* Swapped, a naked sheet (4 Nov, Alex: "when we swap an exercise, it should just be a naked sheet"): the targets were the replaced cardio's. */}
      {!free && !cardio.swap && <TargetTable cols={cardioColumns(cardio)} />}
      {/* Swapped, the coach's note on the cardio it replaced goes, their note on the substitute shows, as an exercise's (17 Oct, Alex; 4 Nov, review). */}
      <ExerciseCoachNote assignmentId={null} dateLabel="" text={(cardio.swap ? cardio.alternatives.find((a) => a.name === cardio.swap)?.note?.trim() : cardio.notes) || null} unread={false} />
      {!readOnly && (
        <button
          type="button"
          className={`wo-cardio-done${done ? " is-done" : ""}`}
          onClick={toggleDone}
        >
          {/* Just Done (21 Oct, Alex: no "tap to undo"); a tap on it still takes it back. */}
          {done ? "Done" : "Mark as done"}
        </button>
      )}
      {swapOpen && (
        <SwapExerciseDialog
          exercise={{ name: cardio.name, group: "cardio" }}
          targets={{ sets: 1, reps: "", rpe: null, time: cardio.time || null }}
          suggestions={cardio.alternatives.map((a, i) => ({ id: i, name: a.name, note: a.note, video: null }))}
          current={cardio.swap ? { libraryExerciseId: (() => { const i = cardio.alternatives.findIndex((a) => a.name === cardio.swap); return i >= 0 ? i : null; })(), name: cardio.swap } : null}
          coach={{ firstName: coachName, photo: null }}
          onSwap={(choice) => {
            setSwapOpen(false);
            const name = choice.libraryExerciseId != null ? cardio.alternatives[choice.libraryExerciseId]?.name : choice.customName;
            if (name) save({ kind: "cardioSwap", name });
          }}
          onClose={() => setSwapOpen(false)}
        />
      )}
    </div>
  );
}

// The client telling the coach why they could not do a session. A quiet
// text button until tapped, then a field to say why.
export function SkipReason({ dayId, text, onSaved }: { dayId: number; text: string; onSaved?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const cancel = () => {
    setDraft(text);
    setEditing(false);
  };
  const save = (value: string) => {
    const next = value.trim();
    setEditing(false);
    setDraft(next);
    if (next === text.trim()) return;
    // Kept on the phone until sent (7 Nov, workoutOutbox.ts); the day was never begun.
    enqueueWorkout({ kind: "skip", text: next, dayId, startedAt: null });
    if (next) onSaved?.();
  };
  if (editing) {
    return (
      <div className="ts-skip editing">
        <span className="ts-skip-label">Reason</span>
        <textarea
          className="ts-skip-input"
          value={draft}
          autoFocus
          rows={2}
          maxLength={300}
          placeholder="Holiday, work trip, sick, injured, no time…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
        />
        <div className="ts-mynote-foot">
          {text && (
            <button type="button" className="ts-skip-clear" onClick={() => save("")}>
              Remove
            </button>
          )}
          <span className="ts-mynote-btns">
            <button type="button" className="ts-mynote-cancel" onClick={cancel}>
              Cancel
            </button>
            <button type="button" className="ts-skip-save" onClick={() => save(draft)} disabled={!draft.trim()}>
              Save
            </button>
          </span>
        </div>
      </div>
    );
  }
  return text ? (
    <button type="button" className="ts-skip said" onClick={() => setEditing(true)}>
      <span className="ts-skip-label"><Bars parts={["Couldn’t train"]} /></span>
      <span className="ts-skip-text">{text}</span>
    </button>
  ) : (
    <button type="button" className="ts-skip-open" onClick={() => setEditing(true)}>
      Couldn&rsquo;t train
    </button>
  );
}

// The coach's targets as columns, one order everywhere (3 Nov, Alex: 1 of docs/boards/drawn-several-ways-mockup.html):
// Sets, Reps (an en dash, 8–10), kg or lbs in the exercise's unit, RPE, Tempo, Rest (90s, or 2 min from 120s); a
// cardio's Time, Pace, Incline, Distance. Only what the coach filled in.
export function targetColumns(t: { sets?: number | null; reps?: string | null; weightKg?: number | null; unit?: WeightUnit | null; rpe?: number | string | null; tempo?: string | null; rest?: number | null; time?: string | null; pace?: string | null; incline?: string | null; distance?: string | null }): [string, string][] {
  const unit = t.unit ?? "kg";
  const reps = (t.reps ?? "").trim().replace(/\s*(?:-|–|to)\s*/i, "–");
  const rest = t.rest != null && t.rest > 0 ? (t.rest % 60 === 0 && t.rest >= 120 ? `${t.rest / 60} min` : `${t.rest}s`) : null;
  const text = (v: string | null | undefined) => v?.trim() || null;
  return (
    [
      t.sets != null && t.sets > 0 ? ["Sets", String(t.sets)] : null,
      reps ? ["Reps", reps] : null,
      t.weightKg != null ? [unitLabel(unit), fmtWeight(planToDisplay(t.weightKg, unit))] : null,
      t.rpe != null && String(t.rpe).trim() ? ["RPE", String(t.rpe)] : null,
      text(t.tempo) ? ["Tempo", text(t.tempo)!] : null,
      rest ? ["Rest", rest] : null,
      text(t.time) ? ["Time", text(t.time)!] : null,
      text(t.pace) ? ["Pace", text(t.pace)!] : null,
      text(t.incline) ? ["Incline", text(t.incline)!] : null,
      text(t.distance) ? ["Distance", text(t.distance)!] : null,
    ] as ([string, string] | null)[]
  ).filter((c): c is [string, string] => !!c);
}
export const cardioColumns = (c: SessionCardio) => targetColumns({ time: c.time, pace: c.pace, incline: c.incline, distance: c.distance });

// The targets as the workout's table (3 Nov, Alex: one table on the exercise page, the session overview and the
// cardio page): TARGET, the names in small grey caps over one hairline across the width, the figures under them in
// ink; five or more spread over the width, fewer from the left 32px apart (`.lw-target-grid`).
export function TargetTable({ cols }: { cols: [string, string][] }) {
  if (!cols.length) return null;
  return (
    <div className="lw-target">
      <span className="lw-target-label">Target</span>
      <div className={`lw-target-grid${cols.length >= 5 ? " spread" : ""}${cols.length >= 6 ? " dense" : ""}`} style={{ gridTemplateColumns: `repeat(${cols.length}, max-content)` }}>
        {cols.map(([name]) => (
          <span key={`h${name}`} className="lw-target-h">
            {name}
          </span>
        ))}
        {cols.map(([name, v]) => (
          <span key={`v${name}`} className="lw-target-v">
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
