"use client";

import { useState, useTransition } from "react";
import { clearSwapAction, logSetAction, saveExerciseNoteAction, saveWarmupSetsAction, swapExerciseAction } from "../lib/actions";
import AlternativesSheet from "./AlternativesSheet";
import { VideoAskSheet, VideoGlyph } from "./VideoAskSheet";
import {
  CoachNote,
  kgToUnit,
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

export const MAX_WARMUPS = 8;

/** What the workout's ⋯ menu asks of the exercise on screen; n makes each ask new. */
export type ExerciseRequest = { kind: "note" | "warmup" | "swap"; n: number };
type Draft = { weight: string; reps: string; rpe: string };


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
}: {
  exercise: SessionExercise;
  index: number;
  total: number;
  gymId: number | null;
  coachName: string;
  /** The exercise (or cardio) after this one, so the machine can be checked while resting. */
  nextName?: string | null;
  onNext?: () => void;
  /** An ask from the workout's ⋯ menu, for this exercise. */
  request?: ExerciseRequest | null;
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

  // ---- Working sets, one at a time: the next set to log has the row to
  // type into, logged rows read back in green with an Edit, and the rest
  // wait in grey. One button under the rows logs the active set.
  const nextSet = (() => {
    for (let n = 1; n <= exercise.sets; n++) if (!exercise.logs.some((l) => l.setNumber === n)) return n;
    return exercise.sets + 1;
  })();
  const [editingN, setEditingN] = useState<number | null>(null);
  // "Last time": the sets not logged yet show what was done the last time
  // this exercise came round, set by set; off again, the boxes are back as
  // they were left.
  const [showLast, setShowLast] = useState(false);
  const last = exercise.lastSets;
  const lastOf = (n: number) => last?.sets.find((s) => s.setNumber === n) ?? null;
  const activeN = editingN ?? (nextSet <= exercise.sets ? nextSet : null);
  const freshDraft = (n: number | null): Draft => {
    const log = n != null ? exercise.logs.find((l) => l.setNumber === n) ?? null : null;
    if (log) return { weight: show(log.weight), reps: log.reps != null ? String(log.reps) : "", rpe: log.rpe != null ? String(log.rpe) : "" };
    return { weight: show(exercise.targetWeight), reps: "", rpe: exercise.targetRpe != null ? String(exercise.targetRpe) : "" };
  };
  const [draft, setDraft] = useState<Draft>(() => freshDraft(activeN));
  // A new active row (a set landed, an edit opened, the unit flipped) starts
  // the boxes over.
  const [seenActive, setSeenActive] = useState(`${activeN}:${unit}:${gymId}`);
  if (seenActive !== `${activeN}:${unit}:${gymId}`) {
    setSeenActive(`${activeN}:${unit}:${gymId}`);
    setDraft(freshDraft(activeN));
  }
  const [pending, setPending] = useState(false);
  const logActive = async () => {
    if (activeN == null || draft.reps.trim() === "") return;
    const fd = new FormData();
    fd.set("assignmentId", String(exercise.id));
    fd.set("setNumber", String(activeN));
    fd.set("gymId", gymId == null ? "" : String(gymId));
    const kg = draft.weight.trim() === "" ? null : toKg(draft.weight);
    fd.set("weight", kg == null ? "" : String(kg));
    fd.set("reps", draft.reps.trim());
    fd.set("rpe", draft.rpe.trim());
    setPending(true);
    try {
      await logSetAction(fd);
    } finally {
      setPending(false);
      setEditingN(null);
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

  // ---- Swap, video, history.
  const [swapOpen, setSwapOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  // The workout's ⋯ menu (note, warm-up, swap) lands here, once per ask.
  const [seenRequest, setSeenRequest] = useState(request?.n ?? 0);
  if (request && request.n !== seenRequest) {
    setSeenRequest(request.n);
    if (request.kind === "note") {
      setNoteDraft(myNote);
      setNoteOpen(true);
    } else if (request.kind === "warmup") addWarm();
    else setSwapOpen(true);
  }
  // The prescription, the way the old card read it: figure and unit, one
  // line, tempo under it.
  const targets = [
    exercise.targetWeight != null ? { value: show(exercise.targetWeight), unit: unitLabel } : null,
    exercise.reps ? { value: exercise.reps, unit: "reps" } : null,
    exercise.targetRpe != null ? { value: String(exercise.targetRpe), unit: "rpe" } : null,
    exercise.distance ? { value: exercise.distance, unit: "distance" } : null,
    exercise.time ? { value: exercise.time, unit: "time" } : null,
    exercise.rest != null ? { value: exercise.rest < 60 ? `${exercise.rest}s` : `${Math.floor(exercise.rest / 60)}:${String(exercise.rest % 60).padStart(2, "0")}`, unit: "rest" } : null,
  ].filter((t): t is { value: string; unit: string } => !!t);
  const ask = exercise.videoRequest;

  const numberInput = (props: { value: string; placeholder: string; label: string; decimal?: boolean; reps?: boolean; onChange: (v: string) => void; disabled?: boolean }) => (
    <input
      className={`ts-input${props.reps ? " reps" : ""}`}
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
        <div className="wo-ex-top">
          <div className="wo-kicker">
            Exercise {index} of {total}
          </div>
          <div className="wo-ex-tools">
            {exercise.videoUrl && (
              <a href={exercise.videoUrl} target="_blank" rel="noreferrer" className="wo-round-btn" aria-label={`Watch the ${exercise.name} demo`} title="Watch the demo">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
                </svg>
              </a>
            )}
          </div>
        </div>
        {/* The name, and on its right what comes next, so the machine can be
            checked while resting; a tap goes there. */}
        <div className="wo-ex-title-row">
          <h2 className="wo-ex-name">{shownName(exercise)}</h2>
          {nextName && (
            <button type="button" className="wo-nextup" onClick={onNext} aria-label={`Next up: ${nextName}`}>
              <span className="wo-nextup-label">Next up</span>
              <span className="wo-nextup-name">{nextName}</span>
            </button>
          )}
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

      {(targets.length > 0 || exercise.tempo) && (
        <div className="ts-target wo-target-card">
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

      <div className="wo-sets ts-card-flat" style={{ "--ts-n": 1 + (askWeight ? 1 : 0) + (askRpe ? 1 : 0) } as React.CSSProperties}>
        <div className="ts-grid ts-cols">
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
          {askRpe && <span>Rpe</span>}
          {last ? (
            <button
              type="button"
              className={`ts-last-toggle${showLast ? " on" : ""}`}
              aria-pressed={showLast}
              aria-label={showLast ? "Back to this session" : "Show last time's numbers"}
              title={showLast ? "Back to this session" : "Last time"}
              disabled={editingN != null}
              onClick={() => setShowLast((v) => !v)}
            >
              <LastTimeIcon />
            </button>
          ) : (
            <span />
          )}
        </div>

        {warm.map((w, i) => (
          <div key={`w${i}`} className={`ts-grid ts-set warm${w.saved ? " logged" : " active"}`}>
            <span className="ts-circle warm">W</span>
            {askWeight && numberInput({ value: w.weight, placeholder: unitLabel, label: `Warm-up ${i + 1} weight`, decimal: true, onChange: (v) => setWarm(warm.map((r, j) => (j === i ? { ...r, weight: v, saved: false } : r))) })}
            {numberInput({ value: w.reps, placeholder: "reps", label: `Warm-up ${i + 1} reps`, onChange: (v) => setWarm(warm.map((r, j) => (j === i ? { ...r, reps: v, saved: false } : r))) })}
            {askRpe && <span />}
            <button type="button" className={`ts-edit${w.saved ? " muted" : ""}`} onClick={() => tickWarm(i)} aria-label={w.saved ? "Remove this warm-up set" : "Save this warm-up set"}>
              {w.saved ? "✕" : "✓"}
            </button>
          </div>
        ))}

        {Array.from({ length: exercise.sets }, (_, i) => i + 1).map((n) => {
          const log = exercise.logs.find((l) => l.setNumber === n) ?? null;
          // Last time's numbers in the rows still to do; what is logged stays.
          if (showLast && !log) {
            const prev = lastOf(n);
            return (
              <div key={n} className="ts-grid ts-set last">
                <span className="ts-circle">{n}</span>
                {askWeight && <span>{prev?.weight == null ? "–" : show(prev.weight)}</span>}
                <span>{prev?.reps ?? "–"}</span>
                {askRpe && <span>{prev?.rpe ?? "–"}</span>}
                <span />
              </div>
            );
          }
          if (n === activeN) {
            return (
              <div key={n} className="ts-grid ts-set active">
                <span className="ts-circle active">{n}</span>
                {askWeight && numberInput({ value: draft.weight, placeholder: unitLabel, label: `Set ${n} weight in ${unitLabel}`, decimal: true, disabled: pending, onChange: (v) => setDraft({ ...draft, weight: v }) })}
                {numberInput({ value: draft.reps, placeholder: exercise.reps || "reps", label: `Set ${n} reps`, disabled: pending, reps: true, onChange: (v) => setDraft({ ...draft, reps: v }) })}
                {askRpe && numberInput({ value: draft.rpe, placeholder: "RPE", label: `Set ${n} RPE`, decimal: true, disabled: pending, onChange: (v) => setDraft({ ...draft, rpe: v }) })}
                <span />
              </div>
            );
          }
          if (log) {
            return (
              <div key={n} className="ts-grid ts-set logged">
                <span className="ts-circle done">✓</span>
                {askWeight && <span>{log.weight == null ? "–" : show(log.weight)}</span>}
                <span>{log.reps ?? "–"}</span>
                {askRpe && <span>{log.rpe ?? "–"}</span>}
                <button type="button" className="ts-edit" onClick={() => setEditingN(n)}>
                  Edit
                </button>
              </div>
            );
          }
          return (
            <div key={n} className="ts-grid ts-set upcoming">
              <span className="ts-circle">{n}</span>
              {askWeight && <span>{exercise.targetWeight == null ? "–" : show(exercise.targetWeight)}</span>}
              <span>{exercise.reps}</span>
              {askRpe && <span>{exercise.targetRpe}</span>}
              <span />
            </div>
          );
        })}

        {showLast && last ? (
          <button type="button" className="ts-last-note" onClick={() => setShowLast(false)}>
            Your numbers from the last time you did this exercise, {Number(last.date.slice(8, 10))} {MONTHS_SHORT[Number(last.date.slice(5, 7)) - 1]}
          </button>
        ) : editingN != null ? (
          <div className="ts-actions">
            <button type="button" className="ts-primary" disabled={pending || draft.reps.trim() === ""} onClick={logActive}>
              {pending ? "Saving…" : `Save set ${editingN}`}
            </button>
            <button type="button" className="ts-cancel" onClick={() => setEditingN(null)} disabled={pending}>
              Cancel
            </button>
          </div>
        ) : activeN == null ? (
          <div className="ts-all-logged">All {exercise.sets} sets logged</div>
        ) : (
          <button type="button" className="ts-primary" disabled={pending || draft.reps.trim() === ""} onClick={logActive}>
            {pending ? "Logging…" : `Log set ${activeN} of ${exercise.sets}`}
          </button>
        )}

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
          onClose={() => setSwapOpen(false)}
        />
      )}
      {videoOpen && ask && <VideoAskSheet ask={ask} exerciseName={shownName(exercise)} onClose={() => setVideoOpen(false)} />}
    </div>
  );
}


const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A clock turning back: "last time".
function LastTimeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
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
