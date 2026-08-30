"use client";

import { useState } from "react";
import { ChevronDownIcon } from "../components/icons";

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
};

export default function ReportArchiveList({ reports }: { reports: ArchiveReport[] }) {
  const [openId, setOpenId] = useState<number | null>(null);

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
                  {r.isNew && <span className="settings-report-new">New</span>}
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
