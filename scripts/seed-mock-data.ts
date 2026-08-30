/* One-off local-dev mock data pass, requested to give every panel something
   real to look at. Unlike scripts/seed-rich.ts (which assumes a totally
   fresh database), this dev DB already had hand-built data on client 1
   "Alex" — a manually-labeled "Push Day" Monday, a real invoice, an uploaded
   photo, ad-hoc test metrics — so this script is deliberately additive-only
   for Alex (nutrition/measurements/trackers/goals/meetings/chat/invoices/
   the two missing photo slots) and never touches their existing training
   days, workout assignments, or the "Front" photo slot. Jordan Blake and Sam
   Rivera are brand-new clients, seeded exactly like scripts/seed-rich.ts's
   seedLightClient().

   Run with: npx tsx scripts/seed-mock-data.ts
   The dev server must be stopped first — it keeps its own in-memory copy of
   the JSON store and would overwrite this script's writes on its next save.
*/
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { getData, persist, allocId, DATA_DIR } from "../app/lib/db";
import {
  createClient,
  ensureWeekSkeleton,
  addExerciseToDay,
  publishWeek,
  listExercises,
  saveNutritionPlan,
  getNutritionPlan,
  listMeasurementFields,
  setMeasurementValue,
  addMetricDefinition,
  setMetricEntry,
  addPhotoSlot,
  setPhotoCadence,
  saveClientProfile,
  addClientGoal,
  setClientGoalDone,
  addMeeting,
  addMeetingNote,
  addInvoice,
  listTrainingColumns,
  weekStart,
  localDateStr,
  slugify,
} from "../app/lib/queries";

const today = new Date();
function daysAgo(n: number) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}
function isoDaysAgo(n: number, hour = 9, minute = 0) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function logSetAt(
  assignmentId: number,
  setNumber: number,
  weightKg: number | null,
  reps: number | null,
  rpeActual: number | null,
  daysBack: number
) {
  const data = getData();
  data.set_logs.push({
    id: allocId("set_logs"),
    workout_assignment_id: assignmentId,
    set_number: setNumber,
    weight_kg: weightKg,
    reps,
    rpe_actual: rpeActual,
    logged_at: isoDaysAgo(daysBack, 17, (setNumber * 7) % 60).replace("T", " ").slice(0, 19),
  });
  persist();
}

function findExerciseId(name: string): number {
  const ex = listExercises().find((e) => e.name === name);
  if (!ex) throw new Error(`Exercise not found: ${name}. Run scripts/seed.js first.`);
  return ex.id;
}

function makeSolidJpeg(r: number, g: number, b: number): Buffer {
  try {
    const tmp = path.join("/tmp", `swatch-${r}-${g}-${b}.jpg`);
    const py = `from PIL import Image; Image.new('RGB',(600,800),(${r},${g},${b})).save('${tmp}','JPEG')`;
    execFileSync("python3", ["-c", py], { stdio: "ignore" });
    const buf = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    return buf;
  } catch {
    return Buffer.from(
      "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
      "base64"
    );
  }
}

