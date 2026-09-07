"use client";

import { useEffect, useRef } from "react";
import type { ClientPlanView } from "../lib/queries";

// The full phase plan, folded out under the Home header's chevron, laid out
// like the coach's planning sheet: one row per phase, its name on the
// left, and the weeks it covers filled in across a strip that scrolls
// sideways from the first phase the coach set to the last. Only what the
// coach has drawn is shown; a track without phases has no rows. This
// week's column is marked and the strip opens scrolled to it.
//
// Two columns side by side: the labels live outside the scroller so they
// never move, and every row has a fixed height (set in CSS) so the two
// columns stay in step.

const CELL = 40;

const TRACK_TONE: Record<string, { fill: string; past: string; ink: string }> = {
  nutrition: { fill: "#b9e6d1", past: "#e1f3ea", ink: "#0b4a37" },
  training: { fill: "#cbc7f4", past: "#e8e6fa", ink: "#2c2670" },
  lifestyle: { fill: "#dedbd0", past: "#efede6", ink: "#3d3c36" },
};

export default function PlanBody({ plan }: { plan: ClientPlanView }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open on this week, with a week and a half of the past showing.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, plan.nowIndex * CELL - CELL * 1.5);
  }, [plan.nowIndex]);

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
            return (
              <div key={t.track} style={{ display: "contents" }}>
                <div className="plan-sheet-r plan-sheet-r-track">
                  <span className="plan-sheet-track" style={{ color: tone.ink, background: tone.fill }}>
                    {t.label}
                  </span>
                </div>
                {t.phases.map((p) => (
                  <div key={p.id} className={`plan-sheet-r plan-sheet-r-phase plan-sheet-label ${p.status}`} title={p.rangeLabel}>
                    <span className="plan-sheet-label-name">{p.name}</span>
                    <span className="plan-sheet-label-weeks">
                      {p.span} wk{p.span === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
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
            {(() => {
              let row = 2;
              return plan.tracks.map((t) => {
                const tone = TRACK_TONE[t.track];
                const headRow = ++row;
                const phaseRows = t.phases.map(() => ++row);
                return (
                  <div key={t.track} style={{ display: "contents" }}>
                    {plan.weeks.map((w, i) => (
                      <div
                        key={`h${i}`}
                        className={`plan-sheet-r plan-sheet-r-track plan-sheet-gap${w.now ? " now" : ""}`}
                        style={{ gridRow: headRow, gridColumn: i + 1 }}
                      />
                    ))}
                    {t.phases.map((p, pi) => {
                      const end = p.startIndex + p.span - 1;
                      return plan.weeks.map((w, i) => {
                        const inPhase = i >= p.startIndex && i <= end;
                        const past = inPhase && w.monday < nowMonday;
                        return (
                          <div
                            key={`${p.id}-${i}`}
                            className={`plan-sheet-r plan-sheet-r-phase plan-sheet-cell${inPhase ? " on" : ""}${w.now ? " now" : ""}${i === p.startIndex ? " first" : ""}${i === end ? " last" : ""}`}
                            style={{
                              gridRow: phaseRows[pi],
                              gridColumn: i + 1,
                              ...(inPhase ? { background: past ? tone.past : tone.fill } : {}),
                            }}
                          />
                        );
                      });
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
      <div className="plan-legend">
        <span className="plan-legend-item">
          <span className="plan-legend-swatch now" aria-hidden="true" />
          This week
        </span>
        <span className="plan-legend-item">Swipe to see what comes next</span>
      </div>
    </div>
  );
}
