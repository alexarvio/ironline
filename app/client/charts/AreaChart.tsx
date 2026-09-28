"use client";

import { useId } from "react";

// A pure SVG area chart: a smooth line through the points with the area
// under it faded out, in one colour. No axes, no markers: the parent draws
// the grid, the target line and the marker over it, and maps the pointer to
// a point itself. Smooth means cubic segments with flat tangents at each
// point (the control points sit at the midpoint x), so the curve never
// overshoots a value.
export type ChartPoint = { x: number; y: number };

export function smoothPath(pts: ChartPoint[]): string {
  if (pts.length === 0) return "";
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const mx = ((a.x + b.x) / 2).toFixed(1);
    d += ` C${mx},${a.y.toFixed(1)} ${mx},${b.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }
  return d;
}

export default function AreaChart({
  points,
  color,
  colorRgb,
  width,
  height,
  bottom,
  thin = false,
}: {
  points: ChartPoint[];
  /** The line's colour and its "r,g,b" for the fade. */
  color: string;
  colorRgb: string;
  width: number;
  height: number;
  /** The y the area closes to (the chart's bottom inset). */
  bottom: number;
  /** A dense range (3M / All past 60 points): a 2px stroke instead of 2.5. */
  thin?: boolean;
}) {
  const id = useId();
  const gradId = `pg-fill-${id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const line = smoothPath(points);
  const area = points.length > 1 ? `${line} L${points[points.length - 1].x.toFixed(1)},${bottom} L${points[0].x.toFixed(1)},${bottom} Z` : "";
  return (
    <svg className="pg-chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`rgba(${colorRgb},.28)`} />
          <stop offset="100%" stopColor={`rgba(${colorRgb},0)`} />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${gradId})`} />}
      {points.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth={thin ? 2 : 2.5} strokeLinecap="round" strokeLinejoin="round" />}
      {points.length === 1 && <circle cx={points[0].x} cy={points[0].y} r={3} fill={color} />}
    </svg>
  );
}
