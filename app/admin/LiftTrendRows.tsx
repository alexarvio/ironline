"use client";

import { useState } from "react";
import { Point } from "../components/LineChart";

// Sparkline path across a lift's own min/max, so a lift that has moved 2.5kg
// reads as clearly as one that has moved 40 — the row is about direction,
// the delta beside it carries the magnitude.
function sparkPath(points: Point[], w: number, h: number, pad: number) {
  if (points.length < 2) return "";
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const stepX = (w - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) - ((v - lo) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function LiftTrendRows({
  lifts,
}: {
  lifts: { id: number; name: string; points: Point[]; delta: string; up: boolean }[];
}) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="pb-lifts">
      {lifts.map((l) => (
        <button
          key={l.id}
          type="button"
          className={`pb-lift${l.id === selected ? " active" : ""}`}
          onClick={() => setSelected(l.id === selected ? null : l.id)}
        >
          <span className="pb-lift-name">{l.name}</span>
          <svg viewBox="0 0 60 18" preserveAspectRatio="none" aria-hidden="true" className="pb-lift-spark">
            <path
              d={sparkPath(l.points, 60, 18, 2)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span className={`pb-lift-delta${l.up ? " up" : ""}`}>{l.delta}</span>
        </button>
      ))}
    </div>
  );
}
