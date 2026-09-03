// Turns Sam Rivera into a complete, current demo client: a deployed 6-week
// programme with two finished weeks and a live third, six weeks of weight and
// waist history, daily and weekly check-in metrics with entries, graphs
// chosen, day-level nutrition targets with supplements and a coach note, a
// filled-in profile, goals, an upcoming call, invoices and an app login.
//
// Written against whatever Sam already has: the old training days are
// replaced (they were a single unstructured week from the first seed), and
// everything else is added only if a same-named row isn't there yet.
//
// Runs once at boot behind the .seeded-sam-demo-v1 marker in start-server.
//   npx tsx scripts/seed-sam-demo.ts   (dev server STOPPED)
import { allocId, getData, persist } from "../app/lib/db";
import { createUser, getUserForClient } from "../app/lib/auth";
import {
  addClientGoal,
  addExerciseToDay,
  addInvoice,
  addMeeting,
  addMetricDefinition,
  createClient,
  createProgram,
  deployProgram,
  getClientProfile,
  getNutritionPlan,
  listClients,
  listExercises,
  listMeasurementFields,
  addMeasurementField,
  localDateStr,
  saveClientProfile,
  saveNutritionPlan,
  setMeasurementValue,
  setMetricEntry,
  weekStart,
} from "../app/lib/queries";

const NAME = "Sam Rivera";

// ---- Dates, all relative to today so the demo is always "current" ----
const today = new Date();
const todayStr = localDateStr(today);
const thisMonday = weekStart(todayStr);
function shift(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}
const weekMonday = (weeksBack: number) => shift(thisMonday, -7 * weeksBack);

// ---- Client ----
let client = listClients().find((c) => c.name.toLowerCase() === NAME.toLowerCase());
if (!client) client = createClient(NAME);
const clientId = client.id;
const log = (m: string) => console.log(`[seed-sam-demo] ${m}`);

// ---- Profile ----
const profile = getClientProfile(clientId);
saveClientProfile({
  ...profile,
  birthdate: "1994-03-18",
  gender: "Female",
  email: "sam.rivera@example.com",
  phone: "+31 6 1234 5678",
  address: "Amsterdam",
  height_cm: 168,
  starting_weight_kg: 66.4,
  coaching_start_date: weekMonday(6),
  goal_phase: "Strength & tone",
  goal_phase_start_date: weekMonday(6),
  goal_date: shift(thisMonday, 7 * 8),
  check_in_day: "Sunday",
  steps_goal: "8,000 steps a day",
  cardio_goal: "2 x 20 min easy cardio",
  training_goal: "3 sessions a week",
  water_goal: "2.5L",
});

// ---- Programme: replace whatever training Sam had with a 6-week block ----
{
  const data = getData();
  const dayIds = new Set(data.program_days.filter((d) => d.client_id === clientId).map((d) => d.id));
  const waIds = new Set(data.workout_assignments.filter((w) => dayIds.has(w.program_day_id)).map((w) => w.id));
  data.set_logs = data.set_logs.filter((s) => !waIds.has(s.workout_assignment_id));
  data.assignment_custom_values = data.assignment_custom_values.filter((v) => !waIds.has(v.workout_assignment_id));
  data.workout_assignments = data.workout_assignments.filter((w) => !waIds.has(w.id));
  data.program_days = data.program_days.filter((d) => !dayIds.has(d.id));
  data.training_programs = data.training_programs.filter((p) => p.client_id !== clientId);
  persist();
}

const TOTAL_WEEKS = 6;
const LIVE_WEEK = 3; // deployed two weeks ago
const program = createProgram(clientId, "Strength & Tone Block", TOTAL_WEEKS, 1);

const exerciseId = (name: string) => {
  const ex = listExercises().find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (!ex) throw new Error(`Exercise not in library: ${name}`);
  return ex.id;
};

