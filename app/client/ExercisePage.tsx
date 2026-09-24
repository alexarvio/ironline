"use client";

import { useState, useTransition } from "react";
import { clearSwapAction, logSetAction, saveExerciseNoteAction, saveWarmupSetsAction, swapExerciseAction } from "../lib/actions";
import AlternativesSheet, { type LibraryOption } from "./AlternativesSheet";
import { VideoAskSheet, VideoGlyph } from "./VideoAskSheet";
import { PencilIcon } from "../components/icons";
import {
  CoachNote,
  kgToUnit,
  loggedCount,
  shownName,
  tidyDecimal,
  unitToKg,
  useWeightUnit,
  type SessionExercise,
} from "./workoutShared";

// One exercise, as a page of the workout. Every set is a row the client can
// fill in and tick in any order; a ticked row can be reopened and ticked
// again. Warm-ups sit above the working sets and are never counted. "Last
// time" is what this exercise's sets were the last time it came round.

const MAX_WARMUPS = 8;
type Draft = { weight: string; reps: string; rpe: string };
const emptyDraft: Draft = { weight: "", reps: "", rpe: "" };

// The top of a rep range: "8-10" → 10, "12" → 12.
const topOfRange = (reps: string) => {
  const m = reps.match(/\d+(?!.*\d)/);
  return m ? m[0] : "";
};

