"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useDismiss } from "./useDismiss";
import { discardSessionAction, endSessionAction } from "../lib/actions";
import { ChatIcon, ChevronLeftIcon } from "../components/icons";
import { useOpenMessages } from "./CheckInContext";
import type { GymOption } from "./GymPicker";
import ExercisePage, { MAX_WARMUPS, type ExerciseRequest } from "./ExercisePage";
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
  tidyDecimal,
  useTicker,


  type SessionDay,
  type SessionExercise,
} from "./workoutShared";

// The workout: a navy header with the session's clock, a horizontal pager
// with one exercise per page (then the cardio, then the wrap-up), and a dock
// with the rest timer. The clock is the server's started_at against now, so
// it survives a reload, the app going to the background and a trip back to
// the overview. Opened again from a finished session (editing), the sets
// change as they would live and the wrap up has Save changes in place of
// the swipe; the session keeps its date and time.

const PAGE_KEY = "ironline.client.workout-page";
type Page = { kind: "exercise"; index: number } | { kind: "cardio"; index: number } | { kind: "wrap" };

function readPage(dayId: number, editing: boolean): number | null {
  try {
    const raw = window.sessionStorage.getItem(PAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { dayId: number; index: number; editing?: boolean };
    return v.dayId === dayId && !!v.editing === editing ? v.index : null;
  } catch {
    return null;
  }
}

export default function WorkoutScreen({
  day,
  editing = false,
  gymId,
  onPickGym,
  coachName,
  clientName = "",
  focusExercise,
  onBack,
  onEnded,
  onDiscarded,
  onEdited,
}: {
  day: SessionDay;
  /** A finished session opened again to correct it. */
  editing?: boolean;
  gymId: number | null;
  onPickGym: (gym: GymOption) => void;
  coachName: string;
  /** The client's first name, for the wrap-up. */
  clientName?: string;
  focusExercise: number | null;
  /** Back to the overview; the session keeps going. */
  onBack: () => void;
  /** The session was ended: back to the tab with the saved toast. */
  onEnded: () => void;
  onDiscarded: () => void;
  /** Editing: the changes were saved. */
  onEdited?: () => void;
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
    const t = setTimeout(() => jumpTo(readPage(day.key, editing) ?? (editing ? 0 : firstPage()), true), 0);
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
      window.sessionStorage.setItem(PAGE_KEY, JSON.stringify({ dayId: day.key, index: page, editing }));
    } catch {}
  }, [day.key, page, editing]);

  // The clock.
  const ended = day.endedAt != null;
  // The wrap up's answers and note lock once it is ended, unless editing.
  const locked = ended && !editing;
  const now = useTicker(!ended);
  const ms = elapsedMs(day.startedAt, day.endedAt, now);

  // Dock: the rest timer, restarted on a ticked set when the client wants that.
  const rest = useRestTimer();
  const current = pages[Math.min(page, pages.length - 1)];
  const currentRest = current.kind === "exercise" ? day.exercises[current.index].rest : null;

  // The ⋯ menu and the sheets.
  const [menuOpen, setMenuOpen] = useState(false);
  useDismiss(menuOpen, () => setMenuOpen(false));
  // Where the menu drops from: under the ⋯ that opened it (on an exercise's
  // row since 2 Oct, or the head on a cardio or the wrap up).
  const screenRef = useRef<HTMLDivElement>(null);
  const [menuAt, setMenuAt] = useState<{ top: number; right: number } | null>(null);
  const toggleMenu = (e: React.MouseEvent<HTMLElement>) => {
    const box = screenRef.current?.getBoundingClientRect();
    const btn = e.currentTarget.getBoundingClientRect();
    setMenuAt(box ? { top: btn.bottom - box.top + 6, right: box.right - btn.right } : null);
    setMenuOpen((o) => !o);
  };
  const [gymOpen, setGymOpen] = useState(false);
  // The exercise on screen, for the menu's note / warm-up / swap and the chat.
  const currentEx = current.kind === "exercise" ? day.exercises[current.index] : null;
  const [request, setRequest] = useState<(ExerciseRequest & { page: number }) | null>(null);
  const ask = (kind: ExerciseRequest["kind"]) => {
    setMenuOpen(false);
    setRequest({ kind, page, n: Date.now() });
  };
  const openMessages = useOpenMessages();
  const currentNote = currentEx ? ((gymId != null ? currentEx.gymNotes?.[gymId] : "") || currentEx.myNote).trim() : "";
  const [, startTransition] = useTransition();
  const gymName = day.gyms.find((g) => g.id === gymId)?.name ?? null;

  // Ending and discarding.
  const [note, setNote] = useState(day.sessionNote);
  // The coach's questions before ending, each optional: 1 to 10, a second tap takes the answer back.
  const [answers, setAnswers] = useState<Record<string, number | string | null>>(day.answers);
  const [ending, setEnding] = useState(false);
  const end = () => {
    if (ending) return;
    setEnding(true);
    startTransition(async () => {
      await endSessionAction(day.key, { note, answers: day.questions.map((q) => ({ id: q.id, value: answers[q.id] ?? null })) });
      setTimeout(onEnded, 900);
    });
  };
  // Editing: the note and answers saved, ended_at given back as it was.
  const saveEdit = () => {
    if (ending) return;
    setEnding(true);
    startTransition(async () => {
      await endSessionAction(day.key, { note, at: day.endedAt ?? undefined, answers: day.questions.map((q) => ({ id: q.id, value: answers[q.id] ?? null })) });
      onEdited?.();
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

  // The chat (about the exercise on screen, when there is one) and the ⋯.
  const headTools = (cls: string, ex: SessionExercise | null = null) => (
    <>
      {openMessages && (
        <button
          type="button"
          className={cls}
          onClick={() => (ex ? openMessages({ link: { kind: "exercise", dayId: day.key, assignmentId: ex.id }, label: `${shownName(ex)} · ${day.title}` }) : openMessages())}
          aria-label={ex ? `Message ${coachName} about ${shownName(ex)}` : `Message ${coachName}`}
        >
          <ChatIcon />
        </button>
      )}
      {/* Editing, nothing to put in it on a cardio or the wrap up without gyms. */}
      {!(editing && !ex && day.gyms.length === 0) && (
      <button type="button" className={cls} onClick={toggleMenu} aria-label="More" aria-expanded={menuOpen}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none" />
        </svg>
      </button>
      )}
    </>
  );

  const pageDone = (p: Page) => (p.kind === "exercise" ? isDone(day.exercises[p.index]) : p.kind === "cardio" ? day.cardio[p.index].done : ended);
  // Where "next" goes from page i (5 Oct): the next exercise or cardio not
  // done yet, after this one, then round from the start (one skipped while
  // its machine was taken); with everything done, the wrap up. So finishing
  // the one you went back to never lands on one already done.
  // The next page still to do, forward only: the last exercise has no
  // "Next up" (it used to circle back to the first, 7 Oct); it goes on to
  // the wrap-up, where the checklist shows anything skipped.
  const nextOpen = (i: number) => {
    const wrap = pages.length - 1;
    for (let j = i + 1; j < wrap; j++) if (!pageDone(pages[j])) return j;
    return wrap;
  };
  const pageStarted = (p: Page) => p.kind === "exercise" && loggedCount(day.exercises[p.index]) > 0;

  return (
    <div ref={screenRef} className="app-layer app-layer-push wo-screen" role="dialog" aria-label={`${day.title} workout`}>
      <header className="wo-head">
        <div className="wo-head-row">
          <button type="button" className="wo-head-btn" onClick={onBack} aria-label="Back to the session overview">
            <ChevronLeftIcon />
          </button>
          <div className="wo-head-mid">
            <div className="wo-head-kicker">{editing ? `Editing · ${day.title}` : day.title}</div>
            <div className={`wo-head-clock${ended ? " ended" : ""}`}>{clock(ms)}</div>
          </div>
          {/* On an exercise the chat and ⋯ sit on its own row (ExercisePage's
              tools); on a cardio or the wrap up, here. */}
          <div className="wo-head-right">{!currentEx && headTools("wo-head-btn")}</div>
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
            <div className="wo-menu" role="menu" style={menuAt ? { top: menuAt.top, right: menuAt.right } : undefined}>
              {day.gyms.length > 0 && (
                <button
                  type="button"
                  role="menuitem"
                  className="wo-menu-row ico"
                  onClick={() => {
                    setMenuOpen(false);
                    setGymOpen(true);
                  }}
                >
                  <MenuIcon kind="gym" />
                  Change gym
                </button>
              )}
              {currentEx && (
                <>
                  <button type="button" role="menuitem" className="wo-menu-row ico" disabled={currentEx.warmups.length >= MAX_WARMUPS} onClick={() => ask("warmup")}>
                    <MenuIcon kind="warmup" />
                    Add a warm-up set
                  </button>
                  <button type="button" role="menuitem" className="wo-menu-row ico" onClick={() => ask("swap")}>
                    <MenuIcon kind="swap" />
                    {currentEx.swap ? "Change the swap" : "Swap exercise"}
                  </button>
                  {/* The note for yourself fourth, after the swap (30 Sep). */}
                  <button type="button" role="menuitem" className="wo-menu-row ico" onClick={() => ask("note")}>
                    <MenuIcon kind="note" />
                    {currentNote ? "Edit your note" : "Add a note for yourself"}
                  </button>
                </>
              )}
              {/* Editing a finished session: no Discard, it is kept. */}
              {!editing && (
                <>
                  <div className="wo-menu-divider" />
                  <button type="button" role="menuitem" className="wo-menu-row ico danger" onClick={discard}>
                    <MenuIcon kind="discard" />
                    Discard session
                  </button>
                </>
              )}
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
                nextName={(() => {
                  const n = pages[nextOpen(i)];
                  return n?.kind === "exercise" ? shownName(day.exercises[n.index]) : n?.kind === "cardio" ? day.cardio[n.index].name : null;
                })()}
                onNext={() => jumpTo(nextOpen(i))}
                request={request?.page === i ? request : null}
                tools={headTools("wo-round-btn wo-ex-btn", day.exercises[p.index])}
              />
            ) : p.kind === "cardio" ? (
              <div className="wo-page-inner">
                <div className="wo-kicker">
                  Cardio {p.index + 1} of {day.cardio.length}
                </div>
                <CardioCard cardio={day.cardio[p.index]} index={day.exercises.length + p.index + 1} coachName={coachName} />
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
                      <button key={j} type="button" className={`wo-check-row${complete ? " done" : ""}`} onClick={() => jumpTo(j)}>
                        <span className={`wo-check-circle${complete ? " done" : ""}`}>{complete ? "✓" : j + 1}</span>
                        <span className="wo-check-name">{ex ? shownName(ex) : day.cardio[q.index].name}</span>
                        <span className={`wo-check-status${complete ? " done" : count ? " part" : ""}`}>{status}</span>
                      </button>
                    );
                  })}
                </div>
                {day.questions.length > 0 && (
                  <div className="wo-ask">
                    <div className="wo-ask-head">
                      <span className="wo-note-label">How was it?</span>
                    </div>
                    {day.questions.map((q) => {
                      const v = answers[q.id] ?? null;
                      const set = (x: number | string | null) => setAnswers((a) => ({ ...a, [q.id]: x }));
                      // A number with its unit, words in a box, or the ten pills.
                      if (q.kind === "number")
                        return (
                          <label key={q.id} className="wo-scale wo-ask-field">
                            <span className="wo-scale-head">
                              <b>{q.label}</b>
                            </span>
                            <span className="wo-ask-num">
                              <input value={v == null ? "" : String(v)} onChange={(e) => set(e.target.value)} onInput={tidyDecimal} inputMode="decimal" placeholder="0" disabled={locked} aria-label={q.label} />
                              {q.unit && <small>{q.unit}</small>}
                            </span>
                          </label>
                        );
                      if (q.kind === "text")
                        return (
                          <label key={q.id} className="wo-scale wo-ask-field">
                            <span className="wo-scale-head">
                              <b>{q.label}</b>
                            </span>
                            <textarea className="wo-note-input" rows={2} maxLength={500} value={typeof v === "string" ? v : ""} onChange={(e) => set(e.target.value)} disabled={locked} aria-label={q.label} />
                          </label>
                        );
                      return <Scale key={q.id} label={q.label} value={typeof v === "number" ? v : null} onChange={set} disabled={locked} />;
                    })}
                  </div>
                )}
                <div className="wo-coach-note">
                  <span className="wo-note-label">Anything to mention to {coachName}?</span>
                  <textarea className="wo-note-input" rows={2} value={note} placeholder="How did it feel? Anything to flag?" onChange={(e) => setNote(e.target.value)} disabled={locked} />
                </div>
                {editing ? (
                  <button type="button" className="wo-save-edit" onClick={saveEdit} disabled={ending}>
                    {ending ? "Saving…" : "Save changes"}
                  </button>
                ) : (
                  <SwipeToEnd onEnd={end} done={ended} />
                )}
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

// The ⋯ menu's icons, one per row.
const MENU_ICONS = {
  gym: ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z", "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  note: ["M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z", "m15 5 4 4"],
  warmup: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  swap: ["M8 3 4 7l4 4", "M4 7h16", "m16 21 4-4-4-4", "M20 17H4"],
  discard: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M10 11v6", "M14 11v6"],
} as const;

function MenuIcon({ kind }: { kind: keyof typeof MENU_ICONS }) {
  return (
    <svg className="wo-menu-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {MENU_ICONS[kind].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// One question of the wrap-up: 1 to 10, a tap picks, a tap on the pick takes it back.
function Scale({ label, value, onChange, disabled }: { label: string; value: number | null; onChange: (v: number | null) => void; disabled?: boolean }) {
  return (
    <div className="wo-scale">
      <div className="wo-scale-head">
        {/* No "1 to 10" beside it (30 Sep): the pills say it. */}
        <b>{label}</b>
      </div>
      <div className="wo-scale-row" role="group" aria-label={`${label}, 1 to 10`}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={`wo-scale-dot${value != null && n <= value ? " in" : ""}${n === value ? " on" : ""}`} aria-pressed={n === value} disabled={disabled} onClick={() => onChange(n === value ? null : n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
