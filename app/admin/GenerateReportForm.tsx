"use client";

import { useState } from "react";
import { generateReportAction } from "../lib/actions";
import { REPORT_SECTION_TYPE_LABEL } from "../lib/reportSectionTypes";
import type { ReportTemplateSection } from "../lib/queries";

export type TemplateWithSections = { id: number; name: string; sections: ReportTemplateSection[] };

// Lets the coach tailor one specific generation without touching the shared
// template: uncheck any section that doesn't apply to this client, and
// optionally bolt on one extra tracker metric (e.g. "Water") that isn't in
// the template at all — this is the "set that for that specific client"
// customization, kept lightweight instead of a full per-client template fork.
export default function GenerateReportForm({
  clientId,
  templates,
  defaultPeriodStart,
  defaultPeriodEnd,
}: {
  clientId: number;
  templates: TemplateWithSections[];
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
}) {
  const [templateId, setTemplateId] = useState<number | "">("");
  const [extraMetricOpen, setExtraMetricOpen] = useState(false);
  const selected = templates.find((t) => t.id === templateId);

  return (
    <form action={generateReportAction} className="report-generate-form">
      <input type="hidden" name="clientId" value={clientId} />

      <div className="add-invoice-form add-metric-form">
        <select
          name="templateId"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Choose a template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label className="exercise-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          From
          <input name="periodStart" type="date" defaultValue={defaultPeriodStart} />
        </label>
        <label className="exercise-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          To
          <input name="periodEnd" type="date" defaultValue={defaultPeriodEnd} />
        </label>
      </div>

      {selected && (
        <div style={{ marginTop: 14 }}>
          <p className="empty-note" style={{ marginBottom: 8 }}>
            Include for this client:
          </p>
          <div className="report-section-checkboxes">
            {selected.sections.map((s) => (
              <label key={s.id} className="report-section-checkbox">
                <input type="checkbox" name="sectionId" value={s.id} defaultChecked />
                {s.label} <span className="exercise-meta">({REPORT_SECTION_TYPE_LABEL[s.type]})</span>
              </label>
            ))}
          </div>

          {extraMetricOpen ? (
            <div className="add-invoice-form add-metric-form" style={{ marginTop: 10 }}>
              <input name="extraMetricLabel" type="text" placeholder="Section label (e.g. Water)" />
              <input name="extraMetricName" type="text" placeholder="Metric name as set up for this client (e.g. Water)" />
            </div>
          ) : (
            <button
              type="button"
              className="btn secondary"
              style={{ marginTop: 10 }}
              onClick={() => setExtraMetricOpen(true)}
            >
              + Add one more metric just for this report
            </button>
          )}

          <button className="btn" type="submit" style={{ marginTop: 14 }}>
            Generate draft
          </button>
        </div>
      )}
    </form>
  );
}
