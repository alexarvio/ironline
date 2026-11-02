// The muscles the muscle map draws and counts (2 Nov), with their names and groups: shared by the server (muscleMap.ts)
// and the screen, so it carries no server code.

export const MUSCLES = [
  { key: "chest_upper", name: "Upper chest", group: "chest" },
  { key: "chest_mid", name: "Mid chest", group: "chest" },
  { key: "chest_lower", name: "Lower chest", group: "chest" },
  { key: "delt_front", name: "Front delts", group: "shoulders" },
  { key: "delt_side", name: "Side delts", group: "shoulders" },
  { key: "delt_rear", name: "Rear delts", group: "shoulders" },
  { key: "traps_upper", name: "Upper traps", group: "back" },
  { key: "mid_back", name: "Mid back", group: "back" },
  { key: "lats", name: "Lats", group: "back" },
  { key: "lower_back", name: "Lower back", group: "back" },
  { key: "biceps", name: "Biceps", group: "arms" },
  { key: "triceps", name: "Triceps", group: "arms" },
  { key: "forearms", name: "Forearms", group: "arms" },
  { key: "abs_upper", name: "Upper abs", group: "core" },
  { key: "abs_lower", name: "Lower abs", group: "core" },
  { key: "obliques", name: "Obliques", group: "core" },
  { key: "glutes", name: "Glutes", group: "legs" },
  { key: "glute_med", name: "Glute medius", group: "legs" },
  { key: "quads", name: "Quads", group: "legs" },
  { key: "hamstrings", name: "Hamstrings", group: "legs" },
  { key: "adductors", name: "Adductors", group: "legs" },
  { key: "calves", name: "Calves", group: "legs" },
] as const;
export type MuscleKey = (typeof MUSCLES)[number]["key"];
export type MuscleGroup = (typeof MUSCLES)[number]["group"];

/** One muscle in one window: its sets, and the exercises behind them, most first. */
export type MuscleLoad = { sets: number; exercises: { name: string; sets: number }[] };
export type MuscleMapData = {
  phase: Record<string, MuscleLoad>;
  split: Record<string, MuscleLoad>;
  /** The training phase the Phase window counts from; null with none. */
  phaseName: string | null;
  /** The week the Split window reads (1-based), with its programme; null with none. */
  week: number | null;
  body: "male" | "female";
};
