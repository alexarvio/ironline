"use client";

import { useState, useTransition } from "react";
import { saveSkipReasonAction } from "../lib/actions";
import { ChevronLeftIcon } from "../components/icons";
import GymSheet from "./GymSheet";
import type { GymOption } from "./GymPicker";
import {
  CardioCard,
  CoachNote,
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
  type SessionCardio,
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

  liveElsewhere,
  coachName,
  onBack,
  onStart,
  onResume,
}: {
  day: SessionDay;
  pastWeek: boolean;
  currentWeek: boolean;
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
  // The ⋯ menu and the "couldn't do this session" sheet it opens.
  const [menuOpen, setMenuOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipDraft, setSkipDraft] = useState(day.skipReason);
  const [skipSaving, startSkip] = useTransition();
  const submitSkip = (value: string = skipDraft) => {
    const next = value.trim();
    startSkip(async () => {
      await saveSkipReasonAction(day.key, next);
      setSkipOpen(false);
      if (next) onBack();
    });
  };
  const pill = STATUS_LABEL[status];
  const pillClass = status;

  const start = () => {
    if (day.gyms.length > 1) setGymOpen(true);
    else onStart(day.gyms[0] ?? null);
  };

  return (
    <div className="app-layer app-layer-push so-screen" role="dialog" aria-label={day.title}>
      <header className="so-head">
        <div className="so-head-row">
        <button type="button" className="so-back" onClick={onBack} aria-label="Back to training">
          <ChevronLeftIcon />
        </button>
        {currentWeek && !done && !live && (
          <button type="button" className="so-back so-more" onClick={() => setMenuOpen((o) => !o)} aria-label="More" aria-expanded={menuOpen}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" fill="currentColor" />
              <circle cx="12" cy="12" r="1.8" fill="currentColor" />
              <circle cx="19" cy="12" r="1.8" fill="currentColor" />
            </svg>
          </button>
        )}
        </div>
        {menuOpen && (
          <>
            <button type="button" className="wo-menu-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
            <div className="wo-menu so-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="wo-menu-row"
                onClick={() => {
                  setMenuOpen(false);
                  setSkipDraft(day.skipReason);
                  setSkipOpen(true);
                }}
              >
                <svg className="so-menu-ico" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4M10 14l4 4M14 14l-4 4" />
                </svg>
                Couldn&rsquo;t do this session
              </button>
            </div>
          </>
        )}
        <div className="so-kicker">
          Week {day.week} · Session {day.index}
        </div>
        <div className="so-title-row">
          <h1 className="so-title">{day.title}</h1>
          {status !== "upcoming" && (
          <span className={`so-pill ${pillClass}`}>
            {live && <span className="so-pill-dot" aria-hidden="true" />}
            {pill}
          </span>
          )}
        </div>
        {(live || status === "skipped" || status === "missed") && (
        <p className="so-sub">
          {live
            ? `Started${gymName ? ` at ${gymName}` : ""} · ${clock(ms)} in`
            : done
            ? null
            : status === "skipped"
            ? `Couldn't train · ${day.skipReason}`
            : status === "missed"
            ? "Not done that week."
            : null}
        </p>
        )}
        {(done || live) && (
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
        )}
      </header>

      <div className="so-body">
        <div className="so-list-head">
          <h2>{done ? "What you did" : "Exercises"}</h2>
        </div>
        <div className="so-list">
          {day.exercises.map((ex, i) => (
            <ExerciseCard key={ex.id} exercise={ex} index={i + 1} done={done} coachName={coachName} />
          ))}
          {day.cardio.map((c, i) => (
            done ? <CardioFold key={`c${c.id}`} cardio={c} index={day.exercises.length + i + 1} /> : <CardioCard key={`c${c.id}`} cardio={c} index={day.exercises.length + i + 1} readOnly />
          ))}
        </div>
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

      {skipOpen && (
        <div className="wo-sheet-scrim" onClick={() => setSkipOpen(false)}>
          <div className="wo-sheet" role="dialog" aria-label="Couldn't do this session" onClick={(e) => e.stopPropagation()}>
            <span className="wo-sheet-grab" aria-hidden="true" />
            <h2 className="wo-sheet-title">Couldn&rsquo;t do this session?</h2>
            <p className="wo-sheet-sub">Tell {coachName} why. It shows next to the session.</p>
            <textarea
              className="wo-sheet-input so-skip-input"
              value={skipDraft}
              autoFocus
              rows={3}
              maxLength={300}
              placeholder="Holiday, work trip, sick, injured, no time…"
              onChange={(e) => setSkipDraft(e.target.value)}
            />
            <button type="button" className="wo-sheet-btn" disabled={!skipDraft.trim() || skipSaving} onClick={() => submitSkip()}>
              {skipSaving ? "Sending…" : "Submit"}
            </button>
            {day.skipReason && (
              <button type="button" className="wo-sheet-text" onClick={() => submitSkip("")}>
                Remove the reason
              </button>
            )}
          </div>
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
  const exDone = isDone(exercise);
  // The prescription as figure-and-unit pairs, like the workout's target line.
  const targets = [
    { value: String(exercise.sets), unit: "sets" },
    exercise.reps ? { value: exercise.reps, unit: "reps" } : null,
    exercise.targetWeight != null ? { value: String(roundTo(exercise.targetWeight, 2)), unit: "kg" } : null,
    exercise.targetRpe != null ? { value: String(exercise.targetRpe), unit: "rpe" } : null,
    exercise.tempo ? { value: exercise.tempo, unit: "tempo" } : null,
  ].filter((t): t is { value: string; unit: string } => !!t);
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
          <span className={`so-num${exDone ? " done" : ""}`}>{index}</span>
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
        <span className={`so-num${exDone ? " done" : ""}`}>{index}</span>
        <span className="so-card-main">
          <span className="so-card-name">{shownName(exercise)}</span>
          {exercise.swap && <span className="so-card-summary">Swapped for {exercise.name}</span>}
          <span className="so-targets">
            {targets.map((t) => (
              <span key={t.unit}>
                <b>{t.value}</b> <small>{t.unit}</small>
              </span>
            ))}
          </span>
        </span>
      </div>
      {(
        <>
          {exercise.note.text && <CoachNote assignmentId={exercise.id} note={exercise.note} />}
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

// Cardio on a finished session: a folded row like the exercises. Open, it
// shows the targets and whether it was done. The coach's note is guidance
// for doing it, so it stays off the review.
function CardioFold({ cardio, index }: { cardio: SessionCardio; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`so-card so-card-fold${open ? " open" : ""}${cardio.done ? " done" : ""}`}>
      <button type="button" className="so-card-row so-card-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`so-num${cardio.done ? " done" : ""}`}>{index}</span>
        <span className="so-card-main">
          <span className="so-card-name">{cardio.name}</span>
        </span>
        <span className={`so-card-chev${open ? " up" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="so-card-body">
          <div className={cardio.done ? "so-cardio-done" : "so-notlogged"}>{cardio.done ? "Done" : "Not done"}</div>
        </div>
      )}
    </div>
  );
}
