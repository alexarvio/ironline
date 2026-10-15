// Quick names for a new variation of an exercise (15 Oct), a few per muscle
// group, offered as chips in the New variation pop-up. Names the exercise
// already has as variations are left out there.

const IDEAS: Record<string, string[]> = {
  shoulders: ["Seated", "Behind the back", "Cuffed", "Cross-body", "Single arm"],
  back: ["Close grip", "Wide grip", "Neutral grip", "Single arm", "Underhand"],
  chest: ["Incline", "Decline", "Single arm", "Paused"],
  legs: ["Paused", "Tempo", "Heels elevated", "Single leg"],
  arms: ["Single arm", "Cross-body", "Behind the back", "Neutral grip"],
  core: ["Weighted", "Kneeling", "Single side"],
  abs: ["Weighted", "Kneeling", "Single side"],
};
const ANY = ["Paused", "Tempo", "Single arm", "Wide grip", "Close grip"];

/** Up to five ideas for the group, minus names already taken (case-insensitive). */
export function variationIdeas(group: string | null | undefined, taken: string[]): string[] {
  const had = new Set(taken.map((t) => t.trim().toLowerCase()));
  const list = IDEAS[(group ?? "").toLowerCase()] ?? ANY;
  return list.filter((n) => !had.has(n.toLowerCase())).slice(0, 5);
}
