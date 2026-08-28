"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LineChart, Point } from "../components/LineChart";

type RangeKey = "week" | "month" | "all" | "custom";

const RANGE_DAYS: Record<Exclude<RangeKey, "custom" | "all">, number> = { week: 7, month: 30 };
const RANGE_LABEL: Record<RangeKey, string> = {
  week: "Last week",
  month: "Last month",
  all: "All time",
  custom: "Custom",
};

// Daily-tracker metrics get week/month/all-time/custom; weekly-tracker
// metrics skip "week" since one weekly entry per week makes a 7-day window
// nearly always empty or a single point — not a trend.
const RANGES_BY_FREQUENCY: Record<"daily" | "weekly", RangeKey[]> = {
  daily: ["week", "month", "all", "custom"],
  weekly: ["month", "all", "custom"],
};

export default function TrackerMetricTrendModal({
  metricName,
  unit,
  frequency,
  points,
  onClose,
}: {
  metricName: string;
  unit: string;
  frequency: "daily" | "weekly";
  points: Point[];
  onClose: () => void;
}) {
  // A unit like "/10" or "/5" is a bounded rating scale — fix the y-axis to
  // its full range (0 to N) rather than auto-fitting to the data, so a
  // consistently high or low rating doesn't render as a misleading sawtooth.
  const boundedMatch = /^\/(\d+(\.\d+)?)$/.exec(unit.trim());
  const yRange: [number, number] | undefined = boundedMatch ? [0, Number(boundedMatch[1])] : undefined;

  const ranges = RANGES_BY_FREQUENCY[frequency];
  const [range, setRange] = useState<RangeKey>(frequency === "daily" ? "month" : "all");
  const [customFrom, setCustomFrom] = useState(points[0]?.date ?? "");
  const [customTo, setCustomTo] = useState(points[points.length - 1]?.date ?? "");

  const filtered = useMemo(() => {
    if (range === "all") return points;
    if (range === "custom") {
      if (!customFrom && !customTo) return points;
      return points.filter((p) => (!customFrom || p.date >= customFrom) && (!customTo || p.date <= customTo));
    }
    const days = RANGE_DAYS[range];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return points.filter((p) => p.date >= cutoffStr);
  }, [range, customFrom, customTo, points]);

  // Rendered as a portal into document.body — this component is triggered
  // from a table row, and a fixed-position overlay as a direct child of
  // <tr>/<tbody> would be invalid HTML.
  return createPortal(
    <div className="tracker-trend-backdrop" onClick={onClose}>
      <div className="tracker-trend-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tracker-trend-header">
          <h3>
            {metricName}
            {unit ? <span className="exercise-meta"> ({unit})</span> : null}
          </h3>
          <button type="button" className="row-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="toggle-group" role="group" aria-label="Time range">
          {ranges.map((key) => (
            <button
              key={key}
              type="button"
              className={`toggle-btn${range === key ? " active" : ""}`}
              onClick={() => setRange(key)}
            >
              {RANGE_LABEL[key]}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="tracker-trend-custom-range">
            <label>
              From
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </label>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="graph-empty">No entries logged in this range yet.</div>
        ) : (
          <LineChart points={filtered} yRange={yRange} />
        )}
      </div>
    </div>,
    document.body
  );
}
