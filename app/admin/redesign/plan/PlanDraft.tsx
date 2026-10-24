"use client";

import "./phase-dialog.css";
import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PHASE_OBJECTIVE_CHARS, PHASE_OBJECTIVES_MAX } from "../../../lib/phaseCovers";
import { FEATURES } from "../../../lib/features";
import Link from "next/link";
import { addClientGoalAction, addClientPhaseAction, applyGoalDoneChangesAction, cancelProgramScheduleAction, unschedulePhaseAction, duplicateClientPhaseAction, removeClientGoalAction, deletePhaseAction, reorderClientGoalsAction, saveAndDeployPhaseNowAction, saveAndSchedulePhaseOrSayWhyAction, updateClientGoalAction, updateClientPhaseAction } from "../../../lib/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { TRAINING_ICON } from "../../../lib/eventTypes";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import type { GoalEditorOptions, PlanGoalRow, PlanPhaseRow, PlanProgramOption } from "../../../lib/queries";
import type { GoalTracking } from "../../../lib/goalView";
import type { PhaseTrack } from "../../../lib/db";
import { phaseChrome, phaseStateOf, STATE_LABEL, stateTagStyle, TRACK_ACCENT, TRACK_LABEL } from "../../phaseChrome";
import { ConfirmDialog, DeletePhaseDialog } from "../training/TrainingDraft";
import Picker from "../Picker";
import DateText from "../DateText";
import DatePick from "../DatePick";
import { MonthRange } from "../MonthRange";
import { dayMonth } from "../../../lib/dayMonth";
import { phaseDays, phaseLengthLabel, phaseWeeks } from "../../../lib/phases";
import { SortableItem, SortableList } from "../Sortable";
import { Sep, SepJoin } from "../Sep";
import EventsCard, { type Category, type PlanEvent } from "./EventsCard";
import { useSaidSaved } from "../useSaveQueue";
import { AddCells, EmptyLane, gridFor, LaneRow, packLanes, PhaseBar, rgbOf, Timeline, weekSpan, weeksBetween } from "./timelineParts";

// The calmer Plan tab, as a draft on real data, in the Training draft's
// sheet. Three cards: the one headline goal, the phases as bars on a week
// grid, and the goals as a table with their live standing.
//
// - Phases: months and weeks across, one row a track; a bar's edges drag to
//   change its length, its body drags to move it, a click opens it. A phase
//   wears its state's colour (phaseChrome): live in its track's, scheduled
//   blue, a draft peach and dashed. "+ Add phase" opens the same dialog.
// - Goals: one row a goal, its live figure, how far it is, what it tracks
//   and where it was set. Done-ticks and a dragged order queue on the
//   card's bar until Apply. Adding or editing a goal opens the tracker.
// Real, not a draft: everything here saves through the same actions as
// the old Plan tab and the page re-reads.

export type DraftPlan = {
  today: string;
  thisWeek: string;
  /** How far through this week it is, 0 to 1, from the server so both renders agree. */
  intoWeek: number;
  currentPhaseName: string | null;
  phases: PlanPhaseRow[];
  programs: PlanProgramOption[];
  goals: PlanGoalRow[];
  goalOptions: GoalEditorOptions;
  mainGoal: string;
  mainGoalSavedAt: string | null;
  events: PlanEvent[];
  eventCategories: Category[];
  /** The faces for an event's "Added by" (24 Oct, Alex): the client's photo, and the coach's for "you". */
  faces: { client: string | null; coach: string | null; coachName: string };
};

const savedToast = (what: string) => toast.success("Saved", { description: what });
/** A phase's fields as the actions read them. */
export const phaseForm = (v: { id?: number; clientId?: number; name: string; track: PhaseTrack; start: string; end: string; programId?: number | null; /** The dialog's Phase goals (19 Oct): sent only when given, so other forms leave them be. */ goals?: string[] }) => {
  const fd = new FormData();
  if (v.id != null) fd.set("id", String(v.id));
  if (v.clientId != null) fd.set("clientId", String(v.clientId));
  fd.set("track", v.track);
  fd.set("name", v.name);
  fd.set("start", v.start);
  fd.set("end", v.end);
  // start and end here are a phase's stored values (first day, last day
  // minus 6); the server snaps them to whole weeks on every track (21 Oct).
  if (v.track !== "training") {
    fd.set("firstDay", v.start);
    fd.set("lastDay", addDays(v.end, 6));
  } else {
    // A training phase is its programme (4 Oct): a new length here gives the
    // programme as many weeks (empty ones added, unlogged ones taken off the
    // end), so Plan and Training never disagree about when it ends.
    fd.set("adjustProgram", "1");
  }
  if (v.programId != null) fd.set("programId", String(v.programId));
  // Phase goals off (23 Oct, Alex): never sent, so the stored ones stay as they are.
  if (v.goals && FEATURES.phaseGoals) {
    fd.set("objectivesSent", "1");
    for (const g of v.goals) fd.append("objectives", g);
  }
  return fd;
};
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return isoOf(x);
};
const addWeeks = (monday: string, n: number) => addDays(monday, n * 7);
const mondayOf = (d: string) => addDays(d, -((parse(d).getDay() + 6) % 7));
/** A date in words is day/month (20 Oct, Alex: "starts 9/11", not "starts 9 Nov"); a year only when it isn't this one. */
const shortDate = dayMonth;
const fmtDay = shortDate;
const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

/** Lifestyle, Training, Nutrition (20 Oct, Alex): the order of the lanes, the track tiles and the client's tabs. */
const TRACKS: { id: PhaseTrack; label: string }[] = [
  { id: "lifestyle", label: "Lifestyle" },
  { id: "training", label: "Training" },
  { id: "nutrition", label: "Nutrition" },
];
// The track tiles in the New phase dialog (10 Oct), laid out like the client's
// New event sheet: an icon on a tinted tile, the chosen one filled.
const TRACK_ICON: Record<PhaseTrack, string> = {
  nutrition: "M15.5 8.5c2.8 0 4.5 2.4 4.5 5.5 0 4-2.7 7.5-5.5 7.5-1 0-1.5-.5-2.5-.5s-1.5.5-2.5.5c-2.8 0-5.5-3.5-5.5-7.5 0-3.1 1.9-5.5 4.7-5.5 1.3 0 2.1.6 3.3.6s1.9-.6 3.5-.6ZM12 8.5V6a2.2 2.2 0 0 1 2-2.2",
  training: TRAINING_ICON,
  lifestyle: "M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z",
};
export function TrackIcon({ track, size = 20 }: { track: PhaseTrack; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRACK_ICON[track]} />
    </svg>
  );
}
// How far ahead the grid shows, in months; each a whole number of weeks.
export const WINDOWS = [
  { months: 3, weeks: 13 },
  { months: 6, weeks: 26 },
  { months: 9, weeks: 39 },
  { months: 12, weeks: 52 },
] as const;
export type Win = (typeof WINDOWS)[number]["weeks"];
const WIN_KEY = "rq-plan-window";
/** The Goals card is off the Plan tab for now (20 Oct, Alex). True brings it back as it was. */
const SHOW_GOALS = false;
const KIND_LABEL: Record<PlanGoalRow["kind"], string> = { metric: "Metric", exercise: "Exercise", habit: "Habit", none: "Text" };

type Dlg = { kind: "phase"; phase: PlanPhaseRow | null; track?: PhaseTrack; /** A new phase from an empty week clicked on its lane. */ start?: string } | { kind: "move"; id: number; start: string; end: string } | { kind: "deletePhase"; id: number } | { kind: "goal"; goal: PlanGoalRow | null } | { kind: "removeGoal"; id: number } | null;

