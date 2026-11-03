"use client";

import { useState, type CSSProperties } from "react";
import { monotoneSegments } from "../../lib/monotoneCurve";
import { GOAL_COLOR, TARGET_ICON } from "../../lib/weightGoal";
import { useOpenCheckIn } from "../CheckInContext";
import { Bars } from "../Bars";
import { dayWords } from "../../lib/clientDates";
import type { HomeWeight as HomeWeightData, HomeWeightWindow } from "./weightData";
import "./weight.css";

// Home's Weight (3 Nov, Alex: option 3 of docs/boards/home-hierarchy-mockup.html, "the weight displayed always"; the
// toggle "same logic as in the admin panel"): flat on the page under the phase cards. `Weight` with Goal | 7d | 30d |
// Phase as the capsule on its right (Goal only while one runs and first then, else 30d; Phase only with a live phase);
// the latest in light numerals with its unit grey and the change over the window; the line in the weight's own Body
// blue, the same smooth curve as everywhere (monotoneCurve); in Goal the coach's straight line dashed in beige from where
// they were to the goal's ring, which pulses, and the latest a blue dot, pulsing; the first day, Today and the goal's
// day under it; then the goal, the kilos to go and the verdict. A tap on the chart opens Progress on Weight.

export const PROGRESS_PICK_KEY = "nc-progress-pick";
const BLUE = "#2f5d8f";
const LABEL: Record<HomeWeightWindow, string> = { goal: "Goal", "7d": "7d", "30d": "30d", phase: "Phase" };
const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000;
const dm = (iso: string) => dayWords(iso);
const one = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
/** A weight with no ".0": "80", "82.5". */
const trim = (v: number) => String(Math.round(v * 10) / 10);
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${one(Math.abs(v))}`;

export default function HomeWeight({ w, today }: { w: HomeWeightData; today: string }) {
  const openCheckIn = useOpenCheckIn();
  const choices: HomeWeightWindow[] = [...(w.goal ? (["goal"] as const) : []), "7d", "30d", ...(w.windows.phase ? (["phase"] as const) : [])];
  const [picked, setPicked] = useState<HomeWeightWindow>(w.goal ? "goal" : "30d");
  const win = choices.includes(picked) ? picked : "30d";
  const goal = win === "goal" ? w.goal : null;

  // The window's readings and its days: Goal from the goal's start to its day; the others from their first reading to
  // the last, so a newer client's line fills the width (as the coach's card).
  const from = goal ? goal.startDate : win === "phase" ? w.windows.phase!.from : w.windows[win as "7d" | "30d"].from;
  const pts = w.points.filter((p) => p.date >= from);
  const d0 = goal ? dayOf(goal.startDate) : pts.length ? dayOf(pts[0].date) : dayOf(today);
  const d1 = goal ? Math.max(dayOf(goal.byDate), dayOf(today)) : pts.length ? dayOf(pts[pts.length - 1].date) : dayOf(today);
  const span = Math.max(1, d1 - d0);
  const change = goal ? (pts.length ? w.now - goal.start : null) : win === "phase" ? w.windows.phase!.change : w.windows[win as "7d" | "30d"].change;
  const base = change == null ? null : w.now - change;

  // The scale: the readings, and in Goal the line's two ends, a little room either side.
  const vals = [...pts.map((p) => p.value), ...(goal ? [goal.start, goal.target] : [])];
  const lo0 = vals.length ? Math.min(...vals) : w.now;
  const hi0 = vals.length ? Math.max(...vals) : w.now;
  const pad = Math.max(0.3, (hi0 - lo0) * 0.12);
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const x = (iso: string) => ((dayOf(iso) - d0) / span) * 100;
  const y = (v: number) => ((hi - v) / Math.max(0.1, hi - lo)) * 100;
  const xy = pts.map((p) => ({ x: x(p.date), y: y(p.value) }));
  const line = xy.length >= 2 ? `M${xy[0].x.toFixed(2)} ${xy[0].y.toFixed(2)} ${monotoneSegments(xy).join(" ")}` : "";
  const last = xy[xy.length - 1] ?? null;
  const todayX = x(today);
  // The grid on a round step (0.5, 1, 2, 5 or 10), two to four lines across the readings, as the coach's card.
  const step = [0.5, 1, 2, 5, 10].find((s) => (hi - lo) / s <= 3) ?? 10;
  const grid: number[] = [];
  for (let g = Math.ceil(lo / step) * step; g <= hi; g += step) grid.push(Math.round(g * 10) / 10);

  const openProgress = () => {
    try {
      sessionStorage.setItem(PROGRESS_PICK_KEY, "weight");
    } catch {}
    openCheckIn?.("progress");
  };

  return (
    <section className="hw" aria-label="Weight">
      <div className="hw-head">
        <span className="hw-title">Weight</span>
        {choices.length > 1 && (
          <div className="hw-range" data-slide role="radiogroup" aria-label="Window">
            {choices.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={c === win} className={c === win ? "on" : ""} onClick={() => setPicked(c)}>
                {LABEL[c]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="hw-figs">
        <b>{one(w.now)}</b>
        <small>{w.unit}</small>
        {change != null && (
          <span className="hw-change">
            <Bars parts={[`${signed(change)} ${w.unit}`, ...(base ? [`${signed((change / base) * 100)}%`] : [])]} />
          </span>
        )}
      </div>
      {/* A line needs two weigh-ins (a goal draws its own line from the first): with one, the figure alone. */}
      {(goal || pts.length >= 2) && (
        <>
          <button type="button" className="hw-chart" onClick={openProgress} aria-label="Open your weight on Progress">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {grid.map((v) => (
                <line key={v} x1={0} x2={100} y1={y(v)} y2={y(v)} className="hw-grid" vectorEffect="non-scaling-stroke" />
              ))}
              {goal && <line x1={x(goal.startDate)} y1={y(goal.start)} x2={x(goal.byDate)} y2={y(goal.target)} className="hw-plan" vectorEffect="non-scaling-stroke" />}
              {line && <path d={line} fill="none" stroke={BLUE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            </svg>
            {goal && todayX > 0 && todayX < 100 && <span className="hw-today" style={{ left: `${todayX}%` }} />}
            {/* Where they stand, a blue dot pulsing (2 Nov, Alex), and the goal's ring pulsing in its beige (3 Nov, Alex). */}
            {last && <span className="hw-dot" style={{ left: `${last.x}%`, top: `${last.y}%` } as CSSProperties} />}
            {goal && <span className="hw-ring" style={{ left: `${x(goal.byDate)}%`, top: `${y(goal.target)}%` }} />}
            {grid.map((v) => (
              <span key={v} className="hw-gridv" style={{ top: `${y(v)}%` }}>
                {trim(v)}
              </span>
            ))}
          </button>
          <div className="hw-axis">
            <span>{dm(goal ? goal.startDate : pts[0]?.date ?? today)}</span>
            {goal && todayX > 18 && todayX < 82 && (
              <span className="today" style={{ left: `${todayX}%` }}>
                Today
              </span>
            )}
            <span className="end">{goal ? dm(goal.byDate) : dm(pts[pts.length - 1]?.date ?? today)}</span>
          </div>
        </>
      )}
      {w.goal && (
        <div className="hw-goal">
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={GOAL_COLOR} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={TARGET_ICON} />
          </svg>
          <span className="hw-goal-text">
            <Bars
              parts={[
                `${trim(w.goal.target)} ${w.unit} by ${dm(w.goal.byDate)}`,
                ...(w.goal.toGo != null && w.goal.toGo > 0 ? [`${trim(w.goal.toGo)} ${w.unit} to go`] : []),
                ...(w.goal.verdictWord ? [<span key="v" className={`hw-verdict ${w.goal.tone}`}>{w.goal.verdictWord}</span>] : []),
              ]}
            />
          </span>
        </div>
      )}
    </section>
  );
}
