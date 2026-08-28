import fs from "fs";
import path from "path";
import { allocId, DATA_DIR, getData, persist } from "./db";

// "Today" (or any Date) as a local YYYY-MM-DD calendar-date string. This is
// deliberately NOT `date.toISOString().slice(0, 10)` — toISOString always
// converts to UTC first, which silently shifts the date backward by one day
// for anyone in a positive UTC-offset timezone (most of Asia/Oceania) during
// part of their local day. That bug used to be scattered across this file
// and several components (each with its own toISOString-based todayStr()),
// producing wrong week-bucket labels and off-by-one check-in/meeting dates.
// Use this everywhere a *calendar date* (not a precise instant) is needed.
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type Exercise = { id: number; name: string; muscle_tags: string | null; video_url: string | null };
export type ProgramDay = {
  id: number;
  client_id: number;
  week_number: number;
  day_of_week: number;
  label: string | null;
  status: "draft" | "published";
};
export type WorkoutAssignment = {
  id: number;
  program_day_id: number;
  exercise_id: number;
  order_index: number;
  sets: number;
  reps: string;
  target_weight_kg: number | null;
  rpe_target: number | null;
  rest_seconds: number | null;
  tempo: string | null;
  notes: string | null;
  exercise_name?: string;
  exercise_video_url?: string | null;
};
export type SetLog = {
  id: number;
  workout_assignment_id: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe_actual: number | null;
  logged_at: string;
};

export type MealMacros = { protein: number | null; fats: number | null; carbs: number | null };
export type NutritionPlan = {
  client_id: number;
  maintenance_kcal: number | null;
  ebf: number | null;
  training_day_meals: MealMacros[];
  rest_day_meals: MealMacros[];
  vitamins: Record<string, { quantity: string; timing: string }>;
  other: Record<string, { amount: string; timing: string }>;
  supplements: Record<string, { quantity: string; timing: string }>;
  coach_notes: string;
};

// Fixed lists straight from the coach's original "Voeding en supplementen" tab.
export const VITAMIN_ITEMS = [
  "Vitamin A",
  "Vitamin B",
  "Vitamin C",
  "Vitamin D",
  "Vitamin E",
  "Vitamin K",
  "Magnesium",
  "Zinc",
  "Omega-3",
];
export const OTHER_ITEMS = ["Fiber", "Vegetables", "Fluid intake", "Caffeine", "Other"];
export const SUPPLEMENT_ITEMS = [
  "Creatine",
  "Magnesium",
  "Zinc",
  "Omega-3",
  "Vitamin D",
  "Other",
];

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function emptyMeals(): MealMacros[] {
  return Array.from({ length: 6 }, () => ({ protein: null, fats: null, carbs: null }));
}

function emptyKeyedMap<T extends string>(items: string[], fields: T[]): Record<string, Record<T, string>> {
  const map: Record<string, Record<T, string>> = {};
  items.forEach((item) => {
    const entry = {} as Record<T, string>;
    fields.forEach((f) => (entry[f] = ""));
    map[slugify(item)] = entry;
  });
  return map;
}

export function getClient(id: number) {
  return getData().clients.find((c) => c.id === id);
}

export function listClients() {
  return [...getData().clients].sort((a, b) => a.name.localeCompare(b.name));
}

export function createClient(name: string) {
  const data = getData();
  const client = { id: allocId("clients"), name };
  data.clients.push(client);
  persist();
  return client;
}

export function listExercises(): Exercise[] {
  return [...getData().exercises].sort((a, b) => a.name.localeCompare(b.name));
}

// Muscle-group catalog for the exercise picker — coaches browse by group
// first, then pick (or add) an exercise, instead of scanning one long list.
export const MUSCLE_GROUPS = [
  { slug: "back", label: "Back" },
  { slug: "chest", label: "Chest" },
  { slug: "shoulders", label: "Shoulders" },
  { slug: "biceps", label: "Biceps" },
  { slug: "triceps", label: "Triceps" },
  { slug: "quads", label: "Quads" },
  { slug: "hamstrings", label: "Hamstrings" },
  { slug: "calves", label: "Calves" },
  { slug: "abs", label: "Abs" },
  { slug: "glutes", label: "Glutes" },
  { slug: "other", label: "Other" },
] as const;

function primaryGroup(exercise: Exercise): string {
  const first = (exercise.muscle_tags ?? "").split(",")[0]?.trim().toLowerCase();
  return MUSCLE_GROUPS.some((g) => g.slug === first) ? first : "other";
}

export function listExercisesByGroup(): Record<string, Exercise[]> {
  const all = listExercises();
  const byGroup: Record<string, Exercise[]> = {};
  MUSCLE_GROUPS.forEach((g) => (byGroup[g.slug] = []));
  all.forEach((e) => byGroup[primaryGroup(e)].push(e));
  return byGroup;
}

export function addExercise(name: string, muscleGroup: string, videoUrl: string | null): Exercise {
  const data = getData();
  const group = MUSCLE_GROUPS.some((g) => g.slug === muscleGroup) ? muscleGroup : "other";
  const exercise: Exercise = {
    id: allocId("exercises"),
    name,
    muscle_tags: group,
    video_url: videoUrl && videoUrl.trim() ? videoUrl.trim() : null,
  };
  data.exercises.push(exercise);
  persist();
  return exercise;
}

// Ensures rows 1..7 exist (as drafts) for a given client/week, without clobbering existing ones.
export function ensureWeekSkeleton(clientId: number, week: number) {
  const data = getData();
  let changed = false;
  for (let d = 1; d <= 7; d++) {
    const exists = data.program_days.some(
      (pd) => pd.client_id === clientId && pd.week_number === week && pd.day_of_week === d
    );
    if (!exists) {
      data.program_days.push({
        id: allocId("program_days"),
        client_id: clientId,
        week_number: week,
        day_of_week: d,
        label: null,
        status: "draft",
      });
      changed = true;
    }
  }
  if (changed) persist();
}

export function getWeek(clientId: number, week: number): ProgramDay[] {
  return getData()
    .program_days.filter((pd) => pd.client_id === clientId && pd.week_number === week)
    .sort((a, b) => a.day_of_week - b.day_of_week);
}

export function getAssignmentsForDay(programDayId: number): WorkoutAssignment[] {
  const data = getData();
  return data.workout_assignments
    .filter((wa) => wa.program_day_id === programDayId)
    .sort((a, b) => a.order_index - b.order_index)
    .map((wa) => {
      const exercise = data.exercises.find((e) => e.id === wa.exercise_id);
      return {
        ...wa,
        exercise_name: exercise?.name ?? "Unknown exercise",
        exercise_video_url: exercise?.video_url ?? null,
      };
    });
}

export function setDayLabel(programDayId: number, label: string) {
  const data = getData();
  const day = data.program_days.find((pd) => pd.id === programDayId);
  if (day) {
    day.label = label;
    persist();
  }
}

export function addExerciseToDay(
  programDayId: number,
  exerciseId: number,
  sets: number,
  reps: string,
  targetWeight: number | null,
  rpeTarget: number | null = null,
  tempo: string | null = null,
  notes: string | null = null
) {
  const data = getData();
  const count = data.workout_assignments.filter((wa) => wa.program_day_id === programDayId).length;
  data.workout_assignments.push({
    id: allocId("workout_assignments"),
    program_day_id: programDayId,
    exercise_id: exerciseId,
    order_index: count,
    sets,
    reps,
    target_weight_kg: targetWeight,
    rpe_target: rpeTarget,
    rest_seconds: null,
    tempo,
    notes,
  });
  persist();
}

export function removeAssignment(assignmentId: number) {
  const data = getData();
  data.set_logs = data.set_logs.filter((sl) => sl.workout_assignment_id !== assignmentId);
  data.workout_assignments = data.workout_assignments.filter((wa) => wa.id !== assignmentId);
  persist();
}

