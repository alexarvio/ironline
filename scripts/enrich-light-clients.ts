/* One-time enrichment pass for Jordan Blake and Sam Rivera — the two "light"
   demo clients seeded by scripts/seed-rich.ts originally only got a single
   training day, one goal per term, and a couple of measurements, which made
   them look mostly empty next to Alex. This adds a comparable depth of demo
   data to *existing* client rows without touching what's already there:
   Monday's training day, the original 2 goals, meeting, and invoice are left
   alone, and everything here targets different days/dates/content so
   nothing is duplicated. Guarded to run exactly once by the .seeded-light-v2
   marker in scripts/start-server.mjs — do not re-run manually against a
   database that already has this data, it is not itself idempotent.

   Run with: npx tsx scripts/enrich-light-clients.ts
*/
import fs from "fs";
import path from "path";
import { getData, persist, allocId, DATA_DIR } from "../app/lib/db";
import {
  listClients,
  listExercises,
  addExerciseToDay,
  saveNutritionPlan,
  getNutritionPlan,
  listMeasurementFields,
  setMeasurementValue,
  addMetricDefinition,
  setMetricEntry,
  addPhotoSlot,
  setPhotoCadence,
  addClientGoal,
  addMeeting,
  addMeetingNote,
  addInvoice,
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
    logged_at: isoDaysAgo(daysBack, 18, (setNumber * 11) % 60).replace("T", " ").slice(0, 19),
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
    const { execFileSync } = require("child_process");
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

type LightClientConfig = {
  name: string;
  weight: number;
  waist: number;
  goalPhase: string;
  invoiceStatus: "unpaid" | "paid" | "sent" | "due";
  meetingTime: string;
  swatch: [number, number, number];
  extraDays: Array<{
    dow: number; // 1=Mon ... 7=Sun
    label: string;
    exercises: Array<{ name: string; sets: number; reps: string; weight: number | null; rpe: number | null }>;
    setsBack: number; // how many days ago these sets were logged
    fullyLogged: boolean;
  }>;
  weeklyTrend: Array<{ back: number; w: number; waist: number }>; // weeks ago
  extraShortGoal: string;
  extraLongGoal: string;
  coachNotes: string;
  chatFollowUp: Array<[number, "client" | "coach", string]>; // daysBack, sender, text
};

const CONFIGS: LightClientConfig[] = [
  {
    name: "Jordan Blake",
    weight: 71.2,
    waist: 88.5,
    goalPhase: "Fat loss, 8kg to go",
    invoiceStatus: "unpaid",
    meetingTime: "10:00",
    swatch: [170, 140, 120],
    extraDays: [
      {
        dow: 3,
        label: "Upper body",
        exercises: [
          { name: "Incline Chest Press Machine", sets: 3, reps: "10-12", weight: 30, rpe: 7 },
          { name: "Seated Cable Row", sets: 3, reps: "10-12", weight: 35, rpe: 7 },
          { name: "Lat Pulldown", sets: 3, reps: "10-12", weight: 32, rpe: null },
        ],
        setsBack: 2,
        fullyLogged: true,
      },
      {
        dow: 5,
        label: "Full body (conditioning)",
        exercises: [
          { name: "Leg Press", sets: 3, reps: "12-15", weight: 85, rpe: 7 },
          { name: "Calf Press", sets: 3, reps: "15", weight: 70, rpe: null },
          { name: "Side Raise Machine", sets: 3, reps: "12-15", weight: 8, rpe: null },
        ],
        setsBack: -3, // due in 3 days — leave unlogged for a real due item
        fullyLogged: false,
      },
    ],
    weeklyTrend: [
      { back: 28, w: 73.6, waist: 90.8 },
      { back: 21, w: 72.9, waist: 90.0 },
      { back: 14, w: 72.1, waist: 89.3 },
      { back: 7, w: 71.5, waist: 88.8 },
    ],
    extraShortGoal: "Hit 8,000 steps every day this week",
    extraLongGoal: "Fit into pre-2024 wardrobe by December",
    coachNotes:
      "Good week. Weight and waist both trending the right way. Keep protein consistent on rest days, that's the one area slipping a bit.",
    chatFollowUp: [
      [4, "client", "Down another 0.6kg this week, feeling good about the plan!"],
      [4, "coach", "Nice work. Waist is tracking with it too. Keep the steps up and we'll reassess calories in 2 weeks."],
      [1, "client", "Can we push Friday's session to Saturday this week? Travel for work."],
    ],
  },
  {
    name: "Sam Rivera",
    weight: 64.8,
    waist: 71.0,
    goalPhase: "Strength & tone",
    invoiceStatus: "paid",
    meetingTime: "14:30",
    swatch: [150, 160, 175],
    extraDays: [
      {
        dow: 3,
        label: "Upper body",
        exercises: [
          { name: "Flat Chest Press Machine", sets: 3, reps: "10-12", weight: 22, rpe: 7 },
          { name: "Lat Pulldown", sets: 3, reps: "10-12", weight: 28, rpe: 7 },
          { name: "Seated Alternating Dumbbell Curl", sets: 3, reps: "12-15", weight: 8, rpe: null },
        ],
        setsBack: 2,
        fullyLogged: true,
      },
      {
        dow: 5,
        label: "Lower body",
        exercises: [
          { name: "Leg Press", sets: 4, reps: "10-12", weight: 70, rpe: 7 },
          { name: "Leg Extension", sets: 3, reps: "12-15", weight: 28, rpe: null },
          { name: "Seated Leg Curl", sets: 3, reps: "12-15", weight: 25, rpe: null },
        ],
        setsBack: -2, // due in 2 days
        fullyLogged: false,
      },
    ],
    weeklyTrend: [
      { back: 28, w: 65.3, waist: 71.6 },
      { back: 21, w: 65.1, waist: 71.4 },
      { back: 14, w: 64.9, waist: 71.2 },
      { back: 7, w: 64.8, waist: 71.0 },
    ],
    extraShortGoal: "Add 2.5kg to leg press this week",
    extraLongGoal: "Pull-up progression, first strict rep by spring",
    coachNotes:
      "Strength is climbing steadily on every lift. No changes needed, just keep stacking small weight increases each week.",
    chatFollowUp: [
      [5, "client", "Leg press felt easy at 70kg today, can we bump it next week?"],
      [5, "coach", "Yep, let's try 72.5kg for the same rep range, good sign of progress."],
      [2, "client", "Shoulder felt a little tight during side raises, nothing serious though."],
      [2, "coach", "Noted. Let's drop the weight slightly there and keep an eye on it at the next check-in."],
    ],
  },
];

function enrichClient(cfg: LightClientConfig) {
  const client = listClients().find((c) => c.name === cfg.name);
  if (!client) {
    console.log(`Skipping ${cfg.name}: no matching client found (run scripts/seed-rich.ts first).`);
    return;
  }
  const clientId = client.id;

  // ---- Extra training days ----
  const week = getData().program_days.filter((d) => d.client_id === clientId && d.week_number === 1);
  cfg.extraDays.forEach((day) => {
    const programDay = week.find((p) => p.day_of_week === day.dow);
    if (!programDay) return;
    programDay.label = day.label;
    persist();
    day.exercises.forEach((ex) => {
      addExerciseToDay(programDay.id, findExerciseId(ex.name), ex.sets, ex.reps, ex.weight, ex.rpe, null, null);
    });
    if (day.fullyLogged) {
      const assignments = getData().workout_assignments.filter((a) => a.program_day_id === programDay.id);
      assignments.forEach((a) => {
        for (let s = 1; s <= a.sets; s++) {
          logSetAt(a.id, s, a.target_weight_kg, Number(a.reps.split("-")[0]), 7, day.setsBack);
        }
      });
    }
  });

  // ---- Nutrition plan ----
  const plan = getNutritionPlan(clientId);
  const maintenance = Math.round(cfg.weight * 32);
  plan.maintenance_kcal = maintenance;
  plan.ebf = null;
  plan.training_day_meals = [
    { protein: 30, fats: 12, carbs: 45 },
    { protein: 25, fats: 8, carbs: 30 },
    { protein: 35, fats: 15, carbs: 55 },
    { protein: 35, fats: 12, carbs: 50 },
  ];
  plan.rest_day_meals = [
    { protein: 28, fats: 14, carbs: 30 },
    { protein: 22, fats: 8, carbs: 20 },
    { protein: 32, fats: 16, carbs: 35 },
    { protein: 30, fats: 12, carbs: 30 },
  ];
  plan.supplements[slugify("Creatine")] = { quantity: "5g", timing: "daily, any time" };
  plan.vitamins[slugify("Vitamin D")] = { quantity: "2000 IU", timing: "with breakfast" };
  plan.other[slugify("Fluid intake")] = { amount: "2.5L", timing: "throughout the day" };
  plan.coach_notes = cfg.coachNotes;
  saveNutritionPlan(plan);

  // ---- More measurement history ----
  const fields = listMeasurementFields(clientId);
  const weightField = fields.find((f) => f.name === "Weight")!;
  const waistField = fields.find((f) => f.name === "Waist")!;
  cfg.weeklyTrend.forEach(({ back, w, waist }) => {
    const date = weekStart(daysAgo(back));
    setMeasurementValue(weightField.id, date, w);
    setMeasurementValue(waistField.id, date, waist);
  });

  // ---- Trackers ----
  addMetricDefinition(clientId, "Recovery", "Sleep", "hrs", "daily");
  addMetricDefinition(clientId, "Lifestyle", "Steps", "steps", "daily");
  const dailyDefs = getData().metric_definitions.filter((m) => m.client_id === clientId && m.frequency === "daily");
  const sleepDef = dailyDefs.find((d) => d.name === "Sleep")!;
  const stepsDef = dailyDefs.find((d) => d.name === "Steps")!;
  for (let i = 1; i <= 6; i++) {
    const date = daysAgo(i);
    setMetricEntry(sleepDef.id, date, 6.5 + (i % 3) * 0.4);
    setMetricEntry(stepsDef.id, date, 6800 + (i % 4) * 800);
  }
  addMetricDefinition(clientId, "Wellbeing", "Soreness", "/5", "weekly");
  const weeklyDefs = getData().metric_definitions.filter((m) => m.client_id === clientId && m.frequency === "weekly");
  const sorenessDef = weeklyDefs.find((d) => d.name === "Soreness")!;
  [1, 2].forEach((weeksBack) => {
    setMetricEntry(sorenessDef.id, weekStart(daysAgo(weeksBack * 7)), 2 + (weeksBack % 2));
  });

  // ---- Photos: 2 slots, weekly cadence, 2 periods of history ----
  setPhotoCadence(clientId, "weekly");
  addPhotoSlot(clientId, "Front");
  addPhotoSlot(clientId, "Side");
  const slots = getData().photo_slots.filter((s) => s.client_id === clientId);
  [2, 1].forEach((weeksBack, i) => {
    const period = weekStart(daysAgo(weeksBack * 7));
    slots.forEach((slot) => {
      const dir = path.join(DATA_DIR, "uploads", "progress", String(clientId), String(slot.id));
      fs.mkdirSync(dir, { recursive: true });
      const filename = `${period}.jpg`;
      const [r, g, b] = cfg.swatch;
      const buf = makeSolidJpeg(r + i * 10, g + i * 10, b + i * 10);
      fs.writeFileSync(path.join(dir, filename), buf);
      const data = getData();
      data.photo_uploads.push({
        id: allocId("photo_uploads"),
        slot_id: slot.id,
        period,
        file_path: `/uploads/progress/${clientId}/${slot.id}/${filename}`,
        uploaded_at: isoDaysAgo(weeksBack * 7),
      });
      persist();
    });
  });
  const data1 = getData();
  data1.photo_period_notes.push({
    client_id: clientId,
    period: weekStart(daysAgo(7)),
    shape: "Visible progress since last check-in.",
    strengths: "Posture and consistency in photo angle are great.",
    improvements: "Nothing major. Keep the same lighting setup.",
    next_steps: "Same time, same spot next week.",
  });
  persist();

  // ---- Extra goals ----
  addClientGoal(clientId, "short", cfg.extraShortGoal);
  addClientGoal(clientId, "long", cfg.extraLongGoal);

  // ---- A completed past meeting with notes ----
  addMeeting(clientId, daysAgo(7), cfg.meetingTime, "Week 3 check-in call", 30);
  const pastMeeting = getData().meetings.find((m) => m.client_id === clientId && m.date === daysAgo(7));
  if (pastMeeting) {
    pastMeeting.status = "completed";
    persist();
    addMeetingNote(pastMeeting.id, "Reviewed week 3: good adherence, adjusted training slightly.");
  }

  // ---- Second invoice ----
  addInvoice(clientId, "Coaching, Month 2", 180, cfg.invoiceStatus === "unpaid" ? "sent" : "paid");

  // ---- Chat follow-up ----
  cfg.chatFollowUp.forEach(([daysBack, sender, text], i) => {
    const d = getData();
    d.chat_messages.push({
      id: allocId("chat_messages"),
      client_id: clientId,
      sender,
      text,
      media_path: null,
      media_type: null,
      created_at: isoDaysAgo(daysBack, 9 + i, (i * 13) % 60),
    });
    persist();
  });

  console.log(`Enriched ${cfg.name} (client_id=${clientId}).`);
}

CONFIGS.forEach(enrichClient);
console.log("Done.");
