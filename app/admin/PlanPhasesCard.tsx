"use client";

import { useRef, useState, useTransition } from "react";
import { updateClientPhaseAction } from "../lib/actions";
import type { PhaseTrack } from "../lib/db";
import type { PlanPhaseRow, PlanProgramOption } from "../lib/queries";
import PhaseDialogButton, { isoWeek, PhaseDialog, TRACK_TONE } from "./PhaseDialogButton";

// The phases card: a week grid with one row per track, the phases as bars,
// a "Now" marker, and bar edges that drag to change a phase's length.

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
const monthName = (d: string) => parse(d).toLocaleDateString("en-US", { month: "long" });

const TRACKS: { id: PhaseTrack; label: string }[] = [
  { id: "nutrition", label: "Nutrition" },
  { id: "training", label: "Training" },
  { id: "lifestyle", label: "Lifestyle" },
];

type Window = 13 | 26;

export default function PlanPhasesCard({
  clientId,
  today,
  thisWeek,
  phases,
  programs,
}: {
  clientId: number;
  today: string;
  thisWeek: string;
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
  const first = addWeeks(thisWeek, -1);
  const count = win;
  const weeks = Array.from({ length: count }, (_, i) => addWeeks(first, i));
  const nowIdx = weeksBetween(first, thisWeek);
  const months: { label: string; span: number }[] = [];
  weeks.forEach((w) => {
    const label = monthName(w);
    const prev = months[months.length - 1];
    if (prev && prev.label === label) prev.span += 1;
    else months.push({ label, span: 1 });
  });

  // Header summary from the running and next phases.
  const running = (track: PhaseTrack) => phases.find((p) => p.track === track && p.start_week <= thisWeek && p.end_week >= thisWeek) ?? null;
  const upcoming = phases.filter((p) => p.start_week > thisWeek).sort((a, b) => (a.start_week < b.start_week ? -1 : 1))[0] ?? null;
  const wk = (p: PlanPhaseRow) => ({ n: weeksBetween(p.start_week, thisWeek) + 1, total: weeksBetween(p.start_week, p.end_week) + 1 });

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
      <div className="pl-band">
        <div className="pl-band-left">
          <div className="pl-eyebrow">Phases</div>
        </div>
        <div className="pl-band-right">
          <div className="pl-switch" role="tablist">
            {([13, 26] as Window[]).map((w) => (
              <button key={w} type="button" className={`pl-switch-opt${win === w ? " active" : ""}`} onClick={() => setWin(w)}>
                {w} weeks
              </button>
            ))}
          </div>
          <PhaseDialogButton clientId={clientId} today={today} defaultStart={thisWeek} defaultEnd={addWeeks(thisWeek, 3)} others={others} programs={programs} />
        </div>
      </div>

      <div className="pl-grid-wrap">
        <div className="pl-grid" style={{ gridTemplateColumns: `110px repeat(${count}, minmax(0, 1fr))` }}>
          <span />
          {months.map((m, i) => (
            <span key={i} className="pl-month" style={{ gridColumn: `span ${m.span}` }}>
              {m.label}
            </span>
          ))}
        </div>

        <div className="pl-body">
          <div className="pl-row pl-weekrow">
            <span className="pl-rowlabel">Week</span>
            <div className="pl-area">
              {weeks.map((w, i) => (
                <span key={w} className={`pl-week${i === nowIdx ? " now" : ""}`}>
                  <b>{isoWeek(w)}</b>
                  <small>{shortDate(w)}</small>
                </span>
              ))}
            </div>
          </div>

          {TRACKS.map((t) => {
            const tone = TRACK_TONE[t.id];
            const mine = phases.filter((p) => p.track === t.id).sort((a, b) => (a.start_week < b.start_week ? -1 : 1));
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
            const sub =
              mine.length === 0
                ? "no phases"
                : t.id === "training"
                ? `${mine.length} phase${mine.length === 1 ? "" : "s"} · ${mine.filter((p) => p.program?.status === "live").length} live / ${mine.filter((p) => p.program?.status === "draft").length} draft`
                : `${mine.length} phase${mine.length === 1 ? "" : "s"}`;
            return (
              <div key={t.id} className="pl-row pl-trackrow">
                <div className="pl-rowlabel">
                  <span className="pl-track-tag" style={{ background: tone.bg, color: tone.fg }}>
                    {t.label}
                  </span>
                  <span className="pl-track-sub">{sub}</span>
                </div>
                <div
                  className="pl-area"
                  style={{ height: `${laneCount * 44}px` }}
                  ref={t.id === "nutrition" ? areaRef : undefined}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {weeks.map((w, i) => (
                    <span key={w} className={`pl-cell${i === nowIdx ? " now" : ""}`} />
                  ))}
                  {mine.length === 0 && (
                    <button type="button" className="pl-empty" onClick={() => setDialog({ track: t.id })}>
                      No phase planned · <b>+ add</b>
                    </button>
                  )}
                  {mine.map((p) => {
                    const sp = span(p);
                    if (!sp.visible) return null;
                    const total = weeksBetween(sp.s, sp.e) + 1;
                    const done = Math.max(0, Math.min(total, weeksBetween(sp.s, thisWeek)));
                    const isRunning = sp.s <= thisWeek && sp.e >= thisWeek;
                    const isFuture = sp.s > thisWeek;
                    const draft = p.program?.status === "draft";
                    const badge = draft
                      ? "draft · deploy"
                      : isRunning
                      ? sp.e === thisWeek
                        ? "ends this week"
                        : `wk ${done + 1} / ${total}`
                      : isFuture
                      ? `starts ${shortDate(sp.s)}`
                      : "ended";
                    return (
                      <div
                        key={p.id}
                        className={`pl-bar${draft ? " draft" : ""}${drag?.id === p.id ? " dragging" : ""}`}
                        style={{
                          top: `${5 + (laneOf.get(p.id) ?? 0) * 44}px`,
                          left: `${(sp.a / count) * 100}%`,
                          width: `${((sp.b - sp.a + 1) / count) * 100}%`,
                          background: draft ? "#fff" : tone.bg,
                          borderColor: tone.mid,
                          color: tone.fg,
                        }}
                        onPointerDown={(e) => {
                          if ((e.target as HTMLElement).classList.contains("pl-bar-edge")) return;
                          // A programme the client already trained in keeps its start.
                          if (p.program && p.program.loggedWeeks.length > 0) return;
                          beginDrag(e, p, "move");
                        }}
                        onClick={() => {
                          if (justDragged.current || drag || pending) return;
                          setDialog({ phase: p });
                        }}
                        title={p.program && p.program.loggedWeeks.length > 0 ? `${p.name} · click to edit · the client trained in this programme, so its start stays; drag the right edge to change the end` : `${p.name} · click to edit · drag to move`}
                      >
                        {!draft && isRunning && <span className="pl-bar-progress" style={{ width: `${(done / total) * 100}%`, background: tone.fg }} />}
                        {!sp.clippedStart && !(p.program && p.program.loggedWeeks.length > 0) && <span className="pl-bar-edge left" onPointerDown={(e) => beginDrag(e, p, "start")} onClick={(e) => e.stopPropagation()} />}
                        {!sp.clippedEnd && <span className="pl-bar-edge right" onPointerDown={(e) => beginDrag(e, p, "end")} onClick={(e) => e.stopPropagation()} />}
                        <span className="pl-bar-main">
                          <span className="pl-bar-name">{p.name}</span>
                          <span className="pl-bar-meta">
                            {total} wk · {shortDate(sp.s)} → {shortDate(addWeeks(sp.e, 1))}
                          </span>
                        </span>
                        <span className="pl-bar-badge" style={draft ? { background: tone.fg, color: "#fff" } : undefined}>
                          {badge}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        </div>

        <div className="pl-legend">
          <span>
            <i className="pl-legend-swatch done" /> weeks done
          </span>
          <span>
            <i className="pl-legend-swatch planned" /> planned
          </span>
          <span>
            <i className="pl-legend-swatch draft" /> draft programme not deployed
          </span>
          <span className="pl-legend-hint">Drag a bar edge to change its length · click a bar to edit</span>
        </div>
      </div>

      {pending &&
        (() => {
          const p = phases.find((x) => x.id === pending.id);
          if (!p) return null;
          const weeksOf = (a: string, b: string) => weeksBetween(a, b) + 1;
          const isLive = p.start_week <= thisWeek && p.end_week >= thisWeek;
          const startChanged = pending.start !== p.start_week;
          const endChanged = pending.end !== p.end_week;
          return (
            <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setPending(null)}>
              <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label="Confirm the new dates">
                <h2 className="pb-confirm-title">Move {p.name}?</h2>
                <p className="pb-confirm-body">
                  {startChanged && (
                    <>
                      Start: {shortDate(p.start_week)} → <b>{shortDate(pending.start)}</b>
                      <br />
                    </>
                  )}
                  {endChanged && (
                    <>
                      End: {shortDate(addWeeks(p.end_week, 1))} → <b>{shortDate(addWeeks(pending.end, 1))}</b>
                      <br />
                    </>
                  )}
                  {weeksOf(p.start_week, p.end_week)} weeks → <b>{weeksOf(pending.start, pending.end)} weeks</b>.
                  {p.program && (startChanged ? " The training programme moves with it, deploy week included." : " The training programme changes with it.")}
                  {isLive && " This phase is live: the client's app changes as soon as you save."}
                </p>
                <div className="pb-modal-foot">
                  <button type="button" className="ad-btn-secondary" onClick={() => setPending(null)}>
                    Cancel
                  </button>
                  <button type="button" className="ad-btn-primary" onClick={savePending}>
                    Save new dates
                  </button>
                </div>
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
                }
              : undefined
          }
          program={dialog.phase?.program ? { status: dialog.phase.program.status, totalWeeks: dialog.phase.program.totalWeeks, loggedWeeks: dialog.phase.program.loggedWeeks } : undefined}
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
