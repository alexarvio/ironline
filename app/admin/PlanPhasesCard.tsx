"use client";

import { useRef, useState, useTransition } from "react";
import { deployProgramAction, updateClientPhaseAction } from "../lib/actions";
import type { PhaseTrack } from "../lib/db";
import type { PlanPhaseRow, PlanProgramOption } from "../lib/queries";
import PhaseDialogButton, { isoWeek, PhaseDialog } from "./PhaseDialogButton";

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

type Window = 13 | 26;
// The grid keeps each week readable: narrower than this and it scrolls.
const MIN_WIDTH: Record<Window, number> = { 13: 820, 26: 1560 };

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
  // A draft phase whose programme the coach asked to deploy, awaiting confirmation.
  const [deploying, setDeploying] = useState<PlanPhaseRow | null>(null);
  // The click that ends a drag must not open the edit dialog.
  const justDragged = useRef(false);
  const [busy, start] = useTransition();
  const areaRef = useRef<HTMLDivElement>(null);

  // The window: last week for context, then the current week in the second
  // column, so most of the grid is what is coming rather than what is done.
  const first = addWeeks(thisWeek, -1);
  const count = win;
  const weeks = Array.from({ length: count }, (_, i) => addWeeks(first, i));
  const nowIdx = weeksBetween(first, thisWeek);
  const months: { label: string; start: number; span: number }[] = [];
  weeks.forEach((w, i) => {
    const label = monthName(w);
    const prev = months[months.length - 1];
    if (prev && prev.label === label) prev.span += 1;
    else months.push({ label, start: i, span: 1 });
  });
  const cols = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` };

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
  const deploy = (p: PlanPhaseRow) => {
    if (!p.program) return;
    const fd = new FormData();
    fd.set("programId", String(p.program.id));
    start(async () => {
      await deployProgramAction(fd);
      setDeploying(null);
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
          <div className="pl-seg" role="radiogroup" aria-label="Weeks shown">
            {([13, 26] as Window[]).map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={win === w}
                className={`pl-seg-btn${win === w ? " active" : ""}`}
                onClick={() => setWin(w)}
              >
                {w} weeks
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
          />
        </div>
      </div>

      <div className="pl-timeline-scroll">
        <div className="pl-timeline" style={{ minWidth: MIN_WIDTH[win] }}>
          <div className="pl-tl-row">
            <span />
            <div className="pl-tl-grid" style={cols}>
              {months.map((m) => (
                <span key={m.start} className="pl-month" style={{ gridColumn: `${m.start + 1} / span ${m.span}` }}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          <div className="pl-tl-row pl-tl-weeks">
            <span />
            <div className="pl-tl-grid" style={cols}>
              {weeks.map((w, i) => (
                <span key={w} className={`pl-week${i === nowIdx ? " now" : ""}`}>
                  <b>{isoWeek(w)}</b>
                  <small>{shortDate(w)}</small>
                </span>
              ))}
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
                      className={`pl-cell${i === nowIdx ? " now" : ""}`}
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
                    const draft = p.program?.status === "draft";
                    // The shade covers the weeks already behind us that are inside the
                    // window, so a phase clipped at the left edge shades the right share.
                    const elapsed = draft ? 0 : Math.max(0, Math.min(shown, nowIdx - sp.a));
                    const trained = !!p.program && p.program.loggedWeeks.length > 0;
                    return (
                      <div
                        key={p.id}
                        className={`pl-bar ${t.id}${draft ? " draft" : ""}${sp.clippedStart ? " clip-start" : ""}${sp.clippedEnd ? " clip-end" : ""}${drag?.id === p.id ? " dragging" : ""}`}
                        style={{ gridColumn: `${sp.a + 1} / span ${shown}`, gridRow: (laneOf.get(p.id) ?? 0) + 1 }}
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
                            {total} wk · {shortDate(sp.s)} → {shortDate(addWeeks(sp.e, 1))}
                          </span>
                        </span>
                        {draft ? (
                          <button
                            type="button"
                            className="pl-bar-pill draft"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeploying(p);
                            }}
                          >
                            draft · deploy
                          </button>
                        ) : isRunning ? (
                          <span className="pl-bar-pill running">
                            wk {weeksBetween(sp.s, thisWeek) + 1} / {total}
                          </span>
                        ) : isFuture ? (
                          <span className="pl-bar-pill future">starts {shortDate(sp.s)}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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

      {deploying &&
        (() => {
          // An unnamed programme can't go out (the action refuses it), so say so
          // and send the coach to Training rather than a Deploy that does nothing.
          const unnamed = programs.find((x) => x.id === deploying.program?.id)?.name === "Untitled programme";
          return (
            <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setDeploying(null)}>
              <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label="Deploy the training programme">
                <h2 className="pb-confirm-title">{unnamed ? "Name the programme first" : `Deploy ${deploying.name}?`}</h2>
                <p className="pb-confirm-body">
                  {unnamed
                    ? "A programme needs a name before it goes to the client. Give it one on the Training tab, then deploy."
                    : "The client sees this training programme in their app as soon as it is deployed."}
                </p>
                <div className="pb-modal-foot">
                  <button type="button" className="ad-btn-secondary" onClick={() => setDeploying(null)} disabled={busy}>
                    Cancel
                  </button>
                  {unnamed ? (
                    <a className="ad-btn-primary" href={`/admin?client=${clientId}&tab=training`}>
                      Open Training
                    </a>
                  ) : (
                    <button type="button" className="ad-btn-primary" onClick={() => deploy(deploying)} disabled={busy}>
                      {busy ? "Deploying…" : "Deploy now"}
                    </button>
                  )}
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
