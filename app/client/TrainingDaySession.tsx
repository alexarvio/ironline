"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { logSetAction, updateSetAction } from "../lib/actions";
import { ChevronDownIcon } from "../components/icons";

// One training day, logged in focus mode: one exercise open at a time,
// every planned set visible, one active row to type into and one button
// to log it. Data comes in as plain props from the server page; the two
// server actions (log a set, correct a set) are the same as before, so
// nothing about what is stored changes.

export type SessionSet = { id: number; setNumber: number; weight: number | null; reps: number | null; rpe: number | null };
export type SessionExercise = {
  id: number;
  name: string;
  sets: number;
  reps: string;
  targetWeight: number | null;
  targetRpe: number | null;
  tempo: string | null;
  videoUrl: string | null;
  logs: SessionSet[];
  /** The coach-note bubble, rendered by the server page. */
  note: ReactNode;
};

// Digits and one dot; a typed comma becomes the dot.
function tidyDecimal(e: React.FormEvent<HTMLInputElement>) {
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

const hasSet = (ex: SessionExercise, n: number) => ex.logs.some((l) => l.setNumber === n);
const nextMissing = (ex: SessionExercise) => {
  for (let n = 1; n <= ex.sets; n++) if (!hasSet(ex, n)) return n;
  return ex.sets + 1;
};
const loggedCount = (ex: SessionExercise) => Array.from({ length: ex.sets }, (_, i) => i + 1).filter((n) => hasSet(ex, n)).length;
const isDone = (ex: SessionExercise) => nextMissing(ex) > ex.sets;
const firstUnfinished = (list: SessionExercise[]) => list.find((ex) => !isDone(ex))?.id ?? null;

export default function TrainingDaySession({
  dayName,
  label,
  exercises,
  defaultOpen,
}: {
  dayName: string;
  label: string | null;
  exercises: SessionExercise[];
  defaultOpen: boolean;
}) {
  const planned = exercises.reduce((s, ex) => s + ex.sets, 0);
  const logged = exercises.reduce((s, ex) => s + loggedCount(ex), 0);
  const dayDone = exercises.length > 0 && exercises.every(isDone);

  const [open, setOpen] = useState(defaultOpen);
  // Which exercise is expanded; starts on the first with sets still to log.
  const [expandedId, setExpandedId] = useState<number | null>(() => firstUnfinished(exercises) ?? exercises[0]?.id ?? null);
  const activeId = firstUnfinished(exercises);

  // When the expanded exercise's last set lands, hold the green card for a
  // beat, then fold it and open the next one with sets left.
  const expanded = exercises.find((ex) => ex.id === expandedId) ?? null;
  const expandedDone = !!expanded && isDone(expanded);
  // Remembered per exercise, so opening one that was already finished
  // does not read as "just finished" and snap away.
  const last = useRef<{ id: number | null; done: boolean }>({ id: expandedId, done: expandedDone });
  useEffect(() => {
    const prev = last.current;
    last.current = { id: expandedId, done: expandedDone };
    const justFinished = expandedId != null && prev.id === expandedId && !prev.done && expandedDone;
    if (!justFinished) return;
    const next = firstUnfinished(exercises);
    const t = setTimeout(() => setExpandedId(next), 600);
    return () => clearTimeout(t);
  }, [expandedId, expandedDone, exercises]);

  const position = expanded ? exercises.findIndex((ex) => ex.id === expanded.id) + 1 : 0;

  return (
    <section className={`ts-day${dayDone ? " done" : ""}`}>
      <button type="button" className="ts-day-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="ts-day-head-main">
          <div className="ts-day-title">
            {dayName}
            {label ? ` · ${label}` : ""}
          </div>
          <div className="ts-day-sub">
            {dayDone ? "Session complete" : position > 0 ? `Exercise ${position} of ${exercises.length}` : `${exercises.length} exercises`}
          </div>
        </div>
        <span className="ts-day-head-right">
          <span className={`ts-day-pill${dayDone ? " done" : ""}`}>
            {logged} / {planned} sets
          </span>
          <span className={`ts-chev${open ? " up" : ""}`} aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </span>
      </button>

      {open && (
        <div className="ts-list">
          {exercises.map((ex, i) =>
            ex.id === expandedId ? (
              <ExpandedExercise
                key={ex.id}
                exercise={ex}
                onCollapse={() => setExpandedId(null)}
              />
            ) : (
              <CollapsedExercise
                key={ex.id}
                exercise={ex}
                index={i + 1}
                active={ex.id === activeId}
                onOpen={() => setExpandedId(ex.id)}
              />
            )
          )}
        </div>
      )}
    </section>
  );
}

function CollapsedExercise({
  exercise,
  index,
  active,
  onOpen,
}: {
  exercise: SessionExercise;
  index: number;
  active: boolean;
  onOpen: () => void;
}) {
  const done = isDone(exercise);
  const started = exercise.logs.length > 0;
  const tone = done ? "done" : active ? "active" : started ? "started" : "idle";
  return (
    <button type="button" className={`ts-row ${tone}`} onClick={onOpen}>
      <span className="ts-circle">{done ? "✓" : index}</span>
      <span className="ts-row-name">{exercise.name}</span>
      <span className="ts-row-count">
        {loggedCount(exercise)}/{exercise.sets}
      </span>
      <span className="ts-chev">
        <ChevronDownIcon />
      </span>
    </button>
  );
}

function ExpandedExercise({ exercise, onCollapse }: { exercise: SessionExercise; onCollapse: () => void }) {
  const done = isDone(exercise);
  const nextSet = nextMissing(exercise);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  // The bottom button only wakes up once reps has a value.
  const [reps, setReps] = useState("");
  const formId = useId();
  const editing = editingId != null ? exercise.logs.find((l) => l.id === editingId) ?? null : null;

  // A finished exercise reopened later is read-only until Edit is tapped.
  const rows = Array.from({ length: exercise.sets }, (_, i) => {
    const n = i + 1;
    const log = exercise.logs.find((l) => l.setNumber === n) ?? null;
    return { n, log };
  });

  const targets = [
    exercise.targetWeight != null ? { value: `${exercise.targetWeight}`, unit: "kg" } : null,
    exercise.reps ? { value: exercise.reps, unit: "reps" } : null,
    exercise.targetRpe != null ? { value: `${exercise.targetRpe}`, unit: "rpe" } : null,
  ].filter((t): t is { value: string; unit: string } => !!t);

  const submit = async (formData: FormData) => {
    setPending(true);
    try {
      if (editing) await updateSetAction(formData);
      else await logSetAction(formData);
    } finally {
      setPending(false);
      setEditingId(null);
      setReps("");
    }
  };

  // A prefilled figure is a suggestion: tapping into the field selects it,
  // so typing replaces it instead of appending to it.
  const selectAll = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    // iOS applies the selection only once the tap has finished.
    setTimeout(() => el.select(), 0);
  };
  const inputs = (defaults: { weight: string; reps: string; rpe: string }, key: string) => (
    <>
      <input
        key={`w-${key}`}
        form={formId}
        name="weight"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        onFocus={selectAll}
        onClick={selectAll}
        onInput={tidyDecimal}
        defaultValue={defaults.weight}
        aria-label="Weight in kg"
        className="ts-input"
        required
      />
      <input
        key={`r-${key}`}
        form={formId}
        name="reps"
        type="number"
        inputMode="numeric"
        min={0}
        placeholder={exercise.reps || "reps"}
        onFocus={selectAll}
        onClick={selectAll}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        aria-label="Reps"
        className="ts-input reps"
        required
      />
      <input
        key={`p-${key}`}
        form={formId}
        name="rpe"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        onFocus={selectAll}
        onClick={selectAll}
        onInput={tidyDecimal}
        defaultValue={defaults.rpe}
        aria-label="RPE"
        className="ts-input"
      />
    </>
  );

  return (
    <div className={`ts-card${done ? " done" : ""}`}>
      <div className="ts-card-head">
        {done && <span className="ts-circle done">✓</span>}
        <span className="ts-card-name">{exercise.name}</span>
        <span className="ts-card-tools">
          {exercise.note}
          <button type="button" className="ts-chev up" onClick={onCollapse} aria-label="Collapse">
            <ChevronDownIcon />
          </button>
        </span>
      </div>
      {exercise.videoUrl && (
        <a href={exercise.videoUrl} target="_blank" rel="noreferrer" className="ts-video">
          ▶ how to
        </a>
      )}

      {(targets.length > 0 || exercise.tempo) && (
        <div className="ts-target">
          <div className="ts-target-label">Target</div>
          {targets.length > 0 && (
            <div className="ts-grid ts-target-line">
              <span />
              {targets.map((t) => (
                <span key={t.unit}>
                  <b>{t.value}</b> <small>{t.unit}</small>
                </span>
              ))}
              {Array.from({ length: 3 - targets.length }, (_, i) => (
                <span key={`pad-${i}`} />
              ))}
              <span />
            </div>
          )}
          {exercise.tempo && (
            <div className="ts-target-tempo">
              <b>{exercise.tempo}</b> <small>tempo</small>
            </div>
          )}
        </div>
      )}

      <div className="ts-grid ts-cols">
        <span>Set</span>
        <span>Kg</span>
        <span>Reps</span>
        <span>Rpe</span>
        <span />
      </div>

      {rows.map(({ n, log }) => {
        if (log && editing?.id !== log.id) {
          return (
            <div key={n} className="ts-grid ts-set logged">
              <span className="ts-circle done">✓</span>
              <span>{log.weight ?? "–"}</span>
              <span>{log.reps ?? "–"}</span>
              <span>{log.rpe ?? "–"}</span>
              <button
                type="button"
                className="ts-edit"
                onClick={() => {
                  setEditingId(log.id);
                  setReps(log.reps != null ? String(log.reps) : "");
                }}
              >
                Edit
              </button>
            </div>
          );
        }
        if (log && editing?.id === log.id) {
          return (
            <div key={n} className="ts-grid ts-set active">
              <span className="ts-circle active">{n}</span>
              {inputs({ weight: log.weight != null ? String(log.weight) : "", reps: String(log.reps ?? ""), rpe: log.rpe != null ? String(log.rpe) : "" }, `edit-${log.id}`)}
              <span />
            </div>
          );
        }
        if (!editing && n === nextSet) {
          return (
            <div key={n} className="ts-grid ts-set active">
              <span className="ts-circle active">{n}</span>
              {inputs(
                {
                  weight: exercise.targetWeight != null ? String(exercise.targetWeight) : "",
                  reps: "",
                  rpe: exercise.targetRpe != null ? String(exercise.targetRpe) : "",
                },
                `new-${n}`
              )}
              <span />
            </div>
          );
        }
        return (
          <div key={n} className="ts-grid ts-set upcoming">
            <span className="ts-circle">{n}</span>
            <span>{exercise.targetWeight ?? ""}</span>
            <span>{exercise.reps}</span>
            <span>{exercise.targetRpe ?? ""}</span>
            <span />
          </div>
        );
      })}

      <form id={formId} action={submit}>
        {editing ? (
          <input type="hidden" name="setLogId" value={editing.id} />
        ) : (
          <>
            <input type="hidden" name="assignmentId" value={exercise.id} />
            <input type="hidden" name="setNumber" value={nextSet} />
          </>
        )}
      </form>

      {editing ? (
        <div className="ts-actions">
          <button type="submit" form={formId} className="ts-primary" disabled={pending || reps.trim() === ""}>
            {pending ? "Saving…" : `Save set ${editing.setNumber}`}
          </button>
          <button type="button" className="ts-cancel" onClick={() => setEditingId(null)} disabled={pending}>
            Cancel
          </button>
        </div>
      ) : done ? (
        <div className="ts-all-logged">All {exercise.sets} sets logged</div>
      ) : (
        <button type="submit" form={formId} className="ts-primary" disabled={pending || reps.trim() === ""}>
          {pending ? "Logging…" : `Log set ${nextSet} of ${exercise.sets}`}
        </button>
      )}
    </div>
  );
}
