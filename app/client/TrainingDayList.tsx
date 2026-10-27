"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Bars } from "./Bars";
import { addFreeCardioAction, addFreeExerciseAction, createFreeSessionAction, pickGymAction, removeFreeSessionAction, startSessionAction } from "../lib/actions";
import type { GymOption } from "./GymPickerDialog";
import SessionOverview, { STATUS_LABEL } from "./SessionOverview";
import WorkoutScreen from "./WorkoutScreen";
import { CompassIcon } from "../components/icons";
import RingEdge from "../components/RingEdge";
import { useFocusRef, useNavigateTab, useOpenMessages, useTrainingFocus, type TrainingFocus } from "./CheckInContext";
import { clock, durationMinutes, elapsedMs, isDone, loggedSets, plannedSets, roundTo, sessionStatus, shortDate, shownName, useTicker, type LibraryPick, type SessionCardio, type SessionDay, type SessionExercise } from "./workoutShared";

// The week's sessions as rows on the Training tab. A finished session (swiped
// to its end) opens in place with its sets (16 Oct); any other row opens the
// session's overview as its own screen; "Start session" there opens the
// workout. Both screens are laid over the app (a layer in the phone's
// stack), so the tab keeps its week and its scroll underneath. Which screen
// is open is remembered on this phone, so a reload lands back in it. A
// finished session's "Edit workout" opens the workout again ("edit"), its
// date kept, for numbers put in wrong.

const VIEW_KEY = "ironline.client.session-view";
type View = { dayId: number; screen: "overview" | "workout" | "edit" } | null;

function readView(): View {
  try {
    const raw = window.sessionStorage.getItem(VIEW_KEY);
    return raw ? (JSON.parse(raw) as View) : null;
  } catch {
    return null;
  }
}
/** A session as a discard leaves it (discardSession in queries.ts): not started, nothing logged, no swaps or warm-ups. */
const fresh = (d: SessionDay): SessionDay => ({
  ...d,
  startedAt: null,
  endedAt: null,
  sessionNote: "",
  answers: {},
  exercises: d.exercises.map((e) => ({ ...e, logs: [], warmups: [], swap: null })),
  cardio: d.cardio.map((c) => ({ ...c, done: false, swap: null })),
});

function writeView(v: View) {
  try {
    if (v) window.sessionStorage.setItem(VIEW_KEY, JSON.stringify(v));
    else window.sessionStorage.removeItem(VIEW_KEY);
  } catch {}
}

