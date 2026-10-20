// What sums a metric up over the days on screen (21 Oct, Alex): the change
// from first to last for a reading whose trend is the point (body weight,
// body fat, measurements), or the average for one that goes up and down day
// to day (sleep, resting heart rate, steps, water, a /10 scale). The coach
// can switch it per metric; until then the unit decides, and a body
// measurement's name decides when its unit doesn't say (a library metric
// with no unit, say). Plain constants: safe to import from a client component.

export type MetricSummary = "change" | "average";

const CHANGE_UNITS = /^(kg|kgs|lb|lbs|%|cm|mm|in|inch|inches)$/i;
const CHANGE_NAMES = /weight|body ?fat|waist|hips?\b|chest|arm|thigh|neck|calf|bicep|measurement/i;

export function defaultSummary(name: string, unit: string): MetricSummary {
  return CHANGE_UNITS.test(unit.trim()) || CHANGE_NAMES.test(name) ? "change" : "average";
}

export function metricSummary(def: { name: string; unit: string; summary?: MetricSummary | null }): MetricSummary {
  return def.summary === "change" || def.summary === "average" ? def.summary : defaultSummary(def.name, def.unit);
}
