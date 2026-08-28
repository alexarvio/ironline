import { generateReportAction } from "../lib/actions";
import { listClientReports, listReportTemplates, localDateStr } from "../lib/queries";
import ReportCard from "./ReportCard";

// Sensible default period for the "generate" form: the last 30 days ending
// today — the coach can still change either date before generating.
function defaultPeriod() {
  const end = localDateStr();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start: localDateStr(start), end };
}

export default function ReportsPanel({ clientId }: { clientId: number }) {
  const templates = listReportTemplates();
  const reports = listClientReports(clientId);
  const { start, end } = defaultPeriod();

  return (
    <div>
      <p className="empty-note" style={{ marginBottom: 18 }}>
        Generate a report from a template, review the AI-written draft, edit if needed, then
        approve and send — nothing reaches the client until you send it.
      </p>

      <div className="nutrition-table-wrap builder-card">
        <h3 className="builder-pill-heading">Generate a report</h3>
        {templates.length === 0 ? (
          <p className="empty-note">
            No report templates yet — build one first from Report Templates in the sidebar.
          </p>
        ) : (
          <form action={generateReportAction} className="add-invoice-form add-metric-form">
            <input type="hidden" name="clientId" value={clientId} />
            <select name="templateId" defaultValue="">
              <option value="" disabled>
                Choose a template…
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <label className="exercise-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              From
              <input name="periodStart" type="date" defaultValue={start} />
            </label>
            <label className="exercise-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              To
              <input name="periodEnd" type="date" defaultValue={end} />
            </label>
            <button className="btn" type="submit">
              Generate draft
            </button>
          </form>
        )}
      </div>

      {reports.length === 0 ? (
        <p className="empty-note">No reports generated yet for this client.</p>
      ) : (
        reports.map((r) => <ReportCard key={r.id} report={r} />)
      )}
    </div>
  );
}
