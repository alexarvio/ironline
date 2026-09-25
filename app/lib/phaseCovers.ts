import type { PhaseTrack } from "./db";

// The stock pictures for a phase card, per track: what the coach picks from
// in the phase dialog, and the default for a phase without a cover (picked
// by its id, so a phase keeps the same one). Files live in public/; add one
// here and it is offered and used. A track with none shows its deep colour.
export const PHASE_COVERS: Record<PhaseTrack, string[]> = {
  nutrition: ["/img/nutrition-head.jpg"],
  training: ["/img/session-head.jpg"],
  lifestyle: ["/img/lifestyle-head.jpg"],
};

export const PHASE_OBJECTIVES_MAX = 3;
export const PHASE_OBJECTIVE_CHARS = 80;

export function defaultPhaseCover(track: PhaseTrack, phaseId: number): string | null {
  const list = PHASE_COVERS[track];
  return list.length ? list[Math.abs(phaseId) % list.length] : null;
}

export function isStockCover(p: string): boolean {
  return Object.values(PHASE_COVERS).some((list) => list.includes(p));
}