export function publishWeek(clientId: number, week: number) {
  const data = getData();
  data.program_days
    .filter((pd) => pd.client_id === clientId && pd.week_number === week)
    .forEach((pd) => (pd.status = "published"));
  persist();
}

export function getPublishedWeek(clientId: number, week: number): ProgramDay[] {
  return getData()
    .program_days.filter(
      (pd) => pd.client_id === clientId && pd.week_number === week && pd.status === "published"
    )
    .sort((a, b) => a.day_of_week - b.day_of_week);
}

export function logSet(
  workoutAssignmentId: number,
  setNumber: number,
  weightKg: number | null,
  reps: number | null,
  rpeActual: number | null
) {
  const data = getData();
  data.set_logs.push({
    id: allocId("set_logs"),
    workout_assignment_id: workoutAssignmentId,
    set_number: setNumber,
    weight_kg: weightKg,
    reps,
    rpe_actual: rpeActual,
    logged_at: new Date().toISOString().replace("T", " ").slice(0, 19),
  });
  persist();
}

export function getLogsForAssignment(workoutAssignmentId: number): SetLog[] {
  return getData()
    .set_logs.filter((sl) => sl.workout_assignment_id === workoutAssignmentId)
    .sort((a, b) => a.set_number - b.set_number);
}

export type WeekLogGroup = { weekStart: string; logs: SetLog[] };

// The program itself is a single deployed template (one assignment per
// exercise per day), but the client logs against it every real week they
// train — so a coach comparing "week 1 vs week 2" is really asking to group
// the same assignment's logs by the calendar week they were logged in. Most
// recent week first, so scrolling down goes further back in time.
export function getLogsForAssignmentByWeek(workoutAssignmentId: number): WeekLogGroup[] {
  const logs = getData().set_logs.filter((sl) => sl.workout_assignment_id === workoutAssignmentId);
  const byWeek = new Map<string, SetLog[]>();
  logs.forEach((l) => {
    const week = weekStart(l.logged_at.slice(0, 10));
    if (!byWeek.has(week)) byWeek.set(week, []);
    byWeek.get(week)!.push(l);
  });
  return Array.from(byWeek.entries())
    .map(([ws, weekLogs]) => ({
      weekStart: ws,
      logs: weekLogs.sort((a, b) => a.set_number - b.set_number || (a.logged_at < b.logged_at ? -1 : 1)),
    }))
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

// ---- Training table columns: coach-configurable, same pattern as
// Measurements/Trackers. "Exercise", "Logged by client", and remove stay
// fixed/structural; everything else (Sets, Reps, Weight goal, RPE, Tempo,
// Notes, plus any custom columns the coach adds) can be hidden, renamed, or
// added to per client. ----

export type TrainingColumn = {
  id: number;
  client_id: number;
  key: string;
  label: string;
  kind: "builtin" | "custom";
  visible: boolean;
  order_index: number;
};
export type AssignmentCustomValue = { id: number; workout_assignment_id: number; column_id: number; value: string };

const DEFAULT_TRAINING_COLUMNS: { key: string; label: string }[] = [
  { key: "sets", label: "Sets" },
  { key: "reps", label: "Reps" },
  { key: "weight_goal", label: "Weight goal" },
  { key: "rpe", label: "RPE" },
  { key: "tempo", label: "Tempo" },
  { key: "notes", label: "Notes" },
];

export function listTrainingColumns(clientId: number): TrainingColumn[] {
  const data = getData();
  const existing = data.training_columns.filter((c) => c.client_id === clientId);
  if (existing.length === 0) {
    DEFAULT_TRAINING_COLUMNS.forEach((def, i) => {
      data.training_columns.push({
        id: allocId("training_columns"),
        client_id: clientId,
        key: def.key,
        label: def.label,
        kind: "builtin",
        visible: true,
        order_index: i,
      });
    });
    persist();
    return data.training_columns.filter((c) => c.client_id === clientId).sort((a, b) => a.order_index - b.order_index);
  }
  return existing.sort((a, b) => a.order_index - b.order_index);
}

export function updateTrainingColumn(id: number, label: string) {
  const data = getData();
  const col = data.training_columns.find((c) => c.id === id);
  if (col) {
    col.label = label;
    persist();
  }
}

export function setTrainingColumnVisible(id: number, visible: boolean) {
  const data = getData();
  const col = data.training_columns.find((c) => c.id === id);
  if (col) {
    col.visible = visible;
    persist();
  }
}

export function addCustomTrainingColumn(clientId: number, label: string) {
  const data = getData();
  const maxOrder = Math.max(0, ...data.training_columns.filter((c) => c.client_id === clientId).map((c) => c.order_index));
  const id = allocId("training_columns");
  data.training_columns.push({
    id,
    client_id: clientId,
    key: `custom_${id}`,
    label,
    kind: "custom",
    visible: true,
    order_index: maxOrder + 1,
  });
  persist();
}

export function removeCustomTrainingColumn(id: number) {
  const data = getData();
  data.training_columns = data.training_columns.filter((c) => c.id !== id);
  data.assignment_custom_values = data.assignment_custom_values.filter((v) => v.column_id !== id);
  persist();
}

export function getCustomValues(columnIds: number[]): AssignmentCustomValue[] {
  return getData().assignment_custom_values.filter((v) => columnIds.includes(v.column_id));
}

export function setAssignmentCustomValue(workoutAssignmentId: number, columnId: number, value: string) {
  const data = getData();
  const existing = data.assignment_custom_values.find(
    (v) => v.workout_assignment_id === workoutAssignmentId && v.column_id === columnId
  );
  if (existing) {
    existing.value = value;
  } else {
    data.assignment_custom_values.push({
      id: allocId("assignment_custom_values"),
      workout_assignment_id: workoutAssignmentId,
      column_id: columnId,
      value,
    });
  }
  persist();
}

// Everything a client has logged, most recent first — what the coach dashboard reads.
export function getRecentLogsForClient(clientId: number, limit = 20) {
  const data = getData();
  const assignmentsForClient = new Map(
    data.workout_assignments.map((wa) => [wa.id, wa] as const)
  );
  const daysById = new Map(data.program_days.map((pd) => [pd.id, pd] as const));
  const exercisesById = new Map(data.exercises.map((e) => [e.id, e] as const));

  return data.set_logs
    .filter((sl) => {
      const wa = assignmentsForClient.get(sl.workout_assignment_id);
      const day = wa ? daysById.get(wa.program_day_id) : undefined;
      return day?.client_id === clientId;
    })
    .sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1))
    .slice(0, limit)
    .map((sl) => {
      const wa = assignmentsForClient.get(sl.workout_assignment_id)!;
      const day = daysById.get(wa.program_day_id)!;
      const exercise = exercisesById.get(wa.exercise_id);
      return {
        ...sl,
        exercise_name: exercise?.name ?? "Unknown exercise",
        day_of_week: day.day_of_week,
        week_number: day.week_number,
      };
    });
}

// ---- Admin panel: client summary + invoices + the trend graph ----

export type Invoice = {
  id: number;
  client_id: number;
  description: string;
  amount: number;
  status: "unpaid" | "sent" | "paid" | "due";
  created_at: string;
  updated_at: string;
};

