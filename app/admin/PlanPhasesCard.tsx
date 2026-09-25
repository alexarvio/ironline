"use client";

import { useRef, useState, useTransition } from "react";
import { updateClientPhaseAction } from "../lib/actions";
import type { PhaseTrack } from "../lib/db";
import type { PlanPhaseRow, PlanProgramOption } from "../lib/queries";
import PhaseDialogButton, { isoWeek, PhaseDialog } from "./PhaseDialogButton";
import { phaseChrome, phaseStateOf, STATE_LABEL, TRACK_LABEL, TRACK_PALETTE } from "./phaseChrome";

// The phases card: a week grid with one row per track and the phases as bars
// laid into the same grid. Bar edges drag to change a phase's length, the
// body drags to move it, and a click opens it for editing.

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addWeeks = (monday: string, n: number) => {
  const d = parse(monday);
  d.setDate(d.getDate() + n * 7);
  return iso(d);
};
const weeksBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / (7 * DAY));
const shortDate = (d: string) => parse(d).toLocaleDateString("en-US", { day: "numeric", month: "short" });
const monthName = (d: string) => parse(d).toLocaleDateString("en-US", { month: "short" });

const TRACKS: { id: PhaseTrack; label: string }[] = [
  { id: "nutrition", label: "Nutrition" },
  { id: "training", label: "Training" },
  { id: "lifestyle", label: "Lifestyle" },
];

// How far ahead the grid shows, in months; each is a whole number of weeks.
const WINDOWS = [
  { months: 3, weeks: 13 },
  { months: 6, weeks: 26 },
  { months: 9, weeks: 39 },
  { months: 12, weeks: 52 },
] as const;
type Window = (typeof WINDOWS)[number]["weeks"];
// The grid keeps each week readable (about 63px); narrower than this and it scrolls.
const minWidth = (weeks: number) => Math.round(weeks * 63);

