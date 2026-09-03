"use client";

import { useEffect, useState } from "react";
import { LineChart, Point } from "../components/LineChart";

type MetricChoice = { id: number; name: string; unit: string; cadence: string };

const RANGES = [
  { id: "8w", label: "8w", weeks: 8 },
  { id: "12w", label: "12w", weeks: 12 },
  { id: "all", label: "All", weeks: null as number | null },
];

// One metric at a time, chosen from a dropdown.
//
// Deliberately not multi-select: a shared y-axis across metrics with
// different units is meaningless — sleep hours and body weight on one scale
// tells you nothing true. The cadence is stated beside the name so a monthly
// line having fewer points reads as expected rather than as missing data.
export default function MetricGraphPanel({ metrics }: { metrics: MetricChoice[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(metrics[0]?.id ?? null);
  const [range, setRange] = useState("12w");
  const [points, setPoints] = useState<Point[] | null>(null);

  const selected = metrics.find((m) => m.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    setPoints(null);
    fetch(`/api/metric-series?id=${selectedId}`)
      .then((r) => (r.ok ? r.json() : { points: [] }))
      .then((d) => {
        if (!cancelled) setPoints(d.points ?? []);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (metrics.length === 0) {
    return <p className="ad-panel-empty">Add a metric first and its trend shows up here.</p>;
  }

  const weeks = RANGES.find((r) => r.id === range)?.weeks ?? null;
  const shown =
    points == null
      ? []
      : weeks == null
      ? points
      : points.filter((p) => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - weeks * 7);
          return new Date(`${p.date}T00:00:00`) >= cutoff;
        });

  return (
    <div className="mg">
      <div className="mg-controls">
        <select
          className="mg-select"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          aria-label="Metric to chart"
        >
          {metrics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.unit ? ` (${m.unit})` : ""}
            </option>
          ))}
        </select>

        {selected && <span className="mg-cadence">{selected.cadence}</span>}

        <div className="mg-ranges">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`mg-range${r.id === range ? " on" : ""}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mg-chart">
        {points == null ? (
          <p className="ad-panel-empty">Loading…</p>
        ) : shown.length < 2 ? (
          <p className="ad-panel-empty">
            Not enough readings in this range yet. A line needs at least two.
          </p>
        ) : (
          <LineChart points={shown} />
        )}
      </div>
    </div>
  );
}