export function listInvoices(clientId: number): Invoice[] {
  return getData()
    .invoices.filter((inv) => inv.client_id === clientId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function addInvoice(
  clientId: number,
  description: string,
  amount: number,
  status: Invoice["status"]
) {
  const data = getData();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  data.invoices.push({
    id: allocId("invoices"),
    client_id: clientId,
    description,
    amount,
    status,
    created_at: now,
    updated_at: now,
  });
  persist();
}

export function setInvoiceStatus(invoiceId: number, status: Invoice["status"]) {
  const data = getData();
  const inv = data.invoices.find((i) => i.id === invoiceId);
  if (inv) {
    inv.status = status;
    inv.updated_at = new Date().toISOString().replace("T", " ").slice(0, 19);
    persist();
  }
}

// "Last active" — most recent thing this client actually logged, across any
// training week. Returns null if they haven't logged anything yet.
export function getLastActive(clientId: number): string | null {
  const recent = getRecentLogsForClient(clientId, 1);
  return recent.length > 0 ? recent[0].logged_at : null;
}

// A quick client summary for the admin panel header row.
export function getClientSummary(clientId: number) {
  const data = getData();
  const dayIds = new Set(
    data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.id)
  );
  const assignmentIds = new Set(
    data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id)).map((wa) => wa.id)
  );
  const publishedDays = data.program_days.filter(
    (pd) => pd.client_id === clientId && pd.status === "published"
  );
  const trainingDaysBuilt = [...dayIds].filter(
    (id) => data.workout_assignments.some((wa) => wa.program_day_id === id)
  ).length;
  const totalSets = data.set_logs.filter((sl) => assignmentIds.has(sl.workout_assignment_id)).length;

  return {
    trainingDaysBuilt,
    programPublished: publishedDays.length > 0,
    totalSetsLogged: totalSets,
    lastActive: getLastActive(clientId),
  };
}

// ---- Cross-client activity feed ----
// Every event here is sourced from real, timestamped writes elsewhere in the
// store — nothing here is synthesized. As more client-facing logging gets
// built (bodyweight, nutrition, check-ins), add another branch here rather
// than faking events in the UI.

export type FeedEvent =
  | {
      type: "set_logged";
      id: string;
      clientId: number;
      clientName: string;
      exerciseName: string;
      weightKg: number | null;
      reps: number | null;
      at: string;
    }
  | {
      type: "invoice_status";
      id: string;
      clientId: number;
      clientName: string;
      description: string;
      status: Invoice["status"];
      at: string;
    };

export function getActivityFeed(limit = 30): FeedEvent[] {
  const data = getData();
  const clientsById = new Map(data.clients.map((c) => [c.id, c] as const));
  const assignmentsById = new Map(data.workout_assignments.map((wa) => [wa.id, wa] as const));
  const daysById = new Map(data.program_days.map((pd) => [pd.id, pd] as const));
  const exercisesById = new Map(data.exercises.map((e) => [e.id, e] as const));

  const setEvents: FeedEvent[] = data.set_logs
    .map((sl): FeedEvent | null => {
      const wa = assignmentsById.get(sl.workout_assignment_id);
      const day = wa ? daysById.get(wa.program_day_id) : undefined;
      const client = day ? clientsById.get(day.client_id) : undefined;
      if (!wa || !day || !client) return null;
      const exercise = exercisesById.get(wa.exercise_id);
      return {
        type: "set_logged" as const,
        id: `set-${sl.id}`,
        clientId: client.id,
        clientName: client.name,
        exerciseName: exercise?.name ?? "an exercise",
        weightKg: sl.weight_kg,
        reps: sl.reps,
        at: sl.logged_at,
      };
    })
    .filter((e): e is FeedEvent => e !== null);

  const invoiceEvents: FeedEvent[] = data.invoices
    .map((inv): FeedEvent | null => {
      const client = clientsById.get(inv.client_id);
      if (!client) return null;
      return {
        type: "invoice_status" as const,
        id: `invoice-${inv.id}-${inv.updated_at}`,
        clientId: client.id,
        clientName: client.name,
        description: inv.description,
        status: inv.status,
        at: inv.updated_at,
      };
    })
    .filter((e): e is FeedEvent => e !== null);

  return [...setEvents, ...invoiceEvents]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit);
}

// ---- Nutrition plan: coach's macro/vitamin/supplement targets for a client ----
// Mirrors the "Voeding en supplementen" tab from the original sheet. This is
// the coach's target plan, not a food diary — actual meal-by-meal logging by
// the client is a separate, not-yet-built feature.

export function getNutritionPlan(clientId: number): NutritionPlan {
  const existing = getData().nutrition_plans.find((p) => p.client_id === clientId);
  if (existing) return existing;
  return {
    client_id: clientId,
    maintenance_kcal: null,
    ebf: null,
    training_day_meals: emptyMeals(),
    rest_day_meals: emptyMeals(),
    vitamins: emptyKeyedMap(VITAMIN_ITEMS, ["quantity", "timing"]),
    other: emptyKeyedMap(OTHER_ITEMS, ["amount", "timing"]),
    supplements: emptyKeyedMap(SUPPLEMENT_ITEMS, ["quantity", "timing"]),
    coach_notes: "",
  };
}

export function saveNutritionPlan(plan: NutritionPlan) {
  const data = getData();
  const idx = data.nutrition_plans.findIndex((p) => p.client_id === plan.client_id);
  if (idx >= 0) data.nutrition_plans[idx] = plan;
  else data.nutrition_plans.push(plan);
  persist();
}

// How many days of week 1 actually have exercises built — used to project a
// weekly kcal total from the training-day / rest-day kcal targets.
export function getTrainingDaysBuiltCount(clientId: number, week = 1): number {
  return getWeek(clientId, week).filter((d) => getAssignmentsForDay(d.id).length > 0).length;
}

// ---- Measurements: the coach's "Metingen" tab ----
// Coach-defined check-in columns — the coach decides what the client is
// asked to log at each check-in (defaults to Weight/kg and Waist/cm) and can
// rename, add, or remove columns any time. The client is the only one who
// fills in values (see actions.ts / the /client check-in form); the coach's
// panel here only manages the column definitions and can remove a bad row.
// Values are keyed by field + date, so removing/renaming one column never
// touches the data for the others.

export type MeasurementFieldDef = {
  id: number;
  client_id: number;
  name: string;
  unit: string;
  order_index: number;
};
export type MeasurementValue = {
  id: number;
  client_id: number;
  field_id: number;
  date: string;
  value: number | null;
};
export type SkinfoldEntry = {
  id: number;
  client_id: number;
  date: string;
  site: string;
  reading_mm: number | null;
};

export const SKINFOLD_SITES = ["Suprailiac", "Umbilical", "Thigh"];

const DEFAULT_MEASUREMENT_FIELDS = [
  { name: "Weight", unit: "kg" },
  { name: "Waist", unit: "cm" },
];

// Auto-seeds the default Weight/Waist columns the first time a client's
// Measurements tab is opened, so existing clients get a sensible starting
// point without a migration step.
export function listMeasurementFields(clientId: number): MeasurementFieldDef[] {
  const data = getData();
  const existing = data.measurement_fields.filter((f) => f.client_id === clientId);
  if (existing.length === 0) {
    DEFAULT_MEASUREMENT_FIELDS.forEach((f, i) => {
      data.measurement_fields.push({
        id: allocId("measurement_fields"),
        client_id: clientId,
        name: f.name,
        unit: f.unit,
        order_index: i,
      });
    });
    persist();
    return getData()
      .measurement_fields.filter((f) => f.client_id === clientId)
      .sort((a, b) => a.order_index - b.order_index);
  }
  return existing.sort((a, b) => a.order_index - b.order_index);
}

export function addMeasurementField(clientId: number, name: string, unit: string) {
  const data = getData();
  const count = data.measurement_fields.filter((f) => f.client_id === clientId).length;
  data.measurement_fields.push({
    id: allocId("measurement_fields"),
    client_id: clientId,
    name,
    unit,
    order_index: count,
  });
  persist();
}

export function updateMeasurementField(id: number, name: string, unit: string) {
  const data = getData();
  const field = data.measurement_fields.find((f) => f.id === id);
  if (field) {
    field.name = name;
    field.unit = unit;
    persist();
  }
}

export function removeMeasurementField(id: number) {
  const data = getData();
  data.measurement_fields = data.measurement_fields.filter((f) => f.id !== id);
  data.measurement_values = data.measurement_values.filter((v) => v.field_id !== id);
  persist();
}

