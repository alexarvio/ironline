"use client";

import { ReactNode, useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { logSetAction, pickGymAction, saveExerciseNoteAction, saveSkipReasonAction, saveWarmupSetsAction, setCardioDoneAction, updateSetAction } from "../lib/actions";
import ExerciseCoachNote from "./ExerciseCoachNote";
import GymPicker, { type GymOption } from "./GymPicker";
import VideoAskButton, { VideoGlyph, type VideoAsk } from "./VideoAskSheet";
import { ChevronDownIcon } from "../components/icons";

// One training day, logged in focus mode: one exercise open at a time,
// every planned set visible, one active row to type into and one button
// to log it. Data comes in as plain props from the server page; the two
// server actions (log a set, correct a set) are the same as before, so
// nothing about what is stored changes.

export type SessionSet = { id: number; setNumber: number; weight: number | null; reps: number | null; rpe: number | null };
export type SessionCardio = { id: number; name: string; time: string; pace: string; incline: string; distance: string; notes: string; done: boolean };

export type SessionExercise = {
  id: number;
  name: string;
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
  /** The coach-note bubble, rendered by the server page. */
  note: ReactNode;
  /** The client's own note on this exercise: settings, cues. */
  myNote: string;
  /** Warm-up sets the client added, in kg. Optional, never counted. */
  warmups?: { weight: number | null; reps: number | null }[];
  /** The warm-up from the last time the client had this exercise. */
  lastWarmups?: { weight: number | null; reps: number | null }[];
  /** The coach asked for a video of this exercise in this session. */
  videoRequest?: VideoAsk | null;
  /** With gyms: the weight target and "My notes" at each gym, by gym id. */
  gymTargets?: Record<number, number | null>;
  gymNotes?: Record<number, string>;
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

// Weights are stored in kg. A machine marked in lbs is one tap away: the
// client flips an exercise to lbs, every figure on it is converted, and a
// weight typed in lbs is saved back as kg, so progression, goals and the
// coach's view are untouched. Remembered per exercise on this phone, since
// it is the machine that decides the unit.
// How long the session body takes to fold shut (matches .tr-session-fold).
const FOLD_MS = 420;
type WeightUnit = "kg" | "lb";
const KG_PER_LB = 0.45359237;
const roundTo = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
// Shown weights always round up: kg to the next quarter (.25, .5, .75), lbs
// to the next half. Tidied to two decimals first, so the few ten-thousandths
// a figure saved from lbs carries don't tip it over to the next step. Only
// the unit on the toggle is ever shown.
const ceilTo = (n: number, step: number) => roundTo(Math.ceil(roundTo(n, 2) / step - 1e-9) * step, 2);
const kgToUnit = (kg: number, unit: WeightUnit) => (unit === "kg" ? ceilTo(kg, 0.25) : ceilTo(kg / KG_PER_LB, 0.5));
// Four decimals in kg, so a figure typed in lbs reads back as the same
// figure: at two decimals, 2 lbs came back as 3 once rounded up.
const unitToKg = (value: number, unit: WeightUnit) => (unit === "kg" ? value : roundTo(value * KG_PER_LB, 4));
const unitStorageKey = (exerciseName: string) => `ironline:weight-unit:${exerciseName.trim().toLowerCase()}`;

function useWeightUnit(exerciseName: string): [WeightUnit, (unit: WeightUnit) => void] {
  const [unit, setUnit] = useState<WeightUnit>("kg");
  // Read after mount: the server render has no storage, and kg is the default.
  useEffect(() => {
    try {
      if (localStorage.getItem(unitStorageKey(exerciseName)) === "lb") setUnit("lb");
    } catch {}
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

const hasSet = (ex: SessionExercise, n: number) => ex.logs.some((l) => l.setNumber === n);
const nextMissing = (ex: SessionExercise) => {
  for (let n = 1; n <= ex.sets; n++) if (!hasSet(ex, n)) return n;
  return ex.sets + 1;
};
const loggedCount = (ex: SessionExercise) => Array.from({ length: ex.sets }, (_, i) => i + 1).filter((n) => hasSet(ex, n)).length;
const isDone = (ex: SessionExercise) => nextMissing(ex) > ex.sets;
const firstUnfinished = (list: SessionExercise[]) => list.find((ex) => !isDone(ex))?.id ?? null;

export default function TrainingDaySession({
  title,
  dayId,
  gyms = [],
  gymId: savedGymId = null,
  exercises: baseExercises,
  cardio = [],
  skipReason = "",
  open,
  onToggle,
  focusExercise = null,
}: {
  /** The coach's name for the session, e.g. "Push day". Never a weekday:
      the client trains it whenever they can, so "Tuesday" would be a lie by
      Wednesday. The weekday stays on the coach's side. */
  title: string;
  dayId: number;
  /** The coach's gyms for this client; the picker shows with two or more. */
  gyms?: GymOption[];
  /** The gym this session is at: where its sets were logged, else the last pick. */
  gymId?: number | null;
  exercises: SessionExercise[];
  /** Cardio the coach put on the day, shown after the exercises. */
  cardio?: SessionCardio[];
  /** Why the client could not do this session, if they said. */
  skipReason?: string;
  /** Owned by TrainingDayList so only one day is open at a time. */
  open: boolean;
  onToggle: () => void;
  /** Its place in the week. */
  index?: number;
  /** A coach message linked this exercise: open it rather than the next to do. */
  focusExercise?: number | null;
}) {
  // The gym is picked here and saved straight away; the server's answer
  // takes over whenever it changes.
  const [gymId, setGymId] = useState(savedGymId);
  const [seenGymId, setSeenGymId] = useState(savedGymId);
  if (savedGymId !== seenGymId) {
    setSeenGymId(savedGymId);
    setGymId(savedGymId);
  }
  // Targets and notes as they are at the picked gym.
  const exercises =
    gymId == null
      ? baseExercises
      : baseExercises.map((ex) => ({
          ...ex,
          targetWeight: ex.gymTargets?.[gymId] ?? ex.targetWeight,
          myNote: ex.gymNotes ? ex.gymNotes[gymId] ?? "" : ex.myNote,
        }));
  const pickGym = (gym: GymOption) => {
    const logged = baseExercises.reduce((s, ex) => s + ex.logs.length, 0);
    if (logged > 0 && gymId != null && !window.confirm(`Move the ${logged} set${logged === 1 ? "" : "s"} logged in this session to ${gym.name}?`)) return;
    setGymId(gym.id);
    void pickGymAction(dayId, gym.id);
  };

  const planned = exercises.reduce((s, ex) => s + ex.sets, 0);
  const logged = exercises.reduce((s, ex) => s + loggedCount(ex), 0);
  const dayDone = exercises.length + cardio.length > 0 && exercises.every(isDone) && cardio.every((c) => c.done);

  // The last set or cardio of the day landing: a short "Workout complete"
  // moment, then the day folds itself away. Only on the change itself, so
  // opening a day that was already finished does not replay it. The timer
  // hangs off `celebrating` alone: saving refreshes the page data a moment
  // later, and a wider dependency list would cancel it.
  const [celebrating, setCelebrating] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const wasDone = useRef(dayDone);
  const openNow = useRef(open);
  const doneNow = useRef(dayDone);
  const toggleNow = useRef(onToggle);
  useEffect(() => {
    openNow.current = open;
    doneNow.current = dayDone;
    toggleNow.current = onToggle;
  });
  useEffect(() => {
    const before = wasDone.current;
    wasDone.current = dayDone;
    if (!before && dayDone && openNow.current) setCelebrating(true);
  }, [dayDone]);
  // Closing folds the body shut over a beat before it leaves, rather than
  // vanishing; a tap on the head and the finished day's own fold both go
  // through here. Opening unfolds the same way (CSS). A finished day also
  // scrolls its head into view once folded.
  const [folding, setFolding] = useState(false);
  const scrollAfterFold = useRef(false);
  const fold = (thenScroll = false) => {
    if (!openNow.current) return;
    scrollAfterFold.current = thenScroll;
    setFolding(true);
  };
  useEffect(() => {
    if (!folding) return;
    const t = setTimeout(() => {
      setFolding(false);
      if (openNow.current) toggleNow.current();
      if (scrollAfterFold.current) setTimeout(() => sectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
      scrollAfterFold.current = false;
    }, FOLD_MS);
    return () => clearTimeout(t);
  }, [folding]);
  useEffect(() => {
    if (!celebrating) return;
    const t = setTimeout(() => {
      setCelebrating(false);
      // An undo during the moment (a cardio tapped back) keeps the day open.
      if (!openNow.current || !doneNow.current) return;
      fold(true);
    }, 1800);
    return () => clearTimeout(t);
  }, [celebrating]);

  // Which exercise is expanded; starts on the first with sets still to log.
  const [expandedId, setExpandedId] = useState<number | null>(() =>
    focusExercise != null && exercises.some((e) => e.id === focusExercise) ? focusExercise : firstUnfinished(exercises) ?? exercises[0]?.id ?? null
  );
  const activeId = firstUnfinished(exercises);

  // When the expanded exercise's last set lands, hold the green card for a
  // beat, then fold it and open the next one with sets left.
  const expanded = exercises.find((ex) => ex.id === expandedId) ?? null;
  const expandedDone = !!expanded && isDone(expanded);
  // Remembered per exercise, so opening one that was already finished
  // does not read as "just finished" and snap away.
  const last = useRef<{ id: number | null; done: boolean }>({ id: expandedId, done: expandedDone });
  // The latest exercises, read when the timer fires. Not a dependency of the
  // effect below: saving a set refreshes the page data (a new array) a moment
  // after the set lands, and re-running the effect then cancelled the timer,
  // so the finished exercise closed and the next one never opened.
  const latest = useRef(exercises);
  useEffect(() => {
    latest.current = exercises;
  }, [exercises]);
  // The exercise whose body is folding shut right now; its card stays until
  // the fold has run, then the next one unfolds (CSS) in its place.
  const [closingId, setClosingId] = useState<number | null>(null);
  const closeExercise = (id: number, then: () => number | null) => {
    setClosingId(id);
    setTimeout(() => {
      setClosingId(null);
      setExpandedId(then());
    }, FOLD_MS);
  };
  useEffect(() => {
    const prev = last.current;
    last.current = { id: expandedId, done: expandedDone };
    const justFinished = expandedId != null && prev.id === expandedId && !prev.done && expandedDone;
    if (!justFinished) return;
    const t = setTimeout(() => closeExercise(expandedId, () => firstUnfinished(latest.current)), 600);
    return () => clearTimeout(t);
  }, [expandedId, expandedDone]);

  // The line under the session's title.
  const left = exercises.filter((ex) => !isDone(ex)).length + cardio.filter((c) => !c.done).length;
  const sub = dayDone
    ? "Session complete"
    : skipReason
    ? `Couldn't train · ${skipReason}`
    : logged > 0
    ? `In progress · ${left} exercise${left === 1 ? "" : "s"} left`
    : [
        exercises.length ? `${exercises.length} exercise${exercises.length === 1 ? "" : "s"}` : null,
        planned ? `${planned} sets` : null,
        cardio.length ? `${cardio.length} cardio` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <section ref={sectionRef} className={`tr-session${open ? " open" : ""}${dayDone ? " done" : skipReason ? " skipped" : ""}`}>
      <button type="button" className="tr-session-head" onClick={() => (open ? fold() : onToggle())} aria-expanded={open}>
        <span className="tr-session-main">
          <span className="tr-session-title">{title}</span>
          <span className="tr-session-sub">{sub}</span>
        </span>
        {/* Green once every set is logged; plain until then. */}
        <span className={`tr-pill${dayDone ? " done" : skipReason ? " skipped" : ""}`}>
          {!dayDone && skipReason ? "Skipped" : `${logged} / ${planned} sets`}
        </span>
        <span className={`tr-chev${open ? " up" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className={`tr-session-fold${folding ? " folding" : ""}`}>
        <div className="tr-session-body ts-list">
          {gyms.length > 1 && <GymPicker gyms={gyms} gymId={gymId} onPick={pickGym} />}
          {exercises.map((ex, i) =>
            ex.id === expandedId ? (
              <ExpandedExercise
                key={ex.id}
                exercise={ex}
                gymId={gymId}
                index={i + 1}
                closing={closingId === ex.id}
                onCollapse={() => closeExercise(ex.id, () => null)}
              />
            ) : (
              <CollapsedExercise
                key={ex.id}
                exercise={ex}
                index={i + 1}
                // The next one to do is only picked out while nothing is open;
                // with another exercise open, that card has the highlight.
                active={ex.id === activeId && expandedId == null}
                onOpen={() => setExpandedId(ex.id)}
              />
            )
          )}
          {cardio.map((c, i) => (
            <CardioCard key={`c${c.id}`} cardio={c} index={exercises.length + i + 1} />
          ))}
          {(!dayDone || skipReason) && <SkipReason dayId={dayId} text={skipReason} onSaved={() => fold(true)} />}
        </div>
        </div>
      )}
      {celebrating &&
        createPortal(
          <div className="ts-complete" role="status" aria-live="polite">
            <div className="ts-complete-card">
              <svg className="ts-complete-check" viewBox="0 0 52 52" aria-hidden="true">
                <circle cx="26" cy="26" r="24" />
                <path d="M15 27l7 7 15-15" />
              </svg>
              <div className="ts-complete-title">Workout complete</div>
              <div className="ts-complete-sub">
                {title} · {logged} set{logged === 1 ? "" : "s"} logged
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}

// Cardio on the same card as an exercise: number, name, the coach's note
// top right, the targets as tiles, and one button to tick it off. There
// are no sets to log, so done is a single tap, and a second tap undoes it.
function CardioCard({ cardio, index }: { cardio: SessionCardio; index: number }) {
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
      <button
        type="button"
        className={`ts-cardio-done${done ? " is-done" : ""}`}
        disabled={pending}
        onClick={() => startTransition(() => setCardioDoneAction(cardio.id, !done))}
      >
        {done ? "Done ✓ · tap to undo" : "Mark as done"}
      </button>
    </div>
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
    <button type="button" className={`ts-row ${tone}`} onClick={onOpen} data-ex={exercise.id}>
      <span className="ts-circle">{done ? "✓" : index}</span>
      <span className="ts-row-name">{exercise.name}</span>
      {/* A video the coach is waiting for, visible without opening the card. */}
      {exercise.videoRequest && !exercise.videoRequest.src && (
        <span className="ts-row-video" aria-label="Your coach asked for a video" title="Your coach asked for a video">
          <VideoGlyph />
        </span>
      )}
      <span className="ts-row-count">
        {loggedCount(exercise)}/{exercise.sets}
      </span>
      <span className="ts-chev">
        <ChevronDownIcon />
      </span>
    </button>
  );
}

function ExpandedExercise({
  exercise,
  gymId,
  index,
  closing = false,
  onCollapse,
}: {
  exercise: SessionExercise;
  gymId: number | null;
  index: number;
  /** Folding shut: the body slides away before the card gives way to the next. */
  closing?: boolean;
  onCollapse: () => void;
}) {
  const done = isDone(exercise);
  const nextSet = nextMissing(exercise);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [panel, setPanel] = useState<"note" | "warm" | null>(null);
  const [pending, setPending] = useState(false);
  // The bottom button only wakes up once reps has a value.
  const [reps, setReps] = useState("");
  const formId = useId();
  const editing = editingId != null ? exercise.logs.find((l) => l.id === editingId) ?? null : null;

  const [unit, setUnit] = useWeightUnit(exercise.name);
  const unitLabel = unit === "kg" ? "kg" : "lbs";
  // A weight typed before the flip, converted, so flipping keeps it. The
  // exact kg behind the shown figure is kept too: converting the rounded
  // figure again on every flip climbed a step each time (60 → 132.5 → 60.25
  // → 133 …), so while the box still shows what the flip put there, the next
  // flip and the save both start from that kg, not from the box.
  const [carried, setCarried] = useState<{ kg: number; shown: string } | null>(null);
  const exactKg = (boxValue: string, from: WeightUnit) => {
    if (carried && boxValue === carried.shown) return carried.kg;
    const value = Number(boxValue.replace(",", ".").trim());
    return Number.isFinite(value) ? unitToKg(value, from) : NaN;
  };
  const show = (kg: number | null) => (kg == null ? "" : String(kgToUnit(kg, unit)));
  // A set's weight cell: the figure in the unit on the toggle, nothing else.
  const weightCell = (kg: number | null) => (kg == null ? "–" : show(kg));
  const flipUnit = () => {
    const next: WeightUnit = unit === "kg" ? "lb" : "kg";
    const form = document.getElementById(formId) as HTMLFormElement | null;
    const el = form?.elements.namedItem("weight") as HTMLInputElement | null;
    const kg = el && el.value.trim() !== "" ? exactKg(el.value, unit) : NaN;
    setCarried(Number.isFinite(kg) ? { kg, shown: String(kgToUnit(kg, next)) } : null);
    setUnit(next);
  };

  // A finished exercise reopened later is read-only until Edit is tapped.
  const rows = Array.from({ length: exercise.sets }, (_, i) => {
    const n = i + 1;
    const log = exercise.logs.find((l) => l.setNumber === n) ?? null;
    return { n, log };
  });

  const targets = [
    exercise.targetWeight != null ? { value: show(exercise.targetWeight), unit: unitLabel } : null,
    exercise.reps ? { value: exercise.reps, unit: "reps" } : null,
    exercise.targetRpe != null ? { value: `${exercise.targetRpe}`, unit: "rpe" } : null,
    exercise.distance ? { value: exercise.distance, unit: "distance" } : null,
    exercise.time ? { value: exercise.time, unit: "time" } : null,
    exercise.rest != null ? { value: exercise.rest < 60 ? `${exercise.rest}s` : `${Math.floor(exercise.rest / 60)}:${String(exercise.rest % 60).padStart(2, "0")}`, unit: "rest" } : null,
  ].filter((t): t is { value: string; unit: string } => !!t);
  // The client fills in only what the coach asked for. Reps are always
  // asked; kg and RPE only when a target exists. The grid takes as many
  // columns as that, centred, so one field is one wide box in the middle.
  const askWeight = exercise.targetWeight != null;
  const askRpe = exercise.targetRpe != null;
  const colCount = 1 + (askWeight ? 1 : 0) + (askRpe ? 1 : 0);

  const submit = async (formData: FormData) => {
    // Stored in kg: the exact figure behind a flipped box, else what was typed.
    const raw = String(formData.get("weight") ?? "").trim();
    if (raw !== "" && (unit === "lb" || carried)) {
      const kg = exactKg(raw, unit);
      if (Number.isFinite(kg)) formData.set("weight", String(kg));
    }
    setPending(true);
    try {
      if (editing) await updateSetAction(formData);
      else await logSetAction(formData);
    } finally {
      setPending(false);
      setEditingId(null);
      setReps("");
      setCarried(null);
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
      {askWeight && (
        <input
          // The unit in the key refills the box with the converted figure.
          key={`w-${key}-${unit}`}
          form={formId}
          name="weight"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          onFocus={selectAll}
          onClick={selectAll}
          onInput={tidyDecimal}
          defaultValue={carried?.shown ?? defaults.weight}
          aria-label={`Weight in ${unitLabel}`}
          className="ts-input"
          required
        />
      )}
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
      {askRpe && (
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
      )}
    </>
  );

  return (
    <div className={`ts-card${done ? " done" : ""}`} style={{ "--ts-n": colCount } as React.CSSProperties} data-ex={exercise.id}>
      <div className="ts-card-head">
        <span className={`ts-circle ${done ? "done" : "active"}`}>{done ? "✓" : index}</span>
        <span className="ts-card-name">{exercise.name}</span>
        <span className="ts-card-tools">
          {/* A video the coach asked for: a camera that opens the sheet to
              film or pick one, with a dot until it is sent. */}
          {exercise.videoRequest && <VideoAskButton ask={exercise.videoRequest} exerciseName={exercise.name} />}
          {/* The demo: a play button beside the chevron, not a row of its own. */}
          {exercise.videoUrl && (
            <a href={exercise.videoUrl} target="_blank" rel="noreferrer" className="ts-video" aria-label={`Watch the ${exercise.name} demo`} title="Watch the demo">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </a>
          )}
          <button type="button" className="ts-chev up" onClick={onCollapse} aria-label="Collapse">
            <ChevronDownIcon />
          </button>
        </span>
      </div>
      <div className={`ts-fold${closing ? " folding" : ""}`}>
      <div className="ts-fold-inner">
      {(targets.length > 0 || exercise.tempo) && (
        <div className="ts-target">
          <div className="ts-target-label">Target</div>
          {targets.length > 0 && (
            <div className="ts-target-line">
              {targets.map((t) => (
                <span key={t.unit}>
                  <b>{t.value}</b> <small>{t.unit}</small>
                </span>
              ))}
            </div>
          )}
          {exercise.tempo && (
            <div className="ts-target-tempo">
              <b>{exercise.tempo}</b> <small>tempo</small>
            </div>
          )}
        </div>
      )}

      {/* The coach's note, open, then the client's own below it. */}
      {exercise.note}

      {/* Two optional extras, side by side: the client's own note and their
          warm-up sets. A pill opens its panel underneath, one at a time, and
          carries a count once there is something in it. */}
      <div className="ts-extras">
        <button type="button" className={`ts-extra${panel === "note" ? " on" : ""}`} onClick={() => setPanel(panel === "note" ? null : "note")} aria-expanded={panel === "note"}>
          Notes
          {exercise.myNote.trim() !== "" && <span className="ts-extra-count">1</span>}
        </button>
        <button type="button" className={`ts-extra${panel === "warm" ? " on" : ""}`} onClick={() => setPanel(panel === "warm" ? null : "warm")} aria-expanded={panel === "warm"}>
          Warm-up
          {(exercise.warmups?.length ?? 0) > 0 && <span className="ts-extra-count">{exercise.warmups?.length}</span>}
        </button>
      </div>
      {panel === "note" && <MyNote key={gymId ?? 0} assignmentId={exercise.id} gymId={gymId} text={exercise.myNote} onClose={() => setPanel(null)} />}
      {panel === "warm" && <Warmups assignmentId={exercise.id} sets={exercise.warmups ?? []} last={exercise.lastWarmups ?? []} unit={unit} onFlipUnit={flipUnit} />}

      <div className="ts-grid ts-cols">
        <span>Set</span>
        {askWeight && (
          <span>
            <button
              type="button"
              className="ts-unit"
              onClick={flipUnit}
              aria-label={unit === "kg" ? "Weights in kg. Switch to lbs" : "Weights in lbs. Switch to kg"}
            >
              <span className={unit === "kg" ? "on" : undefined}>Kg</span>
              <span className={unit === "lb" ? "on" : undefined}>Lbs</span>
            </button>
          </span>
        )}
        <span>Reps</span>
        {askRpe && <span>Rpe</span>}
        <span />
      </div>

      {rows.map(({ n, log }) => {
        if (log && editing?.id !== log.id) {
          return (
            <div key={n} className="ts-grid ts-set logged">
              <span className="ts-circle done">✓</span>
              {askWeight && <span>{weightCell(log.weight)}</span>}
              <span>{log.reps ?? "–"}</span>
              {askRpe && <span>{log.rpe ?? "–"}</span>}
              <button
                type="button"
                className="ts-edit"
                onClick={() => {
                  setEditingId(log.id);
                  setCarried(null);
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
              {inputs({ weight: show(log.weight), reps: String(log.reps ?? ""), rpe: log.rpe != null ? String(log.rpe) : "" }, `edit-${log.id}`)}
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
                  weight: show(exercise.targetWeight),
                  reps: "",
                  rpe: exercise.targetRpe != null ? String(exercise.targetRpe) : "",
                },
                // Keyed by gym too, so a new pick refills the weight.
                `new-${n}-${gymId ?? 0}`
              )}
              <span />
            </div>
          );
        }
        return (
          <div key={n} className="ts-grid ts-set upcoming">
            <span className="ts-circle">{n}</span>
            {askWeight && <span>{weightCell(exercise.targetWeight)}</span>}
            <span>{exercise.reps}</span>
            {askRpe && <span>{exercise.targetRpe}</span>}
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
            <input type="hidden" name="gymId" value={gymId ?? ""} />
          </>
        )}
      </form>

      {editing ? (
        <div className="ts-actions">
          <button type="submit" form={formId} className="ts-primary" disabled={pending || reps.trim() === ""}>
            {pending ? "Saving…" : `Save set ${editing.setNumber}`}
          </button>
          <button
            type="button"
            className="ts-cancel"
            onClick={() => {
              setEditingId(null);
              setCarried(null);
            }}
            disabled={pending}
          >
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
      </div>
    </div>
  );
}

// Warm-up sets: optional, so one quiet line until tapped. Open, it is the
// working sets' own grid without RPE, and it works the same way: one row to
// type into, logged with one button, then the next. The warm-up from the
// last time the client had this exercise is one swipe to the side (two dots
// say so, as on the food diary's rings), and its weights start the boxes.
// They are the client's record only: not counted in the
// sets logged, the weight goal or the session being complete.
type WarmupSet = { weight: number | null; reps: number | null };
const MAX_WARMUPS = 8;
function Warmups({
  assignmentId,
  sets,
  last,
  unit,
  onFlipUnit,
}: {
  assignmentId: number;
  sets: WarmupSet[];
  last: WarmupSet[];
  unit: WeightUnit;
  /** The exercise's own kg / lbs switch: one unit for the whole card. */
  onFlipUnit: () => void;
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [saving, start] = useTransition();
  const shown = (kg: number | null) => (kg == null ? "" : String(kgToUnit(kg, unit)));
  const cell = (kg: number | null) => (kg == null ? "–" : shown(kg));
  const commit = (next: WarmupSet[]) => {
    setEditIdx(null);
    start(() => saveWarmupSetsAction(assignmentId, next.map((w) => ({ weight_kg: w.weight, reps: w.reps }))));
  };

  const nextIdx = sets.length;
  const activeIdx = editIdx ?? (nextIdx < MAX_WARMUPS ? nextIdx : null);
  const rowCount = Math.min(MAX_WARMUPS, sets.length + (editIdx == null ? 1 : 0));
  const cols = (
    <div className="ts-grid ts-cols">
      <span>Set</span>
      <span>
        <button type="button" className="ts-unit" onClick={onFlipUnit} aria-label={unit === "kg" ? "Weights in kg. Switch to lbs" : "Weights in lbs. Switch to kg"}>
          <span className={unit === "kg" ? "on" : undefined}>Kg</span>
          <span className={unit === "lb" ? "on" : undefined}>Lbs</span>
        </button>
      </span>
      <span>Reps</span>
      <span />
    </div>
  );
  return (
    <div className="ts-warm editing" style={{ "--ts-n": 2 } as React.CSSProperties}>
      <span className="ts-mynote-label">
        {page === 1 ? "Warm-up · last time" : "Warm-up"}
        {saving ? " · saving…" : ""}
      </span>
      <div
        className="ts-warm-pages"
        onScroll={(e) => {
          const el = e.currentTarget;
          setPage(el.scrollLeft > el.clientWidth / 2 ? 1 : 0);
        }}
      >
      <div className="ts-warm-page">
      {cols}
      {Array.from({ length: rowCount }, (_, i) => {
        if (i === activeIdx) {
          return (
            <WarmupEntry
              key={`entry-${i}-${unit}-${editIdx ?? "new"}`}
              index={i}
              unit={unit}
              // Editing starts from the set itself; a new one starts blank,
              // with last time's figures as the grey hint in each box.
              seed={editIdx != null ? sets[i] : { weight: null, reps: null }}
              weightHint={editIdx == null && last[i]?.weight != null ? shown(last[i].weight) : ""}
              repsHint={last[i]?.reps ?? null}
              editing={editIdx != null}
              busy={saving}
              onSave={(w) => commit(editIdx != null ? sets.map((x, j) => (j === i ? w : x)) : [...sets, w])}
              onRemove={() => commit(sets.filter((_, j) => j !== i))}
              onCancel={() => setEditIdx(null)}
            />
          );
        }
        const mine = sets[i];
        if (mine) {
          return (
            <div key={i} className="ts-grid ts-set logged">
              <span className="ts-circle done">✓</span>
              <span>{cell(mine.weight)}</span>
              <span>{mine.reps ?? "–"}</span>
              <button type="button" className="ts-edit" onClick={() => setEditIdx(i)} disabled={saving}>
                Edit
              </button>
            </div>
          );
        }
        return null;
      })}
      </div>
      {last.length > 0 && (
        <div className="ts-warm-page">
          {cols}
          {last.map((w, i) => (
            <div key={i} className="ts-grid ts-set upcoming">
              <span className="ts-circle">{i + 1}</span>
              <span>{cell(w.weight)}</span>
              <span>{w.reps ?? "–"}</span>
              <span />
            </div>
          ))}
        </div>
      )}
      </div>
      {last.length > 0 && (
        <div className="nd-dots ts-warm-dots" aria-hidden="true">
          <span className={page === 0 ? "on" : undefined} />
          <span className={page === 1 ? "on" : undefined} />
        </div>
      )}
    </div>
  );
}

// The one warm-up row being typed into, with its button.
function WarmupEntry({
  index,
  unit,
  seed,
  weightHint,
  repsHint,
  editing,
  busy,
  onSave,
  onRemove,
  onCancel,
}: {
  index: number;
  unit: WeightUnit;
  seed: WarmupSet;
  weightHint: string;
  repsHint: number | null;
  editing: boolean;
  busy: boolean;
  onSave: (w: WarmupSet) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const seedShown = seed.weight == null ? "" : String(kgToUnit(seed.weight, unit));
  const [weight, setWeight] = useState(seedShown);
  const [reps, setReps] = useState(seed.reps == null ? "" : String(seed.reps));
  const selectAll = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    setTimeout(() => el.select(), 0);
  };
  const save = () => {
    const typed = Number(weight.replace(",", ".").trim());
    // An untouched figure keeps its exact kg, so lbs do not drift.
    const kg = weight.trim() === "" || !Number.isFinite(typed) ? null : weight === seedShown && seed.weight != null ? seed.weight : unitToKg(typed, unit);
    const n = Number(reps);
    onSave({ weight: kg, reps: reps.trim() !== "" && Number.isFinite(n) ? n : null });
  };
  return (
    <>
      <div className="ts-grid ts-set active">
        <span className="ts-circle active">{index + 1}</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="ts-input"
          aria-label={`Warm-up ${index + 1} weight`}
          placeholder={weightHint}
          value={weight}
          onFocus={selectAll}
          onClick={selectAll}
          onInput={tidyDecimal}
          onChange={(e) => setWeight(e.target.value)}
        />
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className="ts-input reps"
          placeholder={repsHint != null ? String(repsHint) : ""}
          aria-label={`Warm-up ${index + 1} reps`}
          value={reps}
          onFocus={selectAll}
          onClick={selectAll}
          onChange={(e) => setReps(e.target.value)}
        />
        <span />
      </div>
      <div className="ts-actions">
        <button type="button" className="ts-primary" onClick={save} disabled={busy || reps.trim() === ""}>
          {editing ? `Save warm-up ${index + 1}` : `Log warm-up ${index + 1}`}
        </button>
        {editing && (
          <span className="ts-warm-actions">
            <button type="button" className="ts-skip-clear" onClick={onRemove} disabled={busy}>
              Remove
            </button>
            <button type="button" className="ts-cancel" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          </span>
        )}
      </div>
    </>
  );
}

// The last item of a session: the client telling the coach why they could
// not do it. A red button until tapped, then a field to say why. Saved on
// the session, so the coach reads it next to the missed tick; saving a
// reason folds the day away, as finishing it does.
function SkipReason({ dayId, text, onSaved }: { dayId: number; text: string; onSaved: () => void }) {
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
    if (next) onSaved();
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

// The client's own note on an exercise: seat height, grip width, a cue that
// helps. Reads as one line until tapped; saves on blur or Save.
function MyNote({ assignmentId, gymId, text, onClose }: { assignmentId: number; gymId: number | null; text: string; onClose: () => void }) {
  const [draft, setDraft] = useState(text);
  const [, start] = useTransition();
  const cancel = onClose;
  const save = () => {
    const next = draft.trim();
    onClose();
    if (next === text.trim()) return;
    const fd = new FormData();
    fd.set("assignmentId", String(assignmentId));
    fd.set("gymId", gymId == null ? "" : String(gymId));
    fd.set("text", next);
    start(() => saveExerciseNoteAction(fd));
  };
  return (
      <div className="ts-mynote editing">
        <span className="ts-mynote-label">My notes</span>
        <textarea
          className="ts-mynote-input"
          value={draft}
          autoFocus
          rows={2}
          placeholder="Seat 4, handles narrow, slow on the way down…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
        />
        <div className="ts-mynote-foot">
          <span className="ts-mynote-btns">
            <button type="button" className="ts-mynote-cancel" onClick={cancel}>
              Cancel
            </button>
            <button type="button" className="ts-mynote-save" onClick={save}>
              Save
            </button>
          </span>
        </div>
      </div>
  );
}
