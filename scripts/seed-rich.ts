/* Rich demo-data seed — layers realistic content on top of the base seed
   (client + exercise library) so every screen in both /admin and /client
   has something real to look at instead of empty states. Idempotent-ish:
   safe to re-run after a fresh `node scripts/seed.js`, but assumes that
   base seed already ran (client id=1 "Alex" + the 12 exercises exist).

   Run with: npx tsx scripts/seed-rich.ts
*/
import fs from "fs";
import path from "path";
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
import { createUser, findUserByEmail } from "../app/lib/auth";

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

// Direct set_logs write with a backdated timestamp (logSet() from queries.ts
// always stamps "now", which would pile every historical set onto a single
// calendar day and flatten the admin strength-volume graph to one point).
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

// ---------------------------------------------------------------------
// Client 1: Alex — the fully-populated demo client (this is also the
// hardcoded CLIENT_ID in app/client/page.tsx, so everything here shows up
// in the client app too).
// ---------------------------------------------------------------------
function seedAlex() {
  const clientId = 1;

  // ---- Profile / Start Page ----
  saveClientProfile({
    client_id: clientId,
    birthdate: "1994-03-12",
    height_cm: 181,
    starting_weight_kg: 88.4,
    coaching_start_date: daysAgo(96),
    current_week: "Week 14",
    goal_phase: "Lean bulk, phase 2",
    goal_phase_start_date: null,
    goal_date: daysAgo(-70), // ~10 weeks from now
    check_in_day: "Monday",
    steps_goal: "9,000 steps/day",
    cardio_goal: "2x 20min LISS/week",
    training_goal: "4x/week upper-lower split",
    water_goal: "3.5L/day",
  });

  // ---- Goals ----
  addClientGoal(clientId, "short", "Hit 3/4 planned sessions this week");
  addClientGoal(clientId, "short", "Log weight + waist every Monday");
  addClientGoal(clientId, "short", "Hit protein target 6/7 days");
  setClientGoalDone(1, true); // first short goal done (id assumes clean seed order)
  addClientGoal(clientId, "long", "Reach 92kg bodyweight while keeping waist under 84cm");
  addClientGoal(clientId, "long", "Bench press 100kg x 5 clean reps");

  // ---- Training: publish week 1 with a 4-day upper/lower split ----
  ensureWeekSkeleton(clientId, 1);
  const week = getData().program_days.filter((d) => d.client_id === clientId && d.week_number === 1);
  const byDow = (d: number) => week.find((p) => p.day_of_week === d)!;

  const legPress = findExerciseId("Leg Press");
  const legExt = findExerciseId("Leg Extension");
  const legCurl = findExerciseId("Seated Leg Curl");
  const calfPress = findExerciseId("Calf Press");
  const inclinePress = findExerciseId("Incline Chest Press Machine");
  const flatPress = findExerciseId("Flat Chest Press Machine");
  const row = findExerciseId("Seated Cable Row");
  const pulldown = findExerciseId("Lat Pulldown");
  const sideRaise = findExerciseId("Side Raise Machine");
  const tricepPushdown = findExerciseId("Bar Tricep Pushdown");
  const dbCurl = findExerciseId("Seated Alternating Dumbbell Curl");
  const inclineCurl = findExerciseId("Incline Dumbbell Curl");

  // Mon: Lower
  const mon = byDow(1);
  mon.label = "Lower body";
  addExerciseToDay(mon.id, legPress, 4, "10-12", 140, 8, "2-0-2", null);
  addExerciseToDay(mon.id, legExt, 3, "12-15", 45, 8, null, null);
  addExerciseToDay(mon.id, legCurl, 3, "12-15", 38, 8, null, null);
  addExerciseToDay(mon.id, calfPress, 4, "12-15", 90, null, null, null);

  // Tue: Upper push
  const tue = byDow(2);
  tue.label = "Upper (push)";
  addExerciseToDay(tue.id, inclinePress, 4, "8-10", 55, 8, null, null);
  addExerciseToDay(tue.id, flatPress, 3, "10-12", 50, 8, null, null);
  addExerciseToDay(tue.id, sideRaise, 3, "12-15", 12, null, null, null);
  addExerciseToDay(tue.id, tricepPushdown, 3, "12-15", 25, null, null, "Full lockout, controlled negative");

  // Wed: rest — leave with no exercises
  const wed = byDow(3);
  wed.label = "Rest";

  // Thu: Upper pull
  const thu = byDow(4);
  thu.label = "Upper (pull)";
  addExerciseToDay(thu.id, row, 4, "10-12", 60, 8, null, null);
  addExerciseToDay(thu.id, pulldown, 3, "10-12", 55, 8, null, null);
  addExerciseToDay(thu.id, dbCurl, 3, "10-12", 14, null, null, null);
  addExerciseToDay(thu.id, inclineCurl, 3, "10-12", 12, null, null, null);

  // Fri: Lower (lighter)
  const fri = byDow(5);
  fri.label = "Lower (light)";
  addExerciseToDay(fri.id, legPress, 3, "12-15", 110, 6, null, "Deload volume, go lighter");
  addExerciseToDay(fri.id, legExt, 3, "15", 35, 6, null, null);
  addExerciseToDay(fri.id, calfPress, 3, "15", 80, null, null, null);

  // Sat/Sun: rest
  byDow(6).label = "Rest";
  byDow(7).label = "Rest";

  persist();
  publishWeek(clientId, 1);

  // Log sets for Mon + Tue fully, Thu partially — leaves Fri untouched so
  // the Home "Today" due-list and Training progress pills have something
  // real (not 0/0 and not 100%) to show.
  const monAssignments = getData().workout_assignments.filter((a) => a.program_day_id === mon.id);
  monAssignments.forEach((a) => {
    for (let s = 1; s <= a.sets; s++) {
      logSetAt(a.id, s, (a.target_weight_kg ?? 20) + (s === a.sets ? 0 : 2.5), Number(a.reps.split("-")[0]) + 1, 7 + (s % 2), 6);
    }
  });
  const tueAssignments = getData().workout_assignments.filter((a) => a.program_day_id === tue.id);
  tueAssignments.forEach((a) => {
    for (let s = 1; s <= a.sets; s++) {
      logSetAt(a.id, s, a.target_weight_kg ?? 15, Number(a.reps.split("-")[0]), 8, 5);
    }
  });
  const thuAssignments = getData().workout_assignments.filter((a) => a.program_day_id === thu.id);
  thuAssignments.slice(0, 2).forEach((a) => {
    for (let s = 1; s <= Math.min(2, a.sets); s++) {
      logSetAt(a.id, s, a.target_weight_kg ?? 15, Number(a.reps.split("-")[0]), 8, 3);
    }
  });

  // ---- Nutrition ----
  const plan = getNutritionPlan(clientId);
  plan.maintenance_kcal = 2850;
  plan.ebf = 16;
  plan.training_day_meals = [
    { protein: 45, fats: 15, carbs: 60 }, // breakfast
    { protein: 35, fats: 10, carbs: 45 }, // snack
    { protein: 50, fats: 20, carbs: 80 }, // lunch
    { protein: 30, fats: 10, carbs: 40 }, // pre-workout snack
    { protein: 55, fats: 18, carbs: 70 }, // dinner
    { protein: 20, fats: 8, carbs: 20 }, // evening snack
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
    "Great adherence the last two weeks. Keep protein high on training days and don't skip the pre-workout snack, it's been helping your energy in the evening sessions.";
  saveNutritionPlan(plan);

  // ---- Measurements: 6 weeks of Monday check-ins, trending in the right direction ----
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

  // ---- Daily / weekly trackers ----
  addMetricDefinition(clientId, "Recovery", "Sleep", "hrs", "daily");
  addMetricDefinition(clientId, "Recovery", "Energy", "/5", "daily");
  addMetricDefinition(clientId, "Lifestyle", "Steps", "steps", "daily");
  const dailyDefs = getData().metric_definitions.filter((m) => m.client_id === clientId && m.frequency === "daily");
  const sleepDef = dailyDefs.find((d) => d.name === "Sleep")!;
  const energyDef = dailyDefs.find((d) => d.name === "Energy")!;
  const stepsDef = dailyDefs.find((d) => d.name === "Steps")!;
  for (let i = 1; i <= 9; i++) {
    const date = daysAgo(i);
    setMetricEntry(sleepDef.id, date, 6.5 + (i % 3) * 0.5);
    setMetricEntry(energyDef.id, date, 3 + (i % 3));
    setMetricEntry(stepsDef.id, date, 7500 + (i % 4) * 900);
  }
  // Deliberately leave "today" un-logged so Home's Today list has a real due item.

  addMetricDefinition(clientId, "Wellbeing", "Stress", "/5", "weekly");
  addMetricDefinition(clientId, "Wellbeing", "Soreness", "/5", "weekly");
  const weeklyDefs = getData().metric_definitions.filter((m) => m.client_id === clientId && m.frequency === "weekly");
  const stressDef = weeklyDefs.find((d) => d.name === "Stress")!;
  const sorenessDef = weeklyDefs.find((d) => d.name === "Soreness")!;
  [1, 2, 3].forEach((weeksBack) => {
    const date = weekStart(daysAgo(weeksBack * 7));
    setMetricEntry(stressDef.id, date, 2 + (weeksBack % 2));
    setMetricEntry(sorenessDef.id, date, 2);
  });
  // Leave this week un-logged (also feeds the Today due-list).

  // ---- Photos: 3 slots, weekly cadence, history over the last 3 periods ----
  setPhotoCadence(clientId, "weekly");
  addPhotoSlot(clientId, "Front");
  addPhotoSlot(clientId, "Side");
  addPhotoSlot(clientId, "Back");
  const slots = getData().photo_slots.filter((s) => s.client_id === clientId);
  const colors: Record<string, Buffer> = {
    // Tiny solid-color JPEGs generated once below and reused per period/slot.
  };
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

  // ---- Meetings ----
  addMeeting(clientId, daysAgo(-3), "17:00", "Monthly check-in call", 30);
  addMeeting(clientId, daysAgo(7), "17:00", "Week 13 check-in", 30);
  const meetings = getData().meetings.filter((m) => m.client_id === clientId);
  const pastMeeting = meetings.find((m) => m.date === daysAgo(7));
  if (pastMeeting) {
    pastMeeting.status = "completed";
    persist();
    addMeetingNote(pastMeeting.id, "Reviewed week 13: sets logged 11/16, weight trending up nicely.");
    addMeetingNote(pastMeeting.id, "Agreed to add a pre-workout snack to help evening session energy.");
  }

  // ---- Chat (backdated conversation) ----
  const chatSeed: Array<[number, "client" | "coach", string]> = [
    [3, "client", "Hey! Quick one. Is the leg press meant to be 4 sets or 3 this week?"],
    [3, "coach", "4 sets on Monday, 3 on Friday (that one's the lighter deload day) 👍"],
    [2, "client", "Got it, thanks! Also felt great today, hit all my targets."],
    [2, "coach", "Love to hear it. Logged, looks strong. Keep that up."],
    [1, "client", "Question about the pre-workout snack. Is timing important or just get it in?"],
    [1, "coach", "Roughly 45-60min before training is ideal, but don't stress if it's a bit off. Consistency matters more than precision here."],
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

  // ---- Invoices ----
  addInvoice(clientId, "Coaching, Month 3", 220, "paid");
  addInvoice(clientId, "Coaching, Month 4", 220, "sent");

  // ---- Training columns: touch so defaults are created (visible in admin table config) ----
  listTrainingColumns(clientId);

  console.log("Seeded rich data for Alex (client_id=1).");
}

// A minimal valid solid-color baseline JPEG, built by hand (no native image
// lib available) — good enough as a placeholder progress photo. Falls back
// to a tiny flat PNG-in-JPEG-wrapper trick isn't needed: we just shell out
// to whatever's on the machine if Python/PIL is present, else write a
// pre-baked 1x1 JPEG and let the browser upscale it.
function makeSolidJpeg(r: number, g: number, b: number): Buffer {
  try {
    const { execFileSync } = require("child_process");
    const tmp = path.join("/tmp", `swatch-${r}-${g}-${b}.jpg`);
    const py = `from PIL import Image; Image.new('RGB',(600,800),(${r},${g},${b})).save('${tmp}','JPEG')`;
    execFileSync("python3", ["-c", py], { stdio: "ignore" });
    const buf = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    return buf;
  } catch {
    // 1x1 red JPEG fallback (valid minimal JPEG bytes).
    return Buffer.from(
      "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
      "base64"
    );
  }
}

// ---------------------------------------------------------------------
// Two lighter clients so the admin sidebar/list, calendar, and feed have
// more than one row to show.
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
  addInvoice(clientId, "Coaching, Month 1", 180, opts.invoiceStatus);

  const d = getData();
  d.chat_messages.push({
    id: allocId("chat_messages"),
    client_id: clientId,
    sender: "client",
    text: "Hey, all set for this week's plan, thanks!",
    media_path: null,
    media_type: null,
    created_at: isoDaysAgo(1, 9, 15),
  });
  persist();

  console.log(`Seeded light demo data for ${name} (client_id=${clientId}).`);
}

seedAlex();
seedLightClient("Jordan Blake", { weight: 71.2, goalPhase: "Fat loss, 8kg to go", invoiceStatus: "unpaid", meetingTime: "10:00" });
seedLightClient("Sam Rivera", { weight: 64.8, goalPhase: "Strength & tone", invoiceStatus: "paid", meetingTime: "14:30" });

// Demo logins so a freshly-seeded copy is actually usable. Only ever created
// by this dev seed script — a real deployment gets its coach account from
// scripts/create-coach.ts with a password of the coach's own choosing, and
// client logins from the admin panel's App access box.
function seedLogin(email: string, password: string, role: "coach" | "client", clientId: number | null) {
  if (findUserByEmail(email)) return;
  createUser(email, password, role, clientId, false);
  console.log(`  login: ${email} / ${password} (${role})`);
}

console.log("Demo logins:");
seedLogin("coach@ironline.test", "ironline123", "coach", null);
const firstClient = getData().clients[0];
if (firstClient) seedLogin("client@ironline.test", "ironline123", "client", firstClient.id);

console.log("Done.");
