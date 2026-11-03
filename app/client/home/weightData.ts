// Home's Weight (3 Nov, Alex: option 3 of docs/boards/home-hierarchy-mockup.html, "the weight displayed always"): what the
// server hands the row, plain data. Every weight in the unit the client is asked in. The windows as the coach's Weight
// card reads them (homeBoardData.ts weightOf; 3 Nov, Alex: "same logic as in the admin panel"): Goal while one runs, the
// last 7 and 30 days by the calendar, and the live phase from its first day.

export type HomeWeightWindow = "goal" | "7d" | "30d" | "phase";

export type HomeWeight = {
  unit: string;
  /** The latest weigh-in. */
  now: number;
  /** Every reading from the earliest window's first day on, oldest first. */
  points: { date: string; value: number }[];
  /** The 7d, 30d and phase windows: from which day, and the change over it (null with under two readings in it). */
  windows: Record<"7d" | "30d", { from: string; change: number | null }> & { phase: { from: string; change: number | null } | null };
  /** The goal being worked on: its straight line from where they were to the goal, and the verdict. */
  goal: {
    start: number;
    startDate: string;
    target: number;
    byDate: string;
    toGo: number | null;
    verdictWord: string | null;
    tone: "good" | "warn" | "";
  } | null;
};
