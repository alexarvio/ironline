"use client";

import { useState } from "react";
import { addReportTemplateSectionAction } from "../lib/actions";
import ComboBoxInput from "../components/ComboBoxInput";
import { REPORT_SECTION_TYPE_LABEL, ReportSectionType } from "../lib/reportSectionTypes";

// Metric-name only makes sense for the "tracker_metric" section type, so
// this needs to be a client component to show/hide that field reactively.
export default function AddReportSectionForm({
  templateId,
  knownMetricNames,
}: {
  templateId: number;
  knownMetricNames: string[];
}) {
  const [type, setType] = useState<ReportSectionType>("training");

  return (
    <form action={addReportTemplateSectionAction} className="add-invoice-form add-metric-form">
      <input type="hidden" name="templateId" value={templateId} />
      <select name="type" value={type} onChange={(e) => setType(e.target.value as ReportSectionType)}>
        {(Object.keys(REPORT_SECTION_TYPE_LABEL) as ReportSectionType[]).map((t) => (
          <option key={t} value={t}>
            {REPORT_SECTION_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <input name="label" type="text" placeholder="Section label (e.g. Stress levels)" required />
      {type === "tracker_metric" && (
        <ComboBoxInput name="metricName" options={knownMetricNames} placeholder="Metric name (e.g. Stress)" />
      )}
      <button className="btn secondary" type="submit">
        Add section
      </button>
    </form>
  );
}