// ---------------------------------------------------------------------
// Alex (client 1): additive-only. Skips anything that already exists or
// would touch the training program the user built by hand.
// ---------------------------------------------------------------------
function enrichAlex() {
  const clientId = 1;

  saveClientProfile({
    client_id: clientId,
    birthdate: "1994-03-12",
    height_cm: 181,
    starting_weight_kg: 88.4,
    coaching_start_date: daysAgo(96),
    current_week: "Week 14",
    goal_phase: "Lean bulk — phase 2",
    goal_phase_start_date: null,
    goal_date: daysAgo(-70),
    check_in_day: "Monday",
    steps_goal: "9,000 steps/day",
    cardio_goal: "2x 20min LISS/week",
    training_goal: "4x/week upper-lower split",
    water_goal: "3.5L/day",
  });

  addClientGoal(clientId, "short", "Hit 3/4 planned sessions this week");
  addClientGoal(clientId, "short", "Log weight + waist every Monday");
  addClientGoal(clientId, "short", "Hit protein target 6/7 days");
  setClientGoalDone(1, true); // first short goal — client_goals table was empty, so this is id 1
  addClientGoal(clientId, "long", "Reach 92kg bodyweight while keeping waist under 84cm");
  addClientGoal(clientId, "long", "Bench press 100kg x 5 clean reps");

  // ---- Nutrition (table was empty) ----
  const plan = getNutritionPlan(clientId);
  plan.maintenance_kcal = 2850;
  plan.ebf = 16;
  plan.training_day_meals = [
    { protein: 45, fats: 15, carbs: 60 },
    { protein: 35, fats: 10, carbs: 45 },
    { protein: 50, fats: 20, carbs: 80 },
    { protein: 30, fats: 10, carbs: 40 },
    { protein: 55, fats: 18, carbs: 70 },
    { protein: 20, fats: 8, carbs: 20 },
  ];
  plan.rest_day_meals = [
    { protein: 40, fats: 18, carbs: 40 },
    { protein: 30, fats: 12, carbs: 25 },
    { protein: 50, fats: 22, carbs: 55 },
    { protein: 25, fats: 10, carbs: 20 },
    { protein: 50, fats: 20, carbs: 45 },
    { protein: 15, fats: 8, carbs: 15 },
  ];
  plan.supplements[slugify("Creatine")] = { quantity: "5g", timing: "daily, any time" };
  plan.supplements[slugify("Omega-3")] = { quantity: "2 caps", timing: "with dinner" };
  plan.vitamins[slugify("Magnesium")] = { quantity: "400mg", timing: "before bed" };
  plan.vitamins[slugify("Zinc")] = { quantity: "25mg", timing: "with dinner" };
  plan.vitamins[slugify("Vitamin D")] = { quantity: "2000 IU", timing: "with breakfast" };
  plan.other[slugify("Fluid intake")] = { amount: "3.5L", timing: "throughout the day" };
  plan.other[slugify("Vegetables")] = { amount: "3+ servings", timing: "lunch & dinner" };
  plan.coach_notes =
    "Great adherence the last two weeks — keep protein high on training days and don't skip the pre-workout snack, it's been helping your energy in the evening sessions.";
  saveNutritionPlan(plan);

  // ---- Measurements: 6 Mondays of history, none colliding with the real
  // dates already in the table (2026-08-26, 2026-08-25, 2026-08-18) since
  // these are all computed as weekStart() of weeks further back. ----
  const fields = listMeasurementFields(clientId);
  const weightField = fields.find((f) => f.name === "Weight")!;
  const waistField = fields.find((f) => f.name === "Waist")!;
  const weekly = [
    { back: 42, w: 89.6, waist: 86.5 },
    { back: 35, w: 89.9, waist: 86.2 },
    { back: 28, w: 90.3, waist: 85.9 },
    { back: 21, w: 90.6, waist: 85.4 },
    { back: 14, w: 90.9, waist: 85.1 },
    { back: 7, w: 91.2, waist: 84.7 },
  ];
  weekly.forEach(({ back, w, waist }) => {
    const date = weekStart(daysAgo(back));
    setMeasurementValue(weightField.id, date, w);
    setMeasurementValue(waistField.id, date, waist);
  });

  // ---- Daily / weekly trackers: new categories, don't collide with the
  // existing ad-hoc test metrics (Sleep/"fatclipboard", macros/"sss", ...) ----
  addMetricDefinition(clientId, "Recovery", "Sleep", "hrs", "daily");
  addMetricDefinition(clientId, "Recovery", "Energy", "/5", "daily");
  addMetricDefinition(clientId, "Lifestyle", "Steps", "steps", "daily");
  const dailyDefs = getData().metric_definitions.filter(
    (m) => m.client_id === clientId && m.frequency === "daily" && ["Sleep", "Energy", "Steps"].includes(m.name)
  );
  const sleepDef = dailyDefs.find((d) => d.name === "Sleep")!;
  const energyDef = dailyDefs.find((d) => d.name === "Energy")!;
  const stepsDef = dailyDefs.find((d) => d.name === "Steps")!;
  for (let i = 1; i <= 9; i++) {
    const date = daysAgo(i);
    setMetricEntry(sleepDef.id, date, 6.5 + (i % 3) * 0.5);
    setMetricEntry(energyDef.id, date, 3 + (i % 3));
    setMetricEntry(stepsDef.id, date, 7500 + (i % 4) * 900);
  }

  addMetricDefinition(clientId, "Wellbeing", "Stress", "/5", "weekly");
  addMetricDefinition(clientId, "Wellbeing", "Soreness", "/5", "weekly");
  const weeklyDefs = getData().metric_definitions.filter(
    (m) => m.client_id === clientId && m.frequency === "weekly" && ["Stress", "Soreness"].includes(m.name)
  );
  const stressDef = weeklyDefs.find((d) => d.name === "Stress")!;
  const sorenessDef = weeklyDefs.find((d) => d.name === "Soreness")!;
  [1, 2, 3].forEach((weeksBack) => {
    const date = weekStart(daysAgo(weeksBack * 7));
    setMetricEntry(stressDef.id, date, 2 + (weeksBack % 2));
    setMetricEntry(sorenessDef.id, date, 2);
  });

  // ---- Photos: keep the existing "Front" slot (id 1, already has a real
  // uploaded photo) — only add the two missing slots, then backfill history
  // on all three at weeks that don't collide with the real 2026-08-23 upload. ----
  setPhotoCadence(clientId, "weekly");
  addPhotoSlot(clientId, "Side");
  addPhotoSlot(clientId, "Back");
  const slots = getData().photo_slots.filter((s) => s.client_id === clientId);
  const periodsBack = [3, 2, 1]; // weeks ago; skip "this week" so it's due
  const swatches = [
    [200, 120, 90],
    [190, 130, 100],
    [180, 140, 110],
  ];
  periodsBack.forEach((weeksBack, i) => {
    const period = weekStart(daysAgo(weeksBack * 7));
    slots.forEach((slot) => {
      const dir = path.join(DATA_DIR, "uploads", "progress", String(clientId), String(slot.id));
      fs.mkdirSync(dir, { recursive: true });
      const filename = `${period}.jpg`;
      const buf = makeSolidJpeg(swatches[i][0], swatches[i][1], swatches[i][2]);
      fs.writeFileSync(path.join(dir, filename), buf);
      const publicPath = `/uploads/progress/${clientId}/${slot.id}/${filename}`;
      const data = getData();
      data.photo_uploads.push({
        id: allocId("photo_uploads"),
        slot_id: slot.id,
        period,
        file_path: publicPath,
        uploaded_at: isoDaysAgo(weeksBack * 7),
      });
      persist();
    });
  });
  const data = getData();
  data.photo_period_notes.push({
    client_id: clientId,
    period: weekStart(daysAgo(7)),
    shape: "Leaner through the waist, shoulders looking fuller.",
    strengths: "Great posture in the front shot, arms are coming in well.",
    improvements: "Let's get a bit more light on the side shot next time.",
    next_steps: "Keep the same angle and lighting setup for the next 2 check-ins so we can compare directly.",
  });
  persist();

  // ---- Meetings (dates don't collide with the existing 2026-08-30 one) ----
  addMeeting(clientId, daysAgo(-3), "17:00", "Monthly check-in call", 30);
  addMeeting(clientId, daysAgo(7), "17:00", "Week 13 check-in", 30);
  const meetings = getData().meetings.filter((m) => m.client_id === clientId);
  const pastMeeting = meetings.find((m) => m.date === daysAgo(7));
  if (pastMeeting) {
    pastMeeting.status = "completed";
    persist();
    addMeetingNote(pastMeeting.id, "Reviewed week 13 — sets logged 11/16, weight trending up nicely.");
    addMeetingNote(pastMeeting.id, "Agreed to add a pre-workout snack to help evening session energy.");
  }

  // ---- Chat (table was empty) ----
  const chatSeed: Array<[number, "client" | "coach", string]> = [
    [3, "client", "Hey! Quick one — is the leg press meant to be 4 sets or 3 this week?"],
    [3, "coach", "4 sets on Monday, 3 on Friday (that one's the lighter deload day) 👍"],
    [2, "client", "Got it, thanks! Also felt great today, hit all my targets."],
    [2, "coach", "Love to hear it — logged, looks strong. Keep that up."],
    [1, "client", "Question about the pre-workout snack — is timing important or just get it in?"],
    [1, "coach", "Roughly 45-60min before training is ideal, but don't stress if it's a bit off — consistency matters more than precision here."],
  ];
  chatSeed.forEach(([daysBack, sender, text], i) => {
    const d = getData();
    d.chat_messages.push({
      id: allocId("chat_messages"),
      client_id: clientId,
      sender,
      text,
      media_path: null,
      media_type: null,
      created_at: isoDaysAgo(daysBack, 8 + i, (i * 17) % 60),
    });
    persist();
  });

  // ---- Invoices (additive alongside the existing real "October" one) ----
  addInvoice(clientId, "Coaching — Month 3", 220, "paid");
  addInvoice(clientId, "Coaching — Month 4", 220, "sent");

  listTrainingColumns(clientId);

  console.log("Enriched Alex (client_id=1) — left existing training days, invoice, and Front photo slot untouched.");
}

