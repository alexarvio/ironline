/* One-off demo-data pass for the new multi-week training-program model —
   requested so there's a real, lived-in program to review (progressive
   weights, logged history, a deployed + draft pair) instead of the mostly
   empty test clients we've been poking at. Targets Nithit (client 3)
   specifically because their existing data is genuinely empty (one blank
   draft week, no exercises, no profile) — zero risk of clobbering anything
   real or anything the user has been testing themselves on the other
   clients (Jordan Blake / Sam Rivera already have their own draft programs
   in progress, left untouched).

   Run with: npx tsx scripts/seed-program-demo.ts
   The dev server must be stopped first — it keeps its own in-memory copy of
   the JSON store and would overwrite this script's writes on its next save.
*/
import { getData, persist, allocId } from "../app/lib/db";
import {
  addExerciseToDay,
  addClientGoal,
  addInvoice,
  addMeeting,
  createProgram,
  getWeek,
  listExercises,
  localDateStr,
  publishWeek,
  removeProgram,
  saveClientProfile,
  setDayLabel,
  setMeasurementValue,
  listMeasurementFields,
  weekStart,
} from "../app/lib/queries";

const CLIENT_ID = 3; // Nithit

const today = new Date();
function daysAgo(n: number) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}
function isoDaysAgo(n: number, hour = 17, minute = 0) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function findExerciseId(name: string): number {
  const ex = listExercises().find((e) => e.name === name);
  if (!ex) throw new Error(`Exercise not found: ${name}. Run scripts/seed.js first.`);
  return ex.id;
}

function logSetAt(assignmentId: number, setNumber: number, weightKg: number, reps: number, rpe: number, daysBack: number) {
  const data = getData();
  data.set_logs.push({
    id: allocId("set_logs"),
    workout_assignment_id: assignmentId,
    set_number: setNumber,
    weight_kg: weightKg,
    reps,
    rpe_actual: rpe,
    logged_at: isoDaysAgo(daysBack, 17, (setNumber * 7) % 60).replace("T", " ").slice(0, 19),
  });
  persist();
}

// ---- Wipe Nithit's pre-existing empty draft (week 1, zero exercises) so
// this script's own programs start clean at week 1 instead of leaving two
// draft programs behind (the model expects at most one). ----
removeProgram(3);

// ---- Profile / Start Page ----
saveClientProfile({
  client_id: CLIENT_ID,
  birthdate: "1996-04-18",
  height_cm: 175,
  starting_weight_kg: 78,
  coaching_start_date: daysAgo(28),
  current_week: "Week 4",
  goal_phase: "Strength — Foundations phase 1",
  goal_date: daysAgo(-56),
  check_in_day: "Monday",
  steps_goal: "8,000 steps/day",
  cardio_goal: "1x 20min LISS/week",
  training_goal: "4x/week upper-lower split",
  water_goal: "3L/day",
});
addClientGoal(CLIENT_ID, "short", "Hit all 4 planned sessions this week");
addClientGoal(CLIENT_ID, "long", "Add 15kg to leg press over the block");
addInvoice(CLIENT_ID, "Coaching — Month 1", 180, "paid");
addMeeting(CLIENT_ID, daysAgo(-4), "18:00", "Week 4 check-in call", 30);

const weightField = listMeasurementFields(CLIENT_ID).find((f) => f.name === "Weight")!;
const waistField = listMeasurementFields(CLIENT_ID).find((f) => f.name === "Waist")!;
[4, 3, 2, 1].forEach((weeksBack, i) => {
  const date = weekStart(daysAgo(weeksBack * 7));
  setMeasurementValue(weightField.id, date, 78 - i * 0.4);
  setMeasurementValue(waistField.id, date, 84 - i * 0.3);
});

// ---- Deployed program: 6 weeks, "live" for 3 weeks already (deployed_at
// backdated so the calendar-current week lands on week 4) ----
const deployed = createProgram(CLIENT_ID, "Foundations — Phase 1", 6, 1);

type ExPlan = { name: string; sets: number; reps: string; base: number; step: number; rpe: number; tempo?: string; notes?: string };
const lowerA: ExPlan[] = [
  { name: "Leg Press", sets: 4, reps: "8-10", base: 100, step: 5, rpe: 8, tempo: "2-0-2" },
  { name: "Leg Extension", sets: 3, reps: "12-15", base: 40, step: 2, rpe: 8 },
  { name: "Seated Leg Curl", sets: 3, reps: "12-15", base: 35, step: 2, rpe: 8 },
  { name: "Calf Press", sets: 4, reps: "12-15", base: 80, step: 5, rpe: 7 },
];
const upperPush: ExPlan[] = [
  { name: "Incline Chest Press Machine", sets: 4, reps: "8-10", base: 50, step: 2.5, rpe: 8 },
  { name: "Flat Chest Press Machine", sets: 3, reps: "10-12", base: 45, step: 2.5, rpe: 8 },
  { name: "Side Raise Machine", sets: 3, reps: "12-15", base: 10, step: 1, rpe: 8 },
  { name: "Bar Tricep Pushdown", sets: 3, reps: "12-15", base: 20, step: 1.5, rpe: 8, notes: "Full lockout, controlled negative" },
];
const upperPull: ExPlan[] = [
  { name: "Seated Cable Row", sets: 4, reps: "10-12", base: 55, step: 2.5, rpe: 8 },
  { name: "Lat Pulldown", sets: 3, reps: "10-12", base: 50, step: 2.5, rpe: 8 },
  { name: "Seated Alternating Dumbbell Curl", sets: 3, reps: "10-12", base: 12, step: 1, rpe: 8 },
  { name: "Incline Dumbbell Curl", sets: 3, reps: "10-12", base: 10, step: 1, rpe: 8 },
];
const lowerLight: ExPlan[] = [
  { name: "Leg Press", sets: 3, reps: "12-15", base: 80, step: 3, rpe: 6, notes: "Deload volume — go lighter" },
  { name: "Leg Extension", sets: 3, reps: "15", base: 32, step: 1.5, rpe: 6 },
  { name: "Calf Press", sets: 3, reps: "15", base: 70, step: 3, rpe: 6 },
];

