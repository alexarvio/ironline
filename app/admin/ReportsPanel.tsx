import { getClient, listClientReports, listMetricDefinitions, listReportTemplates, listReportTemplateSections, localDateStr } from "../lib/queries";
import GenerateReportForm from "./GenerateReportForm";
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
  const client = getClient(clientId);
  const templates = listReportTemplates().map((t) => ({ id: t.id, name: t.name, sections: listReportTemplateSections(t.id) }));
  const reports = listClientReports(clientId);
  const { start, end } = defaultPeriod();

  // Scoped to what THIS client actually has deployed (not every metric
  // across every client) — suggesting a metric they don't have would just
  // generate a report section that says "not set up for this client".
  const clientMetricNames = [
    ...new Set([...listMetricDefinitions(clientId, "daily"), ...listMetricDefinitions(clientId, "weekly")].map((d) => d.name)),
  ];

  return (
    <div>
      <p className="empty-note" style={{ marginBottom: 18 }}>
        Generate a report from a saved template, or build one from scratch for just this client —
        review the AI-written draft, edit if needed, then approve and send. Nothing reaches the
        client until you send it.
      </p>

      <div className="nutrition-table-wrap builder-card">
        <h3 className="builder-pill-heading">Generate a report</h3>
        <GenerateReportForm
          clientId={clientId}
          templates={templates}
          knownMetricNames={clientMetricNames}
          defaultPeriodStart={start}
          defaultPeriodEnd={end}
        />
      </div>

      {reports.length === 0 ? (
        <p className="empty-note">No reports generated yet for this client.</p>
      ) : (
        reports.map((r) => <ReportCard key={r.id} report={r} clientName={client?.name ?? ""} />)
      )}
    </div>
  );
}
