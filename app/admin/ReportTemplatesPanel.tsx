import {
  createReportTemplateAction,
  deleteReportTemplateAction,
  removeReportTemplateSectionAction,
} from "../lib/actions";
import {
  listDistinctMetricNames,
  listReportTemplates,
  listReportTemplateSections,
  REPORT_SECTION_TYPE_LABEL,
} from "../lib/queries";
import AddReportSectionForm from "./AddReportSectionForm";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";

export default function ReportTemplatesPanel() {
  const templates = listReportTemplates();
  const knownMetricNames = [
    ...new Set([...listDistinctMetricNames("daily"), ...listDistinctMetricNames("weekly")].map((m) => m.name)),
  ];

  return (
    <div>
      <h1>Report Templates</h1>
      <p className="empty-note" style={{ marginBottom: 18 }}>
        Build a reusable set of report sections once, then generate a report from it for any
        client. See the Reports tab on each client&rsquo;s page. Different clients can use the
        same template even though their actual data differs.
      </p>

      <div className="nutrition-table-wrap builder-card">
        <h3 className="builder-pill-heading">New template</h3>
        <form action={createReportTemplateAction} className="add-invoice-form">
          <input name="name" type="text" placeholder="Template name (e.g. Fat loss client)" required />
          <button className="btn" type="submit">
            Create
          </button>
        </form>
      </div>

      {templates.length === 0 ? (
        <p className="empty-note">No templates yet. Create one above.</p>
      ) : (
        templates.map((t) => {
          const sections = listReportTemplateSections(t.id);
          return (
            <div key={t.id} className="nutrition-table-wrap builder-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 className="builder-pill-heading" style={{ margin: 0 }}>
                  {t.name}
                </h3>
                <ConfirmDeleteButton action={deleteReportTemplateAction} hiddenFields={{ id: t.id }} label={`Delete template ${t.name}`} />
              </div>

              {sections.length > 0 && (
                <div className="invoice-list" style={{ marginBottom: 14 }}>
                  {sections.map((s) => (
                    <div key={s.id} className="invoice-row">
                      <span>
                        <strong>{s.label}</strong>{" "}
                        <span className="exercise-meta">
                          ({REPORT_SECTION_TYPE_LABEL[s.type]}
                          {s.metric_name ? `: ${s.metric_name}` : ""})
                        </span>
                      </span>
                      <ConfirmDeleteButton
                        action={removeReportTemplateSectionAction}
                        hiddenFields={{ id: s.id }}
                        label={`Remove section ${s.label}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <AddReportSectionForm templateId={t.id} knownMetricNames={knownMetricNames} />
            </div>
          );
        })
      )}
    </div>
  );
}
