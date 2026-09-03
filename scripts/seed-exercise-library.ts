// Fills out the shared exercise library across the six picker groups (Back,
// Chest, Legs, Arms, Abs, Cardio). Idempotent: an exercise is added only if
// no exercise with the same name (case-insensitive) exists, so re-running is
// safe and a coach's own additions and renames are never touched.
//
//   npx tsx scripts/seed-exercise-library.ts
//
// Run at boot by scripts/start-server.mjs behind a marker file.
import { allocId, getData, persist } from "../app/lib/db";

const LIBRARY: Record<string, string[]> = {
  back: [
    "Lat Pulldown",
    "Seated Cable Row",
    "Barbell Row",
    "Dumbbell Row",
    "Chest-Supported Row",
    "Pull-Up",
    "Chin-Up",
    "Assisted Pull-Up",
    "Straight-Arm Pulldown",
    "T-Bar Row",
    "Deadlift",
    "Romanian Deadlift",
    "Face Pull",
    "Back Extension",
    "Rear Delt Fly",
  ],
  chest: [
    "Barbell Bench Press",
    "Incline Barbell Bench Press",
    "Dumbbell Bench Press",
    "Incline Dumbbell Press",
    "Flat Chest Press Machine",
    "Incline Chest Press Machine",
    "Push-Up",
    "Cable Fly",
    "Pec Deck",
    "Dumbbell Fly",
    "Dips",
    "Decline Bench Press",
  ],
  legs: [
    "Back Squat",
    "Front Squat",
    "Goblet Squat",
    "Leg Press",
    "Hack Squat",
    "Bulgarian Split Squat",
    "Walking Lunge",
    "Leg Extension",
    "Seated Leg Curl",
    "Lying Leg Curl",
    "Hip Thrust",
    "Glute Bridge",
    "Step-Up",
    "Calf Press",
    "Standing Calf Raise",
    "Seated Calf Raise",
    "Hip Adduction Machine",
    "Hip Abduction Machine",
  ],
  arms: [
    "Barbell Curl",
    "Incline Dumbbell Curl",
    "Seated Alternating Dumbbell Curl",
    "Hammer Curl",
    "Preacher Curl",
    "Cable Curl",
    "Bar Tricep Pushdown",
    "Rope Tricep Pushdown",
    "Overhead Tricep Extension",
    "Skull Crusher",
    "Close-Grip Bench Press",
    "Overhead Press",
    "Seated Dumbbell Shoulder Press",
    "Side Raise Machine",
    "Dumbbell Lateral Raise",
    "Cable Lateral Raise",
    "Front Raise",
    "Wrist Curl",
  ],
  abs: [
    "Plank",
    "Side Plank",
    "Hanging Leg Raise",
    "Hanging Knee Raise",
    "Cable Crunch",
    "Ab Wheel Rollout",
    "Dead Bug",
    "Bicycle Crunch",
    "Russian Twist",
    "Mountain Climber",
    "Decline Sit-Up",
    "Pallof Press",
  ],
  cardio: [
    "Treadmill Walk (incline)",
    "Treadmill Run",
    "Stationary Bike",
    "Assault Bike",
    "Rowing Machine",
    "Stair Climber",
    "Elliptical",
    "Jump Rope",
    "Outdoor Run",
    "Outdoor Walk",
    "Swimming",
    "Sled Push",
  ],
};

const data = getData();
const existing = new Set(data.exercises.map((e) => e.name.trim().toLowerCase()));
let added = 0;

for (const [group, names] of Object.entries(LIBRARY)) {
  for (const name of names) {
    if (existing.has(name.toLowerCase())) continue;
    data.exercises.push({ id: allocId("exercises"), name, muscle_tags: group, video_url: null });
    existing.add(name.toLowerCase());
    added += 1;
  }
}

if (added > 0) persist();
console.log(`[seed-exercise-library] added ${added} exercise(s); library now has ${data.exercises.length}.`);
