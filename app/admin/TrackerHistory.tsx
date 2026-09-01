"use client";

import { useState } from "react";
import type { MetricHistory } from "../lib/queries";
import MetricHistoryTable from "./MetricHistoryTable";

// The daily/weekly tracker, with a VIEW BY switch.
//
// Daily and weekly metrics live in one table because they're on comparable
// rhythms — a week of daily readings averages into a weekly row honestly.
// Monthly measurements do not, which is why they get their own table
// elsewhere rather than a third option on this switch.
export default function TrackerHistory({ daily, weekly }: { daily: MetricHistory; weekly: MetricHistory }) {
  const [grain, setGrain] = useState<"daily" | "weekly">("daily");

  return (
    <>
      <div className="ms-head">
        <h3 className="ad-microlabel">Daily &amp; weekly tracker</h3>
        <div className="ms-viewby" role="group" aria-label="View by">
          <span className="ms-viewby-label">View by</span>
          {(["daily", "weekly"] as const).map((g) => (
            <button
              key={g}
              type="button"
              className={`ms-viewby-btn${grain === g ? " on" : ""}`}
              onClick={() => setGrain(g)}
              aria-pressed={grain === g}
            >
              {g === "daily" ? "Daily" : "Weekly"}
            </button>
          ))}
        </div>
      </div>

      <MetricHistoryTable
        history={grain === "daily" ? daily : weekly}
        emptyNote={
          grain === "daily"
            ? "No daily metrics configured yet — add some from the library."
            : "No weekly metrics configured yet — add some from the library."
        }
        maxHeight={290}
        // At weekly grain a daily metric is being averaged, and the header
        // says so rather than implying it's a single reading.
        averaged={grain === "weekly"}
      />
    </>
  );
}
