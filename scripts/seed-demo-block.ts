// Builds a realistic 8-week training block for one client, so the rebuilt
// admin Training tab has something worth looking at.
//
// The thin seed data showed every state as "good": one week, every set green,
// no missed sessions, no demo links. This produces the cases the design was
// drawn for —
//   - a week rail long enough to scroll, with a live week in the middle
//   - all three tick states: trained, planned-but-missed, and rest
//   - a previous-week row in the logged grid, so the W(n-1)/W(n) comparison
//     is visible rather than theoretical
//   - sets that came in UNDER target, so the amber verdict shows and it isn't
//     just a wall of green
//   - demo links and coach notes on a few exercises
//
// Run with the dev server STOPPED. The JSON store keeps everything in memory
// and rewrites the file whole, so a running server will overwrite this with
// its stale copy the next time anything is saved.
//
//   npx tsx scripts/seed-demo-block.ts

import { getData, persist, allocId } from "../app/lib/db";
import { localDateStr, weekStart } from "../app/lib/queries";

const CLIENT_ID = 1;
const TOTAL_WEEKS = 8;
const LIVE_WEEK = 5; // deployed four weeks ago, so week 5 is current

type Prescription = {
  exerciseId: number;
  sets: number;
  reps: string;
  weight: number;      // week 1 target; climbs each week by `step`
  step: number;
  rpe: number;
  tempo?: string;
  note?: string;
  noteKind?: "form" | "load" | "tempo";
  demo?: string;
};

// Four training days, three rest. Full weekday order is Mon=1 … Sun=7.
const SPLIT: { dayOfWeek: number; label: string; exercises: Prescription[] }[] = [
  {
    dayOfWeek: 1,
    label: "Lower body",
    exercises: [
      {
        exerciseId: 1, sets: 4, reps: "8-10", weight: 130, step: 5, rpe: 8, tempo: "2-0-2",
        note: "Push through the heels and keep the lower back flat against the pad.",
        noteKind: "form",
        demo: "https://www.youtube.com/watch?v=leg-press-setup",
      },
      { exerciseId: 2, sets: 3, reps: "12-15", weight: 45, step: 2.5, rpe: 8 },
      { exerciseId: 3, sets: 3, reps: "12-15", weight: 38, step: 2.5, rpe: 8 },
      { exerciseId: 11, sets: 4, reps: "12-15", weight: 85, step: 5, rpe: 9 },
    ],
  },
  {
    dayOfWeek: 2,
    label: "Upper — push",
    exercises: [
      {
        exerciseId: 4, sets: 4, reps: "8-10", weight: 52.5, step: 2.5, rpe: 8,
        demo: "https://www.youtube.com/watch?v=incline-press-form",
      },
      { exerciseId: 5, sets: 3, reps: "10-12", weight: 48, step: 2.5, rpe: 8 },
      { exerciseId: 8, sets: 3, reps: "12-15", weight: 11, step: 1, rpe: 9 },
      {
        exerciseId: 9, sets: 3, reps: "12-15", weight: 24, step: 1, rpe: 9,
        note: "Full lockout at the bottom, controlled on the way back up.",
        noteKind: "form",
      },
    ],
  },
  {
    dayOfWeek: 4,
    label: "Upper — pull",
    exercises: [
      {
        exerciseId: 6, sets: 4, reps: "10-12", weight: 57.5, step: 2.5, rpe: 8,
        demo: "https://www.youtube.com/watch?v=cable-row-setup",
      },
      { exerciseId: 7, sets: 3, reps: "10-12", weight: 52.5, step: 2.5, rpe: 8 },
      {
        exerciseId: 10, sets: 3, reps: "10-12", weight: 13, step: 1, rpe: 9,
        note: "Go up 1kg only once you're hitting 12 clean reps on all three sets.",
        noteKind: "load",
      },
      { exerciseId: 12, sets: 3, reps: "10-12", weight: 11, step: 1, rpe: 9 },
    ],
  },
  {
    dayOfWeek: 6,
    label: "Full body — light",
    exercises: [
      { exerciseId: 1, sets: 3, reps: "12-15", weight: 100, step: 5, rpe: 7 },
      { exerciseId: 5, sets: 3, reps: "12-15", weight: 40, step: 2.5, rpe: 7 },
      {
        exerciseId: 7, sets: 3, reps: "12-15", weight: 45, step: 2.5, rpe: 7,
        note: "Slow it down — three seconds on the way up.",
        noteKind: "tempo",
      },
    ],
  },
];

