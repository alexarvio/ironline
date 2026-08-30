"use client";

import { useState } from "react";
import { LineChart, Point } from "../components/LineChart";
import { archiveReportAction, unarchiveReportAction } from "../lib/actions";

// Deliberately does NOT import from ../lib/queries — see HomeHub.tsx for why
// a "use client" file importing queries.ts breaks the dev server.
export type ReportStat = { label: string; value: string };
export type ReportChart = { points: Point[]; fromLabel: string; toLabel: string; caption: string } | null;

// Home Dark's progress-report band: collapsed to a headline + period until
// the client taps "Read report", which expands the coach's summary, the
// available stat deltas, and one trend chart from the report's own data.
// "Done" archives it (client_reports.archived_at) — Home then shows a thin
// "archived, find it in Settings" strip with Undo instead of the full card.
export default function ProgressReportCard({
  reportId,
  periodLabel,
  headline,
  body,
  stats,
  chart,
  archived,
}: {
  reportId: number;
  periodLabel: string;
  headline: string;
  body: string;
  stats: ReportStat[];
  chart: ReportChart;
  archived: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (archived) {
    return (
      <div className="report-archived-strip">
        <span>Report archived · find it in Settings</span>
        <form action={unarchiveReportAction}>
          <input type="hidden" name="id" value={reportId} />
          <button type="submit" className="report-undo-btn">
            Undo
          </button>
        </form>
      </div>
    );
  }

  return (
    <section className="report-card">
      <div className="report-card-top">
        <span className="report-card-kicker">New progress report</span>
        <span className="report-card-period">{periodLabel}</span>
      </div>
      <div className="report-card-headline">{headline}</div>

      {expanded && (
        <div>
          <p className="report-card-body">{body}</p>
          {stats.length > 0 && (
            <div className="report-card-stats">
              {stats.map((r) => (
                <div key={r.label}>
                  <div className="report-card-stat-label">{r.label}</div>
                  <div className="report-card-stat-value">{r.value}</div>
                </div>
              ))}
            </div>
          )}
          {chart && chart.points.length >= 2 && (
            <>
              <div className="report-card-chart">
                <LineChart points={chart.points} bleed gradientId={`report-grad-${reportId}`} />
              </div>
              <div className="report-card-chart-foot">
                <span>{chart.fromLabel}</span>
                <span>{chart.caption}</span>
                <span>{chart.toLabel}</span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="report-card-actions">
        <button type="button" className="report-toggle-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Collapse" : "Read report"}
        </button>
        {expanded && (
          <form action={archiveReportAction}>
            <input type="hidden" name="id" value={reportId} />
            <button type="submit" className="report-done-btn">
              Done
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
