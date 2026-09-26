"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { pickGymAction, startSessionAction } from "../lib/actions";
import type { GymOption } from "./GymPicker";
import SessionOverview, { STATUS_LABEL } from "./SessionOverview";
import WorkoutScreen from "./WorkoutScreen";
import { useFocusRef, useOpenMessages, useTrainingFocus, type TrainingFocus } from "./CheckInContext";
import { clock, durationMinutes, elapsedMs, loggedSets, plannedSets, sessionStatus, shortDate, useTicker, type SessionDay } from "./workoutShared";

// The week's sessions as rows on the Training tab. A row opens the
// session's overview as its own screen; "Start session" there opens the
// workout. Both screens are laid over the app (a layer in the phone's
// stack), so the tab keeps its week and its scroll underneath. Which screen
// is open is remembered on this phone, so a reload lands back in it.

const VIEW_KEY = "ironline.client.session-view";
type View = { dayId: number; screen: "overview" | "workout" } | null;

function readView(): View {
  try {
    const raw = window.sessionStorage.getItem(VIEW_KEY);
    return raw ? (JSON.parse(raw) as View) : null;
  } catch {
    return null;
  }
}
function writeView(v: View) {
  try {
    if (v) window.sessionStorage.setItem(VIEW_KEY, JSON.stringify(v));
    else window.sessionStorage.removeItem(VIEW_KEY);
  } catch {}
}

export default function TrainingDayList({
  days,
  currentWeek,
  pastWeek,
  coachName,
  clientName = "",
  liveSession,
}: {
  days: SessionDay[];
  /** The selected week is the current one: sessions can be started. */
  currentWeek: boolean;
  /** The selected week is over: sessions read as done, skipped or missed. */
  pastWeek: boolean;
  coachName: string;
  clientName?: string;
  /** The client's session in progress, wherever it is. */
  liveSession: { id: number; label: string; startedAt: string } | null;
}) {
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
    const t = setTimeout(() => setView({ dayId: focus, screen: "overview" }), 0);
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
  const start = (d: SessionDay, g: GymOption | null) => {
    if (g) {
      setGymPick({ dayId: d.key, gymId: g.id });
      void pickGymAction(d.key, g.id);
    }
    startTransition(async () => {
      const r = await startSessionAction(d.key);
      if (!r.ok) {
        setStartProblem(r.other ? `Finish ${r.other} first.` : "Couldn't start the session.");
        return;
      }
      setView({ dayId: d.key, screen: "workout" });
    });
  };

  // Live: this week's live session, or the one elsewhere for the resume bar.
  const liveDay = days.find((d) => d.startedAt && !d.endedAt) ?? null;
  const now = useTicker(!!liveSession && !view);
  const nextKey = currentWeek ? days.find((d) => sessionStatus(d, false) === "upcoming")?.key ?? null : null;

  const [host, setHost] = useState<HTMLElement | null>(null);

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
              ? [d.endedAt ? shortDate(d.endedAt) : "Logged", minutes != null ? `${minutes} min` : null, status === "unfinished" && planned ? `${logged} of ${planned} sets` : gymName].filter(Boolean).join(" · ")
              : status === "live"
              ? `In progress · ${clock(elapsedMs(d.startedAt, null, now))}`
              : status === "skipped"
              ? `Couldn't train · ${d.skipReason}`
              : [
                  `${d.exercises.length} exercise${d.exercises.length === 1 ? "" : "s"}`,
                  planned ? `${planned} sets` : null,
                  d.cardio.length ? `${d.cardio.length} cardio` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
          const tone = status === "done" ? "done" : status === "unfinished" ? "unfinished" : status === "live" ? "live" : isNext ? "next" : status;
          return (
            <button key={d.key} type="button" className={`tr-row ${tone}`} onClick={() => setView({ dayId: d.key, screen: "overview" })}>
              <span className={`tr-row-tile ${tone}`}>{d.index}</span>
              <span className="tr-row-main">
                <span className="tr-row-title">{d.title}</span>
                <span className="tr-row-sub">{sub}</span>
              </span>
              {(status !== "upcoming" || isNext || logged > 0) && (
              <span className={`tr-row-pill ${tone}`}>
                {status === "live" && <span className="tr-row-dot" aria-hidden="true" />}
                {isNext && status === "upcoming" ? "Up next" : status === "upcoming" && logged > 0 ? "Started" : STATUS_LABEL[status]}
              </span>
              )}
              <span className="tr-row-chev" aria-hidden="true" />
            </button>
          );
        })}
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
          }}
        >
          <span className="tr-row-dot" aria-hidden="true" />
          <span className="tr-resume-main">
            <b>{liveSession.label} in progress</b>
            {liveDay && <small>{liveDay.gyms.find((g) => g.id === gymIdFor(liveDay))?.name ?? "Tap to carry on"}</small>}
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
          autoStart={openDay.key === focus && focusStart && !openDay.startedAt && !openDay.endedAt}
        />,
        host
      )}

      {openDay && host && view?.screen === "workout" && createPortal(
        <WorkoutScreen
          key={openDay.key}
          day={openDay}
          gymId={gymIdFor(openDay)}
          onPickGym={(g) => pickGym(openDay, g)}
          coachName={coachName}
          clientName={clientName}
          focusExercise={openDay.key === focus ? focusExercise : null}
          onBack={() => setView({ dayId: openDay.key, screen: "overview" })}
          onEnded={() => {
            const minutes = openDay.startedAt ? Math.max(1, Math.round((Date.now() - Date.parse(openDay.startedAt)) / 60000)) : null;
            const sets = loggedSets(openDay);
            setView(null);
            setToast({ title: `${openDay.title} saved`, sub: `${minutes != null ? `${minutes} min · ` : ""}${sets} set${sets === 1 ? "" : "s"} · ${coachName} can see it now` });
          }}
          onDiscarded={() => setView({ dayId: openDay.key, screen: "overview" })}
        />,
        host
      )}
    </>
  );
}