export default function PlanDraft({ clientId, firstName, plan }: { clientId: number; firstName: string; plan: DraftPlan }) {
  const { today, thisWeek, intoWeek } = plan;
  const router = useRouter();
  const [planSaving, start] = useTransition();
  // The Events card's saves too, for the one status beside the title (21 Oct, Alex).
  const [eventsSaving, setEventsSaving] = useState(false);
  const saidSaved = useSaidSaved(planSaving || eventsSaving);
  // Every save goes to the server, then the page re-reads; what is on screen
  // is a working copy that follows the server's answer.
  const act = (fn: () => Promise<unknown>, said?: string) =>
    start(async () => {
      await fn();
      router.refresh();
      if (said) savedToast(said);
    });
  // The Main goal card went from this tab (10 Oct): it was not used. The goal itself stays on the client (Home shows it) and in the data.

  // ---- Phases: what is on screen lives here, so a drag shows what it would do.
  const [phases, setPhases] = useState(plan.phases);
  // Compared by content: every refresh hands in new objects with the same
  // values, and resetting on those collapsed panels and threw work away.
  const phasesKey = JSON.stringify(plan.phases);
  const [seenPhases, setSeenPhases] = useState(phasesKey);
  if (seenPhases !== phasesKey) {
    setSeenPhases(phasesKey);
    setPhases(plan.phases);
  }
  // How far ahead the grids show. Remembered in the browser (a view
  // preference, like Training's columns), so a save, a refresh or a reload
  // leaves the coach on the 6 or 12 months they chose rather than back on 3.
  const [win, setWinState] = useState<Win>(13);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(WIN_KEY));
      if (WINDOWS.some((w) => w.weeks === saved)) setWinState(saved as Win);
    } catch {}
  }, []);
  const setWin = (w: Win) => {
    setWinState(w);
    try {
      window.localStorage.setItem(WIN_KEY, String(w));
    } catch {}
  };
  const [dlg, setDlg] = useState<Dlg>(null);
  const close = () => setDlg(null);
  const [drag, setDrag] = useState<{ id: number; edge: "start" | "end" | "move"; start: string; end: string; moved: boolean; origStart: string; origEnd: string; anchor: string | null } | null>(null);
  const justDragged = useRef(false);
  const areaRef = useRef<HTMLDivElement>(null);

  // The window: last week for context, this week in the second column, and
  // most of the grid what is coming. "Now" is one fixed line a week and a
  // half in; the weeks slide under it as the week goes by.
  // Last week behind now (a week and a half with where today sits), so a phase that just ended stays on the
  // timeline and drifts off as the weeks go by. The arrows step back into the past a month at a time
  // (21 Oct, Alex: a past phase that clashed was nowhere to be seen); Today comes back.
  const [back, setBack] = useState(0);
  // The grid for this window (the maths in gridFor, shared with the Events card, which has a window of its own since 10 Oct).
  const grid = gridFor(win, thisWeek, intoWeek, back);
  const { first, count, weeks } = grid;

  const weekAt = (clientX: number) => {
    const el = areaRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return weeks[Math.max(0, Math.min(count - 1, Math.floor(((clientX - r.left) / r.width) * count)))];
  };
  const beginDrag = (e: React.PointerEvent, p: PlanPhaseRow, edge: "start" | "end" | "move") => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: p.id, edge, start: p.start_week, end: p.end_week, moved: false, origStart: p.start_week, origEnd: p.end_week, anchor: edge === "move" ? weekAt(e.clientX) : null });
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const w = weekAt(e.clientX);
    if (!w) return;
    setDrag((d) => {
      if (!d) return d;
      let next = d;
      if (d.edge === "move" && d.anchor) {
        const delta = weeksBetween(d.anchor, w);
        next = { ...d, start: addWeeks(d.origStart, delta), end: addWeeks(d.origEnd, delta) };
      } else if (d.edge === "start") next = { ...d, start: w <= d.end ? w : d.end };
      else next = { ...d, end: w >= d.start ? w : d.start };
      return { ...next, moved: next.start !== d.start || next.end !== d.end || d.moved };
    });
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    const p = phases.find((x) => x.id === drag.id);
    const d = drag;
    setDrag(null);
    if (d.moved) {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 300);
    }
    if (!p || (d.start === p.start_week && d.end === p.end_week)) return;
    setDlg({ kind: "move", id: p.id, start: d.start, end: d.end });
  };
  // The weeks a phase is drawn at: the drag's while it is dragged, the move's while it waits for a yes, else its own.
  const liveWeeks = (p: PlanPhaseRow) => {
    const live = drag?.id === p.id ? drag : dlg?.kind === "move" && dlg.id === p.id ? dlg : null;
    return { startWeek: live ? live.start : p.start_week, endWeek: live ? live.end : p.end_week };
  };
  // The columns its first and last day fall in (weekSpan): a phase that starts or ends mid-week fills the weeks it touches.
  const spanOf = (p: PlanPhaseRow) => {
    const w = liveWeeks(p);
    return weekSpan(w.startWeek, w.endWeek, first, count);
  };

  // ---- Goals: done-ticks and a dragged order queue until Apply.
  const [goals, setGoals] = useState(plan.goals);
  const goalsKey = JSON.stringify(plan.goals);
  const [seenGoals, setSeenGoals] = useState(goalsKey);
  if (seenGoals !== goalsKey) {
    setSeenGoals(goalsKey);
    setGoals(plan.goals);
  }
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [pendingDone, setPendingDone] = useState<Record<number, boolean>>({});
  const [order, setOrder] = useState<number[] | null>(null);
  const doneOf = (g: PlanGoalRow) => pendingDone[g.id] ?? g.done;
  const toggleDone = (g: PlanGoalRow) =>
    setPendingDone((p) => {
      const next = { ...p };
      const want = !doneOf(g);
      if (want === g.done) delete next[g.id];
      else next[g.id] = want;
      return next;
    });
  const ordered = order ? [...goals].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : goals;
  const shown = ordered.filter((g) => (filter === "all" ? true : pendingDone[g.id] != null ? true : filter === "done" ? g.done : !g.done));
  const goalChanges = Object.keys(pendingDone).length + (order ? 1 : 0);
  // A drop reorders the goals on screen; ones the filter hides keep their places.
  const moveGoals = (ids: (number | string)[]) => {
    const queue = [...ids] as number[];
    const onScreen = new Set(queue);
    const next = ordered.map((g) => (onScreen.has(g.id) ? queue.shift()! : g.id));
    setOrder(next.every((id, i) => id === goals[i]?.id) ? null : next);
  };

  // Only the goal's words flex; every figure column is a fixed width, so the
  // columns line up as columns and the gaps between them read the same.
  const gGrid = { gridTemplateColumns: "20px 24px minmax(240px, 1fr) 180px 110px 150px 80px 32px", columnGap: 16 } as const;
  const openCount = goals.filter((g) => !g.done).length;

  return (
    // pln: the Plan tab in the admin's hairline language (20 Oct), scoped in plan.css as trn is for Training.
    <div className="rd pln">
      {/* ---- Header. */}
      <header className="rd-head bare">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Plan</span>
          <h1 className="rd-title">
            {firstName}&rsquo;s plan
            {/* Every change saves as it is made; the status beside the title (21 Oct, Alex), as on Training, Lifestyle and Nutrition. */}
            {/* Nothing until something is saved (22 Oct, Alex). */}
            {saidSaved && (
              <span className={`pln-allsaved${planSaving || eventsSaving ? " saving" : ""}`} role="status">
                {planSaving || eventsSaving ? "Saving…" : "All changes saved"}
              </span>
            )}
          </h1>
        </div>
      </header>

      {/* ---- Phases. */}
      {/* As Training's weeks (20 Oct, Alex): the heading and its controls on the page, the timeline in a white card under them. */}
      <section className="pln-section">
        <div className="rn-card-head">
          <h2>Phases</h2>
          <div className="rq-ev-tools">
            <div className="rq-pan" role="group" aria-label="Move the phases in time">
              <button type="button" className="rd-btn ghost" onClick={() => setBack((b) => b + 4)} aria-label="Earlier" title="Earlier">
                <ChevronLeftIcon />
              </button>
              {/* Always there (21 Oct, Alex), so the arrows never move under the pointer; at today it rests, greyed. */}
              <button type="button" className="rd-btn ghost rq-today" disabled={back === 0} onClick={() => setBack(0)}>
                Today
              </button>
              <button type="button" className="rd-btn ghost" disabled={back === 0} onClick={() => setBack((b) => Math.max(0, b - 4))} aria-label="Later" title="Later">
                <ChevronRightIcon />
              </button>
            </div>
            <div className="rd-btn-group" role="group" aria-label="Time shown">
              {WINDOWS.map((w) => (
                <button key={w.weeks} type="button" className={win === w.weeks ? "on" : ""} aria-pressed={win === w.weeks} onClick={() => setWin(w.weeks)}>
                  {w.months} months
                </button>
              ))}
            </div>
            <button type="button" className="rd-btn" onClick={() => setDlg({ kind: "phase", phase: null })}>
              <PlusIcon /> Add
            </button>
          </div>
        </div>
        <div className="pln-card">
          {/* The timeline is plan/timelineParts.tsx, as on the Phases screen: months over weeks, the NOW line, a row of lanes a track. */}
          <Timeline grid={grid} onStep={(n) => setBack((b) => Math.max(0, b - n))}>
            {TRACKS.map((t) => {
              const mine = phases.filter((p) => p.track === t.id).sort((a, b) => (a.start_week < b.start_week ? -1 : 1));
              // Phases that share a week column on one track stack into lanes, judged by the columns they are drawn in.
              // Only the bars drawn take a lane: a phase outside the window used to hold an empty lane nobody could see (7 Oct).
              const drawn = mine.filter((p) => spanOf(p).visible);
              const lanes = packLanes(drawn, (p) => {
                const sp = spanOf(p);
                return { from: sp.sc, to: sp.ec };
              });
              return (
                // The track's icon in its colour, its name in ink (20 Oct, Alex): no tinted pill.
                <LaneRow key={t.id} grid={grid} lanes={lanes.count} icon={<TrackIcon track={t.id} size={16} />} color={TRACK_ACCENT[t.id]} label={t.label} gridRef={t.id === "nutrition" ? areaRef : undefined} onDragMove={moveDrag} onDragEnd={endDrag}>
                  {/* An empty week on a lane is a way in (20 Oct, Alex): a click opens New phase on this track, from that week. */}
                  <AddCells
                    grid={grid}
                    lanes={lanes.count}
                    label={(w) => `New ${t.label.toLowerCase()} phase from ${shortDate(w)}`}
                    title={(w) => `${t.label} · ${shortDate(w)}`}
                    onAdd={(w) => {
                      if (drag || justDragged.current) return;
                      setDlg({ kind: "phase", phase: null, track: t.id, start: w });
                    }}
                  />
                  {mine.length === 0 && <EmptyLane grid={grid} onAdd={() => setDlg({ kind: "phase", phase: null, track: t.id })} />}
                  {drawn.map((p) => {
                    // A programme the client has trained on keeps its start: it doesn't move, and only its end stretches.
                    const trained = !!p.program && p.program.loggedWeeks.length > 0;
                    return (
                      <PhaseBar
                        key={p.id}
                        phase={{ id: p.id, name: p.name, track: p.track, startWeek: p.start_week, endWeek: p.end_week, draft: p.draft || p.program?.status === "draft", gap: p.gap }}
                        at={liveWeeks(p)}
                        grid={grid}
                        row={lanes.laneOf.get(p.id) ?? 0}
                        today={today}
                        thisWeek={thisWeek}
                        intoWeek={intoWeek}
                        keyboard={false}
                        drag={{ dragging: drag?.id === p.id, onBody: trained ? undefined : (e) => beginDrag(e, p, "move"), onStart: trained ? undefined : (e) => beginDrag(e, p, "start"), onEnd: (e) => beginDrag(e, p, "end") }}
                        onOpen={() => {
                          if (justDragged.current || drag) return;
                          setDlg({ kind: "phase", phase: p });
                        }}
                      />
                    );
                  })}
                </LaneRow>
              );
            })}
          </Timeline>
        </div>
      </section>

      {/* ---- Events: life around the plan, on the same weeks. */}
      <EventsCard clientId={clientId} firstName={firstName} faces={plan.faces} events={plan.events} categories={plan.eventCategories} today={today} thisWeek={thisWeek} intoWeek={intoWeek} windows={WINDOWS} onSaving={setEventsSaving} />

      {/* ---- Goals: off the Plan tab for now (20 Oct, Alex); the code stays for when they come back. */}
      {SHOW_GOALS && (
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>Goals</h2>
          <div className="rd-btn-group" role="group" aria-label="Which goals">
            {(["open", "done", "all"] as const).map((f) => (
              <button key={f} type="button" className={filter === f ? "on" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "open" ? (
                  <>
                    Open
                    {openCount ? (
                      <>
                        <Sep />
                        {openCount}
                      </>
                    ) : null}
                  </>
                ) : f === "done" ? (
                  "Done"
                ) : (
                  "All"
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="rd-rows">
          {shown.length > 0 && (
            <div className="rd-cols" aria-hidden="true" style={gGrid}>
              <span />
              <span />
              <span>Goal</span>
              <span>Tracks</span>
              <span>Live</span>
              <span>By</span>
              <span>Set</span>
              <span />
            </div>
          )}
          {shown.length === 0 && <p className="rd-full">{filter === "done" ? "None done" : "None yet"}</p>}
          <SortableList ids={shown.map((g) => g.id)} label="goal" onMove={moveGoals}>
          {shown.map((g) => {
            const isDone = doneOf(g);
            const queued = pendingDone[g.id] != null;
            const textOnly = g.kind === "none";
            return (
              <SortableItem key={g.id} id={g.id} className={`rd-row${isDone ? " done" : ""}${g.id < 0 ? " new" : ""}`}>
                {(goalGrip) => (
                <div className="rd-row-main static" style={gGrid}>
                  <span className="rd-grip" {...goalGrip}>
                    ⋮⋮
                  </span>
                  {/* One mark for every goal: done, on track, off track, or (text goals) simply open. Marking done lives in the row's menu. */}
                  <span>
                    <i className={`rq-mark ${isDone ? "done" : textOnly ? "" : g.tone === "green" ? "on" : "off"}${queued ? " queued" : ""}`} title={isDone ? "Done" : textOnly ? "Open" : g.tone === "green" ? "On track" : "Not on track yet"} />
                  </span>
                  <span className="rd-ex">
                    <span className="rd-ex-name">
                      <button type="button" className="rd-ex-btn" onClick={() => setDlg({ kind: "goal", goal: g })} title="Edit this goal">
                        {g.text}
                      </button>
                    </span>
                  </span>
                  {/* The thing watched, by name; a plain goal watches nothing. */}
                  <span className={`rq-tracks${textOnly ? " none" : ""}`} title={textOnly ? "Closed by hand" : g.rule}>
                    {textOnly ? "—" : g.tracks ?? KIND_LABEL[g.kind]}
                  </span>
                  <span className={`rq-live ${textOnly ? "none" : g.tone}`}>{textOnly ? "—" : g.live || "—"}</span>
                  {/* The deadline, and whether they will make it: what the coach actually asks. */}
                  <span className={`rq-by${textOnly ? " none" : ""}`}>
                    {textOnly ? "—" : g.by ?? "—"}
                    {!textOnly && !isDone && g.pace && <small className={g.tone}>{g.pace}</small>}
                  </span>
                  {/* When it was set: the meeting's day if it came from one, else the day it was added. */}
                  <span className="rq-set">{g.setIn ? shortDate(g.setIn.date) : g.setDate ? shortDate(g.setDate.slice(0, 10)) : "—"}</span>
                  <span className="rd-row-more">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${g.text}`}>
                        <MoreIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="pb-menu">
                        <DropdownMenuItem onSelect={() => setDlg({ kind: "goal", goal: g })}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => toggleDone(g)}>{isDone ? "Reopen" : "Mark done"}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "removeGoal", id: g.id })}>
                          <TrashIcon /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
                )}
              </SortableItem>
            );
          })}
          </SortableList>
          <button type="button" className="rd-session add rm-additem" onClick={() => setDlg({ kind: "goal", goal: null })}>
            + Add
          </button>
          {goalChanges > 0 && (
            <div className="rd-pending">
              <span className="rd-pending-count">{goalChanges}</span>
              <span className="rd-pending-text">
                <SepJoin parts={[...(order ? ["order changed"] : []), ...Object.entries(pendingDone).map(([id, d]) => `${goals.find((g) => g.id === Number(id))?.text ?? "goal"} ${d ? "marked done" : "reopened"}`)]} />
              </span>
              <button
                type="button"
                className="rd-pending-ghost"
                onClick={() => {
                  setPendingDone({});
                  setOrder(null);
                }}
              >
                Discard
              </button>
              <button
                type="button"
                className="rd-pending-apply"
                onClick={() => {
                  const ticks = Object.entries(pendingDone).map(([id, done]) => ({ id: Number(id), done }));
                  const newOrder = order ? ordered.map((g) => g.id) : null;
                  const n = goalChanges;
                  setGoals(ordered.map((g) => ({ ...g, done: pendingDone[g.id] ?? g.done, pct: (pendingDone[g.id] ?? g.done) ? 100 : g.pct })));
                  setPendingDone({});
                  setOrder(null);
                  act(async () => {
                    if (ticks.length) await applyGoalDoneChangesAction(ticks);
                    if (newOrder) await reorderClientGoalsAction(clientId, newOrder);
                  }, `Goals: ${n} ${n === 1 ? "change" : "changes"}`);
                }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </section>
      )}

      {/* ---- Dialogs. One open at a time. */}
      <Dialog open={dlg != null} onOpenChange={(o) => !o && close()}>
        {dlg?.kind === "phase" && (
          <PhaseDialog
            clientId={clientId}
            firstName={firstName}
            today={today}
            thisWeek={thisWeek}
            phase={dlg.phase}
            track={dlg.track}
            initialStart={dlg.start}
            others={phases}
            programs={plan.programs}
            onDelete={dlg.phase ? () => setDlg({ kind: "deletePhase", id: dlg.phase!.id }) : undefined}
            onUnschedule={
              dlg.phase
                ? () => {
                    const p = dlg.phase!;
                    close();
                    // A training phase's programme carries its schedule; any other phase is itself the draft again.
                    act(async () => {
                      if (p.program) {
                        const f = new FormData();
                        f.set("programId", String(p.program.id));
                        await cancelProgramScheduleAction(f);
                      } else await unschedulePhaseAction(p.id);
                    }, `${p.name} is a draft again`);
                  }
                : undefined
            }
            onDuplicate={
              dlg.phase
                ? () => {
                    const p = dlg.phase!;
                    close();
                    act(() => duplicateClientPhaseAction(p.id), `${p.name} copied as a new draft, from next Monday${p.track === "training" ? " (pick or build its programme)" : ""}`);
                  }
                : undefined
            }
            onSave={(v) => {
              const was = dlg.phase;
              close();
              if (was) {
                setPhases((prev) => prev.map((p) => (p.id === was.id ? { ...p, name: v.name, start_week: v.start, end_week: v.end } : p)));
                act(() => updateClientPhaseAction(phaseForm({ id: was.id, ...v })), `${v.name}: ${shortDate(v.start)} – ${shortDate(addDays(v.end, 6))}`);
              } else {
                act(() => addClientPhaseAction(phaseForm({ clientId, ...v })), `${v.name} drafted on ${TRACK_LABEL[v.track]}: ${shortDate(v.start)} – ${shortDate(addDays(v.end, 6))}`);
              }
            }}
            onSend={(v) => {
              const was = dlg.phase;
              close();
              if (!was) return;
              const fd = phaseForm({ id: was.id, ...v });
              if (v.now)
                // Live, or why not (5 Oct: a blocked one used to say "is live" anyway).
                start(async () => {
                  const why = await saveAndDeployPhaseNowAction(fd);
                  router.refresh();
                  if (why) toast.error(`${v.name} isn't live yet`, { description: why });
                  else savedToast(`${v.name} is live`);
                });
              else
                // Scheduled, or why not (20 Oct: an empty one said "scheduled" anyway).
                start(async () => {
                  const why = await saveAndSchedulePhaseOrSayWhyAction(fd);
                  router.refresh();
                  if (why) toast.error(`${v.name} isn't scheduled yet`, { description: why });
                  else savedToast(`${v.name} scheduled for ${fmtDay(v.start)}`);
                });
            }}
          />
        )}
        {dlg?.kind === "move" && phases.find((p) => p.id === dlg.id) && <MoveDialog phase={phases.find((p) => p.id === dlg.id)!} start={dlg.start} end={dlg.end} today={today} onCancel={close} onSave={() => {
          const p = phases.find((x) => x.id === dlg.id)!;
          setPhases((prev) => prev.map((x) => (x.id === dlg.id ? { ...x, start_week: dlg.start, end_week: dlg.end } : x)));
          close();
          act(() => updateClientPhaseAction(phaseForm({ id: p.id, name: p.name, track: p.track, start: dlg.start, end: dlg.end })), `${p.name}: ${shortDate(dlg.start)} – ${shortDate(addDays(dlg.end, 6))}`);
        }} />}
        {/* Training's delete pop-up (20 Oct): a tick first when the client's logged sessions go with the programme. */}
        {dlg?.kind === "deletePhase" && phases.find((p) => p.id === dlg.id) && (
          <DeletePhaseDialog
            name={phases.find((p) => p.id === dlg.id)!.name}
            logged={phases.find((p) => p.id === dlg.id)!.program?.loggedWeeks.length ?? 0}
            firstName={firstName}
            onClose={close}
            onDelete={() => {
              const id = dlg.id;
              setPhases((prev) => prev.filter((p) => p.id !== id));
              close();
              act(() => deletePhaseAction(id), "Phase deleted");
            }}
          />
        )}
        {dlg?.kind === "goal" && (
          <GoalDialog
            firstName={firstName}
            goal={dlg.goal}
            options={plan.goalOptions}
            phases={phases}
            today={today}
            onSave={(v) => {
              const was = dlg.goal;
              close();
              const fd = new FormData();
              fd.set("text", v.text);
              if (v.tracking) fd.set("tracking", JSON.stringify(v.tracking));
              if (was) fd.set("id", String(was.id));
              else fd.set("clientId", String(clientId));
              act(() => (was ? updateClientGoalAction(fd) : addClientGoalAction(fd)), `Goal: ${v.text}`);
            }}
          />
        )}
        {dlg?.kind === "removeGoal" && (
          <ConfirmDialog
            title={`Remove ${goals.find((g) => g.id === dlg.id)?.text ?? "this goal"}?`}
            description="This permanently deletes the goal. It can't be undone."
            confirm="Remove"
            danger
            onConfirm={() => {
              const id = dlg.id;
              setGoals((prev) => prev.filter((g) => g.id !== id));
              close();
              const fd = new FormData();
              fd.set("id", String(id));
              act(() => removeClientGoalAction(fd), "Goal removed");
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

// ---- The phase dialog: track, name, dates on a month, and for training the programme behind it.

/** The month a phase's dates are picked on: the one calendar in the admin, in its own module (MonthRange.tsx) since 21 Oct; still exported from here for its callers. */
export { MonthRange };
/** The week grid's maths, in the timeline's own module (timelineParts.tsx) since 21 Oct; still exported from here for their callers. */
export { gridFor, weeksBetween };

export function PhaseDialog({ clientId, firstName, today, thisWeek, phase, track: initialTrack, lockTrack = false, initialStart, others, programs, onSave, onDelete, onDuplicate, onSend, onUnschedule }: { clientId: number; firstName: string; /** A scheduled phase back to a draft (its state tag's menu). */ onUnschedule?: () => void; today: string; thisWeek: string; phase: PlanPhaseRow | null; track?: PhaseTrack; /** A new phase opens on this day (the Phases overview: the day after the one ending). */ initialStart?: string; /** Opened from a track's own tab (10 Oct): the track is given, so no tiles to pick one. */ lockTrack?: boolean; others: PlanPhaseRow[]; programs: PlanProgramOption[]; onSave: (v: { name: string; track: PhaseTrack; start: string; end: string; programId: number | null; goals: string[] }) => void; onDelete?: () => void; /** A copy of this phase as a new draft (a past one, to run again). */ onDuplicate?: () => void; onSend: (v: { name: string; track: PhaseTrack; start: string; end: string; now: boolean; goals: string[] }) => void }) {
  const editing = !!phase;
  // The phase's goals (19 Oct), one a line, the same three the tab's Goals pill edits.
  // Three slots, as the client's Home shows them under the phase (20 Oct, Alex); folded behind its chevron until opened.
  const [goalRows, setGoalRows] = useState<string[]>(() => Array.from({ length: PHASE_OBJECTIVES_MAX }, (_, i) => phase?.objectives?.[i] ?? ""));
  const [goalsOpen, setGoalsOpen] = useState(false);
  const goalLines = goalRows.map((g) => g.trim().slice(0, PHASE_OBJECTIVE_CHARS)).filter(Boolean);
  const [track, setTrack] = useState<PhaseTrack>(phase?.track ?? initialTrack ?? "nutrition");
  const [name, setName] = useState(phase?.name ?? "");
  // Whole weeks on every track (21 Oct, Alex): a phase saved on other days before opens on its weeks.
  const [from, setFrom] = useState(mondayOf(phase?.start_week ?? initialStart ?? thisWeek));
  // The Sunday of the week its last day falls in: rounded up, never cut short.
  const [to, setTo] = useState(addDays(mondayOf(phase ? addDays(phase.end_week, 6) : addDays(addWeeks(initialStart ?? thisWeek, 3), 6)), 6));
  // Opens on this month; a phase still to come opens on the month it starts.
  const [cursor, setCursor] = useState((from > today ? from : today).slice(0, 7));
  const [picking, setPicking] = useState<"start" | "end">("start");
  // What is being typed into the weeks field; null shows the span the dates make.
  const [weeksText, setWeeksText] = useState<string | null>(null);
  const [programChoice, setProgramChoice] = useState<string>(phase?.program ? String(phase.program.id) : "new");
  // A live programme starts on the week it went out, where the client began it: only the end moves.
  const startLocked = !!phase?.program && phase.program.status === "live";
  const isDraft = !phase ? true : phase.draft || phase.program?.status === "draft";
  // Every phase runs in Monday-to-Sunday weeks (21 Oct, Alex: nutrition and
  // lifestyle too, as training always did). What is saved is the Monday of
  // the first week and of the last (see ClientPhase).
  const startWeek = mondayOf(from);
  const endWeek = mondayOf(to);
  const state = phaseStateOf({ draft: isDraft, startWeek, endWeek, today });
  const chrome = phaseChrome(track, state);
  const weeks = phaseWeeks(startWeek, endWeek);
  const planned = others.filter((o) => o.track === track && o.id !== phase?.id).map((o) => ({ name: o.name, from: o.start_week, to: addDays(o.end_week, 6), draft: o.draft || o.program?.status === "draft" }));
  // Against the days that will be saved, so a training phase is checked by its whole weeks.
  const savedTo = addDays(endWeek, 6);
  // What can block (21 Oct, Alex: a live phase's end wouldn't move): only phases planned for real, not drafts
  // (a draft is checked when it is scheduled); and when the start is locked (a live programme), only those
  // after it: a clash at a start that can't move is history, not something the coach can fix here.
  const blocking = planned.filter((p) => !p.draft && (!startLocked || p.from > startWeek));
  const overlap = blocking.find((p) => p.from <= savedTo && p.to >= startWeek) ?? null;
  // The day the coach picked when training's weeks moved it, to say so.
  const [moved, setMoved] = useState<{ side: "start" | "end"; picked: string; to: string } | null>(null);
  // Training can't overlap: say the weeks rule and the nearest week that fits, and hold Save.
  const weekClash = overlap ? (overlap.from > startWeek ? { side: "end" as const, day: addDays(overlap.from, -1) } : { side: "start" as const, day: addDays(overlap.to, 1) }) : null;
  // A clash says only what is in the way; its fix button names the nearest week that fits (20 Oct, Alex: facts, no explanations).
  const note = overlap ? `Overlaps ${overlap.name}, ${fmtDay(overlap.from)} – ${fmtDay(overlap.to)}.` : moved ? `${fmtDay(moved.picked)} moved to ${fmtDay(moved.to)}.` : " ";
  // One click to the other side: the clash's nearest week, or the week after (or before) the one a picked day moved to.
  const movedAlt = moved && !overlap ? { side: moved.side, day: addDays(moved.to, moved.side === "start" ? 7 : -7), instead: true } : null;
  const fix = weekClash ? { ...weekClash, instead: false } : movedAlt && (movedAlt.side === "start" ? movedAlt.day <= to : movedAlt.day > from) ? movedAlt : null;

  // A phase can be put in the past (it started a while ago), but not further back than a year (21 Oct, Alex: 2022 went in).
  const earliest = addDays(today, -365);
  const setStart = (d: string) => {
    if (startLocked || d < earliest) return;
    const s = mondayOf(d);
    setWeeksText(null);
    setMoved(s !== d ? { side: "start", picked: d, to: s } : null);
    setFrom(s);
    if (to < s) setTo(addDays(s, 6));
    setCursor(s.slice(0, 7));
  };
  const setEnd = (d: string) => {
    if (d < earliest) return;
    const e = addDays(mondayOf(d), 6);
    if (e < from) return setStart(d);
    setWeeksText(null);
    setMoved(e !== d ? { side: "end", picked: d, to: e } : null);
    setTo(e);
  };
  const pick = (d: string) => {
    if (picking === "start" && !startLocked) {
      setStart(d);
      setPicking("end");
    } else {
      setEnd(d);
      setPicking("start");
    }
  };
  // The length typed as weeks (Finlay, 7 Oct): the end follows the start.
  // Shown as whole weeks; a span the calendar left uneven says so in the caption.
  const days = phaseDays(startWeek, endWeek);
  const weeksShown = weeksText ?? String(Math.max(1, Math.floor(days / 7)));
  const setWeeks = (text: string) => {
    setWeeksText(text);
    const n = Math.round(Number(text));
    if (!Number.isFinite(n) || n < 1 || n > 104) return;
    setMoved(null);
    setTo(addDays(from, n * 7 - 1));
  };
  // Phases on the other tracks still to run: one click copies its days, so a
  // training block and its nutrition phase line up (Finlay, 7 Oct). For
  // training the days are widened to whole weeks. Which one is "matched" is
  // read off the dates, so it unticks itself once either date is moved.
  const matchable = others
    .filter((o) => o.track !== track && o.id !== phase?.id && addDays(o.end_week, 6) >= today)
    .sort((a, b) => a.start_week.localeCompare(b.start_week))
    .map((o) => ({ id: String(o.id), name: o.name, track: o.track, from: mondayOf(o.start_week), to: addDays(mondayOf(addDays(o.end_week, 6)), 6) }));
  const matched = matchable.find((m) => m.from === from && m.to === to)?.id ?? "none";
  const matchPhase = (id: string) => {
    const m = matchable.find((x) => x.id === id);
    if (!m || (startLocked && m.from !== from)) return;
    setMoved(null);
    setWeeksText(null);
    setFrom(m.from);
    setTo(m.to);
    setCursor(m.from.slice(0, 7));
  };
  const ok = name.trim().length > 0 && from <= to && !weekClash;
  const loose = programs.filter((p) => !p.linked);
  const linkedProgram = programChoice !== "new" ? programs.find((p) => p.id === Number(programChoice)) ?? null : null;

  // The state tag is where its actions live (20 Oct, Alex: make it live from here, as on Training): a draft
  // is scheduled or made live, a scheduled one made live now or sent back to draft. Each asks first, and saves the edits with it.
  const [going, setGoing] = useState<"live" | "schedule" | "draft" | null>(null);
  const startHasCome = from <= today;
  const actionable = editing && (state === "draft" || state === "scheduled");
  const running = others.find((o) => o.id !== phase?.id && o.track === track && !(o.draft || o.program?.status === "draft") && o.start_week <= today && addDays(o.end_week, 6) >= today);
  if (going && phase) {
    const called = name.trim() || phase.name;
    // Going live now starts it this week, so the phase running on the track ends the Sunday before (every track, 21 Oct).
    const endsOn = shortDate(addDays(mondayOf(today), -1));
    const t =
      going === "live"
        ? { title: `Make ${called} live?`, what: `${firstName} sees it from today.${running ? ` ${running.name} ends ${endsOn}.` : ""}`, go: "Make it live" }
        : going === "schedule"
          ? { title: `Schedule ${called}?`, what: `${firstName} sees it from ${shortDate(startWeek)}.`, go: "Schedule it" }
          : { title: "Back to draft?", what: `${called} stops being scheduled.`, go: "Back to draft" };
    return (
      <DialogContent className="dlh">
        <div className="dlh-head">
          <DialogTitle className="dlh-title">{t.title}</DialogTitle>
          <DialogClose className="dlh-x" aria-label="Close">
            ✕
          </DialogClose>
        </div>
        <DialogDescription className="dlh-what">{t.what}</DialogDescription>
        <div className="dlh-foot">
          <button type="button" className="dlh-cancel" onClick={() => setGoing(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="dlh-go"
            autoFocus
            onClick={() => (going === "draft" ? onUnschedule?.() : onSend({ name: called, track, start: startWeek, end: endWeek, now: going === "live", goals: goalLines }))}
          >
            {t.go}
          </button>
        </div>
      </DialogContent>
    );
  }

  // In the admin hairline style (20 Oct, Alex): a title and one quiet line of
  // facts (track · state), clean-line fields, the calendar in ink, the dates as
  // two hairline capsules, no explanations; a clash says what is in the way
  // and offers the fix. Delete as red words on the left, Save a black pill.
  return (
    // The phase's own colour (21 Oct, Alex): its track tags under the title, its range on the calendar.
    <DialogContent className="npd" style={{ "--npd-c": TRACK_ACCENT[track], "--npd-rgb": rgbOf(TRACK_ACCENT[track]) } as React.CSSProperties}>
      <div className="npd-head">
        <DialogTitle className="npd-title">{editing ? phase.name : "New phase"}</DialogTitle>
        <span className="npd-tools">
          {/* Straight to the tab where the phase's contents live. */}
          {editing && (
            <Link
              className="npd-open"
              href={
                track === "training"
                  ? `/admin/redesign/training?client=${clientId}${phase.program ? `&program=${phase.program.id}` : ""}`
                  : `/admin/redesign/${track === "nutrition" ? "nutrition" : "measurements"}?client=${clientId}&phase=${phase.id}`
              }
            >
              Open
            </Link>
          )}
          <DialogClose className="npd-x" aria-label="Close">
            ✕
          </DialogClose>
        </span>
      </div>
      <DialogDescription className="npd-tags">
        <span className="npd-track">
          <TrackIcon track={track} size={12} />
          {TRACK_LABEL[track]}
        </span>
        {actionable ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="npd-state npd-state-btn" style={stateTagStyle(state)} aria-label={`${STATE_LABEL[state]}: change`} disabled={!ok}>
              {STATE_LABEL[state]}
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="pb-menu">
              {state === "draft" ? (
                startHasCome ? (
                  <DropdownMenuItem onSelect={() => setGoing("live")}>Make it live</DropdownMenuItem>
                ) : (
                  // A draft starting later: on its start, or today instead (20 Oct, Alex).
                  <>
                    <DropdownMenuItem onSelect={() => setGoing("schedule")}>Schedule it</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setGoing("live")}>Make it live now</DropdownMenuItem>
                  </>
                )
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => setGoing("live")}>Make it live now</DropdownMenuItem>
                  {onUnschedule && <DropdownMenuItem onSelect={() => setGoing("draft")}>Back to draft</DropdownMenuItem>}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="npd-state" style={stateTagStyle(state)}>
            {STATE_LABEL[state]}
          </span>
        )}
      </DialogDescription>
      {!editing && !lockTrack && (
        <div className="npd-field">
          <span className="npd-label">Track</span>
          {/* Tiles across the row, as the event categories (21 Oct, Alex): each track's icon in its colour, the chosen one filled. */}
          <div className="npd-tiles" role="radiogroup" aria-label="Track">
            {TRACKS.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={track === t.id} className={`npd-tile${track === t.id ? " on" : ""}`} style={{ "--tc": TRACK_ACCENT[t.id] } as React.CSSProperties} onClick={() => setTrack(t.id)}>
                <TrackIcon track={t.id} size={18} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="npd-field">
        <span className="npd-label">Name</span>
        <input className="npd-line" value={name} onChange={(e) => setName(e.target.value)} placeholder={track === "nutrition" ? "Cut A" : track === "training" ? "Strength block" : "Sleep focus"} maxLength={60} autoFocus={!editing} />
      </label>
      {/* Phase goals off (23 Oct, Alex: To focus on replaces them): Name, then the dates. */}
      {FEATURES.phaseGoals && (
        <div className="npd-field">
          <button type="button" className="npd-goals-head" aria-expanded={goalsOpen} onClick={() => setGoalsOpen((o) => !o)}>
            <span className="npd-label">Phase goals</span>
            <span className="npd-goals-n">{goalLines.length}</span>
            <span className={`npd-goals-chev${goalsOpen ? " open" : ""}`} aria-hidden="true">
              <ChevronDownIcon />
            </span>
          </button>
          {goalsOpen && (
            <ul className="npd-goals-list">
              {goalRows.map((g, i) => (
                <li key={i}>
                  <i aria-hidden="true" />
                  <input
                    className="npd-line"
                    value={g}
                    maxLength={PHASE_OBJECTIVE_CHARS}
                    autoFocus={i === 0}
                    onChange={(e) => setGoalRows((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      (e.currentTarget.closest("li")?.nextElementSibling?.querySelector("input") as HTMLInputElement | null)?.focus();
                    }}
                    placeholder={i === 0 ? "What this phase is for" : "Another goal"}
                    aria-label={`Goal ${i + 1}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="npd-cols">
        <MonthRange from={from} to={to} onPick={pick} chrome={chrome} planned={planned} cursor={cursor} setCursor={setCursor} today={today} plain />
        <div className="npd-side">
          {/* The dates as two capsules with the arrow between; a tap arms that end in the calendar, which is the picker. */}
          <div className="npd-dates">
            {/* Typed or picked (21 Oct, Alex: typing the dates was missed): a click arms that end in the calendar, the field takes 05/10/2026. */}
            <div className={`npd-date${picking === "start" ? " arm" : ""}${startLocked ? " locked" : ""}`} onClick={() => !startLocked && setPicking("start")}>
              <span className="npd-date-head">
                Starts
                {startLocked ? (
                  <>
                    <Sep />
                    fixed
                  </>
                ) : null}
              </span>
              <DateText value={from} min={startLocked ? undefined : earliest} onChange={(d) => setStart(d)} label="Start date" disabled={startLocked} onFocus={() => setPicking("start")} />
            </div>
            <span className="npd-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
            <div className={`npd-date${picking === "end" ? " arm" : ""}`} onClick={() => setPicking("end")}>
              <span className="npd-date-head">Ends</span>
              {/* A training phase ends on its week's Sunday, so that is the day shown. */}
              <DateText value={savedTo} min={earliest} onChange={(d) => setEnd(d)} label="End date" onFocus={() => setPicking("end")} />
            </div>
          </div>
          {/* Type the weeks and the end follows; pick the end and the weeks follow. An uneven span shows its length beside it. */}
          <label className="npd-field">
            <span className="npd-label">Weeks</span>
            <span className="npd-weeks-row">
              <input className="npd-line npd-weeks" type="number" inputMode="numeric" min={1} max={104} step={1} value={weeksShown} onChange={(e) => setWeeks(e.target.value)} onBlur={() => setWeeksText(null)} onFocus={() => setPicking("end")} aria-label="Length in weeks" />
              {days % 7 ? <small className="npd-meta">{phaseLengthLabel(startWeek, endWeek)}</small> : null}
            </span>
          </label>
          {/* The same days as a phase on another track, so the two run in tandem. */}
          {/* Its room is kept on every track (20 Oct, Alex: no jump when the track changes); hidden where nothing can be matched. */}
          {others.some((o) => o.id !== phase?.id && addDays(o.end_week, 6) >= today) && (
            <div className="npd-field" style={{ visibility: matchable.length > 0 ? "visible" : "hidden" }} aria-hidden={matchable.length === 0}>
              <span className="npd-label">Same dates as</span>
              <Picker
                value={matched}
                onChange={matchPhase}
                label="Same dates as"
                className="npd-pick"
                options={[{ value: "none", label: "Not matched" }, ...matchable.map((m) => ({ value: m.id, label: m.name, color: TRACK_ACCENT[m.track], hint: `${shortDate(m.from)} – ${shortDate(m.to)}` }))]}
              />
            </div>
          )}
          {/* Only when a draft programme is waiting on the Training tab with no phase of its own: then this phase can be it rather than a second one. */}
          {!editing && loose.length > 0 && (
            <div className="npd-field" style={{ visibility: track === "training" ? "visible" : "hidden" }} aria-hidden={track !== "training"}>
              <span className="npd-label">Built from</span>
              <Picker value={programChoice} onChange={setProgramChoice} label="Programme" className="npd-pick" options={[{ value: "new", label: "A new programme", hint: `${weeks} weeks` }, ...loose.map((p) => ({ value: String(p.id), label: p.name, hint: `${p.weeks} weeks · ${p.status}` }))]} />
            </div>
          )}
          {/* Always a line, so the dialog keeps its height whether or not there is something to say. */}
          <p className={`npd-note${overlap ? " bad" : ""}`} role={weekClash ? "alert" : undefined}>
            <span>{note}</span>
            {fix && !(startLocked && fix.side === "start") && (
              <button type="button" className="npd-fix" onClick={() => (fix.side === "start" ? setStart(fix.day) : setEnd(fix.day))}>
                {fix.side === "start" ? "Start" : "End"} {fmtDay(fix.day)}
                {fix.instead ? " instead" : ""}
              </button>
            )}
          </p>
        </div>
      </div>
      {/* Delete on the far left for a phase that exists; Cancel and Save on the right. */}
      <div className="npd-foot">
        {editing && onDelete && (
          <button type="button" className="npd-delete" onClick={onDelete}>
            Delete
          </button>
        )}
        <DialogClose className="npd-cancel">Cancel</DialogClose>
        <button type="button" className="npd-save" disabled={!ok} onClick={() => onSave({ name: name.trim(), track, start: startWeek, end: endWeek, programId: linkedProgram?.id ?? null, goals: goalLines })}>
          {editing ? "Save" : "Add"}
        </button>
      </div>
    </DialogContent>
  );
}

/** A finished drag waits here: the dates as they were and as they will be. In the hairline style
 *  (21 Oct, Alex) with the track's colour: its name in a tinted capsule, the new dates in its ink;
 *  a draft keeps its peach state chip. */
export function MoveDialog({ phase: p, start, end, today, onCancel, onSave }: { phase: PlanPhaseRow; start: string; end: string; today: string; onCancel: () => void; onSave: () => void }) {
  const isDraft = p.draft || p.program?.status === "draft";
  const state = phaseStateOf({ draft: isDraft, startWeek: start, endWeek: end, today });
  const ink = TRACK_ACCENT[p.track];
  const last = (monday: string) => fmtDay(addDays(monday, 6));
  const rows = [
    { label: "Start", was: fmtDay(p.start_week), now: fmtDay(start) },
    { label: "End", was: last(p.end_week), now: last(end) },
    { label: "Length", was: phaseLengthLabel(p.start_week, p.end_week), now: phaseLengthLabel(start, end) },
  ];
  return (
    <DialogContent className="dlh mvd" style={{ "--mv": ink, "--mv-rgb": rgbOf(ink) } as React.CSSProperties}>
      <div className="dlh-head">
        <DialogTitle className="dlh-title">Move {p.name}</DialogTitle>
        <button type="button" className="dlh-x" onClick={onCancel} aria-label="Close">
          ✕
        </button>
      </div>
      <DialogDescription className="mvd-tags">
        <span className="mvd-track">
          <TrackIcon track={p.track} size={12} />
          {TRACK_LABEL[p.track]}
        </span>
        <span className="mvd-state" style={stateTagStyle(state)}>
          {STATE_LABEL[state]}
        </span>
      </DialogDescription>
      <div className="mvd-rows">
        {/* One rule for every Move pop-up (22 Oct, Alex): NEW over the new values, in the colour; the old ones struck through say themselves. */}
        {rows.some((r) => r.was !== r.now) && (
          <div className="mvd-row mvd-head" aria-hidden="true">
            <span />
            <span />
            <span className="mvd-label mvd-newhead">New</span>
          </div>
        )}
        {rows.map((r) => (
          // Two columns, no arrows (21 Oct, Alex): what it was, struck through, then the new value in the track's ink.
          <div key={r.label} className={`mvd-row${r.was === r.now ? " same" : ""}`}>
            <span className="mvd-label">{r.label}</span>
            {r.was === r.now ? (
              // Unchanged (23 Oct, Alex): in the New column too, in ink, so it is never an empty space.
              <>
                <span className="mvd-kept">{r.was}</span>
                <span className="mvd-now">{r.now}</span>
              </>
            ) : (
              <>
                <s className="mvd-was" aria-label={`was ${r.was}`}>
                  {r.was}
                </s>
                <span className="mvd-now">{r.now}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="dlh-foot">
        <button type="button" className="dlh-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="dlh-go" onClick={onSave} autoFocus>
          Save
        </button>
      </div>
    </DialogContent>
  );
}

// ---- The goal dialog: pick the thing to watch, say the target as one sentence, see the client's card.

type Kind = PlanGoalRow["kind"];
type Thing = { id: string; kind: Kind; tab: Kind; name: string; hint: string; unit?: string; metricKey?: string; exerciseId?: number; habitId?: number; now?: number | null; series?: { date: string; value: number }[]; best?: { weight: number; reps: number } | null };
/** The goal dialog's sections, as its capsule reads them. */
const GOAL_SECTIONS: [Kind, string][] = [
  ["exercise", "Exercises"],
  ["metric", "Nutrition"],
  ["habit", "Lifestyle"],
];

function GoalDialog({ firstName, goal, options, phases, today, onSave }: { firstName: string; goal: PlanGoalRow | null; options: GoalEditorOptions; phases: PlanPhaseRow[]; today: string; onSave: (v: { text: string; kind: Kind; rule: string; tracking: GoalTracking | null; by: string | null; tracks: string | null }) => void }) {
  const t = goal?.tracking ?? null;
  // Everything the client already logs, in one list: what a goal can watch.
  // A figure sits under Nutrition when it is one (calories, the macros, a
  // nutrition-group metric); everything else the client logs is a check-in.
  // The same name from two tables shows once, the one with data winning.
  const seenName = new Set<string>();
  const things: Thing[] = [
    ...[...options.metrics]
      .sort((a, b) => (b.series.length > 0 ? 1 : 0) - (a.series.length > 0 ? 1 : 0))
      .filter((m) => {
        const k = m.name.trim().toLowerCase();
        if (seenName.has(k)) return false;
        seenName.add(k);
        return true;
      })
      .map((m) => {
        const latest = m.series[m.series.length - 1];
        // Facts, two words when empty (21 Oct, Alex: no explanations).
        return { id: `m:${m.key}`, kind: "metric" as Kind, tab: (m.group === "nutrition" ? "metric" : "habit") as Kind, name: m.name, unit: m.unit, metricKey: m.key, now: latest?.value ?? null, series: m.series, hint: latest ? `now ${fmtNum(latest.value)}${m.unit ? ` ${m.unit}` : ""}` : "None yet" };
      }),
    ...options.exercises.map((e) => {
      const sets = e.sets.filter((s) => s.weight != null && s.reps != null);
      const best = [...sets].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
      return { id: `e:${e.id}`, kind: "exercise" as Kind, tab: "exercise" as Kind, name: e.name, unit: "kg", exerciseId: e.id, best: best ? { weight: best.weight!, reps: best.reps! } : null, hint: best ? `best ${fmtNum(best.weight!)} × ${best.reps}` : "No sets yet" };
    }),
    ...options.habits.map((h) => ({ id: `h:${h.id}`, kind: "habit" as Kind, tab: "habit" as Kind, name: `${h.name} · days a week`, habitId: h.id, hint: "Daily check-in" })),
  ];
  const fromTracking = (): Thing | null => {
    if (!t) return null;
    if (t.kind === "metric") return things.find((x) => x.metricKey === t.metricKey) ?? null;
    if (t.kind === "exercise") return things.find((x) => x.exerciseId === t.exerciseId) ?? null;
    return things.find((x) => x.habitId === t.metricId) ?? null;
  };
  const [thing, setThing] = useState<Thing | null | "words">(goal ? (fromTracking() ?? "words") : null);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const [section, setSection] = useState<Kind>("exercise");
  const matches = things.filter((x) => !needle || x.name.toLowerCase().includes(needle));
  // The section's matches float under the search (21 Oct, Alex: a list floats, six rows then it
  // scrolls, and never stretches the card). It opens on typing, a click in the search or a
  // section; it shuts on a pick, Escape, or a click anywhere else.
  const shownThings = matches.filter((x) => x.tab === section);
  const [listOpen, setListOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // The blanks in the sentence.
  const [dir, setDir] = useState<"<=" | ">=">(t?.kind === "metric" ? t.op : t?.kind === "habit" ? t.op : "<=");
  const [target, setTarget] = useState(t?.kind === "metric" ? String(t.target) : t?.kind === "habit" ? String(t.value) : "");
  // The deadline: the end of a phase (it follows the bar when the phase
  // moves), a date of the coach's own, or none. Phases still to come, live
  // first, then by start; a phase already over is no deadline to offer.
  const ends = phases
    .filter((p) => addDays(p.end_week, 6) >= today)
    .sort((a, b) => a.start_week.localeCompare(b.start_week) || a.end_week.localeCompare(b.end_week))
    .map((p) => ({ id: p.id, name: p.name, date: addDays(p.end_week, 6) }));
  const endOf = (id: number) => ends.find((e) => e.id === id) ?? null;
  const savedBy = t?.kind === "metric" ? t.byDate : null;
  const savedPhase = savedBy ? (ends.find((e) => e.date === savedBy) ?? null) : null;
  const [byMode, setByMode] = useState<string>(savedPhase ? `p:${savedPhase.id}` : savedBy ? "date" : ends[0] ? `p:${ends[0].id}` : "date");
  const [byDate, setByDate] = useState(savedBy ?? options.phaseEnd ?? addDays(options.today, 56));
  const byPhase = byMode.startsWith("p:") ? endOf(Number(byMode.slice(2))) : null;
  const byNone = byMode === "none";
  /** The date the deadline resolves to today; a no-deadline goal carries a year out so the metric shape stays whole. */
  const byResolved = byPhase ? byPhase.date : byNone ? addDays(today, 365) : byDate;
  const byPhrase = byPhase ? `by the end of ${byPhase.name}` : byNone ? "" : `by ${byDate ? shortDate(byDate) : "…"}`;
  const byRule = byPhase ? `by end of ${byPhase.name} (${shortDate(byPhase.date)})` : byNone ? "no deadline" : `by ${shortDate(byDate)}`;
  const byRow = byPhase ? `End of ${byPhase.name} · ${shortDate(byPhase.date)}` : byNone ? "No deadline" : shortDate(byDate);
  const [weight, setWeight] = useState(t?.kind === "exercise" ? String(t.weight) : "");
  const [reps, setReps] = useState(t?.kind === "exercise" ? String(t.reps) : "5");
  const [days, setDays] = useState(t?.kind === "habit" ? String(t.daysPerWeek) : "5");
  const multiGym = options.gyms.length > 1;
  const [gymId, setGymId] = useState(String(t?.kind === "exercise" ? t.gymId ?? options.gyms[0]?.id ?? "" : options.gyms[0]?.id ?? ""));
  const [text, setText] = useState(goal?.text ?? "");
  const [touched, setTouched] = useState(!!goal);
  const num = (s: string) => {
    const n = Number(s.replace(",", "."));
    return s.trim() === "" || !Number.isFinite(n) ? null : n;
  };
  // Picking a thing fills the blanks from where the client is, so most goals are two numbers and Done.
  const pick = (x: Thing | "words") => {
    setThing(x);
    setQ("");
    setListOpen(false);
    setTouched(false);
    if (x === "words") return;
    if (x.kind === "metric" && x.now != null && !target) setTarget(fmtNum(Math.round(x.now)));
    if (x.kind === "exercise" && x.best && !weight) {
      setWeight(fmtNum(Math.round(x.best.weight / 5) * 5 + 5));
      setReps(String(x.best.reps));
    }
    if (x.kind === "habit") setDir(">=");
  };

  const th = thing === "words" ? null : thing;
  const unit = th?.unit ?? "";
  const tracking: GoalTracking | null = (() => {
    if (!th) return null;
    if (th.kind === "metric") {
      const tg = num(target);
      return tg != null && byResolved ? { kind: "metric", metricKey: th.metricKey!, op: dir, target: tg, byDate: byResolved } : null;
    }
    if (th.kind === "exercise") {
      const w = num(weight);
      const r = num(reps);
      return w != null && r != null ? { kind: "exercise", exerciseId: th.exerciseId!, weight: w, reps: r, maxRpe: null, gymId: multiGym ? Number(gymId) : null } : null;
    }
    const v = num(target);
    const d = num(days);
    return v != null && d != null ? { kind: "habit", metricId: th.habitId!, op: dir, value: v, daysPerWeek: Math.max(1, Math.min(7, Math.round(d))) } : null;
  })();
  // The sentence writes itself from the blanks; once the coach edits it, it is theirs.
  const sentence = (() => {
    if (!th) return "";
    if (th.kind === "metric") return `${dir === "<=" ? "Get under" : "Get to"} ${target || "…"}${unit ? ` ${unit}` : ""}${byPhrase ? ` ${byPhrase}` : ""}`;
    if (th.kind === "exercise") return `${th.name} ${weight || "…"} kg for ${reps || "…"} reps`;
    return `${th.name} ${dir === ">=" ? "at least" : "at most"} ${target || "…"}${unit ? ` ${unit}` : ""}, ${days || "…"} days a week`;
  })();
  const shownText = touched ? text : sentence;
  const ok = (thing === "words" ? text.trim() !== "" : !!tracking) && shownText.trim() !== "";
  const rule = (() => {
    if (!th || !tracking) return "Text only";
    if (tracking.kind === "metric") return `Metric · ${th.name} ${dir} ${fmtNum(tracking.target)}${unit ? ` ${unit}` : ""} · ${byRule}`;
    if (tracking.kind === "exercise") return `Exercise · ${th.name}${multiGym ? ` at ${options.gyms.find((g) => String(g.id) === gymId)?.name ?? "gym"}` : ""} · ${fmtNum(tracking.weight)} × ${tracking.reps}`;
    return `Habit · ${th.name} ${dir} ${fmtNum(tracking.value)} · ${tracking.daysPerWeek} / week`;
  })();

  // The client's card, as it would read today.
  const preview = (() => {
    if (!th || !tracking) return null;
    if (tracking.kind === "metric") {
      const now = th.now;
      if (now == null) return { now: "None yet", pct: 0, tone: "muted" as const };
      const reached = dir === "<=" ? now <= tracking.target : now >= tracking.target;
      const start = th.series?.[0]?.value ?? now;
      const span = Math.abs(start - tracking.target) || 1;
      const pct = reached ? 100 : Math.max(0, Math.min(99, Math.round((Math.abs(start - now) / span) * 100)));
      return { now: `now ${fmtNum(now)}${unit ? ` ${unit}` : ""}`, pct, tone: reached ? ("green" as const) : ("orange" as const) };
    }
    if (tracking.kind === "exercise") {
      if (!th.best) return { now: "No sets yet", pct: 0, tone: "muted" as const };
      const reached = th.best.weight >= tracking.weight && th.best.reps >= tracking.reps;
      return { now: `best ${fmtNum(th.best.weight)} × ${th.best.reps}`, pct: reached ? 100 : Math.max(0, Math.min(99, Math.round((th.best.weight / tracking.weight) * 100))), tone: reached ? ("green" as const) : ("orange" as const) };
    }
    return { now: `${tracking.daysPerWeek} days a week to hit`, pct: 0, tone: "muted" as const };
  })();

  const blank = (value: string, set: (v: string) => void, width: number, label: string) => <input className="rq-blank" style={{ width }} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} aria-label={label} />;

  return (
    // On the phase pop-up's pattern (21 Oct, Alex): the .npd card, a title and the ghost ✕, small-caps
    // labels over clean lines, Cancel as words and one black pill. While the thing is being picked the
    // card lets its floating list hang over its edge (rq-pick); Escape shuts that list first.
    <DialogContent
      className={`npd rq-dlg${thing == null ? " rq-pick" : ""}`}
      onEscapeKeyDown={(e) => {
        if (!listOpen) return;
        e.preventDefault();
        setListOpen(false);
      }}
    >
      <div className="npd-head">
        <DialogTitle className="npd-title">{goal ? "Edit goal" : "New goal"}</DialogTitle>
        <span className="npd-tools">
          <DialogClose className="npd-x" aria-label="Close">
            ✕
          </DialogClose>
        </span>
      </div>
      {/* The title says it all; the description is for screen readers only. */}
      <DialogDescription hidden>Pick what to watch, say the target, and {firstName} gets a card that keeps itself up to date.</DialogDescription>

      {/* 1. What to watch: a plain goal, or one of the things the client logs, by section or by name. */}
      {thing == null ? (
        <div className="npd-field">
          <span className="npd-label">What to watch</span>
          <button type="button" className="rq-words" onClick={() => pick("words")}>
            Plain goal
            <PlusIcon />
          </button>
          <div
            className="rq-find"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setListOpen(false);
            }}
          >
            {/* The section as the hairline capsule, the chosen one ink; a press keeps the search focused. */}
            <div className="npd-seg rq-seg" role="group" aria-label="Which group" onMouseDown={(e) => e.preventDefault()}>
              {GOAL_SECTIONS.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={section === k ? "on" : ""}
                  aria-pressed={section === k}
                  onClick={() => {
                    setSection(k);
                    setListOpen(true);
                    searchRef.current?.focus();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              ref={searchRef}
              className="npd-line"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setListOpen(true);
              }}
              onClick={() => setListOpen(true)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown") return;
                e.preventDefault();
                setListOpen(true);
              }}
              placeholder="Search"
              autoFocus
              role="combobox"
              aria-expanded={listOpen}
              aria-controls={listOpen && shownThings.length > 0 ? "rq-find-list" : undefined}
              aria-label="What to watch"
            />
            {listOpen && (
              <div className="rq-pop" onMouseDown={(e) => e.preventDefault()}>
                {shownThings.length > 0 ? (
                  <div className="rq-pop-scroll" id="rq-find-list" role="listbox" aria-label={GOAL_SECTIONS.find(([k]) => k === section)?.[1]}>
                    {shownThings.map((x) => (
                      <button key={x.id} type="button" role="option" aria-selected={false} className="rq-pop-item" onClick={() => pick(x)}>
                        <span>{x.name}</span>
                        <small>{x.hint}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rq-pop-none">No matches</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="npd-field">
          <span className="npd-label">Watching</span>
          {/* The thing as plain words, its one fact beside it, Change as a text action (21 Oct, Alex: no chip). */}
          <div className="rq-thing">
            <span className="rq-thing-name">{thing === "words" ? "Plain goal" : thing.name}</span>
            {thing !== "words" && <small>{thing.hint}</small>}
            <button type="button" className="rq-change" onClick={() => setThing(null)}>
              Change
            </button>
          </div>
        </div>
      )}

      {/* 2. The target, as a sentence with blanks. */}
      {th && (
        <div className="npd-field">
          <span className="npd-label">Target</span>
          <div className="rq-sentence">
            {th.kind === "metric" && (
              <>
                <Picker value={dir} onChange={setDir} label="Direction" className="rq-inline" options={[{ value: "<=", label: "Get under" }, { value: ">=", label: "Get to" }]} />
                {blank(target, setTarget, 72, `Target ${unit}`)}
                {unit && <span className="rq-word">{unit}</span>}
                <span className="rq-word">by</span>
                <Picker
                  value={byMode}
                  onChange={setByMode}
                  label="Deadline"
                  className="rq-inline"
                  options={[
                    // The phase's end day alone (21 Oct, Alex): no raw state word, no hint to pick.
                    ...ends.map((e) => ({ value: `p:${e.id}`, label: `End of ${e.name}`, hint: shortDate(e.date) })),
                    { value: "date", label: "A date…" },
                    { value: "none", label: "No deadline" },
                  ]}
                />
                {/* Typed or picked (21 Oct, Alex): the day as dd/mm/yyyy on a clean line, the calendar behind its icon. */}
                {byMode === "date" && <DatePick value={byDate} onChange={setByDate} label="Deadline date" className="rq-daypick" />}
                {byPhase && <small className="rq-by-date">{shortDate(byPhase.date)}</small>}
              </>
            )}
            {th.kind === "exercise" && (
              <>
                <span className="rq-word">Lift</span>
                {blank(weight, setWeight, 72, "Weight in kg")}
                <span className="rq-word">kg for</span>
                {blank(reps, setReps, 56, "Reps")}
                <span className="rq-word">reps</span>
                {multiGym && (
                  <>
                    <span className="rq-word">at</span>
                    <Picker value={gymId} onChange={setGymId} label="Gym" className="rq-inline" options={options.gyms.filter((g) => !g.removed || String(g.id) === gymId).map((g) => ({ value: String(g.id), label: g.name }))} />
                  </>
                )}
              </>
            )}
            {th.kind === "habit" && (
              <>
                <span className="rq-word">Hit</span>
                <Picker value={dir} onChange={setDir} label="At least or at most" className="rq-inline" options={[{ value: ">=", label: "at least" }, { value: "<=", label: "at most" }]} />
                {blank(target, setTarget, 72, "Value")}
                {unit && <span className="rq-word">{unit}</span>}
                <span className="rq-word">on</span>
                {blank(days, setDays, 56, "Days a week")}
                <span className="rq-word">days a week</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. The words, and the card the client gets. */}
      {thing != null && (
        <>
          <label className="npd-field">
            <span className="npd-label">{thing === "words" ? "Goal" : "How it reads"}</span>
            <input
              className="npd-line"
              value={shownText}
              onChange={(e) => {
                setTouched(true);
                setText(e.target.value);
              }}
              placeholder={thing === "words" ? "Take the stairs every day this month" : sentence}
              maxLength={120}
              autoFocus={thing === "words"}
            />
          </label>
          {/* The client's card: the goal and, once the blanks are filled, where it stands. No hint lines (21 Oct, Alex). */}
          <div className="rq-preview" aria-label={`${firstName}'s card`}>
            <small>On {firstName}&rsquo;s Home</small>
            <b>{shownText.trim() || "…"}</b>
            {preview && (
              <span className={`rq-pct ${preview.tone}`}>
                <i>
                  <b style={{ width: `${preview.pct}%` }} />
                </i>
                <small>{preview.now}</small>
              </span>
            )}
          </div>
        </>
      )}

      <div className="npd-foot">
        <DialogClose className="npd-cancel">Cancel</DialogClose>
        <button type="button" className="npd-save" disabled={!ok} onClick={() => onSave({ text: shownText.trim(), kind: th?.kind ?? "none", rule, tracking, by: tracking?.kind === "metric" ? byRow : tracking ? "ongoing" : null, tracks: th ? th.name : null })}>
          {goal ? "Save" : "Add"}
        </button>
      </div>
    </DialogContent>
  );
}
