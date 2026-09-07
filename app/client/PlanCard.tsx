"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientPlanView, PlanPhaseView } from "../lib/queries";

// The full phase plan, folded out under the Home header's chevron. One
// row per track (Nutrition, Training, Lifestyle: only those the coach has
// used). Across the row, every week the coach has planned is a filled
// cell; consecutive phases alternate between two shades of the track's
// colour so the boundary between them reads at a glance. The label on the
// left names whichever phase sits under the scroll position, so as the
// client swipes into the future the label turns over from "Bulk" to "Cut"
// at the week the coach set. This week's column is marked; the strip
// begins at last week, so there is nothing to scroll back into.
//
// Two columns side by side: the labels live outside the scroller so they
// never move, and every row has a fixed height (set in CSS) so the two
// columns stay in step.

const CELL = 40;

const TRACK_TONE: Record<string, { a: string; b: string; ink: string }> = {
  nutrition: { a: "#b9e6d1", b: "#8fd6b8", ink: "#0b4a37" },
  training: { a: "#cbc7f4", b: "#aea8ec", ink: "#2c2670" },
  lifestyle: { a: "#dedbd0", b: "#c9c5b6", ink: "#3d3c36" },
};

// The phase to name for a track at a given week column: the one covering
// it, else the next one coming, else the last one that ran.
function phaseAt(phases: PlanPhaseView[], index: number): { phase: PlanPhaseView; relation: "now" | "next" | "done" } | null {
  const covering = phases.find((p) => index >= p.startIndex && index < p.startIndex + p.span);
  if (covering) return { phase: covering, relation: "now" };
  const upcoming = phases.find((p) => p.startIndex > index);
  if (upcoming) return { phase: upcoming, relation: "next" };
  const last = phases[phases.length - 1];
  return last ? { phase: last, relation: "done" } : null;
}

export default function PlanBody({ plan }: { plan: ClientPlanView }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Which week column sits at the left edge of the visible strip.
  const [focus, setFocus] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    const onScroll = () => setFocus(Math.max(0, Math.round(el.scrollLeft / CELL)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [plan.nowIndex]);

  // Reading position: the first fully visible column, nudged so the label
  // turns over as the new phase's first cell arrives at the edge.
  const readIndex = Math.min(plan.weeks.length - 1, focus);
  const nowMonday = plan.weeks[plan.nowIndex]?.monday ?? "";

  return (
    <div id="plan-body" className="plan-body">
      <div className="plan-sheet">
        {/* Fixed label column */}
        <div className="plan-sheet-labels">
          <div className="plan-sheet-r plan-sheet-r-month" />
          <div className="plan-sheet-r plan-sheet-r-week plan-sheet-corner-weeks">Week</div>
          {plan.tracks.map((t) => {
            const tone = TRACK_TONE[t.track];
            const at = phaseAt(t.phases, readIndex);
            return (
              <div key={t.track} className="plan-sheet-r plan-sheet-r-track plan-sheet-label">
                <span className="plan-sheet-track-name" style={{ color: tone.ink }}>
                  {t.label}
                </span>
                {at && (
                  <>
                    <span className="plan-sheet-label-name">{at.phase.name}</span>
                    <span className="plan-sheet-label-weeks">
                      {at.relation === "next" ? "next · " : at.relation === "done" ? "ended · " : ""}
                      {at.phase.weeks} wk{at.phase.weeks === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Scrolling week columns */}
        <div className="plan-strip" ref={scrollRef}>
          <div className="plan-sheet-weeks" style={{ gridTemplateColumns: `repeat(${plan.weeks.length}, ${CELL}px)` }}>
            {plan.weeks.map((w, i) => (
              <div key={`m${i}`} className="plan-sheet-r plan-sheet-r-month plan-sheet-month" style={{ gridRow: 1, gridColumn: i + 1 }}>
                {w.monthLabel ?? ""}
              </div>
            ))}
            {plan.weeks.map((w, i) => (
              <div
                key={`w${i}`}
                className={`plan-sheet-r plan-sheet-r-week plan-sheet-week${w.now ? " now" : ""}`}
                style={{ gridRow: 2, gridColumn: i + 1 }}
              >
                {w.num}
              </div>
            ))}
            {plan.tracks.map((t, ti) => {
              const tone = TRACK_TONE[t.track];
              const row = 3 + ti;
              return plan.weeks.map((w, i) => {
                const pi = t.phases.findIndex((p) => i >= p.startIndex && i < p.startIndex + p.span);
                const p = pi >= 0 ? t.phases[pi] : null;
                const past = !!p && w.monday < nowMonday;
                const first = !!p && i === p.startIndex;
                const last = !!p && i === p.startIndex + p.span - 1;
                return (
                  <div
                    key={`${t.track}-${i}`}
                    className={`plan-sheet-r plan-sheet-r-track plan-sheet-cell${p ? " on" : ""}${w.now ? " now" : ""}${first ? " first" : ""}${last ? " last" : ""}${past ? " past" : ""}`}
                    style={{ gridRow: row, gridColumn: i + 1, ...(p ? { background: pi % 2 === 0 ? tone.a : tone.b } : {}) }}
                    title={p ? `${p.name} · ${p.rangeLabel}` : undefined}
                  >
                    {first && <span className="plan-sheet-cell-name" style={{ color: tone.ink }}>{p!.name}</span>}
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