export default function TrainingDayList({
  days: serverDays,
  currentWeek,
  pastWeek,
  coachName,
  coachPhoto = null,
  clientName = "",
  liveSession: serverLive,
  headerPicture = null,
  clientId,
  library = [],
}: {
  days: SessionDay[];
  /** Whose sessions: a free session is made for them (19 Oct). */
  clientId: number;
  /** The coach's library, for what a free session can add. */
  library?: LibraryPick[];
  /** The selected week is the current one: sessions can be started. */
  currentWeek: boolean;
  /** The selected week is over: sessions read as done, skipped or missed. */
  pastWeek: boolean;
  coachName: string;
  /** The coach's photo (14 Oct), on the swap pop-up's "Suggested by". */
  coachPhoto?: string | null;
  clientName?: string;
  /** The client's session in progress, wherever it is. */
  liveSession: { id: number; label: string; startedAt: string; week: number } | null;
  /** The client's own training picture (15 Oct) behind the session header; none, the stock one. */
  headerPicture?: string | null;
}) {
  // Discarded here (19 Oct, Alex: discarding took seconds): the workout closes
  // at once and the session reads as never started, its sets gone, until the
  // server's page catches up (the mask holds while the server still has the
  // start it had, so a fresh start right after is not hidden).
  const [discardedHere, setDiscardedHere] = useState<{ dayId: number; startedAt: string } | null>(null);
  const masked = (d: SessionDay) => discardedHere != null && d.key === discardedHere.dayId && d.startedAt === discardedHere.startedAt;
  // Free sessions (19 Oct, Alex): the one just started here and the exercises
  // just added to it are drawn before the server's page has them; one left
  // empty or discarded is gone at once.
  const [localFree, setLocalFree] = useState<SessionDay | null>(null);
  const [freeAdds, setFreeAdds] = useState<{ dayId: number; ex: SessionExercise }[]>([]);
  const [freeCardio, setFreeCardio] = useState<{ dayId: number; c: SessionCardio }[]>([]);
  const [goneFree, setGoneFree] = useState<number[]>([]);
  const withFree = [...serverDays, ...(localFree && !serverDays.some((d) => d.key === localFree.key) ? [localFree] : [])]
    .filter((d) => !goneFree.includes(d.key))
    .map((d) => {
      const adds = freeAdds.filter((a) => a.dayId === d.key && !d.exercises.some((e) => e.id === a.ex.id)).map((a) => a.ex);
      const cardio = freeCardio.filter((a) => a.dayId === d.key && !d.cardio.some((c) => c.id === a.c.id)).map((a) => a.c);
      return adds.length || cardio.length ? { ...d, exercises: [...d.exercises, ...adds], cardio: [...d.cardio, ...cardio] } : d;
    });
  const days = discardedHere == null ? withFree : withFree.map((d) => (masked(d) ? fresh(d) : d));
  const liveSession =
    serverLive && ((discardedHere && serverLive.id === discardedHere.dayId && serverLive.startedAt === discardedHere.startedAt) || goneFree.includes(serverLive.id)) ? null : serverLive;
  const [view, setViewState] = useState<View>(null);
  // Put back from storage after a reload: shown in place, not slid in.
  const [restored, setRestored] = useState(false);
  const setView = (v: View) => {
    setRestored(false);
    setViewState(v);
    writeView(v);
  };
  // The gym picked for the open session; the server's answer takes over.
  const [gymPick, setGymPick] = useState<{ dayId: number; gymId: number | null } | null>(null);
  const [toast, setToast] = useState<{ title: string; sub: string } | null>(null);
  const [, startTransition] = useTransition();
  const [startProblem, setStartProblem] = useState<string | null>(null);

  // Back after a reload, and a link from Home's "Start" or a coach message.
  const focus = useFocusRef();
  const trainingFocus = useTrainingFocus();
  const focusExercise = trainingFocus?.exercise ?? null;
  const focusStart = !!trainingFocus?.start;
  const openMessages = useOpenMessages();
  const goToTab = useNavigateTab();
  // The link from the chat whose way back has been used, so opening the same
  // session again from the list comes back to the list.
  const [chatDone, setChatDone] = useState<TrainingFocus | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const stored = readView();
      if (stored && days.some((d) => d.key === stored.dayId)) {
        setRestored(true);
        setViewState(stored);
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);
  useEffect(() => {
    if (focus == null || !days.some((d) => d.key === focus)) return;
    const t = setTimeout(() => setView({ dayId: focus, screen: trainingFocus?.resume ? "workout" : "overview" }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new arrival only
  }, [focus, focusExercise]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const openDay = view ? days.find((d) => d.key === view.dayId) ?? null : null;
  const gymIdFor = (d: SessionDay) => (gymPick?.dayId === d.key ? gymPick.gymId : d.gymId);
  const pickGym = (d: SessionDay, g: GymOption) => {
    const logged = loggedSets(d);
    const current = gymIdFor(d);
    if (logged > 0 && current != null && current !== g.id && !window.confirm(`Move the ${logged} set${logged === 1 ? "" : "s"} logged in this session to ${g.name}?`)) return;
    setGymPick({ dayId: d.key, gymId: g.id });
    void pickGymAction(d.key, g.id);
  };
  // Straight into the workout (14 Oct, Alex): the screen used to wait for the
  // server's answer, seconds on a phone, the whole page rebuilding behind it.
  // Now it opens at once with the start stamped here; the server takes the
  // same stamp, and only a refusal (another session still going) brings the
  // overview back with the reason.
  const [startedHere, setStartedHere] = useState<{ dayId: number; at: string } | null>(null);
  const start = (d: SessionDay, g: GymOption | null) => {
    if (g) {
      setGymPick({ dayId: d.key, gymId: g.id });
      void pickGymAction(d.key, g.id);
    }
    const at = new Date().toISOString();
    setStartProblem(null);
    setStartedHere({ dayId: d.key, at });
    setView({ dayId: d.key, screen: "workout" });
    startTransition(async () => {
      const r = await startSessionAction(d.key, at);
      if (!r.ok) {
        setStartedHere(null);
        setView({ dayId: d.key, screen: "overview" });
        setStartProblem(r.other ? `Finish ${r.other} first.` : "Couldn't start the session.");
      }
    });
  };

  // A free session: made on the server, then straight into its workout, empty,
  // on its "Add an exercise" page. Refused while another session is going.
  const [freeBusy, setFreeBusy] = useState(false);
  const startFree = () => {
    if (freeBusy) return;
    const at = new Date().toISOString();
    setFreeBusy(true);
    setStartProblem(null);
    startTransition(async () => {
      try {
        // Never stuck on "Starting…" (19 Oct): an answer lost on the way (the
        // server restarting, the connection dropping) gives up after 10 s.
        const r = await Promise.race([
          createFreeSessionAction(clientId, at),
          new Promise<{ ok: false; other?: string }>((resolve) => setTimeout(() => resolve({ ok: false }), 10000)),
        ]).catch(() => ({ ok: false as const }));
        if (!r.ok) {
          setStartProblem("other" in r && r.other ? `Finish ${r.other} first.` : "Couldn't start a rogue session. Try again.");
          return;
        }
        const like = serverDays.find((d) => !d.free) ?? serverDays[0];
        setLocalFree({ key: r.id, index: days.length + 1, week: like?.week ?? 1, title: "Rogue session", exercises: [], cardio: [], skipReason: "", startedAt: at, endedAt: null, sessionNote: "", questions: like?.questions ?? [], answers: {}, gyms: [], gymId: null, free: true });
        setView({ dayId: r.id, screen: "workout" });
      } finally {
        setFreeBusy(false);
      }
    });
  };
  /** An exercise into the open free session: drawn the moment the server gives it an id. */
  const addFree = async (dayId: number, pick: { exerciseId: number | null; name: string; group: string }): Promise<number | null> => {
    // Cardio (19 Oct): its own page, the client's numbers filled in there.
    if (pick.group === "cardio") {
      const cid = await addFreeCardioAction(dayId, pick.name);
      if (cid == null) return null;
      setFreeCardio((a) => [...a, { dayId, c: { id: cid, name: pick.name, time: "", pace: "", incline: "", distance: "", notes: "", done: false, swap: null, alternatives: [] } }]);
      return cid;
    }
    const id = await addFreeExerciseAction(dayId, pick.exerciseId != null ? { exerciseId: pick.exerciseId } : { name: pick.name });
    if (id == null) return null;
    const ex: SessionExercise = { id, name: pick.name, swap: null, alternatives: [], group: pick.group, sets: 1, reps: "", targetWeight: null, unit: null, targetRpe: null, tempo: null, rest: null, distance: null, time: null, videoUrl: null, logs: [], note: { text: null, dateLabel: "", unread: false }, myNote: "", warmups: [], lastWarmups: [], videoRequest: null, lastSets: null, history: [] };
    setFreeAdds((a) => [...a, { dayId, ex }]);
    return id;
  };
  /** A free session left with nothing in it: gone here at once, and on the server behind. */
  const dropFree = (dayId: number) => {
    setGoneFree((g) => [...g, dayId]);
    if (localFree?.key === dayId) setLocalFree(null);
    setView(null);
    startTransition(async () => {
      await removeFreeSessionAction(dayId);
    });
  };

  // Live: this week's live session, or the one elsewhere for the resume bar.
  const liveDay = days.find((d) => d.startedAt && !d.endedAt) ?? null;
  const now = useTicker(!!liveSession && !view);
  const nextKey = currentWeek ? days.find((d) => sessionStatus(d, false) === "upcoming")?.key ?? null : null;

  const [host, setHost] = useState<HTMLElement | null>(null);
  // The finished session open in place, if any.
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <>
      <div className="tr-rows" ref={(el) => setHost(el?.closest<HTMLElement>(".app-stack") ?? null)}>
        {days.map((d) => {
          const status = sessionStatus(d, pastWeek);
          const isNext = d.key === nextKey;
          const planned = plannedSets(d);
          const logged = loggedSets(d);
          const gymName = d.gyms.find((g) => g.id === d.gymId)?.name ?? null;
          const minutes = durationMinutes(d);
          const sub =
            status === "done" || status === "unfinished"
              ? [d.endedAt ? shortDate(d.endedAt) : "Logged", minutes != null ? `${minutes} min` : null, status === "unfinished" && planned ? `${logged} of ${planned} sets` : gymName]
              : status === "live"
              ? ["In progress", clock(elapsedMs(d.startedAt, null, now))]
              : status === "skipped"
              ? ["Couldn't train", d.skipReason]
              : [
                  `${d.exercises.length} exercise${d.exercises.length === 1 ? "" : "s"}`,
                  planned ? `${planned} sets` : null,
                  d.cardio.length ? `${d.cardio.length} cardio` : null,
                ];
          const tone = status === "done" ? "done" : status === "unfinished" ? "unfinished" : status === "live" ? "live" : isNext ? "next" : status;
          // A session swiped to its end (16 Oct, Alex) opens in place with what was done; the full screen is a link inside.
          const ended = (status === "done" || status === "unfinished") && !!d.endedAt;
          const isOpen = ended && expanded === d.key;
          return (
            <Fragment key={d.key}>
            <button type="button" className={`tr-row ${tone}${isOpen ? " open" : ""}`} onClick={() => (ended ? setExpanded((k) => (k === d.key ? null : d.key)) : setView({ dayId: d.key, screen: d.free ? "workout" : "overview" }))} aria-expanded={ended ? isOpen : undefined}>
              <span className={`tr-row-tile ${tone}`}>
                {d.index}
                <RingEdge size={32} stroke={tone === "next" || tone === "live" ? 1.5 : 1} />
              </span>
              <span className="tr-row-main">
                <span className="tr-row-title">{d.title}</span>
                <span className="tr-row-sub">
                  <Bars parts={sub} />
                </span>
              </span>
              {(status !== "upcoming" || isNext || logged > 0) && (
              <span className={`tr-row-pill ${tone}`}>
                {status === "live" && <span className="tr-row-dot" aria-hidden="true" />}
                {isNext && status === "upcoming" ? "Up next" : status === "upcoming" && logged > 0 ? "Started" : STATUS_LABEL[status]}
              </span>
              )}
              <span className="tr-row-chev" aria-hidden="true" />
            </button>
            {ended && (
              <div className={`ev-x tr-x${isOpen ? " open" : ""}`} aria-hidden={!isOpen}>
                <div className="ev-x-clip">
                  <div className="tr-x-in">
                    {d.exercises.map((ex) => {
                      const sets = ex.logs.slice().sort((a, b) => a.setNumber - b.setNumber);
                      return (
                        <div key={ex.id} className={`tr-x-ex${isDone(ex) ? " done" : ""}`}>
                          <span className="tr-x-name">{shownName(ex)}</span>
                          {sets.length === 0 ? (
                            <span className="tr-x-none">Not logged</span>
                          ) : (
                            sets.map((l) => (
                              <span key={l.id} className="tr-x-set">
                                <span className="tr-x-n">
                                  <Bars parts={[`Set ${l.setNumber}`, l.setNumber > ex.sets && "Extra"]} />
                                </span>
                                <span className="tr-x-v">
                                  <Bars parts={[`${l.weight != null ? `${roundTo(l.weight, 2)} kg` : "–"} × ${l.reps ?? "–"}`, l.rpe != null && <small key="r">RPE {l.rpe}</small>]} />
                                </span>
                              </span>
                            ))
                          )}
                        </div>
                      );
                    })}
                    {d.cardio.map((c) => (
                      <div key={`c${c.id}`} className={`tr-x-ex${c.done ? " done" : ""}`}>
                        <span className="tr-x-name">{c.swap ?? c.name}</span>
                        <span className="tr-x-none">{c.done ? "Done" : "Not done"}</span>
                      </div>
                    ))}
                    <button type="button" className="tr-x-open" onClick={() => setView({ dayId: d.key, screen: "overview" })} tabIndex={isOpen ? 0 : -1}>
                      Open session
                    </button>
                  </div>
                </div>
              </div>
            )}
            </Fragment>
          );
        })}
        {/* The extra row (19 Oct, Alex): an empty session to fill, off the plan.
            On the same line as the week's sessions, but its ring empty: no
            number, so it doesn't read as one more to do this week. */}
        {currentWeek && (
          <button type="button" className="tr-row tr-free" onClick={startFree} disabled={freeBusy} aria-label="Rogue session: your own workout, off the plan">
            <span className="tr-row-tile free" aria-hidden="true">
              <CompassIcon size={20} rim={false} />
            </span>
            <span className="tr-row-main">
              <span className="tr-row-title">Rogue session</span>
              <span className="tr-row-sub">{freeBusy ? "Starting…" : "Your own workout, off the plan"}</span>
            </span>
            <span className="tr-row-chev" aria-hidden="true" />
          </button>
        )}
      </div>

      {startProblem && (
        <p className="tr-start-problem" role="alert">
          {startProblem}
        </p>
      )}

      {/* A session going on, while the client is back on the tab. */}
      {liveSession && !view && host && createPortal(
        <button
          type="button"
          className="tr-resume"
          onClick={() => {
            if (liveDay) setView({ dayId: liveDay.key, screen: "workout" });
            // Begun in another week (Sunday's session, seen on Monday; 13 Oct):
            // Training comes up on that week, inside the session, so it can be
            // ended. Tapping used to do nothing, and the session could never be closed.
            else goToTab?.("training", liveSession.id, { week: liveSession.week, exercise: null, resume: true });
          }}
        >
          <span className="tr-row-dot" aria-hidden="true" />
          <span className="tr-resume-main">
            <b>{liveSession.label} in progress</b>
            <small>{(liveDay ? liveDay.gyms.find((g) => g.id === gymIdFor(liveDay))?.name : null) ?? "Tap to carry on"}</small>
          </span>
          <span className="tr-resume-time">{clock(elapsedMs(liveSession.startedAt, null, now))}</span>
          <span className="tr-resume-chip">Resume</span>
        </button>,
        host
      )}

      {toast && host && createPortal(
        <div className="tr-toast" role="status">
          <span className="tr-toast-check" aria-hidden="true">
            ✓
          </span>
          <span className="tr-toast-main">
            <b>{toast.title}</b>
            <small>{toast.sub}</small>
          </span>
        </div>,
        host
      )}

      {openDay && host && view?.screen === "overview" && createPortal(
        <SessionOverview
          still={restored}
          day={{ ...openDay, gymId: gymIdFor(openDay) }}
          pastWeek={pastWeek}
          currentWeek={currentWeek}
          liveElsewhere={liveSession && liveSession.id !== openDay.key ? liveSession.label : null}
          coachName={coachName}
          picture={headerPicture}
          onBack={() => {
            setView(null);
            // Opened from a link in the chat: Back goes back to the chat, once.
            if (openDay.key === focus && trainingFocus?.fromChat && chatDone !== trainingFocus && openMessages) {
              setChatDone(trainingFocus);
              openMessages();
            }
          }}
          onStart={(g) => start(openDay, g)}
          onResume={() => setView({ dayId: openDay.key, screen: "workout" })}
          onEdit={() => setView({ dayId: openDay.key, screen: "edit" })}
          autoStart={openDay.key === focus && focusStart && !openDay.startedAt && !openDay.endedAt}
          focusExercise={openDay.key === focus ? focusExercise : null}
        />,
        host
      )}

      {openDay && host && (view?.screen === "workout" || (view?.screen === "edit" && openDay.endedAt)) && createPortal(
        <WorkoutScreen
          key={`${openDay.key}:${view.screen}`}
          day={openDay.startedAt == null && startedHere?.dayId === openDay.key ? { ...openDay, startedAt: startedHere.at } : openDay}
          editing={view.screen === "edit"}
          gymId={gymIdFor(openDay)}
          onPickGym={(g) => pickGym(openDay, g)}
          coachName={coachName}
          coachPhoto={coachPhoto}
          clientName={clientName}
          focusExercise={openDay.key === focus ? focusExercise : null}
          onBack={() => (openDay.free ? (openDay.exercises.length === 0 && openDay.cardio.length === 0 ? dropFree(openDay.key) : setView(null)) : setView({ dayId: openDay.key, screen: "overview" }))}
          library={openDay.free ? library : undefined}
          onAddExercise={openDay.free ? (pick) => addFree(openDay.key, pick) : undefined}
          onEnded={() => {
            const minutes = openDay.startedAt ? Math.max(1, Math.round((Date.now() - Date.parse(openDay.startedAt)) / 60000)) : null;
            const sets = loggedSets(openDay);
            setView(null);
            setToast({ title: `${openDay.title} saved`, sub: `${minutes != null ? `${minutes} min, ` : ""}${sets} set${sets === 1 ? "" : "s"}. ${coachName} can see it now` });
          }}
          onDiscarded={() => {
            // A free session discarded is gone, not put back as unstarted.
            if (openDay.free) {
              setGoneFree((g) => [...g, openDay.key]);
              if (localFree?.key === openDay.key) setLocalFree(null);
              setView(null);
              return;
            }
            const at = openDay.startedAt ?? (startedHere?.dayId === openDay.key ? startedHere.at : null);
            if (at) setDiscardedHere({ dayId: openDay.key, startedAt: at });
            if (startedHere?.dayId === openDay.key) setStartedHere(null);
            setView({ dayId: openDay.key, screen: "overview" });
          }}
          onEdited={() => {
            setView({ dayId: openDay.key, screen: "overview" });
            setToast({ title: "Changes saved", sub: `${coachName} sees the workout as it is now` });
          }}
        />,
        host
      )}
    </>
  );
}
