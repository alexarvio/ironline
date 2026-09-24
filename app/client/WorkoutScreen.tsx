"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { discardSessionAction, endSessionAction } from "../lib/actions";
import { ChevronLeftIcon } from "../components/icons";
import type { GymOption } from "./GymPicker";
import type { LibraryOption } from "./AlternativesSheet";
import ExercisePage from "./ExercisePage";
import GymSheet from "./GymSheet";
import RestTimerPill, { useRestTimer } from "./RestTimer";
import SwipeToEnd from "./SwipeToEnd";
import {
  CardioCard,
  clock,
  elapsedMs,
  isDone,
  loggedCount,


  shownName,
  useLocalFlag,
  useTicker,


  type SessionDay,
} from "./workoutShared";

// The workout: a navy header with the session's clock, a horizontal pager
// with one exercise per page (then the cardio, then the wrap-up), and a dock
// with the rest timer. The clock is the server's started_at against now, so
// it survives a reload, the app going to the background and a trip back to
// the overview.

const PAGE_KEY = "ironline.client.workout-page";
type Page = { kind: "exercise"; index: number } | { kind: "cardio"; index: number } | { kind: "wrap" };

function readPage(dayId: number): number | null {
  try {
    const raw = window.sessionStorage.getItem(PAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { dayId: number; index: number };
    return v.dayId === dayId ? v.index : null;
  } catch {
    return null;
  }
}

export default function WorkoutScreen({
  day,
  gymId,
  onPickGym,
  coachName,
  clientName = "",
  library,
  focusExercise,
  onBack,
  onEnded,
  onDiscarded,
}: {
  day: SessionDay;
  gymId: number | null;
  onPickGym: (gym: GymOption) => void;
  coachName: string;
  /** The client's first name, for the wrap-up. */
  clientName?: string;
  library: LibraryOption[];
  focusExercise: number | null;
  /** Back to the overview; the session keeps going. */
  onBack: () => void;
  /** The session was ended: back to the tab with the saved toast. */
  onEnded: () => void;
  onDiscarded: () => void;
}) {
  const pages: Page[] = [
    ...day.exercises.map((_, index) => ({ kind: "exercise", index }) as Page),
    ...day.cardio.map((_, index) => ({ kind: "cardio", index }) as Page),
    { kind: "wrap" },
  ];
  const firstPage = () => {
    const linked = focusExercise != null ? day.exercises.findIndex((e) => e.id === focusExercise) : -1;
    if (linked >= 0) return linked;
    const next = day.exercises.findIndex((e) => !isDone(e));
    if (next >= 0) return next;
    const cardio = day.cardio.findIndex((c) => !c.done);
    return cardio >= 0 ? day.exercises.length + cardio : 0;
  };
  // The pager's scroll position is the one truth for which page is up.
  const pagerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const animating = useRef(false);
  const jumpTo = (index: number, instant = false) => {
    const el = pagerRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(pages.length - 1, index)) * el.clientWidth;
    if (instant) {
      el.scrollLeft = target;
      setPage(index);
      return;
    }
    // Snap off, animate scrollLeft by hand, snap back on: scrollTo with
    // smooth behaviour is dropped inside a snap container on some phones.
    el.style.scrollSnapType = "none";
    animating.current = true;
    const from = el.scrollLeft;
    const dist = target - from;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 260);
      const ease = 1 - Math.pow(1 - p, 3);
      el.scrollLeft = from + dist * ease;
      if (p < 1) requestAnimationFrame(step);
      else {
        el.style.scrollSnapType = "";
        animating.current = false;
        setPage(index);
      }
    };
    requestAnimationFrame(step);
  };
  useEffect(() => {
    const t = setTimeout(() => jumpTo(readPage(day.key) ?? firstPage(), true), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on opening
  }, []);
  const onScroll = () => {
    const el = pagerRef.current;
    if (!el || animating.current) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== page) setPage(i);
  };
  useEffect(() => {
    try {
      window.sessionStorage.setItem(PAGE_KEY, JSON.stringify({ dayId: day.key, index: page }));
    } catch {}
  }, [day.key, page]);

  // The clock.
  const ended = day.endedAt != null;
  const now = useTicker(!ended);
  const ms = elapsedMs(day.startedAt, day.endedAt, now);

  // Dock: the rest timer, restarted on a ticked set when the client wants that.
  const rest = useRestTimer();
  const [autoRest, setAutoRest] = useLocalFlag("ironline:auto-rest", false);
  const current = pages[Math.min(page, pages.length - 1)];
  const currentRest = current.kind === "exercise" ? day.exercises[current.index].rest : null;

  // The ⋯ menu and the sheets.
  const [menuOpen, setMenuOpen] = useState(false);
  const [gymOpen, setGymOpen] = useState(false);
  const [, startTransition] = useTransition();
  const gymName = day.gyms.find((g) => g.id === gymId)?.name ?? null;

  // Ending and discarding.
  const [note, setNote] = useState(day.sessionNote);
  const [ending, setEnding] = useState(false);
  const end = () => {
    if (ending) return;
    setEnding(true);
    startTransition(async () => {
      await endSessionAction(day.key, { note });
      setTimeout(onEnded, 900);
    });
  };
  const discard = () => {
    setMenuOpen(false);
    if (!window.confirm(`Discard ${day.title}? Logged sets will be deleted.`)) return;
    startTransition(async () => {
      await discardSessionAction(day.key);
      onDiscarded();
    });
  };

  const pageDone = (p: Page) => (p.kind === "exercise" ? isDone(day.exercises[p.index]) : p.kind === "cardio" ? day.cardio[p.index].done : ended);
  const pageStarted = (p: Page) => p.kind === "exercise" && loggedCount(day.exercises[p.index]) > 0;

  return (
    <div className="app-layer app-layer-push wo-screen" role="dialog" aria-label={`${day.title} workout`}>
      <header className="wo-head">
        <div className="wo-head-row">
          <button type="button" className="wo-head-btn" onClick={onBack} aria-label="Back to the session overview">
            <ChevronLeftIcon />
          </button>
          <div className="wo-head-mid">
            <div className="wo-head-kicker">{day.title}</div>
            <div className={`wo-head-clock${ended ? " ended" : ""}`}>{clock(ms)}</div>
          </div>
          <button type="button" className="wo-head-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="More" aria-expanded={menuOpen}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
        <div className="wo-head-row2 right">
          {day.gyms.length > 0 && (
            <button type="button" className="wo-gym-chip" onClick={() => setGymOpen(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {gymName ?? "Pick a gym"}
            </button>
          )}
        </div>
        <div className="wo-segments" role="tablist" aria-label="Exercises">
          {pages.map((p, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={p.kind === "exercise" ? shownName(day.exercises[p.index]) : p.kind === "cardio" ? day.cardio[p.index].name : "Wrap up"}
              className={`wo-seg${i === page ? " now" : ""}${pageDone(p) ? " done" : pageStarted(p) ? " part" : ""}`}
              onClick={() => jumpTo(i)}
            >
              <span />
            </button>
          ))}
        </div>
        {menuOpen && (
          <>
            <button type="button" className="wo-menu-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
            <div className="wo-menu" role="menu">
              <button type="button" role="menuitemcheckbox" aria-checked={autoRest} className="wo-menu-row" onClick={() => setAutoRest(!autoRest)}>
                Auto-start rest timer
                <span className={`wo-switch${autoRest ? " on" : ""}`} aria-hidden="true" />
              </button>
              {day.gyms.length > 0 && (
                <button
                  type="button"
                  role="menuitem"
                  className="wo-menu-row"
                  onClick={() => {
                    setMenuOpen(false);
                    setGymOpen(true);
                  }}
                >
                  Change gym
                </button>
              )}
              <div className="wo-menu-divider" />
              <button type="button" role="menuitem" className="wo-menu-row danger" onClick={discard}>
                Discard session
              </button>
            </div>
          </>
        )}
      </header>

      <div ref={pagerRef} className="wo-pager" onScroll={onScroll}>
        {pages.map((p, i) => (
          <section key={i} className="wo-page" aria-hidden={i !== page}>
            {p.kind === "exercise" ? (
              <ExercisePage
                exercise={day.exercises[p.index]}
                index={p.index + 1}
                total={day.exercises.length}
                gymId={gymId}
                coachName={coachName}
                library={library}
                onSetLogged={() => {
                  if (autoRest) rest.begin();
                }}
              />
            ) : p.kind === "cardio" ? (
              <div className="wo-page-inner">
                <div className="wo-kicker">
                  Cardio {p.index + 1} of {day.cardio.length}
                </div>
                <CardioCard cardio={day.cardio[p.index]} index={day.exercises.length + p.index + 1} />
              </div>
            ) : (
              <div className="wo-page-inner wo-wrap">
                <h2 className="wo-wrap-title">Well done{clientName ? `, ${clientName}` : ""}!</h2>
                <p className="wo-wrap-sub">
                  {(() => {
                    const total = day.exercises.length + day.cardio.length;
                    const done = day.exercises.filter(isDone).length + day.cardio.filter((c) => c.done).length;
                    return done >= total && total > 0 ? "You have completed all exercises." : `You have completed ${done} out of ${total} exercises.`;
                  })()}
                </p>
                <div className="wo-checklist">
                  {pages.map((q, j) => {
                    if (q.kind === "wrap") return null;
                    const ex = q.kind === "exercise" ? day.exercises[q.index] : null;
                    const complete = pageDone(q);
                    const count = ex ? loggedCount(ex) : null;
                    const status = complete ? "Done" : ex && count ? `${count} of ${ex.sets}` : "Not started";
                    return (
                      <button key={j} type="button" className="wo-check-row" onClick={() => jumpTo(j)}>
                        <span className={`wo-check-circle${complete ? " done" : ""}`}>{complete ? "✓" : j + 1}</span>
                        <span className="wo-check-name">{ex ? shownName(ex) : day.cardio[q.index].name}</span>
                        <span className={`wo-check-status${complete ? " done" : count ? " part" : ""}`}>{status}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="wo-coach-note">
                  <span className="wo-note-label">Note to {coachName}</span>
                  <textarea className="wo-note-input" rows={2} value={note} placeholder="How did it feel? Anything to flag?" onChange={(e) => setNote(e.target.value)} disabled={ended} />
                </div>
                <SwipeToEnd onEnd={end} done={ended} />
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="wo-dock">
        <button type="button" className="wo-dock-btn prev" onClick={() => jumpTo(page - 1)} disabled={page === 0} aria-label="Previous">
          <ChevronLeftIcon />
        </button>
        <RestTimerPill timer={rest} targetSeconds={currentRest} />
        <button type="button" className="wo-dock-btn next" onClick={() => jumpTo(page + 1)} disabled={page >= pages.length - 1} aria-label="Next">
          <ChevronLeftIcon />
        </button>
      </div>

      {gymOpen && (
        <GymSheet
          gyms={day.gyms}
          gymId={gymId}
          mode="change"
          onPick={(g) => {
            setGymOpen(false);
            if (g.id !== gymId) {
              onPickGym(g);
            }
          }}
          onClose={() => setGymOpen(false)}
        />
      )}
    </div>
  );
}