type Rx = { name: string; sets: number; reps: string; weight: number; step: number; rpe: number; tempo?: string; notes?: string };
const SPLIT: { dow: number; label: string; exercises: Rx[] }[] = [
  {
    dow: 1,
    label: "Lower body",
    exercises: [
      { name: "Leg Press", sets: 4, reps: "10-12", weight: 70, step: 2.5, rpe: 7, tempo: "2-0-2", notes: "Feet mid-plate, drive through the heels." },
      { name: "Romanian Deadlift", sets: 3, reps: "8-10", weight: 40, step: 2.5, rpe: 7 },
      { name: "Leg Extension", sets: 3, reps: "12-15", weight: 28, step: 2, rpe: 8 },
      { name: "Seated Leg Curl", sets: 3, reps: "12-15", weight: 25, step: 2, rpe: 8 },
      { name: "Standing Calf Raise", sets: 3, reps: "12-15", weight: 40, step: 2.5, rpe: 8 },
    ],
  },
  {
    dow: 2,
    label: "Upper, push",
    exercises: [
      { name: "Flat Chest Press Machine", sets: 3, reps: "10-12", weight: 22, step: 2, rpe: 7 },
      { name: "Seated Dumbbell Shoulder Press", sets: 3, reps: "10-12", weight: 8, step: 1, rpe: 7 },
      { name: "Cable Fly", sets: 3, reps: "12-15", weight: 10, step: 1, rpe: 8 },
      { name: "Dumbbell Lateral Raise", sets: 3, reps: "12-15", weight: 5, step: 0.5, rpe: 8, notes: "Keep it light and slow. Shoulder was tight last block." },
      { name: "Rope Tricep Pushdown", sets: 3, reps: "12-15", weight: 14, step: 1, rpe: 8 },
    ],
  },
  {
    dow: 4,
    label: "Upper, pull",
    exercises: [
      { name: "Lat Pulldown", sets: 3, reps: "10-12", weight: 30, step: 2, rpe: 7 },
      { name: "Seated Cable Row", sets: 3, reps: "10-12", weight: 30, step: 2, rpe: 7 },
      { name: "Face Pull", sets: 3, reps: "15", weight: 10, step: 1, rpe: 7 },
      { name: "Incline Dumbbell Curl", sets: 3, reps: "12", weight: 6, step: 1, rpe: 8 },
      { name: "Plank", sets: 3, reps: "45s", weight: 0, step: 0, rpe: 7 },
    ],
  },
  {
    dow: 6,
    label: "Full body + conditioning",
    exercises: [
      { name: "Goblet Squat", sets: 3, reps: "12", weight: 14, step: 2, rpe: 7 },
      { name: "Push-Up", sets: 3, reps: "8-12", weight: 0, step: 0, rpe: 8 },
      { name: "Hip Thrust", sets: 3, reps: "12", weight: 40, step: 5, rpe: 8 },
      { name: "Rowing Machine", sets: 1, reps: "15 min", weight: 0, step: 0, rpe: 7, notes: "Steady pace, conversational." },
    ],
  },
];

const weekDays = (week: number) => getData().program_days.filter((d) => d.client_id === clientId && d.week_number === week);
const setLabel = (dayId: number, label: string) => {
  const d = getData().program_days.find((pd) => pd.id === dayId);
  if (d) d.label = label;
  const rest = getData().program_days.filter((pd) => pd.client_id === clientId && pd.week_number === d?.week_number && !SPLIT.some((s) => s.dow === pd.day_of_week));
  rest.forEach((pd) => (pd.is_rest = true));
  persist();
};

for (let w = 1; w <= TOTAL_WEEKS; w++) {
  for (const s of SPLIT) {
    const day = weekDays(w).find((d) => d.day_of_week === s.dow)!;
    setLabel(day.id, s.label);
    for (const rx of s.exercises) {
      const weight = rx.weight === 0 ? null : Math.round((rx.weight + rx.step * (w - 1)) * 2) / 2;
      addExerciseToDay(day.id, exerciseId(rx.name), rx.sets, rx.reps, weight, rx.rpe, rx.tempo ?? null, rx.notes ?? null);
    }
  }
}

