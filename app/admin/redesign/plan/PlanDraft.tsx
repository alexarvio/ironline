"use client";

import { useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { addClientGoalAction, addClientPhaseAction, applyGoalDoneChangesAction, removeClientGoalAction, removeClientPhaseAction, reorderClientGoalsAction, saveAndDeployPhaseNowAction, saveAndSchedulePhaseAction, setClientMainGoalAction, updateClientGoalAction, updateClientPhaseAction } from "../../../lib/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { ChevronLeftIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import type { GoalEditorOptions, PlanGoalRow, PlanPhaseRow, PlanProgramOption } from "../../../lib/queries";
import type { GoalTracking } from "../../../lib/goalView";
import type { PhaseTrack } from "../../../lib/db";
import { phaseChrome, phaseStateOf, STATE_LABEL, TRACK_LABEL, TRACK_PALETTE, type PhaseState } from "../../phaseChrome";
import { ConfirmDialog } from "../training/TrainingDraft";
import Picker from "../Picker";
import DatePick from "../DatePick";
import DateText from "../DateText";
import EventsCard, { type Category, type PlanEvent } from "./EventsCard";

// The calmer Plan tab, as a draft on real data, in the Training draft's
// sheet. Three cards: the one headline goal, the phases as bars on a week
// grid, and the goals as a table with their live standing.
//
// - Main goal: one sentence, typed in place, saved on purpose.
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
};

const savedToast = (what: string) => toast.success("Saved", { description: what });
/** A phase's fields as the actions read them. */
const phaseForm = (v: { id?: number; clientId?: number; name: string; track: PhaseTrack; start: string; end: string; programId?: number | null }) => {
  const fd = new FormData();
  if (v.id != null) fd.set("id", String(v.id));
  if (v.clientId != null) fd.set("clientId", String(v.clientId));
  fd.set("track", v.track);
  fd.set("name", v.name);
  fd.set("start", v.start);
  fd.set("end", v.end);
  if (v.programId != null) fd.set("programId", String(v.programId));
  return fd;
};
const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return isoOf(x);
};
const addWeeks = (monday: string, n: number) => addDays(monday, n * 7);
const weeksBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / (7 * DAY));
const mondayOf = (d: string) => addDays(d, -((parse(d).getDay() + 6) % 7));
const shortDate = (d: string) => parse(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const fmtDay = (d: string) => parse(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const monthName = (d: string) => parse(d).toLocaleDateString("en-GB", { month: "short" });
const isoWeek = (day: string) => {
  const thursday = parse(addDays(mondayOf(day), 3));
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1.getTime()) / DAY / 7) + 1;
};
const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

const TRACKS: { id: PhaseTrack; label: string }[] = [
  { id: "nutrition", label: "Nutrition" },
  { id: "training", label: "Training" },
  { id: "lifestyle", label: "Lifestyle" },
];
// How far ahead the grid shows, in months; each a whole number of weeks.
const WINDOWS = [
  { months: 3, weeks: 13 },
  { months: 6, weeks: 26 },
  { months: 9, weeks: 39 },
  { months: 12, weeks: 52 },
] as const;
type Win = (typeof WINDOWS)[number]["weeks"];
const KIND_LABEL: Record<PlanGoalRow["kind"], string> = { metric: "Metric", exercise: "Exercise", habit: "Habit", none: "Text" };

type Dlg = { kind: "phase"; phase: PlanPhaseRow | null; track?: PhaseTrack } | { kind: "move"; id: number; start: string; end: string } | { kind: "deletePhase"; id: number } | { kind: "goal"; goal: PlanGoalRow | null } | { kind: "removeGoal"; id: number } | null;

