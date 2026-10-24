"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { PhaseTrack } from "../../../lib/db";
import { Popover, PopoverAnchor, PopoverContent } from "../../../components/ui/popover";
import { phaseChrome, phaseStateOf, STATE_LABEL, stateTagStyle, TRACK_LABEL } from "../../phaseChrome";
import { Sep, SepJoin } from "../Sep";
import { dayMonth } from "../../../lib/dayMonth";
import { repeatWords, type EventRepeat } from "../../../lib/eventRepeat";
import { EVENT_TYPES, eventTypeOf, isEventTypeId } from "../../../lib/eventTypes";

// The Plan's timeline, in one place (21 Oct): the week grid's maths, the
// months and weeks over it with the NOW line, a row of lanes, its empty
// weeks, a phase bar, an event bar or pin, with the Plan's own classes
// (plan.css, rq-). The Plan's Phases and Events cards draw through these
// and add their dragging (the optional drag props); the all-clients Phases
// screen draws every client with them, read-only. So the bars, pins, NOW
// line and axis are the same on both screens.

// ---- The grid's maths.

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return isoOf(x);
};
const addWeeks = (monday: string, n: number) => addDays(monday, n * 7);
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
const mondayOf = (d: string) => addDays(d, -((parse(d).getDay() + 6) % 7));
export const weeksBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / (7 * DAY));
/** The timeline's axis keeps the month's name under its month heads; a screen reader gets the whole day. */
export const axisDate = (d: string) => parse(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const monthName = (d: string) => parse(d).toLocaleDateString("en-GB", { month: "short" });
export const isoWeek = (day: string) => {
  const thursday = parse(addDays(mondayOf(day), 3));
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1.getTime()) / DAY / 7) + 1;
};
export const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/**
 * The week grid for a window: last week for context, this week in the second
 * column, and most of the grid what is coming. "Now" is one fixed line a week
 * and a half in; the weeks slide under it as the week goes by. A phase that
 * just ended stays a week and drifts off (no "Show past", 30 Sep). The line
 * stays where it is drawn and the weeks slide so today's day is under it
 * (30 Sep: the weeks sat a week off the line, so the bars' "behind us" shade
 * stopped short of it).
 */
export function gridFor(win: number, thisWeek: string, intoWeek: number, /** Weeks stepped back into the past (21 Oct); 0 is today's window. */ pastBy = 0) {
  const back = 1;
  const first = addWeeks(thisWeek, -back - pastBy);
  const count = win + back;
  const weeks = Array.from({ length: count }, (_, i) => addWeeks(first, i));
  const nowIdx = weeksBetween(first, thisWeek);
  const months: { label: string; start: number; span: number }[] = [];
  weeks.forEach((w, i) => {
    const label = monthName(w);
    const prev = months[months.length - 1];
    if (prev && prev.label === label) prev.span += 1;
    else months.push({ label, start: i, span: 1 });
  });
  // Stepped back into the past: whole weeks, no slide under the now line (which shows only while it is still on screen).
  const shift = pastBy ? 0 : (nowIdx + intoWeek) * (1 - win / count);
  const nowCol = nowIdx + intoWeek - shift;
  const cols: React.CSSProperties = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, width: `${(count / win) * 100}%`, transform: `translateX(${-(shift / count) * 100}%)` };
  // The "now" line at today's spot; none when today is past the window's right edge.
  const nowLeft = nowCol >= 0 && nowCol <= win ? `calc(108px + (100% - 108px) * ${nowCol / win})` : null;
  return { first, count, weeks, nowIdx, months, cols, nowLeft, shift };
}

export type Grid = ReturnType<typeof gridFor>;

/** A lane, a phase's or an event's (21 Oct, Alex: the same size): a 38px bar with 3px above and below; plan.css's .rq-bar and .rq-evbar. */
export const LANE = 44;
/** An event bar's or a pin's top in its lanes: the lanes' 6px padding, the 3px over the bar, then a lane each. */
export const evTop = (lane: number) => `${9 + lane * LANE}px`;

// ---- The axis and the rows.

