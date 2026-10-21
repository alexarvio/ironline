"use client";

import type React from "react";
import type { PhaseTrack } from "../../../lib/db";
import { phaseChrome, phaseStateOf, STATE_LABEL, stateTagStyle, TRACK_LABEL } from "../../phaseChrome";
import { Sep, SepJoin } from "../Sep";
import { dayMonth } from "../../../lib/dayMonth";
import { repeatWords } from "../../../lib/eventRepeat";
import { axisDate, GapSign, gridFor, isoWeek, weeksBetween } from "./PlanDraft";
import { barStanding, chromeOf, evTop, rgbOf, standingParts, type Category, type PlanEvent } from "./EventsCard";

// The Plan's timeline as read-only parts (21 Oct): the months and weeks over
// the grid, a phase bar, an event bar or pin, with the Plan's own classes
// (plan.css, rq-) and maths, and no dragging. The all-clients Phases screen
// draws every client with these, so its bars, pins, NOW line and axis are
// the Plan's. PlanDraft and EventsCard still draw their own (with drag);
// moving them onto these is for later.
//
// The Plan's modules are only read at render time here: PlanDraft and
// EventsCard import each other, and this module imports both.

export type Grid = ReturnType<typeof gridFor>;

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

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

/** The weeks under them: the week number over its Monday, this week in ink. `gridRef` measures the grid's width. */
export function WeeksRow({ grid, gridRef }: { grid: Grid; gridRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div className="rq-tl-row">
      <span />
      <div className="rq-tl-clip">
        <div ref={gridRef} className="rq-tl-grid" style={grid.cols}>
          {grid.weeks.map((w, i) => (
            <span key={w} className={`rq-week${i === grid.nowIdx ? " now" : ""}`}>
              <b>W{isoWeek(w)}</b>
              <small>{axisDate(w)}</small>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A lane's label: the track's (or event kind's) icon in its colour, its name in ink. */
export function LaneLabel({ icon, color, label }: { icon?: React.ReactNode; color?: string; label: string }) {
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
 * The week columns a phase is drawn in, as the Plan's: the column its first
 * day falls in to the column of its last week's Monday, cut to the window.
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

export type BarPhase = { id: number; name: string; track: PhaseTrack; /** The Monday of its first week, as stored. */ startWeek: string; /** The Monday of its last week, as stored. */ endWeek: string; draft: boolean; /** What it still lacks (the Plan's warning sign). */ gap?: string | null };

/** A phase's bar, the Plan's: its state's colours, the name with its length under it, the state pill on the right. Opens on a click. */
export function PhaseBar({ phase: p, grid, row, today, thisWeek, intoWeek, onOpen }: { phase: BarPhase; grid: Grid; /** Its lane, from 0. */ row: number; today: string; thisWeek: string; intoWeek: number; onOpen: () => void }) {
  const sp = weekSpan(p.startWeek, p.endWeek, grid.first, grid.count);
  if (!sp.visible) return null;
  const total = weeksBetween(p.startWeek, p.endWeek) + 1;
  const shownW = sp.b - sp.a + 1;
  const state = phaseStateOf({ draft: p.draft, startWeek: p.startWeek, endWeek: p.endWeek, today });
  const chrome = phaseChrome(p.track, state);
  const elapsed = state === "draft" ? 0 : Math.max(0, Math.min(shownW, grid.nowIdx + intoWeek - sp.a));
  const title = `${p.name} · ${dayMonth(p.startWeek)} – ${dayMonth(addDays(p.endWeek, 6))}`;
  return (
    <div
      className={`rq-bar is-${state} fixed${sp.clippedStart ? " clip-start" : ""}${sp.clippedEnd ? " clip-end" : ""}`}
      style={{ gridColumn: `${sp.a + 1} / span ${shownW}`, gridRow: row + 1, paddingLeft: `calc(14px + ${(Math.max(0, grid.shift - sp.a) / shownW) * 100}%)`, background: chrome.band, color: chrome.edge, borderColor: chrome.dashed ? chrome.line : `rgba(${rgbOf(chrome.edge)}, 0.5)`, borderStyle: chrome.dashed ? "dashed" : "solid" }}
      role="button"
      tabIndex={0}
      aria-label={`${TRACK_LABEL[p.track]}: ${p.name}, ${STATE_LABEL[state]}, ${dayMonth(p.startWeek)} to ${dayMonth(addDays(p.endWeek, 6))}`}
      title={title}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        onOpen();
      }}
    >
      {elapsed > 0 && <span className="rq-bar-elapsed" style={{ width: `${(elapsed / shownW) * 100}%` }} />}
      <span className="rq-bar-main">
        <span className="rq-bar-name">{p.name}</span>
        <span className="rq-bar-meta">
          {total} {total === 1 ? "week" : "weeks"}
        </span>
      </span>
      {p.gap && state !== "past" && <GapSign text={p.gap} />}
      {state === "draft" ? (
        <span className="rq-bar-pill" style={stateTagStyle(state)}>
          Draft
        </span>
      ) : state === "live" ? (
        <span className="rq-bar-pill" style={stateTagStyle(state)}>
          <b>Live</b>
          <Sep />
          week {weeksBetween(p.startWeek, thisWeek) + 1} of {total}
        </span>
      ) : state === "scheduled" ? (
        <span className="rq-bar-pill" style={stateTagStyle(state)}>
          <b>Scheduled</b>
          <Sep />
          starts {dayMonth(p.startWeek)}
        </span>
      ) : null}
    </div>
  );
}

/** Over and done: ended before today; a repeat only once its last day has gone (the Plan's). */
export const eventIsPast = (e: PlanEvent, today: string) => (e.repeat ? e.repeat.until != null && e.repeat.until < today : e.end < today);

/** Where an event sits on the grid, as percentages of its width; a day is a seventh of a week's column. */
export function eventPlace(e: { start: string; end: string }, first: string, totalDays: number) {
  const a = daysBetween(first, e.start);
  const b = daysBetween(first, e.end) + 1;
  return { left: (Math.max(0, a) / totalDays) * 100, width: (Math.max(0.6, Math.min(totalDays, b) - Math.max(0, a)) / totalDays) * 100, visible: b > 0 && a < totalDays };
}

/** An event as the Plan draws it: a stretch is a phase-sized bar (its days, and Day 18 of 23 while on), a moment a pin. */
export function EventMark({ e, place, lane, today, cats, onOpen }: { e: PlanEvent; place: { left: number; width: number }; lane: number; today: string; cats: Category[]; onOpen: () => void }) {
  const k = chromeOf(cats, e.kind);
  const past = eventIsPast(e, today);
  const standing = standingParts(today, e).join(" · ");
  if (e.start === e.end)
    return (
      <button type="button" className={`rq-pin${past ? " past" : ""}`} style={{ left: `${place.left}%`, top: evTop(lane), color: k.ink }} onClick={onOpen} title={`${e.title} · ${dayMonth(e.start)} · ${standing}`}>
        <i style={{ background: k.ink }} />
        <span className="rq-pin-text">
          <b>{e.title}</b>
          <small>
            <SepJoin parts={[dayMonth(e.start), ...standingParts(today, e)]} />
          </small>
        </span>
      </button>
    );
  const word = barStanding(today, e);
  return (
    <button
      type="button"
      className={`rq-evbar${past ? " past" : ""}`}
      style={{ left: `${place.left}%`, width: `${place.width}%`, top: evTop(lane), background: k.tint, color: k.ink, borderColor: `rgba(${rgbOf(k.ink)}, 0.5)` }}
      onClick={onOpen}
      title={`${e.title} · ${e.repeat ? `${repeatWords(e.repeat, { until: false })} · ` : ""}${dayMonth(e.start)} → ${e.repeat && !e.repeat.until ? "no end" : dayMonth(e.end)} · ${standing}`}
    >
      <span className="rq-bar-main">
        <span className="rq-bar-name">{e.title}</span>
        <span className="rq-bar-meta">{e.repeat ? repeatWords(e.repeat, { until: false }) : `${daysBetween(e.start, e.end) + 1} days`}</span>
      </span>
      {word && <span className="rq-bar-pill">{word}</span>}
    </button>
  );
}
