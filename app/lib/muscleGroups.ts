// The muscle groups' colours (14 Oct): one per group the library files
// exercises under (MUSCLE_GROUPS in queries.ts), beside the event and
// category colours so the palettes read as one family. Used by the
// exercise editor's pill, glow and tiles, and the substitute rows' tint.

export type GroupColour = { color: string; rgb: string };

const COLOURS: Record<string, GroupColour> = {
  back: { color: "#2f5d8f", rgb: "47,93,143" },
  chest: { color: "#b8471f", rgb: "184,71,31" },
  legs: { color: "#1f7a4d", rgb: "31,122,77" },
  shoulders: { color: "#a8761f", rgb: "168,118,31" },
  arms: { color: "#4c42a8", rgb: "76,66,168" },
  abs: { color: "#1d7a70", rgb: "29,122,112" },
  core: { color: "#1d7a70", rgb: "29,122,112" },
  glutes: { color: "#a8476f", rgb: "168,71,111" },
  cardio: { color: "#a8761f", rgb: "168,118,31" },
  other: { color: "#5b6472", rgb: "91,100,114" },
};

/** The colour for a group slug; anything unknown reads as Other's grey. */
export function groupColour(slug: string | null | undefined): GroupColour {
  return COLOURS[(slug ?? "").toLowerCase()] ?? COLOURS.other;
}
