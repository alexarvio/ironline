"use client";

import { useState } from "react";
import { ChevronLeftIcon } from "../components/icons";
import CoachMark from "./CoachMark";
import GymSheet from "./GymSheet";
import type { GymOption } from "./GymPicker";
import {
  CardioCard,
  SkipReason,
  clock,
  durationMinutes,
  elapsedMs,
  estimateMinutes,
  isDone,
  kgToUnit,
  loggedSets,
  plannedSets,
  roundTo,
  sessionStatus,
  shortDate,
  shownName,
  useTicker,
  type SessionDay,
  type SessionExercise,
} from "./workoutShared";

// A session on its own screen, before, during and after: what the coach set
// (nothing starts until "Start session"), where the client is in it, or what
// they did with the change against last week. Read only; the workout is the
// only place that logs.

export const STATUS_LABEL = { done: "Done", live: "Live", skipped: "Skipped", missed: "Missed", upcoming: "Upcoming" } as const;

export default function SessionOverview({
  day,
  pastWeek,
  currentWeek,
  isNext,
  liveElsewhere,
  coachName,
  onBack,
  onStart,
  onResume,
}: {
  day: SessionDay;
  pastWeek: boolean;
  currentWeek: boolean;
  /** The first session of the current week still to do. */
  isNext: boolean;
  /** Another session is live: this one cannot start until it is finished. */
  liveElsewhere: string | null;
  coachName: string;
  onBack: () => void;
  /** The client picked a gym (or there was nothing to pick) and pressed Start. */
  onStart: (gym: GymOption | null) => void;
  onResume: () => void;
}) {
  const status = sessionStatus(day, pastWeek);
  const live = status === "live";
  const done = status === "done";
  const now = useTicker(live);
  const ms = elapsedMs(day.startedAt, day.endedAt, now);
  const gymName = day.gyms.find((g) => g.id === day.gymId)?.name ?? null;
  const planned = plannedSets(day);
  const logged = loggedSets(day);
  const minutes = durationMinutes(day);
  const [gymOpen, setGymOpen] = useState(false);
  const pill = isNext && status === "upcoming" ? "Up next" : STATUS_LABEL[status];
  const pillClass = isNext && status === "upcoming" ? "next" : status;

  const start = () => {
    if (day.gyms.length > 1) setGymOpen(true);
    else onStart(day.gyms[0] ?? null);
  };

  return (
    <div className="app-layer app-layer-push so-screen" role="dialog" aria-label={day.title}>
      <header className="so-head">
        <button type="button" className="so-back" onClick={onBack} aria-label="Back to training">
          <ChevronLeftIcon />
        </button>
        <div className="so-kicker">
          Week {day.week} · Session {day.index}
        </div>
        <div className="so-title-row">
          <h1 className="so-title">{day.title}</h1>
          <span className={`so-pill ${pillClass}`}>
            {live && <span className="so-pill-dot" aria-hidden="true" />}
            {pill}
          </span>
        </div>
        <p className="so-sub">
          {live
            ? `Started${gymName ? ` at ${gymName}` : ""} · ${clock(ms)} in`
            : done
            ? null
            : status === "skipped"
            ? `Couldn't train · ${day.skipReason}`
            : status === "missed"
            ? "Not done that week."
            : "Preview only. Nothing starts until you tap Start."}
        </p>
        <div className="so-stats">
          {done ? (
            <>
              <div className="so-stat">
                <b>{day.endedAt ? shortDate(day.endedAt).replace(/^\w+,? /, "") : "—"}</b>
                <small>Date</small>
              </div>
              <div className="so-stat">
                <b className="so-stat-text">{gymName ?? "—"}</b>
                <small>Gym</small>
              </div>
              <div className="so-stat">
                <b>{minutes != null ? `${minutes}m` : "—"}</b>
                <small>Time</small>
              </div>
            </>
          ) : (
            <>
              <div className="so-stat">
                <b>{day.exercises.length}</b>
                <small>Exercises</small>
              </div>
              <div className="so-stat">
                <b>{live ? `${logged}/${planned}` : planned}</b>
                <small>Sets</small>
              </div>
              <div className="so-stat">
                <b>{live ? clock(ms) : `~${estimateMinutes(day)}m`}</b>
                <small>{live ? "Elapsed" : "Est. time"}</small>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="so-body">
        <div className="so-list-head">
          <h2>{done ? "What you did" : "Exercises"}</h2>
          <span>{done ? `${logged} set${logged === 1 ? "" : "s"} logged` : `${planned} sets`}</span>
        </div>
        <div className="so-list">
          {day.exercises.map((ex, i) => (
            <ExerciseCard key={ex.id} exercise={ex} index={i + 1} done={done} coachName={coachName} />
          ))}
          {day.cardio.map((c, i) => (
            <CardioCard key={`c${c.id}`} cardio={c} index={day.exercises.length + i + 1} readOnly />
          ))}
        </div>
        {currentWeek && !done && !live && <SkipReason dayId={day.key} text={day.skipReason} onSaved={onBack} />}
        {status === "skipped" && !currentWeek && <SkipReason dayId={day.key} text={day.skipReason} />}
      </div>

      {currentWeek && !done && status !== "skipped" && (
        <div className="so-cta">
          {live ? (
            <button type="button" className="so-start" onClick={onResume}>
              Resume · {clock(ms)}
            </button>
          ) : (
            <>
              <button type="button" className="so-start" onClick={start} disabled={!!liveElsewhere}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
                Start session
              </button>
              {liveElsewhere && <span className="so-cta-note">Finish {liveElsewhere} first</span>}
            </>
          )}
        </div>
      )}

      {gymOpen && (
        <GymSheet
          gyms={day.gyms}
          gymId={day.gymId}
          mode="start"
          onPick={(g) => {
            setGymOpen(false);
            onStart(g);
          }}
          onClose={() => setGymOpen(false)}
        />
      )}
    </div>
  );
}

function ExerciseCard({ exercise, index, done, coachName }: { exercise: SessionExercise; index: number; done: boolean; coachName: string }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const exDone = isDone(exercise);
  const summary = [
    `${exercise.sets} × ${exercise.reps || "?"}`,
    exercise.targetWeight != null ? `${roundTo(exercise.targetWeight, 2)} kg` : "bodyweight",
    exercise.targetRpe != null ? `RPE ${exercise.targetRpe}` : null,
    exercise.tempo ? `tempo ${exercise.tempo}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const ask = exercise.videoRequest;
  // Against the last time: the heaviest set then and now.
  const top = (sets: { weight: number | null }[]) => sets.reduce<number | null>((m, s) => (s.weight != null && (m == null || s.weight > m) ? s.weight : m), null);
  const nowTop = top(exercise.logs);
  const thenTop = exercise.lastSets ? top(exercise.lastSets.sets) : null;
  const delta = nowTop != null && thenTop != null ? roundTo(nowTop - thenTop, 2) : null;
  const [open, setOpen] = useState(false);
  if (done) {
    return (
      <div className={`so-card so-card-fold${open ? " open" : ""}${exDone ? " done" : ""}`}>
        <button type="button" className="so-card-row so-card-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={`so-index${exDone ? " done" : ""}`}>{index}</span>
          <span className="so-card-main">
            <span className="so-card-name">{shownName(exercise)}</span>
          </span>
          {delta != null && delta !== 0 && (
            <span className={`so-delta${delta > 0 ? " up" : ""}`}>
              {delta > 0 ? "+" : "−"}
              {Math.abs(delta)} kg
            </span>
          )}
          <span className={`so-card-chev${open ? " up" : ""}`} aria-hidden="true" />
        </button>
        {open && (
          <div className="so-card-body">
            <div className="so-card-summary">{exercise.swap ? `Swapped for ${exercise.name} · ${summary}` : summary}</div>
            {exercise.logs.length > 0 ? (
              <div className="so-sets">
                {exercise.logs
                  .slice()
                  .sort((a, b) => a.setNumber - b.setNumber)
                  .map((l) => (
                    <div key={l.id} className="so-set">
                      <span className="so-set-n">Set {l.setNumber}</span>
                      <span>{l.weight != null ? `${kgToUnit(l.weight, "kg")} kg` : "–"}</span>
                      <span>{l.reps != null ? `${l.reps} reps` : "–"}</span>
                      <span>{l.rpe != null ? `RPE ${l.rpe}` : ""}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="so-notlogged">Not logged</div>
            )}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={`so-card${exDone ? " done" : ""}`}>
      <div className="so-card-row">
        <span className={`so-index${exDone ? " done" : ""}`}>{exDone ? "✓" : index}</span>
        <span className="so-card-main">
          <span className="so-card-name">{shownName(exercise)}</span>
          <span className="so-card-summary">{exercise.swap ? `Swapped for ${exercise.name} · ${summary}` : summary}</span>
        </span>
      </div>
      {(
        <>
          {exercise.note.text && (
            <button type="button" className={`so-note${noteOpen ? " open" : ""}`} onClick={() => setNoteOpen((o) => !o)}>
              <CoachMark />
              <span>{exercise.note.text}</span>
            </button>
          )}
          {ask && (
            <div className={`so-video${ask.reply ? " replied" : ask.src ? " sent" : ""}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="6" width="13" height="12" rx="2" />
                <path d="M16 10l5-3v10l-5-3z" />
              </svg>
              {ask.reply ? `${coachName} replied to your video` : ask.src ? `Video sent to ${coachName}` : `${coachName} wants a video of this one`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