deployProgram(program.id);
{
  // Deployed two Mondays ago at 09:00, so week 3 is the live week.
  const data = getData();
  const p = data.training_programs.find((x) => x.id === program.id)!;
  p.deployed_at = `${weekMonday(LIVE_WEEK - 1)}T09:00:00.000Z`;
  persist();
}

// ---- Logged sets: weeks 1-2 complete, week 3 up to today ----
const todayDow = ((today.getDay() + 6) % 7) + 1; // Mon=1 … Sun=7
function logDay(week: number, dow: number, variance: number) {
  const day = weekDays(week).find((d) => d.day_of_week === dow);
  if (!day) return;
  const date = shift(weekMonday(LIVE_WEEK - week), dow - 1);
  const data = getData();
  const assignments = data.workout_assignments.filter((a) => a.program_day_id === day.id);
  assignments.forEach((a, ai) => {
    const baseReps = Number(String(a.reps).split(/[^0-9]/)[0]) || 10;
    for (let s = 1; s <= a.sets; s++) {
      // Mostly on target, occasionally a set under the prescribed weight or reps.
      const under = (ai + s + week) % 7 === 0;
      const weight = a.target_weight_kg == null ? null : under ? a.target_weight_kg - 2.5 : a.target_weight_kg + variance;
      const reps = under ? Math.max(1, baseReps - 2) : baseReps + (s === 1 ? 2 : 0);
      data.set_logs.push({
        id: allocId("set_logs"),
        workout_assignment_id: a.id,
        set_number: s,
        weight_kg: weight,
        reps,
        rpe_actual: a.rpe_target == null ? null : Math.min(10, a.rpe_target + (s === a.sets ? 1 : 0)),
        logged_at: `${date} ${String(17 + (ai % 2)).padStart(2, "0")}:${String((ai * 9 + s * 4) % 60).padStart(2, "0")}:00`,
      });
    }
  });
  persist();
}
for (let w = 1; w < LIVE_WEEK; w++) SPLIT.forEach((s) => logDay(w, s.dow, 0));
SPLIT.filter((s) => s.dow < todayDow).forEach((s) => logDay(LIVE_WEEK, s.dow, 0));

// ---- Weight and waist: six weekly check-ins, trending the right way ----
let fields = listMeasurementFields(clientId);
if (!fields.some((f) => f.name.toLowerCase() === "weight")) addMeasurementField(clientId, "Weight", "kg");
if (!fields.some((f) => f.name.toLowerCase() === "waist")) addMeasurementField(clientId, "Waist", "cm");
fields = listMeasurementFields(clientId);
const weightField = fields.find((f) => f.name.toLowerCase() === "weight")!;
const waistField = fields.find((f) => f.name.toLowerCase() === "waist")!;
const weights = [66.4, 66.1, 65.7, 65.4, 65.0, 64.8];
const waists = [72.5, 72.2, 71.8, 71.5, 71.1, 70.8];
weights.forEach((w, i) => {
  const date = shift(weekMonday(6 - i), 6); // the Sunday of each week
  setMeasurementValue(weightField.id, date, w);
  setMeasurementValue(waistField.id, date, waists[i]);
});

// ---- Check-in metrics ----
function metric(category: string, name: string, unit: string, frequency: "daily" | "weekly" | "monthly") {
  const existing = getData().metric_definitions.find(
    (m) => m.client_id === clientId && m.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) return existing.id;
  addMetricDefinition(clientId, category, name, unit, frequency);
  return getData().metric_definitions.find((m) => m.client_id === clientId && m.name === name)!.id;
}
const steps = metric("Activity", "Steps", "steps", "daily");
const sleep = metric("Recovery", "Sleep", "hrs", "daily");
const energy = metric("Recovery", "Energy", "/5", "daily");
const fluid = metric("Nutrition", "Fluid intake", "L", "daily");
const soreness = metric("Recovery", "Soreness", "/5", "weekly");
const stress = metric("Wellbeing", "Stress", "/5", "weekly");
const happiness = metric("Wellbeing", "Happiness", "/10", "weekly");