export default function PlanDraft({ clientId, firstName, plan }: { clientId: number; firstName: string; plan: DraftPlan }) {
  const { today, thisWeek, intoWeek } = plan;
  const router = useRouter();
  const [, start] = useTransition();
  // Every save goes to the server, then the page re-reads; what is on screen
  // is a working copy that follows the server's answer.
  const act = (fn: () => Promise<unknown>, said?: string) =>
    start(async () => {
      await fn();
      router.refresh();
      if (said) savedToast(said);
    });
  // ---- Main goal: typed, then saved on purpose.
  const [mainSaved, setMainSaved] = useState(plan.mainGoal);
  const [main, setMain] = useState(plan.mainGoal);
  // When the server's answer differs from what was here, follow it (derived state, reset during render).
  const [seenMain, setSeenMain] = useState(plan.mainGoal);
  if (seenMain !== plan.mainGoal) {
    setSeenMain(plan.mainGoal);
    setMainSaved(plan.mainGoal);
    setMain(plan.mainGoal);
  }

  // ---- Phases: what is on screen lives here, so a drag shows what it would do.
  const [phases, setPhases] = useState(plan.phases);
  const [seenPhases, setSeenPhases] = useState(plan.phases);
  if (seenPhases !== plan.phases) {
    setSeenPhases(plan.phases);
    setPhases(plan.phases);
  }
  const [win, setWin] = useState<Win>(13);
  const [dlg, setDlg] = useState<Dlg>(null);
  const close = () => setDlg(null);
  const [drag, setDrag] = useState<{ id: number; edge: "start" | "end" | "move"; start: string; end: string; moved: boolean; origStart: string; origEnd: string; anchor: string | null } | null>(null);
  const justDragged = useRef(false);
  const areaRef = useRef<HTMLDivElement>(null);

  // The window: last week for context, this week in the second column, and
  // most of the grid what is coming. "Now" is one fixed line a week and a
  // half in; the weeks slide under it as the week goes by.
  const first = addWeeks(thisWeek, -2);
  const count = win + 2;
  const weeks = Array.from({ length: count }, (_, i) => addWeeks(first, i));
  const nowIdx = weeksBetween(first, thisWeek);
  const months: { label: string; start: number; span: number }[] = [];
  weeks.forEach((w, i) => {
    const label = monthName(w);
    const prev = months[months.length - 1];
    if (prev && prev.label === label) prev.span += 1;
    else months.push({ label, start: i, span: 1 });
  });
  const cols: React.CSSProperties = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, width: `${(count / win) * 100}%`, transform: `translateX(${-((0.5 + intoWeek) / count) * 100}%)` };
  const nowLeft = `calc(108px + (100% - 108px) * ${1.5 / win})`;

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
  const span = (p: PlanPhaseRow) => {
    const live = drag?.id === p.id ? drag : dlg?.kind === "move" && dlg.id === p.id ? dlg : null;
    const s = live ? live.start : p.start_week;
    const e = live ? live.end : p.end_week;
    const a = Math.max(0, weeksBetween(first, s));
    const b = Math.min(count - 1, weeksBetween(first, e));
    return { a, b, s, e, visible: b >= 0 && a <= count - 1, clippedStart: weeksBetween(first, s) < 0, clippedEnd: weeksBetween(first, e) > count - 1 };
  };
  const stateOf = (p: PlanPhaseRow, s = p.start_week, e = p.end_week): PhaseState => phaseStateOf({ draft: p.draft || p.program?.status === "draft", startWeek: s, endWeek: e, today });

  // ---- Goals: done-ticks and a dragged order queue until Apply.
  const [goals, setGoals] = useState(plan.goals);
  const [seenGoals, setSeenGoals] = useState(plan.goals);
  if (seenGoals !== plan.goals) {
    setSeenGoals(plan.goals);
    setGoals(plan.goals);
  }
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [pendingDone, setPendingDone] = useState<Record<number, boolean>>({});
  const [order, setOrder] = useState<number[] | null>(null);
  const [dragGoal, setDragGoal] = useState<number | null>(null);
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
  const moveGoal = (overId: number) => {
    if (dragGoal == null || dragGoal === overId) return;
    const cur = ordered.map((g) => g.id);
    const next = cur.filter((id) => id !== dragGoal);
    next.splice(next.indexOf(overId), 0, dragGoal);
    setOrder(next.every((id, i) => id === goals[i]?.id) ? null : next);
  };

  // Only the goal's words flex; every figure column is a fixed width, so the
  // columns line up as columns and the gaps between them read the same.
  const gGrid = { gridTemplateColumns: "20px 24px minmax(240px, 1fr) 180px 110px 150px 80px 32px", columnGap: 16 } as const;
  const openCount = goals.filter((g) => !g.done).length;

  return (
    <div className="rd">
      {/* ---- Header. */}
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Plan</span>
          <h1 className="rd-title">{firstName}&rsquo;s plan</h1>
        </div>
      </header>

      {/* ---- Main goal. */}
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>Main goal</h2>
        </div>
        <div className="rq-main">
          <input
            className="rq-main-input"
            value={main}
            onChange={(e) => setMain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            placeholder="e.g. Drop to 84 kg and keep the bench moving"
            aria-label="Main goal"
            maxLength={140}
          />
          <button
            type="button"
            className="rd-btn primary"
            disabled={main.trim() === mainSaved.trim()}
            onClick={() => {
              setMainSaved(main.trim());
              act(() => setClientMainGoalAction(clientId, main.trim()), `Main goal · shows under ${firstName}'s name on Home`);
            }}
          >
            Save
          </button>
        </div>
      </section>

      {/* ---- Phases. */}
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>Phases</h2>
          <div className="rq-ev-tools">
            <div className="rd-btn-group" role="group" aria-label="Time shown">
              {WINDOWS.map((w) => (
                <button key={w.weeks} type="button" className={win === w.weeks ? "on" : ""} aria-pressed={win === w.weeks} onClick={() => setWin(w.weeks)}>
                  {w.months} months
                </button>
              ))}
            </div>
            <button type="button" className="rd-btn" onClick={() => setDlg({ kind: "phase", phase: null })}>
              <PlusIcon /> Add phase
            </button>
          </div>
        </div>
        <div className="rq-tl-scroll">
          <div className="rq-tl" style={{ minWidth: Math.round(win * 63) }}>
            <div className="rq-tl-row">
              <span />
              <div className="rq-tl-clip">
                <div className="rq-tl-grid" style={cols}>
                  {months.map((m) => (
                    <span key={m.start} className="rq-month" style={{ gridColumn: `${m.start + 1} / span ${m.span}` }}>
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="rq-tl-body">
              <span className="rq-now" style={{ left: nowLeft }} title="Now" />
              <div className="rq-tl-row">
                <span />
                <div className="rq-tl-clip">
                  <div className="rq-tl-grid" style={cols}>
                    {weeks.map((w, i) => (
                      <span key={w} className={`rq-week${i === nowIdx ? " now" : ""}`}>
                        <b>W{isoWeek(w)}</b>
                        <small>{shortDate(w)}</small>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {TRACKS.map((t) => {
                const mine = phases.filter((p) => p.track === t.id).sort((a, b) => (a.start_week < b.start_week ? -1 : 1));
                // Overlapping phases on one track stack into lanes.
                const lanes: PlanPhaseRow[][] = [];
                const laneOf = new Map<number, number>();
                mine.forEach((p) => {
                  let li = lanes.findIndex((l) => l.every((q) => q.end_week < p.start_week || q.start_week > p.end_week));
                  if (li < 0) {
                    lanes.push([]);
                    li = lanes.length - 1;
                  }
                  lanes[li].push(p);
                  laneOf.set(p.id, li);
                });
                const laneCount = Math.max(1, lanes.length);
                const pal = TRACK_PALETTE[t.id];
                return (
                  <div key={t.id} className="rq-tl-row">
                    <div className="rq-tl-label">
                      <span className="rq-track" style={{ background: pal.tint, color: pal.ink }}>
                        {t.label}
                      </span>
                    </div>
                    <div className="rq-tl-clip">
                      <div className="rq-tl-grid rq-lanes" style={{ ...cols, gridTemplateRows: `repeat(${laneCount}, 44px)` }} ref={t.id === "nutrition" ? areaRef : undefined} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                        {weeks.map((w, i) => (
                          <span key={w} className="rq-cell" style={{ gridColumn: i + 1, gridRow: `1 / span ${laneCount}` }} />
                        ))}
                        {mine.length === 0 && (
                          <button type="button" className="rq-empty" style={{ gridColumn: `${nowIdx + 1} / span ${Math.min(count - nowIdx, 8)}`, gridRow: 1 }} onClick={() => setDlg({ kind: "phase", phase: null, track: t.id })}>
                            No phase planned <b>+ add</b>
                          </button>
                        )}
                        {mine.map((p) => {
                          const sp = span(p);
                          if (!sp.visible) return null;
                          const total = weeksBetween(sp.s, sp.e) + 1;
                          const shownW = sp.b - sp.a + 1;
                          const state = stateOf(p, sp.s, sp.e);
                          const chrome = phaseChrome(t.id, state);
                          const elapsed = state === "draft" ? 0 : Math.max(0, Math.min(shownW, nowIdx + intoWeek - sp.a));
                          const trained = !!p.program && p.program.loggedWeeks.length > 0;
                          return (
                            <div
                              key={p.id}
                              className={`rq-bar${trained ? " fixed" : ""}${sp.clippedStart ? " clip-start" : ""}${sp.clippedEnd ? " clip-end" : ""}${drag?.id === p.id ? " dragging" : ""}`}
                              style={{ gridColumn: `${sp.a + 1} / span ${shownW}`, gridRow: (laneOf.get(p.id) ?? 0) + 1, paddingLeft: `calc(14px + ${(Math.max(0, 0.5 + intoWeek - sp.a) / shownW) * 100}%)`, background: chrome.band, color: chrome.edge, borderColor: chrome.line, borderStyle: chrome.dashed ? "dashed" : "solid" }}
                              onPointerDown={(e) => {
                                if ((e.target as HTMLElement).closest(".rq-bar-edge")) return;
                                if (trained) return;
                                beginDrag(e, p, "move");
                              }}
                              onClick={() => {
                                if (justDragged.current || drag) return;
                                setDlg({ kind: "phase", phase: p });
                              }}
                              title={trained ? `${p.name} · the client trained in this programme, so its start stays; drag the right edge to change the end` : `${p.name} · click to edit · drag to move`}
                            >
                              {elapsed > 0 && <span className="rq-bar-elapsed" style={{ width: `${(elapsed / shownW) * 100}%` }} />}
                              {!sp.clippedStart && !trained && <span className="rq-bar-edge left" onPointerDown={(e) => beginDrag(e, p, "start")} onClick={(e) => e.stopPropagation()} />}
                              {!sp.clippedEnd && <span className="rq-bar-edge right" onPointerDown={(e) => beginDrag(e, p, "end")} onClick={(e) => e.stopPropagation()} />}
                              <span className="rq-bar-main">
                                <span className="rq-bar-name">{p.name}</span>
                                <span className="rq-bar-meta">
                                  {total} {total === 1 ? "week" : "weeks"}
                                </span>
                              </span>
                              {state === "draft" ? <span className="rq-bar-pill">Draft</span> : state === "live" ? <span className="rq-bar-pill">week {weeksBetween(sp.s, thisWeek) + 1} of {total}</span> : state === "scheduled" ? <span className="rq-bar-pill">starts {shortDate(sp.s)}</span> : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="rq-legend">
          <span>
            <i className="live" /> live
          </span>
          <span>
            <i className="scheduled" /> scheduled
          </span>
          <span>
            <i className="draft" /> draft, not sent
          </span>
          <span>
            <i className="done" /> weeks behind us
          </span>
          <span>
            <i className="now" /> now
          </span>
          <span>drag a bar to move it, its edge to change its length, click it to edit</span>
        </div>
      </section>

      {/* ---- Events: life around the plan, on the same weeks. */}
      <EventsCard clientId={clientId} events={plan.events} categories={plan.eventCategories} today={today} weeks={weeks} count={count} cols={cols} months={months} nowIdx={nowIdx} nowLeft={nowLeft} win={win} windows={WINDOWS} onWin={(w) => setWin(w as Win)} />

      {/* ---- Goals. */}
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>Goals</h2>
          <div className="rd-btn-group" role="group" aria-label="Which goals">
            {(["open", "done", "all"] as const).map((f) => (
              <button key={f} type="button" className={filter === f ? "on" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "open" ? `Open${openCount ? ` · ${openCount}` : ""}` : f === "done" ? "Done" : "All"}
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
          {shown.length === 0 && <p className="rd-full">{filter === "done" ? "Nothing closed yet." : `No goals yet. Add the first one; ${firstName} sees them on Home.`}</p>}
          {shown.map((g) => {
            const isDone = doneOf(g);
            const queued = pendingDone[g.id] != null;
            const textOnly = g.kind === "none";
            return (
              <div
                key={g.id}
                className={`rd-row${isDone ? " done" : ""}${g.id < 0 ? " new" : ""}${dragGoal === g.id ? " dragging" : ""}`}
                onDragOver={(e) => {
                  if (dragGoal != null) {
                    e.preventDefault();
                    moveGoal(g.id);
                  }
                }}
              >
                <div className="rd-row-main static" style={gGrid}>
                  <span className="rd-grip" draggable onDragStart={() => setDragGoal(g.id)} onDragEnd={() => setDragGoal(null)} title="Drag to reorder" aria-label={`Drag ${g.text}`}>
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
                        <DropdownMenuItem onSelect={() => setDlg({ kind: "goal", goal: g })}>Edit goal</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => toggleDone(g)}>{isDone ? "Reopen" : "Mark done"}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "removeGoal", id: g.id })}>
                          <TrashIcon /> Remove goal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
              </div>
            );
          })}
          <button type="button" className="rd-session add rm-additem" onClick={() => setDlg({ kind: "goal", goal: null })}>
            + Add goal
          </button>
          {goalChanges > 0 && (
            <div className="rd-pending">
              <span className="rd-pending-count">{goalChanges}</span>
              <span className="rd-pending-text">
                {[...(order ? ["order changed"] : []), ...Object.entries(pendingDone).map(([id, d]) => `${goals.find((g) => g.id === Number(id))?.text ?? "goal"} ${d ? "marked done" : "reopened"}`)].join(" · ")} · {firstName} sees the same list on Home
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
            others={phases}
            programs={plan.programs}
            onDelete={dlg.phase ? () => setDlg({ kind: "deletePhase", id: dlg.phase!.id }) : undefined}
            onSave={(v) => {
              const was = dlg.phase;
              close();
              if (was) {
                setPhases((prev) => prev.map((p) => (p.id === was.id ? { ...p, name: v.name, start_week: v.start, end_week: v.end } : p)));
                act(() => updateClientPhaseAction(phaseForm({ id: was.id, ...v })), `${v.name}: ${shortDate(v.start)} → ${shortDate(addWeeks(v.end, 1))}`);
              } else {
                act(() => addClientPhaseAction(phaseForm({ clientId, ...v })), `${v.name} drafted on ${TRACK_LABEL[v.track]}: ${shortDate(v.start)} → ${shortDate(addWeeks(v.end, 1))}`);
              }
            }}
            onSend={(v) => {
              const was = dlg.phase;
              close();
              if (!was) return;
              const fd = phaseForm({ id: was.id, ...v });
              act(() => (v.now ? saveAndDeployPhaseNowAction(fd) : saveAndSchedulePhaseAction(fd)), v.now ? `${v.name} is live` : `${v.name} scheduled for ${fmtDay(v.start)}`);
            }}
          />
        )}
        {dlg?.kind === "move" && phases.find((p) => p.id === dlg.id) && <MoveDialog phase={phases.find((p) => p.id === dlg.id)!} start={dlg.start} end={dlg.end} today={today} onCancel={close} onSave={() => {
          const p = phases.find((x) => x.id === dlg.id)!;
          setPhases((prev) => prev.map((x) => (x.id === dlg.id ? { ...x, start_week: dlg.start, end_week: dlg.end } : x)));
          close();
          act(() => updateClientPhaseAction(phaseForm({ id: p.id, name: p.name, track: p.track, start: dlg.start, end: dlg.end })), `${p.name}: ${shortDate(dlg.start)} → ${shortDate(addWeeks(dlg.end, 1))}`);
        }} />}
        {dlg?.kind === "deletePhase" && phases.find((p) => p.id === dlg.id) && (
          <ConfirmDialog
            title={`Delete ${phases.find((p) => p.id === dlg.id)!.name}?`}
            description={phases.find((p) => p.id === dlg.id)!.program ? "The phase comes off the plan. The programme behind it stays on the Training tab as a draft." : `The phase comes off the plan and off ${firstName}'s app.`}
            confirm="Delete phase"
            danger
            onConfirm={() => {
              const id = dlg.id;
              setPhases((prev) => prev.filter((p) => p.id !== id));
              close();
              const fd = new FormData();
              fd.set("id", String(id));
              act(() => removeClientPhaseAction(fd), "Phase deleted");
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
            title="Remove this goal?"
            description={`It comes off ${firstName}'s Home and the Meetings tab. Marking it done keeps it in the record instead.`}
            confirm="Remove goal"
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

/** Six rows of a month, the picked weeks tinted in the phase's own colours, other phases on the track as a grey mark. */
function MonthRange({ from, to, onPick, chrome, planned, cursor, setCursor, today }: { from: string; to: string; onPick: (day: string) => void; chrome: ReturnType<typeof phaseChrome>; planned: { name: string; from: string; to: string }[]; cursor: string; setCursor: (m: string) => void; today: string }) {
  const [y, mo] = cursor.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const gridStart = mondayOf(isoOf(first));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const move = (n: number) => setCursor(isoOf(new Date(y, mo - 1 + n, 1)).slice(0, 7));
  return (
    <div className="rdd-cal">
      <div className="rdd-cal-head">
        <b>{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
        <span className="rdd-cal-nav">
          <button type="button" className="rd-btn ghost sm" onClick={() => move(-1)} aria-label="Previous month">
            <ChevronLeftIcon />
          </button>
          <button type="button" className="rd-btn ghost sm next" onClick={() => move(1)} aria-label="Next month">
            <ChevronLeftIcon />
          </button>
        </span>
      </div>
      <div className="rdd-cal-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="rdd-dow">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const inR = !!from && !!to && d >= from && d <= to;
          const busy = planned.find((p) => d >= p.from && d <= p.to);
          return (
            <button
              key={d}
              type="button"
              className={`rdd-cell${d === today ? " today" : ""}${inR ? " in" : ""}${d === from ? " start" : ""}${d === to ? " end" : ""}${parse(d).getMonth() !== mo - 1 ? " past" : ""}`}
              style={inR ? { background: d === from || d === to ? chrome.edge : chrome.band, color: d === from || d === to ? "#fff" : chrome.edge } : undefined}
              onClick={() => onPick(d)}
              aria-label={fmtDay(d)}
              aria-pressed={d === from || d === to}
              title={busy ? `${busy.name} is planned here` : undefined}
            >
              {Number(d.slice(8))}
              {busy && !inR && <i className="rq-busy" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhaseDialog({ clientId, firstName, today, thisWeek, phase, track: initialTrack, others, programs, onSave, onDelete, onSend }: { clientId: number; firstName: string; today: string; thisWeek: string; phase: PlanPhaseRow | null; track?: PhaseTrack; others: PlanPhaseRow[]; programs: PlanProgramOption[]; onSave: (v: { name: string; track: PhaseTrack; start: string; end: string; programId: number | null }) => void; onDelete?: () => void; onSend: (v: { name: string; track: PhaseTrack; start: string; end: string; now: boolean }) => void }) {
  const editing = !!phase;
  const [track, setTrack] = useState<PhaseTrack>(phase?.track ?? initialTrack ?? "nutrition");
  const [name, setName] = useState(phase?.name ?? "");
  const [from, setFrom] = useState(phase?.start_week ?? thisWeek);
  const [to, setTo] = useState(phase ? addDays(phase.end_week, 6) : addDays(addWeeks(thisWeek, 3), 6));
  const [cursor, setCursor] = useState(from.slice(0, 7));
  const [picking, setPicking] = useState<"start" | "end">("start");
  const [programChoice, setProgramChoice] = useState<string>(phase?.program ? String(phase.program.id) : "new");
  // A live programme starts on the week it went out, where the client began it: only the end moves.
  const startLocked = !!phase?.program && phase.program.status === "live";
  const isDraft = !phase ? true : phase.draft || phase.program?.status === "draft";
  const startWeek = mondayOf(from);
  const endWeek = mondayOf(to);
  const state = phaseStateOf({ draft: isDraft, startWeek, endWeek, today });
  const chrome = phaseChrome(track, state);
  const weeks = weeksBetween(startWeek, endWeek) + 1;
  const planned = others.filter((o) => o.track === track && o.id !== phase?.id).map((o) => ({ name: o.name, from: o.start_week, to: addDays(o.end_week, 6) }));
  const overlap = planned.find((p) => p.from <= to && p.to >= from) ?? null;

  const setStart = (d: string) => {
    if (startLocked) return;
    const s = mondayOf(d);
    setFrom(s);
    if (to < s) setTo(addDays(s, 6));
    setCursor(s.slice(0, 7));
  };
  const setEnd = (d: string) => {
    const e = addDays(mondayOf(d), 6);
    if (e < from) return setStart(d);
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
  const ok = name.trim().length > 0 && from <= to;
  const startsNow = startWeek <= today;
  const loose = programs.filter((p) => !p.linked);
  const linkedProgram = programChoice !== "new" ? programs.find((p) => p.id === Number(programChoice)) ?? null : null;

  return (
    <DialogContent className="rd-dlg rq-phase-dlg">
      <DialogHeader>
        <DialogTitle>
          <span className="rq-title-row">
            {editing ? phase.name : "New phase"}
            {/* Which track it is on, in that track's colour, then its state. */}
            {editing && (
              <span className="rq-state" style={{ background: TRACK_PALETTE[track].tint, color: TRACK_PALETTE[track].ink }}>
                {TRACK_LABEL[track]}
              </span>
            )}
            <span className="rq-state" style={{ background: chrome.chipBg, color: chrome.chipInk }}>
              {STATE_LABEL[state]}
            </span>
            {/* Straight to the tab where the phase's contents live. */}
            {editing && (
              <Link
                className="rq-open"
                href={
                  track === "training"
                    ? `/admin/redesign/training?client=${clientId}${phase.program ? `&program=${phase.program.id}` : ""}`
                    : `/admin/redesign/${track === "nutrition" ? "nutrition" : "measurements"}?client=${clientId}&phase=${phase.id}`
                }
              >
                Open in {TRACK_LABEL[track] === "Lifestyle" ? "Measurements" : TRACK_LABEL[track]} ↗
              </Link>
            )}
          </span>
        </DialogTitle>
        {!editing && <DialogDescription>Which track, what it is called, and the weeks it runs. Weeks run Monday to Sunday.</DialogDescription>}
      </DialogHeader>
      {!editing && (
        <div className="rd-field">
          <span>Track</span>
          <div className="rq-kinds">
            {TRACKS.map((t) => (
              <button key={t.id} type="button" className={`rd-chip${track === t.id ? " on" : ""}`} style={track === t.id ? { background: TRACK_PALETTE[t.id].ink, borderColor: TRACK_PALETTE[t.id].ink } : undefined} onClick={() => setTrack(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="rd-field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={track === "nutrition" ? "Cut A" : track === "training" ? "Strength block" : "Sleep focus"} maxLength={60} autoFocus={!editing} />
      </label>
      <div className="rdd-cols">
        <MonthRange from={from} to={to} onPick={pick} chrome={chrome} planned={planned} cursor={cursor} setCursor={setCursor} today={today} />
        <div className="rdd-fields">
          <label className="rd-field">
            <span>Starts{startLocked ? " · fixed" : ""}</span>
            <DateText value={from} disabled={startLocked} onChange={setStart} label="Starts" onFocus={() => setPicking("start")} />
          </label>
          <label className="rd-field">
            <span>Ends</span>
            <DateText value={to} onChange={setEnd} label="Ends" onFocus={() => setPicking("end")} />
          </label>
          <div className="rd-field">
            <span>Length</span>
            <span className="rdd-length">
              {weeks} {weeks === 1 ? "week" : "weeks"}
              <small>
                {shortDate(from)} – {shortDate(to)}
              </small>
            </span>
          </div>
          {/* Only when a draft programme is waiting on the Training tab with no phase of its own: then this phase can be it rather than a second one. */}
          {!editing && loose.length > 0 && (
            <div className="rd-field" style={{ visibility: track === "training" ? "visible" : "hidden" }} aria-hidden={track !== "training"}>
              <span>Built from</span>
              <Picker value={programChoice} onChange={setProgramChoice} label="Programme" className="rq-wide" options={[{ value: "new", label: "A new programme", hint: `${weeks} weeks` }, ...loose.map((p) => ({ value: String(p.id), label: p.name, hint: `${p.weeks} weeks · ${p.status}` }))]} />
            </div>
          )}
          {track === "training" && editing && phase.program && <p className="rd-dlg-hint">The programme behind it has {phase.program.totalWeeks} weeks; its dates follow this phase.</p>}
          <p className="rdd-picking">{startLocked ? "The client already trained in it, so the start stays. Click a day for the end." : picking === "start" ? "Click a day for the start." : "Now click a day for the end."}</p>
          {/* Always a line, so the dialog keeps its height whether or not there is an overlap to say. */}
          <p className="rq-overlap">{overlap ? `Overlaps ${overlap.name} on the same track.` : " "}</p>
        </div>
      </div>
      <DialogFooter>
        <span className="rd-dlg-hint grow">{state === "draft" ? `Only you see a draft until it is sent.` : startsNow ? `${firstName} sees it now.` : `${firstName} sees it from ${fmtDay(startWeek)}.`}</span>
        {onDelete && (
          <button type="button" className="rd-btn danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <DialogClose className="rd-btn">Cancel</DialogClose>
        {editing && isDraft && (
          <button type="button" className="rd-btn" disabled={!ok} onClick={() => onSend({ name: name.trim(), track, start: startWeek, end: endWeek, now: startsNow })}>
            {startsNow ? "Make it live" : "Schedule it"}
          </button>
        )}
        <button type="button" className="rd-btn primary" disabled={!ok} onClick={() => onSave({ name: name.trim(), track, start: startWeek, end: endWeek, programId: linkedProgram?.id ?? null })}>
          {editing ? "Save" : "Create draft"}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

/** A finished drag waits here: the dates as they were and as they will be. */
function MoveDialog({ phase: p, start, end, today, onCancel, onSave }: { phase: PlanPhaseRow; start: string; end: string; today: string; onCancel: () => void; onSave: () => void }) {
  const isDraft = p.draft || p.program?.status === "draft";
  const state = phaseStateOf({ draft: isDraft, startWeek: start, endWeek: end, today });
  const chrome = phaseChrome(p.track, state);
  const wasLive = phaseStateOf({ draft: isDraft, startWeek: p.start_week, endWeek: p.end_week, today }) === "live";
  const last = (monday: string) => fmtDay(addDays(monday, 6));
  const rows = [
    { label: "Start", was: fmtDay(p.start_week), now: fmtDay(start) },
    { label: "End", was: last(p.end_week), now: last(end) },
    { label: "Length", was: `${weeksBetween(p.start_week, p.end_week) + 1} weeks`, now: `${weeksBetween(start, end) + 1} weeks` },
  ];
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>
          <span className="rq-title-row">
            Move {p.name}
            <span className="rq-state" style={{ background: chrome.chipBg, color: chrome.chipInk }}>
              {STATE_LABEL[state]}
            </span>
          </span>
        </DialogTitle>
        <DialogDescription>{p.program ? "The training programme moves with it." : `${TRACK_LABEL[p.track]} phase.`}</DialogDescription>
      </DialogHeader>
      <div className="rd-rows">
        {rows.map((r) => (
          <div key={r.label} className="rd-row">
            <div className="rd-row-main static" style={{ gridTemplateColumns: "80px minmax(0, 1fr) 20px minmax(0, 1fr)", columnGap: 12 }}>
              <span className="rd-cols" style={{ padding: 0 }}>
                {r.label}
              </span>
              <span className={`rd-num${r.was === r.now ? "" : " quiet"}`}>{r.was}</span>
              <span className="rd-num quiet">{r.was === r.now ? "" : "→"}</span>
              <span className="rd-num">{r.was === r.now ? "" : r.now}</span>
            </div>
          </div>
        ))}
      </div>
      <DialogFooter>
        <span className="rd-dlg-hint grow">{wasLive ? "This phase is live: the client's app changes as soon as you save." : ""}</span>
        <button type="button" className="rd-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="rd-btn primary" onClick={onSave} autoFocus>
          Save new dates
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---- The goal dialog: pick the thing to watch, say the target as one sentence, see the client's card.

type Kind = PlanGoalRow["kind"];
type Thing = { id: string; kind: Kind; tab: Kind; name: string; hint: string; unit?: string; metricKey?: string; exerciseId?: number; habitId?: number; now?: number | null; series?: { date: string; value: number }[]; best?: { weight: number; reps: number } | null };

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
        return { id: `m:${m.key}`, kind: "metric" as Kind, tab: (m.group === "nutrition" ? "metric" : "habit") as Kind, name: m.name, unit: m.unit, metricKey: m.key, now: latest?.value ?? null, series: m.series, hint: latest ? `now ${fmtNum(latest.value)}${m.unit ? ` ${m.unit}` : ""}` : "nothing logged yet" };
      }),
    ...options.exercises.map((e) => {
      const sets = e.sets.filter((s) => s.weight != null && s.reps != null);
      const best = [...sets].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
      return { id: `e:${e.id}`, kind: "exercise" as Kind, tab: "exercise" as Kind, name: e.name, unit: "kg", exerciseId: e.id, best: best ? { weight: best.weight!, reps: best.reps! } : null, hint: best ? `best ${fmtNum(best.weight!)} × ${best.reps}` : "no sets logged yet" };
    }),
    ...options.habits.map((h) => ({ id: `h:${h.id}`, kind: "habit" as Kind, tab: "habit" as Kind, name: `${h.name} · days a week`, habitId: h.id, hint: "daily check-in, as a habit" })),
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

  // The blanks in the sentence.
  const [dir, setDir] = useState<"<=" | ">=">(t?.kind === "metric" ? t.op : t?.kind === "habit" ? t.op : "<=");
  const [target, setTarget] = useState(t?.kind === "metric" ? String(t.target) : t?.kind === "habit" ? String(t.value) : "");
  // The deadline: the end of a phase (it follows the bar when the phase
  // moves), a date of the coach's own, or none. Phases still to come, live
  // first, then by start; a phase already over is no deadline to offer.
  const ends = phases
    .filter((p) => addDays(p.end_week, 6) >= today)
    .sort((a, b) => a.start_week.localeCompare(b.start_week) || a.end_week.localeCompare(b.end_week))
    .map((p) => ({ id: p.id, name: p.name, date: addDays(p.end_week, 6), live: p.start_week <= today }));
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
    return `Habit · ${th.name} ${dir} ${fmtNum(tracking.value)} · ${tracking.daysPerWeek} / wk`;
  })();

  // The client's card, as it would read today.
  const preview = (() => {
    if (!th || !tracking) return null;
    if (tracking.kind === "metric") {
      const now = th.now;
      if (now == null) return { now: "nothing logged yet", pct: 0, tone: "muted" as const };
      const reached = dir === "<=" ? now <= tracking.target : now >= tracking.target;
      const start = th.series?.[0]?.value ?? now;
      const span = Math.abs(start - tracking.target) || 1;
      const pct = reached ? 100 : Math.max(0, Math.min(99, Math.round((Math.abs(start - now) / span) * 100)));
      return { now: `now ${fmtNum(now)}${unit ? ` ${unit}` : ""}`, pct, tone: reached ? ("green" as const) : ("orange" as const) };
    }
    if (tracking.kind === "exercise") {
      if (!th.best) return { now: "no sets logged yet", pct: 0, tone: "muted" as const };
      const reached = th.best.weight >= tracking.weight && th.best.reps >= tracking.reps;
      return { now: `best ${fmtNum(th.best.weight)} × ${th.best.reps}`, pct: reached ? 100 : Math.max(0, Math.min(99, Math.round((th.best.weight / tracking.weight) * 100))), tone: reached ? ("green" as const) : ("orange" as const) };
    }
    return { now: `${tracking.daysPerWeek} days a week to hit`, pct: 0, tone: "muted" as const };
  })();

  const blank = (value: string, set: (v: string) => void, width: number, label: string) => <input className="rq-blank" style={{ width }} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} aria-label={label} />;

  return (
    <DialogContent className="rd-dlg rq-dlg">
      <DialogHeader>
        <DialogTitle>{goal ? "Edit goal" : "New goal"}</DialogTitle>
        {/* The title says it all; the description is for screen readers only. */}
        <DialogDescription hidden>Pick what to watch, say the target, and {firstName} gets a card that keeps itself up to date.</DialogDescription>
      </DialogHeader>

      {/* 1. What to watch. */}
      {thing == null ? (
        <div className="rd-field">
          <span>What to watch</span>
          {/* Words first: a goal needs nothing behind it. Then what the client logs, in three groups. */}
          <button type="button" className="rq-words" onClick={() => pick("words")}>
            <span className="rq-words-main">
              <b>A plain goal</b>
              <small>No tracking; you tick it off when it is done.</small>
            </span>
            <PlusIcon />
          </button>
          <input className="rd-addrow-search rq-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Or track it against something: weight, bench press, sleep…" autoFocus aria-label="What to watch" />
          <div className="rd-btn-group rq-groups" role="group" aria-label="Which group">
            {(
              [
                ["exercise", "Exercises"],
                ["metric", "Nutrition"],
                ["habit", "Check-ins"],
              ] as [typeof section, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" className={section === k ? "on" : ""} aria-pressed={section === k} onClick={() => setSection(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="rd-addrow-list rq-things" role="listbox">
            {(
              [
                ["exercise", "Exercises"],
                ["metric", "Nutrition"],
                ["habit", "Check-ins"],
              ] as [Kind, string][]
            )
              .filter(([k]) => section === k)
              .map(([k, label]) => {
                const rows = matches.filter((x) => x.tab === k);
                if (rows.length === 0) return null;
                return (
                  <div key={k} className="rq-group">
                    <span className="rd-menu-head">{label}</span>
                    {rows.map((x) => (
                      <button key={x.id} type="button" role="option" aria-selected={false} className="rd-addrow-item" onClick={() => pick(x)}>
                        {x.name}
                        <small>{x.hint}</small>
                      </button>
                    ))}
                  </div>
                );
              })}
            {matches.filter((x) => x.tab === section).length === 0 && <p className="rd-addrow-hint">Nothing {firstName} logs matches that.</p>}
          </div>
        </div>
      ) : (
        <div className="rd-field">
          <span>Watching</span>
          <div className="rq-thing">
            <span className="rd-pill">{thing === "words" ? "Nothing · a plain goal" : thing.name}</span>
            {thing !== "words" && <small>{thing.hint}</small>}
            <button type="button" className="rd-ex-btn rq-change" onClick={() => setThing(null)}>
              change
            </button>
          </div>
        </div>
      )}

      {/* 2. The target, as a sentence with blanks. */}
      {th && (
        <div className="rd-field">
          <span>Target</span>
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
                    ...ends.map((e) => ({ value: `p:${e.id}`, label: `End of ${e.name}`, hint: `${shortDate(e.date)}${e.live ? " · live" : ""}` })),
                    { value: "date", label: "A date…", hint: "Pick a day" },
                    { value: "none", label: "No deadline" },
                  ]}
                />
                {byMode === "date" && <DatePick value={byDate} onChange={setByDate} label="By" className="rq-inline-date" />}
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
          <label className="rd-field">
            <span>{thing === "words" ? "Goal" : "How it reads"}</span>
            <input
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
          <div className="rq-preview" aria-label={`${firstName}'s card`}>
            <small>On {firstName}&rsquo;s Home</small>
            <b>{shownText.trim() || "…"}</b>
            {preview ? (
              <span className={`rq-pct ${preview.tone}`}>
                <i>
                  <b style={{ width: `${preview.pct}%` }} />
                </i>
                <small>{preview.now}</small>
              </span>
            ) : (
              <span className="rq-preview-hint">{thing === "words" ? `${firstName} ticks it off when it is done; you can too.` : "Fill the blanks to see where it stands."}</span>
            )}
          </div>
        </>
      )}

      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!ok} onClick={() => onSave({ text: shownText.trim(), kind: th?.kind ?? "none", rule, tracking, by: tracking?.kind === "metric" ? byRow : tracking ? "ongoing" : null, tracks: th ? th.name : null })}>
          {goal ? "Save" : "Add goal"}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}