// Which training days the client actually did, per week. This is what makes
// the rail's ticks mean something: week 3 has a skipped Thursday, and the
// live week is only part-done because it hasn't finished yet.
const ATTENDANCE: Record<number, number[]> = {
  1: [1, 2, 4, 6],
  2: [1, 2, 4, 6],
  3: [1, 2, 6],       // missed Thursday
  4: [1, 2, 4, 6],
  5: [1, 2],          // live week, mid-way through
  // 6-8 are in the future: planned, nothing logged
};

// Sets that came in under the prescribed weight, so the amber verdict is
// visible. Keyed "week-day-exerciseIndex-setNumber".
const SHORTFALLS = new Set([
  "3-1-0-4", // last set of leg press in a week they were clearly tired
  "3-1-3-4",
  "4-4-0-4",
  "5-2-3-3",
  "2-2-1-3",
]);

function isoAt(mondayIso: string, dayOfWeek: number, hour: number, minute: number): string {
  const d = new Date(`${mondayIso}T00:00:00`);
  d.setDate(d.getDate() + (dayOfWeek - 1));
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const data = getData();

// ---- De-duplicate goals ----
// Re-running the older seed scripts appended the same goals each time, so the
// overview panel showed each one three times. Keep the first of each
// (term, text) pair.
const seenGoals = new Set<string>();
data.client_goals = data.client_goals.filter((g) => {
  if (g.client_id !== CLIENT_ID) return true;
  const key = `${g.term}|${g.text}`;
  if (seenGoals.has(key)) return false;
  seenGoals.add(key);
  return true;
});

// ---- Clear this client's existing programme so re-running is idempotent ----
const oldDays = data.program_days.filter((d) => d.client_id === CLIENT_ID);
const oldDayIds = new Set(oldDays.map((d) => d.id));
const oldAssignments = data.workout_assignments.filter((a) => oldDayIds.has(a.program_day_id));
const oldAssignmentIds = new Set(oldAssignments.map((a) => a.id));

data.set_logs = data.set_logs.filter((l) => !oldAssignmentIds.has(l.workout_assignment_id));
data.workout_assignments = data.workout_assignments.filter((a) => !oldDayIds.has(a.program_day_id));
data.program_days = data.program_days.filter((d) => d.client_id !== CLIENT_ID);
data.training_programs = data.training_programs.filter((p) => p.client_id !== CLIENT_ID);

// ---- The programme ----
// Deployed four Mondays ago, which is what makes week 5 the live one.
const thisMonday = weekStart(localDateStr());
const deployedMonday = new Date(`${thisMonday}T00:00:00`);
deployedMonday.setDate(deployedMonday.getDate() - (LIVE_WEEK - 1) * 7);
const deployedIso = localDateStr(deployedMonday);

const programId = allocId("training_programs");
data.training_programs.push({
  id: programId,
  client_id: CLIENT_ID,
  name: "Hypertrophy block 2",
  start_week: 1,
  total_weeks: TOTAL_WEEKS,
  status: "deployed",
  deployed_at: `${deployedIso}T09:00:00.000Z`,
  scheduled_at: null,
});

let assignmentCount = 0;
let logCount = 0;

for (let week = 1; week <= TOTAL_WEEKS; week++) {
  const weekMonday = new Date(`${deployedIso}T00:00:00`);
  weekMonday.setDate(weekMonday.getDate() + (week - 1) * 7);
  const weekMondayIso = localDateStr(weekMonday);
  const trainedDays = ATTENDANCE[week] ?? [];

  for (let dow = 1; dow <= 7; dow++) {
    const split = SPLIT.find((s) => s.dayOfWeek === dow);
    const dayId = allocId("program_days");

    data.program_days.push({
      id: dayId,
      client_id: CLIENT_ID,
      week_number: week,
      day_of_week: dow,
      label: split ? split.label : null,
      status: "published",
      is_rest: !split,
    });

    if (!split) continue;

    split.exercises.forEach((ex, exIndex) => {
      // Linear progression: the target climbs every week, which is what makes
      // last week's sets need judging against last week's target.
      const target = ex.weight + ex.step * (week - 1);
      const assignmentId = allocId("workout_assignments");
      const hasNote = !!ex.note && week === LIVE_WEEK; // note applies to the current week

      data.workout_assignments.push({
        id: assignmentId,
        program_day_id: dayId,
        exercise_id: ex.exerciseId,
        order_index: exIndex,
        sets: ex.sets,
        reps: ex.reps,
        target_weight_kg: target,
        rpe_target: ex.rpe,
        rest_seconds: null,
        tempo: ex.tempo ?? null,
        notes: hasNote ? ex.note! : null,
        demo_url: ex.demo ?? null,
        note_kind: hasNote ? ex.noteKind ?? null : null,
        note_at: hasNote ? isoAt(weekMondayIso, 1, 8, 30) : null,
        note_read: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      assignmentCount++;

      if (!trainedDays.includes(dow)) return;

      for (let setNumber = 1; setNumber <= ex.sets; setNumber++) {
        const short = SHORTFALLS.has(`${week}-${dow}-${exIndex}-${setNumber}`);
        // Reps drift down across a set, the way they actually do.
        const repFloor = Number(ex.reps.split("-")[0]);
        const reps = Math.max(repFloor - (setNumber > 2 ? 1 : 0), repFloor - 2);

        data.set_logs.push({
          id: allocId("set_logs"),
          workout_assignment_id: assignmentId,
          set_number: setNumber,
          weight_kg: short ? target - ex.step : target,
          reps,
          rpe_actual: short ? ex.rpe + 1 : ex.rpe,
          logged_at: isoAt(weekMondayIso, dow, 18, 10 + setNumber * 3),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        logCount++;
      }
    });
  }
}

// ---- Nutrition: day targets, water, a few supplements ----
const plan = data.nutrition_plans.find((n) => n.client_id === CLIENT_ID);
if (plan) {
  plan.day_targets = {
    training: { protein: 185, carbs: 315, fats: 81 },
    rest: { protein: 185, carbs: 190, fats: 75 },
  };
  plan.water_l = 3.5;
  plan.supplement_rows = [
    { id: allocId("supplement_rows"), name: "Creatine", quantity: "5g", timing: "Daily, any time", notes: "" },
    { id: allocId("supplement_rows"), name: "Omega-3", quantity: "2 caps", timing: "With dinner", notes: "" },
    { id: allocId("supplement_rows"), name: "Vitamin D", quantity: "2000 IU", timing: "With breakfast", notes: "Winter only" },
    { id: allocId("supplement_rows"), name: "Magnesium", quantity: "400mg", timing: "Before bed", notes: "" },
  ];
}

// ---- Monthly measurements, so that table isn't empty ----
const MONTHLY = [
  { name: "Waist", unit: "cm", start: 88, step: -1.2 },
  { name: "Hips", unit: "cm", start: 102, step: -0.6 },
  { name: "Chest", unit: "cm", start: 104, step: 0.5 },
  { name: "Arm", unit: "cm", start: 37.5, step: 0.3 },
];
MONTHLY.forEach((m, i) => {
  let def = data.metric_definitions.find(
    (d) => d.client_id === CLIENT_ID && d.frequency === "monthly" && d.name === m.name
  );
  if (!def) {
    def = {
      id: allocId("metric_definitions"),
      client_id: CLIENT_ID,
      category: "measurements",
      name: m.name,
      unit: m.unit,
      frequency: "monthly",
      order_index: i,
      visible_to_client: true,
    };
    data.metric_definitions.push(def);
  }
  // Six monthly readings, first of the month going back.
  for (let back = 5; back >= 0; back--) {
    const d = new Date();
    d.setMonth(d.getMonth() - back, 1);
    const period = localDateStr(d);
    const value = Number((m.start + m.step * (5 - back)).toFixed(1));
    const already = data.metric_entries.find(
      (e) => e.metric_definition_id === def!.id && e.period === period
    );
    if (already) already.value = value;
    else data.metric_entries.push({ id: allocId("metric_entries"), metric_definition_id: def!.id, period, value });
  }
});

persist();

console.log(`Seeded "Hypertrophy block 2" for client ${CLIENT_ID}:`);
console.log(`  ${TOTAL_WEEKS} weeks, live week ${LIVE_WEEK} (deployed ${deployedIso})`);
console.log(`  ${assignmentCount} prescriptions, ${logCount} logged sets`);
console.log(`  week 3 has a missed Thursday; week ${LIVE_WEEK} is part-way through`);
console.log(`  ${SHORTFALLS.size} sets came in under target, so the amber verdict shows`);
console.log("");
console.log("Restart the dev server to pick this up.");