export default function PlanPhasesCard({
  clientId,
  today,
  thisWeek,
  intoWeek,
  phases,
  programs,
}: {
  clientId: number;
  today: string;
  thisWeek: string;
  /** How far through this week it is, 0 (Monday 00:00) to 1. From the server, so both renders agree. */
  intoWeek: number;
  phases: PlanPhaseRow[];
  programs: PlanProgramOption[];
}) {
  const [win, setWin] = useState<Window>(13);
  const [dialog, setDialog] = useState<{ phase?: PlanPhaseRow; track?: PhaseTrack } | null>(null);
  // While an edge is being dragged, the bar previews its new span here.
  // "move" drags the whole bar by its body; the edges change one end.
  const [drag, setDrag] = useState<{ id: number; edge: "start" | "end" | "move"; start: string; end: string; moved: boolean; origStart: string; origEnd: string; anchor: string | null } | null>(null);
  // A finished drag waits here for the coach's confirmation; the bar keeps
  // previewing the new span until they save or cancel.
  const [pending, setPending] = useState<{ id: number; start: string; end: string } | null>(null);
  // The click that ends a drag must not open the edit dialog.
  const justDragged = useRef(false);
  const [, start] = useTransition();
  const areaRef = useRef<HTMLDivElement>(null);

  // The window: last week for context, then the current week in the second
  // column, so most of the grid is what is coming rather than what is done.
  // "Now" is one fixed line, a week and a half in from the left, and the
  // weeks slide under it as the week goes by: Monday morning the current
  // week's left edge is on the line, Thursday the line is past its middle.
  // So the grid is two weeks wider than the window and shifted by the part
  // of the week that has gone; the clip hides what hangs over either side.
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
  const cols = {
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
    width: `${(count / win) * 100}%`,
    transform: `translateX(${-((0.5 + intoWeek) / count) * 100}%)`,
  };
  const nowLeft = `calc(108px + (100% - 108px) * ${1.5 / win})`;

  // Edge drag: the pointer's column decides the new start or end week.
  const weekAt = (clientX: number) => {
    const el = areaRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const idx = Math.max(0, Math.min(count - 1, Math.floor(((clientX - r.left) / r.width) * count)));
    return weeks[idx];
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
    setPending({ id: p.id, start: d.start, end: d.end });
  };
  const savePending = () => {
    if (!pending) return;
    const p = phases.find((x) => x.id === pending.id);
    if (!p) return setPending(null);
    const fd = new FormData();
    fd.set("id", String(p.id));
    fd.set("track", p.track);
    fd.set("name", p.name);
    fd.set("start", pending.start);
    fd.set("end", pending.end);
    if (p.program) fd.set("adjustProgram", "1");
    start(async () => {
      await updateClientPhaseAction(fd);
      setPending(null);
    });
  };
  const span = (p: PlanPhaseRow) => {
    const live = drag?.id === p.id ? drag : pending?.id === p.id ? pending : null;
    const s = live ? live.start : p.start_week;
    const e = live ? live.end : p.end_week;
    const a = Math.max(0, weeksBetween(first, s));
    const b = Math.min(count - 1, weeksBetween(first, e));
    // An edge outside the window is not draggable: dragging what looks like
    // the end would snap the real end to the window's edge.
    return { a, b, s, e, visible: b >= 0 && a <= count - 1, clippedStart: weeksBetween(first, s) < 0, clippedEnd: weeksBetween(first, e) > count - 1 };
  };

  const others = phases.map((p) => ({ id: p.id, track: p.track, name: p.name, start_week: p.start_week, end_week: p.end_week }));

  return (
    <section className="pl-card">
      <div className="pl-card-head">
        <div className="pl-card-titles">
          <span className="pl-eyebrow">Phases</span>
          <span className="pl-helper">Drag a bar edge to change its length · click a bar to edit</span>
        </div>
        <div className="pl-card-tools">
          <div className="pl-seg" role="radiogroup" aria-label="Time shown">
            {WINDOWS.map(({ months, weeks: w }) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={win === w}
                className={`pl-seg-btn${win === w ? " active" : ""}`}
                onClick={() => setWin(w)}
              >
                {months} months
              </button>
            ))}
          </div>
          <PhaseDialogButton
            className="pl-btn navy"
            label="Add phase"
            clientId={clientId}
            today={today}
            defaultStart={thisWeek}
            defaultEnd={addWeeks(thisWeek, 3)}
            others={others}
            programs={programs}
            chooseTrack
          />
        </div>
      </div>

      <div className="pl-timeline-scroll">
        <div className="pl-timeline" style={{ minWidth: minWidth(win) }}>
          <div className="pl-tl-row">
            <span />
            <div className="pl-tl-clip">
            <div className="pl-tl-grid" style={cols}>
              {months.map((m) => (
                <span key={m.start} className="pl-month" style={{ gridColumn: `${m.start + 1} / span ${m.span}` }}>
                  {m.label}
                </span>
              ))}
            </div>
            </div>
          </div>

          <div className="pl-tl-body">
          <span className="pl-now-line" style={{ left: nowLeft }} title="Now" />

          <div className="pl-tl-row pl-tl-weeks">
            <span />
            <div className="pl-tl-clip">
            <div className="pl-tl-grid" style={cols}>
              {weeks.map((w, i) => (
                <span key={w} className={`pl-week${i === nowIdx ? " now" : ""}`}>
                  <b>{isoWeek(w)}</b>
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
            return (
              <div key={t.id} className="pl-tl-row pl-tl-track">
                <div className="pl-tl-label">
                  <span className={`pl-track-tag ${t.id}`}>{t.label}</span>
                </div>
                <div className="pl-tl-clip">
                <div
                  className="pl-tl-grid pl-tl-lanes"
                  style={{ ...cols, gridTemplateRows: `repeat(${laneCount}, 38px)` }}
                  ref={t.id === "nutrition" ? areaRef : undefined}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {weeks.map((w, i) => (
                    <span
                      key={w}
                      className="pl-cell"
                      style={{ gridColumn: i + 1, gridRow: `1 / span ${laneCount}` }}
                    />
                  ))}
                  {mine.length === 0 && (
                    <button
                      type="button"
                      className="pl-empty"
                      style={{ gridColumn: `1 / span ${count}`, gridRow: 1 }}
                      onClick={() => setDialog({ track: t.id })}
                    >
                      No phase planned · <b>+ add</b>
                    </button>
                  )}
                  {mine.map((p) => {
                    const sp = span(p);
                    if (!sp.visible) return null;
                    const total = weeksBetween(sp.s, sp.e) + 1;
                    const shown = sp.b - sp.a + 1;
                    const isRunning = sp.s <= thisWeek && sp.e >= thisWeek;
                    const isFuture = sp.s > thisWeek;
                    const draft = p.program?.status === "draft" || p.draft;
                    // The shade covers the weeks already behind us that are inside the
                    // window, so a phase clipped at the left edge shades the right share.
                    const elapsed = draft ? 0 : Math.max(0, Math.min(shown, nowIdx + intoWeek - sp.a));
                    const trained = !!p.program && p.program.loggedWeeks.length > 0;
                    // The state picks the colour (phaseChrome): live in its
                    // track's, every scheduled phase the same blue, a draft
                    // peach and dashed — as in the phase dialog.
                    const chrome = phaseChrome(t.id, draft ? "draft" : isRunning ? "live" : isFuture ? "scheduled" : "past");
                    return (
                      <div
                        key={p.id}
                        className={`pl-bar ${t.id}${draft ? " draft" : ""}${sp.clippedStart ? " clip-start" : ""}${sp.clippedEnd ? " clip-end" : ""}${drag?.id === p.id ? " dragging" : ""}`}
                        // A bar that starts under the clipped left edge keeps its name in view.
                        style={{ gridColumn: `${sp.a + 1} / span ${shown}`, gridRow: (laneOf.get(p.id) ?? 0) + 1, paddingLeft: `calc(14px + ${(Math.max(0, 0.5 + intoWeek - sp.a) / shown) * 100}%)`, background: chrome.band, color: chrome.edge, borderColor: chrome.line, borderStyle: chrome.dashed ? "dashed" : "solid" }}
                        onPointerDown={(e) => {
                          if ((e.target as HTMLElement).closest(".pl-bar-edge, .pl-bar-pill")) return;
                          // A programme the client already trained in keeps its start.
                          if (trained) return;
                          beginDrag(e, p, "move");
                        }}
                        onClick={() => {
                          if (justDragged.current || drag || pending) return;
                          setDialog({ phase: p });
                        }}
                        title={trained ? `${p.name} · click to edit · the client trained in this programme, so its start stays; drag the right edge to change the end` : `${p.name} · click to edit · drag to move`}
                      >
                        {elapsed > 0 && <span className="pl-bar-elapsed" style={{ width: `${(elapsed / shown) * 100}%` }} />}
                        {!sp.clippedStart && !trained && (
                          <span className="pl-bar-edge left" onPointerDown={(e) => beginDrag(e, p, "start")} onClick={(e) => e.stopPropagation()} />
                        )}
                        {!sp.clippedEnd && (
                          <span className="pl-bar-edge right" onPointerDown={(e) => beginDrag(e, p, "end")} onClick={(e) => e.stopPropagation()} />
                        )}
                        <span className="pl-bar-main">
                          <span className="pl-bar-name">{p.name}</span>
                          <span className="pl-bar-meta">
                            {total} {total === 1 ? "week" : "weeks"} · {shortDate(sp.s)} → {shortDate(addWeeks(sp.e, 1))}
                          </span>
                        </span>
                        {/* Only a label: the bar opens the phase dialog wherever it is
                            clicked, and a draft is deployed or scheduled from there. */}
                        {draft ? (
                          <span className="pl-bar-pill draft">Draft</span>
                        ) : isRunning ? (
                          <span className="pl-bar-pill running">
                            week {weeksBetween(sp.s, thisWeek) + 1} of {total}
                          </span>
                        ) : isFuture ? (
                          <span className="pl-bar-pill future">starts {shortDate(sp.s)}</span>
                        ) : null}
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

      <div className="pl-legend">
        <span>
          <i className="pl-legend-swatch done" /> weeks done
        </span>
        <span>
          <i className="pl-legend-swatch planned" /> planned
        </span>
        <span>
          <i className="pl-legend-swatch scheduled" /> scheduled
        </span>
        <span>
          <i className="pl-legend-swatch draft" /> draft not deployed
        </span>
        <span>
          <i className="pl-legend-swatch now" /> this week
        </span>
      </div>

      {pending &&
        (() => {
          const p = phases.find((x) => x.id === pending.id);
          if (!p) return null;
          const weeksOf = (a: string, b: string) => weeksBetween(a, b) + 1;
          const isLive = p.start_week <= thisWeek && p.end_week >= thisWeek;
          const startChanged = pending.start !== p.start_week;
          const endChanged = pending.end !== p.end_week;
          // The same dialog chrome as editing a phase (phaseChrome): the
          // track's tag, and the state the NEW dates put it in, so moving a
          // live phase into the future already reads Scheduled here.
          const draft = p.program?.status === "draft" || !!p.draft;
          const state = phaseStateOf({ draft, startWeek: pending.start, endWeek: pending.end, today });
          const chrome = phaseChrome(p.track, state);
          const palette = TRACK_PALETTE[p.track];
          // Days as the phase dialog shows them: the first day, and the last.
          const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
          const lastDay = (monday: string) => {
            const d = new Date(`${monday}T00:00:00`);
            d.setDate(d.getDate() + 6);
            return day(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
          };
          const weeksWas = weeksOf(p.start_week, p.end_week);
          const weeksNow = weeksOf(pending.start, pending.end);
          const rows: { label: string; was: string; now: string; changed: boolean }[] = [
            { label: "Start", was: day(p.start_week), now: day(pending.start), changed: startChanged },
            { label: "End", was: lastDay(p.end_week), now: lastDay(pending.end), changed: endChanged },
            { label: "Length", was: `${weeksWas} week${weeksWas === 1 ? "" : "s"}`, now: `${weeksNow} week${weeksNow === 1 ? "" : "s"}`, changed: weeksWas !== weeksNow },
          ];
          return (
            <div className="pl-dlg-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setPending(null)}>
              <div
                className="pl-dlg pl-move"
                role="dialog"
                aria-modal="true"
                aria-label={`Move ${p.name}`}
                style={{ "--sel-edge": chrome.edge } as React.CSSProperties}
              >
                <header className="pl-dlg-head">
                  <h2>Move {p.name}</h2>
                  <span className="pl-track-tag" style={{ background: palette.tint, color: palette.ink }}>
                    {TRACK_LABEL[p.track]}
                  </span>
                  <span className="pl-dlg-state" style={{ background: chrome.chipBg, color: chrome.chipInk }}>
                    {STATE_LABEL[state]}
                  </span>
                </header>
                <div className="pl-dlg-body">
                  <div className="pl-move-rows">
                    {rows.map((r) => (
                      <div key={r.label} className="pl-move-row">
                        <span className="pl-dlg-label">{r.label}</span>
                        {r.changed ? (
                          <>
                            <span className="pl-move-was">{r.was}</span>
                            <span className="pl-move-arrow" aria-label="to">
                              →
                            </span>
                            <b className="pl-move-now">{r.now}</b>
                          </>
                        ) : (
                          <span className="pl-move-same">{r.now}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {p.program && (
                    <p className="pl-move-note">
                      {startChanged ? "The training programme moves with it, deploy week included." : "The training programme changes with it."}
                    </p>
                  )}
                  {isLive && <p className="pl-move-note warn">This phase is live: the client&rsquo;s app changes as soon as you save.</p>}
                </div>
                <footer className="pl-dlg-foot">
                  <div className="pl-dlg-actions">
                    <button type="button" className="pl-dlg-cancel" onClick={() => setPending(null)}>
                      Cancel
                    </button>
                    <button type="button" className="pl-dlg-save" onClick={savePending}>
                      Save new dates
                    </button>
                  </div>
                </footer>
              </div>
            </div>
          );
        })()}

      {dialog && (
        <PhaseDialog
          clientId={clientId}
          today={today}
          phase={
            dialog.phase
              ? {
                  id: dialog.phase.id,
                  client_id: clientId,
                  track: dialog.phase.track,
                  name: dialog.phase.name,
                  start_week: dialog.phase.start_week,
                  end_week: dialog.phase.end_week,
                  program_id: dialog.phase.program?.id ?? null,
                  // So the dialog knows it is a draft, and offers to send it out.
                  ...(dialog.phase.draft ? { draft: true } : {}),
                }
              : undefined
          }
          program={dialog.phase?.program ? { status: dialog.phase.program.status, totalWeeks: dialog.phase.program.totalWeeks, loggedWeeks: dialog.phase.program.loggedWeeks } : undefined}
          emptyReason={dialog.phase?.emptyReason ?? null}
          open={
            dialog.phase
              ? dialog.phase.track === "training"
                ? dialog.phase.program
                  ? { href: `/admin?client=${clientId}&tab=training&phase=${dialog.phase.program.id}`, label: "Open in Training" }
                  : null
                : dialog.phase.track === "nutrition"
                  ? { href: `/admin?client=${clientId}&tab=nutrition&phase=${dialog.phase.id}`, label: "Open in Nutrition" }
                  : { href: `/admin?client=${clientId}&tab=measurements&phase=${dialog.phase.id}`, label: "Open in Measurements" }
              : null
          }
          defaultTrack={dialog.track}
          defaultStart={thisWeek}
          defaultEnd={addWeeks(thisWeek, 3)}
          others={others}
          programs={programs}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
