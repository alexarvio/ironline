"use client";

import { useState } from "react";
import { generateReportAction } from "../lib/actions";
import { REPORT_SECTION_TYPE_LABEL, ReportSectionType } from "../lib/reportSectionTypes";
import ComboBoxInput from "../components/ComboBoxInput";
import SubmitButton from "./SubmitButton";
import type { ReportTemplateSection } from "../lib/queries";

export type TemplateWithSections = { id: number; name: string; sections: ReportTemplateSection[] };
type CustomSection = { type: ReportSectionType; label: string; metricName: string | null };

// Two ways to generate: pick a saved template (with per-client checkboxes
// to include/exclude + one bolt-on metric), or skip templates entirely and
// build the section list right here for this one client/report — a coach
// with no templates yet, or a client who just needs something different
// this once, isn't blocked on building/editing a template first.
export default function GenerateReportForm({
  clientId,
  templates,
  knownMetricNames,
  defaultPeriodStart,
  defaultPeriodEnd,
}: {
  clientId: number;
  templates: TemplateWithSections[];
  knownMetricNames: string[];
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
}) {
  const [mode, setMode] = useState<"template" | "custom">(templates.length > 0 ? "template" : "custom");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [extraMetricOpen, setExtraMetricOpen] = useState(false);
  const selected = templates.find((t) => t.id === templateId);

  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [draftType, setDraftType] = useState<ReportSectionType>("training");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftMetricName, setDraftMetricName] = useState("");

  function addCustomSection() {
    if (!draftLabel.trim()) return;
    setCustomSections((prev) => [
      ...prev,
      { type: draftType, label: draftLabel.trim(), metricName: draftType === "tracker_metric" ? draftMetricName.trim() || null : null },
    ]);
    setDraftLabel("");
    setDraftMetricName("");
  }

  return (
    <form action={generateReportAction} className="report-generate-form">
      <input type="hidden" name="clientId" value={clientId} />

      {templates.length > 0 && (
        <div className="toggle-group" role="group" aria-label="Generate mode" style={{ marginBottom: 14 }}>
          <button type="button" className={`toggle-btn${mode === "template" ? " active" : ""}`} onClick={() => setMode("template")}>
            From a template
          </button>
          <button type="button" className={`toggle-btn${mode === "custom" ? " active" : ""}`} onClick={() => setMode("custom")}>
            Custom for this client
          </button>
        </div>
      )}

      <div className="add-invoice-form add-metric-form">
        {mode === "template" && (
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
        )}
        <label className="exercise-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          From
          <input name="periodStart" type="date" defaultValue={defaultPeriodStart} />
        </label>
        <label className="exercise-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          To
          <input name="periodEnd" type="date" defaultValue={defaultPeriodEnd} />
        </label>
      </div>

      {mode === "template" && selected && (
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
              <ComboBoxInput name="extraMetricName" options={knownMetricNames} placeholder="Metric this client has deployed" />
            </div>
          ) : (
            <button type="button" className="btn secondary" style={{ marginTop: 10 }} onClick={() => setExtraMetricOpen(true)}>
              + Add one more metric just for this report
            </button>
          )}

          <div style={{ marginTop: 14 }}>
            <SubmitButton pendingText="Generating draft… (calling the AI, a few seconds)">Generate draft</SubmitButton>
          </div>
        </div>
      )}

      {mode === "custom" && (
        <div style={{ marginTop: 14 }}>
          <input type="hidden" name="customSections" value={JSON.stringify(customSections)} />

          {customSections.length > 0 && (
            <div className="report-section-checkboxes" style={{ marginBottom: 12 }}>
              {customSections.map((s, i) => (
                <div key={i} className="report-section-checkbox" style={{ justifyContent: "space-between" }}>
                  <span>
                    {s.label} <span className="exercise-meta">({REPORT_SECTION_TYPE_LABEL[s.type]}{s.metricName ? ` — ${s.metricName}` : ""})</span>
                  </span>
                  <button
                    type="button"
                    className="row-icon-btn row-icon-danger"
                    aria-label={`Remove ${s.label}`}
                    onClick={() => setCustomSections((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="add-invoice-form add-metric-form">
            <select value={draftType} onChange={(e) => setDraftType(e.target.value as ReportSectionType)}>
              {(Object.keys(REPORT_SECTION_TYPE_LABEL) as ReportSectionType[]).map((t) => (
                <option key={t} value={t}>
                  {REPORT_SECTION_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Section label (e.g. Water intake)"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
            />
            {draftType === "tracker_metric" && (
              <ComboBoxInput
                key={customSections.length}
                name="__draftMetricName"
                options={knownMetricNames}
                placeholder="Metric this client has deployed"
                onChange={setDraftMetricName}
              />
            )}
            <button type="button" className="btn secondary" onClick={addCustomSection}>
              Add section
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            <SubmitButton pendingText="Generating draft… (calling the AI, a few seconds)" disabled={customSections.length === 0}>
              Generate draft
            </SubmitButton>
          </div>
        </div>
      )}
    </form>
  );
}
