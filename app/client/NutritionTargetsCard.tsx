"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useOpenFood } from "./CheckInContext";

// The top of the client's Nutrition tab: the banner (Training day / Rest day
// tabs, the phase; the app's top bar floats over its top) and the calories card overlapping it (the
// macro rings, the three macros, and a footer: the supplements). Both day types'
// targets arrive precomputed, so the tabs switch what is shown with no server
// round trip.
//
// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx).
export type NutritionMacro = {
  id: "protein" | "carbs" | "fat";
  name: string;
  grams: number;
  /** Share of the kcal the three macros make up, 0 to 1. */
  share: number;
};
export type NutritionTargetSet = { kcal: number; macros: NutritionMacro[] };

const HUE: Record<NutritionMacro["id"], string> = { protein: "#334EAC", carbs: "#D99A2B", fat: "#2E8B7A" };
// Three rings, one inside the other: protein outside, carbs in the middle,
// fat inside. Each fills from the top by that macro's share of the kcal.
const SIZE = 150;
const STROKE = 6;
const RING_R: Record<NutritionMacro["id"], number> = { protein: 70, carbs: 61, fat: 52 };
const n =(v: number) => Math.round(v).toLocaleString("en-US");

// Each macro's ring: its radius and how much of it is filled.
function ringFills(set: NutritionTargetSet) {
  return set.macros.map((m) => {
    const r = RING_R[m.id];
    const circumference = 2 * Math.PI * r;
    const length = Math.min(1, Math.max(0, m.share)) * circumference;
    return { id: m.id, r, dash: `${length} ${circumference}`, visible: length > 0 };
  });
}

// A figure that runs from its last value to the new one when the day tab
// changes, over the same time the arcs take, instead of snapping. It snaps
// for anyone with reduced motion on.
export function useTween(target: number, ms = 600) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      current.current = target;
      setValue(target);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      current.current = from + (target - from) * eased;
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

function Tween({ value, format }: { value: number; format: (v: number) => string }) {
  return <>{format(useTween(value))}</>;
}

export default function NutritionTargetsCard({
  training,
  rest,
  initialIsTraining,
  hasTargets,
  phase,
  footer,
  eatenKcal = 0,
}: {
  training: NutritionTargetSet;
  rest: NutritionTargetSet;
  initialIsTraining: boolean;
  hasTargets: boolean;
  /** The phase block under the tabs, rendered by the server page. */
  phase: ReactNode;
  /** The foot of the calories card: the supplements fold. */
  footer?: ReactNode;
  /** Calories logged in the food diary today; the ring's centre counts down from the target. */
  eatenKcal?: number;
}) {
  const openFood = useOpenFood();
  const [isTraining, setIsTraining] = useState(initialIsTraining);
  const chooseDay = (training: boolean) => setIsTraining(training);
  // A sideways swipe on the ring and macros switches the day: left for Rest
  // day, right for Training day. Only a clearly horizontal swipe counts, so
  // scrolling the page past the card never flips it.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onSwipeEnd = (x: number, y: number) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    chooseDay(dx > 0);
  };
  const active = isTraining ? training : rest;
  const rings = ringFills(active);

  return (
    <>
      <header className="nd-banner">
        {phase}

        <div className="nd-tabs" role="tablist" aria-label="Day type">
          {([true, false] as const).map((t) => (
            <button
              key={t ? "training" : "rest"}
              type="button"
              role="tab"
              aria-selected={isTraining === t}
              className={`nd-tab${isTraining === t ? " on" : ""}`}
              onClick={() => chooseDay(t)}
            >
              {t ? "Training day" : "Rest day"}
            </button>
          ))}
        </div>
      </header>

      <div className="nd-body">
        <section className="nd-card nd-cal">
          {hasTargets ? (
            <div
              className="nd-swipe"
              onPointerDown={(e) => {
                swipeStart.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerUp={(e) => onSwipeEnd(e.clientX, e.clientY)}
              onPointerCancel={() => {
                swipeStart.current = null;
              }}
            >
              {/* The rings on the left, the three macros beside them. */}
              <div className="nd-cal-row">
              <button
                type="button"
                className="nd-ring"
                onClick={() => openFood?.()}
                disabled={!openFood}
                aria-label={eatenKcal > 0 ? `${n(Math.max(0, active.kcal - eatenKcal))} kcal left today. Open the food diary` : "Open the food diary"}
              >
                <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
                  <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
                    {rings.map((ring) => (
                      <g key={ring.id}>
                        <circle cx={SIZE / 2} cy={SIZE / 2} r={ring.r} fill="none" stroke="#e6ecf3" strokeWidth={STROKE} />
                        <circle
                          className="nd-ring-arc"
                          cx={SIZE / 2}
                          cy={SIZE / 2}
                          r={ring.r}
                          fill="none"
                          stroke={HUE[ring.id]}
                          strokeWidth={STROKE}
                          strokeLinecap="butt"
                          style={{ strokeDasharray: ring.dash, strokeOpacity: ring.visible ? 1 : 0 }}
                        />
                      </g>
                    ))}
                  </g>
                </svg>
                <div className="nd-ring-center">
                  <span className="nd-ring-kcal">
                    <Tween value={eatenKcal > 0 ? Math.max(0, active.kcal - eatenKcal) : active.kcal} format={n} />
                  </span>
                  <span className="nd-ring-label">{eatenKcal > 0 ? "kcal left" : "kcal"}</span>
                </div>
              </button>

              <div className="nd-macros">
                {active.macros.map((m) => (
                  <div key={m.id} className="nd-macro">
                    <span className="nd-macro-bar" style={{ background: HUE[m.id] }} aria-hidden="true" />
                    <div className="nd-macro-body">
                      <div className="nd-macro-grams">
                        <Tween value={m.grams} format={n} />
                        <small>g</small>
                      </div>
                      <div className="nd-macro-name">
                        {m.name} ·{" "}
                        <span className="nd-macro-share" style={{ color: HUE[m.id] }}>
                          <Tween value={m.share * 100} format={(v) => String(Math.round(v))} />%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </div>

              {/* Which of the two days is showing, and that the card swipes. */}
              <div className="nd-dots" aria-hidden="true">
                <span className={isTraining ? "on" : undefined} />
                <span className={isTraining ? undefined : "on"} />
              </div>
            </div>
          ) : (
            <p className="nd-empty">Your coach hasn&rsquo;t set your nutrition targets yet.</p>
          )}

          {footer}
        </section>
      </div>
    </>
  );
}
