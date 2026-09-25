"use client";

import { useEffect, useState, useTransition } from "react";
import { saveSkipReasonAction, setCardioDoneAction } from "../lib/actions";
import ExerciseCoachNote from "./ExerciseCoachNote";
import type { VideoAsk } from "./VideoAskSheet";
import type { GymOption } from "./GymPicker";

// What the client's Training tab, a session's overview and the workout all
// share: the shapes the server page hands over, the unit rules, and the
// small pieces (cardio card, skip reason) that appear on more than one
// screen. The server actions are the same as before; nothing stored changes
// shape except what the session itself adds (begun, ended, note, swap).

export type SessionSet = { id: number; setNumber: number; weight: number | null; reps: number | null; rpe: number | null };
export type SessionCardio = { id: number; name: string; time: string; pace: string; incline: string; distance: string; notes: string; done: boolean };
export type LastSet = { setNumber: number; weight: number | null; reps: number | null; rpe: number | null };
export type HistoryEntry = { date: string; gym: string | null; sets: LastSet[] };

export type SessionExercise = {
  id: number;
  /** The prescribed exercise. */
  name: string;
  /** What the client did instead, when they swapped. */
  swap: { libraryExerciseId: number | null; name: string } | null;
  /** What the coach offers instead when the machine is taken. */
  alternatives: { id: number; name: string; note: string | null }[];
  sets: number;
  reps: string;
  targetWeight: number | null;
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
  gyms: GymOption[];
  gymId: number | null;
};

/** The exercise as it reads to the client: the swap's name when there is one. */
export const shownName = (ex: SessionExercise) => ex.swap?.name ?? ex.name;

// ---- Units. Weights are stored in kg; a machine marked in lbs is one tap
// away, remembered per exercise on this phone.
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

export function useWeightUnit(exerciseName: string): [WeightUnit, (unit: WeightUnit) => void] {
  const [unit, setUnit] = useState<WeightUnit>("kg");
  useEffect(() => {
    // Read after mount: the server render has no storage, and kg is the default.
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(unitStorageKey(exerciseName)) === "lb") setUnit("lb");
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [exerciseName]);
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

export type SessionStatus = "done" | "live" | "skipped" | "missed" | "upcoming";
/** Derived, never stored. A day logged before sessions were begun on the app
    counts as done once every set is in. */
export function sessionStatus(day: SessionDay, pastWeek: boolean): SessionStatus {
  if (day.endedAt) return "done";
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
export const shortDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

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
// off, a second tap to undo.
export function CardioCard({ cardio, index, readOnly = false }: { cardio: SessionCardio; index: number; readOnly?: boolean }) {
  const [pending, startTransition] = useTransition();
  const done = cardio.done;
  const cells = (
    [
      ["Time", cardio.time],
      ["Pace", cardio.pace],
      ["Incline", cardio.incline],
      ["Distance", cardio.distance],
    ] as const
  ).filter(([, v]) => v);
  return (
    <div className={`ts-card ts-cardio${done ? " done" : ""}`}>
      <div className="ts-card-head">
        <span className={`ts-circle ${done ? "done" : "active"}`}>{done ? "✓" : index}</span>
        <span className="ts-card-name">{cardio.name}</span>
      </div>
      {cells.length > 0 && (
        <div className="ts-cardio-grid" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
          {cells.map(([label, v]) => (
            <div key={label} className="ts-cardio-cell">
              <b>{v}</b>
              <small>{label}</small>
            </div>
          ))}
        </div>
      )}
      <ExerciseCoachNote assignmentId={null} dateLabel="" text={cardio.notes || null} unread={false} />
      {!readOnly && (
        <button
          type="button"
          className={`ts-cardio-done${done ? " is-done" : ""}`}
          disabled={pending}
          onClick={() => startTransition(() => setCardioDoneAction(cardio.id, !done))}
        >
          {done ? "Done ✓ · tap to undo" : "Mark as done"}
        </button>
      )}
    </div>
  );
}

// The client telling the coach why they could not do a session. A quiet
// text button until tapped, then a field to say why.
export function SkipReason({ dayId, text, onSaved }: { dayId: number; text: string; onSaved?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, start] = useTransition();
  const cancel = () => {
    setDraft(text);
    setEditing(false);
  };
  const save = (value: string) => {
    const next = value.trim();
    setEditing(false);
    setDraft(next);
    if (next === text.trim()) return;
    start(() => saveSkipReasonAction(dayId, next));
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
      <span className="ts-skip-label">Couldn&rsquo;t train{saving ? " · saving…" : ""}</span>
      <span className="ts-skip-text">{text}</span>
    </button>
  ) : (
    <button type="button" className="ts-skip-open" onClick={() => setEditing(true)}>
      Couldn&rsquo;t do this session?
    </button>
  );
}
