"use client";

import { useState } from "react";
import { approveReportAction, deleteReportAction, sendReportAction, updateReportSummaryAction } from "../lib/actions";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import { LineChart } from "../components/LineChart";
import type { ClientReport, ReportSectionData } from "../lib/queries";

const STATUS_LABEL: Record<ClientReport["status"], string> = {
  draft: "draft",
  approved: "approved — not sent",
  sent: "sent",
};

// "Report for August 2026" reads better than a raw date range when the
// period is a normal calendar month (the common case); falls back to the
// explicit range for anything custom/irregular so it's never misleading.
function reportTitle(clientName: string, periodStart: string, periodEnd: string) {
  const start = new Date(periodStart + "T00:00:00");
  const end = new Date(periodEnd + "T00:00:00");
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${clientName} — Report for ${start.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
  }
  return `${clientName} — Report (${periodStart} to ${periodEnd})`;
}

function statLine(data: Record<string, unknown>) {
  return Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join(" · ");
}

function ReportSection({ section }: { section: ReportSectionData }) {
  return (
    <div className="report-section-block">
      <div className="report-section-heading">{section.label}</div>
      {Object.keys(section.data).length > 0 && <div className="exercise-meta">{statLine(section.data)}</div>}
      {section.series && section.series.length >= 2 && (
        <div className="report-section-chart">
          <LineChart points={section.series} />
        </div>
      )}
      {section.seriesByField &&
        Object.entries(section.seriesByField).map(([fieldName, { points }]) => (
          <div key={fieldName} className="report-section-chart">
            <div className="exercise-meta" style={{ marginBottom: 4 }}>
              {fieldName}
            </div>
            <LineChart points={points} />
          </div>
        ))}
    </div>
  );
}

// Draft and approved reports are still editable (the coach can fix anything
// the AI got wrong, or just rewrite it entirely); once sent the summary is
// locked as a record of what the client actually received.
export default function ReportCard({ report, clientName }: { report: ClientReport; clientName: string }) {
  const [editing, setEditing] = useState(false);
  const [showData, setShowData] = useState(false);
  const locked = report.status === "sent";
  const sections: ReportSectionData[] = (() => {
    try {
      return JSON.parse(report.sections_snapshot);
    } catch {
      return [];
    }
  })();

  return (
    <div className="nutrition-table-wrap builder-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <strong>{reportTitle(clientName, report.period_start, report.period_end)}</strong>{" "}
          <span className={`status-pill ${report.status === "sent" ? "published" : "draft"}`}>
            {STATUS_LABEL[report.status]}
          </span>
          <div className="exercise-meta" style={{ marginTop: 4 }}>
            {report.period_start} → {report.period_end} · {report.template_name} ·{" "}
            {report.ai_generated ? "AI-written" : "template summary (no AI key set)"} · generated{" "}
            {report.generated_at.slice(0, 10)}
          </div>
        </div>
        <ConfirmDeleteButton action={deleteReportAction} hiddenFields={{ id: report.id }} label="Delete report" />
      </div>

      {editing && !locked ? (
        <form
          action={updateReportSummaryAction}
          onSubmit={() => setEditing(false)}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <input type="hidden" name="id" value={report.id} />
          <textarea name="summary" defaultValue={report.summary} rows={8} />
          <div>
            <button className="btn secondary" type="submit">
              Save
            </button>
          </div>
        </form>
      ) : (
        <p style={{ whiteSpace: "pre-wrap" }}>{report.summary}</p>
      )}

      {sections.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="strength-progress-toggle" onClick={() => setShowData((o) => !o)}>
            <span className="exercise-meta" style={{ fontWeight: 700 }}>
              {showData ? "Hide" : "Show"} charts & data ({sections.length} section{sections.length === 1 ? "" : "s"})
            </span>
          </button>
          {showData && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 16 }}>
              {sections.map((s, i) => (
                <ReportSection key={i} section={s} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="row-icon-actions" style={{ marginTop: 10, justifyContent: "flex-start" }}>
        {!locked && !editing && (
          <button type="button" className="btn secondary" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        {report.status === "draft" && (
          <form action={approveReportAction}>
            <input type="hidden" name="id" value={report.id} />
            <button className="btn secondary" type="submit">
              Approve
            </button>
          </form>
        )}
        {report.status === "approved" && (
          <form action={sendReportAction}>
            <input type="hidden" name="id" value={report.id} />
            <button className="deploy-btn" type="submit">
              Send to client
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
