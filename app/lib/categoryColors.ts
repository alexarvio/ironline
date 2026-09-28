// The metric groups' colours (METRIC_GROUPS in queries.ts), one source for
// the admin metric library, the group pills on the Measurements tab and the
// client's check-in Progress charts, so they never drift. Plain constants:
// safe to import from a client component. `tint` is the pill's wash; `hex`
// is the same hue, strong, for the chart line and the library headings.

export type GroupColour = { hex: string; rgb: string; tint: string };

export const GROUP_COLOUR: Record<string, GroupColour> = {
  body: { hex: "#2f5d8f", rgb: "47,93,143", tint: "#cfe0f2" },
  sleep: { hex: "#4c42a8", rgb: "76,66,168", tint: "#d8d3f0" },
  activity: { hex: "#1f7a4d", rgb: "31,122,77", tint: "#c9e7d5" },
  fatigue: { hex: "#b0691f", rgb: "176,105,31", tint: "#f4dcc0" },
  lifestyle: { hex: "#1d7b86", rgb: "29,123,134", tint: "#c9e6ea" },
  stress: { hex: "#b5393d", rgb: "181,57,61", tint: "#f3cfcf" },
  nutrition: { hex: "#5f7a18", rgb: "95,122,24", tint: "#e6ebb8" },
  training: { hex: "#5a4fb8", rgb: "90,79,184", tint: "#d5d2f3" },
  wellbeing: { hex: "#6b4aa8", rgb: "107,74,168", tint: "#e2d7ee" },
  measurements: { hex: "#5b6474", rgb: "91,100,116", tint: "#dde3e9" },
  optional: { hex: "#8a7550", rgb: "138,117,80", tint: "#e8e3d8" },
  other: { hex: "#5b6474", rgb: "91,100,116", tint: "#dfe6ef" },
};

export const OTHER_COLOUR: GroupColour = GROUP_COLOUR.other;

/** A group key's colours; unknown groups take the neutral. */
export function groupColour(key: string): GroupColour {
  return GROUP_COLOUR[key] ?? OTHER_COLOUR;
}

/** A group key's hex (the admin Measurements column heads). */
export function colourOfGroup(key: string): string {
  return groupColour(key).hex;
}
