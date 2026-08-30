"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "../components/icons";
import { LineChart, Point } from "../components/LineChart";
import { markReportOpenedAction } from "../lib/actions";
import { useFocusRef } from "./CheckInContext";

// Deliberately does NOT import from ../lib/queries — see HomeHub.tsx for why
// a "use client" file importing queries.ts breaks the dev server. Reports
// are precomputed server-side (page.tsx); this just tracks which one is
// expanded, independently per row.
export type ArchiveReport = {
  id: number;
  period: string;
  summary: string;
  body: string;
  isNew: boolean;
  stats: { label: string; value: string }[];
  // Kept from the report's own sections when one of them has a plottable
  // series. The design's Settings row is text + stats only, but this is the
  // one place a sent report is readable at all now, so the chart the coach
  // put in it stays rather than being dropped on the floor.
  chart: { points: Point[]; fromLabel: string; toLabel: string; caption: string } | null;
};

export default function ReportArchiveList({ reports }: { reports: ArchiveReport[] }) {
  // Set when the client arrived here by tapping the "new report"
  // notification — that report opens straight away instead of landing on a
  // collapsed list. AppShell remounts the tab on navigation, so reading it
  // as the initial state is enough.
  const focusRef = useFocusRef();
  const [openId, setOpenId] = useState<number | null>(
    focusRef != null && reports.some((r) => r.id === focusRef) ? focusRef : null
  );

  // Expanding a report is what clears its "New" flag, whether the client
  // tapped the row or was deep-linked here. Fire-and-forget: the pill is
  // already gone locally, the write just makes that survive a reload. The
  // write revalidates /client, which re-renders this list, so keep a record
  // of what's already been marked rather than posting again on the way back.
  const marked = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (openId == null || marked.current.has(openId)) return;
    marked.current.add(openId);
    markReportOpenedAction(openId);
  }, [openId]);

  return (
    <div className="home-dark-rows">
      {reports.map((r) => {
        const open = openId === r.id;
        return (
          <div key={r.id}>
            <button type="button" className="settings-report-row" onClick={() => setOpenId(open ? null : r.id)}>
              <div className="home-dark-row-body">
                <div className="settings-report-top">
                  <span className="settings-report-period">{r.period}</span>
                  {r.isNew && !open && <span className="settings-report-new">New</span>}
                </div>
                <div className="settings-report-summary">{r.summary}</div>
              </div>
              <span className={`settings-report-chevron${open ? " open" : ""}`} aria-hidden="true">
                <ChevronDownIcon />
              </span>
            </button>
            {open && (
              <div className="settings-report-body">
                <p className="settings-report-text">{r.body}</p>
                {r.stats.length > 0 && (
                  <div className="report-card-stats">
                    {r.stats.map((st) => (
                      <div key={st.label}>
                        <div className="report-card-stat-label">{st.label}</div>
                        <div className="report-card-stat-value">{st.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                {r.chart && r.chart.points.length >= 2 && (
                  <>
                    <div className="report-card-chart">
                      <LineChart points={r.chart.points} bleed gradientId={`report-grad-${r.id}`} />
                    </div>
                    <div className="report-card-chart-foot">
                      <span>{r.chart.fromLabel}</span>
                      <span>{r.chart.caption}</span>
                      <span>{r.chart.toLabel}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
