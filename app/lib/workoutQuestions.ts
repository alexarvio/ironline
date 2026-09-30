import type { WorkoutQuestion } from "./db";

// The workout questionnaire (30 Sep): what a client is asked, 1 to 10 each,
// before ending a workout. The coach picks them per client on Measurements;
// a client nobody has set up is asked the first two, as before it existed.
// A preset keeps its id through a rename, so its answers stay one series;
// Enjoyment and Adherence also fill the lifestyle metrics of those names
// (metricFromWorkout).

export const WORKOUT_QUESTION_PRESETS: WorkoutQuestion[] = [
  { id: "enjoyment", label: "Enjoyment" },
  { id: "adherence", label: "Adherence" },
  { id: "energy", label: "Energy" },
  { id: "difficulty", label: "Difficulty" },
  { id: "focus", label: "Focus" },
  { id: "pump", label: "Pump" },
  { id: "soreness", label: "Soreness" },
];

export const DEFAULT_WORKOUT_QUESTIONS: WorkoutQuestion[] = WORKOUT_QUESTION_PRESETS.slice(0, 2);

/** More than this and the end of a workout turns into a form. */
export const MAX_WORKOUT_QUESTIONS = 6;
export const MAX_QUESTION_LENGTH = 40;