export function getMeasurementValues(fieldIds: number[]): MeasurementValue[] {
  const idSet = new Set(fieldIds);
  return getData().measurement_values.filter((v) => idSet.has(v.field_id));
}

// Upsert: logging the same field for the same date again overwrites the
// value rather than creating a duplicate row.
export function setMeasurementValue(fieldId: number, date: string, value: number | null) {
  const data = getData();
  const existing = data.measurement_values.find(
    (v) => v.field_id === fieldId && v.date === date
  );
  if (existing) {
    existing.value = value;
  } else {
    data.measurement_values.push({
      id: allocId("measurement_values"),
      client_id: data.measurement_fields.find((f) => f.id === fieldId)?.client_id ?? 0,
      field_id: fieldId,
      date,
      value,
    });
  }
  persist();
}

// All distinct check-in dates across a client's fields, oldest first — one
// table row per date, matching the running-log layout in the admin panel.
export function listMeasurementDates(clientId: number): string[] {
  const dates = [
    ...new Set(getData().measurement_values.filter((v) => v.client_id === clientId).map((v) => v.date)),
  ];
  return dates.sort((a, b) => (a < b ? -1 : 1));
}

export function removeMeasurementCheckIn(clientId: number, date: string) {
  const data = getData();
  data.measurement_values = data.measurement_values.filter(
    (v) => !(v.client_id === clientId && v.date === date)
  );
  persist();
}

export type MeasurementChange = {
  first: number;
  last: number;
  firstDate: string;
  lastDate: string;
  delta: number;
  pct: number | null;
};

// First-to-latest change for each field, computed from the earliest and most
// recent dated value that field actually has (a gap in one column doesn't
// break the trend for the others).
export function getMeasurementChangeSummary(clientId: number): Record<number, MeasurementChange> {
  const fields = listMeasurementFields(clientId);
  const values = getMeasurementValues(fields.map((f) => f.id));

  const result: Record<number, MeasurementChange> = {};
  fields.forEach((field) => {
    const withValue = values
      .filter((v) => v.field_id === field.id && v.value != null)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (withValue.length < 2) return;
    const firstEntry = withValue[0];
    const lastEntry = withValue[withValue.length - 1];
    const first = firstEntry.value as number;
    const last = lastEntry.value as number;
    const delta = Math.round((last - first) * 100) / 100;
    const pct = first !== 0 ? Math.round((delta / first) * 1000) / 10 : null;
    result[field.id] = { first, last, firstDate: firstEntry.date, lastDate: lastEntry.date, delta, pct };
  });
  return result;
}

export type WeeklyMeasurementSummary = {
  weekStart: string;
  averages: Record<number, number | null>;
  entryCount: number;
};

// Weekly average per field, grouped Mon–Sun, computed live from whatever
// dates are actually entered rather than assuming every week gets filled in.
export function getWeeklyMeasurementSummary(clientId: number): WeeklyMeasurementSummary[] {
  const fields = listMeasurementFields(clientId);
  const values = getMeasurementValues(fields.map((f) => f.id));
  const dateSet = new Set(values.map((v) => v.date));

  const byWeek = new Map<string, { sums: Record<number, number>; counts: Record<number, number>; dates: Set<string> }>();

  values.forEach((v) => {
    if (v.value == null) return;
    const wk = weekStart(v.date);
    const bucket = byWeek.get(wk) ?? { sums: {}, counts: {}, dates: new Set() };
    bucket.sums[v.field_id] = (bucket.sums[v.field_id] ?? 0) + v.value;
    bucket.counts[v.field_id] = (bucket.counts[v.field_id] ?? 0) + 1;
    bucket.dates.add(v.date);
    byWeek.set(wk, bucket);
  });

  // Also register weeks that have dates but only null values, so entry
  // counts stay accurate even if every field was left blank that week.
  dateSet.forEach((d) => {
    const wk = weekStart(d);
    if (!byWeek.has(wk)) byWeek.set(wk, { sums: {}, counts: {}, dates: new Set([d]) });
    else byWeek.get(wk)!.dates.add(d);
  });

  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([start, b]) => {
      const averages: Record<number, number | null> = {};
      fields.forEach((f) => {
        averages[f.id] = b.counts[f.id] ? Math.round((b.sums[f.id] / b.counts[f.id]) * 10) / 10 : null;
      });
      return { weekStart: start, averages, entryCount: b.dates.size };
    });
}

