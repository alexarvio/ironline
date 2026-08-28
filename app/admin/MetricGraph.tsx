"use client";

import { useMemo, useState } from "react";
import { LineChart, Point } from "../components/LineChart";

type RangeKey = "day" | "week" | "month" | "all";
type MetricKey = "strength" | "weight" | "calories";

const RANGE_DAYS: Record<RangeKey, number> = { day: 1, week: 7, month: 30, all: 3650 };
const RANGE_LABEL: Record<RangeKey, string> = {
  day: "Last day",
  week: "Last week",
  month: "Last month",
  all: "All time",
};
const METRIC_LABEL: Record<MetricKey, string> = {
  strength: "Strength (volume)",
  weight: "Body weight",
  calories: "Calories",
};

export default function MetricGraph({
  strengthSeries,
  weightSeries,
}: {
  strengthSeries: Point[];
  weightSeries: Point[];
}) {
  const [range, setRange] = useState<RangeKey>("month");
  const [metric, setMetric] = useState<MetricKey>("strength");

  const data: Record<MetricKey, Point[]> = {
    strength: strengthSeries,
    weight: weightSeries,
    calories: [],
  };

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return data[metric].filter((p) => new Date(p.date) >= cutoff);
  }, [range, metric, strengthSeries, weightSeries]);

  return (
    <div className="graph-card">
      <div className="graph-controls">
        <div className="toggle-group" role="group" aria-label="Time range">
          {(Object.keys(RANGE_LABEL) as RangeKey[]).map((key) => (
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
        <div className="toggle-group" role="group" aria-label="Metric">
          {(Object.keys(METRIC_LABEL) as MetricKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`toggle-btn${metric === key ? " active" : ""}`}
              onClick={() => setMetric(key)}
            >
              {METRIC_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="graph-empty">
          {metric === "strength"
            ? "No sets logged in this range yet."
            : `${METRIC_LABEL[metric]} tracking isn't built yet — this will populate once that logging exists.`}
        </div>
      ) : (
        <LineChart points={filtered} />
      )}
    </div>
  );
}
