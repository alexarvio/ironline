"use client";

import { useState } from "react";
import { approveReportAction, deleteReportAction, sendReportAction, updateReportSummaryAction } from "../lib/actions";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import type { ClientReport } from "../lib/queries";

const STATUS_LABEL: Record<ClientReport["status"], string> = {
  draft: "draft",
  approved: "approved — not sent",
  sent: "sent",
};

// Draft and approved reports are still editable (the coach can fix anything
// the AI got wrong, or just rewrite it entirely); once sent the summary is
// locked as a record of what the client actually received.
export default function ReportCard({ report }: { report: ClientReport }) {
  const [editing, setEditing] = useState(false);
  const locked = report.status === "sent";

  return (
    <div className="nutrition-table-wrap builder-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <strong>
            {report.period_start} → {report.period_end}
          </strong>{" "}
          <span className={`status-pill ${report.status === "sent" ? "published" : "draft"}`}>
            {STATUS_LABEL[report.status]}
          </span>
          <div className="exercise-meta" style={{ marginTop: 4 }}>
            {report.template_name} · {report.ai_generated ? "AI-written" : "template summary (no AI key set)"} ·
            generated {report.generated_at.slice(0, 10)}
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