for (let back = 1; back <= 21; back++) {
  if (back % 6 === 0) continue; // a missed day here and there
  const date = shift(todayStr, -back);
  setMetricEntry(steps, date, 6800 + ((back * 397) % 3200));
  setMetricEntry(sleep, date, Math.round((6.4 + ((back * 7) % 5) * 0.35) * 10) / 10);
  setMetricEntry(energy, date, 3 + ((back * 3) % 3));
  setMetricEntry(fluid, date, Math.round((2.0 + ((back * 5) % 4) * 0.25) * 10) / 10);
}
for (let wk = 1; wk <= 5; wk++) {
  const period = weekMonday(wk);
  setMetricEntry(soreness, period, 2 + (wk % 2));
  setMetricEntry(stress, period, 2 + ((wk + 1) % 3));
  setMetricEntry(happiness, period, 7 + (wk % 3));
}

// ---- Graphs on the client's Home: weight, waist, steps, sleep ----
{
  const data = getData();
  data.metric_definitions.forEach((m) => {
    if (m.client_id === clientId) m.pinned = m.id === steps || m.id === sleep;
  });
  data.measurement_fields.forEach((f) => {
    if (f.client_id === clientId) f.pinned = f.id === weightField.id || f.id === waistField.id;
  });
  persist();
}

// ---- Nutrition ----
{
  const plan = getNutritionPlan(clientId);
  plan.name = "Strength & tone, phase 1";
  plan.day_targets = {
    training: { protein: 150, carbs: 220, fats: 60 },
    rest: { protein: 150, carbs: 160, fats: 65 },
  };
  plan.water_l = 2.5;
  plan.coach_notes =
    "Protein is the anchor: hit 150g every day, spread over 4 meals. Carbs go up on training days, fats a touch higher on rest days. Weigh in Sunday morning before breakfast.";
  const want = [
    { name: "Creatine monohydrate", quantity: "5g", timing: "daily, any time", notes: "Mix in water after training." },
    { name: "Vitamin D3", quantity: "2000 IU", timing: "with breakfast", notes: "" },
    { name: "Omega-3", quantity: "2 caps", timing: "with dinner", notes: "" },
    { name: "Magnesium glycinate", quantity: "300mg", timing: "before bed", notes: "Helps sleep and calf cramps." },
  ];
  const rows = plan.supplement_rows ?? [];
  want.forEach((w) => {
    if (rows.some((r) => r.name.toLowerCase() === w.name.toLowerCase())) return;
    rows.push({ id: allocId("supplement_rows"), ...w });
  });
  plan.supplement_rows = rows;
  saveNutritionPlan(plan);
}

// ---- Goals ----
{
  const have = new Set(getData().client_goals.filter((g) => g.client_id === clientId).map((g) => g.text.toLowerCase()));
  const add = (term: "short" | "long", text: string) => {
    if (!have.has(text.toLowerCase())) addClientGoal(clientId, term, text);
  };
  add("short", "Hit all 4 sessions every week this block");
  add("short", "Leg press 80kg for 10 clean reps");
  add("long", "First strict pull-up");
  add("long", "Hold 64kg comfortably through the summer");
}

// ---- Meetings and invoices ----
{
  const nextTuesday = shift(thisMonday, todayDow >= 2 ? 8 : 1);
  const meetings = getData().meetings.filter((m) => m.client_id === clientId);
  if (!meetings.some((m) => m.date === nextTuesday)) addMeeting(clientId, nextTuesday, "14:30", "Week 3 check-in call", 30);
  const invoices = getData().invoices.filter((i) => i.client_id === clientId);
  if (!invoices.some((i) => /Month 3/i.test(i.description))) addInvoice(clientId, "Coaching, Month 3", 180, "sent");
}

// ---- App login (temporary password, changed on first sign-in) ----
if (!getUserForClient(clientId)) {
  createUser("sam.rivera@example.com", "SamDemo2026!", "client", clientId, true);
  log("created client login sam.rivera@example.com (temporary password, change forced at sign-in)");
}

log(`done for ${NAME} (client ${clientId}): ${TOTAL_WEEKS}-week programme, live week ${LIVE_WEEK}, metrics, nutrition, goals, meeting, invoice.`);