// ---------------------------------------------------------------------
// Two brand-new light demo clients — identical to seed-rich.ts's
// seedLightClient(), no collision risk since they get fresh ids.
// ---------------------------------------------------------------------
function seedLightClient(name: string, opts: { weight: number; goalPhase: string; invoiceStatus: "unpaid" | "paid"; meetingTime: string }) {
  const client = createClient(name);
  const clientId = client.id;

  saveClientProfile({
    client_id: clientId,
    birthdate: "1991-07-02",
    height_cm: 170,
    starting_weight_kg: opts.weight,
    coaching_start_date: daysAgo(30),
    current_week: "Week 4",
    goal_phase: opts.goalPhase,
    goal_phase_start_date: null,
    goal_date: daysAgo(-84),
    check_in_day: "Monday",
    steps_goal: "8,000 steps/day",
    cardio_goal: "1x 30min/week",
    training_goal: "3x/week full body",
    water_goal: "2.5L/day",
  });

  addClientGoal(clientId, "short", "Log all check-ins this week");
  addClientGoal(clientId, "long", opts.goalPhase);

  ensureWeekSkeleton(clientId, 1);
  const week = getData().program_days.filter((d) => d.client_id === clientId && d.week_number === 1);
  const mon = week.find((d) => d.day_of_week === 1)!;
  mon.label = "Full body";
  persist();
  addExerciseToDay(mon.id, findExerciseId("Leg Press"), 3, "10-12", 90, 7, null, null);
  addExerciseToDay(mon.id, findExerciseId("Flat Chest Press Machine"), 3, "10-12", 35, 7, null, null);
  addExerciseToDay(mon.id, findExerciseId("Seated Cable Row"), 3, "10-12", 40, 7, null, null);
  publishWeek(clientId, 1);

  const monAssignments = getData().workout_assignments.filter((a) => a.program_day_id === mon.id);
  monAssignments.forEach((a) => {
    for (let s = 1; s <= a.sets; s++) logSetAt(a.id, s, a.target_weight_kg, 10, 7, 4);
  });

  const fields = listMeasurementFields(clientId);
  const weightField = fields.find((f) => f.name === "Weight")!;
  setMeasurementValue(weightField.id, weekStart(daysAgo(7)), opts.weight);
  setMeasurementValue(weightField.id, weekStart(daysAgo(0)), opts.weight - 0.4);

  addMeeting(clientId, daysAgo(-5), opts.meetingTime, "Week 4 check-in call", 30);
  addInvoice(clientId, "Coaching — Month 1", 180, opts.invoiceStatus);

  const d = getData();
  d.chat_messages.push({
    id: allocId("chat_messages"),
    client_id: clientId,
    sender: "client",
    text: "Hey, all set for this week's plan — thanks!",
    media_path: null,
    media_type: null,
    created_at: isoDaysAgo(1, 9, 15),
  });
  persist();

  console.log(`Seeded light demo data for ${name} (client_id=${clientId}).`);
}

enrichAlex();
seedLightClient("Jordan Blake", { weight: 71.2, goalPhase: "Fat loss — 8kg to go", invoiceStatus: "unpaid", meetingTime: "10:00" });
seedLightClient("Sam Rivera", { weight: 64.8, goalPhase: "Strength & tone", invoiceStatus: "paid", meetingTime: "14:30" });

console.log("Done.");
