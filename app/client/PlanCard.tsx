"use client";

import { useEffect, useRef } from "react";
import type { ClientPlanView } from "../lib/queries";

// The full phase plan, folded out under the Home header's chevron, laid out
// like the coach's planning sheet: one row per phase, its name pinned on
// the left, and the weeks it covers filled in across a strip that scrolls
// sideways from the first phase the coach set to the last. Only what the
// coach has drawn is shown; a track without phases has no rows. This
// week's column is marked and the strip opens scrolled to it.

const CELL = 40;
const LABEL = 104;

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

  const cols = `${LABEL}px repeat(${plan.weeks.length}, ${CELL}px)`;
  // Grid rows are assigned up front: 1 and 2 are the month and week
  // headers, then each track takes a heading row plus one row per phase.
  const rowOf = plan.tracks.reduce<{ head: Record<string, number>; phase: Record<number, number>; next: number }>(
    (acc, t) => {
      acc.head[t.track] = acc.next++;
      t.phases.forEach((p) => {
        acc.phase[p.id] = acc.next++;
      });
      return acc;
    },
    { head: {}, phase: {}, next: 3 }
  );

  return (
    <div id="plan-body" className="plan-body">
      <div className="plan-strip" ref={scrollRef}>
        <div className="plan-sheet" style={{ gridTemplateColumns: cols }}>
          {/* Header rows: month names over their first week, then week numbers */}
          <div className="plan-sheet-corner" style={{ gridRow: 1, gridColumn: 1 }} />
          {plan.weeks.map((w, i) => (
            <div key={`m${i}`} className="plan-sheet-month" style={{ gridRow: 1, gridColumn: i + 2 }}>
              {w.monthLabel ?? ""}
            </div>
          ))}
          <div className="plan-sheet-corner plan-sheet-corner-weeks" style={{ gridRow: 2, gridColumn: 1 }}>
            Week
          </div>
          {plan.weeks.map((w, i) => (
            <div key={`w${i}`} className={`plan-sheet-week${w.now ? " now" : ""}`} style={{ gridRow: 2, gridColumn: i + 2 }}>
              {w.num}
            </div>
          ))}

          {/* A heading row per track, then one row per phase on it */}
          {plan.tracks.map((t) => {
            const tone = TRACK_TONE[t.track];
            const headRow = rowOf.head[t.track];
            return (
              <div key={t.track} style={{ display: "contents" }}>
                <div className="plan-sheet-track" style={{ gridRow: headRow, gridColumn: 1, color: tone.ink, background: tone.fill }}>
                  {t.label}
                </div>
                {plan.weeks.map((w, i) => (
                  <div key={`h${i}`} className={`plan-sheet-gap${w.now ? " now" : ""}`} style={{ gridRow: headRow, gridColumn: i + 2 }} />
                ))}
                {t.phases.map((p) => {
                  const r = rowOf.phase[p.id];
                  const end = p.startIndex + p.span - 1;
                  return (
                    <div key={p.id} style={{ display: "contents" }}>
                      <div className={`plan-sheet-label ${p.status}`} style={{ gridRow: r, gridColumn: 1 }} title={p.rangeLabel}>
                        <span className="plan-sheet-label-name">{p.name}</span>
                        <span className="plan-sheet-label-weeks">{p.span} wk{p.span === 1 ? "" : "s"}</span>
                      </div>
                      {plan.weeks.map((w, i) => {
                        const inPhase = i >= p.startIndex && i <= end;
                        const past = inPhase && w.monday < plan.weeks[plan.nowIndex].monday;
                        return (
                          <div
                            key={`c${i}`}
                            className={`plan-sheet-cell${inPhase ? " on" : ""}${w.now ? " now" : ""}${i === p.startIndex ? " first" : ""}${i === end ? " last" : ""}`}
                            style={inPhase ? { background: past ? tone.past : tone.fill } : undefined}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
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
