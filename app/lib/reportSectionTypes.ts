// Split out from queries.ts (which imports "fs" via db.ts) so client
// components can import this constant/type without pulling fs into the
// browser bundle — see the TrackerMetricRow/PINNED_METRIC_LIMIT build
// failure earlier for why this split matters.
export type ReportSectionType = "training" | "nutrition" | "measurements" | "tracker_metric" | "photos" | "goals";

export const REPORT_SECTION_TYPE_LABEL: Record<ReportSectionType, string> = {
  training: "Training summary",
  nutrition: "Nutrition plan",
  measurements: "Measurements trend",
  tracker_metric: "Tracker metric",
  photos: "Progress photos",
  goals: "Goals",
};