export default function ExercisePage({
  exercise,
  index,
  total,
  gymId,
  coachName,
  library,

  onSetLogged,
}: {
  exercise: SessionExercise;
  index: number;
  total: number;
  gymId: number | null;
  coachName: string;
  library: LibraryOption[];

  /** A working set was ticked: the dock's rest timer may want to know. */
  onSetLogged?: () => void;
}) {
  const [unit, setUnit] = useWeightUnit(exercise.name);
  const unitLabel = unit === "kg" ? "kg" : "lbs";
  const show = (kg: number | null) => (kg == null ? "" : String(kgToUnit(kg, unit)));
  const toKg = (box: string) => {
    const v = Number(box.replace(",", ".").trim());
    return Number.isFinite(v) ? unitToKg(v, unit) : null;
  };
  const flipUnit = () => setUnit(unit === "kg" ? "lb" : "kg");

  const askWeight = exercise.targetWeight != null;
  const askRpe = exercise.targetRpe != null;
  const lastFor = (n: number) => exercise.lastSets?.sets.find((s) => s.setNumber === n) ?? null;

  // ---- Working sets: what is typed in each row, and which logged rows are reopened.
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const draftOf = (n: number) => drafts[n] ?? emptyDraft;
  const setDraft = (n: number, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [n]: { ...draftOf(n), ...patch } }));
  const setBusyFor = (n: number, on: boolean) =>
    setBusy((b) => {
      const next = new Set(b);
      if (on) next.add(n);
      else next.delete(n);
      return next;
    });
  const reopen = (n: number) => {
    const log = exercise.logs.find((l) => l.setNumber === n);
    setDraft(n, { weight: log ? show(log.weight) : "", reps: log?.reps != null ? String(log.reps) : "", rpe: log?.rpe != null ? String(log.rpe) : "" });
    setEditing((e) => new Set(e).add(n));
  };
  const tick = async (n: number) => {
    const d = draftOf(n);
    const last = lastFor(n);
    // Empty boxes fall back: weight to the target, reps to last time's, else
    // the top of the range.
    const weightKg = d.weight.trim() !== "" ? toKg(d.weight) : askWeight ? exercise.targetWeight : null;
    const repsText = d.reps.trim() !== "" ? d.reps : last?.reps != null ? String(last.reps) : topOfRange(exercise.reps);
    const reps = Number(repsText);
    const rpeText = d.rpe.trim() !== "" ? d.rpe : askRpe && exercise.targetRpe != null ? String(exercise.targetRpe) : "";
    const fd = new FormData();
    fd.set("assignmentId", String(exercise.id));
    fd.set("setNumber", String(n));
    fd.set("gymId", gymId == null ? "" : String(gymId));
    fd.set("weight", weightKg == null ? "" : String(weightKg));
    fd.set("reps", Number.isFinite(reps) && repsText !== "" ? String(reps) : "");
    fd.set("rpe", rpeText);
    setBusyFor(n, true);
    try {
      await logSetAction(fd);
    } finally {
      setBusyFor(n, false);
      setEditing((e) => {
        const next = new Set(e);
        next.delete(n);
        return next;
      });
      setDrafts((all) => {
        const next = { ...all };
        delete next[n];
        return next;
      });
      onSetLogged?.();
    }
  };

  // ---- Warm-ups: the client's own rows above the working sets. Kept here
  // as they are typed, saved whole whenever a row is ticked or removed.
  const [warm, setWarm] = useState<{ weight: string; reps: string; saved: boolean }[]>(() =>
    exercise.warmups.map((w) => ({ weight: w.weight != null ? String(kgToUnit(w.weight, "kg")) : "", reps: w.reps != null ? String(w.reps) : "", saved: true }))
  );
  const [seenWarm, setSeenWarm] = useState(exercise.warmups);
  if (seenWarm !== exercise.warmups) {
    setSeenWarm(exercise.warmups);
    setWarm(exercise.warmups.map((w) => ({ weight: w.weight != null ? String(kgToUnit(w.weight, unit)) : "", reps: w.reps != null ? String(w.reps) : "", saved: true })));
  }
  const [, startTransition] = useTransition();
  const persistWarm = (rows: { weight: string; reps: string }[]) => {
    const sets = rows
      .map((r) => ({ weight_kg: r.weight.trim() === "" ? null : toKg(r.weight), reps: r.reps.trim() === "" ? null : Number(r.reps) || null }))
      .filter((s) => s.weight_kg != null || s.reps != null);
    startTransition(() => saveWarmupSetsAction(exercise.id, sets));
  };
  const tickWarm = (i: number) => {
    const rows = warm.map((r, j) => (j === i ? { ...r, saved: true } : r));
    const kept = rows.filter((r) => r.weight.trim() !== "" || r.reps.trim() !== "");
    setWarm(kept);
    persistWarm(kept);
  };
  const addWarm = () => {
    if (warm.length >= MAX_WARMUPS) return;
    const hint = exercise.lastWarmups[warm.length];
    setWarm([...warm, { weight: "", reps: "", saved: false }].map((r, i) => (i === warm.length && hint ? { ...r, weight: hint.weight != null ? String(kgToUnit(hint.weight, unit)) : "", reps: hint.reps != null ? String(hint.reps) : "" } : r)));
  };

  // ---- Your note.
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(exercise.myNote);
  const saveNote = () => {
    const next = noteDraft.trim();
    setNoteOpen(false);
    if (next === exercise.myNote.trim()) return;
    const fd = new FormData();
    fd.set("assignmentId", String(exercise.id));
    fd.set("gymId", gymId == null ? "" : String(gymId));
    fd.set("text", next);
    startTransition(() => saveExerciseNoteAction(fd));
  };

  // ---- Swap, video, history.
  const [swapOpen, setSwapOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const targets = [
    { label: "Sets", value: String(exercise.sets) },
    exercise.reps ? { label: "Reps", value: exercise.reps } : null,
    exercise.targetWeight != null ? { label: unitLabel, value: show(exercise.targetWeight) } : null,
    exercise.targetRpe != null ? { label: "RPE", value: String(exercise.targetRpe) } : null,
    exercise.tempo ? { label: "Tempo", value: exercise.tempo } : null,
    exercise.rest != null ? { label: "Rest", value: exercise.rest < 60 ? `${exercise.rest}s` : `${Math.floor(exercise.rest / 60)}:${String(exercise.rest % 60).padStart(2, "0")}` } : null,
    exercise.distance ? { label: "Distance", value: exercise.distance } : null,
    exercise.time ? { label: "Time", value: exercise.time } : null,
  ].filter((t): t is { label: string; value: string } => !!t);
  const ask = exercise.videoRequest;
  const done = loggedCount(exercise);
  // The row's columns, from what is shown: set · [last time] · [kg] · reps · [rpe] · tick.
  // Fractions, so the row always fits the phone in one line.
  const grid = ["30px", askWeight ? "minmax(0, 1fr)" : null, "minmax(0, 1fr)", askRpe ? "minmax(0, 0.75fr)" : null, "40px"].filter(Boolean).join(" ");

  const numberInput = (props: { value: string; placeholder: string; label: string; decimal?: boolean; onChange: (v: string) => void; disabled?: boolean }) => (
    <input
      className="wo-input"
      type={props.decimal ? "text" : "number"}
      inputMode={props.decimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={props.value}
      placeholder={props.placeholder}
      aria-label={props.label}
      disabled={props.disabled}
      onInput={props.decimal ? tidyDecimal : undefined}
      onChange={(e) => props.onChange(e.target.value)}
      onFocus={(e) => {
        const el = e.currentTarget;
        setTimeout(() => el.select(), 0);
      }}
    />
  );

  return (
    <div className="wo-page-inner" data-ex={exercise.id}>
      <div className="wo-ex-head">
        <div className="wo-ex-titles">
          <div className="wo-kicker">
            Exercise {index} of {total}
          </div>
          <h2 className="wo-ex-name">{shownName(exercise)}</h2>
        </div>
        <div className="wo-ex-tools">
          {exercise.videoUrl && (
            <a href={exercise.videoUrl} target="_blank" rel="noreferrer" className="wo-round-btn" aria-label={`Watch the ${exercise.name} demo`} title="Watch the demo">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
              </svg>
            </a>
          )}
          <button type="button" className="wo-swap-btn" onClick={() => setSwapOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h13l-3-3M20 17H7l3 3" />
            </svg>
            Swap
          </button>
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

      {targets.length > 0 && (
        <div className="wo-targets">
          {targets.map((t) => (
            <div key={t.label} className="wo-target">
              <small>{t.label}</small>
              <b>{t.value}</b>
            </div>
          ))}
        </div>
      )}

      <CoachNote assignmentId={exercise.id} note={exercise.note} />

      {ask && (
        <button
          type="button"
          className={`wo-video${ask.reply ? " replied" : ask.src ? " sent" : " asked"}${ask.reply && !ask.reply.seen ? " unseen" : ""}`}
          onClick={() => setVideoOpen(true)}
        >
          <span className="wo-video-tile">
            <VideoGlyph />
          </span>
          <span className="wo-video-main">
            <b>{ask.reply ? `${coachName} replied to your video` : ask.src ? "Video sent" : `${coachName} wants a video`}</b>
            <small>{ask.reply ? "Tap to watch the reply" : ask.src ? `Only ${coachName} sees it` : ask.note || "Of this exercise, this session"}</small>
          </span>
          <span className="wo-video-action">{ask.reply ? "Watch" : ask.src ? "View" : "Record"}</span>
        </button>
      )}

      <div className="wo-sets" style={{ "--wo-grid": grid } as React.CSSProperties}>
        <div className="wo-sets-head">
          <span>Set</span>
          {askWeight && (
            <span>
              <button type="button" className="ts-unit" onClick={flipUnit} aria-label={unit === "kg" ? "Weights in kg. Switch to lbs" : "Weights in lbs. Switch to kg"}>
                <span className={unit === "kg" ? "on" : undefined}>Kg</span>
                <span className={unit === "lb" ? "on" : undefined}>Lbs</span>
              </button>
            </span>
          )}
          <span>Reps</span>
          {askRpe && <span>RPE</span>}
          <span />
        </div>

        {warm.map((w, i) => (
          <div key={`w${i}`} className={`wo-set warm${w.saved ? " logged" : ""}`}>
            <span className="wo-set-n warm">W</span>
            {askWeight && numberInput({ value: w.weight, placeholder: unitLabel, label: `Warm-up ${i + 1} weight`, decimal: true, onChange: (v) => setWarm(warm.map((r, j) => (j === i ? { ...r, weight: v, saved: false } : r))) })}
            {numberInput({ value: w.reps, placeholder: "reps", label: `Warm-up ${i + 1} reps`, onChange: (v) => setWarm(warm.map((r, j) => (j === i ? { ...r, reps: v, saved: false } : r))) })}
            {askRpe && <span className="wo-set-blank" />}
            <button type="button" className={`wo-tick${w.saved ? " on" : ""}`} onClick={() => tickWarm(i)} aria-label={w.saved ? "Saved" : "Save this warm-up set"}>
              ✓
            </button>
          </div>
        ))}

        {Array.from({ length: exercise.sets }, (_, i) => i + 1).map((n) => {
          const log = exercise.logs.find((l) => l.setNumber === n) ?? null;
          const logged = !!log && !editing.has(n);
          const d = draftOf(n);
          const isBusy = busy.has(n);
          return (
            <div key={n} className={`wo-set${logged ? " logged" : ""}`}>
              <span className={`wo-set-n${log ? " done" : ""}`}>{n}</span>
              {logged ? (
                <>
                  {askWeight && <span className="wo-set-val">{log!.weight == null ? "–" : show(log!.weight)}</span>}
                  <span className="wo-set-val">{log!.reps ?? "–"}</span>
                  {askRpe && <span className="wo-set-val">{log!.rpe ?? "–"}</span>}
                </>
              ) : (
                <>
                  {askWeight && numberInput({ value: d.weight, placeholder: show(exercise.targetWeight) || unitLabel, label: `Set ${n} weight in ${unitLabel}`, decimal: true, disabled: isBusy, onChange: (v) => setDraft(n, { weight: v }) })}
                  {numberInput({ value: d.reps, placeholder: exercise.reps || "reps", label: `Set ${n} reps`, disabled: isBusy, onChange: (v) => setDraft(n, { reps: v }) })}
                  {askRpe && numberInput({ value: d.rpe, placeholder: exercise.targetRpe != null ? String(exercise.targetRpe) : "RPE", label: `Set ${n} RPE`, decimal: true, disabled: isBusy, onChange: (v) => setDraft(n, { rpe: v }) })}
                </>
              )}
              <button
                type="button"
                className={`wo-tick${log ? " on" : ""}${logged ? " logged" : ""}`}
                disabled={isBusy}
                onClick={() => (logged ? reopen(n) : tick(n))}
                aria-label={logged ? `Edit set ${n}` : `Log set ${n}`}
              >
                {isBusy ? "…" : "✓"}
              </button>
            </div>
          );
        })}

        <div className="wo-sets-foot">
          <button type="button" className="wo-add-warm" onClick={addWarm} disabled={warm.length >= MAX_WARMUPS}>
            + Warm-up set
          </button>
          <span className={`wo-sets-count${done >= exercise.sets && exercise.sets > 0 ? " done" : ""}`}>
            {done >= exercise.sets && exercise.sets > 0 ? "All sets logged" : `${done} of ${exercise.sets} logged`}
          </span>
        </div>
      </div>

      {noteOpen ? (
        <div className="wo-note editing">
          <span className="wo-note-label">Your note</span>
          <textarea
            className="wo-note-input"
            value={noteDraft}
            autoFocus
            rows={2}
            placeholder="Seat height, grip, cues. Only you see this."
            onChange={(e) => setNoteDraft(e.target.value)}
          />
          <div className="wo-note-foot">
            <button
              type="button"
              className="wo-note-cancel"
              onClick={() => {
                setNoteDraft(exercise.myNote);
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
      ) : exercise.myNote.trim() ? (
        <button type="button" className="wo-note" onClick={() => setNoteOpen(true)}>
          <span className="wo-note-label">
            <PencilIcon />
            Your note
          </span>
          <span className="wo-note-text">{exercise.myNote}</span>
        </button>
      ) : (
        <button type="button" className="wo-note-add" onClick={() => setNoteOpen(true)}>
          + Add a note for yourself
        </button>
      )}


      {swapOpen && (
        <AlternativesSheet
          exerciseName={exercise.name}
          coachName={coachName}
          library={library}
          swapped={exercise.swap}
          onPick={(choice) => {
            setSwapOpen(false);
            startTransition(() => swapExerciseAction(exercise.id, choice));
          }}
          onClear={() => {
            setSwapOpen(false);
            startTransition(() => clearSwapAction(exercise.id));
          }}
          onClose={() => setSwapOpen(false)}
        />
      )}
      {videoOpen && ask && <VideoAskSheet ask={ask} exerciseName={shownName(exercise)} onClose={() => setVideoOpen(false)} />}
    </div>
  );
}

