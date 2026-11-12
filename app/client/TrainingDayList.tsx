"use client";

import { Fragment, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bars } from "./Bars";
import { addFreeCardioAction, addFreeExerciseAction, createFreeSessionAction, duplicateSessionAction, removeFreeSessionAction } from "../lib/actions";
import { newOnceKey } from "../lib/onceKey";
import { applyWorkoutOutbox, clearNotSaved, enqueueWorkout, notSavedWords, useWorkoutOutbox } from "../components/workoutOutbox";
import GymPickerDialog, { type GymOption } from "./GymPickerDialog";
import SessionOverview, { STATUS_LABEL } from "./SessionOverview";
import WorkoutScreen from "./WorkoutScreen";
import { CopyIcon, PlusIcon } from "../components/icons";
import AddSessionSheet from "./AddSessionSheet";
import RingEdge from "../components/RingEdge";
import DoneCheck from "../components/DoneCheck";
import { askShown, VideoAskMark, VideoAskRow, VideoAskSheet } from "./VideoAskSheet";
import { useFocusRef, useNavigateTab, useOpenMessages, useTrainingFocus, type TrainingFocus } from "./CheckInContext";
import { clock, durationMinutes, elapsedMs, fresh, isDone, loggedSets, plannedSets, roundTo, sessionStatus, shortDate, shownName, useTicker, type LibraryPick, type SessionCardio, type SessionDay, type SessionExercise } from "./workoutShared";

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
  const merged = [...serverDays, ...(localFree && !serverDays.some((d) => d.key === localFree.key) ? [localFree] : [])]
    .filter((d) => !goneFree.includes(d.key))
    .map((d) => {
      const adds = freeAdds.filter((a) => a.dayId === d.key && !d.exercises.some((e) => e.id === a.ex.id)).map((a) => a.ex);
      const cardio = freeCardio.filter((a) => a.dayId === d.key && !d.cardio.some((c) => c.id === a.c.id)).map((a) => a.c);
      return adds.length || cardio.length ? { ...d, exercises: [...d.exercises, ...adds], cardio: [...d.cardio, ...cardio] } : d;
    });
  // What was logged and is still on its way (7 Nov, Alex: offline saving; workoutOutbox.ts) laid over the server's days,
  // so a reload, a refresh or a page the server built before it landed never snaps back: the sets, the swaps, the
  // cardio, the gym, the start, the end, a discard. After the rogue session's own rows, so its sets show on them too.
  const outbox = useWorkoutOutbox();
  const withFree = applyWorkoutOutbox(merged, outbox.overlay);
  const days = discardedHere == null ? withFree : withFree.map((d) => (masked(d) ? fresh(d) : d));
  // The session going, as the days say once what waits has landed: a start waiting makes it so, an end or a discard
  // waiting ends it.
  const liveSession = (() => {
    const live = (d: SessionDay) => !!d.startedAt && !d.endedAt;
    if (serverLive) {
      const here = days.find((d) => d.key === serverLive.id);
      return goneFree.includes(serverLive.id) || (here && !live(here)) ? null : serverLive;
    }
    const d = days.find(live);
    return d ? { id: d.key, label: d.title, startedAt: d.startedAt!, week: d.week } : null;
  })();
  const [view, setViewState] = useState<View>(null);
  // Put back from storage after a reload: shown in place, not slid in.
  const [restored, setRestored] = useState(false);
  const setView = (v: View) => {
    setRestored(false);
    setViewState(v);
    writeView(v);
  };
  // name: the session's (or "Changes"); dayId: whose saves it waits on. Read live against the outbox, so it says
  // "saved" with the done check only once the server has it, and "Not sent yet" while it waits.
  const [toast, setToast] = useState<{ name: string; dayId: number; facts: string[] } | null>(null);
  const toastWaiting = toast != null && outbox.entries.some((e) => e.dayId === toast.dayId);
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
  // The gym and the start go through the outbox (7 Nov, workoutOutbox.ts): drawn at once from the days it lays over,
  // kept on the phone until sent, in the order made (the gym before the sets it moves).
  const gymIdFor = (d: SessionDay) => d.gymId;
  const pickGym = (d: SessionDay, g: GymOption) => {
    const logged = loggedSets(d);
    const current = gymIdFor(d);
    if (logged > 0 && current != null && current !== g.id && !window.confirm(`Move the ${logged} set${logged === 1 ? "" : "s"} logged in this session to ${g.name}?`)) return;
    enqueueWorkout({ kind: "gym", gymId: g.id, dayId: d.key, startedAt: d.startedAt });
  };
  // Straight into the workout (14 Oct, Alex): the screen used to wait for the
  // server's answer, seconds on a phone, the whole page rebuilding behind it.
  // Now it opens at once with the start stamped here, signal or none (7 Nov);
  // the server takes the same stamp, and only a refusal (another session still
  // going) brings the overview back with the reason.
  const start = (d: SessionDay, g: GymOption | null) => {
    if (g) enqueueWorkout({ kind: "gym", gymId: g.id, dayId: d.key, startedAt: d.startedAt });
    const at = new Date().toISOString();
    setStartProblem(null);
    enqueueWorkout({ kind: "start", dayId: d.key, startedAt: at }, at);
    setView({ dayId: d.key, screen: "workout" });
  };
  // A start the server refused (another session still going): back to the overview with the reason, once, and the
  // row says what was not saved.
  const refusalsSeen = useRef<{ from: number; keys: Set<string> }>({ from: Infinity, keys: new Set() });
  useEffect(() => {
    refusalsSeen.current.from = Date.now();
  }, []);
  useEffect(() => {
    const seen = refusalsSeen.current;
    // Only one refused while this page is open; one kept from before is the row's to say.
    const n = outbox.notSaved.find((x) => x.start && Date.parse(x.at) >= seen.from && !seen.keys.has(`${x.dayId}|${x.at}`));
    if (!n) return;
    const t = setTimeout(() => {
      seen.keys.add(`${n.dayId}|${n.at}`);
      setStartProblem(`${notSavedWords(n)[1]}.`);
      if (view?.dayId === n.dayId && view.screen === "workout") setView({ dayId: n.dayId, screen: "overview" });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new refusal only
  }, [outbox.notSaved]);

  // A free session: made on the server, then straight into its workout, empty,
  // on its "Add an exercise" page. Refused while another session is going.
  const [freeBusy, setFreeBusy] = useState(false);
  // The start not yet seen through (6 Nov, one-time key): since useOffline its answer may land after the 10 s, so the
  // next tap sends its key again and a late landing and that tap are one session (a late start answers that session
  // again). Any answer ends it, and the tap after is a new key.
  const freeUnanswered = useRef<string | null>(null);
  const startFree = (gym: GymOption | null) => {
    if (freeBusy) return;
    const at = new Date().toISOString();
    const onceKey = freeUnanswered.current ?? newOnceKey();
    freeUnanswered.current = onceKey;
    setFreeBusy(true);
    setStartProblem(null);
    startTransition(async () => {
      try {
        // Never stuck on "Starting…" (19 Oct): an answer lost on the way (the
        // server restarting, the connection dropping) gives up after 10 s.
        const r = await Promise.race([
          // Any answer ends the key, a late one too (6 Nov, review): kept after a late start, a tap hours later would
          // have opened that session again instead of a new one. A late start shows as the session going.
          createFreeSessionAction(clientId, at, onceKey, gym?.id ?? null).then((answer) => {
            if (freeUnanswered.current === onceKey) freeUnanswered.current = null;
            return answer;
          }),
          new Promise<{ ok: false; other?: string }>((resolve) => setTimeout(() => resolve({ ok: false }), 10000)),
        ]).catch(() => ({ ok: false as const }));
        if (!r.ok) {
          setStartProblem("other" in r && r.other ? `Finish ${r.other} first.` : "Couldn't start a rogue session. Try again.");
          return;
        }
        if (freeUnanswered.current === onceKey) freeUnanswered.current = null;
        const like = serverDays.find((d) => !d.free) ?? serverDays[0];
        setLocalFree({ key: r.id, index: days.length + 1, week: like?.week ?? 1, title: "Rogue session", exercises: [], cardio: [], skipReason: "", startedAt: at, endedAt: null, sessionNote: "", questions: like?.questions ?? [], answers: {}, gyms: like?.gyms ?? (gym ? [gym] : []), gymId: gym?.id ?? null, free: true });
        setView({ dayId: r.id, screen: "workout" });
      } finally {
        setFreeBusy(false);
      }
    });
  };
  // The + under the week's sessions (9 Nov, Alex): a rogue session, or one of this week's again.
  const [adding, setAdding] = useState(false);
  const [rogueGym, setRogueGym] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [openWhenHere, setOpenWhenHere] = useState<{ id: number; gym: GymOption | null } | null>(null);
  // Duplicate (9 Nov, Alex): which session, which gym, then straight into the workout.
  const [copyGymFor, setCopyGymFor] = useState<number | null>(null);
  const chooseDuplicate = (key: number) => {
    setAdding(false);
    if (liveSession) {
      setStartProblem(`Finish ${liveSession.label} first.`);
      return;
    }
    const regular = (serverDays.find((d) => d.key === key)?.gyms ?? []).filter((g) => !g.once);
    if (regular.length === 1) void duplicate(key, regular[0]);
    else setCopyGymFor(key);
  };
  // An answer lost on the way keeps its key, so the next tap on that session and a late landing are one duplicate.
  const copyUnanswered = useRef<{ source: number; key: string } | null>(null);
  const duplicate = async (sourceKey: number, gym: GymOption | null) => {
    if (copyBusy) return;
    setCopyBusy(true);
    setStartProblem(null);
    const onceKey = copyUnanswered.current?.source === sourceKey ? copyUnanswered.current.key : newOnceKey();
    copyUnanswered.current = { source: sourceKey, key: onceKey };
    const r = await Promise.race([
      duplicateSessionAction(sourceKey, onceKey, serverDays.find((d) => d.key === sourceKey)?.title).then((answer) => {
        if (copyUnanswered.current?.key === onceKey) copyUnanswered.current = null;
        return answer;
      }),
      new Promise<{ ok: false }>((resolve) => setTimeout(() => resolve({ ok: false }), 10000)),
    ]).catch(() => ({ ok: false as const }));
    setCopyBusy(false);
    setAdding(false);
    if (!r.ok) {
      setStartProblem("Couldn't duplicate it. Try again.");
      return;
    }
    setOpenWhenHere({ id: r.id, gym });
  };
  // Opened the moment the page has it (the action reads the page again).
  useEffect(() => {
    const made = openWhenHere ? serverDays.find((d) => d.key === openWhenHere.id) : null;
    if (!openWhenHere || !made) return;
    // Never over something opened meanwhile.
    if (!view) start(made, openWhenHere.gym);
    setOpenWhenHere(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the page has it
  }, [openWhenHere, serverDays]);
  const freeAddLost = useRef<{ key: string; sent: string } | null>(null);
  /** An exercise into the open free session: drawn the moment the server gives it an id. */
  const addFree = async (dayId: number, pick: { exerciseId: number | null; name: string; group: string }): Promise<number | null> => {
    // Its one-time key, made as the row is tapped (6 Nov): sent again once the signal is back, or the same row tapped
    // again after `That didn't add`, it adds one. Only an answer lost on the way keeps it; an answer ends it.
    const sent = JSON.stringify([dayId, pick.exerciseId, pick.name, pick.group]);
    const onceKey = freeAddLost.current?.sent === sent ? freeAddLost.current.key : newOnceKey();
    freeAddLost.current = { key: onceKey, sent };
    const answered = <T,>(p: Promise<T>) =>
      p.then((v) => {
        freeAddLost.current = null;
        return v;
      });
    // Cardio (19 Oct): its own page, the client's numbers filled in there.
    if (pick.group === "cardio") {
      const cid = await answered(addFreeCardioAction(dayId, pick.name, onceKey));
      if (cid == null) return null;
      setFreeCardio((a) => [...a, { dayId, c: { id: cid, name: pick.name, time: "", pace: "", incline: "", distance: "", notes: "", done: false, swap: null, alternatives: [] } }]);
      return cid;
    }
    const id = await answered(addFreeExerciseAction(dayId, pick.exerciseId != null ? { exerciseId: pick.exerciseId } : { name: pick.name }, onceKey));
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
  const nextKey = currentWeek ? days.find((d) => !d.copy && sessionStatus(d, false) === "upcoming")?.key ?? null : null;

  const [host, setHost] = useState<HTMLElement | null>(null);
  // The finished session open in place, if any.
  const [expanded, setExpanded] = useState<number | null>(null);
  // The exercise whose photo or video (and the coach's reply) is open from that fold.
  const [videoFor, setVideoFor] = useState<SessionExercise | null>(null);

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
          // Kept on the phone and not sent yet (7 Nov): one grey fact after the bar. Refused by the server: in rust, what
          // and why, until the row is opened.
          const waiting = outbox.entries.some((e) => e.dayId === d.key);
          const refused = outbox.notSaved.find((n) => n.dayId === d.key) ?? null;
          return (
            <Fragment key={d.key}>
            <button
              type="button"
              className={`tr-row ${tone}${isOpen ? " open" : ""}`}
              onClick={() => {
                if (refused) clearNotSaved(d.key);
                if (ended) setExpanded((k) => (k === d.key ? null : d.key));
                else setView({ dayId: d.key, screen: d.free ? "workout" : "overview" });
              }}
              aria-expanded={ended ? isOpen : undefined}
            >
              <span className={`tr-row-tile ${tone}`}>
                {/* Done, the one done check (3 Nov, Alex), on the tile's page-colour disc so the spine stays hidden. */}
                {tone === "done" ? (
                  <DoneCheck size={32} />
                ) : (
                  <>
                    {d.index}
                    <RingEdge size={32} stroke={tone === "next" || tone === "live" ? 1.5 : 1} />
                  </>
                )}
              </span>
              <span className="tr-row-main">
                <span className="tr-row-title">
                  {d.title}
                  {d.copy && (
                    <span className="tr-row-copy" role="img" aria-label="Duplicate">
                      <CopyIcon />
                    </span>
                  )}
                </span>
                <span className="tr-row-sub">
                  <Bars parts={[...sub, waiting && "Not sent yet"]} />
                </span>
                {refused && (
                  <span className="tr-row-sub tr-row-refused" role="alert">
                    <Bars parts={notSavedWords(refused)} />
                  </span>
                )}
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
                      // What was sent and the coach's reply (12 Nov, Alex: B of docs/boards/workout-hidden-mockup.html):
                      // the mark at the row's end, the workout's own row under the sets, the same sheet. Only this
                      // session's own: a reply carried from an earlier session is not shown here.
                      const ask = askShown(ex.videoRequest, ex.swap != null, true) ? ex.videoRequest : null;
                      // The coach's marks on their own rows, here too (13 Nov, Alex: "icons… for like picture uploaded,
                      // personal bests"): from the left PB, sets added or taken off, the photo or video, the swap.
                      const pbs = new Set(ex.pbSets ?? []);
                      const extra = sets.filter((l) => l.setNumber > ex.sets).length;
                      const removed = ex.coachSets != null && ex.coachSets > ex.sets ? ex.coachSets - ex.sets : 0;
                      return (
                        <div key={ex.id} className={`tr-x-ex${isDone(ex) ? " done" : ""}`}>
                          <span className="tr-x-head">
                            <span className="tr-x-name">{shownName(ex)}</span>
                            {(pbs.size > 0 || extra > 0 || removed > 0 || ask || ex.swap) && (
                              <span className="tr-x-marks">
                                {pbs.size > 0 && <XMark kind="pb" label={pbs.size > 1 ? `${pbs.size} personal bests` : "Personal best"}>PB</XMark>}
                                {extra > 0 && <XMark kind="extra" label={`${extra} extra set${extra === 1 ? "" : "s"}`}>+{extra}</XMark>}
                                {removed > 0 && <XMark kind="removed" label={`${removed} set${removed === 1 ? "" : "s"} taken off`}>−{removed}</XMark>}
                                {ask && <VideoAskMark ask={ask} />}
                                {ex.swap && (
                                  <XMark kind="swap" label={`Instead of ${ex.name}`}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path vectorEffect="non-scaling-stroke" d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />
                                    </svg>
                                  </XMark>
                                )}
                              </span>
                            )}
                          </span>
                          {sets.length === 0 ? (
                            <span className="tr-x-none">Not logged</span>
                          ) : (
                            sets.map((l) => (
                              <span key={l.id} className="tr-x-set">
                                <span className="tr-x-n">
                                  <Bars parts={[`Set ${l.setNumber}`, l.setNumber > ex.sets && "Extra", pbs.has(l.setNumber) && <b key="pb" className="tr-x-pb">PB</b>]} />
                                </span>
                                <span className="tr-x-v">
                                  <Bars parts={[`${l.weight != null ? `${roundTo(l.weight, 2)} kg` : "–"} × ${l.reps ?? "–"}`, l.rpe != null && <small key="r">RPE {l.rpe}</small>]} />
                                </span>
                              </span>
                            ))
                          )}
                          {ask && (
                            <div className="lw so-video-past">
                              <VideoAskRow ask={ask} coachName={coachName} onOpen={() => setVideoFor(ex)} tabIndex={isOpen ? 0 : -1} />
                            </div>
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
          <button type="button" className="tr-row tr-free tr-add" onClick={() => setAdding(true)} disabled={freeBusy || copyBusy} aria-label="Add a session">
            <span className="tr-row-tile free" aria-hidden="true">
              <PlusIcon />
            </span>
          </button>
        )}
      </div>

      {adding && (
        <AddSessionSheet
          sessions={serverDays.filter((d) => !d.free && !d.copy).map((d) => ({ key: d.key, title: d.title, exercises: d.exercises.length, cardio: d.cardio.length }))}
          busy={freeBusy || copyBusy}
          onRogue={() => {
            setAdding(false);
            // Which gym, as a session asks (9 Nov, Alex: it counts there): one gym is no question.
            const place = serverDays.find((d) => !d.free) ?? null;
            const regular = (place?.gyms ?? []).filter((g) => !g.once);
            if (place && regular.length !== 1) setRogueGym(true);
            else startFree(regular[0] ?? null);
          }}
          onDuplicate={chooseDuplicate}
          onClose={() => !copyBusy && setAdding(false)}
        />
      )}

      {copyGymFor != null && (() => {
        const source = serverDays.find((d) => d.key === copyGymFor);
        return source ? (
          <GymPickerDialog
            gyms={source.gyms}
            gymId={source.gymId}
            mode="start"
            dayId={source.key}
            onPick={(g) => {
              setCopyGymFor(null);
              void duplicate(source.key, g);
            }}
            onClose={() => setCopyGymFor(null)}
          />
        ) : null;
      })()}

      {rogueGym && (() => {
        const place = serverDays.find((d) => !d.free);
        return place ? (
          <GymPickerDialog
            gyms={place.gyms}
            gymId={place.gymId}
            mode="start"
            dayId={place.key}
            onPick={(g) => {
              setRogueGym(false);
              startFree(g);
            }}
            onClose={() => setRogueGym(false)}
          />
        ) : null;
      })()}

      {videoFor && (
        <VideoAskSheet ask={videoFor.videoRequest} assignmentId={videoFor.id} exerciseName={shownName(videoFor)} coachName={coachName} onClose={() => setVideoFor(null)} />
      )}

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
            {/* The session's name alone on top, so it is never cut (3 Nov, Alex); `In progress | Trainmore` under it. */}
            {/* The list's own name for it when it is on this week's list, so the two always agree. */}
            <b>{liveDay?.title ?? liveSession.label}</b>
            <small>
              <Bars parts={["In progress", liveDay ? liveDay.gyms.find((g) => g.id === gymIdFor(liveDay))?.name : null]} />
            </small>
          </span>
          <span className="tr-resume-time">{clock(elapsedMs(liveSession.startedAt, null, now))}</span>
          <span className="tr-resume-chip">Resume</span>
        </button>,
        host
      )}

      {toast && host && createPortal(
        // Where the in-progress pill was, in its white hairline look (3 Nov, Alex): the done check drawn in its ring, what was
        // saved, its facts parted by bars.
        // Still on the phone (no signal yet): no check and no "saved", the fact says so; it turns once the server has it.
        <div className="tr-toast" role="status">
          {!toastWaiting && (
            <span className="tr-toast-check" aria-hidden="true">
              <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          )}
          <b className="tr-toast-title">{toastWaiting ? toast.name : `${toast.name} saved`}</b>
          {(toast.facts.length > 0 || toastWaiting) && (
            <small className="tr-toast-facts">
              <Bars parts={[...toast.facts, toastWaiting && "Not sent yet"]} />
            </small>
          )}
        </div>,
        host
      )}

      {openDay && host && view?.screen === "overview" && createPortal(
        <SessionOverview
          still={restored}
          day={openDay}
          pastWeek={pastWeek}
          currentWeek={currentWeek}
          liveElsewhere={liveSession && liveSession.id !== openDay.key ? liveSession.label : null}
          coachName={coachName}
          picture={headerPicture}
          onBack={() => {
            // A duplicate left without starting it is taken away: nothing was asked of it yet.
            if (openDay.copy && !openDay.startedAt && !openDay.endedAt) {
              dropFree(openDay.key);
              return;
            }
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
          day={openDay}
          editing={view.screen === "edit"}
          gymId={gymIdFor(openDay)}
          onPickGym={(g) => pickGym(openDay, g)}
          coachName={coachName}
          coachPhoto={coachPhoto}
          clientName={clientName}
          focusExercise={openDay.key === focus ? focusExercise : null}
          onBack={() => (openDay.free ? (openDay.exercises.length === 0 && openDay.cardio.length === 0 ? dropFree(openDay.key) : setView(null)) : setView({ dayId: openDay.key, screen: "overview" }))}
          library={library}
          onAddExercise={openDay.free ? (pick) => addFree(openDay.key, pick) : undefined}
          onEnded={() => {
            const minutes = openDay.startedAt ? Math.max(1, Math.round((Date.now() - Date.parse(openDay.startedAt)) / 60000)) : null;
            const sets = loggedSets(openDay);
            setView(null);
            // The facts alone, parted by bars (3 Nov, Alex: the hairline look; no sentence on who can see it).
            setToast({ name: openDay.title, dayId: openDay.key, facts: [...(minutes != null ? [`${minutes} min`] : []), `${sets} set${sets === 1 ? "" : "s"}`] });
          }}
          onDiscarded={() => {
            // A free session discarded is gone, not put back as unstarted.
            if (openDay.free || openDay.copy) {
              setGoneFree((g) => [...g, openDay.key]);
              if (localFree?.key === openDay.key) setLocalFree(null);
              setView(null);
              return;
            }
            if (openDay.startedAt) setDiscardedHere({ dayId: openDay.key, startedAt: openDay.startedAt });
            setView({ dayId: openDay.key, screen: "overview" });
          }}
          onEdited={() => {
            setView({ dayId: openDay.key, screen: "overview" });
            setToast({ name: "Changes", dayId: openDay.key, facts: [] });
          }}
        />,
        host
      )}
    </>
  );
}

/** A mark on a finished session's exercise (13 Nov, Alex), drawn as the coach's rows draw theirs: 22px rings, PB and a set
 *  added green, a set taken off rust, a swap grey (the client's amber is the warm-up's and the ask's alone); the photo or video is VideoAskMark beside them. */
function XMark({ kind, label, children }: { kind: "pb" | "extra" | "removed" | "swap"; label: string; children: ReactNode }) {
  return (
    <span className={`tr-xmark ${kind}`} role="img" aria-label={label} title={label}>
      {children}
      <RingEdge size={22} stroke={1.5} />
    </span>
  );
}