export function listSkinfoldEntries(clientId: number): SkinfoldEntry[] {
  return getData()
    .skinfold_entries.filter((s) => s.client_id === clientId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function addSkinfoldEntry(
  clientId: number,
  date: string,
  site: string,
  readingMm: number | null
) {
  const data = getData();
  data.skinfold_entries.push({
    id: allocId("skinfold_entries"),
    client_id: clientId,
    date,
    site,
    reading_mm: readingMm,
  });
  persist();
}

export function removeSkinfoldEntry(id: number) {
  const data = getData();
  data.skinfold_entries = data.skinfold_entries.filter((s) => s.id !== id);
  persist();
}

// Monday of the week containing this date, as YYYY-MM-DD.
export function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

// ---- Trackers: coach-defined daily/weekly check-in metrics ----
// Deliberately not a fixed question list — the coach builds whatever set of
// metrics is relevant for this specific client (sleep hours, water in
// liters, steps, a 1-5 energy rating, anything), each with its own unit.
// Daily Tracker and Weekly Tracker are the same mechanism at a different
// frequency, distinguished only by which metrics a coach put in each.

export type MetricDefinition = {
  id: number;
  client_id: number;
  category: string;
  name: string;
  unit: string;
  frequency: "daily" | "weekly";
  order_index: number;
};
export type MetricEntry = {
  id: number;
  metric_definition_id: number;
  period: string;
  value: number | null;
};

export function listMetricDefinitions(
  clientId: number,
  frequency: "daily" | "weekly"
): MetricDefinition[] {
  return getData()
    .metric_definitions.filter((m) => m.client_id === clientId && m.frequency === frequency)
    .sort((a, b) => a.order_index - b.order_index);
}

export function addMetricDefinition(
  clientId: number,
  category: string,
  name: string,
  unit: string,
  frequency: "daily" | "weekly"
) {
  const data = getData();
  const count = data.metric_definitions.filter(
    (m) => m.client_id === clientId && m.frequency === frequency
  ).length;
  data.metric_definitions.push({
    id: allocId("metric_definitions"),
    client_id: clientId,
    category: category || "General",
    name,
    unit,
    frequency,
    order_index: count,
  });
  persist();
}

export function updateMetricDefinition(id: number, category: string, name: string, unit: string) {
  const data = getData();
  const def = data.metric_definitions.find((m) => m.id === id);
  if (def) {
    def.category = category || "General";
    def.name = name;
    def.unit = unit;
    persist();
  }
}

export function removeMetricDefinition(id: number) {
  const data = getData();
  data.metric_definitions = data.metric_definitions.filter((m) => m.id !== id);
  data.metric_entries = data.metric_entries.filter((e) => e.metric_definition_id !== id);
  persist();
}

// Distinct category/name values already in use ACROSS ALL CLIENTS (plus any
// coach-saved template categories/items), so the "Add a metric" form can
// offer a dropdown of things already set up elsewhere instead of the coach
// retyping "Sleep" or "Stress" from scratch for every new client. The coach
// can still type a brand-new value — this only supplies suggestions.
export function listDistinctMetricCategories(frequency: "daily" | "weekly"): string[] {
  const data = getData();
  const fromDefs = data.metric_definitions.filter((d) => d.frequency === frequency).map((d) => d.category);
  const fromTemplates = data.metric_template_categories.filter((t) => t.frequency === frequency).map((t) => t.name);
  return [...new Set([...fromDefs, ...fromTemplates])].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function listDistinctMetricNames(frequency: "daily" | "weekly"): { name: string; unit: string }[] {
  const data = getData();
  const seen = new Map<string, string>();
  data.metric_definitions
    .filter((d) => d.frequency === frequency)
    .forEach((d) => {
      if (!seen.has(d.name)) seen.set(d.name, d.unit);
    });
  data.metric_template_items.forEach((item) => {
    const cat = data.metric_template_categories.find((c) => c.id === item.template_category_id);
    if (cat && cat.frequency === frequency && !seen.has(item.name)) seen.set(item.name, item.unit);
  });
  return [...seen.entries()]
    .map(([name, unit]) => ({ name, unit }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Same idea for Measurement check-in columns (Weight, Waist, Body fat %,
// etc.) — these don't have a "category", just a name + unit, so one
// dropdown of names already used across every client is enough.
export function listDistinctMeasurementFieldNames(): { name: string; unit: string }[] {
  const data = getData();
  const seen = new Map<string, string>();
  data.measurement_fields.forEach((f) => {
    if (!seen.has(f.name)) seen.set(f.name, f.unit);
  });
  return [...seen.entries()]
    .map(([name, unit]) => ({ name, unit }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Tracker metric templates ----
// Coach-level presets, not tied to any one client: build a category + its
// metrics once (e.g. "Stress": Work stress, Private stress, Social stress),
// then apply the whole bundle to a client's Daily/Weekly Tracker in one
// click instead of retyping the same set from zero for every new client.

export type MetricTemplateCategory = {
  id: number;
  name: string;
  frequency: "daily" | "weekly";
  order_index: number;
};
export type MetricTemplateItem = {
  id: number;
  template_category_id: number;
  name: string;
  unit: string;
  order_index: number;
};

export function listMetricTemplateCategories(frequency?: "daily" | "weekly"): MetricTemplateCategory[] {
  return getData()
    .metric_template_categories.filter((t) => !frequency || t.frequency === frequency)
    .sort((a, b) => a.order_index - b.order_index);
}

export function listMetricTemplateItems(templateCategoryId: number): MetricTemplateItem[] {
  return getData()
    .metric_template_items.filter((i) => i.template_category_id === templateCategoryId)
    .sort((a, b) => a.order_index - b.order_index);
}

export function addMetricTemplateCategory(name: string, frequency: "daily" | "weekly") {
  const data = getData();
  const count = data.metric_template_categories.filter((t) => t.frequency === frequency).length;
  const id = allocId("metric_template_categories");
  data.metric_template_categories.push({ id, name, frequency, order_index: count });
  persist();
  return id;
}

export function removeMetricTemplateCategory(id: number) {
  const data = getData();
  data.metric_template_categories = data.metric_template_categories.filter((t) => t.id !== id);
  data.metric_template_items = data.metric_template_items.filter((i) => i.template_category_id !== id);
  persist();
}

export function addMetricTemplateItem(templateCategoryId: number, name: string, unit: string) {
  const data = getData();
  const count = data.metric_template_items.filter((i) => i.template_category_id === templateCategoryId).length;
  data.metric_template_items.push({
    id: allocId("metric_template_items"),
    template_category_id: templateCategoryId,
    name,
    unit,
    order_index: count,
  });
  persist();
}

export function removeMetricTemplateItem(id: number) {
  const data = getData();
  data.metric_template_items = data.metric_template_items.filter((i) => i.id !== id);
  persist();
}

// Applies every item in a template category to one client at once — adds
// each as a real MetricDefinition under that same category name, skipping
// any metric the client already has by (category, name) so re-applying a
// template (e.g. after adding one more item to it) doesn't create dupes.
export function applyMetricTemplateToClient(clientId: number, templateCategoryId: number) {
  const data = getData();
  const template = data.metric_template_categories.find((t) => t.id === templateCategoryId);
  if (!template) return;
  const items = listMetricTemplateItems(templateCategoryId);
  const existing = listMetricDefinitions(clientId, template.frequency);
  items.forEach((item) => {
    const already = existing.some(
      (d) => d.category === template.name && d.name === item.name
    );
    if (already) return;
    addMetricDefinition(clientId, template.name, item.name, item.unit, template.frequency);
  });
}

// Upsert: logging the same metric for the same period again overwrites the
// value rather than creating a duplicate row.
export function setMetricEntry(metricDefinitionId: number, period: string, value: number | null) {
  const data = getData();
  const existing = data.metric_entries.find(
    (e) => e.metric_definition_id === metricDefinitionId && e.period === period
  );
  if (existing) {
    existing.value = value;
  } else {
    data.metric_entries.push({
      id: allocId("metric_entries"),
      metric_definition_id: metricDefinitionId,
      period,
      value,
    });
  }
  persist();
}

export function getMetricEntries(metricDefinitionIds: number[]): MetricEntry[] {
  const idSet = new Set(metricDefinitionIds);
  return getData().metric_entries.filter((e) => idSet.has(e.metric_definition_id));
}

// All distinct periods logged across a set of metrics, most recent first.
// Oldest-first (left-to-right chronological) so the Overview table reads
// like a spreadsheet the coach scrolls forward through, with the metric
// names frozen on the left as more weeks/days accumulate — the whole point
// of that frozen column is to not have to cap history at a handful of
// periods, so this returns everything by default.
export function listMetricPeriods(metricDefinitionIds: number[], limit = 500): string[] {
  const entries = getMetricEntries(metricDefinitionIds);
  const periods = [...new Set(entries.map((e) => e.period))];
  return periods.sort((a, b) => (a < b ? -1 : 1)).slice(-limit);
}

// ---- Progress pictures: coach-defined photo slots ----
// The coach names whatever angles/shots they want (Front, Back, Side, Profile
// 1, anything) — not a fixed set. The client uploads one photo per slot per
// week; uploading again the same week replaces that week's photo.

export type PhotoSlot = { id: number; client_id: number; label: string; order_index: number };
export type PhotoUpload = {
  id: number;
  slot_id: number;
  period: string;
  file_path: string;
  uploaded_at: string;
};

export type PhotoCadence = "weekly" | "biweekly" | "monthly";

export const PHOTO_CADENCE_LABELS: Record<PhotoCadence, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};

// A fixed reference Monday, used only to keep biweekly bucket boundaries
// stable and consistent for every client — otherwise "every 2 weeks" would
// depend on which week a given client's data happened to start on.
const PHOTO_BIWEEKLY_EPOCH = "2024-01-01";

export function getPhotoCadence(clientId: number): PhotoCadence {
  return getData().photo_settings.find((s) => s.client_id === clientId)?.cadence ?? "weekly";
}

export function setPhotoCadence(clientId: number, cadence: PhotoCadence) {
  const data = getData();
  const existing = data.photo_settings.find((s) => s.client_id === clientId);
  if (existing) existing.cadence = cadence;
  else data.photo_settings.push({ client_id: clientId, cadence });
  persist();
}

// Which "sheet" a given calendar date belongs to, based on the cadence the
// coach picked for this client. Weekly = the same Monday-bucket the rest of
// the app already uses. Monthly = the 1st of the month. Biweekly pairs ISO
// weeks two at a time against a fixed epoch Monday, using local-midnight
// Date math the same way weekStart()/getTimeToGoal() already do elsewhere
// in this file — deliberately not UTC, to avoid the exact date-shifting bug
// localDateStr() was introduced to fix.
export function photoPeriodFor(dateStr: string, cadence: PhotoCadence): string {
  if (cadence === "monthly") return `${dateStr.slice(0, 7)}-01`;
  const monday = weekStart(dateStr);
  if (cadence === "weekly") return monday;
  const epoch = new Date(`${PHOTO_BIWEEKLY_EPOCH}T00:00:00`);
  const cur = new Date(`${monday}T00:00:00`);
  const weeksSinceEpoch = Math.round((cur.getTime() - epoch.getTime()) / (7 * 86400000));
  const bucketWeeks = weeksSinceEpoch - (((weeksSinceEpoch % 2) + 2) % 2);
  const bucketDate = new Date(epoch.getTime() + bucketWeeks * 7 * 86400000);
  return localDateStr(bucketDate);
}

export function listPhotoSlots(clientId: number): PhotoSlot[] {
  return getData()
    .photo_slots.filter((s) => s.client_id === clientId)
    .sort((a, b) => a.order_index - b.order_index);
}

export function addPhotoSlot(clientId: number, label: string) {
  const data = getData();
  const count = data.photo_slots.filter((s) => s.client_id === clientId).length;
  data.photo_slots.push({
    id: allocId("photo_slots"),
    client_id: clientId,
    label,
    order_index: count,
  });
  persist();
}

export function updatePhotoSlot(id: number, label: string) {
  const data = getData();
  const slot = data.photo_slots.find((s) => s.id === id);
  if (slot) {
    slot.label = label;
    persist();
  }
}

export function removePhotoSlot(id: number) {
  const data = getData();
  data.photo_slots = data.photo_slots.filter((s) => s.id !== id);
  data.photo_uploads = data.photo_uploads.filter((u) => u.slot_id !== id);
  persist();
}

export function listPhotoUploads(slotIds: number[]): PhotoUpload[] {
  const idSet = new Set(slotIds);
  return getData().photo_uploads.filter((u) => idSet.has(u.slot_id));
}

// Newest-first, uncapped by default — like the Tracker Overview and
// Measurements check-ins tables, there's no reason to hide history once
// there's more than a handful of periods. Each period now renders as its
// own collapsed row, so a long history costs almost no vertical space until
// the coach actually opens one.
export function listPhotoPeriods(slotIds: number[], limit = 500): string[] {
  const periods = [...new Set(listPhotoUploads(slotIds).map((u) => u.period))];
  return periods.sort((a, b) => (a < b ? 1 : -1)).slice(0, limit);
}

// 1-based position of each period in chronological order (oldest = 1), for
// labeling rows "Week 1", "Week 2", etc. regardless of which slice of
// history is currently being displayed.
export function photoPeriodIndex(slotIds: number[]): Record<string, number> {
  const periods = [...new Set(listPhotoUploads(slotIds).map((u) => u.period))].sort((a, b) =>
    a < b ? -1 : 1
  );
  const index: Record<string, number> = {};
  periods.forEach((p, i) => {
    index[p] = i + 1;
  });
  return index;
}

export type PhotoPeriodNote = {
  client_id: number;
  period: string;
  shape: string;
  strengths: string;
  improvements: string;
  next_steps: string;
};

export function getPhotoPeriodNote(clientId: number, period: string): PhotoPeriodNote {
  const existing = getData().photo_period_notes.find((n) => n.client_id === clientId && n.period === period);
  if (existing) return existing;
  return { client_id: clientId, period, shape: "", strengths: "", improvements: "", next_steps: "" };
}

export function savePhotoPeriodNote(note: PhotoPeriodNote) {
  const data = getData();
  const idx = data.photo_period_notes.findIndex(
    (n) => n.client_id === note.client_id && n.period === note.period
  );
  if (idx >= 0) data.photo_period_notes[idx] = note;
  else data.photo_period_notes.push(note);
  persist();
}

// Writes the uploaded file under DATA_DIR/uploads and records it — this is
// the only place in the app that touches the filesystem outside db.ts, since
// it deals with actual image bytes rather than JSON data. Served back out by
// the app/uploads/[...path] route handler rather than Next's static /public
// serving, since DATA_DIR (a mounted volume in production) lives outside it.
export function savePhotoUpload(clientId: number, slotId: number, buffer: Buffer, mimeType: string): string {
  const period = photoPeriodFor(localDateStr(), getPhotoCadence(clientId));
  const ext = (mimeType.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const dir = path.join(DATA_DIR, "uploads", "progress", String(clientId), String(slotId));
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${period}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  const publicPath = `/uploads/progress/${clientId}/${slotId}/${filename}`;

  const data = getData();
  const existing = data.photo_uploads.find((u) => u.slot_id === slotId && u.period === period);
  if (existing) {
    existing.file_path = publicPath;
    existing.uploaded_at = new Date().toISOString();
  } else {
    data.photo_uploads.push({
      id: allocId("photo_uploads"),
      slot_id: slotId,
      period,
      file_path: publicPath,
      uploaded_at: new Date().toISOString(),
    });
  }
  persist();
  return publicPath;
}

// Real data: daily training "volume" (sum of weight x reps across logged sets)
// as a first-pass stand-in for a strength trend, until a real formula is defined.
export function getStrengthSeries(clientId: number, days: number) {
  const data = getData();
  const assignmentIds = new Set(
    data.workout_assignments
      .filter((wa) => {
        const day = data.program_days.find((pd) => pd.id === wa.program_day_id);
        return day?.client_id === clientId;
      })
      .map((wa) => wa.id)
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const byDate = new Map<string, number>();

  data.set_logs
    .filter((sl) => assignmentIds.has(sl.workout_assignment_id))
    .filter((sl) => new Date(sl.logged_at) >= cutoff)
    .forEach((sl) => {
      const date = sl.logged_at.slice(0, 10);
      const volume = (sl.weight_kg ?? 0) * (sl.reps ?? 0);
      byDate.set(date, (byDate.get(date) ?? 0) + volume);
    });

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, value }));
}

// ---- Start Page: the coach's "Startpagina" tab ----
// Member info, coaching info, and short/long-term goals. Nutrition goals and
// activity goals live here too, but nutrition figures are pulled live from
// the real Nutrition tab rather than duplicated as separate editable fields
// (the original spreadsheet had a broken cross-tab formula there — this
// avoids that class of bug entirely by computing from the same source).

// Client's logged Weight column from Measurements, as a date/value series —
// same "find the weight column by name" approach as getLatestWeight, since
// coaches can rename/remove columns and there's no fixed schema to rely on.
export function getWeightSeries(clientId: number, days: number) {
  const fields = listMeasurementFields(clientId);
  const weightField = fields.find((f) => f.name.toLowerCase().includes("weight"));
  if (!weightField) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return getMeasurementValues([weightField.id])
    .filter((v) => v.value != null && new Date(v.date) >= cutoff)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((v) => ({ date: v.date, value: v.value as number }));
}

export type ClientProfile = {
  client_id: number;
  birthdate: string | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
  coaching_start_date: string | null;
  current_week: string;
  goal_phase: string;
  goal_date: string | null;
  check_in_day: string | null;
  steps_goal: string;
  cardio_goal: string;
  training_goal: string;
  water_goal: string;
};

export const CHECK_IN_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function getClientProfile(clientId: number): ClientProfile {
  const existing = getData().client_profiles.find((p) => p.client_id === clientId);
  if (existing) return existing;
  return {
    client_id: clientId,
    birthdate: null,
    height_cm: null,
    starting_weight_kg: null,
    coaching_start_date: null,
    current_week: "",
    goal_phase: "",
    goal_date: null,
    check_in_day: null,
    steps_goal: "",
    cardio_goal: "",
    training_goal: "",
    water_goal: "",
  };
}

export function saveClientProfile(profile: ClientProfile) {
  const data = getData();
  const idx = data.client_profiles.findIndex((p) => p.client_id === profile.client_id);
  if (idx >= 0) data.client_profiles[idx] = profile;
  else data.client_profiles.push(profile);
  persist();
}

// Days between today and the profile's goal date — computed live rather than
// a manually-typed field, so it can't go stale.
export function getTimeToGoal(profile: ClientProfile): string | null {
  if (!profile.goal_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const goal = new Date(`${profile.goal_date}T00:00:00`);
  const days = Math.round((goal.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Today";
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  if (weeks === 0) return `${days} day${days === 1 ? "" : "s"}`;
  return `${weeks} week${weeks === 1 ? "" : "s"}${remDays ? ` ${remDays}d` : ""}`;
}

// The client's most recent logged weight from Measurements, so "current
// weight" on the Start Page always matches what they've actually checked in.
export function getLatestWeight(clientId: number): number | null {
  const fields = listMeasurementFields(clientId);
  const weightField = fields.find((f) => f.name.toLowerCase().includes("weight"));
  if (!weightField) return null;
  const values = getMeasurementValues([weightField.id])
    .filter((v) => v.value != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = values.length > 0 ? values[values.length - 1].value : null;
  // Round away float noise (e.g. 71.2 - 0.4 === 70.79999999999999) so the UI
  // never shows a raw binary-floating-point artifact.
  return latest != null ? Math.round(latest * 10) / 10 : null;
}

export type ClientGoal = {
  id: number;
  client_id: number;
  term: "short" | "long";
  text: string;
  done: boolean;
  order_index: number;
};

export function listClientGoals(clientId: number, term: "short" | "long"): ClientGoal[] {
  return getData()
    .client_goals.filter((g) => g.client_id === clientId && g.term === term)
    .sort((a, b) => a.order_index - b.order_index);
}

export function addClientGoal(clientId: number, term: "short" | "long", text: string) {
  const data = getData();
  const count = data.client_goals.filter((g) => g.client_id === clientId && g.term === term).length;
  data.client_goals.push({
    id: allocId("client_goals"),
    client_id: clientId,
    term,
    text,
    done: false,
    order_index: count,
  });
  persist();
}

export function setClientGoalDone(id: number, done: boolean) {
  const data = getData();
  const goal = data.client_goals.find((g) => g.id === id);
  if (goal) {
    goal.done = done;
    persist();
  }
}

export function removeClientGoal(id: number) {
  const data = getData();
  data.client_goals = data.client_goals.filter((g) => g.id !== id);
  persist();
}

// Live nutrition-goal figures, pulled straight from the real Nutrition plan
// rather than a separately-entered value.
export type NutritionGoalsSummary = {
  trainingKcal: number;
  restKcal: number;
  trainingProtein: number;
  trainingCarbs: number;
  trainingFats: number;
  restProtein: number;
  restCarbs: number;
  restFats: number;
};

export function getNutritionGoalsSummary(clientId: number): NutritionGoalsSummary {
  const plan = getNutritionPlan(clientId);
  const kcal = (m: MealMacros) => (m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fats ?? 0) * 9;
  const sum = (meals: MealMacros[], field: keyof MealMacros) =>
    meals.reduce((s, m) => s + (m[field] ?? 0), 0);

  return {
    trainingKcal: plan.training_day_meals.reduce((s, m) => s + kcal(m), 0),
    restKcal: plan.rest_day_meals.reduce((s, m) => s + kcal(m), 0),
    trainingProtein: sum(plan.training_day_meals, "protein"),
    trainingCarbs: sum(plan.training_day_meals, "carbs"),
    trainingFats: sum(plan.training_day_meals, "fats"),
    restProtein: sum(plan.rest_day_meals, "protein"),
    restCarbs: sum(plan.rest_day_meals, "carbs"),
    restFats: sum(plan.rest_day_meals, "fats"),
  };
}

// ---- Meetings: coach-scheduled check-in calls ----
// Each meeting has its own running notes log, added to over time rather than
// a single notes field, so a coach can jot something down before, during,
// and after the call without overwriting what was there.

export type Meeting = {
  id: number;
  client_id: number;
  date: string;
  time: string;
  duration_minutes: number;
  topic: string;
  status: "scheduled" | "completed" | "canceled";
};
export type MeetingNote = {
  id: number;
  meeting_id: number;
  text: string;
  created_at: string;
};

export const DEFAULT_MEETING_DURATION = 60;

export function listMeetings(clientId: number): Meeting[] {
  return getData()
    .meetings.filter((m) => m.client_id === clientId)
    .map((m) => ({ ...m, duration_minutes: m.duration_minutes || DEFAULT_MEETING_DURATION }))
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? 1 : -1) : a.date < b.date ? 1 : -1));
}

export function addMeeting(
  clientId: number,
  date: string,
  time: string,
  topic: string,
  durationMinutes: number = DEFAULT_MEETING_DURATION
) {
  const data = getData();
  data.meetings.push({
    id: allocId("meetings"),
    client_id: clientId,
    date,
    time,
    duration_minutes: durationMinutes || DEFAULT_MEETING_DURATION,
    topic,
    status: "scheduled",
  });
  persist();
}

export function setMeetingStatus(id: number, status: Meeting["status"]) {
  const data = getData();
  const meeting = data.meetings.find((m) => m.id === id);
  if (meeting) {
    meeting.status = status;
    persist();
  }
}

export function removeMeeting(id: number) {
  const data = getData();
  data.meetings = data.meetings.filter((m) => m.id !== id);
  data.meeting_notes = data.meeting_notes.filter((n) => n.meeting_id !== id);
  persist();
}

export function listMeetingNotes(meetingId: number): MeetingNote[] {
  return getData()
    .meeting_notes.filter((n) => n.meeting_id === meetingId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function addMeetingNote(meetingId: number, text: string) {
  const data = getData();
  data.meeting_notes.push({
    id: allocId("meeting_notes"),
    meeting_id: meetingId,
    text,
    created_at: new Date().toISOString().replace("T", " ").slice(0, 16),
  });
  persist();
}

export function removeMeetingNote(id: number) {
  const data = getData();
  data.meeting_notes = data.meeting_notes.filter((n) => n.id !== id);
  persist();
}

// ---- Calendar: every client's meetings in one place, plus overlap checks ----
// The calendar never stores anything of its own — it's a read of the same
// `meetings` records the Meetings tab writes, joined with client names and
// checked against each other for double-bookings.

export type MeetingWithClient = Meeting & { clientName: string };

export function listAllMeetings(): MeetingWithClient[] {
  const data = getData();
  return data.meetings
    .map((m) => {
      const client = data.clients.find((c) => c.id === m.client_id);
      return {
        ...m,
        duration_minutes: m.duration_minutes || DEFAULT_MEETING_DURATION,
        clientName: client?.name ?? "Unknown client",
      };
    })
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1));
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((n) => Number(n) || 0);
  return h * 60 + m;
}

export type MeetingConflict = { a: MeetingWithClient; b: MeetingWithClient };

// Two scheduled meetings for two *different* clients conflict when their
// [time, time+duration) windows overlap on the same date. This is
// recomputed live off the real data every time it's read, so the coach
// always sees current conflicts — schedule, edit, or cancel a meeting and
// the warning appears or clears automatically, no separate notification
// state to keep in sync.
export function getMeetingConflicts(): MeetingConflict[] {
  const meetings = listAllMeetings().filter((m) => m.status === "scheduled" && m.time);
  const conflicts: MeetingConflict[] = [];
  for (let i = 0; i < meetings.length; i++) {
    for (let j = i + 1; j < meetings.length; j++) {
      const a = meetings[i];
      const b = meetings[j];
      if (a.date !== b.date || a.client_id === b.client_id) continue;
      const aStart = timeToMinutes(a.time);
      const aEnd = aStart + a.duration_minutes;
      const bStart = timeToMinutes(b.time);
      const bEnd = bStart + b.duration_minutes;
      if (aStart < bEnd && bStart < aEnd) conflicts.push({ a, b });
    }
  }
  return conflicts;
}

export function getConflictsForClient(clientId: number): MeetingConflict[] {
  return getMeetingConflicts().filter((c) => c.a.client_id === clientId || c.b.client_id === clientId);
}

export type CalendarDay = { date: string; meetings: MeetingWithClient[] };

// Groups every upcoming (and recently past, for context) meeting by date so
// the calendar can render a simple day-by-day agenda without a full month
// grid — this is a coaching schedule, not a general calendar app, so an
// agenda list reads better than a grid full of empty days.
export function getUpcomingCalendarDays(daysBack = 7, daysForward = 60): CalendarDay[] {
  const all = listAllMeetings().filter((m) => m.status !== "canceled");
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - daysBack);
  const end = new Date(today);
  end.setDate(end.getDate() + daysForward);
  const startStr = localDateStr(start);
  const endStr = localDateStr(end);

  const byDate = new Map<string, MeetingWithClient[]>();
  all.forEach((m) => {
    if (m.date < startStr || m.date > endStr) return;
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date)!.push(m);
  });

  return Array.from(byDate.entries())
    .map(([date, meetings]) => ({
      date,
      meetings: meetings.sort((a, b) => (a.time < b.time ? -1 : 1)),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export type CalendarCell = { date: string; inMonth: boolean; isToday: boolean; meetings: MeetingWithClient[] };
export type CalendarMonth = {
  monthStr: string; // "YYYY-MM"
  label: string; // "August 2026"
  prevMonth: string;
  nextMonth: string;
  weeks: CalendarCell[][];
};

// Full month grid (Monday-start, matching the ISO-week convention the rest
// of the app already uses via weekStart()) — six rows of seven days so every
// month lays out the same height, with padding days from the neighboring
// months included (but dimmed) so the grid never has ragged edges.
export function getCalendarMonth(monthStr?: string): CalendarMonth {
  const now = new Date();
  const valid = monthStr && /^\d{4}-\d{2}$/.test(monthStr);
  const year = valid ? Number(monthStr!.slice(0, 4)) : now.getFullYear();
  const month = valid ? Number(monthStr!.slice(5, 7)) - 1 : now.getMonth();

  const first = new Date(year, month, 1);
  const label = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // Monday-start offset: getDay() is 0=Sun..6=Sat, we want 0=Mon..6=Sun.
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekday);

  const todayStr = localDateStr(now);
  const meetingsByDate = new Map<string, MeetingWithClient[]>();
  listAllMeetings()
    .filter((m) => m.status !== "canceled")
    .forEach((m) => {
      if (!meetingsByDate.has(m.date)) meetingsByDate.set(m.date, []);
      meetingsByDate.get(m.date)!.push(m);
    });

  const weeks: CalendarCell[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = localDateStr(cursor);
      week.push({
        date: dateStr,
        inMonth: cursor.getMonth() === month,
        isToday: dateStr === todayStr,
        meetings: (meetingsByDate.get(dateStr) ?? []).sort((a, b) => (a.time < b.time ? -1 : 1)),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return { monthStr: fmt(first), label, prevMonth: fmt(prev), nextMonth: fmt(next), weeks };
}

// ---- Start Page snapshot ----
// A one-glance pull from every other tab, so the Start Page works as a real
// dashboard rather than just a profile form. Each field is read straight
// from that tab's own data — nothing here is tracked separately, so it can
// never drift out of sync with the tab it summarizes.

export type ClientSnapshot = {
  training: { daysBuilt: number; published: boolean; totalSetsLogged: number; lastActive: string | null };
  nutrition: { trainingKcal: number; restKcal: number; maintenanceKcal: number | null };
  measurements: { currentWeight: number | null; weightChange: MeasurementChange | null };
  photos: { uploadedThisWeek: number; totalSlots: number };
  dailyTracker: { metricCount: number; lastLogged: string | null };
  weeklyTracker: { metricCount: number; lastLogged: string | null };
  meetings: { next: Meeting | null };
  invoices: { outstanding: number; openCount: number };
};

// ---- Chat: a plain message thread between one client and their coach ----

export type ChatMessage = {
  id: number;
  client_id: number;
  sender: "client" | "coach";
  text: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
  created_at: string;
};

export function listChatMessages(clientId: number): ChatMessage[] {
  return getData()
    .chat_messages.filter((m) => m.client_id === clientId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id));
}

export function sendChatMessage(
  clientId: number,
  sender: "client" | "coach",
  text: string,
  media?: { path: string; type: "image" | "video" }
) {
  const data = getData();
  data.chat_messages.push({
    id: allocId("chat_messages"),
    client_id: clientId,
    sender,
    text,
    media_path: media?.path ?? null,
    media_type: media?.type ?? null,
    created_at: new Date().toISOString(),
  });
  persist();
}

// ---- Coach activity log: "last update from your coach" on client Home ----
export function logCoachActivity(clientId: number, message: string) {
  const data = getData();
  data.coach_activity.push({
    id: allocId("coach_activity"),
    client_id: clientId,
    message,
    created_at: new Date().toISOString(),
  });
  persist();
}

export function getLatestCoachActivity(clientId: number) {
  const data = getData();
  const entries = data.coach_activity.filter((a) => a.client_id === clientId);
  if (entries.length === 0) return null;
  return entries.reduce((latest, e) => (e.created_at > latest.created_at ? e : latest));
}

// Chat attachments: same "write to DATA_DIR/uploads, store the public path"
// pattern as savePhotoUpload — one file per message, kept under its own
// client-scoped folder so nothing collides across clients.
export function saveChatMedia(clientId: number, buffer: Buffer, mimeType: string): { path: string; type: "image" | "video" } {
  const type: "image" | "video" = mimeType.startsWith("video/") ? "video" : "image";
  const ext = (mimeType.split("/")[1] || (type === "video" ? "mp4" : "jpg")).replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const dir = path.join(DATA_DIR, "uploads", "chat", String(clientId));
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${allocId("chat_media")}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return { path: `/uploads/chat/${clientId}/${filename}`, type };
}

export function getClientSnapshot(clientId: number): ClientSnapshot {
  const summary = getClientSummary(clientId);
  const nutrition = getNutritionGoalsSummary(clientId);
  const plan = getNutritionPlan(clientId);

  const measurementFields = listMeasurementFields(clientId);
  const weightField = measurementFields.find((f) => f.name.toLowerCase().includes("weight"));
  const change = getMeasurementChangeSummary(clientId);

  const photoSlots = listPhotoSlots(clientId);
  const photoUploads = listPhotoUploads(photoSlots.map((s) => s.id));
  const currentWeek = weekStart(localDateStr());
  const uploadedThisWeek = photoUploads.filter((u) => u.period === currentWeek).length;

  const dailyDefs = listMetricDefinitions(clientId, "daily");
  const weeklyDefs = listMetricDefinitions(clientId, "weekly");
  const dailyPeriods = listMetricPeriods(dailyDefs.map((d) => d.id), 1);
  const weeklyPeriods = listMetricPeriods(weeklyDefs.map((d) => d.id), 1);

  const upcomingMeetings = listMeetings(clientId)
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1));
  const today = localDateStr();
  const next = upcomingMeetings.find((m) => m.date >= today) ?? null;

  const invoices = listInvoices(clientId);
  const openInvoices = invoices.filter((i) => i.status !== "paid");

  return {
    training: {
      daysBuilt: summary.trainingDaysBuilt,
      published: summary.programPublished,
      totalSetsLogged: summary.totalSetsLogged,
      lastActive: summary.lastActive,
    },
    nutrition: {
      trainingKcal: nutrition.trainingKcal,
      restKcal: nutrition.restKcal,
      maintenanceKcal: plan.maintenance_kcal,
    },
    measurements: {
      currentWeight: getLatestWeight(clientId),
      weightChange: weightField ? change[weightField.id] ?? null : null,
    },
    photos: {
      uploadedThisWeek,
      totalSlots: photoSlots.length,
    },
    dailyTracker: {
      metricCount: dailyDefs.length,
      lastLogged: dailyPeriods[0] ?? null,
    },
    weeklyTracker: {
      metricCount: weeklyDefs.length,
      lastLogged: weeklyPeriods[0] ?? null,
    },
    meetings: { next },
    invoices: {
      outstanding: openInvoices.reduce((s, i) => s + i.amount, 0),
      openCount: openInvoices.length,
    },
  };
}
