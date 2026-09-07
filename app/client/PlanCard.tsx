"use client";

import { useEffect, useRef } from "react";
import type { ClientPlanView, PlanPhaseView } from "../lib/queries";

// The full phase plan, folded out under the Home header's chevron. One
// row per track (Nutrition, Training, Lifestyle: only those the coach has
// used). Across the row, every week the coach has planned is a filled
// cell; each phase is one outlined block in the accent colour with its
// name on its first cell, and the week the client is in is tinted. The label on the left names the phase
// running now and how long it is; what comes next is read off the cells. This week's column is marked; the strip
// begins at last week, so there is nothing to scroll back into.
//
// Two columns side by side: the labels live outside the scroller so they
// never move, and every row has a fixed height (set in CSS) so the two
// columns stay in step.

const CELL = 60;


export default function PlanBody({ plan }: { plan: ClientPlanView }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // The strip begins at last week, so it opens at the left edge.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [plan.nowIndex]);

  // The label names the phase running this week (or the next one coming);
  // what lies further ahead is read off the cells themselves.
  const currentOf = (phases: PlanPhaseView[]) =>
    phases.find((p) => plan.nowIndex >= p.startIndex && plan.nowIndex < p.startIndex + p.span) ??
    phases.find((p) => p.startIndex > plan.nowIndex) ??
    null;
  const nowMonday = plan.weeks[plan.nowIndex]?.monday ?? "";

  return (
    <div id="plan-body" className="plan-body">
      <div className="plan-sheet">
        {/* Fixed label column */}
        <div className="plan-sheet-labels">
          <div className="plan-sheet-r plan-sheet-r-month" />
          <div className="plan-sheet-r plan-sheet-r-week plan-sheet-corner-weeks">Week</div>
          {plan.tracks.map((t) => {
            const cur = currentOf(t.phases);
            const upcoming = !!cur && cur.startIndex > plan.nowIndex;
            return (
              <div key={t.track} className="plan-sheet-r plan-sheet-r-track plan-sheet-label">
                <span className="plan-sheet-track-name">
                  {t.label}
                </span>
                {cur && (
                  <>
                    <span className="plan-sheet-label-name">{cur.name}</span>
                    <span className="plan-sheet-label-weeks">
                      {upcoming ? "next · " : ""}
                      {cur.weeks} week{cur.weeks === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Scrolling week columns */}
        <div className="plan-strip" ref={scrollRef}>
          {/* Vertical grid lines at every week boundary come from a repeating
              background sized to the cell width, so they run the full height
              including the gaps between rows. */}
          <div
            className="plan-sheet-weeks"
            style={{
              gridTemplateColumns: `repeat(${plan.weeks.length}, ${CELL}px)`,
              backgroundSize: `${CELL}px 100%`,
            }}
          >
            {/* One tinted column behind everything for the week the client
                is in, from the month row down through every track. */}
            <div
              className="plan-sheet-nowcol"
              style={{ gridRow: `1 / ${3 + plan.tracks.length}`, gridColumn: plan.nowIndex + 1 }}
              aria-hidden="true"
            />
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
                    style={{ gridRow: row, gridColumn: i + 1 }}
                    title={p ? `${p.name} · ${p.rangeLabel}` : undefined}
                  >
                    {first && <span className="plan-sheet-cell-name">{p!.name}</span>}
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
