import type { PhaseTrack } from "./db";

// The stock pictures for a phase card, per track: what the coach picks from
// in the phase dialog, and the default for a phase without a cover (always
// the first, 13 Nov). Files live in public/; add one here and it is offered.
// A track with none shows its deep colour.
export const PHASE_COVERS: Record<PhaseTrack, string[]> = {
  nutrition: ["/img/nutrition-head.jpg"],
  // The gym (13 Nov, Alex: the photo on docs/boards/reopen-session-mockup.html; Unsplash, free to use) first, so it is the default.
  training: ["/img/training-gym.jpg", "/img/session-head.jpg"],
  // Walking on the shore (14 Nov, Alex: number 7 of docs/boards/lifestyle-picture-mockup.html; Unsplash, free to use).
  lifestyle: ["/img/lifestyle-shore.jpg", "/img/lifestyle-bottle.jpg"],
};

export const PHASE_OBJECTIVES_MAX = 3;
export const PHASE_OBJECTIVE_CHARS = 80;

export function defaultPhaseCover(track: PhaseTrack, phaseId: number): string | null {
  const list = PHASE_COVERS[track];
  void phaseId;
  return list[0] ?? null;
}

export function isStockCover(p: string): boolean {
  return Object.values(PHASE_COVERS).some((list) => list.includes(p));
}