/** The months over the grid, as the Plan's first row. */
export function MonthsRow({ grid }: { grid: Grid }) {
  return (
    <div className="rq-tl-row">
      <span />
      <div className="rq-tl-clip">
        <div className="rq-tl-grid" style={grid.cols}>
          {grid.months.map((m) => (
            <span key={m.start} className="rq-month" style={{ gridColumn: `${m.start + 1} / span ${m.span}` }}>
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The weeks under them: the week number over its Monday, this week in ink. `gridRef` measures the grid's width. The Events card shows the Mondays alone (`numbers={false}`). */
export function WeeksRow({ grid, gridRef, numbers = true }: { grid: Grid; gridRef?: React.Ref<HTMLDivElement>; numbers?: boolean }) {
  return (
    <div className="rq-tl-row">
      <span />
      <div className="rq-tl-clip">
        <div ref={gridRef} className="rq-tl-grid" style={grid.cols}>
          {grid.weeks.map((w, i) => (
            <span key={w} className={`rq-week${i === grid.nowIdx ? " now" : ""}`}>
              {numbers && <b>W{isoWeek(w)}</b>}
              <small>{axisDate(w)}</small>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A whole timeline: the months, then under the NOW line the weeks and the rows given (LaneRow). */
/** Sideways scrolling moves the window (23 Oct, Alex: a mouse with a side wheel): a week a notch (about 48px of
    sideways travel), earlier to the left, later to the right. Up and down still scrolls the page; while the timeline
    itself overflows (a narrow page), it scrolls its own width first. */
const WEEK_PX = 48;
export function useSideScroll(onStep?: (weeks: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let travel = 0;
    const wheel = (e: WheelEvent) => {
      if (!step.current) return;
      const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
      if (Math.abs(dx) <= Math.abs(e.shiftKey ? 0 : e.deltaY)) return;
      // The timeline's own scroll first, while it has room that way.
      if (dx < 0 ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth - 1) return;
      e.preventDefault();
      travel += e.deltaMode === 1 ? dx * 16 : dx;
      const weeks = Math.trunc(travel / WEEK_PX);
      if (weeks !== 0) {
        travel -= weeks * WEEK_PX;
        step.current(weeks);
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  return ref;
}

export function Timeline({ grid, minWidth = Math.round(grid.count * 63), weeksRef, weekNumbers, onStep, children }: { grid: Grid; minWidth?: number; weeksRef?: React.Ref<HTMLDivElement>; weekNumbers?: boolean; /** Sideways scrolling: weeks later (+) or earlier (−). */ onStep?: (weeks: number) => void; children: React.ReactNode }) {
  const scroll = useSideScroll(onStep);
  return (
    <div className="rq-tl-scroll" ref={scroll}>
      <div className="rq-tl" style={{ minWidth }}>
        <MonthsRow grid={grid} />
        <div className="rq-tl-body">
          {grid.nowLeft && <span className="rq-now" style={{ left: grid.nowLeft }} title="Now" />}
          <WeeksRow grid={grid} gridRef={weeksRef} numbers={weekNumbers} />
          {children}
        </div>
      </div>
    </div>
  );
}

/** A lane's label: the track's (or event kind's) icon in its colour, its name in ink. No label, an empty cell. */
export function LaneLabel({ icon, color, label }: { icon?: React.ReactNode; color?: string; label?: string }) {
  if (label == null) return <div className="rq-tl-label" />;
  return (
    <div className="rq-tl-label">
      <span className="rq-track">
        {icon && (
          <span className="rq-track-ic" style={{ color }}>
            {icon}
          </span>
        )}
        {label}
      </span>
    </div>
  );
}

/**
 * A row of lanes: its label, then the week grid with `lanes` lanes (an
 * events row is `events`, its marks placed by percentages). A drag's pointer
 * moves and letting go are caught here, on the grid the bar was pressed in.
 */
export function LaneRow({ grid, lanes, events = false, icon, color, label, gridRef, onDragMove, onDragEnd, children }: { grid: Grid; lanes: number; events?: boolean; icon?: React.ReactNode; color?: string; label?: string; gridRef?: React.Ref<HTMLDivElement>; onDragMove?: (e: React.PointerEvent) => void; onDragEnd?: (e: React.PointerEvent) => void; children: React.ReactNode }) {
  return (
    <div className="rq-tl-row">
      <LaneLabel icon={icon} color={color} label={label} />
      <div className="rq-tl-clip">
        <div ref={gridRef} className={`rq-tl-grid rq-lanes${events ? " rq-evlanes" : ""}`} style={{ ...grid.cols, gridTemplateRows: `repeat(${lanes}, ${LANE}px)` }} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** An empty week on a lane is a way in (20 Oct, Alex): a + on hover, a click adds from that week. Bars sit over them. */
export function AddCells({ grid, lanes, label, title, onAdd }: { grid: Grid; lanes: number; label: (week: string) => string; title?: (week: string) => string; onAdd: (week: string, ev: React.MouseEvent<HTMLElement>) => void }) {
  return (
    <>
      {grid.weeks.map((w, i) => (
        <span key={w} className="rq-cell add" style={{ gridColumn: i + 1, gridRow: `1 / span ${lanes}` }} role="button" tabIndex={-1} aria-label={label(w)} title={title?.(w)} onClick={(ev) => onAdd(w, ev)} />
      ))}
    </>
  );
}

/** "None yet + Add" on a lane with nothing on it, from this week on; none when this week is off the window. */
export function EmptyLane({ grid, onAdd }: { grid: Grid; onAdd: () => void }) {
  if (grid.nowIdx >= grid.count) return null;
  return (
    <button type="button" className="rq-empty" style={{ gridColumn: `${grid.nowIdx + 1} / span ${Math.min(grid.count - grid.nowIdx, 8)}`, gridRow: 1 }} onClick={onAdd}>
      None yet <b>+ Add</b>
    </button>
  );
}

// ---- Phases.

/**
 * The week columns a phase is drawn in, as the Plan's: the column its first
 * day falls in to the column of its last week's Monday, cut to the window.
 * The end is a day of the last week: its own column, never the week after
 * (30 Sep: "+ 6 days" pushed a mid-week end into the next phase's first week).
 */
export function weekSpan(startWeek: string, endWeek: string, first: string, count: number) {
  const col = (day: string) => Math.floor(daysBetween(first, day) / 7);
  const sc = col(startWeek);
  const ec = col(endWeek);
  const a = Math.max(0, sc);
  const b = Math.min(count - 1, ec);
  return { a, b, sc, ec, visible: b >= 0 && a <= count - 1, clippedStart: sc < 0, clippedEnd: ec > count - 1 };
}

/** Things that share a column stack into lanes, so two bars never sit on top of each other. */
export function packLanes<T extends { id: number }>(items: T[], cells: (x: T) => { from: number; to: number }) {
  const lanes: T[][] = [];
  const laneOf = new Map<number, number>();
  for (const p of items) {
    const cp = cells(p);
    let li = lanes.findIndex((l) =>
      l.every((q) => {
        const cq = cells(q);
        return cq.to < cp.from || cq.from > cp.to;
      })
    );
    if (li < 0) {
      lanes.push([]);
      li = lanes.length - 1;
    }
    lanes[li].push(p);
    laneOf.set(p.id, li);
  }
  return { laneOf, count: Math.max(1, lanes.length) };
}

/** A phase with nothing in it yet (20 Oct, Alex): a small warning sign on its bar, what it lacks on hover or focus.
 *  The message floats (a popover) because a bar clips what is inside it; pressing the sign never starts a drag. */
export function GapSign({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span
          className="rq-gap"
          tabIndex={0}
          role="img"
          aria-label={text}
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </span>
      </PopoverAnchor>
      <PopoverContent side="top" sideOffset={8} className="rq-gap-tip" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
        {text}
      </PopoverContent>
    </Popover>
  );
}

/**
 * A bar's dragging, on the Plan: its body moves it, an edge changes its
 * length. Each part only with its handler: no edge handler, no handle drawn;
 * no body handler, the bar is `fixed` (a click opens it, nothing moves).
 */
export type BarDrag = { dragging: boolean; onBody?: (e: React.PointerEvent) => void; onStart?: (e: React.PointerEvent) => void; onEnd?: (e: React.PointerEvent) => void };

/** Pressing a handle starts its drag, and its click never reaches the bar (which would open it). */
function Edges({ drag, left, right }: { drag?: BarDrag; left: boolean; right: boolean }) {
  return (
    <>
      {left && drag?.onStart && <span className="rq-bar-edge left" onPointerDown={drag.onStart} onClick={(e) => e.stopPropagation()} />}
      {right && drag?.onEnd && <span className="rq-bar-edge right" onPointerDown={drag.onEnd} onClick={(e) => e.stopPropagation()} />}
    </>
  );
}

/** The body's own press, not one on a handle. */
const bodyDown = (drag?: BarDrag) =>
  drag?.onBody
    ? (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest(".rq-bar-edge")) return;
        drag.onBody!(e);
      }
    : undefined;

export type BarPhase = { id: number; name: string; track: PhaseTrack; /** The Monday of its first week, as stored. */ startWeek: string; /** The Monday of its last week, as stored. */ endWeek: string; draft: boolean; /** What it still lacks (the Plan's warning sign). */ gap?: string | null };

/** A phase's bar, the Plan's: its state's colours, the name with its length under it, the state pill on the right. Opens on a click. */
export function PhaseBar({ phase: p, at, grid, row, today, thisWeek, intoWeek, onOpen, drag, keyboard = true }: {
  phase: BarPhase;
  /** Where it is drawn while dragged, or while the move waits for a yes; its own weeks otherwise. Its tooltip keeps its own. */
  at?: { startWeek: string; endWeek: string };
  grid: Grid;
  /** Its lane, from 0. */
  row: number;
  today: string;
  thisWeek: string;
  intoWeek: number;
  onOpen: () => void;
  drag?: BarDrag;
  /** Reached with Tab and opened with Enter or Space (the Phases screen). The Plan's bars are the pointer's alone, as they were. */
  keyboard?: boolean;
}) {
  const s = at?.startWeek ?? p.startWeek;
  const e = at?.endWeek ?? p.endWeek;
  const sp = weekSpan(s, e, grid.first, grid.count);
  if (!sp.visible) return null;
  const total = weeksBetween(s, e) + 1;
  const shownW = sp.b - sp.a + 1;
  const state = phaseStateOf({ draft: p.draft, startWeek: s, endWeek: e, today });
  const chrome = phaseChrome(p.track, state);
  const elapsed = state === "draft" ? 0 : Math.max(0, Math.min(shownW, grid.nowIdx + intoWeek - sp.a));
  return (
    <div
      className={`rq-bar is-${state}${drag?.onBody ? "" : " fixed"}${sp.clippedStart ? " clip-start" : ""}${sp.clippedEnd ? " clip-end" : ""}${drag?.dragging ? " dragging" : ""}`}
      style={{ gridColumn: `${sp.a + 1} / span ${shownW}`, gridRow: row + 1, paddingLeft: `calc(14px + ${(Math.max(0, grid.shift - sp.a) / shownW) * 100}%)`, background: chrome.band, color: chrome.edge, borderColor: chrome.dashed ? chrome.line : `rgba(${rgbOf(chrome.edge)}, 0.5)`, borderStyle: chrome.dashed ? "dashed" : "solid" }}
      role={keyboard ? "button" : undefined}
      tabIndex={keyboard ? 0 : undefined}
      aria-label={keyboard ? `${TRACK_LABEL[p.track]}: ${p.name}, ${STATE_LABEL[state]}, ${dayMonth(p.startWeek)} to ${dayMonth(addDays(p.endWeek, 6))}` : undefined}
      title={`${p.name} · ${dayMonth(p.startWeek)} – ${dayMonth(addDays(p.endWeek, 6))}`}
      onPointerDown={bodyDown(drag)}
      onClick={onOpen}
      onKeyDown={
        keyboard
          ? (ev) => {
              if (ev.target !== ev.currentTarget || (ev.key !== "Enter" && ev.key !== " ")) return;
              ev.preventDefault();
              onOpen();
            }
          : undefined
      }
    >
      {elapsed > 0 && <span className="rq-bar-elapsed" style={{ width: `${(elapsed / shownW) * 100}%` }} />}
      {/* No handle on an edge cut off by the window. */}
      <Edges drag={drag} left={!sp.clippedStart} right={!sp.clippedEnd} />
      <span className="rq-bar-main">
        <span className="rq-bar-name">{p.name}</span>
        <span className="rq-bar-meta">
          {total} {total === 1 ? "week" : "weeks"}
        </span>
      </span>
      {/* Nothing in it yet (20 Oct, Alex): a warning sign, what is missing on hover. Not on a past phase. */}
      {p.gap && state !== "past" && <GapSign text={p.gap} />}
      {/* Its state in words on the bar (30 Sep), in the state's colours (20 Oct, Alex): Live green, Scheduled blue, Draft peach. */}
      {state === "draft" ? (
        <span className="rq-bar-pill" style={stateTagStyle(state)}>
          Draft
        </span>
      ) : state === "live" ? (
        <span className="rq-bar-pill" style={stateTagStyle(state)}>
          <b>Live</b>
          <Sep />
          week {weeksBetween(s, thisWeek) + 1} of {total}
        </span>
      ) : state === "scheduled" ? (
        <span className="rq-bar-pill" style={stateTagStyle(state)}>
          <b>Scheduled</b>
          <Sep />
          starts {dayMonth(s)}
        </span>
      ) : null}
    </div>
  );
}

// ---- Events.

/** kind is the category's id, and optional: an event can just be an event. */
export type PlanEvent = { id: number; kind: string | null; title: string; start: string; end: string; note: string; /** The client added it from their Home. */ byClient?: boolean; /** Comes back on these weekdays (19 Oct), lib/eventRepeat.ts. */ repeat?: EventRepeat | null };

export type Category = { id: string; label: string; color: string; custom: boolean };
const NONE = { tint: "#eceff3", ink: "#5b6474", line: "#c3c9d2" };
// The built-in four and the coach's own come from the loader (listEventCategories).
/** The app's six event types colour everything here (10 Oct): the same six the client's sheet has, in the same colours. Anything else is grey "Event". */
export const chromeOf = (_cats: Category[], id: string | null) => {
  if (!isEventTypeId(id)) return { label: "Event", ...NONE };
  const t = eventTypeOf(id);
  return { label: t.label, tint: `rgba(${t.rgb}, 0.12)`, ink: t.color, line: `rgba(${t.rgb}, 0.45)` };
};

/** "in 3 weeks", "in 5 days", "today", "2 days ago", "6 weeks ago". */
export const relative = (today: string, d: string) => {
  const n = daysBetween(today, d);
  if (n === 0) return "today";
  const abs = Math.abs(n);
  const w = abs >= 14 ? `${Math.round(abs / 7)} weeks` : abs === 1 ? "1 day" : `${abs} days`;
  return n > 0 ? `in ${w}` : `${w} ago`;
};
/** The words on a bar or pin: where it stands against today, as its facts ("now", "3 days left"); on screen a bar parts them. */
export const standingParts = (today: string, e: PlanEvent): string[] => {
  const single = e.start === e.end;
  // A timestamp is only ever "in 3 days", "today" or "2 days ago".
  if (single) return [relative(today, e.start)];
  if (today < e.start) return [relative(today, e.start)];
  if (today > e.end) return [`ended ${relative(today, e.end)}`];
  // Repeating with no end (19 Oct): its stored end is only a horizon.
  if (e.repeat && !e.repeat.until) return ["ongoing"];
  const left = daysBetween(today, e.end);
  return left === 0 ? ["last day"] : ["now", `${left} day${left === 1 ? "" : "s"} left`];
};
/** A bar's pill, as a phase bar's "week 3 of 6" (21 Oct, Alex): on now, `Day 18 of 23` (a repeating one with no end,
    `Ongoing`); still to come or over, nothing (21 Oct, Alex: a coming one is just its days). */
export const barStanding = (today: string, e: PlanEvent): string | null => {
  if (today < e.start || today > e.end) return null;
  if (e.repeat && !e.repeat.until) return "Ongoing";
  return `Day ${daysBetween(e.start, today) + 1} of ${daysBetween(e.start, e.end) + 1}`;
};

/** Over and done (20 Oct, Alex: a past event isn't editable any more): ended before today; a repeat only once its last day has gone. */
export const eventIsPast = (e: PlanEvent, today: string) => (e.repeat ? e.repeat.until != null && e.repeat.until < today : e.end < today);

/** An event's state, as a phase's (24 Oct, Alex: an event and a phase read the same): on now Live, still to come
    Scheduled, over Past. For the state tag (STATE_TAG) on its pop-ups. */
export const eventState = (e: PlanEvent, today: string): "live" | "scheduled" | "past" => (eventIsPast(e, today) ? "past" : today < e.start ? "scheduled" : "live");

/** A name for an event in a title: its own, else its category's ("Family event"; 24 Oct, Alex: never "something"). */
export const eventName = (e: { title: string }, label: string) => e.title.trim() || `${label} event`;

/** Where an event sits on the grid, as percentages of its width; a day is a seventh of a week's column. */
export function eventPlace(e: { start: string; end: string }, first: string, totalDays: number) {
  const a = daysBetween(first, e.start);
  const b = daysBetween(first, e.end) + 1;
  return { left: (Math.max(0, a) / totalDays) * 100, width: (Math.max(0.6, Math.min(totalDays, b) - Math.max(0, a)) / totalDays) * 100, visible: b > 0 && a < totalDays };
}

/**
 * The events on the grid as rows: one a kind with something on the grid, in
 * the app's kind order, "Event" last. Within a row, ones that overlap stack
 * into lanes; a pin's words need room to its right too, measured in days of
 * this screen's grid (`dayPx`), so the reach is what the label takes here.
 */
export function eventLanes<T extends PlanEvent>(onGrid: T[], cats: Category[], dayPx: number) {
  const reach = (e: T) => (e.start === e.end ? addDays(e.start, Math.ceil((e.title.length * 6.6 + 28) / dayPx)) : e.end);
  const laneOf = new Map<number, number>();
  const groups = [...EVENT_TYPES.map((t) => t.id), null]
    .map((id) => ({ id, chrome: chromeOf(cats, id), events: onGrid.filter((e) => (isEventTypeId(e.kind) ? e.kind : null) === id) }))
    .filter((g) => g.events.length > 0)
    .map((g) => {
      const lanes: T[][] = [];
      for (const e of g.events) {
        let li = lanes.findIndex((l) => l.every((q) => reach(q) < e.start || q.start > reach(e)));
        if (li < 0) {
          lanes.push([]);
          li = lanes.length - 1;
        }
        lanes[li].push(e);
        laneOf.set(e.id, li);
      }
      return { ...g, laneCount: Math.max(1, lanes.length) };
    });
  return { groups, laneOf };
}

/** An event as the Plan draws it: a stretch is a phase-sized bar (its days, and Day 18 of 23 while on), a moment a pin. */
export function EventMark({ e, at, place, lane, today, cats, onOpen, drag }: {
  e: PlanEvent;
  /** Its dates while dragged, or while the move waits for a yes: its words follow them; its tooltip keeps its own. */
  at?: { start: string; end: string };
  place: { left: number; width: number };
  lane: number;
  today: string;
  cats: Category[];
  onOpen: () => void;
  /** The Plan's: a pin moves by its body, a bar by its body or either edge. A past one has none: it can't be moved or stretched. */
  drag?: BarDrag;
}) {
  const k = chromeOf(cats, e.kind);
  const past = eventIsPast(e, today);
  const standing = standingParts(today, e).join(" · ");
  const shown = at ? { ...e, ...at } : e;
  if (e.start === e.end)
    return (
      <button type="button" className={`rq-pin${past ? " past" : ""}${drag?.dragging ? " dragging" : ""}`} style={{ left: `${place.left}%`, top: evTop(lane), color: k.ink }} onPointerDown={drag?.onBody} onClick={onOpen} title={`${e.title} · ${dayMonth(e.start)} · ${standing}`}>
        <i style={{ background: k.ink }} />
        <span className="rq-pin-text">
          <b>{e.title}</b>
          <small>
            <SepJoin parts={[dayMonth(shown.start), ...standingParts(today, shown)]} />
          </small>
        </span>
      </button>
    );
  const word = barStanding(today, shown);
  return (
    <button
      type="button"
      className={`rq-evbar${past ? " past" : ""}${drag?.dragging ? " dragging" : ""}`}
      style={{ left: `${place.left}%`, width: `${place.width}%`, top: evTop(lane), background: k.tint, color: k.ink, borderColor: `rgba(${rgbOf(k.ink)}, 0.5)` }}
      onPointerDown={bodyDown(drag)}
      onClick={onOpen}
      title={`${e.title} · ${e.repeat ? `${repeatWords(e.repeat, { until: false })} · ` : ""}${dayMonth(e.start)} → ${e.repeat && !e.repeat.until ? "no end" : dayMonth(e.end)} · ${standing}`}
    >
      <Edges drag={drag} left right />
      {/* Built as a phase's bar (21 Oct, Alex): the title, its length under it (repeating: the days it
          comes back on), and while it is on, where it stands in a pill on the right: Day 18 of 23. */}
      <span className="rq-bar-main">
        <span className="rq-bar-name">{e.title}</span>
        <span className="rq-bar-meta">{e.repeat ? repeatWords(e.repeat, { until: false }) : `${daysBetween(shown.start, shown.end) + 1} days`}</span>
      </span>
      {word && <span className="rq-bar-pill">{word}</span>}
    </button>
  );
}
