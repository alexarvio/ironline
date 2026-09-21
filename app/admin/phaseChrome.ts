import type { PhaseTrack } from "../lib/db";

// The one place a phase's colours are decided.
//
// The phase's STATE decides the colour; the TRACK only decides the tag.
// A live phase wears its track's colours (nutrition green, training purple,
// lifestyle beige), because that is the thing happening now. Every
// scheduled phase on every track is the same blue: at that point all a
// coach needs to know is that it is coming, not happening. A draft is
// peach with a dashed edge, and dashed means draft and nothing else, here,
// on the Plan timeline and in the phase dialog.
//
// Imported by the phase dialog, the Plan timeline's bars, the all-clients
// Phases view and the phase header strip on Training / Nutrition /
// Measurements, so they cannot drift apart. Never store a colour: derive the
// state on every render (phaseStateOf) and ask here.

export type PhaseState = "live" | "scheduled" | "draft" | "past";

export type PhaseChrome = {
  /** The selection band, the header strip, a bar's fill. */
  band: string;
  /** Endpoints, the active field, selected week numbers: the state's ink. */
  edge: string;
  /** The ring round the active field and the soft fill of a selected pill. */
  soft: string;
  /** A bar's outline when it is not dashed. */
  line: string;
  chipBg: string;
  chipInk: string;
  /** Draft only: 1px dashed edge in `edge`. */
  dashed: boolean;
};

/** The track palettes, from .pl-bar / .pl-track-tag. The tag always wears these. */
export const TRACK_PALETTE: Record<PhaseTrack, { tint: string; ink: string; soft: string; line: string }> = {
  nutrition: { tint: "#dff3ea", ink: "#0f5c46", soft: "#cfeade", line: "#9fd3bb" },
  training: { tint: "#e6e4fa", ink: "#3a3390", soft: "#dcd8f6", line: "#b9b4ec" },
  lifestyle: { tint: "#efede6", ink: "#4a4a45", soft: "#e4e1d5", line: "#cfcbbd" },
};

export const TRACK_LABEL: Record<PhaseTrack, string> = { nutrition: "Nutrition", training: "Training", lifestyle: "Lifestyle" };

export const STATE_LABEL: Record<PhaseState, string> = { live: "Live", scheduled: "Scheduled", draft: "Draft", past: "Past" };

const SCHEDULED: PhaseChrome = { band: "#eef3f9", edge: "#1e3a6e", soft: "#e6ecf3", line: "#c9d6e6", chipBg: "#e6ecf3", chipInk: "#1e3a6e", dashed: false };
const DRAFT: PhaseChrome = { band: "#fdf3ee", edge: "#b3471d", soft: "#fbe9e0", line: "#b3471d", chipBg: "#fbe9e0", chipInk: "#b3471d", dashed: true };

export function phaseChrome(track: PhaseTrack, state: PhaseState): PhaseChrome {
  if (state === "scheduled") return SCHEDULED;
  if (state === "draft") return DRAFT;
  // Live, and past too: a finished phase is still that track's history, and
  // the timeline already shades the weeks behind today.
  const t = TRACK_PALETTE[track];
  return { band: t.tint, edge: t.ink, soft: t.soft, line: t.line, chipBg: t.tint, chipInk: t.ink, dashed: false };
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * What a phase is today. `endWeek` is the Monday of its last week, as stored.
 * A draft stays a draft whatever its dates; otherwise the dates decide, so a
 * live phase whose start is moved into the future is scheduled from that
 * moment, and a scheduled one whose start comes round is live.
 */
export function phaseStateOf({ draft, startWeek, endWeek, today }: { draft: boolean; startWeek: string; endWeek: string; today: string }): PhaseState {
  if (draft) return "draft";
  if (startWeek > today) return "scheduled";
  if (addDays(endWeek, 6) < today) return "past";
  return "live";
}