const weightAt = (plan: ExPlan, weekIndex: number) => Math.round((plan.base + plan.step * (weekIndex - 1)) * 2) / 2;

for (let w = 1; w <= 6; w++) {
  const weekNumber = deployed.start_week + w - 1;
  const days = getWeek(CLIENT_ID, weekNumber);
  const byDow = (d: number) => days.find((p) => p.day_of_week === d)!;

  const mon = byDow(1);
  setDayLabel(mon.id, "Lower body");
  lowerA.forEach((p) => addExerciseToDay(mon.id, findExerciseId(p.name), p.sets, p.reps, weightAt(p, w), p.rpe, p.tempo ?? null, p.notes ?? null));

  const tue = byDow(2);
  setDayLabel(tue.id, "Upper — push");
  upperPush.forEach((p) => addExerciseToDay(tue.id, findExerciseId(p.name), p.sets, p.reps, weightAt(p, w), p.rpe, p.tempo ?? null, p.notes ?? null));

  setDayLabel(byDow(3).id, "Rest");

  const thu = byDow(4);
  setDayLabel(thu.id, "Upper — pull");
  upperPull.forEach((p) => addExerciseToDay(thu.id, findExerciseId(p.name), p.sets, p.reps, weightAt(p, w), p.rpe, p.tempo ?? null, p.notes ?? null));

  const fri = byDow(5);
  setDayLabel(fri.id, "Lower — light");
  lowerLight.forEach((p) => addExerciseToDay(fri.id, findExerciseId(p.name), p.sets, p.reps, weightAt(p, w), p.rpe, p.tempo ?? null, p.notes ?? null));

  setDayLabel(byDow(6).id, "Rest");
  setDayLabel(byDow(7).id, "Rest");

  publishWeek(CLIENT_ID, weekNumber);
}

// Backdate deployment so "now" lands on week 4 of 6 (see getProgramCurrentWeekIndex).
{
  const data = getData();
  const program = data.training_programs.find((p) => p.id === deployed.id)!;
  program.status = "deployed";
  program.deployed_at = isoDaysAgo(21, 9, 0);
  persist();
}

// ---- Log sets: weeks 1-3 fully done, week 4 (current) partially done ----
function logFullDay(dayNumber1to7: number, weekIndex: number, plans: ExPlan[], daysBackBase: number) {
  const weekNumber = deployed.start_week + weekIndex - 1;
  const day = getWeek(CLIENT_ID, weekNumber).find((d) => d.day_of_week === dayNumber1to7)!;
  const data = getData();
  const assignments = data.workout_assignments.filter((a) => a.program_day_id === day.id);
  assignments.forEach((a, ai) => {
    const plan = plans[ai];
    const target = weightAt(plan, weekIndex);
    for (let s = 1; s <= a.sets; s++) {
      const wiggle = s === a.sets ? -2.5 : 0; // last set a touch lighter, realistic
      logSetAt(a.id, s, Math.max(0, target + wiggle), Number(a.reps.split("-")[0]) + (s < a.sets ? 1 : 0), plan.rpe - (s === 1 ? 1 : 0), daysBackBase - (dayNumber1to7 - 1));
    }
  });
}

// Weeks 1-3: every training day fully logged. Days-back counted from the
// program's actual Monday-of-week-1 (21 days before "today").
[1, 2, 3].forEach((weekIndex) => {
  const weekStartDaysAgo = 21 - (weekIndex - 1) * 7; // week1 Mon = 21 days ago, week2 Mon = 14, week3 Mon = 7
  logFullDay(1, weekIndex, lowerA, weekStartDaysAgo);
  logFullDay(2, weekIndex, upperPush, weekStartDaysAgo);
  logFullDay(4, weekIndex, upperPull, weekStartDaysAgo);
  logFullDay(5, weekIndex, lowerLight, weekStartDaysAgo);
});
// Week 4 (current, Mon = 0 days ago i.e. today's week): only Monday done.
logFullDay(1, 4, lowerA, 0);

// ---- Draft program: the next block, still being built (only its first
// week's Monday/Tuesday are filled in — weeks 2-4 stay blank skeletons,
// same as a coach genuinely mid-build) ----
const draft = createProgram(CLIENT_ID, "Phase 2 — Progression", 4, deployed.start_week + 6);
const draftWeek1 = getWeek(CLIENT_ID, draft.start_week);
const dMon = draftWeek1.find((d) => d.day_of_week === 1)!;
setDayLabel(dMon.id, "Lower body");
lowerA.forEach((p) => addExerciseToDay(dMon.id, findExerciseId(p.name), p.sets, p.reps, weightAt(p, 7), p.rpe, p.tempo ?? null, p.notes ?? null));
const dTue = draftWeek1.find((d) => d.day_of_week === 2)!;
setDayLabel(dTue.id, "Upper — push");
upperPush.forEach((p) => addExerciseToDay(dTue.id, findExerciseId(p.name), p.sets, p.reps, weightAt(p, 7), p.rpe, p.tempo ?? null, p.notes ?? null));

console.log("Seeded demo program for Nithit (client_id=3):");
console.log(`  Deployed: "${deployed.name}" — 6 weeks, currently on week 4, weeks 1-3 fully logged.`);
console.log(`  Draft: "${draft.name}" — 4 weeks, week 1 partially built (Mon/Tue only).`);
console.log("Done.");
