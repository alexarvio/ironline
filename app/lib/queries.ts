import fs from "fs";
import path from "path";
import { allocId, DATA_DIR, DAY_NAMES_FULL, getData, persist, CardioEntry } from "./db";
import type { CalorieLog, CheckInNote, CustomFood, FoodDay, FoodEntry, FoodMealSlot, OffFood, SavedDay, SavedMeal, ClientGym, ClientPhase, CoachProfile, PhaseTrack } from "./db";
import type { CoachProfileFields, CoachProfileView } from "./coachProfileView";
import { getCatalogFood, searchCatalog, type CatalogFood } from "./foods/catalog";
import type { OffProduct } from "./foods/openfoodfacts";
import { coachIdOfClient } from "./tenancy";
import { LOCK_MS, type LockScope } from "./loginLockout";

// "Today" (or any Date) as a local YYYY-MM-DD calendar-date string. This is
// deliberately NOT `date.toISOString().slice(0, 10)` — toISOString always
// converts to UTC first, which silently shifts the date backward by one day
// for anyone in a positive UTC-offset timezone (most of Asia/Oceania) during
// part of their local day. That bug used to be scattered across this file
// and several components (each with its own toISOString-based todayStr()),
// producing wrong week-bucket labels and off-by-one check-in/meeting dates.
// Use this everywhere a *calendar date* (not a precise instant) is needed.
/** "YYYY-MM-DD HH:MM:SS" in server-local time, matching localDateStr(). */
export function localStamp(d: Date = new Date()): string {
  const t = (n: number) => String(n).padStart(2, "0");
  return `${localDateStr(d)} ${t(d.getHours())}:${t(d.getMinutes())}:${t(d.getSeconds())}`;
}

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type Exercise = { id: number; name: string; muscle_tags: string | null; video_url: string | null; coach_id?: number };
export type ProgramDay = {
  id: number;
  client_id: number;
  week_number: number;
  day_of_week: number;
  label: string | null;
  status: "draft" | "published";
  is_rest?: boolean;
  skip_reason?: string;
  skip_reason_at?: string;
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
  distance?: string | null;
  time?: string | null;
  notes: string | null;
  demo_url: string | null;
  note_kind: ExerciseNoteKind | null;
  note_at: string | null;
  note_read: boolean;
  target_set_at?: string | null;
  gym_targets?: Record<string, { kg: number | null; set_at?: string | null }>;
  warmup_sets?: { weight_kg: number | null; reps: number | null }[];
  exercise_name?: string;
  exercise_video_url?: string | null;
};

// What a coach's note on an exercise is *about*. Shown as the panel's header
// on the client so a load instruction doesn't read like a technique
// correction. Kept to three because the coach picks one every time they
// write a note — a longer list would just slow that down.
export type ExerciseNoteKind = "form" | "load" | "tempo";

export const EXERCISE_NOTE_KINDS: { value: ExerciseNoteKind; label: string; hint: string }[] = [
  { value: "form", label: "Form", hint: "Technique or posture, usually off a video" },
  { value: "load", label: "Load", hint: "Weight or intensity instruction" },
  { value: "tempo", label: "Tempo", hint: "Speed of the rep" },
];
export type SetLog = {
  id: number;
  workout_assignment_id: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe_actual: number | null;
  logged_at: string;
  gym_id?: number | null;
};

export type MealMacros = { protein: number | null; fats: number | null; carbs: number | null };
export type NutritionPlan = {
  client_id: number;
  name?: string | null;
  maintenance_kcal: number | null;
  ebf: number | null;
  training_day_meals: MealMacros[];
  rest_day_meals: MealMacros[];
  vitamins: Record<string, { quantity: string; timing: string }>;
  other: Record<string, { amount: string; timing: string }>;
  supplements: Record<string, { quantity: string; timing: string }>;
  coach_notes: string;

  // ---- Day-level targets (the current model) ----
  // The coach sets one set of macros per day type and the kcal is derived,
  // rather than filling in six meals. The meal arrays above are kept so
  // existing plans still read, but nothing writes them any more; the summary
  // prefers these whenever they're set.
  day_targets?: {
    training: { protein: number | null; carbs: number | null; fats: number | null };
    rest: { protein: number | null; carbs: number | null; fats: number | null };
  } | null;
  // A stated goal, not a tracker — deliberately just a number.
  water_l?: number | null;
  // A reference list, not a checklist: no state, no ticking.
  supplement_rows?: { id: number; name: string; quantity: string; timing: string; notes: string }[];
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

// A coach account has an email but no name. The client's app calls them by
// the first word of it ("finlay.smith@…" → "Finlay"), as the coach rail does.
// What the client sees the coach called. The display name from the coach's
// profile ("Finlay Chedd") when they have set one; otherwise a name read off
// the login email, which is all a coach account carries.
export function getCoachDisplayName(clientId: number): string {
  const coachId = coachIdOfClient(clientId);
  const set = getData().coach_profiles.find((p) => p.coach_id === coachId)?.display_name?.trim();
  if (set) return set;
  const email = getData().users.find((u) => u.id === coachId && u.role === "coach")?.email ?? "";
  const words = (email.split("@")[0] ?? "").split(/[._-]+/).filter(Boolean);
  return words.length ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "Coach";
}

/** The first word of that: "Finlay", for lines like "A notification when Finlay sends you one". */
export function getCoachFirstName(clientId: number): string {
  return getCoachDisplayName(clientId).split(/\s+/)[0] || "Coach";
}

/** The coach's profile picture, if they have set one; shown beside their notes and messages. */
export function getCoachAvatarPath(clientId: number): string | null {
  const coachId = coachIdOfClient(clientId);
  return getData().coach_profiles.find((p) => p.coach_id === coachId)?.avatar_path ?? null;
}

/** The coach's login email: where the client's Help row writes to. */
export function getCoachEmail(clientId: number): string {
  const coachId = coachIdOfClient(clientId);
  return getData().users.find((u) => u.id === coachId && u.role === "coach")?.email ?? "";
}

/** One coach's clients, by name. Coaches never see each other's. */
export function listClients(coachId: number) {
  return getData()
    .clients.filter((c) => c.coach_id === coachId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// coachId is always set from the app. Seed scripts on a fresh store pass null
// when no coach exists yet; the first coach account claims those clients.
export function createClient(name: string, coachId: number | null) {
  const data = getData();
  const client = { id: allocId("clients"), name, ...(coachId != null ? { coach_id: coachId } : {}) };
  data.clients.push(client);
  persist();
  return client;
}

// Deletes a client and everything that hangs off them: programmes, logged
// sets, check-ins, measurements, photos, invoices, meetings, notes, reports,
// notifications, preferences and their login. Coach-level things (the
// exercise library, template packs, report templates) are untouched.
// Uploaded photo/video files stay on disk; nothing references them after this.
export function removeClient(clientId: number) {
  const data = getData();
  if (!data.clients.some((c) => c.id === clientId)) return;

  const dayIds = new Set(data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.id));
  const assignmentIds = new Set(
    data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id)).map((wa) => wa.id)
  );
  const metricIds = new Set(data.metric_definitions.filter((m) => m.client_id === clientId).map((m) => m.id));
  const fieldIds = new Set(data.measurement_fields.filter((f) => f.client_id === clientId).map((f) => f.id));
  const slotIds = new Set(data.photo_slots.filter((s) => s.client_id === clientId).map((s) => s.id));
  const meetingIds = new Set(data.meetings.filter((m) => m.client_id === clientId).map((m) => m.id));

  data.set_logs = data.set_logs.filter((sl) => !assignmentIds.has(sl.workout_assignment_id));
  data.assignment_custom_values = data.assignment_custom_values.filter((v) => !assignmentIds.has(v.workout_assignment_id));
  data.workout_assignments = data.workout_assignments.filter((wa) => !assignmentIds.has(wa.id));
  data.program_days = data.program_days.filter((pd) => !dayIds.has(pd.id));
  data.training_programs = data.training_programs.filter((p) => p.client_id !== clientId);
  data.training_columns = data.training_columns.filter((c) => c.client_id !== clientId);

  data.metric_entries = data.metric_entries.filter((e) => !metricIds.has(e.metric_definition_id));
  data.metric_definitions = data.metric_definitions.filter((m) => m.client_id !== clientId);
  data.measurement_values = data.measurement_values.filter((v) => !fieldIds.has(v.field_id) && v.client_id !== clientId);
  data.measurement_fields = data.measurement_fields.filter((f) => f.client_id !== clientId);
  data.skinfold_entries = data.skinfold_entries.filter((s) => s.client_id !== clientId);

  data.photo_uploads = data.photo_uploads.filter((u) => !slotIds.has(u.slot_id));
  data.photo_slots = data.photo_slots.filter((s) => s.client_id !== clientId);
  data.photo_settings = data.photo_settings.filter((s) => s.client_id !== clientId);
  data.photo_period_notes = data.photo_period_notes.filter((n) => n.client_id !== clientId);

  data.meeting_notes = data.meeting_notes.filter((n) => !meetingIds.has(n.meeting_id));
  data.meetings = data.meetings.filter((m) => m.client_id !== clientId);
  data.invoices = data.invoices.filter((i) => i.client_id !== clientId);
  data.nutrition_plans = data.nutrition_plans.filter((p) => p.client_id !== clientId);
  data.client_profiles = data.client_profiles.filter((p) => p.client_id !== clientId);
  data.client_goals = data.client_goals.filter((g) => g.client_id !== clientId);
  data.client_preferences = data.client_preferences.filter((p) => p.client_id !== clientId);
  data.client_gyms = data.client_gyms.filter((g) => g.client_id !== clientId);
  data.client_reports = data.client_reports.filter((r) => r.client_id !== clientId);
  data.chat_messages = data.chat_messages.filter((m) => m.client_id !== clientId);
  data.coach_activity = data.coach_activity.filter((a) => a.client_id !== clientId);
  data.users = data.users.filter((u) => !(u.role === "client" && u.client_id === clientId));
  data.clients = data.clients.filter((c) => c.id !== clientId);
  persist();
}

export function renameClient(id: number, name: string) {
  const data = getData();
  const client = data.clients.find((c) => c.id === id);
  if (!client) return;
  client.name = name;
  persist();
}

// Write only the keys given, over whatever is already stored.
//
// The older saveClientProfile replaces the whole row, which is right for a
// form that renders every field and wrong for anything that doesn't: a partial
// form posting through it silently blanks the fields it never showed.
export function patchClientProfile(clientId: number, patch: Partial<ClientProfile>) {
  const current = getClientProfile(clientId);
  saveClientProfile({ ...current, ...patch, client_id: clientId });
}

/** One coach's own exercise library. */
export function listExercises(coachId: number): Exercise[] {
  return getData()
    .exercises.filter((e) => e.coach_id === coachId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Muscle-group catalog for the exercise picker — coaches browse by group
// first, then pick (or add) an exercise, instead of scanning one long list.
// Six broad groups, the way a coach thinks about a session, rather than one
// per muscle. Shoulders sit under Arms. "Other" is a catch-all for anything
// tagged outside these and is only shown when it has something in it.
export const MUSCLE_GROUPS = [
  { slug: "back", label: "Back" },
  { slug: "chest", label: "Chest" },
  { slug: "legs", label: "Legs" },
  { slug: "arms", label: "Arms" },
  { slug: "abs", label: "Abs" },
  { slug: "cardio", label: "Cardio" },
  { slug: "other", label: "Other" },
] as const;

// Older exercises were tagged per muscle ("quads,glutes", "lats"). Fold those
// into the six groups so the existing library files itself correctly.
const TAG_TO_GROUP: Record<string, string> = {
  back: "back",
  lats: "back",
  traps: "back",
  "rear delts": "back",
  chest: "chest",
  pecs: "chest",
  legs: "legs",
  quads: "legs",
  hamstrings: "legs",
  glutes: "legs",
  calves: "legs",
  adductors: "legs",
  abductors: "legs",
  arms: "arms",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  shoulders: "arms",
  delts: "arms",
  abs: "abs",
  core: "abs",
  obliques: "abs",
  cardio: "cardio",
  conditioning: "cardio",
};

function primaryGroup(exercise: Exercise): string {
  const first = (exercise.muscle_tags ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return TAG_TO_GROUP[first] ?? (MUSCLE_GROUPS.some((g) => g.slug === first) ? first : "other");
}

export function listExercisesByGroup(coachId: number): Record<string, Exercise[]> {
  const all = listExercises(coachId);
  const byGroup: Record<string, Exercise[]> = {};
  MUSCLE_GROUPS.forEach((g) => (byGroup[g.slug] = []));
  all.forEach((e) => byGroup[primaryGroup(e)].push(e));
  return byGroup;
}

export function addExercise(coachId: number, name: string, muscleGroup: string, videoUrl: string | null): Exercise {
  const data = getData();
  const group = MUSCLE_GROUPS.some((g) => g.slug === muscleGroup) ? muscleGroup : "other";
  const exercise: Exercise = {
    id: allocId("exercises"),
    name,
    muscle_tags: group,
    video_url: videoUrl && videoUrl.trim() ? videoUrl.trim() : null,
    coach_id: coachId,
  };
  data.exercises.push(exercise);
  persist();
  return exercise;
}

// ---- Sessions -----------------------------------------------------------
// A programme week is a list of sessions, not seven weekdays: the coach adds
// as many as the week needs and the client does them in any order on any
// day. A session's place in its week is day_of_week (1, 2, 3 …), always
// numbered without gaps.

/** A week holds seven sessions at most: one a day is the ceiling. */
export const MAX_SESSIONS_PER_WEEK = 7;

/**
 * Adds a session at the end of a week; it goes out at once if the programme
 * is live. Null when the week already has MAX_SESSIONS_PER_WEEK.
 */
export function addSession(clientId: number, week: number, save = true): ProgramDay | null {
  const data = getData();
  const existing = getWeek(clientId, week);
  if (existing.length >= MAX_SESSIONS_PER_WEEK) return null;
  const program = getProgramForWeek(clientId, week);
  const day: ProgramDay = {
    id: allocId("program_days"),
    client_id: clientId,
    week_number: week,
    day_of_week: existing.reduce((max, d) => Math.max(max, d.day_of_week), 0) + 1,
    label: null,
    status: program?.status === "deployed" ? "published" : "draft",
  };
  data.program_days.push(day);
  if (save) persist();
  return day;
}

/**
 * Session N of a week. With `create`, a week with fewer sessions grows to
 * N first, so copying or mirroring session 3 onto a later week always has
 * somewhere to land.
 */
export function sessionAt(clientId: number, week: number, position: number, create = false): ProgramDay | null {
  for (;;) {
    const days = getWeek(clientId, week);
    const hit = days.find((d) => d.day_of_week === position);
    if (hit) return hit;
    if (!create || days.some((d) => d.day_of_week > position)) return null;
    if (!addSession(clientId, week, false)) return null;
  }
}

/**
 * Deletes a session with everything on it: exercises, cardio, and what the
 * client logged against them. The sessions after it move up one.
 */
export function removeSession(programDayId: number) {
  const data = getData();
  const day = data.program_days.find((pd) => pd.id === programDayId);
  if (!day) return;
  const assignmentIds = new Set(data.workout_assignments.filter((wa) => wa.program_day_id === day.id).map((wa) => wa.id));
  const cardioIds = new Set((data.cardio_entries ?? []).filter((c) => c.program_day_id === day.id).map((c) => c.id));
  data.set_logs = data.set_logs.filter((sl) => !assignmentIds.has(sl.workout_assignment_id));
  data.assignment_custom_values = data.assignment_custom_values.filter((v) => !assignmentIds.has(v.workout_assignment_id));
  data.workout_assignments = data.workout_assignments.filter((wa) => !assignmentIds.has(wa.id));
  data.cardio_logs = (data.cardio_logs ?? []).filter((l) => !cardioIds.has(l.cardio_entry_id));
  data.cardio_entries = (data.cardio_entries ?? []).filter((c) => !cardioIds.has(c.id));
  data.program_days = data.program_days.filter((pd) => pd.id !== day.id);
  getWeek(day.client_id, day.week_number).forEach((d, i) => (d.day_of_week = i + 1));
  persist();
}

/**
 * One-time move from seven weekday slots to sessions (Sept 2026). Days with
 * nothing on them (unbuilt days, rest days) go; the rest keep their order
 * and become Session 1, 2, 3 … of their week. Their exercises, cardio and
 * logged sets stay attached, since the rows themselves stay.
 */
export function migrateDaysToSessions() {
  const data = getData();
  if (data.sessions_migrated) return;
  const withContent = new Set([
    ...data.workout_assignments.map((wa) => wa.program_day_id),
    ...(data.cardio_entries ?? []).map((c) => c.program_day_id),
  ]);
  data.program_days = data.program_days.filter((pd) => withContent.has(pd.id));
  const weeks = new Map<string, ProgramDay[]>();
  for (const pd of data.program_days) {
    const key = `${pd.client_id}:${pd.week_number}`;
    weeks.set(key, [...(weeks.get(key) ?? []), pd]);
  }
  for (const days of weeks.values()) {
    days.sort((a, b) => a.day_of_week - b.day_of_week).forEach((d, i) => (d.day_of_week = i + 1));
  }
  data.sessions_migrated = new Date().toISOString();
  persist();
}

/** Dates (YYYY-MM-DD) the client logged at least one set on: their training days. */
export function trainingDates(clientId: number): Set<string> {
  const data = getData();
  const dayIds = new Set(data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.id));
  const assignmentIds = new Set(data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id)).map((wa) => wa.id));
  return new Set(data.set_logs.filter((sl) => assignmentIds.has(sl.workout_assignment_id)).map((sl) => sl.logged_at.slice(0, 10)));
}

export function getWeek(clientId: number, week: number): ProgramDay[] {
  return getData()
    .program_days.filter((pd) => pd.client_id === clientId && pd.week_number === week)
    .sort((a, b) => a.day_of_week - b.day_of_week);
}

// Every week_number this client has, ascending: each week a programme
// spans (a week may have no sessions yet) and any week with sessions.
export function listWeekNumbers(clientId: number): number[] {
  const data = getData();
  const weeks = new Set(data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.week_number));
  for (const p of data.training_programs) {
    if (p.client_id !== clientId) continue;
    for (let i = 0; i < p.total_weeks; i++) weeks.add(p.start_week + i);
  }
  return [...weeks].sort((a, b) => a - b);
}

// A week is published when its sessions are, or, with no sessions yet, when
// its programme is live.
function isWeekPublished(clientId: number, week: number): boolean {
  const days = getWeek(clientId, week);
  if (days.length > 0) return days.every((d) => d.status === "published");
  return getProgramForWeek(clientId, week)?.status === "deployed";
}

// Which week a client is currently looking at by default: the highest
// week_number the coach has actually published. Deliberately NOT tied to
// the calendar — a coach can build (and rebuild) week N+1 as a draft for as
// long as they like while the client keeps seeing week N, and the instant
// they hit deploy, the client's default view flips to the new week. No
// waiting for a date to roll over, no separate "make it live" step.
export function getCurrentWeekNumber(clientId: number): number {
  const deployed = getDeployedProgram(clientId);
  if (deployed) return deployed.start_week + getProgramCurrentWeekIndex(deployed) - 1;
  const weeks = listWeekNumbers(clientId);
  if (weeks.length === 0) return 1;
  const publishedWeeks = weeks.filter((w) => isWeekPublished(clientId, w));
  return publishedWeeks.length > 0 ? Math.max(...publishedWeeks) : weeks[0];
}

// Every week_number the client has that's actually published — unlike
// listWeekNumbers, this excludes a draft program's pre-created (empty,
// unpublished) weeks, which would otherwise show up as a wall of empty
// tabs in the client's own week switcher the moment a coach picks e.g. an
// 8-week program length, well before deploying anything.
export function listPublishedWeekNumbers(clientId: number): number[] {
  return listWeekNumbers(clientId).filter((w) => isWeekPublished(clientId, w));
}

// ---- Training programs: a coach-named, fixed-length (total_weeks) block of
// weeks — see the TrainingProgram doc comment in db.ts for the model. One
// draft at a time per client (matches the admin UI, which only ever offers
// "start a new program" when there isn't one already); any number of past
// deployed programs can accumulate as a client progresses through them. ----

export type TrainingProgram = {
  id: number;
  client_id: number;
  name: string | null;
  start_week: number;
  total_weeks: number;
  status: "draft" | "deployed";
  deployed_at: string | null;
  scheduled_at: string | null;
  phase_removed?: boolean;
};

export function listPrograms(clientId: number): TrainingProgram[] {
  return getData()
    .training_programs.filter((p) => p.client_id === clientId)
    .sort((a, b) => a.start_week - b.start_week);
}

export function findProgramById(programId: number): TrainingProgram | null {
  return getData().training_programs.find((p) => p.id === programId) ?? null;
}

// The programme the client is on now: the latest deployed one that has
// started. A deployed programme whose start was moved into a later week is
// not it (applyDueProgramDeployments turns those back into schedules); the
// latest-start rule alone picked it, so the running programme was listed as
// past and the future one as live.
export function getDeployedProgram(clientId: number): TrainingProgram | null {
  const thisWeek = weekStart(localDateStr());
  const deployed = listPrograms(clientId).filter((p) => p.status === "deployed" && (!p.deployed_at || weekStart(p.deployed_at.slice(0, 10)) <= thisWeek));
  if (deployed.length === 0) return null;
  return deployed.reduce((latest, p) => (p.start_week > latest.start_week ? p : latest));
}

export function getDraftProgram(clientId: number): TrainingProgram | null {
  return listPrograms(clientId).find((p) => p.status === "draft") ?? null;
}

// A program's total_weeks internal position (1..total_weeks) that "now"
// falls into, by real calendar weeks elapsed since it was deployed —
// clamped to the program's actual length so it never points past the last
// week (a program that's run its full course just stays parked on its
// final week) or before the first.
export function getProgramCurrentWeekIndex(program: TrainingProgram): number {
  if (!program.deployed_at) return 1;
  const start = weekStart(program.deployed_at.slice(0, 10));
  const now = weekStart(localDateStr());
  const diffDays = Math.round((new Date(`${now}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000);
  const index = Math.floor(diffDays / 7) + 1;
  return Math.min(Math.max(index, 1), program.total_weeks);
}

// The label shown for one of this program's weeks — always "Week N" where N
// is the position WITHIN the program (1..total_weeks), never the underlying
// global week_number, so a client's second program starts back at "Week 1".
export function programWeekLabel(program: TrainingProgram, weekNumber: number): string {
  return `Week ${weekNumber - program.start_week + 1}`;
}

export function createProgram(clientId: number, name: string, totalWeeks: number, startWeek: number): TrainingProgram {
  const data = getData();
  const program: TrainingProgram = {
    id: allocId("training_programs"),
    client_id: clientId,
    name: name.trim() || null,
    start_week: startWeek,
    total_weeks: totalWeeks,
    status: "draft",
    deployed_at: null,
    scheduled_at: null,
  };
  data.training_programs.push(program);
  persist();
  return program;
}

export function renameProgram(programId: number, name: string) {
  const data = getData();
  const program = data.training_programs.find((p) => p.id === programId);
  if (!program) return;
  program.name = name.trim() || null;
  persist();
  syncProgramPhase(programId, false);
}

export function deployProgram(programId: number) {
  const data = getData();
  const program = data.training_programs.find((p) => p.id === programId);
  if (!program) return;
  program.status = "deployed";
  program.deployed_at = new Date().toISOString();
  program.scheduled_at = null;
  for (let i = 0; i < program.total_weeks; i++) publishWeek(program.client_id, program.start_week + i);
  persist();
  syncProgramPhase(programId);
  logCoachActivity(program.client_id, `Your coach published a new plan${program.name ? `: ${program.name}` : ""}. Check it out`, {
    kind: "programme",
    actionTab: "training",
    actionLabel: "See the week",
  });
}

export function scheduleProgramDeploy(programId: number, scheduledAt: string | null) {
  const data = getData();
  const program = data.training_programs.find((p) => p.id === programId);
  if (!program) return;
  program.scheduled_at = scheduledAt;
  persist();
  syncProgramPhase(programId);
}

// Deletes a draft program and every one of its (still-empty-or-not)
// program_days — mirrors the old removeWeek's append-only-history stance:
// only ever called on a draft, never a deployed program, so this can't
// leave a gap the client would ever have seen.
// Copies Week 1's day labels + exercise assignments into another week of
// the same program (which must already have its skeleton) — it's the same
// program, so every week starts as a copy of the template the coach
// already built rather than a blank slate they'd have to rebuild N times.
// Never copies set_logs, so the target week always starts unlogged. A
// one-time copy at the moment a week is added, not a live link — editing
// Week 1 afterward doesn't retroactively touch weeks already copied from it,
// so a deliberately different deload/taper week elsewhere is never
// silently overwritten.
function copyWeekOneInto(clientId: number, startWeek: number, toWeek: number) {
  const fromDays = getWeek(clientId, startWeek);
  fromDays.forEach((fromDay) => {
    const toDay = sessionAt(clientId, toWeek, fromDay.day_of_week, true);
    if (!toDay) return;
    if (fromDay.label) setDayLabel(toDay.id, fromDay.label);
    getAssignmentsForDay(fromDay.id).forEach((a) => {
      addExerciseToDay(toDay.id, a.exercise_id, a.sets, a.reps, a.target_weight_kg, a.rpe_target, a.tempo, a.notes);
    });
  });
}

// Grows (never shrinks — nothing here ever deletes a built week's content)
// a draft program's length. Each newly-added week starts as a copy of
// Week 1 (see copyWeekOneInto) rather than blank, so setting a program to
// 12 weeks after building out Week 1 gives 12 working weeks to start
// adjusting from, not 11 empty ones. Requesting a number no bigger than
// the current length is just a no-op.
// New weeks start as copies of week 1 unless `seedFromWeekOne` is false, in
// which case they are bare: no sessions yet.
export function updateProgramTotalWeeks(programId: number, requestedTotal: number, seedFromWeekOne = true) {
  const data = getData();
  const program = data.training_programs.find((p) => p.id === programId);
  if (!program) return;
  const newTotal = Math.max(program.total_weeks, Math.max(1, Math.floor(requestedTotal) || 1));
  if (newTotal === program.total_weeks) return;
  // Weeks are numbered once per client, so the weeks this programme grows
  // into may already be another programme's. Everything after this one moves
  // up first; without that the two programmes shared those weeks' sessions,
  // and one showed the other's exercises, logged sets and skip reasons.
  const oldLast = program.start_week + program.total_weeks - 1;
  const newLast = program.start_week + newTotal - 1;
  const nextTaken = Math.min(
    ...data.training_programs.filter((p) => p.client_id === program.client_id && p.id !== program.id && p.start_week > oldLast).map((p) => p.start_week),
    ...data.program_days.filter((pd) => pd.client_id === program.client_id && pd.week_number > oldLast).map((pd) => pd.week_number),
    Infinity
  );
  if (nextTaken <= newLast) {
    const shift = newLast - nextTaken + 1;
    data.training_programs.forEach((p) => {
      if (p.client_id === program.client_id && p.id !== program.id && p.start_week > oldLast) p.start_week += shift;
    });
    data.program_days.forEach((pd) => {
      if (pd.client_id === program.client_id && pd.week_number > oldLast) pd.week_number += shift;
    });
  }
  for (let i = program.total_weeks; i < newTotal; i++) {
    const weekNumber = program.start_week + i;
    if (seedFromWeekOne && weekNumber !== program.start_week) copyWeekOneInto(program.client_id, program.start_week, weekNumber);
  }
  program.total_weeks = newTotal;
  persist();
  syncProgramPhase(programId);
}

// Removes one week (1-based index within the programme) and closes the gap:
// every later week moves up one, so a six-week programme minus week 3 is a
// five-week programme whose old week 4 is now week 3. The week's days, their
// exercises, logged sets and custom values go with it. The last remaining
// week can't be removed; delete the programme for that.
export function removeProgramWeek(programId: number, weekIndex: number) {
  const data = getData();
  const program = data.training_programs.find((p) => p.id === programId);
  if (!program) return;
  if (program.total_weeks <= 1) return;
  if (weekIndex < 1 || weekIndex > program.total_weeks) return;
  const weekNumber = program.start_week + weekIndex - 1;
  const lastWeekNumber = program.start_week + program.total_weeks - 1;

  const dayIds = new Set(
    data.program_days.filter((pd) => pd.client_id === program.client_id && pd.week_number === weekNumber).map((pd) => pd.id)
  );
  const assignmentIds = new Set(
    data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id)).map((wa) => wa.id)
  );
  data.set_logs = data.set_logs.filter((sl) => !assignmentIds.has(sl.workout_assignment_id));
  data.assignment_custom_values = data.assignment_custom_values.filter((v) => !assignmentIds.has(v.workout_assignment_id));
  data.workout_assignments = data.workout_assignments.filter((wa) => !assignmentIds.has(wa.id));
  data.program_days = data.program_days.filter((pd) => !dayIds.has(pd.id));

  // Shift the weeks after it down by one so the programme stays contiguous.
  data.program_days.forEach((pd) => {
    if (pd.client_id === program.client_id && pd.week_number > weekNumber && pd.week_number <= lastWeekNumber) {
      pd.week_number -= 1;
    }
  });
  program.total_weeks -= 1;
  persist();
  syncProgramPhase(programId);
}

export function removeProgram(programId: number) {
  const data = getData();
  const program = data.training_programs.find((p) => p.id === programId);
  if (!program) return;
  for (let i = 0; i < program.total_weeks; i++) removeWeek(program.client_id, program.start_week + i);
  data.training_programs = data.training_programs.filter((p) => p.id !== programId);
  data.client_phases = data.client_phases.filter((ph) => ph.program_id !== programId);
  persist();
}

// Called once per request (from the root layout, so it runs regardless of
// which route loads next) — deploys any program whose scheduled time has
// passed, standing in for a push notification (via the coach_activity log
// deployProgram writes) without needing any background infrastructure.
/**
 * Programmes of one client that overlap on the same week numbers (from before
 * growing a programme moved the ones after it) are pulled apart: the earlier
 * one, the live one on a tie, keeps the weeks and their sessions; the later
 * one moves to free weeks and starts them empty. Nothing is deleted.
 */
function separateOverlappingPrograms() {
  const data = getData();
  let changed = false;
  const clientIds = [...new Set(data.training_programs.map((p) => p.client_id))];
  for (const clientId of clientIds) {
    const mine = data.training_programs
      .filter((p) => p.client_id === clientId)
      .sort((a, b) => a.start_week - b.start_week || (a.status === "deployed" ? -1 : 0) - (b.status === "deployed" ? -1 : 0) || a.id - b.id);
    let taken = 0;
    for (const p of mine) {
      if (p.start_week <= taken) {
        const dayWeeks = data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.week_number);
        const free = Math.max(taken, ...mine.map((q) => q.start_week + q.total_weeks - 1), ...dayWeeks) + 1;
        p.start_week = free;
        changed = true;
      }
      taken = Math.max(taken, p.start_week + p.total_weeks - 1);
    }
  }
  if (changed) persist();
}

export function applyDueProgramDeployments() {
  migrateDaysToSessions();
  separateOverlappingPrograms();
  const data = getData();
  const now = new Date().toISOString();
  // A deployed programme whose start was moved into a later week before
  // anything was logged in it is a schedule again: it goes live on that
  // week, like any other. (updateClientPhase does this from now on; this
  // mends the ones it did not.)
  const thisWeek = weekStart(localDateStr());
  let rescheduled = false;
  for (const p of data.training_programs) {
    if (p.status !== "deployed" || !p.deployed_at || weekStart(p.deployed_at.slice(0, 10)) <= thisWeek) continue;
    if (programLoggedWeekIndexes(p.id).length > 0) continue;
    p.status = "draft";
    p.scheduled_at = p.deployed_at;
    p.deployed_at = null;
    rescheduled = true;
  }
  if (rescheduled) persist();
  const due = data.training_programs.filter((p) => p.status === "draft" && p.scheduled_at && p.scheduled_at <= now);
  due.forEach((program) => deployProgram(program.id));

  // Goals progress from what was logged before the rule existed too: every
  // assignment with logs gets one pass. Cheap, idempotent, and a no-op for
  // a next week that already has logs of its own.
  const loggedAssignmentIds = new Set(data.set_logs.map((sl) => sl.workout_assignment_id));
  loggedAssignmentIds.forEach((id) => progressTargetFromLogs(id));

  // Programmes that went live or were scheduled before phases existed get
  // their Plan-tab phase now. syncProgramPhase is a no-op once it exists.
  data.training_programs
    .filter((p) => (p.status === "deployed" || p.scheduled_at) && !data.client_phases.some((ph) => ph.program_id === p.id))
    .forEach((p) => syncProgramPhase(p.id));

  // Training phases drawn on the Plan tab before phases and programmes were
  // linked: give each upcoming one its draft, so it can be built. Past ones
  // are history and stay as they are.
  data.client_phases
    .filter((ph) => ph.track === "training" && !ph.program_id && ph.end_week >= thisWeek)
    .forEach((ph) => {
      const weeks = Math.max(
        1,
        Math.round((new Date(`${ph.end_week}T00:00:00`).getTime() - new Date(`${ph.start_week}T00:00:00`).getTime()) / (7 * 86400000)) + 1
      );
      const existingWeeks = listWeekNumbers(ph.client_id);
      const startWeek = (existingWeeks.length > 0 ? Math.max(...existingWeeks) : 0) + 1;
      ph.program_id = createProgram(ph.client_id, ph.name, weeks, startWeek).id;
      persist();
    });

  // Repair for weeks added to a deployed programme before addProgramWeekAction
  // published them: any draft day inside a deployed programme's range is
  // published. Idempotent and cheap, so it rides along on every request.
  let healed = false;
  data.training_programs
    .filter((p) => p.status === "deployed")
    .forEach((p) => {
      const last = p.start_week + p.total_weeks - 1;
      data.program_days.forEach((pd) => {
        if (pd.client_id === p.client_id && pd.week_number >= p.start_week && pd.week_number <= last && pd.status !== "published") {
          pd.status = "published";
          healed = true;
        }
      });
    });
  if (healed) persist();
}

// Same lazy-catch-up pattern as applyDueProgramDeployments (no background
// job runner in this app), but turns getDueItems() into reminder rows on the
// notification feed. dedupeKey is scoped to the due item's own period (day,
// week, or photo period) so it only fires once per rollover, not once per
// request — logCoachActivity no-ops if that key already exists.
export function applyDueClientReminders() {
  const data = getData();
  const today = localDateStr();
  const weekKey = weekStart(today);

  // Not driven off data.clients — a client can have tracker/measurement/photo
  // setup (and so due items) without a row there yet, same as every other
  // client-scoped read in this file that just takes a clientId. Instead,
  // scope to whichever client ids actually have coach-configured items to be
  // due in the first place — the same tables getDueItems() itself gates on.
  const clientIds = new Set<number>([
    ...data.metric_definitions.map((d) => d.client_id),
    ...data.measurement_fields.map((f) => f.client_id),
    ...data.photo_slots.map((s) => s.client_id),
  ]);

  // A reminder ticks itself off once it is no longer due: the check-in was
  // done, or its day, week or photo period has passed. So clients with an
  // unread reminder are looked at too, whatever they have set up now.
  for (const a of data.coach_activity) if (a.kind === "reminder" && !a.read) clientIds.add(a.client_id);

  let cleared = false;
  clientIds.forEach((clientId) => {
    const dueKeys = new Set<string>();
    getDueItems(clientId).forEach((item) => {
      const periodKey =
        item.id === "weekly"
          ? weekKey
          : item.id === "photos"
          ? photoSheetFor(clientId, today) ?? today
          : today;
      const dedupeKey = `reminder:${item.id}:${clientId}:${periodKey}`;
      dueKeys.add(dedupeKey);
      if (!getClientPreferences(clientId).checkin_reminders) return;
      logCoachActivity(clientId, `${item.label}: ${item.detail}`, { kind: "reminder", dedupeKey });
    });
    for (const a of data.coach_activity) {
      if (a.client_id !== clientId || a.kind !== "reminder" || a.read || !a.dedupe_key) continue;
      if (dueKeys.has(a.dedupe_key)) continue;
      a.read = true;
      cleared = true;
    }
  });
  if (cleared) persist();
}

// Deletes an entire week (days + assignments + their logs). Weeks are
// otherwise append-only — nothing else in this file ever removes one — so
// callers are expected to only allow this for the latest week while it's
// still a draft, to avoid leaving a gap in the sequence.
export function removeWeek(clientId: number, week: number) {
  const data = getData();
  const dayIds = new Set(
    data.program_days.filter((pd) => pd.client_id === clientId && pd.week_number === week).map((pd) => pd.id)
  );
  const assignmentIds = new Set(
    data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id)).map((wa) => wa.id)
  );
  data.set_logs = data.set_logs.filter((sl) => !assignmentIds.has(sl.workout_assignment_id));
  data.workout_assignments = data.workout_assignments.filter((wa) => !assignmentIds.has(wa.id));
  data.program_days = data.program_days.filter((pd) => !dayIds.has(pd.id));
  persist();
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
        // Rows written before the note fields existed have them undefined —
        // getData()'s schema patch back-fills missing tables, not missing
        // columns — so they're defaulted on the way out.
        demo_url: wa.demo_url ?? null,
        note_kind: wa.note_kind ?? null,
        note_at: wa.note_at ?? null,
        note_read: wa.note_read ?? false,
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

// Duplicates one week's programming onto another week of the same client —
// session names, every exercise and its targets. Copies plan only: logged
// sets belong to the week they were performed in. Session N lands on
// session N; the target week grows sessions to match. Skips silently if the
// source week has none.
export function copyProgramWeek(clientId: number, fromWeek: number, toWeek: number) {
  if (fromWeek === toWeek) return;
  const data = getData();
  const source = getWeek(clientId, fromWeek);
  if (source.length === 0) return;

  for (const src of source) {
    const dest = sessionAt(clientId, toWeek, src.day_of_week, true);
    if (!dest) continue;
    dest.label = src.label;
    // Replace rather than append, so copying twice doesn't double the day.
    const replacedIds = data.workout_assignments.filter((wa) => wa.program_day_id === dest.id).map((wa) => wa.id);
    data.workout_assignments = data.workout_assignments.filter((wa) => wa.program_day_id !== dest.id);
    data.assignment_custom_values = data.assignment_custom_values.filter(
      (v) => !replacedIds.includes(v.workout_assignment_id)
    );

    const srcAssignments = data.workout_assignments
      .filter((wa) => wa.program_day_id === src.id)
      .sort((a, b) => a.order_index - b.order_index);
    for (const wa of srcAssignments) {
      const id = allocId("workout_assignments");
      data.workout_assignments.push({ ...wa, warmup_sets: undefined, id, program_day_id: dest.id });
      // Custom columns are part of the plan too, so they come along.
      for (const v of data.assignment_custom_values.filter((v) => v.workout_assignment_id === wa.id)) {
        data.assignment_custom_values.push({
          ...v,
          id: allocId("assignment_custom_values"),
          workout_assignment_id: id,
        });
      }
    }
  }
  persist();
}

// The programme a given week belongs to, if any: the one whose week span
// covers it. Programmes don't overlap for one client, so at most one matches.
export function getProgramForWeek(clientId: number, week: number): TrainingProgram | null {
  return (
    getData().training_programs.find(
      (p) => p.client_id === clientId && week >= p.start_week && week < p.start_week + p.total_weeks
    ) ?? null
  );
}

// Adds the same prescription to the same session in every later week of the
// programme. A week with fewer sessions grows to that one; a week that
// already has this exercise in that session is left alone, so the coach
// can't double up by ticking the box twice. Returns how many weeks were
// touched.
export function addExerciseToRemainingWeeks(
  programDayId: number,
  exerciseId: number,
  sets: number,
  reps: string,
  targetWeight: number | null,
  rpeTarget: number | null = null,
  tempo: string | null = null,
  notes: string | null = null
): number {
  const data = getData();
  const day = data.program_days.find((pd) => pd.id === programDayId);
  if (!day) return 0;
  const program = getProgramForWeek(day.client_id, day.week_number);
  if (!program) return 0;
  const lastWeek = program.start_week + program.total_weeks - 1;
  let touched = 0;
  for (let week = day.week_number + 1; week <= lastWeek; week++) {
    const target = sessionAt(day.client_id, week, day.day_of_week, true);
    if (!target) continue;
    const already = getData().workout_assignments.some(
      (wa) => wa.program_day_id === target.id && wa.exercise_id === exerciseId
    );
    if (already) continue;
    addExerciseToDay(target.id, exerciseId, sets, reps, targetWeight, rpeTarget, tempo, notes);
    touched += 1;
  }
  return touched;
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
    demo_url: null,
    note_kind: null,
    note_at: notes ? new Date().toISOString() : null,
    note_read: false,
  });
  persist();
}

export function removeAssignment(assignmentId: number) {
  const data = getData();
  data.set_logs = data.set_logs.filter((sl) => sl.workout_assignment_id !== assignmentId);
  data.workout_assignments = data.workout_assignments.filter((wa) => wa.id !== assignmentId);
  persist();
}

// Edits an already-added assignment's targets in place, rather than forcing
// a delete-and-re-add — that was the only way to change sets/reps/weight
// once an exercise was on the sheet, which made adjusting a duplicated
// week's targets far more tedious than it needed to be.
export function updateAssignmentFields(
  assignmentId: number,
  fields: Partial<Pick<WorkoutAssignment, "sets" | "reps" | "target_weight_kg" | "rpe_target" | "tempo" | "rest_seconds" | "distance" | "time" | "notes">>
) {
  const data = getData();
  const assignment = data.workout_assignments.find((wa) => wa.id === assignmentId);
  if (!assignment) return;

  // Editing the note text re-dates it and marks it unread again, so the
  // client sees a dot for a correction that changed — otherwise a coach
  // rewriting a note the athlete had already opened would land silently.
  if ("notes" in fields && fields.notes !== assignment.notes) {
    const text = (fields.notes ?? "").trim();
    assignment.note_at = text ? new Date().toISOString() : null;
    assignment.note_read = false;
    if (!text) assignment.note_kind = null;
  }
  // A weight the coach types is theirs: see progressTargetFromLogs.
  if ("target_weight_kg" in fields && fields.target_weight_kg !== assignment.target_weight_kg) {
    assignment.target_set_at = new Date().toISOString();
  }

  Object.assign(assignment, fields);
  persist();
}

/** Coach-side: attach (or clear) the demo video the client sees on this row. */
export function setAssignmentDemoUrl(assignmentId: number, url: string | null) {
  const data = getData();
  const assignment = data.workout_assignments.find((wa) => wa.id === assignmentId);
  if (!assignment) return;
  assignment.demo_url = url && url.trim() ? url.trim() : null;
  persist();
}

/** Coach-side: set which kind of note this is (technique / load / tempo). */
export function setExerciseNoteKind(assignmentId: number, kind: ExerciseNoteKind | null) {
  const data = getData();
  const assignment = data.workout_assignments.find((wa) => wa.id === assignmentId);
  if (!assignment) return;
  assignment.note_kind = kind;
  persist();
}

/**
 * Client-side: clears the unread dot the first time the athlete opens a note.
 * Idempotent, and a no-op on an assignment with no note.
 */
export function markExerciseNoteRead(assignmentId: number) {
  const data = getData();
  const assignment = data.workout_assignments.find((wa) => wa.id === assignmentId);
  if (!assignment || !assignment.notes || assignment.note_read) return;
  assignment.note_read = true;
  persist();
}

/**
 * The most recent week that actually has a split, which is what "copy" on
 * the add-week popover should clone. Sourcing from the trailing week would
 * make the option a no-op whenever the last week is still empty — which is
 * exactly when a coach reaches for it.
 */
export function lastBuiltWeek(clientId: number, weekNumbers: number[]): number | null {
  for (let i = weekNumbers.length - 1; i >= 0; i--) {
    const week = weekNumbers[i];
    const hasContent = getWeek(clientId, week).some((d) => getAssignmentsForDay(d.id).length > 0);
    if (hasContent) return week;
  }
  return null;
}

export type PreviousWeekAssignmentRef = {
  sets: number;
  reps: string;
  target_weight_kg: number | null;
  rpe_target: number | null;
  actualLogs: SetLog[];
};

// What this same exercise, on this same day, looked like one sheet ago —
// both the target the coach set and what the client actually logged against
// it. Surfaced while building the next week's sheet so the coach can set
// this week's numbers off real data instead of guessing or hunting through
// the log feed; `week` is the sheet number (not a calendar week), so this is
// "the previous sheet for this client", which is what a coach building week
// N+1 actually means by "last week".
export function getPreviousWeekAssignmentRef(
  clientId: number,
  week: number,
  dayOfWeek: number,
  exerciseId: number
): PreviousWeekAssignmentRef | null {
  if (week <= 1) return null;
  const data = getData();
  const prevDay = data.program_days.find(
    (pd) => pd.client_id === clientId && pd.week_number === week - 1 && pd.day_of_week === dayOfWeek
  );
  if (!prevDay) return null;
  const prevAssignment = data.workout_assignments.find(
    (wa) => wa.program_day_id === prevDay.id && wa.exercise_id === exerciseId
  );
  if (!prevAssignment) return null;
  return {
    sets: prevAssignment.sets,
    reps: prevAssignment.reps,
    target_weight_kg: prevAssignment.target_weight_kg,
    rpe_target: prevAssignment.rpe_target,
    actualLogs: getLogsForAssignment(prevAssignment.id),
  };
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
  rpeActual: number | null,
  gymId: number | null = null
) {
  const data = getData();
  // Logging a set number that already has a row corrects that row rather
  // than adding a twin: a double tap or a retry must not count as two sets.
  const existing = data.set_logs.find((sl) => sl.workout_assignment_id === workoutAssignmentId && sl.set_number === setNumber);
  if (existing) {
    existing.weight_kg = weightKg;
    existing.reps = reps;
    existing.rpe_actual = rpeActual;
    persist();
    progressTargetFromLogs(workoutAssignmentId);
    return;
  }
  data.set_logs.push({
    id: allocId("set_logs"),
    workout_assignment_id: workoutAssignmentId,
    set_number: setNumber,
    weight_kg: weightKg,
    reps,
    rpe_actual: rpeActual,
    // Local server time, the same clock localDateStr() reads: an ISO/UTC stamp
    // put a 6am session on the previous day for anyone east of Greenwich.
    logged_at: localStamp(),
    gym_id: gymId,
  });
  persist();
  progressTargetFromLogs(workoutAssignmentId);
}

// The weight goal writes itself forward. When a client's best set of the
// week meets or beats the coach's target, next week's target for the same
// exercise on the same day becomes that weight (or stays higher if the
// coach already planned more). A week they fell short leaves next week's
// target exactly as the coach set it. Nothing moves once next week has
// logs of its own.
//
// A target the coach typed by hand after those sets were logged is left as
// they set it. This runs on every request (applyDueProgramDeployments), so
// without that a coach lowering next week's weight below a weight already
// logged (a typo like 1230, or a deliberate deload) saw it jump straight back.
//
// Each gym runs this on its own. The home gym moves target_weight_kg, as
// it always has; another gym moves its own entry in gym_targets. A gym with
// no entry yet has no target of its own to meet (the coach's weight was
// only a starting point on a different machine), so what the client lifted
// there becomes that gym's weight going forward.
export function progressTargetFromLogs(workoutAssignmentId: number) {
  const data = getData();
  const wa = data.workout_assignments.find((x) => x.id === workoutAssignmentId);
  if (!wa) return;
  const day = data.program_days.find((pd) => pd.id === wa.program_day_id);
  if (!day) return;
  const logs = data.set_logs.filter((sl) => sl.workout_assignment_id === wa.id);
  if (logs.length === 0) return;
  const home = homeGymId(day.client_id);

  // null is the home gym's lane.
  const byGym = new Map<number | null, SetLog[]>();
  for (const sl of logs) {
    const gym = sl.gym_id == null || sl.gym_id === home ? null : sl.gym_id;
    byGym.set(gym, [...(byGym.get(gym) ?? []), sl]);
  }

  // Every later occurrence of the same exercise for this client moves up:
  // the same weekday next week, but also a second session later this week
  // that repeats it, and every week after. "Later" is by day: a later week,
  // or a later weekday of the same week. Occurrences the client has already
  // logged against are left alone, and a target the coach planned higher
  // than the logged weight stays.
  const days = new Map(data.program_days.filter((pd) => pd.client_id === day.client_id).map((pd) => [pd.id, pd] as const));
  const isLater = (pd: ProgramDay) =>
    pd.week_number > day.week_number || (pd.week_number === day.week_number && pd.day_of_week > day.day_of_week);
  const later = data.workout_assignments.filter((other) => {
    if (other.id === wa.id || other.exercise_id !== wa.exercise_id) return false;
    const otherDay = days.get(other.program_day_id);
    return !!otherDay && isLater(otherDay) && !data.set_logs.some((sl) => sl.workout_assignment_id === other.id);
  });

  let changed = false;
  for (const [gym, gymLogs] of byGym) {
    const weights = gymLogs.map((sl) => sl.weight_kg).filter((w): w is number => w != null);
    if (weights.length === 0) continue;
    const bestWeight = Math.max(...weights);
    const lastLoggedMs = Math.max(...gymLogs.map((sl) => stampMs(sl.logged_at)));

    if (gym == null) {
      if (wa.target_weight_kg == null || bestWeight < wa.target_weight_kg) continue;
      for (const other of later) {
        // The coach set this one by hand after these sets were logged: theirs.
        if (other.target_set_at && stampMs(other.target_set_at) >= lastLoggedMs) continue;
        const target = Math.max(other.target_weight_kg ?? 0, bestWeight);
        if (target === other.target_weight_kg) continue;
        other.target_weight_kg = target;
        changed = true;
      }
      continue;
    }

    const own = wa.gym_targets?.[gym]?.kg ?? null;
    if (own != null && bestWeight < own) continue;
    for (const other of later) {
      const entry = other.gym_targets?.[gym];
      if (entry?.set_at && stampMs(entry.set_at) >= lastLoggedMs) continue;
      const target = entry?.kg == null ? bestWeight : Math.max(entry.kg, bestWeight);
      if (target === entry?.kg) continue;
      other.gym_targets = { ...(other.gym_targets ?? {}), [gym]: { kg: target, set_at: entry?.set_at ?? null } };
      changed = true;
    }
  }
  if (changed) persist();
}

// ---- Ownership lookups, used only for authorization ----
//
// Some client-callable actions identify their target by a nested id (a
// workout assignment, a photo slot) rather than by client id. These resolve
// that id back to the owning client so the action can check the caller is
// actually allowed to touch it, instead of trusting the form.

export function getClientIdForAssignment(assignmentId: number): number | null {
  const data = getData();
  const assignment = data.workout_assignments.find((wa) => wa.id === assignmentId);
  if (!assignment) return null;
  const day = data.program_days.find((pd) => pd.id === assignment.program_day_id);
  return day?.client_id ?? null;
}

export function getExerciseIdForAssignment(assignmentId: number): number | null {
  return getData().workout_assignments.find((wa) => wa.id === assignmentId)?.exercise_id ?? null;
}

export function getClientIdForPhotoSlot(slotId: number): number | null {
  return getData().photo_slots.find((s) => s.id === slotId)?.client_id ?? null;
}

export function getClientIdForNotification(notificationId: number): number | null {
  return getData().coach_activity.find((a) => a.id === notificationId)?.client_id ?? null;
}

export function getClientIdForReport(reportId: number): number | null {
  return getData().client_reports.find((r) => r.id === reportId)?.client_id ?? null;
}

export function getLogsForAssignment(workoutAssignmentId: number): SetLog[] {
  return getData()
    .set_logs.filter((sl) => sl.workout_assignment_id === workoutAssignmentId)
    .sort((a, b) => a.set_number - b.set_number);
}

// Who owns a logged set, via its assignment — so the client-side edit action
// can check the caller before touching it.
export function getClientIdForSetLog(setLogId: number): number | null {
  const log = getData().set_logs.find((sl) => sl.id === setLogId);
  return log ? getClientIdForAssignment(log.workout_assignment_id) : null;
}

// A set typed wrong gets corrected in place: same row, same set number,
// new figures. logged_at keeps the original time, since that is when the
// set was actually done.
export function updateSetLog(setLogId: number, weightKg: number | null, reps: number | null, rpeActual: number | null) {
  const data = getData();
  const log = data.set_logs.find((sl) => sl.id === setLogId);
  if (!log) return;
  log.weight_kg = weightKg;
  log.reps = reps;
  log.rpe_actual = rpeActual;
  persist();
  progressTargetFromLogs(log.workout_assignment_id);
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

// Every prescription column the coach can switch on, in the order they're
// offered. Notes is deliberately NOT here: it is always rendered on every
// row, so it is neither toggleable nor counted against the cap — a note is
// how a coach talks to the client about a movement, not an optional metric.
export const AVAILABLE_TRAINING_COLUMNS: { key: string; label: string; placeholder: string }[] = [
  { key: "sets", label: "Sets", placeholder: "3" },
  { key: "reps", label: "Reps", placeholder: "8-10" },
  { key: "weight_goal", label: "Weight", placeholder: "kg" },
  { key: "rpe", label: "RPE", placeholder: "8" },
  { key: "tempo", label: "Tempo", placeholder: "2-0-2" },
  { key: "rest", label: "Rest", placeholder: "90s" },
];

// Distance and Time were exercise columns too, from before cardio had a
// table of its own. They belong to cardio (CARDIO_COLUMNS), so they are no
// longer offered for exercises, and a client who had one switched on simply
// stops seeing it. What was typed in them stays on the exercise; it is only
// not shown.
const RETIRED_EXERCISE_KEYS = new Set(["distance", "time"]);

// Six at once. Past that the grid stops fitting a 1440 canvas beside the
// logged-sets panel, which is the column that actually matters.
export const MAX_TRAINING_COLUMNS = 6;

const DEFAULT_TRAINING_COLUMNS: { key: string; label: string }[] = [
  { key: "sets", label: "Sets" },
  { key: "reps", label: "Reps" },
  { key: "weight_goal", label: "Weight" },
  { key: "rpe", label: "RPE" },
  { key: "tempo", label: "Tempo" },
  { key: "notes", label: "Notes" },
];

// Cardio asks for different things than a lift does, so it has its own
// columns rather than borrowing the exercise ones. They live in the same
// table under their own keys, so one mapping still loads and saves them.
export const CARDIO_COLUMNS: { key: string; field: "time" | "pace" | "incline" | "distance"; label: string }[] = [
  { key: "cardio_time", field: "time", label: "Time" },
  { key: "cardio_pace", field: "pace", label: "Pace" },
  { key: "cardio_incline", field: "incline", label: "Incline" },
  { key: "cardio_distance", field: "distance", label: "Distance" },
];
const isCardioKey = (key: string) => CARDIO_COLUMNS.some((c) => c.key === key);

/** The cardio columns and whether each is on. All four start on. */
export function listCardioColumns(clientId: number) {
  const data = getData();
  const rows = data.training_columns.filter((c) => c.client_id === clientId && isCardioKey(c.key));
  return CARDIO_COLUMNS.map((def) => {
    const row = rows.find((r) => r.key === def.key);
    return { key: def.key, field: def.field, label: row?.label ?? def.label, visible: row ? row.visible : true };
  });
}

export function setCardioColumnVisible(clientId: number, key: string, visible: boolean) {
  if (!isCardioKey(key)) return;
  const data = getData();
  const row = data.training_columns.find((c) => c.client_id === clientId && c.key === key);
  if (row) row.visible = visible;
  else
    data.training_columns.push({
      id: allocId("training_columns"),
      client_id: clientId,
      key,
      label: CARDIO_COLUMNS.find((c) => c.key === key)!.label,
      kind: "builtin",
      visible,
      order_index: 100 + CARDIO_COLUMNS.findIndex((c) => c.key === key),
    });
  persist();
}

export function listTrainingColumns(clientId: number): TrainingColumn[] {
  const data = getData();
  const existing = data.training_columns.filter((c) => c.client_id === clientId && !isCardioKey(c.key));
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
    return data.training_columns.filter((c) => c.client_id === clientId && !isCardioKey(c.key)).sort(columnOrder);
  }
  return existing.filter((c) => !isCardioKey(c.key) && !RETIRED_EXERCISE_KEYS.has(c.key)).sort(columnOrder);
}

// Notes is prose and reads last whatever order the other columns were
// switched on in; a column added later would otherwise land after it.
function columnOrder(a: TrainingColumn, b: TrainingColumn) {
  const an = a.key === "notes" ? 1 : 0;
  const bn = b.key === "notes" ? 1 : 0;
  return an - bn || a.order_index - b.order_index;
}

/** "90s", "1:30", "2 min", "120" → seconds; blank → null. */
export function parseRestSeconds(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(",", ".");
  if (!t) return null;
  const mmss = t.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? "s";
  return Math.round(unit.startsWith("m") ? n * 60 : n);
}

/** Seconds → "90s" or "2:30" for the coach's cell; "" for none. */
export function formatRestSeconds(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  if (seconds < 60 || seconds % 30 !== 0) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec ? `${m}:${String(sec).padStart(2, "0")}` : `${m} min`;
}

/**
 * The columns actually rendered as prescription inputs, in order — Notes
 * excluded, since it's rendered separately and always.
 */
export function listPrescriptionColumns(clientId: number): TrainingColumn[] {
  return listTrainingColumns(clientId).filter((c) => c.key !== "notes" && c.visible);
}

/**
 * Every column the coach can pick from: the ones already on this client
 * (whatever their visibility) plus any builtin they haven't added yet, so
 * the chip row shows all six from the start rather than only what exists.
 * Notes is filtered out — it isn't a choice.
 */
export function listColumnChoices(clientId: number) {
  const existing = listTrainingColumns(clientId).filter((c) => c.key !== "notes");
  const byKey = new Map(existing.map((c) => [c.key, c]));
  const builtins = AVAILABLE_TRAINING_COLUMNS.map((def) => {
    const row = byKey.get(def.key);
    return {
      id: row?.id ?? null,
      key: def.key,
      label: row?.label ?? def.label,
      kind: "builtin" as const,
      visible: row?.visible ?? false,
    };
  });
  const customs = existing
    .filter((c) => c.kind === "custom")
    .map((c) => ({ id: c.id, key: c.key, label: c.label, kind: "custom" as const, visible: c.visible }));
  return [...builtins, ...customs];
}

/**
 * Switch a builtin column on or off, creating the row the first time it's
 * used. Refuses to exceed MAX_TRAINING_COLUMNS rather than silently
 * dropping one — the UI greys the remaining chips at the cap, so hitting
 * this is a race, not a normal path.
 */
export function setBuiltinColumnVisible(clientId: number, key: string, visible: boolean) {
  const data = getData();
  const all = listTrainingColumns(clientId);
  if (visible && all.filter((c) => c.key !== "notes" && c.visible).length >= MAX_TRAINING_COLUMNS) return;

  const existing = all.find((c) => c.client_id === clientId && c.key === key);
  if (existing) {
    existing.visible = visible;
    persist();
    return;
  }
  const def = AVAILABLE_TRAINING_COLUMNS.find((d) => d.key === key);
  if (!def) return;
  data.training_columns.push({
    id: allocId("training_columns"),
    client_id: clientId,
    key: def.key,
    label: def.label,
    kind: "builtin",
    visible,
    order_index: AVAILABLE_TRAINING_COLUMNS.findIndex((d) => d.key === key),
  });
  persist();
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

export type CompletedDay = {
  dayId: number;
  dayOfWeek: number;
  label: string | null;
  weekNumber: number;
  completedAt: string;
};

// A day counts as "completed" once every one of its assignments has at
// least as many logged sets as its target — this is the same doneAllSets
// check the client's own Training tab uses to show "All sets logged for
// today". completedAt is the most recent of those sets' timestamps, i.e.
// the moment the day actually finished, not when it started. Rest days
// (no assignments) never appear — there's nothing to complete.
export function getCompletedDaysForClient(clientId: number, limit = 10): CompletedDay[] {
  const data = getData();
  const days = data.program_days.filter((d) => d.client_id === clientId);
  const results: CompletedDay[] = [];

  days.forEach((day) => {
    const assignments = data.workout_assignments.filter((a) => a.program_day_id === day.id);
    if (assignments.length === 0) return;

    let completedAt: string | null = null;
    const allDone = assignments.every((a) => {
      const logs = data.set_logs.filter((l) => l.workout_assignment_id === a.id);
      if (logs.length < a.sets) return false;
      logs.forEach((l) => {
        if (!completedAt || l.logged_at > completedAt!) completedAt = l.logged_at;
      });
      return true;
    });

    if (allDone && completedAt) {
      results.push({ dayId: day.id, dayOfWeek: day.day_of_week, label: day.label, weekNumber: day.week_number, completedAt });
    }
  });

  return results.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)).slice(0, limit);
}

// Percent change in logged weight for one exercise, earliest log through
// the given program week — a fast "is this number trending up" signal for
// the coach next to the last-week target/actual reference, rather than
// needing to open the full Strength Progress chart to eyeball a direction.
// Scoped to logs from weeks <= throughWeekNumber so the badge reflects how
// far the client has come AS OF the week being viewed, instead of a single
// whole-history number that reads the same on every week.
//
// With gyms, pass the gym: another gym's machine is a different weight, so
// mixing the two would read a gym switch as a drop. undefined is every set.
export function getExerciseWeightTrendPct(
  clientId: number,
  exerciseId: number,
  throughWeekNumber: number,
  gymId?: number | null
): number | null {
  const data = getData();
  const home = homeGymId(clientId);
  const atGym = (l: SetLog) => gymId === undefined || home == null || (l.gym_id ?? home) === (gymId ?? home);
  const assignmentIds = new Set(
    data.workout_assignments
      .filter((wa) => {
        if (wa.exercise_id !== exerciseId) return false;
        const day = data.program_days.find((pd) => pd.id === wa.program_day_id);
        return day?.client_id === clientId && day.week_number <= throughWeekNumber;
      })
      .map((wa) => wa.id)
  );
  const logs = data.set_logs
    .filter((l) => assignmentIds.has(l.workout_assignment_id) && l.weight_kg != null && atGym(l))
    .sort((a, b) => (a.logged_at < b.logged_at ? -1 : 1));
  if (logs.length < 2) return null;
  const first = logs[0].weight_kg as number;
  const last = logs[logs.length - 1].weight_kg as number;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
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
/**
 * Everything the right-hand client overview panel shows, assembled in one
 * pass. Built as a single query rather than a dozen calls from the component
 * because the panel is on screen for every client, on every tab — the cost of
 * walking the store repeatedly is paid on every single admin render.
 */
export type OverviewInfoRow = { label: string; value: string; field?: string; tone?: "good" };

export type OverviewPanel = {
  name: string;
  initial: string;
  avatarPath: string | null;
  clientSince: string | null;
  phase: string | null;
  /** value is the figure; suffix is the unit or qualifier beside it, set
   *  in a lighter weight so the number reads first. */
  snapshot: { label: string; value: string; suffix?: string; attention?: boolean }[];
  /** The phase running on each track, and how far through it they are. */
  tags: { label: string; track: "training" | "nutrition" | "lifestyle"; weekNow: number; weeks: number }[];
  /** Age · client since · city · email, for the line under the name. */
  meta: { age: string | null; since: string | null; city: string | null; email: string | null };
  coachNote: { text: string; savedLabel: string | null };
  goals: ClientGoal[];
  /** value is "" when empty; field names the card field that edits it, absent
   *  on rows derived from elsewhere (plan, current week, weight). */
  memberInfo: OverviewInfoRow[];
  coachingInfo: OverviewInfoRow[];
  /** recent: logged this week. */
  activity: { id: string; when: string; text: string; recent: boolean }[];
  /** The raw, editable values behind the two info blocks.
   *
   * The blocks above are formatted for reading ("178 cm", "—"); an edit form
   * needs what's actually stored, or saving an untouched field would write
   * the em dash back into the record. Plan, current week and current weight
   * are deliberately absent: they are derived from the live programme and the
   * client's own logs, and typing over them would be a lie. */
  card: {
    name: string;
    birthdate: string;
    gender: string;
    height_cm: string;
    email: string;
    phone_code: string;
    phone: string;
    address: string;
    coaching_start_date: string;
    goal_phase: string;
    goal_phase_from_plan: string | null;
    goal_date: string;
    check_in_day: string;
    starting_weight_kg: string;
  };
};

export function getOverviewPanel(clientId: number): OverviewPanel {
  const client = getClient(clientId);
  const profile = getClientProfile(clientId);
  const summary = getClientSummary(clientId);
  const nutrition = getNutritionGoalsSummary(clientId);
  const weight = getLatestWeight(clientId);
  const invoices = listInvoices(clientId);
  const today = localDateStr();

  const text =(v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  // Weight now against the starting weight, with a true minus sign.
  const weightChange = (() => {
    if (weight == null || profile.starting_weight_kg == null) return "";
    const delta = Math.round((weight - profile.starting_weight_kg) * 10) / 10;
    const abs = Number.isInteger(delta) ? String(Math.abs(delta)) : Math.abs(delta).toFixed(1);
    return `${delta < 0 ? "−" : delta > 0 ? "+" : ""}${abs} kg`;
  })();

  const nextMeeting = listMeetings(clientId)
    .filter((m) => m.status === "scheduled" && m.date >= today)
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))[0];

  const unpaid = invoices.filter((i) => i.status !== "paid").length;
  const dailyMetrics = listMetricDefinitions(clientId, "daily").length;
  const weeklyMetrics = listMetricDefinitions(clientId, "weekly").length;
  const metricCount = dailyMetrics + weeklyMetrics;

  // Weight now against where it was when the block began, not against a
  // figure from six months ago: inside a cut, "−0.8 kg this phase" is the
  // number a coach acts on, and "+1.6 kg since the start" is history.
  const weightPhase =
    getCurrentPhase(clientId, "nutrition") ?? getCurrentPhase(clientId, "training") ?? getCurrentPhase(clientId, "lifestyle");
  const weightMove = (() => {
    if (weight == null) return "";
    const series = getWeightSeriesAll(clientId);
    let base: number | null = null;
    let when = "since the start";
    if (weightPhase && series.length > 0) {
      // What they weighed going in: whichever reading sits nearest the day
      // the phase began, either side of it. Taking the last one BEFORE it
      // reached back months when a client had stopped logging, and taking
      // the first one INSIDE it missed the start when they logged late.
      const start = new Date(`${weightPhase.start_week}T00:00:00`).getTime();
      const nearest = series.reduce((best, s) =>
        Math.abs(new Date(`${s.date}T00:00:00`).getTime() - start) < Math.abs(new Date(`${best.date}T00:00:00`).getTime() - start) ? s : best
      );
      // A reading more than a month either side of the start is not what
      // they weighed at the start; fall back to the coaching figure.
      if (Math.abs(new Date(`${nearest.date}T00:00:00`).getTime() - start) <= 31 * 86400000) {
        base = nearest.value;
        when = "this phase";
      }
    }
    if (base == null) base = profile.starting_weight_kg ?? null;
    if (base == null) return "";
    const delta = Math.round((weight - base) * 10) / 10;
    if (delta === 0) return `level ${when}`;
    const abs = Number.isInteger(delta) ? String(Math.abs(delta)) : Math.abs(delta).toFixed(1);
    return `${delta < 0 ? "−" : "+"}${abs} kg ${when}`;
  })();

  // Workouts done this week against what's owed — the figure a coach glances
  // at first, so it leads the snapshot.
  const liveProgram = getDeployedProgram(clientId);
  const liveWeek = liveProgram ? liveProgram.start_week + getProgramCurrentWeekIndex(liveProgram) - 1 : null;
  let trained = 0;
  let planned = 0;
  if (liveWeek != null) {
    getWeek(clientId, liveWeek).forEach((d) => {
      const assignments = getAssignmentsForDay(d.id);
      if (assignments.length === 0) return;
      planned++;
      if (assignments.some((a) => getLogsForAssignment(a.id).length > 0)) trained++;
    });
  }

  const fmtDate = (iso: string | null | undefined) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "-";

  return {
    name: client?.name ?? "Unknown",
    initial: (client?.name ?? "?").slice(0, 1).toUpperCase(),
    avatarPath: client?.avatar_path ?? null,
    clientSince: profile.coaching_start_date ? `Client since ${fmtDate(profile.coaching_start_date)}` : null,
    phase: effectiveGoalPhase(clientId, profile.goal_phase) || null,
    tags: (["training", "nutrition", "lifestyle"] as const)
      .map((track) => {
        const ph = getCurrentPhase(clientId, track);
        if (!ph) return null;
        // Phases are whole weeks, Monday to Monday, so both figures count weeks.
        const week = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / (7 * 86400000));
        return { track, label: ph.name, weekNow: week(ph.start_week, weekStart(today)) + 1, weeks: week(ph.start_week, ph.end_week) + 1 };
      })
      .filter((t): t is { track: "training" | "nutrition" | "lifestyle"; label: string; weekNow: number; weeks: number } => !!t),
    meta: {
      age: profile.birthdate ? `${Math.floor((Date.now() - new Date(`${profile.birthdate}T00:00:00`).getTime()) / 31557600000)}` : null,
      since: profile.coaching_start_date ? fmtDate(profile.coaching_start_date) : null,
      // The last part of the address is the town, which is all the header needs.
      city: (profile.address ?? "").split(",").map((p) => p.trim()).filter(Boolean).pop() ?? null,
      email: profile.email || null,
    },
    coachNote: {
      text: client?.coach_note ?? "",
      savedLabel: client?.coach_note_at
        ? new Date(client.coach_note_at).toLocaleDateString("en-US", { day: "numeric", month: "short" })
        : null,
    },
    snapshot: [
      {
        // No "done this week" under it and no amber on the figure: the label
        // says what it is, and a week that has only just started is not a
        // problem to be coloured.
        label: "Training",
        value: planned ? `${trained} of ${planned}` : "-",
        suffix: planned ? "sessions this week" : undefined,
      },
      {
        label: "Next meeting",
        value: nextMeeting
          ? new Date(`${nextMeeting.date}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })
          : "None booked",
        suffix: nextMeeting ? nextMeeting.time : undefined,
        attention: !nextMeeting,
      },
      {
        // The figure and, under it, what it is made of — a coach reading
        // "2,929" wants to know whether that is 200g of protein or 120.
        label: "Nutrition goal",
        value: nutrition.trainingKcal ? `${nutrition.trainingKcal.toLocaleString("en-US")} kcal` : "-",
        suffix: nutrition.trainingKcal
          ? `P ${nutrition.trainingProtein} · C ${nutrition.trainingCarbs} · F ${nutrition.trainingFats}`
          : undefined,
      },
      { label: "Weight", value: weight != null ? `${weight} kg` : "-", suffix: weightMove || undefined },
      { label: "Metrics tracked", value: String(metricCount), suffix: `${dailyMetrics} daily · ${weeklyMetrics} weekly` },
      { label: "Invoices", value: unpaid ? String(unpaid) : "0", suffix: "outstanding", attention: unpaid > 0 },
    ],
    goals: listClientGoals(clientId),
    // Empty is "", not a dash: the panel shows an Add link there instead.
    memberInfo: [
      { label: "Birthdate", value: text(profile.birthdate), field: "birthdate" },
      { label: "Gender", value: text(profile.gender), field: "gender" },
      { label: "Height", value: profile.height_cm ? `${profile.height_cm} cm` : "", field: "height_cm" },
      { label: "Email", value: text(profile.email), field: "email" },
      // Code and number joined for show: "+31 6 45787628".
      { label: "Phone", value: profile.phone ? [profile.phone_code, profile.phone].filter(Boolean).join(" ") : "", field: "phone" },
      { label: "Address", value: text(profile.address), field: "address" },
    ],
    // The goal / phase is the pill under the name, so it isn't repeated here.
    coachingInfo: [
      { label: "Plan", value: liveProgram?.name || "" },
      // The two dates sit together: the block a client is in reads as a span.
      { label: "Start date", value: text(profile.coaching_start_date), field: "coaching_start_date" },
      { label: "Goal date", value: text(profile.goal_date), field: "goal_date" },
      { label: "Current week", value: liveWeek != null ? `Week ${liveWeek}` : "" },
      { label: "Check-in day", value: text(profile.check_in_day), field: "check_in_day" },
      { label: "Starting weight", value: profile.starting_weight_kg ? `${profile.starting_weight_kg} kg` : "", field: "starting_weight_kg" },
      { label: "Current weight", value: weight != null ? `${weight} kg` : "" },
      { label: "Change", value: weightChange, tone: "good" },
    ],
    activity: getActivityFeed(coachIdOfClient(clientId) ?? 0)
      .filter((e) => e.clientId === clientId)
      .slice(0, 8)
      .map((e) => ({
        id: e.id,
        when: feedTimeLabel(e.at, e.timeKnown),
        text: e.text.charAt(0).toUpperCase() + e.text.slice(1),
        recent: e.at >= new Date(`${weekStart(today)}T00:00:00`).getTime(),
      })),
    card: {
      name: client?.name ?? "",
      birthdate: profile.birthdate ?? "",
      gender: profile.gender ?? "",
      height_cm: profile.height_cm != null ? String(profile.height_cm) : "",
      email: profile.email ?? "",
      phone_code: profile.phone_code ?? "",
      phone: profile.phone ?? "",
      address: profile.address ?? "",
      coaching_start_date: profile.coaching_start_date ?? "",
      goal_phase: profile.goal_phase ?? "",
      // When the Plan tab has a phase running this week, that is the goal /
      // phase: the card shows it read-only and points at the plan.
      goal_phase_from_plan: getCurrentPhase(clientId, "nutrition")?.name ?? null,
      goal_date: profile.goal_date ?? "",
      check_in_day: profile.check_in_day ?? "",
      starting_weight_kg:
        profile.starting_weight_kg != null ? String(profile.starting_weight_kg) : "",
    },
  };
}

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
// store — nothing here is synthesized. When a new kind of client logging is
// built, add a branch here rather than faking events in the UI.

export type FeedCategory = "training" | "nutrition" | "measurements" | "notes" | "billing";

export type FeedEvent = {
  id: string;
  category: FeedCategory;
  clientId: number;
  clientName: string;
  /** Epoch ms, so every kind of stamp orders and groups together. */
  at: number;
  /** False for check-in values saved before they carried a time: the day
      is known, the hour is not. */
  timeKnown: boolean;
  /** The admin tab the row opens on. */
  tab: string;
  /** The training session the event is about, so its card can carry the dot. */
  dayId?: number;
  /** What happened, written to follow the client's name. */
  text: string;
  /** The client's own words, when the event carries them. */
  note: string | null;
  /** Progress picture thumbnails. */
  thumbs: string[];
};

// Stamps come in two shapes: ISO instants, and "YYYY-MM-DD HH:MM:SS" in
// server-local time (set logs, cardio; see localStamp). Reading the second
// as UTC put every workout two hours late in Amsterdam.
function stampMs(at: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(at);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  return new Date(at).getTime();
}
// A day with no time: midday, so it files under its own day.
const middayMs = (day: string) => stampMs(`${day} 12:00:00`);
const latestOf = (a: string | null, b: string | undefined) => (b && (!a || stampMs(b) > stampMs(a)) ? b : a);

const feedDay = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const feedValue = (v: number) => String(Math.round(v * 10) / 10);

/** Everything one coach's clients logged, newest first. The Feed page filters and pages it. */
export function getActivityFeed(coachId: number): FeedEvent[] {
  const data = getData();
  // Only this coach's clients: an event for anyone else is dropped in add().
  const clientsById = new Map(data.clients.filter((c) => c.coach_id === coachId).map((c) => [c.id, c] as const));
  const assignmentsById = new Map(data.workout_assignments.map((wa) => [wa.id, wa] as const));
  const daysById = new Map(data.program_days.map((pd) => [pd.id, pd] as const));

  const events: FeedEvent[] = [];
  const add = (
    clientId: number,
    e: Pick<FeedEvent, "id" | "category" | "at" | "tab" | "text"> & Partial<Pick<FeedEvent, "note" | "thumbs" | "timeKnown" | "dayId">>
  ) => {
    const client = clientsById.get(clientId);
    if (!client || !Number.isFinite(e.at)) return;
    events.push({ note: null, thumbs: [], timeKnown: true, ...e, clientId, clientName: client.name });
  };

  // "Session 2 · Push A (Week 3)", with the week counted inside its programme.
  const dayTitle = (day: { client_id: number; week_number: number; day_of_week: number; label: string | null }) => {
    const program = data.training_programs.find(
      (p) => p.client_id === day.client_id && day.week_number >= p.start_week && day.week_number < p.start_week + p.total_weeks
    );
    const week = program ? programWeekLabel(program, day.week_number) : `Week ${day.week_number}`;
    return `Session ${day.day_of_week}${day.label ? ` · ${day.label}` : ""} (${week})`;
  };

  // ---- Training ----
  // A workout shows once, when the whole day is done: every exercise on it
  // has at least its prescribed sets logged. Stamped with the set that
  // finished it. A half-done session is not news.
  const logsByDay = new Map<number, typeof data.set_logs>();
  data.set_logs.forEach((sl) => {
    const wa = assignmentsById.get(sl.workout_assignment_id);
    if (!wa) return;
    const list = logsByDay.get(wa.program_day_id) ?? [];
    list.push(sl);
    logsByDay.set(wa.program_day_id, list);
  });
  logsByDay.forEach((logs, dayId) => {
    const day = daysById.get(dayId);
    if (!day) return;
    const assignments = data.workout_assignments.filter((wa) => wa.program_day_id === dayId);
    if (assignments.length === 0) return;
    const sorted = [...logs].sort((a, b) => stampMs(a.logged_at) - stampMs(b.logged_at));
    const seen = new Map<number, number>();
    let completedAt: string | null = null;
    for (const sl of sorted) {
      seen.set(sl.workout_assignment_id, (seen.get(sl.workout_assignment_id) ?? 0) + 1);
      if (assignments.every((wa) => (seen.get(wa.id) ?? 0) >= wa.sets)) {
        completedAt = sl.logged_at;
        break;
      }
    }
    if (!completedAt) return;
    add(day.client_id, {
      id: `workout-${dayId}`,
      category: "training",
      at: stampMs(completedAt),
      tab: "training",
      dayId,
      text: `completed ${dayTitle(day)} · ${plural(assignments.length, "exercise")}, ${plural(logs.length, "set")}`,
    });
  });

  for (const log of data.cardio_logs ?? []) {
    const entry = (data.cardio_entries ?? []).find((c) => c.id === log.cardio_entry_id);
    const day = entry ? daysById.get(entry.program_day_id) : undefined;
    const what = entry ? [entry.name, entry.time, entry.distance].filter((s) => s && s.trim()).join(", ") : "";
    add(log.client_id, {
      id: `cardio-${log.id}`,
      category: "training",
      at: stampMs(log.done_at),
      tab: "training",
      dayId: day?.id,
      text: `ticked off cardio${what ? `: ${what}` : ""}${day ? ` · ${dayTitle(day)}` : ""}`,
    });
  }

  // A session the client said they could not do, in their words.
  for (const day of data.program_days) {
    if (!day.skip_reason || !day.skip_reason_at) continue;
    add(day.client_id, {
      id: `skip-${day.id}`,
      category: "training",
      at: stampMs(day.skip_reason_at),
      tab: "training",
      dayId: day.id,
      text: `couldn't do ${dayTitle(day)}`,
      note: day.skip_reason,
    });
  }

  // ---- Nutrition ----
  for (const c of data.calorie_logs) {
    add(c.client_id, {
      id: `calories-${c.id}`,
      category: "nutrition",
      // Entries saved before timestamps existed fall back to their day.
      at: c.logged_at ? stampMs(c.logged_at) : middayMs(c.date),
      timeKnown: !!c.logged_at,
      tab: "nutrition",
      text: `logged ${c.kcal.toLocaleString("en-GB")} kcal for ${feedDay(c.date)}`,
      note: c.note?.trim() || null,
    });
  }

  // ---- Measurements: check-ins, measurements, progress pictures ----
  // One row per check-in, not per number: the daily check-in for a day, the
  // weekly one for a week, the measurements for a date. The client's note on
  // that check-in rides on the same row.
  type CheckIn = {
    clientId: number;
    kind: "daily" | "weekly" | "monthly" | "measurements";
    period: string;
    count: number;
    values: { order: number; text: string }[];
    latest: string | null;
    note: string | null;
  };
  const checkIns = new Map<string, CheckIn>();
  const checkIn = (clientId: number, kind: CheckIn["kind"], period: string) => {
    const key = `${clientId}:${kind}:${period}`;
    let c = checkIns.get(key);
    if (!c) {
      c = { clientId, kind, period, count: 0, values: [], latest: null, note: null };
      checkIns.set(key, c);
    }
    return c;
  };

  const metricDefs = new Map(data.metric_definitions.map((d) => [d.id, d] as const));
  for (const e of data.metric_entries) {
    const def = metricDefs.get(e.metric_definition_id);
    if (!def || e.value == null) continue;
    const c = checkIn(def.client_id, def.frequency, e.period);
    c.count++;
    c.latest = latestOf(c.latest, e.logged_at);
  }
  const fields = new Map(data.measurement_fields.map((f) => [f.id, f] as const));
  for (const v of data.measurement_values) {
    const field = fields.get(v.field_id);
    if (!field || v.value == null) continue;
    const c = checkIn(field.client_id, "measurements", v.date);
    c.count++;
    c.values.push({ order: field.order_index, text: `${field.name} ${feedValue(v.value)}${field.unit ? ` ${field.unit}` : ""}` });
    c.latest = latestOf(c.latest, v.logged_at);
  }
  for (const n of data.check_in_notes) {
    const c = checkIn(n.client_id, n.kind, n.period);
    c.note = n.text;
    c.latest = latestOf(c.latest, n.created_at);
  }

  checkIns.forEach((c) => {
    const when =
      c.kind === "weekly" ? `the week of ${feedDay(c.period)}` : c.kind === "monthly" ? c.period.slice(0, 7) : feedDay(c.period);
    const name = c.kind === "measurements" ? "measurements" : `${c.kind} check-in`;
    let text: string;
    if (c.count === 0) text = `left a note on the ${name} for ${when}`;
    else if (c.kind === "measurements")
      text = `logged measurements for ${when}: ${c.values.sort((a, b) => a.order - b.order).map((v) => v.text).join(", ")}`;
    else text = `did the ${name} for ${when} · ${plural(c.count, "metric")}`;
    add(c.clientId, {
      id: `checkin-${c.clientId}-${c.kind}-${c.period}`,
      // A note with no numbers is a note, first and foremost.
      category: c.count === 0 ? "notes" : "measurements",
      at: c.latest ? stampMs(c.latest) : middayMs(c.period),
      timeKnown: !!c.latest,
      tab: "measurements",
      text,
      note: c.note,
    });
  });

  const slotsById = new Map(data.photo_slots.map((s) => [s.id, s] as const));
  const sheets = new Map<string, { clientId: number; period: string; photos: { order: number; src: string }[]; latest: string | null }>();
  for (const u of data.photo_uploads) {
    const slot = slotsById.get(u.slot_id);
    if (!slot) continue;
    const key = `${slot.client_id}:${u.period}`;
    const sheet = sheets.get(key) ?? { clientId: slot.client_id, period: u.period, photos: [], latest: null };
    sheet.photos.push({ order: slot.order_index, src: u.file_path });
    sheet.latest = latestOf(sheet.latest, u.uploaded_at);
    sheets.set(key, sheet);
  }
  sheets.forEach((s) => {
    add(s.clientId, {
      id: `photos-${s.clientId}-${s.period}`,
      category: "measurements",
      at: s.latest ? stampMs(s.latest) : middayMs(s.period),
      tab: "photos",
      text: `sent ${plural(s.photos.length, "progress picture")} for the sheet of ${feedDay(s.period)}`,
      thumbs: s.photos.sort((a, b) => a.order - b.order).map((p) => p.src),
    });
  });

  // ---- Notes the client writes outside a check-in ----
  for (const n of data.client_program_notes ?? []) {
    if (!n.text.trim()) continue;
    const program = data.training_programs.find((p) => p.id === n.program_id);
    add(n.client_id, {
      id: `program-note-${n.id}`,
      category: "notes",
      at: stampMs(n.updated_at),
      tab: "training",
      text: `wrote a note on ${program?.name || "their programme"}`,
      note: n.text,
    });
  }
  // Not the client's "My notes" on an exercise (client_exercise_notes): those
  // are their own reminders, private to them, and never shown to the coach.

  // ---- Billing ----
  for (const inv of data.invoices) {
    add(inv.client_id, {
      id: `invoice-${inv.id}-${inv.updated_at}`,
      category: "billing",
      at: stampMs(inv.updated_at),
      tab: "plan",
      text: `had their invoice “${inv.description}” marked ${inv.status}`,
    });
  }

  return events.sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1));
}

// ---- Sign-in lockouts -----------------------------------------------------
// The locks themselves live in memory (lib/loginLockout.ts); this is the
// record of each one starting, so a coach and the owner can see it happened.

export type LoginLockEvent = { id: number; at: string; email: string; ip: string; scope: LockScope; cleared?: boolean };

/** Writes down a sign-in lock that just started. */
export function recordLoginLock(email: string, ip: string, scope: LockScope) {
  const data = getData();
  const list = [
    ...(data.login_lock_events ?? []),
    { id: allocId("login_lock_events"), at: new Date().toISOString(), email: email.trim().toLowerCase(), ip, scope },
  ];
  data.login_lock_events = list.slice(-200);
  persist();
}

export type LoginLockView = LoginLockEvent & {
  /** "Sam Rivera", "Your account", "Coach x@y", or no account at all. */
  who: string;
  clientId: number | null;
  /** Still locked: within its 15 minutes and not ended by a reset or a sign-in. */
  active: boolean;
};

/**
 * The locks a coach should see from the last `days` days, newest first: their
 * own account and their clients' logins. The owner sees every lock, other
 * coaches' and emails with no account included.
 */
export function listLoginLocks(coach: { id: number; email: string }, owner: boolean, days = 7): LoginLockView[] {
  const data = getData();
  const now = Date.now();
  const since = now - days * 86400000;
  const coachEmail = coach.email.toLowerCase();
  const out: LoginLockView[] = [];
  for (const e of data.login_lock_events ?? []) {
    const at = new Date(e.at).getTime();
    if (at < since) continue;
    const user = data.users.find((u) => u.email === e.email);
    const client = user?.role === "client" && user.client_id != null ? data.clients.find((c) => c.id === user.client_id) : undefined;
    const mine = e.email === coachEmail || client?.coach_id === coach.id;
    if (!mine && !owner) continue;
    const who = client
      ? client.name
      : user?.role === "coach"
      ? e.email === coachEmail
        ? "Your account"
        : `Coach ${e.email}`
      : "An email with no account";
    out.push({ ...e, who, clientId: client?.id ?? null, active: !e.cleared && at + LOCK_MS > now });
  }
  return out.reverse();
}

/** Whether a client's login is locked right now. */
export function clientLockedOut(clientId: number): boolean {
  const data = getData();
  const user = data.users.find((u) => u.role === "client" && u.client_id === clientId);
  if (!user) return false;
  const now = Date.now();
  return (data.login_lock_events ?? []).some((e) => e.email === user.email && !e.cleared && new Date(e.at).getTime() + LOCK_MS > now);
}

/** "14:05" in the coach's clock. */
export function feedClock(at: number): string {
  return new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "3 Sep · 14:05", or just "3 Sep" when the time was never recorded. */
export function feedTimeLabel(at: number, timeKnown = true): string {
  const date = new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return timeKnown ? `${date} · ${feedClock(at)}` : date;
}

/**
 * Every coach account, for the owner's Coaches page: the email, how many
 * clients the coach has and when one of them last logged something. Nothing
 * about the clients themselves.
 */
export function listCoachAccounts() {
  const data = getData();
  return data.users
    .filter((u) => u.role === "coach")
    .sort((a, b) => a.id - b.id)
    .map((u) => {
      const latest = getActivityFeed(u.id)[0];
      return {
        id: u.id,
        email: u.email,
        clients: data.clients.filter((c) => c.coach_id === u.id).length,
        lastActivity: latest ? feedTimeLabel(latest.at, latest.timeKnown) : null,
        mustChangePassword: u.must_change_password,
      };
    });
}

// ---- Nutrition plan: coach's macro/vitamin/supplement targets for a client ----
// Mirrors the "Voeding en supplementen" tab from the original sheet. This is
// the coach's target plan, not a food diary — actual meal-by-meal logging by
// the client is a separate, not-yet-built feature.

// The client-level plan as stored: what writers edit. Reads go through
// getNutritionPlan, which lays the running nutrition phase's targets on top.
export function getStoredNutritionPlan(clientId: number): NutritionPlan {
  const existing = getData().nutrition_plans.find((p) => p.client_id === clientId);
  if (existing) return existing;
  return {
    client_id: clientId,
    name: null,
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

// What the client is on right now: the stored plan, with the targets and
// note of the nutrition phase running this week laid over it when that
// phase has its own. Water and supplements stay client-level.
export function getNutritionPlan(clientId: number): NutritionPlan {
  const stored = getStoredNutritionPlan(clientId);
  const phase = getCurrentPhase(clientId, "nutrition");
  if (!phase?.nutrition) return stored;
  return { ...stored, name: phase.name, day_targets: phase.nutrition.day_targets, coach_notes: phase.nutrition.coach_notes };
}

// Nutrition phases the coach can still set numbers for: the running one and
// everything ahead, plus last week's for context. Oldest first.
export function listNutritionPhases(clientId: number): (ClientPhase & { status: "past" | "now" | "next" | "draft" })[] {
  const week = weekStart(localDateStr());
  const d = new Date(`${week}T00:00:00`);
  d.setDate(d.getDate() - 7);
  const lastWeek = localDateStr(d);
  return listClientPhases(clientId)
    .filter((p) => p.track === "nutrition" && p.end_week >= lastWeek)
    .map((p) => ({ ...p, status: p.draft ? "draft" : p.end_week < week ? "past" : p.start_week > week ? "next" : "now" }));
}

/** The lifestyle phases, with the same states the nutrition rail uses. */
export function listLifestylePhases(clientId: number): (ClientPhase & { status: "past" | "now" | "next" | "draft" })[] {
  const week = weekStart(localDateStr());
  const d = new Date(`${week}T00:00:00`);
  d.setDate(d.getDate() - 7);
  const lastWeek = localDateStr(d);
  return listClientPhases(clientId)
    .filter((p) => p.track === "lifestyle" && p.end_week >= lastWeek)
    .map((p) => ({ ...p, status: p.draft ? "draft" : p.end_week < week ? "past" : p.start_week > week ? "next" : "now" }));
}

function nutritionPhaseFor(clientId: number, phaseId: number): ClientPhase | null {
  const phase = getData().client_phases.find((p) => p.id === phaseId);
  return phase && phase.client_id === clientId && phase.track === "nutrition" ? phase : null;
}

// Deploys a draft nutrition phase (its dates then make it scheduled or live),
// or takes a scheduled one back to draft. A phase the client is already in,
// or that has ended, can't go back: they have seen it.
// Returns true when a draft was deployed.
export function setNutritionPhaseDraft(phaseId: number, draft: boolean): boolean {
  const phase = getData().client_phases.find((p) => p.id === phaseId);
  if (!phase || phase.track !== "nutrition" || !!phase.draft === draft) return false;
  if (draft) {
    if (phase.start_week <= weekStart(localDateStr())) return false;
    phase.draft = true;
  } else {
    delete phase.draft;
  }
  persist();
  // Going live now tells the client, as a deployed programme does. A
  // scheduled phase stays quiet: its targets are not theirs to see yet.
  if (!draft && phase.start_week <= weekStart(localDateStr())) {
    logCoachActivity(phase.client_id, `Your coach set new nutrition targets${phase.name ? `: ${phase.name}` : ""}. Check them out`, {
      kind: "programme",
      actionTab: "nutrition",
      actionLabel: "See your targets",
    });
  }
  return !draft;
}

// The note under the targets: on a phase when one is named, else client-level.
export function setNutritionNote(clientId: number, note: string, phaseId: number | null = null) {
  const phase = phaseId ? nutritionPhaseFor(clientId, phaseId) : null;
  if (phase) {
    const current = phase.nutrition ?? { day_targets: getStoredNutritionPlan(clientId).day_targets ?? emptyDayTargets(), coach_notes: "" };
    phase.nutrition = { ...current, coach_notes: note };
    persist();
    return;
  }
  const plan = getStoredNutritionPlan(clientId);
  plan.coach_notes = note;
  saveNutritionPlan(plan);
}

function emptyDayTargets() {
  return { training: { protein: null, carbs: null, fats: null }, rest: { protein: null, carbs: null, fats: null } };
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
  // Deployed to the client's check-in screen; see deployedToClient().
  visible_to_client?: boolean;
  // One of the six figures pinned to the coach's rail; see togglePinMeasurementField.
  pinned?: boolean;
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

// Measurement fields are the legacy check-in columns (Weight/Waist). They
// used to be auto-seeded for every client on first open, which meant every
// new client came with two figures the coach never chose and could not
// remove. New clients now start empty and get Weight, Waist and the rest
// from the metric library like every other column; clients who already had
// the seeded fields keep them and their history.
export function listMeasurementFields(clientId: number): MeasurementFieldDef[] {
  return getData()
    .measurement_fields.filter((f) => f.client_id === clientId)
    .sort((a, b) => a.order_index - b.order_index);
}

// Where this client's weight lives: the legacy Weight measurement field if
// they have one, otherwise a metric-library "Weight" column (daily first,
// then weekly, then monthly). Everything that needs "the client's weight" —
// the Home chart, the snapshot's current weight, the graph fallback — reads
// through here so the two storage shapes never disagree.
export function getWeightSeriesAll(clientId: number): { date: string; value: number }[] {
  const field = listMeasurementFields(clientId).find((f) => f.name.toLowerCase().includes("weight"));
  if (field) return getMeasurementSeries(field.id);
  const rank: Record<string, number> = { daily: 0, weekly: 1, monthly: 2 };
  const def = getData()
    .metric_definitions.filter((m) => m.client_id === clientId && m.name.toLowerCase().includes("weight"))
    .sort((a, b) => (rank[a.frequency] ?? 9) - (rank[b.frequency] ?? 9))[0];
  return def ? getMetricSeries(def.id) : [];
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
// loggedAt is passed by the client's check-in, so the coach's feed knows when.
export function setMeasurementValue(fieldId: number, date: string, value: number | null, loggedAt?: string) {
  const data = getData();
  const existing = data.measurement_values.find(
    (v) => v.field_id === fieldId && v.date === date
  );
  if (existing) {
    existing.value = value;
    if (loggedAt) existing.logged_at = loggedAt;
  } else {
    data.measurement_values.push({
      id: allocId("measurement_values"),
      client_id: data.measurement_fields.find((f) => f.id === fieldId)?.client_id ?? 0,
      field_id: fieldId,
      date,
      value,
      ...(loggedAt ? { logged_at: loggedAt } : {}),
    });
  }
  persist();
}

/**
 * The client's measurement field with this name, created when missing. For
 * the seed scripts: the load-time tidy in db.ts drops seeded Weight/Waist
 * fields that have no values yet, so a script can't assume they exist.
 */
export function ensureMeasurementField(clientId: number, name: string, unit: string) {
  const find = () => listMeasurementFields(clientId).find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (!find()) addMeasurementField(clientId, name, unit);
  return find()!;
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
  // The rhythm the client is asked for this on. "monthly" is what the
  // old separate measurements sheet became: cadence is a property of a
  // metric, which is why Daily Tracker and Weekly Tracker stopped being
  // their own screens.
  frequency: MetricCadence;
  // Which way this metric is meant to move, for the Change row.
  good_direction?: "up" | "down" | "none";
  /** The lifestyle phase that asks for it; absent means the standing set. */
  phase_id?: number | null;
  order_index: number;
  pinned?: boolean;
  // Deployed to the client's check-in screen; see deployedToClient().
  visible_to_client?: boolean;
};
export type MetricEntry = {
  id: number;
  metric_definition_id: number;
  period: string;
  value: number | null;
};

export type MetricCadence = "daily" | "weekly" | "monthly";

// The groups a metric can belong to, in the order they appear on the coach's
// own spreadsheets. Group is a first-class property: it drives the band rows
// above the history tables and the order of the columns beneath them, so
// three nutrition metrics always sit together under one NUTRITION band.
// The tints carry the category on a pill and a key, so they have to be seen
// at a glance: pale enough for the label to read on, strong enough to tell
// two categories apart across a list.
export const METRIC_GROUPS = [
  { key: "body", label: "Body", tint: "#cfe0f2" },
  { key: "sleep", label: "Sleep", tint: "#d8d3f0" },
  { key: "activity", label: "Activity", tint: "#c9e7d5" },
  { key: "fatigue", label: "Fatigue", tint: "#f4dcc0" },
  { key: "lifestyle", label: "Lifestyle", tint: "#c9e6ea" },
  { key: "stress", label: "Stress", tint: "#f3cfcf" },
  { key: "nutrition", label: "Nutrition", tint: "#e6ebb8" },
  { key: "training", label: "Training", tint: "#d5d2f3" },
  { key: "wellbeing", label: "General wellbeing", tint: "#e2d7ee" },
  { key: "measurements", label: "Measurements", tint: "#dde3e9" },
  { key: "optional", label: "Optional", tint: "#e8e3d8" },
  { key: "other", label: "Other", tint: "#dfe6ef" },
] as const;

export function metricGroup(key: string): { key: string; label: string; tint: string } {
  const found = METRIC_GROUPS.find((g) => g.key === key);
  if (found) return found;

  // Metrics created before groups were a fixed set carry free-text categories
  // ("Recovery", "Wellbeing"). Match them by label so existing clients band
  // correctly instead of every column reading "Other", and fall back to a
  // couple of known synonyms from the older seeds.
  const lower = (key ?? "").trim().toLowerCase();
  const byLabel = METRIC_GROUPS.find((g) => g.label.toLowerCase() === lower);
  if (byLabel) return byLabel;

  const synonyms: Record<string, string> = {
    recovery: "sleep",
    wellbeing: "wellbeing",
    "general wellbeing": "wellbeing",
    mood: "wellbeing",
    measurement: "measurements",
  };
  const mapped = synonyms[lower];
  const bySynonym = mapped ? METRIC_GROUPS.find((g) => g.key === mapped) : undefined;
  return bySynonym ?? METRIC_GROUPS[METRIC_GROUPS.length - 1];
}

/**
 * The metric library: the coach's existing spreadsheets, section for section,
 * so setting a client up is ticking boxes rather than retyping forty rows.
 * Translated from the Dutch originals.
 */
export type LibraryPack = {
  id: string;
  label: string;
  group: string;
  cadence: MetricCadence;
  items: { name: string; unit: string }[];
};

export const METRIC_LIBRARY: LibraryPack[] = [
  // ---- Daily sheet ----
  { id: "d_body", label: "Body", group: "body", cadence: "daily",
    items: [{ name: "Weight", unit: "kg" }, { name: "Resting HR", unit: "bpm" }] },
  { id: "d_sleep", label: "Sleep", group: "sleep", cadence: "daily",
    items: [{ name: "Hours of sleep", unit: "h" }, { name: "Morning energy", unit: "/10" }] },
  { id: "d_activity", label: "Activity", group: "activity", cadence: "daily",
    items: [{ name: "Steps", unit: "" }, { name: "Screen time", unit: "h" }] },
  { id: "d_fatigue", label: "Fatigue", group: "fatigue", cadence: "daily",
    items: [{ name: "Afternoon", unit: "/10" }, { name: "Early evening", unit: "/10" }] },
  { id: "d_lifestyle", label: "Lifestyle", group: "lifestyle", cadence: "daily",
    items: [{ name: "Fluid intake", unit: "L" }, { name: "Daylight", unit: "min" }] },

  // ---- Week tracker (all /10) ----
  { id: "w_stress", label: "Stress", group: "stress", cadence: "weekly",
    items: [
      { name: "Stress factors of the last week", unit: "/10" },
      { name: "Work", unit: "/10" },
      { name: "Private", unit: "/10" },
      { name: "Social", unit: "/10" },
      { name: "Stress factors getting in the way of goals", unit: "/10" },
      { name: "Managing stress", unit: "/10" },
    ] },
  { id: "w_nutrition", label: "Nutrition", group: "nutrition", cadence: "weekly",
    items: [
      { name: "Consistency of meal timing", unit: "/10" },
      { name: "Quality of nutrition", unit: "/10" },
      { name: "Bloatedness", unit: "/10" },
      { name: "Stool", unit: "/10" },
      { name: "Enjoyment of eating", unit: "/10" },
      { name: "Cravings", unit: "/10" },
      { name: "Hunger", unit: "/10" },
    ] },
  { id: "w_training", label: "Training", group: "training", cadence: "weekly",
    items: [
      { name: "Enjoyment of training", unit: "/10" },
      { name: "Recovery", unit: "/10" },
      { name: "Adherence to programme", unit: "/10" },
      { name: "Fatigue during training", unit: "/10" },
    ] },
  { id: "w_wellbeing", label: "General wellbeing", group: "wellbeing", cadence: "weekly",
    items: [
      { name: "Happiness", unit: "/10" },
      { name: "Development", unit: "/10" },
      { name: "Contribution to goals", unit: "/10" },
      { name: "Motivation", unit: "/10" },
      { name: "Habit development", unit: "/10" },
      { name: "Satisfaction with the week", unit: "/10" },
    ] },
  { id: "w_optional", label: "Optional", group: "optional", cadence: "weekly",
    items: [{ name: "Menstruation", unit: "/10" }] },

  // ---- Monthly ----
  { id: "m_measure", label: "Measurements", group: "measurements", cadence: "monthly",
    items: [
      { name: "Waist", unit: "cm" },
      { name: "Hips", unit: "cm" },
      { name: "Chest", unit: "cm" },
      { name: "Thigh", unit: "cm" },
      { name: "Arm", unit: "cm" },
      { name: "Neck", unit: "cm" },
      { name: "Body fat", unit: "%" },
    ] },
];

/** Every metric on this client, sorted by cadence then group then order. */
export function listAllMetrics(clientId: number): MetricDefinition[] {
  // Grouped by category in METRIC_GROUPS order, which puts "Other" last;
  // within a group, the order they were added. Cadence no longer sorts,
  // since it is a toggle on the row and a column can change rhythm without
  // jumping around the list.
  const groupRank = new Map<string, number>(METRIC_GROUPS.map((g, i) => [g.key as string, i]));
  return getData()
    .metric_definitions.filter((m) => m.client_id === clientId)
    .sort((a, b) => {
      const g = (groupRank.get(metricGroup(a.category).key) ?? 99) - (groupRank.get(metricGroup(b.category).key) ?? 99);
      if (g !== 0) return g;
      return a.order_index - b.order_index;
    });
}

/** Adds every ticked library item that isn't already on this client. */
export function addMetricsFromLibraryPhased(
  clientId: number,
  picks: { name: string; unit: string; group: string; cadence: MetricCadence }[],
  phaseId: number | null
) {
  for (const p of picks) addMetricDefinition(clientId, p.group, p.name, p.unit, p.cadence, phaseId);
}

export function addMetricsFromLibrary(
  clientId: number,
  picks: { name: string; unit: string; group: string; cadence: MetricCadence }[]
) {
  const data = getData();
  const existing = new Set(
    data.metric_definitions
      .filter((m) => m.client_id === clientId)
      .map((m) => `${m.frequency}|${m.name.toLowerCase()}`)
  );
  let added = 0;
  picks.forEach((pick) => {
    const key = `${pick.cadence}|${pick.name.toLowerCase()}`;
    if (existing.has(key)) return;
    existing.add(key);
    data.metric_definitions.push({
      id: allocId("metric_definitions"),
      client_id: clientId,
      category: pick.group,
      name: pick.name,
      unit: pick.unit,
      frequency: pick.cadence,
      order_index: data.metric_definitions.filter((m) => m.client_id === clientId).length,
      visible_to_client: true,
    });
    added++;
  });
  if (added) persist();
  return added;
}

export function listMetricDefinitions(
  clientId: number,
  frequency: MetricCadence
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
  frequency: MetricCadence,
  /** The lifestyle phase being set up, when one is. */
  phaseId: number | null = null
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
    ...(phaseId != null ? { phase_id: phaseId } : {}),
    order_index: count,
  });
  persist();
}

/**
 * The metrics a phase asks for: its own, plus the client's standing set —
 * everything from before phases owned metrics — which is asked for whatever
 * is running. A draft phase has none of its own, so it starts blank; the
 * standing set only shows on the phase the client is actually in, so a new
 * draft is not quietly pre-filled by it.
 */
export function listMetricsForPhase(clientId: number, phaseId: number | null, isLive: boolean): MetricDefinition[] {
  return listAllMetrics(clientId).filter((m) => {
    if (m.phase_id != null) return m.phase_id === phaseId;
    // The standing set: shown while the running phase is on screen, and when
    // the client has no lifestyle phases at all.
    return isLive;
  });
}

/** Everything one phase asks for, copied onto another. Nothing is moved. */
export function copyPhaseMetrics(fromPhaseId: number | null, toPhaseId: number, clientId: number, fromIsLive: boolean) {
  const data = getData();
  const source = listMetricsForPhase(clientId, fromPhaseId, fromIsLive);
  const already = new Set(
    data.metric_definitions.filter((m) => m.client_id === clientId && m.phase_id === toPhaseId).map((m) => m.name.toLowerCase())
  );
  for (const m of source) {
    if (already.has(m.name.toLowerCase())) continue;
    data.metric_definitions.push({
      ...m,
      id: allocId("metric_definitions"),
      phase_id: toPhaseId,
    });
  }
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

// Change how often a column is asked for. Existing entries keep their period
// keys (a date for daily, the week's Monday for weekly), so history is never
// touched; only what the client is asked from now on changes.
export function setMetricCadence(id: number, frequency: MetricCadence) {
  const data = getData();
  const def = data.metric_definitions.find((m) => m.id === id);
  if (!def || def.frequency === frequency) return;
  def.frequency = frequency;
  persist();
}

export function removeMetricDefinition(id: number) {
  const data = getData();
  data.metric_definitions = data.metric_definitions.filter((m) => m.id !== id);
  data.metric_entries = data.metric_entries.filter((e) => e.metric_definition_id !== id);
  persist();
}

// Pinning surfaces a figure on the coach's rail beside whatever tab they're
// working in, and at the top of the client's Start Page. Any daily metric,
// weekly metric or measurement field qualifies, and the cap is shared across
// all three — the coach picks six things total, not six of each. Six is what
// fits the rail's three-column grid in two clean rows.
export const PINNED_METRIC_LIMIT = 4;

export function countPinned(clientId: number): number {
  const data = getData();
  return (
    data.metric_definitions.filter((m) => m.client_id === clientId && m.pinned).length +
    data.measurement_fields.filter((f) => f.client_id === clientId && f.pinned).length
  );
}

const PIN_FULL_REASON = `Only ${PINNED_METRIC_LIMIT} can be pinned at once. Unpin one first.`;

export function togglePinMetric(id: number): { ok: boolean; reason?: string } {
  const data = getData();
  const def = data.metric_definitions.find((m) => m.id === id);
  if (!def) return { ok: false, reason: "Metric not found." };
  if (!def.pinned && countPinned(def.client_id) >= PINNED_METRIC_LIMIT) {
    return { ok: false, reason: PIN_FULL_REASON };
  }
  def.pinned = !def.pinned;
  persist();
  return { ok: true };
}

export function togglePinMeasurementField(id: number): { ok: boolean; reason?: string } {
  const data = getData();
  const field = data.measurement_fields.find((f) => f.id === id);
  if (!field) return { ok: false, reason: "Measurement not found." };
  if (!field.pinned && countPinned(field.client_id) >= PINNED_METRIC_LIMIT) {
    return { ok: false, reason: PIN_FULL_REASON };
  }
  field.pinned = !field.pinned;
  persist();
  return { ok: true };
}

export type PinnedMetricSummary = {
  def: MetricDefinition;
  latest: number | null;
  latestPeriod: string | null;
  average: number | null;
  entryCount: number;
};

// Latest value + running average for every metric the coach has pinned for
// this client, across both daily and weekly trackers — used by the Start
// Page's pinned-metrics panel.
export function getPinnedMetricsSummary(clientId: number): PinnedMetricSummary[] {
  const data = getData();
  const defs = data.metric_definitions.filter((m) => m.client_id === clientId && m.pinned);
  return defs.map((def) => {
    const logged = data.metric_entries
      .filter((e) => e.metric_definition_id === def.id && e.value != null)
      .sort((a, b) => (a.period < b.period ? -1 : 1));
    const latestEntry = logged.length > 0 ? logged[logged.length - 1] : null;
    const average =
      logged.length >= 3 ? logged.reduce((sum, e) => sum + (e.value as number), 0) / logged.length : null;
    return {
      def,
      latest: latestEntry?.value ?? null,
      latestPeriod: latestEntry?.period ?? null,
      average,
      entryCount: logged.length,
    };
  });
}

// ---- Client graphs: which of this client's figures are charted on their
// Home screen. The coach picks up to PINNED_METRIC_LIMIT (4) across BOTH
// tracker metrics and measurement fields (Weight lives in the latter), and
// each pick is one slide of the client's trend carousel. "pinned" is the
// stored flag; this layer turns it into one flat, ordered list so the admin
// picker and the client page agree on what is graphed and in what order. ----

export type GraphChoice = {
  key: string; // "field-<id>" | "metric-<id>", unique across both tables
  kind: "field" | "metric";
  id: number;
  name: string;
  unit: string;
  cadenceLabel: string;
  pinned: boolean;
  pointCount: number;
};

export function getMeasurementSeries(fieldId: number): { date: string; value: number }[] {
  return getMeasurementValues([fieldId])
    .filter((v) => v.value != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((v) => ({ date: v.date, value: v.value as number }));
}

// Every figure the coach could graph for this client, measurements first
// (Weight leads) then tracker metrics in their usual display order.
export function listGraphChoices(clientId: number): GraphChoice[] {
  const fields: GraphChoice[] = listMeasurementFields(clientId).map((f) => ({
    key: `field-${f.id}`,
    kind: "field",
    id: f.id,
    name: f.name,
    unit: f.unit,
    cadenceLabel: "Check-in",
    pinned: !!f.pinned,
    pointCount: getMeasurementSeries(f.id).length,
  }));
  const cadence: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
  const metrics: GraphChoice[] = listAllMetrics(clientId).map((m) => ({
    key: `metric-${m.id}`,
    kind: "metric",
    id: m.id,
    name: m.name,
    unit: m.unit,
    cadenceLabel: cadence[m.frequency] ?? m.frequency,
    pinned: !!m.pinned,
    pointCount: getMetricSeries(m.id).length,
  }));
  return [...fields, ...metrics];
}

// The graphed set with its data, in carousel order. A client whose coach has
// never picked anything still gets a Weight chart if they track weight at
// all, which is what the Home screen always showed before the picker existed.
export function getGraphedSeries(
  clientId: number
): { key: string; name: string; unit: string; series: { date: string; value: number }[] }[] {
  const choices = listGraphChoices(clientId);
  let picked = choices.filter((c) => c.pinned);
  if (picked.length === 0) {
    const weight = choices.find((c) => c.name.toLowerCase().includes("weight"));
    if (weight) picked = [weight];
  }
  return picked.map((c) => ({
    key: c.key,
    name: c.name,
    unit: c.unit,
    series: c.kind === "field" ? getMeasurementSeries(c.id) : getMetricSeries(c.id),
  }));
}

// Full logged history for one metric, oldest first, ready to hand straight
// to <LineChart> — used by the per-metric trend view in the Tracker tabs.
/**
 * One history table: the client's own entries, newest first, as a grid of
 * period rows against metric columns.
 *
 * Columns arrive already sorted by group (see listAllMetrics), so consecutive
 * same-group columns can be collapsed into one spanning band above the names
 * — the same visual logic as the coloured section headers on the coach's
 * spreadsheet.
 */
export type HistoryColumn = { id: number; name: string; unit: string; group: string };
export type HistoryBand = { group: string; label: string; tint: string; span: number };
export type HistoryRow = { period: string; label: string; values: (number | null)[]; note: string | null };
export type HistoryChange = { delta: number | null; pct: number | null; label: string }[];

export type MetricHistory = {
  columns: HistoryColumn[];
  bands: HistoryBand[];
  rows: HistoryRow[];
  change: HistoryChange;
};

export function getMetricHistory(clientId: number, cadence: MetricCadence): MetricHistory {
  const data = getData();
  const defs = listAllMetrics(clientId).filter((m) => m.frequency === cadence);

  const columns: HistoryColumn[] = defs.map((d) => ({
    id: d.id,
    name: d.name,
    unit: d.unit,
    group: d.category,
  }));

  // Collapse runs of the same group into one spanning header.
  const bands: HistoryBand[] = [];
  columns.forEach((c) => {
    const g = metricGroup(c.group);
    const last = bands[bands.length - 1];
    if (last && last.group === g.key) {
      last.span++;
      return;
    }
    bands.push({ group: g.key, label: g.label, tint: g.tint, span: 1 });
  });

  const ids = new Set(defs.map((d) => d.id));
  const periods = Array.from(
    new Set(data.metric_entries.filter((e) => ids.has(e.metric_definition_id)).map((e) => e.period))
  ).sort((a, b) => b.localeCompare(a));

  const noteKind: CheckInNote["kind"] | null = cadence === "daily" ? "daily" : cadence === "weekly" ? "weekly" : null;
  const rows: HistoryRow[] = periods.map((period) => ({
    period,
    note: noteKind ? getCheckInNote(clientId, noteKind, period) : null,
    label: new Date(`${period}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: cadence === "monthly" ? "numeric" : undefined,
    }),
    values: defs.map(
      (d) =>
        data.metric_entries.find((e) => e.metric_definition_id === d.id && e.period === period)?.value ?? null
    ),
  }));

  // First to latest, per column — the row pinned to the bottom of the table.
  const change: HistoryChange = defs.map((_, i) => {
    const withValues = [...rows].reverse().filter((r) => r.values[i] != null);
    if (withValues.length < 2) return { delta: null, pct: null, label: "-" };
    const first = withValues[0].values[i]!;
    const latest = withValues[withValues.length - 1].values[i]!;
    const delta = latest - first;
    const pct = first !== 0 ? (delta / first) * 100 : null;
    const sign = delta > 0 ? "+" : "";
    return {
      delta,
      pct,
      label: `${sign}${Number(delta.toFixed(1))}${pct != null ? ` (${sign}${pct.toFixed(0)}%)` : ""}`,
    };
  });

  return { columns, bands, rows, change };
}

export function getMetricSeries(metricDefinitionId: number): { date: string; value: number }[] {
  return getData()
    .metric_entries.filter((e) => e.metric_definition_id === metricDefinitionId && e.value != null)
    .map((e) => ({ date: e.period, value: e.value as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Distinct category/name values already in use across ONE COACH'S clients
// (plus that coach's template categories/items), so the "Add a metric" form
// can offer a dropdown of things already set up elsewhere instead of the
// coach retyping "Sleep" or "Stress" from scratch for every new client. The
// coach can still type a brand-new value — this only supplies suggestions.
function coachClientIds(coachId: number): Set<number> {
  return new Set(getData().clients.filter((c) => c.coach_id === coachId).map((c) => c.id));
}

export function listDistinctMetricCategories(coachId: number, frequency: "daily" | "weekly"): string[] {
  const data = getData();
  const mine = coachClientIds(coachId);
  const fromDefs = data.metric_definitions.filter((d) => mine.has(d.client_id) && d.frequency === frequency).map((d) => d.category);
  const fromTemplates = data.metric_template_categories.filter((t) => t.coach_id === coachId && t.frequency === frequency).map((t) => t.name);
  return [...new Set([...fromDefs, ...fromTemplates])].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function listDistinctMetricNames(coachId: number, frequency: "daily" | "weekly"): { name: string; unit: string }[] {
  const data = getData();
  const mine = coachClientIds(coachId);
  const seen = new Map<string, string>();
  data.metric_definitions
    .filter((d) => mine.has(d.client_id) && d.frequency === frequency)
    .forEach((d) => {
      if (!seen.has(d.name)) seen.set(d.name, d.unit);
    });
  data.metric_template_items.forEach((item) => {
    const cat = data.metric_template_categories.find((c) => c.id === item.template_category_id);
    if (cat && cat.coach_id === coachId && cat.frequency === frequency && !seen.has(item.name)) seen.set(item.name, item.unit);
  });
  return [...seen.entries()]
    .map(([name, unit]) => ({ name, unit }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Same idea for Measurement check-in columns (Weight, Waist, Body fat %,
// etc.) — these don't have a "category", just a name + unit, so one
// dropdown of names already used across every client is enough.
export function listDistinctMeasurementFieldNames(coachId: number): { name: string; unit: string }[] {
  const data = getData();
  const mine = coachClientIds(coachId);
  const seen = new Map<string, string>();
  data.measurement_fields.forEach((f) => {
    if (mine.has(f.client_id) && !seen.has(f.name)) seen.set(f.name, f.unit);
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
  // The rhythm the client is asked for this on. "monthly" is what the
  // old separate measurements sheet became: cadence is a property of a
  // metric, which is why Daily Tracker and Weekly Tracker stopped being
  // their own screens.
  frequency: MetricCadence;
  order_index: number;
  coach_id?: number;
};
export type MetricTemplateItem = {
  id: number;
  template_category_id: number;
  name: string;
  unit: string;
  order_index: number;
};

export function listMetricTemplateCategories(coachId: number, frequency?: "daily" | "weekly"): MetricTemplateCategory[] {
  return getData()
    .metric_template_categories.filter((t) => t.coach_id === coachId && (!frequency || t.frequency === frequency))
    .sort((a, b) => a.order_index - b.order_index);
}

export function listMetricTemplateItems(templateCategoryId: number): MetricTemplateItem[] {
  return getData()
    .metric_template_items.filter((i) => i.template_category_id === templateCategoryId)
    .sort((a, b) => a.order_index - b.order_index);
}

// coachId null only from a seed script on a store with no coach yet (see createClient).
export function addMetricTemplateCategory(coachId: number | null, name: string, frequency: "daily" | "weekly") {
  const data = getData();
  const count = data.metric_template_categories.filter((t) => t.coach_id === (coachId ?? undefined) && t.frequency === frequency).length;
  const id = allocId("metric_template_categories");
  data.metric_template_categories.push({ id, name, frequency, order_index: count, ...(coachId != null ? { coach_id: coachId } : {}) });
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
  // A template only applies to a client of the coach who owns it.
  if (!template || template.coach_id !== coachIdOfClient(clientId)) return;
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
export function setMetricEntry(metricDefinitionId: number, period: string, value: number | null, loggedAt?: string) {
  const data = getData();
  const existing = data.metric_entries.find(
    (e) => e.metric_definition_id === metricDefinitionId && e.period === period
  );
  if (existing) {
    existing.value = value;
    if (loggedAt) existing.logged_at = loggedAt;
  } else {
    data.metric_entries.push({
      id: allocId("metric_entries"),
      metric_definition_id: metricDefinitionId,
      period,
      value,
      ...(loggedAt ? { logged_at: loggedAt } : {}),
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

export type PhotoSlot = { id: number; client_id: number; label: string; order_index: number; paused?: boolean };
export type PhotoUpload = {
  id: number;
  slot_id: number;
  period: string;
  file_path: string;
  uploaded_at: string;
};

export type PhotoCadence = "weekly" | "biweekly" | "monthly" | "sixweekly";

export const PHOTO_CADENCE_LABELS: Record<PhotoCadence, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
  sixweekly: "Every 6 weeks",
};

// Weeks per sheet for the week-based cadences. Monthly is calendar-based.
const PHOTO_WEEKS_PER_SHEET: Record<Exclude<PhotoCadence, "monthly">, number> = {
  weekly: 1,
  biweekly: 2,
  sixweekly: 6,
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
  const span = PHOTO_WEEKS_PER_SHEET[cadence];
  if (span === 1) return monday;
  // Six-weekly buckets use the same fixed epoch as biweekly ones.
  const epoch = new Date(`${PHOTO_BIWEEKLY_EPOCH}T00:00:00`);
  const cur = new Date(`${monday}T00:00:00`);
  const weeksSinceEpoch = Math.round((cur.getTime() - epoch.getTime()) / (7 * 86400000));
  const bucketWeeks = weeksSinceEpoch - (((weeksSinceEpoch % span) + span) % span);
  const bucketDate = new Date(epoch.getTime() + bucketWeeks * 7 * 86400000);
  return localDateStr(bucketDate);
}

// The day the sheet after `period` opens, on the calendar buckets.
export function nextPhotoPeriodStart(period: string, cadence: PhotoCadence): string {
  const d = new Date(`${period}T00:00:00`);
  if (cadence === "monthly") return localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  d.setDate(d.getDate() + 7 * PHOTO_WEEKS_PER_SHEET[cadence]);
  return localDateStr(d);
}

// ---- Sheet dates anchored on the coach's start date ----
// With a start date the first sheet opens on it and every later one a
// cadence step on (1 Oct + monthly gives 1 Nov, 1 Dec), whenever the cadence
// was picked. Without one, photoPeriodFor's calendar buckets still apply,
// which is also what sheets uploaded before the date existed are keyed on.

export function getPhotoStartDate(clientId: number): string | null {
  return getData().photo_settings.find((s) => s.client_id === clientId)?.photo_start_date ?? null;
}

export function setPhotoStartDate(clientId: number, date: string | null) {
  const data = getData();
  let row = data.photo_settings.find((s) => s.client_id === clientId);
  if (!row) {
    row = { client_id: clientId, cadence: "weekly" };
    data.photo_settings.push(row);
  }
  row.photo_start_date = date;
  persist();
}

// The coach's note on how to take the pictures; null when there is none.
export function getPhotoInstructions(clientId: number): string | null {
  return getData().photo_settings.find((s) => s.client_id === clientId)?.photo_instructions?.trim() || null;
}

export function setPhotoInstructions(clientId: number, text: string) {
  const data = getData();
  let row = data.photo_settings.find((s) => s.client_id === clientId);
  if (!row) {
    row = { client_id: clientId, cadence: "weekly" };
    data.photo_settings.push(row);
  }
  row.photo_instructions = text.trim() || null;
  persist();
}

// The day sheet n (0 = the first) opens. Monthly keeps the start's day of
// the month, clamped in shorter months: 31 Jan, 28 Feb, 31 Mar.
function photoSheetOpening(start: string, cadence: PhotoCadence, n: number): string {
  const [y, m, d] = start.split("-").map(Number);
  if (cadence === "monthly") {
    const daysInMonth = new Date(y, m + n, 0).getDate();
    return localDateStr(new Date(y, m - 1 + n, Math.min(d, daysInMonth)));
  }
  return localDateStr(new Date(y, m - 1, d + 7 * PHOTO_WEEKS_PER_SHEET[cadence] * n));
}

// Which sheet number a day falls in; negative before the start date.
function photoSheetNumber(start: string, cadence: PhotoCadence, day: string): number {
  if (cadence === "monthly") {
    const [sy, sm] = start.split("-").map(Number);
    const [y, m] = day.split("-").map(Number);
    const n = (y - sy) * 12 + (m - sm);
    return photoSheetOpening(start, cadence, n) > day ? n - 1 : n;
  }
  const days = Math.round((new Date(`${day}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000);
  return Math.floor(days / (7 * PHOTO_WEEKS_PER_SHEET[cadence]));
}

// The sheet a day belongs to, keyed by the day it opened. null before the
// coach's first sheet date: nothing is open yet.
export function photoSheetFor(clientId: number, day: string): string | null {
  const cadence = getPhotoCadence(clientId);
  const start = getPhotoStartDate(clientId);
  if (!start) return photoPeriodFor(day, cadence);
  if (day < start) return null;
  return photoSheetOpening(start, cadence, photoSheetNumber(start, cadence, day));
}

// The next `count` days a sheet opens after `day`, starting with the first
// sheet itself while `day` is still before it.
export function upcomingPhotoSheets(clientId: number, day: string, count: number): string[] {
  const cadence = getPhotoCadence(clientId);
  const start = getPhotoStartDate(clientId);
  const out: string[] = [];
  if (!start) {
    let next = nextPhotoPeriodStart(photoPeriodFor(day, cadence), cadence);
    while (out.length < count) {
      out.push(next);
      next = nextPhotoPeriodStart(next, cadence);
    }
    return out;
  }
  const first = day < start ? 0 : photoSheetNumber(start, cadence, day) + 1;
  for (let n = first; out.length < count; n++) out.push(photoSheetOpening(start, cadence, n));
  return out;
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
  saved_at?: string | null;
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

// The angles new sheets ask for. Paused ones stay in listPhotoSlots so the
// sheets they were already on still show them.
export function listActivePhotoSlots(clientId: number): PhotoSlot[] {
  return listPhotoSlots(clientId).filter((s) => !s.paused);
}

export function setPhotoSlotPaused(id: number, paused: boolean) {
  const data = getData();
  const slot = data.photo_slots.find((s) => s.id === id);
  if (!slot) return;
  slot.paused = paused;
  persist();
}

export function reorderPhotoSlots(clientId: number, orderedIds: number[]) {
  const data = getData();
  const mine = data.photo_slots.filter((s) => s.client_id === clientId);
  const rest = mine.filter((s) => !orderedIds.includes(s.id)).sort((a, b) => a.order_index - b.order_index);
  const sequence = [...orderedIds.map((id) => mine.find((s) => s.id === id)).filter((s): s is PhotoSlot => !!s), ...rest];
  sequence.forEach((s, i) => (s.order_index = i));
  persist();
}

// When the client was last reminded about this sheet. Photo reminders carry
// a reminder:photos… dedupe key that ends in the client and period.
export function lastPhotoReminderAt(clientId: number, period: string): string | null {
  const tail = `:${clientId}:${period}`;
  const stamps = getData()
    .coach_activity.filter(
      (a) => a.client_id === clientId && a.kind === "reminder" && !!a.dedupe_key?.startsWith("reminder:photos") && a.dedupe_key.includes(tail)
    )
    .map((a) => a.created_at)
    .sort();
  return stamps[stamps.length - 1] ?? null;
}

// Writes the uploaded file under DATA_DIR/uploads and records it — this is
// the only place in the app that touches the filesystem outside db.ts, since
// it deals with actual image bytes rather than JSON data. Served back out by
// the app/uploads/[...path] route handler rather than Next's static /public
// serving, since DATA_DIR (a mounted volume in production) lives outside it.
// A demo video the coach uploaded from their own computer, for one
// prescription. Stored under DATA_DIR like the progress photos — /public
// is baked into the build, so anything written there vanishes on the next
// deploy — and served back through the /uploads route.
//
// Named by assignment id, so re-uploading replaces rather than accumulating
// dead files nothing points at.
export function saveDemoVideoUpload(
  clientId: number,
  assignmentId: number,
  buffer: Buffer,
  mimeType: string
): string {
  const ext = (mimeType.split("/")[1] || "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4";
  const dir = path.join(DATA_DIR, "uploads", "demos", String(clientId));
  fs.mkdirSync(dir, { recursive: true });

  // Drop any previous upload for this assignment whatever its extension —
  // otherwise switching from .mov to .mp4 leaves the old file orphaned.
  for (const existing of fs.readdirSync(dir)) {
    if (existing.startsWith(`${assignmentId}.`)) fs.rmSync(path.join(dir, existing), { force: true });
  }

  const filename = `${assignmentId}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/demos/${clientId}/${filename}`;
}

export function savePhotoUpload(clientId: number, slotId: number, buffer: Buffer, mimeType: string): string {
  const period = photoSheetFor(clientId, localDateStr());
  // Before the coach's first sheet date there is no sheet to file it in.
  if (!period) return "";
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




// ---- Client Settings preferences ----

export type ClientPreferences = {
  client_id: number;
  coach_notes: boolean;
  checkin_reminders: boolean;
  weekly_digest: boolean;
  units: "metric" | "imperial";
};

const DEFAULT_CLIENT_PREFERENCES: Omit<ClientPreferences, "client_id"> = {
  coach_notes: true,
  checkin_reminders: true,
  weekly_digest: false,
  units: "metric",
};

export function getClientPreferences(clientId: number): ClientPreferences {
  const existing = getData().client_preferences.find((p) => p.client_id === clientId);
  return existing ?? { client_id: clientId, ...DEFAULT_CLIENT_PREFERENCES };
}

function upsertClientPreferences(clientId: number): ClientPreferences {
  const data = getData();
  let row = data.client_preferences.find((p) => p.client_id === clientId);
  if (!row) {
    row = { client_id: clientId, ...DEFAULT_CLIENT_PREFERENCES };
    data.client_preferences.push(row);
  }
  return row;
}

export function setClientPreference(
  clientId: number,
  key: "coach_notes" | "checkin_reminders" | "weekly_digest",
  value: boolean
) {
  const row = upsertClientPreferences(clientId);
  row[key] = value;
  persist();
}

// Not yet wired to any display — every kg/cm value in the app still shows
// the units it's stored in. Saved now so the preference survives once
// each display surface adds the actual conversion, same as how a coach's
// water_goal free text is a stated target before this app can track it.
export function setClientUnits(clientId: number, units: "metric" | "imperial") {
  const row = upsertClientPreferences(clientId);
  row.units = units;
  persist();
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

// Same volume calculation as getStrengthSeries, scoped to one exercise —
// the per-exercise drilldown inside Training's Strength Progress section.
export function getExerciseStrengthSeries(clientId: number, exerciseId: number, days: number) {
  const data = getData();
  const assignmentIds = new Set(
    data.workout_assignments
      .filter((wa) => {
        if (wa.exercise_id !== exerciseId) return false;
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

// Every exercise this client has at least one logged set for, ordered by
// name — populates the exercise picker in Strength Progress.
export function listLoggedExercisesForClient(clientId: number): { id: number; name: string }[] {
  const data = getData();
  const dayIds = new Set(data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.id));
  const assignments = data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id));
  const loggedAssignmentIds = new Set(data.set_logs.map((sl) => sl.workout_assignment_id));
  const exerciseIds = new Set(
    assignments.filter((wa) => loggedAssignmentIds.has(wa.id)).map((wa) => wa.exercise_id)
  );
  return data.exercises
    .filter((e) => exerciseIds.has(e.id))
    .map((e) => ({ id: e.id, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return getWeightSeriesAll(clientId).filter((p) => new Date(p.date) >= cutoff);
}

export type ClientProfile = {
  client_id: number;
  birthdate: string | null;
  // Optional so the profile rows written before these existed still satisfy
  // the type — getData()'s schema patch back-fills missing tables, not
  // missing columns. Read them with ?? null.
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  /** The dial code for `phone` ("+31"); absent on phones typed before the split. */
  phone_code?: string | null;
  address?: string | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
  coaching_start_date: string | null;
  current_week: string;
  goal_phase: string;
  goal_phase_start_date: string | null;
  goal_date: string | null;
  main_goal?: string | null;
  main_goal_saved_at?: string | null;
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
    goal_phase_start_date: null,
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
  // The card form doesn't carry main_goal (it's set from the Plan tab), so a
  // card save keeps whatever is already stored.
  const main_goal =
    profile.main_goal !== undefined ? profile.main_goal : idx >= 0 ? (data.client_profiles[idx].main_goal ?? null) : null;
  const main_goal_saved_at =
    profile.main_goal_saved_at !== undefined
      ? profile.main_goal_saved_at
      : idx >= 0
      ? (data.client_profiles[idx].main_goal_saved_at ?? null)
      : null;
  const next = { ...profile, main_goal, main_goal_saved_at };
  if (idx >= 0) data.client_profiles[idx] = next;
  else data.client_profiles.push(next);
  persist();
}

/** The coach's headline goal for the client; empty clears it. */
export function setClientMainGoal(clientId: number, text: string) {
  const profile = getClientProfile(clientId);
  saveClientProfile({ ...profile, main_goal: text.trim() || null, main_goal_saved_at: new Date().toISOString() });
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
  const values = getWeightSeriesAll(clientId);
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
  created_at?: string;
  tracked_by?: GoalTracking | null;
  meeting_id?: number | null;
};

// One list of goals per client. The stored `term` field is a leftover of
// the short/long split the old Start Page drew; nothing reads it now.
export function listClientGoals(clientId: number): ClientGoal[] {
  return getData()
    .client_goals.filter((g) => g.client_id === clientId)
    .sort((a, b) => a.order_index - b.order_index);
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

export function macroKcal(protein: number | null, carbs: number | null, fats: number | null): number {
  return (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fats ?? 0) * 9;
}

// With a phase id the targets belong to that nutrition phase; without one
// they are the client-level plan.
export function setNutritionDayTargets(
  clientId: number,
  training: { protein: number | null; carbs: number | null; fats: number | null },
  rest: { protein: number | null; carbs: number | null; fats: number | null },
  phaseId: number | null = null
) {
  const phase = phaseId ? nutritionPhaseFor(clientId, phaseId) : null;
  if (phase) {
    // A phase saved for the first time starts as a copy of the client-level
    // plan, note included, so what the coach saw in the box is what sticks.
    phase.nutrition = { day_targets: { training, rest }, coach_notes: phase.nutrition?.coach_notes ?? getStoredNutritionPlan(clientId).coach_notes ?? "" };
    persist();
    return;
  }
  const plan = getStoredNutritionPlan(clientId);
  plan.day_targets = { training, rest };
  saveNutritionPlan(plan);
}

export function setNutritionWater(clientId: number, litres: number | null) {
  const plan = getStoredNutritionPlan(clientId);
  plan.water_l = litres;
  saveNutritionPlan(plan);
}

export type SupplementChanges = {
  added: { name: string; quantity: string; timing: string; notes: string }[];
  updated: { id: number; name: string; quantity: string; timing: string; notes: string }[];
  removedIds: number[];
  /** Existing ids in the order the coach dragged them into; new rows follow. */
  order?: number[];
};

/** Everything the coach queued on the supplements sheet, landed at once. */
export function applySupplementChanges(clientId: number, changes: SupplementChanges) {
  const plan = getStoredNutritionPlan(clientId);
  let rows = plan.supplement_rows ?? [];
  rows = rows.filter((r) => !changes.removedIds.includes(r.id));
  for (const u of changes.updated) {
    const row = rows.find((r) => r.id === u.id);
    if (row) Object.assign(row, { name: u.name.trim(), quantity: u.quantity.trim(), timing: u.timing.trim(), notes: u.notes.trim() });
  }
  for (const a of changes.added) {
    if (!a.name.trim()) continue;
    rows.push({ id: allocId("supplement_rows"), name: a.name.trim(), quantity: a.quantity.trim(), timing: a.timing.trim(), notes: a.notes.trim() });
  }
  if (changes.order) {
    const pos = new Map(changes.order.map((id, i) => [id, i]));
    rows = rows
      .map((r, i) => ({ r, key: pos.has(r.id) ? pos.get(r.id)! : changes.order!.length + i }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.r);
  }
  plan.supplement_rows = rows;
  saveNutritionPlan(plan);
}

export function addSupplementRow(clientId: number, name = "") {
  const plan = getStoredNutritionPlan(clientId);
  const rows = plan.supplement_rows ?? [];
  rows.push({ id: allocId("supplement_rows"), name: name.trim(), quantity: "", timing: "", notes: "" });
  plan.supplement_rows = rows;
  saveNutritionPlan(plan);
}

export function updateSupplementRow(
  clientId: number,
  rowId: number,
  field: "name" | "quantity" | "timing" | "notes",
  value: string
) {
  const plan = getStoredNutritionPlan(clientId);
  const row = (plan.supplement_rows ?? []).find((r) => r.id === rowId);
  if (!row) return;
  row[field] = value;
  saveNutritionPlan(plan);
}

export function removeSupplementRow(clientId: number, rowId: number) {
  const plan = getStoredNutritionPlan(clientId);
  plan.supplement_rows = (plan.supplement_rows ?? []).filter((r) => r.id !== rowId);
  saveNutritionPlan(plan);
}

export function getNutritionGoalsSummary(clientId: number): NutritionGoalsSummary {
  const plan = getNutritionPlan(clientId);
  const kcal = (m: MealMacros) => (m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fats ?? 0) * 9;
  const sum = (meals: MealMacros[], field: keyof MealMacros) =>
    meals.reduce((s, m) => s + (m[field] ?? 0), 0);

  // Day-level targets win when the coach has set them. The six-meal arrays
  // are the older model and stay readable, so a plan built before this still
  // shows the right numbers on the client's Nutrition screen.
  const t = plan.day_targets;
  if (t) {
    return {
      trainingKcal: macroKcal(t.training.protein, t.training.carbs, t.training.fats),
      restKcal: macroKcal(t.rest.protein, t.rest.carbs, t.rest.fats),
      trainingProtein: t.training.protein ?? 0,
      trainingCarbs: t.training.carbs ?? 0,
      trainingFats: t.training.fats ?? 0,
      restProtein: t.rest.protein ?? 0,
      restCarbs: t.rest.carbs ?? 0,
      restFats: t.rest.fats ?? 0,
    };
  }

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
  // null for the coach's own calendar blocks (see addCalendarEventAction).
  client_id: number | null;
  date: string;
  time: string;
  duration_minutes: number;
  topic: string;
  status: "scheduled" | "completed" | "no-show" | "cancelled";
  link?: string | null;
  /** Coach-only. Never sent to the client. */
  prep_notes?: string | null;
  /** The coach's recap of the call, written for the client. */
  summary?: string | null;
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
  clientId: number | null,
  date: string,
  time: string,
  topic: string,
  durationMinutes: number = DEFAULT_MEETING_DURATION,
  link: string | null = null,
  /** The coach whose calendar a personal block (no client) goes on. */
  blockCoachId: number | null = null
) {
  const data = getData();
  data.meetings.push({
    id: allocId("meetings"),
    client_id: clientId,
    coach_id: clientId == null ? blockCoachId : null,
    date,
    time,
    duration_minutes: durationMinutes || DEFAULT_MEETING_DURATION,
    topic,
    status: "scheduled",
    link: link || null,
    prep_notes: null,
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
  // Goals set in the meeting stay; they just stop pointing at it.
  data.client_goals.forEach((g) => {
    if (g.meeting_id === id) g.meeting_id = null;
  });
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

/** One coach's calendar: their clients' meetings and their own blocks. */
export function listAllMeetings(coachId: number): MeetingWithClient[] {
  const data = getData();
  const mine = coachClientIds(coachId);
  return data.meetings
    .filter((m) => (m.client_id != null ? mine.has(m.client_id) : m.coach_id === coachId))
    .map((m) => {
      const client = m.client_id == null ? null : data.clients.find((c) => c.id === m.client_id);
      return {
        ...m,
        duration_minutes: m.duration_minutes || DEFAULT_MEETING_DURATION,
        clientName: m.client_id == null ? "Just you" : client?.name ?? "Unknown client",
      };
    })
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1));
}

// One day's entries for the calendar's day panel, in time order.
export function getCalendarDay(coachId: number, dateStr: string): MeetingWithClient[] {
  return listAllMeetings(coachId).filter((m) => m.date === dateStr && m.status !== "cancelled");
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
export function getMeetingConflicts(coachId: number): MeetingConflict[] {
  const meetings = listAllMeetings(coachId).filter((m) => m.status === "scheduled" && m.time);
  const conflicts: MeetingConflict[] = [];
  for (let i = 0; i < meetings.length; i++) {
    for (let j = i + 1; j < meetings.length; j++) {
      const a = meetings[i];
      const b = meetings[j];
      // Two entries for the same client are one conversation, not a clash;
      // two of the coach's own blocks can overlap without anyone double-booked.
      if (a.date !== b.date || (a.client_id != null && a.client_id === b.client_id) || (a.client_id == null && b.client_id == null)) continue;
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
  const coachId = coachIdOfClient(clientId);
  if (coachId == null) return [];
  return getMeetingConflicts(coachId).filter((c) => c.a.client_id === clientId || c.b.client_id === clientId);
}

export type CalendarDay = { date: string; meetings: MeetingWithClient[] };

// Groups every upcoming (and recently past, for context) meeting by date so
// the calendar can render a simple day-by-day agenda without a full month
// grid — this is a coaching schedule, not a general calendar app, so an
// agenda list reads better than a grid full of empty days.
export function getUpcomingCalendarDays(coachId: number, daysBack = 7, daysForward = 60): CalendarDay[] {
  const all = listAllMeetings(coachId).filter((m) => m.status !== "cancelled");
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
export function getCalendarMonth(coachId: number, monthStr?: string): CalendarMonth {
  const now = new Date();
  const valid = monthStr && /^\d{4}-\d{2}$/.test(monthStr);
  const year = valid ? Number(monthStr!.slice(0, 4)) : now.getFullYear();
  const month = valid ? Number(monthStr!.slice(5, 7)) - 1 : now.getMonth();

  const first = new Date(year, month, 1);
  const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Monday-start offset: getDay() is 0=Sun..6=Sat, we want 0=Mon..6=Sun.
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekday);

  const todayStr = localDateStr(now);
  const meetingsByDate = new Map<string, MeetingWithClient[]>();
  listAllMeetings(coachId)
    .filter((m) => m.status !== "cancelled")
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
  if (sender === "coach" && getClientPreferences(clientId).coach_notes) {
    // The notification is the message. There is no chat screen in this
    // beta, so the client reads it in full right there.
    logCoachActivity(clientId, text || "Your coach sent you a message", { kind: "coach_note" });
  }
}

// ---- "Today" due items: was the Check-ins tab, folded into Home. Shared by
// HomeHub's due list and applyDueClientReminders() (the notification feed's
// reminder entries), so the two never drift apart on what counts as due. ----

const PHOTO_PERIOD_UNIT: Record<PhotoCadence, string> = {
  weekly: "Week",
  biweekly: "Check-in",
  monthly: "Month",
  sixweekly: "Block",
};

export type DueItem = { id: string; label: string; detail: string; targetTab: string };


// The weekday the coach and client agreed on for the weekly check-in, read
// from the profile's free-text check_in_day ("Sunday", "sun", …). null when
// unset or unrecognised, which means "open from Monday" — the behaviour
// before the day was honoured. Monday = 0 … Sunday = 6 to match weekStart.
export function weeklyCheckInWeekday(clientId: number): number | null {
  const raw = getClientProfile(clientId).check_in_day?.trim().toLowerCase();
  if (!raw) return null;
  const idx = DAY_NAMES_FULL.findIndex((d) => d.toLowerCase().startsWith(raw.slice(0, 3)));
  return idx >= 0 ? idx : null;
}

// Whether the weekly check-in window is open today: on or after the agreed
// day within the current Mon–Sun week. Storage is unchanged (weekly entries
// are still keyed by the week's Monday), so only WHEN the reminder appears
// moves — a Sunday check-in shows up on Sunday, not all week.
export function weeklyCheckInOpen(clientId: number, dateStr = localDateStr()): boolean {
  const weekday = weeklyCheckInWeekday(clientId);
  if (weekday == null) return true;
  const jsDay = new Date(`${dateStr}T00:00:00`).getDay(); // 0 = Sunday
  const monBased = (jsDay + 6) % 7;
  return monBased >= weekday;
}

export function getDueItems(clientId: number): DueItem[] {
  const today = localDateStr();
  const currentWeekStart = weekStart(today);

  const dailyDefs = listMetricDefinitions(clientId, "daily").filter(deployedToClient);
  const weeklyDefs = listMetricDefinitions(clientId, "weekly").filter(deployedToClient);
  const dailyLoggedToday = listMetricPeriods(dailyDefs.map((d) => d.id), 1)[0] === today;
  const weeklyLoggedThisWeek = listMetricPeriods(weeklyDefs.map((d) => d.id), 1)[0] === currentWeekStart;

  const measurementFields = listMeasurementFields(clientId).filter(deployedToClient);
  const measurementLoggedToday = listMeasurementDates(clientId).includes(today);

  const photoSlots = listActivePhotoSlots(clientId);
  const cadence = getPhotoCadence(clientId);
  const currentPeriod = photoSheetFor(clientId, today);
  const photoUploads = listPhotoUploads(photoSlots.map((s) => s.id));
  const uploadedThisPeriod = photoUploads.filter((u) => u.period === currentPeriod).length;

  const items: DueItem[] = [];
  if (dailyDefs.length > 0 && !dailyLoggedToday) {
    items.push({
      id: "daily",
      label: "Daily check-in",
      detail: `${dailyDefs.length} metric${dailyDefs.length === 1 ? "" : "s"} to log for today`,
      targetTab: "daily",
    });
  }
  if (weeklyDefs.length > 0 && !weeklyLoggedThisWeek && weeklyCheckInOpen(clientId, today)) {
    items.push({
      id: "weekly",
      label: "Weekly check-in",
      detail: `${weeklyDefs.length} metric${weeklyDefs.length === 1 ? "" : "s"} to log for this week`,
      targetTab: "weekly",
    });
  }
  if (measurementFields.length > 0 && !measurementLoggedToday) {
    items.push({
      id: "measurements",
      label: "Check-in measurements",
      detail: `Log ${measurementFields.map((f) => f.name).join(", ")}`,
      targetTab: "measurements",
    });
  }
  if (currentPeriod && photoSlots.length > 0 && uploadedThisPeriod < photoSlots.length) {
    items.push({
      id: "photos",
      label: "Progress pictures",
      detail: `${uploadedThisPeriod}/${photoSlots.length} uploaded for this ${PHOTO_PERIOD_UNIT[cadence].toLowerCase()}`,
      targetTab: "measurements",
    });
  }
  return items;
}

// Being configured IS being deployed: a column on the coach's check-in list
// is a column the client is asked for, full stop.
//
// There used to be a per-column visibility switch here, and it was a mistake —
// it created a second, invisible state ("configured but the client can't see
// it") that a coach had to hold in their head, and the only honest way to stop
// asking for a column is to remove it. The parameter stays so old rows
// carrying `visible_to_client: false` don't silently vanish from a client's
// check-in now that nothing can flip the flag back.
function deployedToClient(_x: { visible_to_client?: boolean }): boolean {
  return true;
}

export function setMetricVisibleToClient(id: number, visible: boolean) {
  const data = getData();
  const def = data.metric_definitions.find((m) => m.id === id);
  if (!def) return;
  def.visible_to_client = visible;
  persist();
}

export function setMeasurementFieldVisibleToClient(id: number, visible: boolean) {
  const data = getData();
  const field = data.measurement_fields.find((f) => f.id === id);
  if (!field) return;
  field.visible_to_client = visible;
  persist();
}

// Home reports check-in status as one line rather than enumerating each
// outstanding item, so it needs a count of check-in TYPES still open for
// their current period — daily (today), weekly (this week), measurements
// (this cycle). Progress pictures aren't a fourth type: they're submitted
// as part of the measurements check-in, so they don't get their own row.
export type CheckInStatus = {
  // Zero when the coach hasn't configured any check-ins at all, which is
  // the signal to hide the section rather than claim everything's done.
  configuredCount: number;
  dueTypes: ("daily" | "weekly" | "measurements")[];
  // "Daily and weekly", "Measurements", ... — names what's outstanding.
  dueNames: string;
  // What opens next once nothing is due; depends on which types exist, so
  // a client with no daily tracker isn't promised a daily check-in.
  nextLabel: string;
};

// The most recent value the client logged for each thing the coach asked
// for — every deployed tracker metric plus every measurement field — with
// the date of the newest of them. Drives the program builder's "Latest
// check-in" rail, so the coach sees how the client is doing while writing
// next week's session rather than having to leave the tab.

// What the header carries beside the client's name: the two plans they're
// currently on. Both are read from what's actually deployed/saved, and a
// plan that doesn't exist yet says so rather than rendering a blank slot.
export type HeaderPlan = { id: string; label: string; value: string };

export function getClientHeaderPlans(clientId: number): HeaderPlan[] {
  const plans: HeaderPlan[] = [];

  // Both slots are about what the plan is CALLED. An unnamed plan has
  // nothing to say here, so the whole read-out is left out rather than
  // filled with "Untitled program" or a bare number — a fresh client's
  // header is just their name until the coach names something.
  const program = getDeployedProgram(clientId);
  if (program?.name) {
    const weekNumber = program.start_week + getProgramCurrentWeekIndex(program) - 1;
    plans.push({
      id: "workout",
      label: "Workout plan",
      value: `${program.name} · ${programWeekLabel(program, weekNumber)}`,
    });
  }

  // Nutrition is one plan per client, renamed as the phase changes; the
  // kcal targets ride along as supporting detail once it has a name.
  const nutrition = getNutritionPlan(clientId);
  if (nutrition.name) {
    const goals = getNutritionGoalsSummary(clientId);
    const hasKcal = goals.trainingKcal > 0 || goals.restKcal > 0;
    plans.push({
      id: "nutrition",
      label: "Nutrition plan",
      value: hasKcal
        ? `${nutrition.name} · ${Math.round(goals.trainingKcal)} / ${Math.round(goals.restKcal)} kcal`
        : nutrition.name,
    });
  }

  return plans;
}




// ---- A client's Home (coach side) ------------------------------------------
// What needs the coach, spelled out, and what the client has been doing, with
// the coach's own "seen it" kept per event so a dot can lead from the client,
// to the tab, to the session the news is about.

/** How far back an event still counts as news. Older history is never "new". */
const HOME_NEW_DAYS = 14;

export type HomeAction = {
  id: string;
  /** "urgent": stops the client; "due": something is owed; "note": words to read. */
  tone: "urgent" | "due" | "note";
  title: string;
  detail: string;
  /** The admin tab that deals with it, if one does. */
  tab: string | null;
};

export type HomeEvent = FeedEvent & { when: string; unseen: boolean };

export type ClientHome = {
  actions: HomeAction[];
  events: HomeEvent[];
  /** Everything this client has ever logged, for "showing N of M". */
  eventTotal: number;
  unseenCount: number;
  /** Tabs with something new on them. */
  unseenTabs: string[];
  /** Training sessions with something new on them. */
  unseenDayIds: number[];
};

const isUnseen = (seen: Record<string, number> | undefined, e: FeedEvent, since: number) =>
  e.at >= since && (seen?.[e.id] ?? 0) < e.at;

/**
 * One client's Home. `feed` lets a caller that needs several clients walk the
 * store once (the rail) rather than once per client.
 */
export function getClientHome(clientId: number, feed?: FeedEvent[]): ClientHome {
  const data = getData();
  const client = data.clients.find((c) => c.id === clientId);
  const all = (feed ?? getActivityFeed(client?.coach_id ?? 0)).filter((e) => e.clientId === clientId);
  const since = Date.now() - HOME_NEW_DAYS * 86400000;
  const events = all.slice(0, 60).map((e) => ({ ...e, when: feedTimeLabel(e.at, e.timeKnown), unseen: isUnseen(client?.coach_seen, e, since) }));
  const unseen = events.filter((e) => e.unseen);

  const actions: HomeAction[] = [];
  if (clientLockedOut(clientId)) {
    actions.push({ id: "locked", tone: "urgent", title: "Locked out of signing in", detail: "Too many wrong passwords. Clear the lock from their card, or it lifts by itself.", tab: null });
  }
  const program = getDeployedProgram(clientId);
  if (program) {
    const index = getProgramCurrentWeekIndex(program);
    const liveWeek = program.start_week + index - 1;
    if (!getWeek(clientId, liveWeek).some((d) => getAssignmentsForDay(d.id).length > 0)) {
      actions.push({ id: "week", tone: "urgent", title: `${programWeekLabel(program, liveWeek)} has no sessions`, detail: "This is the week they are in, so they have nothing to train.", tab: "training" });
    }
    // The programme running out with nothing queued behind it.
    const left = program.total_weeks - index;
    const queued = data.training_programs.some((p) => p.client_id === clientId && p.status === "draft" && p.scheduled_at);
    if (left <= 1 && !queued) {
      actions.push({
        id: "program-ending",
        tone: "due",
        title: left <= 0 ? `${program.name || "Their programme"} ends this week` : `${program.name || "Their programme"} ends next week`,
        detail: "Nothing is scheduled to follow it.",
        tab: "training",
      });
    }
  }
  const due = getCheckInStatus(clientId);
  const DUE = { daily: "Today's daily check-in", weekly: "This week's weekly check-in", measurements: "Today's measurements" };
  for (const t of due.dueTypes) {
    actions.push({ id: `checkin-${t}`, tone: "due", title: `${DUE[t]} not logged`, detail: "They have not filled it in yet.", tab: "measurements" });
  }
  // Their own words waiting to be read: notes and reasons, not plain logging.
  for (const e of unseen) {
    if (!e.note) continue;
    actions.push({ id: `read-${e.id}`, tone: "note", title: e.text.charAt(0).toUpperCase() + e.text.slice(1), detail: e.note, tab: e.tab });
  }
  // Gone quiet: nothing at all logged for a while.
  const last = all[0]?.at ?? null;
  if (last != null) {
    const days = Math.floor((Date.now() - last) / 86400000);
    if (days >= 5) actions.push({ id: "quiet", tone: "due", title: `Nothing logged for ${days} days`, detail: `Last seen ${feedTimeLabel(last, false)}.`, tab: null });
  }

  return {
    actions,
    events,
    eventTotal: all.length,
    unseenCount: unseen.length,
    unseenTabs: [...new Set(unseen.map((e) => e.tab))],
    unseenDayIds: [...new Set(unseen.map((e) => e.dayId).filter((d): d is number => d != null))],
  };
}

// ---- How much of what was asked for the client actually does ----------
// One figure per thing the coach set up, and their average. Only what was
// actually asked for counts: a client with no photo sheets is not marked
// down for sending none, and a week the coach never built is not a week the
// client missed. Over the last four weeks, so one bad week does not read as
// a collapse and a good day does not hide a month of silence.
//
// Four figures, and each one is a distinct behaviour:
//   Sessions done      — did they train what was built for them
//   Check-ins          — did they answer what they were asked to log
//   Food logged        — did they write down what they ate
//   Progress pictures  — did the sheet come in
//
// Deliberately NOT here: sets logged, which cannot disagree with sessions
// done — the client's app will not complete a session until every set is in,
// so it was the same fact drawn twice. And measurements, which are fields
// inside the weekly check-in: counting them separately counted one Sunday
// evening as two things the client either did or did not do.

// One window, and it moves: the thirty days ending today. Tomorrow it is the
// thirty ending tomorrow. Nothing to choose between, and the figure always
// means the same span, so two readings a week apart are comparable.
export const ENGAGEMENT_DAYS = 30;

export type EngagementPart = {
  id: string;
  label: string;
  /** 0–100, already rounded. */
  pct: number;
  /** "4 of 8 sessions", in the client's own units. */
  detail: string;
  /** The second fact the behaviour carries, when it has one: a streak. */
  note?: string;
};

export type ClientEngagement = {
  /** The average across the parts that apply, or null when none do. */
  overall: number | null;
  /** The client's first day, when it falls inside the window: counting starts there. */
  since: string | null;
  /** The same average over the window before this one, for the trend. */
  previous: number | null;
  parts: EngagementPart[];
  days: number;
};

const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
};

/**
 * The first day a client can be held to anything: the first day they logged
 * something (a daily check-in, food, a set), or, when they have logged
 * nothing yet, the day their login was made. Null when neither is known.
 *
 * The thirty-day window used to count from thirty days ago whatever: a
 * client eighteen days in, with every check-in done, read "18 of 33", 55%,
 * which says a client doing half of what they are asked. Days before they
 * started are not days they missed.
 */
export function clientStartDate(clientId: number): string | null {
  const data = getData();
  let first: string | null = null;
  const see = (day: string | null | undefined) => {
    if (day && (first == null || day < first)) first = day;
  };
  // Daily check-ins only: a weekly one is filed under its Monday, which can
  // be days before the client actually began.
  const daily = new Set(data.metric_definitions.filter((m) => m.client_id === clientId && m.frequency === "daily").map((m) => m.id));
  for (const e of data.metric_entries) if (daily.has(e.metric_definition_id)) see(e.period);
  for (const e of data.food_entries ?? []) if (e.client_id === clientId) see(e.date);
  for (const c of data.calorie_logs) if (c.client_id === clientId) see(c.date);
  const dayIds = new Set(data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.id));
  const assignmentIds = new Set(data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id)).map((wa) => wa.id));
  for (const s of data.set_logs) if (assignmentIds.has(s.workout_assignment_id)) see(s.logged_at?.slice(0, 10));
  if (first) return first;
  return data.users.find((u) => u.role === "client" && u.client_id === clientId)?.created_at?.slice(0, 10) ?? null;
}

// One window of it. `back` is how many windows ago — 0 is now, 1 is the one
// before it, which is all the trend needs.
//
// Each behaviour is scored as a rate (done ÷ asked) BEFORE anything is
// averaged, and the overall is the mean of those rates. Pooling the events
// instead would let the two daily habits drown the training: fifty-eight
// daily slots against eight sessions means a client could stop training
// altogether and lose eight points. Normalise first and the difference in
// rhythm stops mattering — which is the whole reason a daily thing and a
// weekly thing can sit in one score at all.
function engagementWindow(clientId: number, days: number, back: number, since: string | null): { parts: EngagementPart[]; overall: number | null } {
  const data = getData();
  const today = localDateStr();
  const to = plusDays(today, -days * back);
  const windowFrom = plusDays(to, -(days - 1));
  // Nothing before the client's first day counts against them. A window
  // wholly before it (the one the trend compares with, for a new client)
  // has nothing in it and says nothing.
  const from = since && since > windowFrom ? since : windowFrom;
  if (from > to) return { parts: [], overall: null };
  const firstWeek = weekStart(from);
  const current = back === 0;
  const weeks = Math.max(1, Math.round(days / 7));

  const parts: EngagementPart[] = [];
  const add = (id: string, label: string, done: number, asked: number, unit: string, note?: string) => {
    if (asked <= 0) return;
    parts.push({
      id,
      label,
      pct: Math.max(0, Math.min(100, Math.round((done / asked) * 100))),
      detail: `${done} of ${asked} ${unit}${asked === 1 ? "" : "s"}`,
      note,
    });
  };

  // The days that could already have been filled in: today is not missed
  // until it is over. Shared by the daily check-in and the food diary, so
  // the two are counted out of the same number of days.
  const pastDays: string[] = [];
  for (let d = from; d <= to; d = plusDays(d, 1)) {
    if (current && d === today) continue;
    pastDays.push(d);
  }

  // The longest run ending now — the figure a client actually responds to.
  // Today counts when it is in; an empty today does not break yesterday's run.
  const streakTo = (has: (day: string) => boolean) => {
    if (!current) return 0;
    let n = 0;
    let d = has(today) ? today : plusDays(today, -1);
    while (has(d) && n < 400) {
      n += 1;
      d = plusDays(d, -1);
    }
    return n;
  };

  // ---- Training: the weeks of the live programme that fall in the window.
  // Every session that was on the plan inside the window, including one the
  // client gave a reason for missing. It used to drop out of the denominator
  // — telling the coach is the behaviour you want — but then the figure did
  // not match the sessions a coach can count on the builder, and "4 of 8"
  // has to be checkable against what is on screen there.
  const program = getDeployedProgram(clientId);
  let sessionsAsked = 0;
  let sessionsDone = 0;
  if (program?.deployed_at) {
    const firstMonday = weekStart(program.deployed_at.slice(0, 10));
    for (let i = 0; i < program.total_weeks; i++) {
      const monday = plusDays(firstMonday, i * 7);
      if (monday < firstWeek || monday < windowFrom || monday > to) continue;
      for (const day of getWeek(clientId, program.start_week + i)) {
        const assignments = getAssignmentsForDay(day.id);
        if (assignments.length === 0) continue;
        sessionsAsked += 1;
        if (assignments.some((a) => getLogsForAssignment(a.id).length > 0)) sessionsDone += 1;
      }
    }
  }
  add("training", "Sessions done", sessionsDone, sessionsAsked, "session");

  // ---- Check-ins, as one figure. Daily and weekly are the same behaviour at
  // two rhythms — the client answering what they were asked.
  //
  // "Asked for" is read from listMetricDefinitions, which is what
  // getCheckInSections builds the client's own check-in screen from. Keep
  // these two reading the same query: measuring adherence against a set the
  // client was never shown is worse than not measuring it.
  let checkInsAsked = 0;
  let checkInsDone = 0;
  let dailyStreak = 0;

  const dailyDefs = listMetricDefinitions(clientId, "daily").filter(deployedToClient);
  if (dailyDefs.length > 0) {
    const logged = new Set(listMetricPeriods(dailyDefs.map((d) => d.id)));
    checkInsAsked += pastDays.length;
    checkInsDone += pastDays.filter((d) => logged.has(d)).length;
    dailyStreak = streakTo((d) => logged.has(d));
  }
  const weeklyDefs = listMetricDefinitions(clientId, "weekly").filter(deployedToClient);
  if (weeklyDefs.length > 0) {
    const logged = new Set(listMetricPeriods(weeklyDefs.map((d) => d.id)));
    // The weeks that have closed, plus this one once its check-in day has come.
    // Only the weeks since the client began.
    const mondays: string[] = [];
    for (let i = current && !weeklyCheckInOpen(clientId) ? 1 : 0; i < weeks; i++) {
      const monday = plusDays(weekStart(to), -i * 7);
      if (monday < firstWeek) break;
      mondays.push(monday);
    }
    checkInsAsked += mondays.length;
    checkInsDone += mondays.filter((w) => logged.has(w)).length;
  }
  add("checkins", "Check-ins", checkInsDone, checkInsAsked, "check-in", dailyStreak >= 2 ? `${dailyStreak}-day streak` : undefined);

  // ---- Nutrition: the days the client wrote down what they ate, against the
  // days they were given a target — over the same days the daily check-in is,
  // so today's blank does not count against either.
  if (getNutritionGoalsSummary(clientId).trainingKcal) {
    const logged = new Set(listCalorieLogs(clientId, 400).map((c) => c.date));
    for (const e of data.food_entries ?? []) if (e.client_id === clientId) logged.add(e.date);
    const run = streakTo((d) => logged.has(d));
    add("nutrition", "Food logged", pastDays.filter((d) => logged.has(d)).length, pastDays.length, "day", run >= 2 ? `${run}-day streak` : undefined);
  }

  // Progress pictures are deliberately NOT scored. A sheet is a thing the
  // coach asks for now and then, not a habit, and one missed sheet in a
  // month swung the whole figure by a quarter. The gallery says whether they
  // came in; this card is about what the client does day to day.

  return { parts, overall: parts.length ? Math.round(parts.reduce((s, p) => s + p.pct, 0) / parts.length) : null };
}

export function getClientEngagement(clientId: number, days: number = ENGAGEMENT_DAYS): ClientEngagement {
  const start = clientStartDate(clientId);
  const now = engagementWindow(clientId, days, 0, start);
  // The same thirty days before those thirty. Null until there is anything
  // in them, so a new client is not told they are down on a month that never
  // happened.
  const before = engagementWindow(clientId, days, 1, start);
  const windowFrom = plusDays(localDateStr(), -(days - 1));
  return { overall: now.overall, previous: before.overall, parts: now.parts, days, since: start && start > windowFrom ? start : null };
}

/** The coach's own note about a client. Theirs alone; the client never sees it. */
export function setCoachNote(clientId: number, text: string) {
  const data = getData();
  const client = data.clients.find((c) => c.id === clientId);
  if (!client) return;
  const clean = text.trim().slice(0, 2000);
  if (clean) {
    client.coach_note = clean;
    client.coach_note_at = new Date().toISOString();
  } else {
    delete client.coach_note;
    delete client.coach_note_at;
  }
  persist();
}

/** The coach has looked: these events (all of them, one session's, or by id) stop being new. */
export function markClientEventsSeen(clientId: number, which: { all: true } | { dayId: number } | { ids: string[] } | { tab: string }) {
  const data = getData();
  const client = data.clients.find((c) => c.id === clientId);
  if (!client) return;
  const since = Date.now() - HOME_NEW_DAYS * 86400000;
  const recent = getActivityFeed(client.coach_id ?? 0).filter((e) => e.clientId === clientId && e.at >= since);
  // A tab clears what is on the tab itself; news about one session waits
  // for that session to be opened.
  const hit = recent.filter((e) =>
    "all" in which ? true : "dayId" in which ? e.dayId === which.dayId : "tab" in which ? e.tab === which.tab && e.dayId == null : which.ids.includes(e.id)
  );
  if (hit.length === 0) return;
  // Only what is still inside the window is kept, so this never grows.
  const live = new Set(recent.map((e) => e.id));
  const seen: Record<string, number> = {};
  for (const [id, at] of Object.entries(client.coach_seen ?? {})) if (live.has(id)) seen[id] = at;
  for (const e of hit) seen[e.id] = e.at;
  client.coach_seen = seen;
  persist();
}

/**
 * Why a client needs the coach's attention, or null when they don't.
 *
 * The rail shows this as a single amber dot with the reason in its title —
 * one dot, not a badge count, because the useful question at a glance is
 * "who needs me", not "how many things".
 */
export function clientAttention(clientId: number, feed?: FeedEvent[]): string | null {
  // The same list the client's Home spells out; the dot's title is the first
  // of them, and how many more there are.
  const actions = getClientHome(clientId, feed).actions;
  if (actions.length === 0) return null;
  return actions.length === 1 ? actions[0].title : `${actions[0].title} · and ${actions.length - 1} more`;
}

export function getCheckInStatus(clientId: number): CheckInStatus {
  const today = localDateStr();
  const thisWeek = weekStart(today);

  const dailyDefs = listMetricDefinitions(clientId, "daily").filter(deployedToClient);
  const weeklyDefs = listMetricDefinitions(clientId, "weekly").filter(deployedToClient);
  const fields = listMeasurementFields(clientId).filter(deployedToClient);

  const dailyDue =
    dailyDefs.length > 0 && listMetricPeriods(dailyDefs.map((d) => d.id), 1)[0] !== today;
  const weeklyDue =
    weeklyDefs.length > 0 &&
    listMetricPeriods(weeklyDefs.map((d) => d.id), 1)[0] !== thisWeek &&
    weeklyCheckInOpen(clientId);
  const measurementsDue = fields.length > 0 && !listMeasurementDates(clientId).includes(today);

  const dueTypes: ("daily" | "weekly" | "measurements")[] = [];
  if (dailyDue) dueTypes.push("daily");
  if (weeklyDue) dueTypes.push("weekly");
  if (measurementsDue) dueTypes.push("measurements");

  const NAME = { daily: "Daily", weekly: "weekly", measurements: "measurements" };
  const parts = dueTypes.map((t) => NAME[t]);
  const dueNames =
    parts.length === 0
      ? ""
      : parts.length === 1
      ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  return {
    configuredCount: [dailyDefs.length, weeklyDefs.length, fields.length].filter((n) => n > 0).length,
    dueTypes,
    dueNames,
    nextLabel: dailyDefs.length
      ? "Next daily check-in opens tomorrow"
      : weeklyDefs.length
      ? "Next weekly check-in opens Monday"
      : "Nothing due right now",
  };
}

// ---- Check-in screen: the three logging sections (daily tracker, weekly
// tracker, measurements) as one screen, replacing what used to be three
// separate Home sub-views. Everything the client can fill in is here; what
// the coach configured decides which sections exist at all. ----

// A coach writing "/5" or "/10" as a metric's unit means "rate it out of N"
// — a convention already in the seed data (Energy /5, Stress /5, Soreness
// /5). Those render as a row of tap targets instead of a number pad; every
// other unit ("kg", "hrs", "steps") stays a plain numeric input.
function ratingScaleMax(unit: string): number | null {
  const match = /^\/(\d+)$/.exec(unit.trim());
  if (!match) return null;
  const max = Number(match[1]);
  return max >= 2 && max <= 10 ? max : null;
}

export type CheckInMetric = {
  id: string;
  name: string;
  unit: string;
  step: string;
  // Value already logged for the period being edited, so reopening the
  // screen shows what was sent rather than an empty form.
  value: string;
  // "84.4 kg yesterday" — the last thing logged BEFORE this period, so the
  // client has something to anchor against while typing.
  hint: string | null;
  scaleMax: number | null;
};

export type CheckInSection = {
  id: "daily" | "weekly" | "measurements";
  label: string;
  intro: string;
  note: string | null;
  metrics: CheckInMetric[];
};

export type CheckInDelta = { name: string; value: string; unit: string };

export type CheckInPhotoSlot = { id: number; label: string; src: string | null };

export type CheckInData = {
  sections: CheckInSection[];
  // Measurements-only extras, matching the design: how far each measurement
  // has moved since the current phase began, and this period's progress
  // pictures. Phase-to-date rather than since-last-check-in because a week
  // of measurements moves too little to be worth showing.
  phaseLabel: string | null;
  deltas: CheckInDelta[];
  photoSlots: CheckInPhotoSlot[];
  photoPeriodLabel: string;
  // A new set is only asked for while this period's slots aren't all
  // filled; once they are, the client has nothing to do until the next
  // period opens.
  photosDue: boolean;
  photosNextLabel: string;
};

export function getCheckInSections(clientId: number): CheckInData {
  const today = localDateStr();
  const thisWeek = weekStart(today);

  const fmtDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // A tracker metric's row: what's logged for the current period, plus the
  // most recent entry from any earlier period as the hint.
  const trackerSection = (
    frequency: "daily" | "weekly",
    period: string,
    label: string,
    intro: string
  ): CheckInSection | null => {
    const defs = listMetricDefinitions(clientId, frequency).filter(deployedToClient);
    if (defs.length === 0) return null;
    const entries = getMetricEntries(defs.map((d) => d.id));
    return {
      id: frequency,
      label,
      intro,
      note: getCheckInNote(clientId, frequency, period),
      metrics: defs.map((def) => {
        const current = entries.find((e) => e.metric_definition_id === def.id && e.period === period);
        const previous = entries
          .filter((e) => e.metric_definition_id === def.id && e.period < period && e.value != null)
          .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
        const scaleMax = ratingScaleMax(def.unit);
        return {
          id: String(def.id),
          name: def.name,
          unit: def.unit,
          step: scaleMax ? "1" : "0.1",
          value: current?.value != null ? String(current.value) : "",
          hint: previous
            ? `${previous.value}${def.unit && !scaleMax ? ` ${def.unit}` : scaleMax ? `/${scaleMax}` : ""} on ${fmtDate(previous.period)}`
            : null,
          scaleMax,
        };
      }),
    };
  };

  const sections: CheckInSection[] = [];
  const daily = trackerSection(
    "daily",
    today,
    "Daily",
    "What your coach asked you to log every day. Takes about twenty seconds."
  );
  if (daily) sections.push(daily);

  const weekly = trackerSection("weekly", thisWeek, "Weekly", "One entry covers the whole week.");
  if (weekly) sections.push(weekly);

  // ---- Measurements ----
  const fields = listMeasurementFields(clientId).filter(deployedToClient);
  const measurementValues = getMeasurementValues(fields.map((f) => f.id));
  const dates = listMeasurementDates(clientId);
  const previousDate = dates.filter((d) => d < today).sort((a, b) => (a < b ? 1 : -1))[0] ?? null;

  const valueAt = (fieldId: number, date: string) =>
    measurementValues.find((v) => v.field_id === fieldId && v.date === date)?.value ?? null;

  if (fields.length > 0) {
    sections.push({
      id: "measurements",
      note: getCheckInNote(clientId, "measurements", today),
      label: "Measure",
      intro: "Same spots, same time of day: first thing, before food.",
      metrics: fields.map((f) => {
        const current = valueAt(f.id, today);
        const previous = previousDate ? valueAt(f.id, previousDate) : null;
        return {
          id: String(f.id),
          name: f.name,
          unit: f.unit,
          step: "0.1",
          value: current != null ? String(current) : "",
          hint: previous != null ? `${previous}${f.unit ? ` ${f.unit}` : ""} on ${fmtDate(previousDate!)}` : null,
          scaleMax: null,
        };
      }),
    });
  }

  // How far each measurement has moved since the current phase began.
  // Phase-to-date, not since the last check-in: a week apart, most of these
  // barely move, and the number the client actually cares about is the one
  // for the block of work they're in. The phase start is the coach's
  // goal_phase_start_date, falling back to when coaching began.
  //
  // Which direction counts as "good" isn't knowable for a coach-named field
  // (is a bigger chest good? depends on the goal), so deltas render neutral
  // rather than guessing — only the number and its sign are shown.
  const profile = getClientProfile(clientId);
  const phaseStart = profile.goal_phase_start_date || profile.coaching_start_date;
  // The first check-in from the phase onwards is the baseline; anything
  // earlier belongs to the phase before this one.
  const baselineDate = phaseStart ? dates.filter((d) => d >= phaseStart && d < today).sort()[0] ?? null : null;
  const latestDate = dates.filter((d) => d <= today).sort((a, b) => (a < b ? 1 : -1))[0] ?? null;

  const deltas: CheckInDelta[] =
    baselineDate == null || latestDate == null || latestDate === baselineDate
      ? []
      : fields
          .map((f) => {
            const now = valueAt(f.id, latestDate);
            const before = valueAt(f.id, baselineDate);
            if (now == null || before == null) return null;
            const diff = Math.round((now - before) * 10) / 10;
            return {
              name: f.name,
              value: `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${Math.abs(diff)}`,
              unit: f.unit,
            };
          })
          .filter((d): d is CheckInDelta => d !== null);

  // "Fat loss · from Jun 15" — whichever halves we actually have.
  const phaseLabel =
    deltas.length === 0
      ? null
      : [effectiveGoalPhase(clientId, profile.goal_phase), baselineDate ? `from ${fmtDate(baselineDate)}` : null]
          .filter(Boolean)
          .join(" · ") || null;

  const cadence = getPhotoCadence(clientId);
  const photoPeriod = photoSheetFor(clientId, today);
  const slots = listActivePhotoSlots(clientId);
  const uploads = listPhotoUploads(slots.map((s) => s.id));

  const photoSlots = slots.map((s) => ({
    id: s.id,
    label: s.label,
    src: uploads.find((u) => u.slot_id === s.id && u.period === photoPeriod)?.file_path ?? null,
  }));
  const unit = PHOTO_PERIOD_UNIT[cadence];

  return {
    sections,
    phaseLabel,
    deltas,
    photoSlots,
    photoPeriodLabel: unit,
    // Nothing to upload before the coach's first sheet date.
    photosDue: photoPeriod != null && photoSlots.length > 0 && photoSlots.some((p) => !p.src),
    photosNextLabel: photoPeriod
      ? `All ${photoSlots.length} taken. The next set opens ${fmtDate(upcomingPhotoSheets(clientId, today, 1)[0])}.`
      : `The first set opens ${fmtDate(upcomingPhotoSheets(clientId, today, 1)[0])}.`,
  };
}

// ---- Coach activity log: "last update from your coach" on client Home,
// and the backing store for the client's Chat and Notifications screen ----

export type CoachActivityKind = "coach_note" | "report" | "programme" | "reminder" | "general";
// Where a notification's action link should take the client — the four
// bottom-nav tabs, or "chat" to open the chat/notifications panel itself.
export type CoachActivityActionTab = "home" | "training" | "nutrition" | "settings" | "chat";

export type ClientNotification = {
  id: number;
  client_id: number;
  message: string;
  created_at: string;
  kind: CoachActivityKind;
  read: boolean;
  action_tab: CoachActivityActionTab | null;
  action_label: string | null;
  action_ref: number | null;
};

export function logCoachActivity(
  clientId: number,
  message: string,
  opts: {
    kind: CoachActivityKind;
    actionTab?: CoachActivityActionTab;
    actionLabel?: string;
    // Which row on that tab to open — see CoachActivity.action_ref in db.ts.
    actionRef?: number;
    // Set only by lazily-generated entries (see applyDueClientReminders) so
    // a still-due condition doesn't spawn a fresh row on every request.
    dedupeKey?: string;
  }
) {
  const data = getData();
  if (opts.dedupeKey && data.coach_activity.some((a) => a.client_id === clientId && a.dedupe_key === opts.dedupeKey)) {
    return;
  }
  data.coach_activity.push({
    id: allocId("coach_activity"),
    client_id: clientId,
    message,
    created_at: new Date().toISOString(),
    kind: opts.kind,
    read: false,
    action_tab: opts.actionTab ?? null,
    action_label: opts.actionLabel ?? null,
    action_ref: opts.actionRef ?? null,
    dedupe_key: opts.dedupeKey ?? null,
  });
  persist();
}

export function getLatestCoachActivity(clientId: number) {
  const data = getData();
  const entries = data.coach_activity.filter((a) => a.client_id === clientId);
  if (entries.length === 0) return null;
  return entries.reduce((latest, e) => (e.created_at > latest.created_at ? e : latest));
}

// Rows written before `kind`/`read`/etc. existed (or restored from an older
// export) won't have them — default defensively rather than trusting the
// stored shape to match the current type. Old, kind-less rows default to
// read so they don't surface as a wall of new unread notifications.
function normalizeNotification(a: {
  id: number;
  client_id: number;
  message: string;
  created_at: string;
  kind?: CoachActivityKind;
  read?: boolean;
  action_tab?: CoachActivityActionTab | null;
  action_label?: string | null;
  action_ref?: number | null;
}): ClientNotification {
  return {
    id: a.id,
    client_id: a.client_id,
    message: a.message,
    created_at: a.created_at,
    kind: a.kind ?? "general",
    read: a.read ?? true,
    action_tab: a.action_tab ?? null,
    action_label: a.action_label ?? null,
    action_ref: a.action_ref ?? null,
  };
}

export function getNotifications(clientId: number, limit = 50): ClientNotification[] {
  const data = getData();
  return data.coach_activity
    .filter((a) => a.client_id === clientId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
    .slice(0, limit)
    .map(normalizeNotification);
}

export function markNotificationRead(id: number) {
  const data = getData();
  const entry = data.coach_activity.find((a) => a.id === id);
  if (!entry) return;
  entry.read = true;
  persist();
}

// Opening the coach's message feed reads every message at once.
export function markCoachNotesRead(clientId: number) {
  const data = getData();
  let changed = false;
  data.coach_activity.forEach((a) => {
    if (a.client_id === clientId && a.kind === "coach_note" && !a.read) {
      a.read = true;
      changed = true;
    }
  });
  if (changed) persist();
}

export function markAllNotificationsRead(clientId: number) {
  const data = getData();
  data.coach_activity.forEach((a) => {
    if (a.client_id === clientId) a.read = true;
  });
  persist();
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

  const photoSlots = listActivePhotoSlots(clientId);
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

// ---- Reports: coach-level reusable templates + generated client reports ----
// Templates are just an ordered list of sections (mirrors the metric
// template pattern) — generating a report for a client walks the template's
// sections, pulls real numbers for that client over the given period, and
// hands them to writeReportNarrative() (lib/reportAi.ts) to turn into prose.
// Nothing about the template is client-specific, so the same template can
// be reused across every client the coach has.

export type { ReportSectionType } from "./reportSectionTypes";
export { REPORT_SECTION_TYPE_LABEL } from "./reportSectionTypes";
import type { ReportSectionType } from "./reportSectionTypes";

export type ReportTemplate = {
  id: number;
  name: string;
  created_at: string;
};

export type ReportTemplateSection = {
  id: number;
  template_id: number;
  type: ReportSectionType;
  label: string;
  metric_name: string | null;
  order_index: number;
};

export function listReportTemplates(coachId: number): ReportTemplate[] {
  return getData()
    .report_templates.filter((t) => t.coach_id === coachId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export function createReportTemplate(coachId: number, name: string): number {
  const data = getData();
  const id = allocId("report_templates");
  data.report_templates.push({ id, name, created_at: new Date().toISOString(), coach_id: coachId });
  persist();
  return id;
}

export function getReportTemplate(id: number): ReportTemplate | undefined {
  return getData().report_templates.find((t) => t.id === id);
}

export function deleteReportTemplate(id: number) {
  const data = getData();
  data.report_templates = data.report_templates.filter((t) => t.id !== id);
  data.report_template_sections = data.report_template_sections.filter((s) => s.template_id !== id);
  persist();
}

export function listReportTemplateSections(templateId: number): ReportTemplateSection[] {
  return getData()
    .report_template_sections.filter((s) => s.template_id === templateId)
    .sort((a, b) => a.order_index - b.order_index);
}

export function addReportTemplateSection(
  templateId: number,
  type: ReportSectionType,
  label: string,
  metricName: string | null
) {
  const data = getData();
  const count = data.report_template_sections.filter((s) => s.template_id === templateId).length;
  data.report_template_sections.push({
    id: allocId("report_template_sections"),
    template_id: templateId,
    type,
    label,
    metric_name: metricName,
    order_index: count,
  });
  persist();
}

export function removeReportTemplateSection(id: number) {
  const data = getData();
  data.report_template_sections = data.report_template_sections.filter((s) => s.id !== id);
  persist();
}

export type ClientReport = {
  id: number;
  client_id: number;
  template_id: number | null;
  template_name: string;
  period_start: string;
  period_end: string;
  status: "draft" | "approved" | "sent";
  summary: string;
  ai_generated: boolean;
  sections_snapshot: string;
  generated_at: string;
  approved_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
};

export type ReportSeriesPoint = { date: string; value: number };
export type ReportSectionData = {
  type: ReportSectionType;
  label: string;
  data: Record<string, unknown>;
  // Chart-ready time series, when this section type has one obvious numeric
  // trend to plot (training volume, a tracker metric). Absent for section
  // types that are just a snapshot (nutrition targets, photo counts, goals).
  series?: ReportSeriesPoint[];
  // Measurements can track several fields (weight, waist, ...) at once, so
  // it gets one named series per field instead of a single `series`.
  seriesByField?: Record<string, { unit: string; points: ReportSeriesPoint[] }>;
};

// Pulls real numbers for one client/period per the template's section list.
// Each section type reads from whichever store already backs that part of
// the app — nothing here is a new source of truth, just a period-scoped view.
export function computeReportSections(
  clientId: number,
  sections: { type: ReportSectionType; label: string; metric_name: string | null }[],
  periodStart: string,
  periodEnd: string
): ReportSectionData[] {
  const data = getData();

  return sections.map((s): ReportSectionData => {
    switch (s.type) {
      case "training": {
        const dayIds = new Set(data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.id));
        const assignmentIds = new Set(
          data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id)).map((wa) => wa.id)
        );
        const logsInPeriod = data.set_logs.filter(
          (sl) =>
            assignmentIds.has(sl.workout_assignment_id) &&
            sl.logged_at.slice(0, 10) >= periodStart &&
            sl.logged_at.slice(0, 10) <= periodEnd
        );
        const daysTrained = new Set(logsInPeriod.map((l) => l.logged_at.slice(0, 10))).size;
        const totalVolume = logsInPeriod.reduce((sum, l) => sum + (l.weight_kg ?? 0) * (l.reps ?? 0), 0);
        const byDate = new Map<string, number>();
        logsInPeriod.forEach((l) => {
          const date = l.logged_at.slice(0, 10);
          byDate.set(date, (byDate.get(date) ?? 0) + (l.weight_kg ?? 0) * (l.reps ?? 0));
        });
        const series = [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, value]) => ({ date, value: Math.round(value) }));
        return {
          type: s.type,
          label: s.label,
          data: { sets_logged: logsInPeriod.length, days_trained: daysTrained, total_volume_kg: Math.round(totalVolume) },
          series: series.length >= 2 ? series : undefined,
        };
      }
      case "nutrition": {
        const plan = data.nutrition_plans.find((p) => p.client_id === clientId);
        return {
          type: s.type,
          label: s.label,
          data: {
            training_day_kcal: plan?.maintenance_kcal ?? null,
            coach_notes: plan?.coach_notes || null,
          },
        };
      }
      case "measurements": {
        const fields = data.measurement_fields.filter((f) => f.client_id === clientId);
        const valuesInPeriod = data.measurement_values
          .filter(
            (v) => fields.some((f) => f.id === v.field_id) && v.value != null && v.date >= periodStart && v.date <= periodEnd
          )
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        const byField = new Map<number, typeof valuesInPeriod>();
        valuesInPeriod.forEach((v) => byField.set(v.field_id, [...(byField.get(v.field_id) ?? []), v]));
        const changes: Record<string, unknown> = {};
        const seriesByField: Record<string, { unit: string; points: ReportSeriesPoint[] }> = {};
        byField.forEach((vals, fieldId) => {
          const field = fields.find((f) => f.id === fieldId);
          if (!field || vals.length === 0) return;
          const first = vals[0].value as number;
          const last = vals[vals.length - 1].value as number;
          changes[field.name] = `${first} -> ${last} ${field.unit}`.trim();
          if (vals.length >= 2) {
            seriesByField[field.name] = {
              unit: field.unit,
              points: vals.map((v) => ({ date: v.date, value: v.value as number })),
            };
          }
        });
        return { type: s.type, label: s.label, data: changes, seriesByField: Object.keys(seriesByField).length > 0 ? seriesByField : undefined };
      }
      case "tracker_metric": {
        if (!s.metric_name) return { type: s.type, label: s.label, data: {} };
        const def = data.metric_definitions.find((d) => d.client_id === clientId && d.name === s.metric_name);
        if (!def) return { type: s.type, label: s.label, data: { note: "not set up for this client" } };
        const entries = data.metric_entries
          .filter((e) => e.metric_definition_id === def.id && e.value != null && e.period >= periodStart && e.period <= periodEnd)
          .sort((a, b) => (a.period < b.period ? -1 : 1));
        const avg = entries.length > 0 ? entries.reduce((sum, e) => sum + (e.value as number), 0) / entries.length : null;
        const series = entries.map((e) => ({ date: e.period, value: e.value as number }));
        return {
          type: s.type,
          label: s.label,
          data: { metric: def.name, average: avg != null ? Math.round(avg * 10) / 10 : null, entries_logged: entries.length, unit: def.unit },
          series: series.length >= 2 ? series : undefined,
        };
      }
      case "photos": {
        const slotIds = data.photo_slots.filter((sl) => sl.client_id === clientId).map((sl) => sl.id);
        const count = data.photo_uploads.filter(
          (u) => slotIds.includes(u.slot_id) && u.period >= periodStart && u.period <= periodEnd
        ).length;
        return { type: s.type, label: s.label, data: { photos_uploaded: count } };
      }
      case "goals": {
        const goals = data.client_goals.filter((g) => g.client_id === clientId);
        return {
          type: s.type,
          label: s.label,
          data: {
            short_term_done: `${goals.filter((g) => g.term === "short" && g.done).length}/${goals.filter((g) => g.term === "short").length}`,
            long_term: goals.filter((g) => g.term === "long").map((g) => g.text).join("; ") || null,
          },
        };
      }
      default:
        return { type: s.type, label: s.label, data: {} };
    }
  });
}

export function listClientReports(clientId: number): ClientReport[] {
  return getData()
    .client_reports.filter((r) => r.client_id === clientId)
    .sort((a, b) => (a.generated_at < b.generated_at ? 1 : -1));
}

export function getClientReport(id: number): ClientReport | undefined {
  return getData().client_reports.find((r) => r.id === id);
}

export function createDraftReport(
  clientId: number,
  templateId: number | null,
  templateName: string,
  periodStart: string,
  periodEnd: string,
  summary: string,
  aiGenerated: boolean,
  sectionsSnapshot: ReportSectionData[]
): number {
  const data = getData();
  const id = allocId("client_reports");
  data.client_reports.push({
    id,
    client_id: clientId,
    template_id: templateId,
    template_name: templateName,
    period_start: periodStart,
    period_end: periodEnd,
    status: "draft",
    summary,
    ai_generated: aiGenerated,
    sections_snapshot: JSON.stringify(sectionsSnapshot),
    generated_at: new Date().toISOString(),
    approved_at: null,
    sent_at: null,
    opened_at: null,
  });
  persist();
  return id;
}

// The client expanded this report in Settings. Doesn't touch the report
// content — it only clears the "New" flag, and only once, so re-reading an
// old report never makes it look new again.
export function markReportOpened(id: number) {
  const data = getData();
  const report = data.client_reports.find((r) => r.id === id);
  if (!report || report.opened_at) return;
  report.opened_at = new Date().toISOString();
  persist();
}

export function updateReportSummary(id: number, summary: string) {
  const data = getData();
  const report = data.client_reports.find((r) => r.id === id);
  if (report) {
    report.summary = summary;
    persist();
  }
}

export function approveReport(id: number) {
  const data = getData();
  const report = data.client_reports.find((r) => r.id === id);
  if (report && report.status === "draft") {
    report.status = "approved";
    report.approved_at = new Date().toISOString();
    persist();
  }
}

export function sendReport(id: number) {
  const data = getData();
  const report = data.client_reports.find((r) => r.id === id);
  if (report && report.status !== "sent") {
    report.status = "sent";
    report.sent_at = new Date().toISOString();
    persist();
    logCoachActivity(report.client_id, `Your coach sent you a progress report (${report.period_start} to ${report.period_end})`, {
      kind: "report",
      actionTab: "settings",
      actionLabel: "Read report",
      actionRef: report.id,
    });
  }
}

export function deleteReport(id: number) {
  const data = getData();
  data.client_reports = data.client_reports.filter((r) => r.id !== id);
  persist();
}

// ---- Phase timeline: the coach's "what block are we in, until when, and
// what comes after" view, one row per track, one bar per phase. Mirrors
// the planning sheet the coach kept before the app. ----

export type { ClientPhase, PhaseTrack } from "./db";

export const PHASE_TRACKS: { id: PhaseTrack; label: string }[] = [
  { id: "nutrition", label: "Nutrition" },
  { id: "training", label: "Training" },
  { id: "lifestyle", label: "Lifestyle" },
];

export function listClientPhases(clientId: number): ClientPhase[] {
  return getData()
    .client_phases.filter((p) => p.client_id === clientId)
    .sort((a, b) => (a.start_week < b.start_week ? -1 : a.start_week > b.start_week ? 1 : 0));
}

export function getClientIdForPhase(phaseId: number): number | null {
  return getData().client_phases.find((p) => p.id === phaseId)?.client_id ?? null;
}

// Weeks are snapped to their Monday so two phases entered on different
// weekdays still line up in whole-week columns.
// `programId`: for a training phase, an existing programme to be the plan
// for instead of a fresh draft.
export function addClientPhase(clientId: number, track: PhaseTrack, name: string, startDate: string, endDate: string, programId: number | null = null): ClientPhase {
  const data = getData();
  const start = weekStart(startDate);
  const end = weekStart(endDate);
  const first = start <= end ? start : end;
  const last = start <= end ? end : start;
  const phase: ClientPhase = {
    id: allocId("client_phases"),
    client_id: clientId,
    track,
    name: name.trim(),
    start_week: first,
    end_week: last,
    // Every phase starts as a draft, whichever track it is on: the coach
    // makes it, fills it in, and only then schedules it. A phase that
    // reached the client the moment it was named was the old way, and it
    // meant a half-built plan was already live.
    draft: true,
  };
  // A training phase is a programme: adding one on the Plan tab makes a
  // draft, named and sized to match, ready to build in the Training tab.
  if (track === "training" && programId == null) {
    const weeks = Math.max(1, Math.round((new Date(`${last}T00:00:00`).getTime() - new Date(`${first}T00:00:00`).getTime()) / (7 * 86400000)) + 1);
    const existingWeeks = listWeekNumbers(clientId);
    const startWeek = (existingWeeks.length > 0 ? Math.max(...existingWeeks) : 0) + 1;
    phase.program_id = createProgram(clientId, phase.name, weeks, startWeek).id;
  }
  getData().client_phases.push(phase);
  persist();
  if (track === "training" && programId != null) linkPhaseToProgram(phase.id, programId);
  return phase;
}

// `adjustProgram`: for a phase that is a training programme, also make the
// programme the phase's length in weeks: add weeks at the end, or remove
// trailing weeks that have nothing logged in them. Without it the phase
// keeps the coach's dates and the programme is left as it is.
export function updateClientPhase(
  phaseId: number,
  track: PhaseTrack,
  name: string,
  startDate: string,
  endDate: string,
  adjustProgram = false
) {
  const data = getData();
  const phase = data.client_phases.find((p) => p.id === phaseId);
  if (!phase) return;
  let start = weekStart(startDate);
  let end = weekStart(endDate);
  if (start > end) [start, end] = [end, start];
  const program = phase.program_id ? data.training_programs.find((p) => p.id === phase.program_id) : undefined;
  // A programme starts on its deploy week. Moving the phase's start moves
  // that week with it, unless the client has already trained in the
  // programme: then the start stays put and only the end can move.
  const anchor = program ? (program.status === "deployed" ? program.deployed_at : program.scheduled_at) : null;
  if (anchor && program) {
    const anchored = weekStart(anchor.slice(0, 10));
    if (start !== anchored) {
      if (programLoggedWeekIndexes(program.id).length > 0) start = anchored;
      else if (program.status === "deployed" && start > weekStart(localDateStr())) {
        // Moved into a later week: it is not running any more, it is
        // coming. Scheduled, so it goes live on that week by itself and the
        // programme running now stays the live one.
        program.status = "draft";
        program.scheduled_at = `${start}${anchor.slice(10)}`;
        program.deployed_at = null;
      } else if (program.status === "deployed") program.deployed_at = `${start}${anchor.slice(10)}`;
      else program.scheduled_at = `${start}${anchor.slice(10)}`;
    }
    if (end < start) end = start;
  }
  // A programme's phase stays on the training track; its name is the
  // programme's name, so a rename here renames the programme.
  phase.track = program ? "training" : track;
  phase.name = name.trim();
  phase.start_week = start;
  phase.end_week = end;
  persist();
  if (!program) return;
  program.name = phase.name || program.name;
  persist();
  if (!adjustProgram) return;
  const weeks = Math.max(1, Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / (7 * 86400000)) + 1);
  if (weeks > program.total_weeks) {
    updateProgramTotalWeeks(program.id, weeks);
  } else if (weeks < program.total_weeks) {
    // Trailing weeks go one at a time from the end, stopping at the first
    // that has logged sets: a week the client trained is never deleted.
    const logged = programLoggedWeekIndexes(program.id);
    for (let i = program.total_weeks; i > weeks; i--) {
      if (logged.includes(i)) break;
      removeProgramWeek(program.id, i);
    }
    // The phase follows the programme only as far as it could be trimmed.
    syncProgramPhase(program.id);
  }
}

// 1-based indexes of the programme's weeks that have at least one logged set.
export function programLoggedWeekIndexes(programId: number): number[] {
  const data = getData();
  const program = data.training_programs.find((p) => p.id === programId);
  if (!program) return [];
  const out: number[] = [];
  for (let i = 1; i <= program.total_weeks; i++) {
    const weekNumber = program.start_week + i - 1;
    const dayIds = new Set(
      data.program_days.filter((pd) => pd.client_id === program.client_id && pd.week_number === weekNumber).map((pd) => pd.id)
    );
    const assignmentIds = new Set(data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id)).map((wa) => wa.id));
    if (data.set_logs.some((sl) => assignmentIds.has(sl.workout_assignment_id))) out.push(i);
  }
  return out;
}

export function removeClientPhase(phaseId: number) {
  const data = getData();
  const phase = data.client_phases.find((p) => p.id === phaseId);
  if (!phase) return;
  data.client_phases = data.client_phases.filter((p) => p.id !== phaseId);
  persist();
  // Removing a programme's phase: an unbuilt draft goes with it, since it
  // only existed for the phase. Anything built, scheduled or live stays in
  // the Training tab, unlinked.
  if (phase.program_id) {
    const program = data.training_programs.find((p) => p.id === phase.program_id);
    // A live, scheduled or past programme would otherwise get its phase
    // straight back on the next page load (syncProgramPhase).
    if (program && (program.status === "deployed" || program.scheduled_at)) {
      program.phase_removed = true;
      persist();
    }
    if (program && program.status === "draft" && !program.scheduled_at) {
      const built = getWeek(program.client_id, program.start_week).some((d) => getAssignmentsForDay(d.id).length > 0) ||
        Array.from({ length: program.total_weeks }, (_, i) => program.start_week + i).some((w) =>
          getWeek(program.client_id, w).some((d) => getAssignmentsForDay(d.id).length > 0)
        );
      if (!built) removeProgram(program.id);
    }
  }
}

// Keeps a programme's phase in step with the programme. A deployed or
// scheduled programme always has one, dated from its deploy or scheduled
// date and as long as its weeks. A plain draft only has one if it was made
// from the Plan tab, and then only the name follows.
// `dates` false keeps the phase's dates as the coach set them and only
// carries the name across (a rename); true re-derives them from the deploy
// week and the programme's length (deploy, schedule, weeks added/removed).
export function syncProgramPhase(programId: number, dates = true) {
  const data = getData();
  const program = data.training_programs.find((p) => p.id === programId);
  if (!program) return;
  const anchor = program.status === "deployed" ? program.deployed_at : program.scheduled_at;
  let phase = data.client_phases.find((p) => p.program_id === programId);
  const name = program.name?.trim() || "Untitled programme";
  if (!anchor || (!dates && phase)) {
    if (phase && phase.name !== name) {
      phase.name = name;
      persist();
    }
    return;
  }
  const start = weekStart(anchor.slice(0, 10));
  const endDate = new Date(`${start}T00:00:00`);
  endDate.setDate(endDate.getDate() + (program.total_weeks - 1) * 7);
  const end = localDateStr(endDate);
  if (!phase) {
    // The coach deleted it from the Plan tab; it stays deleted.
    if (program.phase_removed) return;
    phase = { id: allocId("client_phases"), client_id: program.client_id, track: "training", name, start_week: start, end_week: end, program_id: programId };
    data.client_phases.push(phase);
  } else {
    phase.track = "training";
    phase.name = name;
    phase.start_week = start;
    phase.end_week = end;
  }
  persist();
}

// The phase a track is in this week, if any: what the client's Home line
// and the card's Goal / phase fact can read off instead of retyping.
export function getCurrentPhase(clientId: number, track: PhaseTrack): ClientPhase | null {
  const week = weekStart(localDateStr());
  // A draft is the coach's alone, so it is never the phase anyone is in.
  return listClientPhases(clientId).find((p) => !p.draft && p.track === track && p.start_week <= week && p.end_week >= week) ?? null;
}

// Goal / phase as the app should show it: the nutrition phase running this
// week on the Plan tab wins, so a plan that goes from Bulk to Cut changes
// the card, the panel chip and the client's Home on the Monday it turns
// over. The hand-typed field is the fallback for clients without a plan.
export function effectiveGoalPhase(clientId: number, typed: string | null | undefined): string {
  return getCurrentPhase(clientId, "nutrition")?.name ?? typed ?? "";
}

// What the client's Home shows of the phase plan: the phase they are in on
// the nutrition track (the coach's headline), how many weeks it has left,
// what follows it, and, behind a chevron, every phase on every track with
// where "now" falls. Vertical and dated, since a week grid is too wide for
// a phone.
export type PlanPhaseView = {
  id: number;
  name: string;
  status: "past" | "now" | "next";
  rangeLabel: string;
  weeks: number;
  // Position on the plan's week strip: first column and how many it spans.
  startIndex: number;
  span: number;
  /** ISO Mondays of the phase's first and last week. */
  startWeek: string;
  endWeek: string;
};
export type PlanTrackView = { track: PhaseTrack; label: string; phases: PlanPhaseView[] };
// One column of the week strip. monthLabel is set on the first week of
// each month only, so the strip can print the month once above its weeks.
export type PlanWeekView = { monday: string; num: number; monthLabel: string | null; now: boolean };
export type ClientPlanView = {
  current: { name: string; weeksLeft: number; endLabel: string } | null;
  next: { name: string; startLabel: string } | null;
  tracks: PlanTrackView[];
  weeks: PlanWeekView[];
  nowIndex: number;
  /** Server-local date, so the phone's day maths agree with the server's. */
  today: string;
};

export function getClientPlanView(clientId: number): ClientPlanView | null {
  // Draft phases stay off the client's phone until the coach deploys them.
  const phases = listClientPhases(clientId).filter((p) => !p.draft);
  if (phases.length === 0) return null;
  const week = weekStart(localDateStr());
  const weeksBetween = (a: string, b: string) =>
    Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / (7 * 86400000));
  const endOfWeek = (monday: string) => {
    const d = new Date(`${monday}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return localDateStr(d);
  };
  const short = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const addWeeks = (monday: string, n: number) => {
    const d = new Date(`${monday}T00:00:00`);
    d.setDate(d.getDate() + n * 7);
    return localDateStr(d);
  };

  // The strip starts at last week, so the client sees one week of context
  // and then everything ahead, out to the last phase the coach has set.
  // Phases that began earlier are clipped to that edge; their label still
  // says their full length.
  const first = addWeeks(week, -1);
  let last = phases.map((p) => p.end_week).reduce((a, b) => (a > b ? a : b));
  if (last < week) last = week;
  const count = weeksBetween(first, last) + 1;
  let lastMonth = "";
  const weeks: PlanWeekView[] = Array.from({ length: count }, (_, i) => {
    const monday = addWeeks(first, i);
    const d = new Date(`${monday}T00:00:00`);
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + 3);
    const jan1 = new Date(thursday.getFullYear(), 0, 1);
    const num = Math.floor((thursday.getTime() - jan1.getTime()) / 86400000 / 7) + 1;
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const monthLabel = month !== lastMonth ? month : null;
    lastMonth = month;
    return { monday, num, monthLabel, now: monday === week };
  });

  const view = (p: ClientPhase): PlanPhaseView => ({
    id: p.id,
    name: p.name,
    status: p.end_week < week ? "past" : p.start_week > week ? "next" : "now",
    rangeLabel: `${short(p.start_week)} – ${short(endOfWeek(p.end_week))}`,
    weeks: weeksBetween(p.start_week, p.end_week) + 1,
    startIndex: Math.max(0, weeksBetween(first, p.start_week)),
    span: weeksBetween(p.start_week < first ? first : p.start_week, p.end_week) + 1,
    startWeek: p.start_week,
    endWeek: p.end_week,
  });

  // Headline track: nutrition if it has phases, else whichever track does.
  const headlineTrack =
    PHASE_TRACKS.find((t) => t.id === "nutrition" && phases.some((p) => p.track === "nutrition"))?.id ??
    PHASE_TRACKS.find((t) => phases.some((p) => p.track === t.id))!.id;
  const onTrack = phases.filter((p) => p.track === headlineTrack);
  const currentPhase = onTrack.find((p) => p.start_week <= week && p.end_week >= week) ?? null;
  const nextPhase = onTrack.find((p) => p.start_week > (currentPhase?.end_week ?? week)) ?? null;

  return {
    current: currentPhase
      ? { name: currentPhase.name, weeksLeft: weeksBetween(week, currentPhase.end_week) + 1, endLabel: short(endOfWeek(currentPhase.end_week)) }
      : null,
    next: nextPhase ? { name: nextPhase.name, startLabel: short(nextPhase.start_week) } : null,
    // Phases that ended before last week are history and stay off the phone.
    tracks: PHASE_TRACKS.map((t) => ({
      track: t.id,
      label: t.label,
      phases: phases.filter((p) => p.track === t.id && p.end_week >= first).map(view),
    })).filter(
      (t) => t.phases.length > 0
    ),
    weeks,
    nowIndex: weeksBetween(first, week),
    today: localDateStr(),
  };
}

// ---- Calorie log: the client's own daily kcal, reported on the Nutrition
// tab. A single number per day, kept separate from the check-in metrics
// because it belongs with the targets it is measured against. ----

export type { CalorieLog } from "./db";

export function getCalorieLog(clientId: number, date: string): CalorieLog | null {
  return getData().calorie_logs.find((c) => c.client_id === clientId && c.date === date) ?? null;
}

// Most recent first.
export function listCalorieLogs(clientId: number, limit = 30): CalorieLog[] {
  return getData()
    .calorie_logs.filter((c) => c.client_id === clientId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit);
}

// null clears the day.
// `note` and `dayType` left undefined keep what the day already has.
export function setCalorieLog(
  clientId: number,
  date: string,
  kcal: number | null,
  note: string | null | undefined = undefined,
  dayType: "training" | "rest" | undefined = undefined,
  source: "diary" | null | undefined = undefined
) {
  const data = getData();
  const existing = data.calorie_logs.find((c) => c.client_id === clientId && c.date === date);
  if (kcal == null) {
    if (existing) data.calorie_logs = data.calorie_logs.filter((c) => c !== existing);
  } else if (existing) {
    existing.kcal = kcal;
    existing.logged_at = new Date().toISOString();
    if (note !== undefined) existing.note = note;
    if (dayType !== undefined) existing.day_type = dayType;
    if (source !== undefined) existing.source = source;
  } else {
    data.calorie_logs.push({
      id: allocId("calorie_logs"),
      client_id: clientId,
      date,
      kcal,
      logged_at: new Date().toISOString(),
      note: note ?? null,
      ...(dayType ? { day_type: dayType } : {}),
      ...(source ? { source } : {}),
    });
  }
  persist();
}

// ---- Check-in notes: the client's own words beside the numbers ----

export function setCheckInNote(clientId: number, kind: CheckInNote["kind"], period: string, text: string) {
  const data = getData();
  const clean = text.trim();
  const existing = data.check_in_notes.find((n) => n.client_id === clientId && n.kind === kind && n.period === period);
  if (!clean) {
    if (existing) data.check_in_notes = data.check_in_notes.filter((n) => n !== existing);
  } else if (existing) {
    existing.text = clean;
    existing.created_at = new Date().toISOString();
  } else {
    data.check_in_notes.push({ id: allocId("check_in_notes"), client_id: clientId, kind, period, text: clean, created_at: new Date().toISOString() });
  }
  persist();
}

// ---- The client's own exercise notes ----------------------------------

/** exercise_id -> note text, for one client at one gym (null: no gyms, or home). */
export function getClientExerciseNotes(clientId: number, gymId: number | null = null): Map<number, string> {
  const home = homeGymId(clientId);
  const want = gymId ?? home;
  const out = new Map<number, string>();
  for (const n of getData().client_exercise_notes ?? []) {
    if (n.client_id === clientId && (n.gym_id ?? home) === want) out.set(n.exercise_id, n.text);
  }
  return out;
}

export function setClientExerciseNote(clientId: number, exerciseId: number, text: string, gymId: number | null = null) {
  const data = getData();
  if (!data.client_exercise_notes) data.client_exercise_notes = [];
  const home = homeGymId(clientId);
  const want = gymId ?? home;
  const clean = text.trim();
  const existing = data.client_exercise_notes.find(
    (n) => n.client_id === clientId && n.exercise_id === exerciseId && (n.gym_id ?? home) === want
  );
  if (!clean) {
    if (existing) data.client_exercise_notes = data.client_exercise_notes.filter((n) => n !== existing);
  } else if (existing) {
    existing.text = clean;
    existing.updated_at = new Date().toISOString();
  } else {
    data.client_exercise_notes.push({ id: allocId("client_exercise_notes"), client_id: clientId, exercise_id: exerciseId, text: clean, updated_at: new Date().toISOString(), gym_id: want });
  }
  persist();
}

// ---- Gyms ---------------------------------------------------------------
// See ClientGym in db.ts for the model.

/** The client's gyms, oldest first; the removed ones only when asked. */
export function listClientGyms(clientId: number, includeArchived = false): ClientGym[] {
  return (getData().client_gyms ?? [])
    .filter((g) => g.client_id === clientId && (includeArchived || !g.archived))
    .sort((a, b) => a.id - b.id);
}

/** The gym the coach made home, else the first the client had; null without gyms. */
export function homeGymId(clientId: number): number | null {
  const gyms = listClientGyms(clientId, true);
  return (gyms.find((g) => g.is_home) ?? gyms[0])?.id ?? null;
}

/**
 * A draft phase, named and dated, goes out: scheduled when it starts in a
 * later week, live when its start week has already come. The same step on
 * every track — nutrition, lifestyle and training alike — so "scheduled"
 * means one thing to a coach wherever they are standing.
 *
 * A training phase's length is its programme's, so its weeks come from the
 * builder rather than from here; the start is still the coach's to pick.
 */
export function schedulePhase(phaseId: number, name: string, startDate: string, endDate: string): boolean {
  const data = getData();
  const phase = data.client_phases.find((p) => p.id === phaseId);
  if (!phase) return false;
  const start = weekStart(startDate);
  const end = weekStart(endDate);
  phase.name = name.trim() || phase.name;
  phase.start_week = start <= end ? start : end;
  phase.end_week = start <= end ? end : start;
  delete phase.draft;
  persist();
  // A programme keeps its length; what moves is when it begins.
  if (phase.program_id) syncProgramPhase(phase.program_id, false);
  const live = phase.start_week <= weekStart(localDateStr());
  if (live) {
    const where = { nutrition: "nutrition", training: "training", lifestyle: "home" } as const;
    logCoachActivity(phase.client_id, `Your coach set a new ${phase.track} phase${phase.name ? `: ${phase.name}` : ""}`, {
      kind: "programme",
      actionTab: where[phase.track] ?? "home",
      actionLabel: "Take a look",
    });
  }
  return live;
}

/** Back to a draft. Only before the client has been in it. */
export function unschedulePhase(phaseId: number): boolean {
  const phase = getData().client_phases.find((p) => p.id === phaseId);
  if (!phase || phase.draft) return false;
  if (phase.start_week <= weekStart(localDateStr())) return false;
  phase.draft = true;
  persist();
  return true;
}

/**
 * Makes a gym the home gym. The home gym's weights are target_weight_kg,
 * and sets, notes and exercise goals with no gym on them are the home
 * gym's, so the old home's are pinned to it first and the new home's
 * weights move into target_weight_kg. A new home that had no weight of its
 * own was already starting from that figure, so it keeps it.
 */
export function setHomeGym(gymId: number) {
  const data = getData();
  const gym = data.client_gyms.find((g) => g.id === gymId && !g.archived);
  if (!gym) return;
  const clientId = gym.client_id;
  const oldHome = homeGymId(clientId);
  if (oldHome == null || oldHome === gymId) return;

  const dayIds = new Set(data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.id));
  const assignments = data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id));
  const assignmentIds = new Set(assignments.map((wa) => wa.id));
  for (const sl of data.set_logs) if (assignmentIds.has(sl.workout_assignment_id) && sl.gym_id == null) sl.gym_id = oldHome;
  for (const n of data.client_exercise_notes) if (n.client_id === clientId && n.gym_id == null) n.gym_id = oldHome;
  for (const g of data.client_goals) {
    if (g.client_id === clientId && g.tracked_by?.kind === "exercise" && g.tracked_by.gymId == null) g.tracked_by = { ...g.tracked_by, gymId: oldHome };
  }
  for (const wa of assignments) {
    const targets = { ...(wa.gym_targets ?? {}) };
    const incoming = targets[gymId];
    targets[oldHome] = { kg: wa.target_weight_kg, set_at: wa.target_set_at ?? null };
    // A week trained at the new home before it had a weight of its own was
    // its first visit there: what was lifted is that week's weight, or the
    // week would read as short of the old home's figure.
    const firstVisitBest = Math.max(
      ...data.set_logs
        .filter((sl) => sl.workout_assignment_id === wa.id && sl.gym_id === gymId && sl.weight_kg != null)
        .map((sl) => sl.weight_kg as number)
    );
    if (incoming?.kg != null) {
      wa.target_weight_kg = incoming.kg;
      wa.target_set_at = incoming.set_at ?? null;
    } else if (wa.target_weight_kg != null && Number.isFinite(firstVisitBest)) {
      wa.target_weight_kg = firstVisitBest;
      wa.target_set_at = null;
    }
    delete targets[gymId];
    wa.gym_targets = targets;
  }
  for (const g of data.client_gyms) if (g.client_id === clientId) g.is_home = g.id === gymId;
  persist();
}

export function getClientIdForGym(gymId: number): number | null {
  return (getData().client_gyms ?? []).find((g) => g.id === gymId)?.client_id ?? null;
}

/** Adds a gym, or brings back a removed one of the same name. */
export function addClientGym(clientId: number, name: string): ClientGym | null {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!clean) return null;
  const data = getData();
  const same = listClientGyms(clientId, true).find((g) => g.name.toLowerCase() === clean.toLowerCase());
  if (same) {
    same.archived = false;
    persist();
    return same;
  }
  const gym: ClientGym = { id: allocId("client_gyms"), client_id: clientId, name: clean, created_at: new Date().toISOString(), last_used_at: null, archived: false };
  data.client_gyms.push(gym);
  persist();
  return gym;
}

/**
 * Hides a gym from the pickers. Its sets, weights and notes stay. Removing
 * the home gym hands home to the next gym first, so the Weight figure goes
 * on being a gym still in use and the removed gym keeps its own weights.
 */
export function removeClientGym(gymId: number) {
  const gym = (getData().client_gyms ?? []).find((g) => g.id === gymId);
  if (!gym) return;
  const others = listClientGyms(gym.client_id).filter((g) => g.id !== gymId);
  if (homeGymId(gym.client_id) === gymId && others.length > 0) setHomeGym(others[0].id);
  gym.archived = true;
  persist();
}

/** The gym a new session starts on: the one picked most recently. */
export function currentGymId(clientId: number): number | null {
  const gyms = listClientGyms(clientId);
  if (gyms.length === 0) return null;
  const used = gyms.filter((g) => g.last_used_at).sort((a, b) => (a.last_used_at! < b.last_used_at! ? 1 : -1));
  return (used[0] ?? gyms.find((g) => g.id === homeGymId(clientId)) ?? gyms[0]).id;
}

/** Where a day was trained: the gym of its sets, else the current gym. */
export function dayGymId(programDayId: number): number | null {
  const data = getData();
  const day = data.program_days.find((pd) => pd.id === programDayId);
  if (!day) return null;
  const home = homeGymId(day.client_id);
  if (home == null) return null;
  const ids = new Set(data.workout_assignments.filter((wa) => wa.program_day_id === day.id).map((wa) => wa.id));
  const log = data.set_logs.find((sl) => ids.has(sl.workout_assignment_id));
  return log ? log.gym_id ?? home : currentGymId(day.client_id);
}

/** The weight target on this prescription at this gym. */
export function targetAtGym(wa: WorkoutAssignment, gymId: number | null, home: number | null): number | null {
  if (gymId == null || gymId === home) return wa.target_weight_kg;
  return wa.gym_targets?.[gymId]?.kg ?? wa.target_weight_kg;
}

/**
 * The client picked a gym for a session. It becomes the gym new sessions
 * start on, and sets already logged that day move to it (a wrong pick is
 * usually noticed after the first set), with the weights worked out again.
 */
export function pickGymForDay(programDayId: number, gymId: number) {
  const data = getData();
  const day = data.program_days.find((pd) => pd.id === programDayId);
  const gym = (data.client_gyms ?? []).find((g) => g.id === gymId);
  if (!day || !gym || gym.client_id !== day.client_id) return;
  gym.last_used_at = new Date().toISOString();
  const ids = data.workout_assignments.filter((wa) => wa.program_day_id === day.id).map((wa) => wa.id);
  const moved = new Set<number>();
  for (const sl of data.set_logs) {
    if (ids.includes(sl.workout_assignment_id) && sl.gym_id !== gymId) {
      sl.gym_id = gymId;
      moved.add(sl.workout_assignment_id);
    }
  }
  persist();
  moved.forEach((id) => progressTargetFromLogs(id));
}

/**
 * The warm-up the client did the last time they had this exercise: the
 * latest earlier session of theirs with warm-up sets on it. What this
 * week's warm-up starts from.
 */
export function getLastWarmupSets(assignmentId: number): { weight_kg: number | null; reps: number | null }[] {
  const data = getData();
  const wa = data.workout_assignments.find((x) => x.id === assignmentId);
  const day = wa && data.program_days.find((pd) => pd.id === wa.program_day_id);
  if (!wa || !day) return [];
  const days = new Map(data.program_days.filter((pd) => pd.client_id === day.client_id).map((pd) => [pd.id, pd]));
  const at = (pd: { week_number: number; day_of_week: number }) => pd.week_number * 100 + pd.day_of_week;
  let best: { when: number; sets: { weight_kg: number | null; reps: number | null }[] } | null = null;
  for (const other of data.workout_assignments) {
    if (other.exercise_id !== wa.exercise_id || !other.warmup_sets?.length) continue;
    const pd = days.get(other.program_day_id);
    if (!pd || at(pd) >= at(day)) continue;
    if (!best || at(pd) > best.when) best = { when: at(pd), sets: other.warmup_sets };
  }
  return best?.sets ?? [];
}

/** The client's warm-up sets on an exercise; an empty list clears them. */
export function setWarmupSets(assignmentId: number, sets: { weight_kg: number | null; reps: number | null }[]) {
  const wa = getData().workout_assignments.find((x) => x.id === assignmentId);
  if (!wa) return;
  const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
  const clean = sets
    .slice(0, 8)
    .map((s) => ({ weight_kg: num(s?.weight_kg, 2000), reps: num(s?.reps, 1000) }))
    .filter((s) => s.weight_kg != null || s.reps != null);
  if (clean.length) wa.warmup_sets = clean;
  else delete wa.warmup_sets;
  persist();
}

/** The client's reason for not doing a session; empty text clears it. */
export function setSessionSkipReason(programDayId: number, text: string) {
  const data = getData();
  const day = data.program_days.find((pd) => pd.id === programDayId);
  if (!day) return;
  const next = text.trim().slice(0, 300);
  if (next) {
    day.skip_reason = next;
    day.skip_reason_at = new Date().toISOString();
  } else {
    delete day.skip_reason;
    delete day.skip_reason_at;
  }
  persist();
}

/**
 * The most recent earlier session of this exercise at this gym: its
 * prescription, sheet week and sets. What a coach compares a gym's sets
 * against, since last week may have been at the other gym.
 */
export function getLastVisitAtGym(
  clientId: number,
  exerciseId: number,
  gymId: number | null,
  before: { week: number; dayOfWeek: number }
): { assignment: WorkoutAssignment; weekNumber: number; logs: SetLog[] } | null {
  const data = getData();
  const home = homeGymId(clientId);
  const want = gymId ?? home;
  const days = data.program_days
    .filter(
      (pd) =>
        pd.client_id === clientId &&
        (pd.week_number < before.week || (pd.week_number === before.week && pd.day_of_week < before.dayOfWeek))
    )
    .sort((a, b) => b.week_number - a.week_number || b.day_of_week - a.day_of_week);
  for (const pd of days) {
    for (const wa of data.workout_assignments.filter((x) => x.program_day_id === pd.id && x.exercise_id === exerciseId)) {
      const logs = data.set_logs
        .filter((sl) => sl.workout_assignment_id === wa.id && (sl.gym_id ?? home) === want)
        .sort((a, b) => a.set_number - b.set_number);
      if (logs.length) return { assignment: wa, weekNumber: pd.week_number, logs };
    }
  }
  return null;
}

export function getClientProgramNote(clientId: number, programId: number): string {
  return (getData().client_program_notes ?? []).find((n) => n.client_id === clientId && n.program_id === programId)?.text ?? "";
}

export function getClientProgramNoteMeta(clientId: number, programId: number): { text: string; updatedAt: string } | null {
  const n = (getData().client_program_notes ?? []).find((x) => x.client_id === clientId && x.program_id === programId);
  return n && n.text.trim() ? { text: n.text, updatedAt: n.updated_at } : null;
}

export function getClientIdForProgram(programId: number): number | null {
  return getData().training_programs.find((p) => p.id === programId)?.client_id ?? null;
}

export function setClientProgramNote(clientId: number, programId: number, text: string) {
  const data = getData();
  if (!data.client_program_notes) data.client_program_notes = [];
  const clean = text.trim();
  const existing = data.client_program_notes.find((n) => n.client_id === clientId && n.program_id === programId);
  if (!clean) {
    if (existing) data.client_program_notes = data.client_program_notes.filter((n) => n !== existing);
  } else if (existing) {
    existing.text = clean;
    existing.updated_at = new Date().toISOString();
  } else {
    data.client_program_notes.push({ id: allocId("client_program_notes"), client_id: clientId, program_id: programId, text: clean, updated_at: new Date().toISOString() });
  }
  persist();
}

export function getCheckInNote(clientId: number, kind: CheckInNote["kind"], period: string): string | null {
  return getData().check_in_notes.find((n) => n.client_id === clientId && n.kind === kind && n.period === period)?.text ?? null;
}

/** Newest first, for the coach. */
export function listCheckInNotes(clientId: number, limit = 20): CheckInNote[] {
  return getData()
    .check_in_notes.filter((n) => n.client_id === clientId)
    .sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

// ---- Reordering and copying within a day / week ----

// Sets the order of a day's exercises to the given assignment ids; anything
// on the day but not in the list keeps its place after them.
/**
 * The sessions of one week, in the order the coach dragged them into. A
 * session's place in its week IS day_of_week, so this renumbers them 1..N
 * without gaps; everything hanging off a session (its exercises, cardio and
 * the client's logs) travels with it, since only the number changes.
 */
export function reorderSessions(clientId: number, week: number, orderedIds: number[]) {
  const data = getData();
  const inWeek = data.program_days.filter((pd) => pd.client_id === clientId && pd.week_number === week);
  const rest = inWeek.filter((pd) => !orderedIds.includes(pd.id)).sort((a, b) => a.day_of_week - b.day_of_week);
  const sequence = [...orderedIds.map((id) => inWeek.find((pd) => pd.id === id)).filter((pd): pd is ProgramDay => !!pd), ...rest];
  if (sequence.length !== inWeek.length) return;
  sequence.forEach((pd, i) => (pd.day_of_week = i + 1));
  persist();
}

export function reorderAssignments(programDayId: number, orderedIds: number[]) {
  const data = getData();
  const onDay = data.workout_assignments.filter((wa) => wa.program_day_id === programDayId);
  const rest = onDay.filter((wa) => !orderedIds.includes(wa.id)).sort((a, b) => a.order_index - b.order_index);
  const sequence = [...orderedIds.map((id) => onDay.find((wa) => wa.id === id)).filter((wa): wa is WorkoutAssignment => !!wa), ...rest];
  sequence.forEach((wa, i) => (wa.order_index = i));
  persist();
}

// Copies one day's label, rest flag and exercises onto another day of the
// same client. Replaces what was there, so copying twice doesn't double up.
export function copyProgramDay(fromDayId: number, toDayId: number) {
  if (fromDayId === toDayId) return;
  const data = getData();
  const src = data.program_days.find((d) => d.id === fromDayId);
  const dest = data.program_days.find((d) => d.id === toDayId);
  if (!src || !dest || src.client_id !== dest.client_id) return;

  dest.label = src.label;
  const replacedIds = data.workout_assignments.filter((wa) => wa.program_day_id === dest.id).map((wa) => wa.id);
  data.workout_assignments = data.workout_assignments.filter((wa) => wa.program_day_id !== dest.id);
  data.assignment_custom_values = data.assignment_custom_values.filter((v) => !replacedIds.includes(v.workout_assignment_id));

  const srcAssignments = data.workout_assignments
    .filter((wa) => wa.program_day_id === src.id)
    .sort((a, b) => a.order_index - b.order_index);
  for (const wa of srcAssignments) {
    const id = allocId("workout_assignments");
    data.workout_assignments.push({ ...wa, warmup_sets: undefined, id, program_day_id: dest.id });
    for (const v of data.assignment_custom_values.filter((v) => v.workout_assignment_id === wa.id)) {
      data.assignment_custom_values.push({ ...v, id: allocId("assignment_custom_values"), workout_assignment_id: id });
    }
  }

  // Cardio is part of the session too; the target's own goes, ticks and all.
  data.cardio_entries = data.cardio_entries ?? [];
  const replacedCardio = new Set(data.cardio_entries.filter((c) => c.program_day_id === dest.id).map((c) => c.id));
  data.cardio_logs = (data.cardio_logs ?? []).filter((l) => !replacedCardio.has(l.cardio_entry_id));
  data.cardio_entries = data.cardio_entries.filter((c) => c.program_day_id !== dest.id);
  for (const c of data.cardio_entries.filter((c) => c.program_day_id === src.id)) {
    data.cardio_entries.push({ ...c, id: allocId("cardio_entries"), program_day_id: dest.id });
  }
  persist();
}

/**
 * Copies a session into a new session at the end of its week and, with
 * `laterWeeks`, at the end of every later week of its programme too. Always
 * appended rather than placed at a number, so a later week with fewer
 * sessions never grows empty ones to reach it. A week that already has the
 * most sessions a week holds is skipped. Returns the new session, or null
 * when the session's own week is full.
 */
export function copyProgramDayToNewSession(fromDayId: number, laterWeeks: boolean): ProgramDay | null {
  const src = getData().program_days.find((d) => d.id === fromDayId);
  if (!src) return null;
  const created = addSession(src.client_id, src.week_number, false);
  if (!created) return null;
  copyProgramDay(fromDayId, created.id);
  if (laterWeeks) {
    const program = getProgramForWeek(src.client_id, src.week_number);
    if (program) {
      for (let week = src.week_number + 1; week < program.start_week + program.total_weeks; week++) {
        const dest = addSession(src.client_id, week, false);
        if (dest) copyProgramDay(fromDayId, dest.id);
      }
    }
  }
  persist();
  return created;
}


// ---- Exercise library videos: one demo per exercise, shared everywhere it
// is prescribed. Set once, it follows the exercise onto every client's
// sheet until the coach changes it. ----

export function setExerciseVideoUrl(exerciseId: number, url: string | null) {
  const data = getData();
  const exercise = data.exercises.find((e) => e.id === exerciseId);
  if (!exercise) return;
  exercise.video_url = url && url.trim() ? url.trim() : null;
  persist();
}

export function saveLibraryVideoUpload(exerciseId: number, buffer: Buffer, mimeType: string): string {
  const ext = (mimeType.split("/")[1] || "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4";
  const dir = path.join(DATA_DIR, "uploads", "library");
  fs.mkdirSync(dir, { recursive: true });
  for (const existing of fs.readdirSync(dir)) {
    if (existing.startsWith(`${exerciseId}.`)) fs.rmSync(path.join(dir, existing), { force: true });
  }
  const filename = `${exerciseId}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/library/${filename}`;
}

// After copying a day within a week, the coach can push the same day onto
// the same weekday of every later week of the programme too. Each later
// week's day is replaced the same way copyProgramDay replaces its target.
export function copyProgramDayToLaterWeeks(fromDayId: number, toDayId: number): number {
  const data = getData();
  const dest = data.program_days.find((d) => d.id === toDayId);
  if (!dest) return 0;
  const program = listPrograms(dest.client_id).find(
    (p) => dest.week_number >= p.start_week && dest.week_number < p.start_week + p.total_weeks
  );
  if (!program) return 0;
  let touched = 0;
  for (let week = dest.week_number + 1; week < program.start_week + program.total_weeks; week++) {
    const target = sessionAt(dest.client_id, week, dest.day_of_week, true);
    if (!target) continue;
    copyProgramDay(fromDayId, target.id);
    touched += 1;
  }
  return touched;
}

// Empties a day in one go: every exercise on it, with the sets logged
// against them and their custom-column values. The day itself stays, with
// its label, so it can be rebuilt or marked rest.
export function clearProgramDay(programDayId: number) {
  const data = getData();
  const ids = data.workout_assignments.filter((wa) => wa.program_day_id === programDayId).map((wa) => wa.id);
  if (ids.length === 0) return;
  data.set_logs = data.set_logs.filter((sl) => !ids.includes(sl.workout_assignment_id));
  data.assignment_custom_values = data.assignment_custom_values.filter((v) => !ids.includes(v.workout_assignment_id));
  data.workout_assignments = data.workout_assignments.filter((wa) => !ids.includes(wa.id));
  persist();
}

// After the coach reorders a day, the same order can be pushed onto that
// weekday in every later week of the programme. Matched by exercise: rows
// for exercises the source day has take its order; anything else on the
// later day keeps its relative place after them.
export function applyDayOrderToLaterWeeks(programDayId: number): number {
  const data = getData();
  const src = data.program_days.find((d) => d.id === programDayId);
  if (!src) return 0;
  const program = listPrograms(src.client_id).find(
    (p) => src.week_number >= p.start_week && src.week_number < p.start_week + p.total_weeks
  );
  if (!program) return 0;
  const sequence = data.workout_assignments
    .filter((wa) => wa.program_day_id === src.id)
    .sort((a, b) => a.order_index - b.order_index)
    .map((wa) => wa.exercise_id);
  let touched = 0;
  for (let week = src.week_number + 1; week < program.start_week + program.total_weeks; week++) {
    const day = sessionAt(src.client_id, week, src.day_of_week);
    if (!day) continue;
    const rows = data.workout_assignments.filter((wa) => wa.program_day_id === day.id).sort((a, b) => a.order_index - b.order_index);
    if (rows.length === 0) continue;
    const rank = (wa: WorkoutAssignment) => {
      const i = sequence.indexOf(wa.exercise_id);
      return i < 0 ? sequence.length + wa.order_index : i;
    };
    [...rows].sort((a, b) => rank(a) - rank(b)).forEach((wa, i) => (wa.order_index = i));
    touched += 1;
  }
  if (touched > 0) persist();
  return touched;
}

// ---------------------------------------------------------------------------
// Pending-changes bar: one day's queued edits, applied together.
//
// Everything the coach changed on a day card since the last Apply arrives
// as one payload and lands in one persist. With `alsoRemaining`, the same
// weekday in each later week of the programme gets the same treatment,
// matched by exercise rather than by row, except weeks the client has
// already logged sets against: those are left alone and reported back by
// their programme-relative label ("W3").

export type DayFieldKey = "sets" | "reps" | "targetWeight" | "rpe" | "tempo" | "rest" | "distance" | "time" | "notes";
export type DayFieldValues = Partial<Record<DayFieldKey, string>>;

export type CardioFieldKey = "name" | "time" | "pace" | "incline" | "distance" | "notes";
export type CardioFieldValues = Partial<Record<CardioFieldKey, string>>;
export type CardioChanges = {
  /** entry id -> changed fields. */
  fields: Record<string, CardioFieldValues>;
  removed: number[];
  added: Record<CardioFieldKey, string>[];
  /** Full order of the surviving cardio ids, or null if untouched. */
  order?: number[] | null;
};

export function getClientIdForCardio(entryId: number): number | null {
  const data = getData();
  const entry = (data.cardio_entries ?? []).find((c) => c.id === entryId);
  if (!entry) return null;
  return data.program_days.find((pd) => pd.id === entry.program_day_id)?.client_id ?? null;
}

export function isCardioDone(entryId: number): boolean {
  return (getData().cardio_logs ?? []).some((l) => l.cardio_entry_id === entryId);
}

// Tick or untick a cardio entry. A double tap is idempotent either way.
export function setCardioDone(entryId: number, done: boolean) {
  const data = getData();
  data.cardio_logs = data.cardio_logs ?? [];
  const clientId = getClientIdForCardio(entryId);
  if (clientId == null) return;
  const has = data.cardio_logs.some((l) => l.cardio_entry_id === entryId);
  if (done && !has) data.cardio_logs.push({ id: allocId("cardio_logs"), cardio_entry_id: entryId, client_id: clientId, done_at: localStamp() });
  else if (!done && has) data.cardio_logs = data.cardio_logs.filter((l) => l.cardio_entry_id !== entryId);
  else return;
  persist();
}

export function listCardioForDay(programDayId: number): CardioEntry[] {
  return (getData().cardio_entries ?? [])
    .filter((c) => c.program_day_id === programDayId)
    .sort((a, b) => a.order_index - b.order_index);
}

export type DayChanges = {
  programDayId: number;
  alsoRemaining: boolean;
  label: string | null;
  rest: boolean | null;
  cardio: CardioChanges;
  /** assignment id -> changed fields, as the coach typed them. */
  fields: Record<string, DayFieldValues>;
  /** assignment id -> column id -> value. */
  custom: Record<string, Record<string, string>>;
  /** assignment id -> gym id -> weight, for the client's gyms after the home one. */
  gyms?: Record<string, Record<string, string>>;
  removed: number[];
  added: { exerciseId: number; fields: DayFieldValues }[];
  /** Full order of the surviving assignment ids, or null if untouched. */
  order: number[] | null;
};

function typedDayFields(raw: DayFieldValues) {
  const out: Partial<Pick<WorkoutAssignment, "sets" | "reps" | "target_weight_kg" | "rpe_target" | "tempo" | "rest_seconds" | "distance" | "time" | "notes">> = {};
  const num = (v: string | undefined) => {
    const t = (v ?? "").trim().replace(",", ".");
    return t ? Number(t) : null;
  };
  if (raw.sets != null) out.sets = Math.max(1, Number(raw.sets) || 1);
  if (raw.reps != null) out.reps = String(raw.reps);
  if (raw.targetWeight != null) out.target_weight_kg = num(raw.targetWeight);
  if (raw.rpe != null) out.rpe_target = num(raw.rpe);
  if (raw.tempo != null) out.tempo = raw.tempo.trim() || null;
  if (raw.rest != null) out.rest_seconds = parseRestSeconds(raw.rest);
  if (raw.distance != null) out.distance = raw.distance.trim() || null;
  if (raw.time != null) out.time = raw.time.trim() || null;
  if (raw.notes != null) out.notes = raw.notes.trim() || null;
  return out;
}

export function applyDayChanges(changes: DayChanges): { skipped: string[] } {
  const data = getData();
  const src = data.program_days.find((d) => d.id === changes.programDayId);
  if (!src) return { skipped: [] };

  // Only rows on this day can be removed from it. Without this a removed id
  // from anywhere (another day, another client) was deleted with its logged
  // sets.
  const removed = changes.removed.filter((id) =>
    data.workout_assignments.some((wa) => wa.id === id && wa.program_day_id === src.id)
  );

  // Remember which exercise each removed row was, so later weeks can drop
  // the same exercise rather than a row id they do not have.
  const removedExerciseIds = removed
    .map((id) => data.workout_assignments.find((wa) => wa.id === id)?.exercise_id)
    .filter((x): x is number => typeof x === "number");

  const applyTo = (day: ProgramDay, mirror: boolean) => {
    const rows = () => data.workout_assignments.filter((wa) => wa.program_day_id === day.id);
    const byExercise = (exerciseId: number) =>
      rows()
        .sort((a, b) => a.order_index - b.order_index)
        .find((wa) => wa.exercise_id === exerciseId);

    if (changes.label != null) day.label = changes.label;

    // Removals first, so a rest toggle on a now-empty day can take.
    const dropIds = mirror
      ? rows().filter((wa) => removedExerciseIds.includes(wa.exercise_id)).map((wa) => wa.id)
      : removed;
    if (dropIds.length) {
      data.set_logs = data.set_logs.filter((sl) => !dropIds.includes(sl.workout_assignment_id));
      data.assignment_custom_values = data.assignment_custom_values.filter((v) => !dropIds.includes(v.workout_assignment_id));
      data.workout_assignments = data.workout_assignments.filter((wa) => !dropIds.includes(wa.id));
    }

    for (const [idStr, raw] of Object.entries(changes.fields)) {
      const srcRow = data.workout_assignments.find((wa) => wa.id === Number(idStr));
      const target = mirror ? (srcRow ? byExercise(srcRow.exercise_id) : undefined) : srcRow;
      if (!target || target.program_day_id !== day.id) continue;
      const typed = typedDayFields(raw);
      if ("notes" in typed && typed.notes !== target.notes) {
        target.note_at = typed.notes ? new Date().toISOString() : null;
        target.note_read = false;
        if (!typed.notes) target.note_kind = null;
      }
      // A weight the coach types is theirs: see progressTargetFromLogs.
      if ("target_weight_kg" in typed && typed.target_weight_kg !== target.target_weight_kg) {
        target.target_set_at = new Date().toISOString();
      }
      Object.assign(target, typed);
    }

    for (const [idStr, cols] of Object.entries(changes.custom)) {
      const srcRow = data.workout_assignments.find((wa) => wa.id === Number(idStr));
      const target = mirror ? (srcRow ? byExercise(srcRow.exercise_id) : undefined) : srcRow;
      if (!target || target.program_day_id !== day.id) continue;
      for (const [colStr, value] of Object.entries(cols)) {
        const columnId = Number(colStr);
        const existing = data.assignment_custom_values.find(
          (v) => v.workout_assignment_id === target.id && v.column_id === columnId
        );
        if (existing) existing.value = value;
        else
          data.assignment_custom_values.push({
            id: allocId("assignment_custom_values"),
            workout_assignment_id: target.id,
            column_id: columnId,
            value,
          });
      }
    }

    // A gym's weight the coach types is theirs too; cleared, the gym starts
    // from the Weight column again.
    for (const [idStr, gyms] of Object.entries(changes.gyms ?? {})) {
      const srcRow = data.workout_assignments.find((wa) => wa.id === Number(idStr));
      const target = mirror ? (srcRow ? byExercise(srcRow.exercise_id) : undefined) : srcRow;
      if (!target || target.program_day_id !== day.id) continue;
      const own = new Set(listClientGyms(day.client_id, true).map((g) => String(g.id)));
      const next = { ...(target.gym_targets ?? {}) };
      for (const [gymStr, raw] of Object.entries(gyms)) {
        if (!own.has(gymStr)) continue;
        const t = raw.trim().replace(",", ".");
        const kg = t && Number.isFinite(Number(t)) ? Number(t) : null;
        if (kg == null) delete next[gymStr];
        else next[gymStr] = { kg, set_at: new Date().toISOString() };
      }
      target.gym_targets = next;
    }

    for (const add of changes.added) {
      if (mirror && byExercise(add.exerciseId)) continue;
      const typed = typedDayFields({ sets: "3", reps: "", targetWeight: "", rpe: "", tempo: "", rest: "", distance: "", time: "", notes: "", ...add.fields });
      data.workout_assignments.push({
        id: allocId("workout_assignments"),
        program_day_id: day.id,
        exercise_id: add.exerciseId,
        order_index: rows().length,
        sets: typed.sets ?? 3,
        reps: typed.reps ?? "",
        target_weight_kg: typed.target_weight_kg ?? null,
        rpe_target: typed.rpe_target ?? null,
        rest_seconds: typed.rest_seconds ?? null,
        distance: typed.distance ?? null,
        time: typed.time ?? null,
        tempo: typed.tempo ?? null,
        notes: typed.notes ?? null,
        demo_url: null,
        note_kind: null,
        note_at: typed.notes ? new Date().toISOString() : null,
        note_read: false,
        // A weight typed on a new row is the coach's own: see progressTargetFromLogs.
        target_set_at: typed.target_weight_kg != null ? new Date().toISOString() : null,
      });
    }

    if (changes.order) {
      const onDay = rows();
      if (mirror) {
        // Same exercise sequence as the source day; strangers keep their place after.
        const sequence = data.workout_assignments
          .filter((wa) => wa.program_day_id === src.id)
          .sort((a, b) => a.order_index - b.order_index)
          .map((wa) => wa.exercise_id);
        const rank = (wa: WorkoutAssignment) => {
          const i = sequence.indexOf(wa.exercise_id);
          return i < 0 ? sequence.length + wa.order_index : i;
        };
        [...onDay].sort((a, b) => rank(a) - rank(b)).forEach((wa, i) => (wa.order_index = i));
      } else {
        const wanted = changes.order;
        const rest = onDay.filter((wa) => !wanted.includes(wa.id)).sort((a, b) => a.order_index - b.order_index);
        const sequence = [
          ...wanted.map((id) => onDay.find((wa) => wa.id === id)).filter((wa): wa is WorkoutAssignment => !!wa),
          ...rest,
        ];
        sequence.forEach((wa, i) => (wa.order_index = i));
      }
    }

    // Cardio: by id on the source day, by name on a mirrored one.
    if (!data.cardio_entries) data.cardio_entries = [];
    const cardioRows = () => data.cardio_entries.filter((c) => c.program_day_id === day.id);
    const cardioTarget = (id: number) => {
      const srcRow = data.cardio_entries.find((c) => c.id === id);
      if (!srcRow) return undefined;
      return mirror ? cardioRows().find((c) => c.name.trim().toLowerCase() === srcRow.name.trim().toLowerCase()) : srcRow;
    };
    const dropCardio = changes.cardio.removed.map((id) => cardioTarget(id)?.id).filter((x): x is number => typeof x === "number");
    if (dropCardio.length) data.cardio_entries = data.cardio_entries.filter((c) => !dropCardio.includes(c.id));
    for (const [idStr, raw] of Object.entries(changes.cardio.fields)) {
      const target = cardioTarget(Number(idStr));
      if (!target || target.program_day_id !== day.id) continue;
      for (const k of ["name", "time", "pace", "incline", "distance", "notes"] as const) if (raw[k] != null) target[k] = raw[k]!.trim();
    }
    for (const add of changes.cardio.added) {
      const name = (add.name ?? "").trim();
      if (!name) continue;
      if (mirror && cardioRows().some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) continue;
      data.cardio_entries.push({
        id: allocId("cardio_entries"),
        program_day_id: day.id,
        name,
        time: (add.time ?? "").trim(),
        pace: (add.pace ?? "").trim(),
        incline: (add.incline ?? "").trim(),
        distance: (add.distance ?? "").trim(),
        notes: (add.notes ?? "").trim(),
        order_index: cardioRows().length,
      });
    }
    // The order the rows were dragged into; anything not in it (a row added
    // just now) follows. A later week follows the source day's sequence by
    // name, as its exercises follow by exercise.
    if (changes.cardio.order) {
      const onDay = cardioRows();
      const byOrder = (a: CardioEntry, b: CardioEntry) => a.order_index - b.order_index;
      let sequence: CardioEntry[];
      if (mirror) {
        const names = data.cardio_entries.filter((c) => c.program_day_id === src.id).sort(byOrder).map((c) => c.name.trim().toLowerCase());
        const rank = (c: CardioEntry) => {
          const i = names.indexOf(c.name.trim().toLowerCase());
          return i < 0 ? names.length + c.order_index : i;
        };
        sequence = [...onDay].sort((a, b) => rank(a) - rank(b));
      } else {
        const wanted = changes.cardio.order;
        sequence = [
          ...wanted.map((id) => onDay.find((c) => c.id === id)).filter((c): c is CardioEntry => !!c),
          ...onDay.filter((c) => !wanted.includes(c.id)).sort(byOrder),
        ];
      }
      sequence.forEach((c, i) => (c.order_index = i));
    }

    // Rest only sticks on an empty day; a day with exercises or cardio
    // stays a workout.
    if (changes.rest != null) {
      if (changes.rest && (rows().length > 0 || cardioRows().length > 0)) day.is_rest = false;
      else day.is_rest = changes.rest;
    }
  };

  applyTo(src, false);

  const skipped: string[] = [];
  if (changes.alsoRemaining) {
    const program = listPrograms(src.client_id).find(
      (p) => src.week_number >= p.start_week && src.week_number < p.start_week + p.total_weeks
    );
    if (program) {
      for (let week = src.week_number + 1; week < program.start_week + program.total_weeks; week++) {
        const day = sessionAt(src.client_id, week, src.day_of_week, true);
        if (!day) continue;
        const ids = data.workout_assignments.filter((wa) => wa.program_day_id === day.id).map((wa) => wa.id);
        if (data.set_logs.some((sl) => ids.includes(sl.workout_assignment_id))) {
          skipped.push(`W${week - program.start_week + 1}`);
          continue;
        }
        applyTo(day, true);
      }
    }
  }

  persist();
  return { skipped };
}


// ---------------------------------------------------------------------------
// Goals with tracking: the numbers behind each goal, gathered here and
// judged by app/lib/goalView.ts, which the coach's preview shares.

import type { GoalContext, GoalTracking, GoalView, LoggedSet, SeriesPoint } from "./goalView";
import { computeGoalView, describeTracking } from "./goalView";
export type { GoalTracking, GoalView } from "./goalView";

export function addClientGoal(clientId: number, text: string, tracking: GoalTracking | null = null, meetingId: number | null = null) {
  const data = getData();
  const count = data.client_goals.filter((g) => g.client_id === clientId).length;
  data.client_goals.push({
    id: allocId("client_goals"),
    client_id: clientId,
    term: "short",
    text,
    done: false,
    order_index: count,
    created_at: localDateStr(),
    tracked_by: tracking,
    meeting_id: meetingId,
  });
  persist();
}

/** Sets the order of a client's goals; ids not listed keep their place after. */
export function reorderClientGoals(clientId: number, orderedIds: number[]) {
  const data = getData();
  const mine = data.client_goals.filter((g) => g.client_id === clientId);
  const rest = mine.filter((g) => !orderedIds.includes(g.id)).sort((a, b) => a.order_index - b.order_index);
  const sequence = [...orderedIds.map((id) => mine.find((g) => g.id === id)).filter((g): g is ClientGoal => !!g), ...rest];
  sequence.forEach((g, i) => (g.order_index = i));
  persist();
}

export function updateClientGoal(id: number, text: string, tracking: GoalTracking | null) {
  const data = getData();
  const goal = data.client_goals.find((g) => g.id === id);
  if (!goal) return;
  goal.text = text;
  goal.tracked_by = tracking;
  persist();
}

export function getClientIdForGoal(id: number): number | null {
  return getData().client_goals.find((g) => g.id === id)?.client_id ?? null;
}

// The client's own calorie log is a figure a goal can track too ("Drop kcal
// to 2,400"), though it is not a check-in metric. One point per logged day.
export const KCAL_GOAL_KEY = "kcal";
function calorieSeries(clientId: number): { name: string; unit: string; series: SeriesPoint[] } {
  return {
    name: "Calories logged",
    unit: "kcal",
    series: listCalorieLogs(clientId, 100000)
      .map((c) => ({ date: c.date, value: c.kcal }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}

/** Series for a graph-choice key ("field-3" / "metric-7"), or the calorie log. */
function seriesForKey(clientId: number, key: string): { name: string; unit: string; series: SeriesPoint[] } | null {
  if (key === KCAL_GOAL_KEY) return calorieSeries(clientId);
  const choice = listGraphChoices(clientId).find((c) => c.key === key);
  if (!choice) return null;
  return { name: choice.name, unit: choice.unit, series: choice.kind === "field" ? getMeasurementSeries(choice.id) : getMetricSeries(choice.id) };
}

/** Every exercise on any of the client's days, once each, by name. */
export function listClientExercises(clientId: number): { id: number; name: string }[] {
  const data = getData();
  const dayIds = new Set(data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.id));
  const ids = new Set(data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id)).map((wa) => wa.exercise_id));
  return data.exercises
    .filter((e) => ids.has(e.id))
    .map((e) => ({ id: e.id, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every set the client has logged on one exercise, across every week. With a
 * gym given, only that gym's (null: the home gym's); undefined is every gym.
 */
export function loggedSetsForExercise(clientId: number, exerciseId: number, gymId?: number | null): LoggedSet[] {
  const data = getData();
  const home = homeGymId(clientId);
  const dayIds = new Set(data.program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.id));
  const waIds = new Set(
    data.workout_assignments.filter((wa) => dayIds.has(wa.program_day_id) && wa.exercise_id === exerciseId).map((wa) => wa.id)
  );
  return data.set_logs
    .filter((sl) => waIds.has(sl.workout_assignment_id))
    .filter((sl) => gymId === undefined || home == null || (sl.gym_id ?? home) === (gymId ?? home))
    .map((sl) => ({ weight: sl.weight_kg, reps: sl.reps, rpe: sl.rpe_actual, date: sl.logged_at.slice(0, 10), gymId: home == null ? null : sl.gym_id ?? home }));
}

/** The gym an exercise goal counts, by name, when the client has two or more gyms. */
function goalGymName(clientId: number, t: GoalTracking | null): string | null {
  if (t?.kind !== "exercise") return null;
  const gyms = listClientGyms(clientId, true);
  if (gyms.length < 2) return null;
  const id = t.gymId ?? homeGymId(clientId);
  return gyms.find((g) => g.id === id)?.name ?? null;
}

/** This Monday-to-Sunday week's values of a daily metric. */
function habitWeekValues(metricId: number, today: string): SeriesPoint[] {
  const monday = weekStart(today);
  const sunday = (() => {
    const d = new Date(`${monday}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return localDateStr(d);
  })();
  return getMetricSeries(metricId).filter((p) => p.date >= monday && p.date <= sunday);
}

export function goalContext(clientId: number, goal: ClientGoal): GoalContext {
  const today = localDateStr();
  const ctx: GoalContext = { today, createdAt: goal.created_at ?? today };
  const t = goal.tracked_by ?? null;
  if (t?.kind === "metric") {
    const s = seriesForKey(clientId, t.metricKey);
    if (s) ctx.metric = s;
  } else if (t?.kind === "exercise") {
    const name = getData().exercises.find((e) => e.id === t.exerciseId)?.name ?? "Exercise";
    ctx.exercise = { name, sets: loggedSetsForExercise(clientId, t.exerciseId, t.gymId ?? null), gymName: goalGymName(clientId, t) };
  } else if (t?.kind === "habit") {
    const name = getData().metric_definitions.find((m) => m.id === t.metricId)?.name ?? "Check-in";
    ctx.habit = { name, weekValues: habitWeekValues(t.metricId, today) };
  }
  return ctx;
}

/** Goal rows as the client sees them, open goals first, done text goals last. */
/** The client's current goals: open only, in the coach's own order. */
export function getGoalViews(clientId: number): GoalView[] {
  return listClientGoals(clientId)
    .filter((g) => !g.done)
    .map((g) => computeGoalView({ id: g.id, text: g.text, done: g.done, tracking: g.tracked_by ?? null }, goalContext(clientId, g)));
}

/** The coach's list: every goal the client sees, with its tracking in words. */
export function getGoalSummaries(clientId: number): { goal: ClientGoal; view: GoalView; tracking: string }[] {
  return listClientGoals(clientId).map((g) => {
    const t = g.tracked_by ?? null;
    const names: { metric?: string; unit?: string; exercise?: string; habit?: string; gym?: string | null } = {};
    if (t?.kind === "metric") {
      const s = seriesForKey(clientId, t.metricKey);
      names.metric = s?.name;
      names.unit = s?.unit;
    } else if (t?.kind === "exercise") {
      names.exercise = getData().exercises.find((e) => e.id === t.exerciseId)?.name;
      names.gym = goalGymName(clientId, t);
    }
    else if (t?.kind === "habit") names.habit = getData().metric_definitions.find((m) => m.id === t.metricId)?.name;
    return {
      goal: g,
      view: computeGoalView({ id: g.id, text: g.text, done: g.done, tracking: t }, goalContext(clientId, g)),
      tracking: describeTracking(t, names),
    };
  });
}

/** Everything the coach's goal editor needs to offer and preview. */
export type GoalEditorOptions = {
  today: string;
  phaseEnd: string | null;
  metrics: { key: string; name: string; unit: string; series: SeriesPoint[] }[];
  /** Every set, each marked with its gym; the editor filters to the goal's gym. */
  exercises: { id: number; name: string; sets: LoggedSet[] }[];
  habits: { id: number; name: string; weekValues: SeriesPoint[] }[];
  /** The client's gyms, home first; a goal picks one when there are two or more. */
  gyms: { id: number; name: string; removed: boolean }[];
};

export function getGoalEditorOptions(clientId: number): GoalEditorOptions {
  const today = localDateStr();
  const phase = getCurrentPhase(clientId, "nutrition") ?? getCurrentPhase(clientId, "training");
  const phaseEnd = phase
    ? (() => {
        const d = new Date(`${phase.end_week}T00:00:00`);
        d.setDate(d.getDate() + 6);
        return localDateStr(d);
      })()
    : null;
  return {
    today,
    phaseEnd,
    metrics: [
      ...listGraphChoices(clientId).map((c) => ({
        key: c.key,
        name: c.name,
        unit: c.unit,
        series: c.kind === "field" ? getMeasurementSeries(c.id) : getMetricSeries(c.id),
      })),
      { key: KCAL_GOAL_KEY, ...calorieSeries(clientId) },
    ],
    exercises: listClientExercises(clientId).map((e) => ({ ...e, sets: loggedSetsForExercise(clientId, e.id) })),
    habits: listMetricDefinitions(clientId, "daily").map((m) => ({ id: m.id, name: m.name, weekValues: habitWeekValues(m.id, today) })),
    gyms: (() => {
      const home = homeGymId(clientId);
      return listClientGyms(clientId, true)
        .sort((a, b) => (a.id === home ? -1 : b.id === home ? 1 : a.id - b.id))
        .map((g) => ({ id: g.id, name: g.name, removed: g.archived }));
    })(),
  };
}

// ---- Home "Data" tiles: the coach's chosen figures, last 7 days and 8 weeks.

export type DataTile = {
  key: string;
  name: string;
  unit: string;
  valueLabel: string;
  trendLabel: string;
  trendTone: "green" | "orange" | "neutral";
  /** Eight weekly values, oldest first; null where nothing was logged. */
  bars: (number | null)[];
  goal: number | null;
  firstLabel: string;
  lastLabel: string;
};

export function getHomeDataTiles(clientId: number, weightGoalIsDown: boolean | null): DataTile[] {
  const today = localDateStr();
  const goals = listClientGoals(clientId).filter((g) => !g.done && g.tracked_by?.kind === "metric");
  const choices = listGraphChoices(clientId).filter((c) => c.pointCount > 0);
  const picked = (choices.some((c) => c.pinned) ? choices.filter((c) => c.pinned) : choices).slice(0, PINNED_METRIC_LIMIT);
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
  return picked.map((c) => {
    const series = c.kind === "field" ? getMeasurementSeries(c.id) : getMetricSeries(c.id);
    const latest = series[series.length - 1];
    const weekAgo = (() => {
      const cutoff = (() => {
        const d = new Date(`${today}T00:00:00`);
        d.setDate(d.getDate() - 7);
        return localDateStr(d);
      })();
      const before = series.filter((p) => p.date <= cutoff);
      return before[before.length - 1] ?? null;
    })();
    const delta = weekAgo ? latest.value - weekAgo.value : null;
    const linked = goals.find((g) => g.tracked_by?.kind === "metric" && g.tracked_by.metricKey === c.key)?.tracked_by;
    const goodDown =
      linked?.kind === "metric" ? linked.op === "<=" : c.name.toLowerCase().includes("weight") ? weightGoalIsDown : null;
    const trendTone: DataTile["trendTone"] =
      delta == null || delta === 0 || goodDown == null ? "neutral" : (delta < 0) === goodDown ? "green" : "orange";
    const bars: (number | null)[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(`${weekStart(today)}T00:00:00`);
      d.setDate(d.getDate() - i * 7);
      const monday = localDateStr(d);
      const e = new Date(d);
      e.setDate(e.getDate() + 6);
      const sunday = localDateStr(e);
      const inWeek = series.filter((p) => p.date >= monday && p.date <= sunday);
      bars.push(inWeek.length ? inWeek[inWeek.length - 1].value : null);
    }
    const present = bars.filter((b): b is number => b != null);
    return {
      key: c.key,
      name: c.name,
      unit: c.unit,
      valueLabel: fmt(latest.value),
      trendLabel: delta == null ? "–" : delta === 0 ? "= 7 days" : `${delta > 0 ? "▲" : "▼"} ${fmt(Math.abs(delta))}${c.unit ? ` ${c.unit}` : ""}`,
      trendTone,
      bars,
      goal: linked?.kind === "metric" ? linked.target : null,
      firstLabel: present.length ? fmt(present[0]) : "–",
      lastLabel: present.length ? fmt(present[present.length - 1]) : "–",
    };
  });
}


// ---------------------------------------------------------------------------
// Meetings tab: links, prep notes, and everything the workspace shows.

/** "Google Meet" / "Zoom" / "Teams" from the link, else "Join call". */
export type MeetingRecap = {
  /** "11 Sep" — when the call was. */
  dateLabel: string;
  text: string;
};

/** The last call the coach wrote a client-facing recap for, if any. */
export function getLastMeetingRecap(clientId: number): MeetingRecap | null {
  const today = localDateStr();
  // A call the coach has marked completed counts whatever its date says:
  // calls get closed early, and the recap is written at that moment. A
  // past-dated call with a recap counts too, even if never formally closed.
  const m = listMeetings(clientId)
    .filter((x) => (x.summary ?? "").trim() && x.status !== "cancelled" && (x.status === "completed" || x.date <= today))
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? 1 : -1) : a.date < b.date ? 1 : -1))[0];
  if (!m) return null;
  const d = new Date(`${m.date}T12:00:00`);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { dateLabel: `${d.getDate()} ${MONTHS[d.getMonth()]}`, text: (m.summary ?? "").trim() };
}

export type UpNextSession = {
  /** The programme day, so the Training tab can scroll straight to it. */
  dayId: number;
  /** The coach's name for it, or its place in the week when unnamed. */
  name: string;
  exercises: number;
  sets: number;
};

// The session Home offers to start: the first one this week that is not
// fully logged. Deliberately the same rule the Training tab opens on, and
// deliberately not keyed to the weekday — a client who misses Tuesday
// trains it on Wednesday and this still points at the right session.
export function getUpNextSession(clientId: number): UpNextSession | null {
  const week = getCurrentWeekNumber(clientId);
  const days = getPublishedWeek(clientId, week)
    .map((day) => ({ day, assignments: getAssignmentsForDay(day.id) }))
    .filter((d) => d.assignments.length > 0);
  // A session the client said they could not do is settled, as a finished
  // one is: Home's "Start" moves on to the next rather than sending them
  // back to the one they skipped.
  const index = days.findIndex(({ day, assignments }) =>
    !day.skip_reason && !assignments.every((a) => getLogsForAssignment(a.id).length >= a.sets)
  );
  if (index < 0) return null;
  const { day, assignments } = days[index];
  return {
    dayId: day.id,
    name: day.label || `Session ${index + 1}`,
    exercises: assignments.length,
    sets: assignments.reduce((sum, a) => sum + a.sets, 0),
  };
}

export function meetingProvider(link: string | null | undefined): string {
  if (!link) return "Join call";
  try {
    const host = new URL(link).hostname.toLowerCase();
    if (host.endsWith("meet.google.com")) return "Google Meet";
    if (host.endsWith("zoom.us")) return "Zoom";
    if (host.endsWith("teams.microsoft.com") || host.endsWith("teams.live.com")) return "Teams";
  } catch {
    /* not a URL */
  }
  return "Join call";
}

function linkHost(link: string): string {
  try {
    const u = new URL(link);
    return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 40);
  } catch {
    return link.slice(0, 40);
  }
}

export function updateMeeting(
  id: number,
  patch: Partial<Pick<Meeting, "topic" | "link" | "prep_notes" | "summary" | "date" | "time" | "duration_minutes">>
) {
  const data = getData();
  const m = data.meetings.find((x) => x.id === id);
  if (!m) return;
  Object.assign(m, patch);
  persist();
}

/** Completed, with the prep notes carried into the notes log so nothing is lost. */
export function completeMeeting(id: number) {
  const data = getData();
  const m = data.meetings.find((x) => x.id === id);
  if (!m) return;
  m.status = "completed";
  const prep = (m.prep_notes ?? "").trim();
  if (prep && !data.meeting_notes.some((n) => n.meeting_id === id && n.text === prep)) {
    data.meeting_notes.push({ id: allocId("meeting_notes"), meeting_id: id, text: prep, created_at: new Date().toISOString().replace("T", " ").slice(0, 16) });
  }
  persist();
}

export function getClientIdForMeeting(id: number): number | null {
  return getData().meetings.find((m) => m.id === id)?.client_id ?? null;
}

export type WorkspaceMeeting = {
  id: number;
  date: string;
  time: string;
  durationMinutes: number;
  topic: string;
  status: Meeting["status"];
  link: string | null;
  provider: string;
  host: string;
  prepNotes: string;
  summary: string;
  notes: { id: number; text: string; createdAt: string }[];
};

export function getMeetingsWorkspaceData(clientId: number) {
  const today = localDateStr();
  const all = listAllMeetings(coachIdOfClient(clientId) ?? 0);
  const view = (m: Meeting): WorkspaceMeeting => ({
    id: m.id,
    date: m.date,
    time: m.time,
    durationMinutes: m.duration_minutes,
    topic: m.topic,
    status: m.status,
    link: m.link ?? null,
    provider: meetingProvider(m.link),
    host: m.link ? linkHost(m.link) : "",
    prepNotes: m.prep_notes ?? "",
    summary: m.summary ?? "",
    notes: listMeetingNotes(m.id).map((n) => ({ id: n.id, text: n.text, createdAt: n.created_at })),
  });
  const mine = listMeetings(clientId);
  const scheduled = mine.filter((m) => m.status === "scheduled" && m.date >= today).sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1));
  const past = mine.filter((m) => !(m.status === "scheduled" && m.date >= today));
  const lastLink = [...mine].sort((a, b) => (a.date < b.date ? 1 : -1)).find((m) => m.link)?.link ?? null;
  return {
    upcoming: scheduled[0] ? view(scheduled[0]) : null,
    alsoScheduled: scheduled.slice(1).map(view),
    past: past.map(view),
    // Every booking on the calendar, so a day can list what is already
    // taken before the coach picks a time.
    dots: all
      .filter((m) => m.status !== "cancelled")
      .map((m) => ({
        date: m.date,
        time: m.time,
        durationMinutes: m.duration_minutes,
        name: m.clientName,
        topic: m.topic,
        mine: m.client_id === clientId,
        completed: m.status === "completed",
      })),
    others: all
      .filter((m) => m.status === "scheduled" && m.time && m.client_id != null && m.client_id !== clientId)
      .map((m) => ({ date: m.date, time: m.time, durationMinutes: m.duration_minutes, name: m.clientName })),
    lastLink,
  };
}


// ---------------------------------------------------------------------------
// Plan tab: the phases grid and the goals table, gathered for the two cards.

export type PlanProgramStatus = "live" | "scheduled" | "draft";
export type PlanPhaseRow = {
  id: number;
  track: PhaseTrack;
  /** A nutrition phase not deployed yet. */
  draft: boolean;
  name: string;
  start_week: string;
  end_week: string;
  program: { id: number; status: PlanProgramStatus; totalWeeks: number; loggedWeeks: number[] } | null;
};
export type PlanProgramOption = { id: number; name: string; status: PlanProgramStatus; weeks: number; linked: boolean };
export type PlanGoalRow = {
  id: number;
  text: string;
  done: boolean;
  kind: "metric" | "exercise" | "habit" | "none";
  tone: "green" | "orange" | "muted";
  live: string;
  pct: number;
  rule: string;
  setIn: { meetingId: number; topic: string; date: string } | null;
  setDate: string | null;
  by: string | null;
  tracking: GoalTracking | null;
};

function programStatus(p: TrainingProgram): PlanProgramStatus {
  return p.status === "deployed" ? "live" : p.scheduled_at ? "scheduled" : "draft";
}

export function getPlanData(clientId: number) {
  const today = localDateStr();
  const thisWeek = weekStart(today);
  const programs = listPrograms(clientId);
  const phases: PlanPhaseRow[] = listClientPhases(clientId).map((p) => {
    const program = p.program_id ? programs.find((x) => x.id === p.program_id) : undefined;
    return {
      id: p.id,
      track: p.track,
      name: p.name,
      start_week: p.start_week,
      end_week: p.end_week,
      draft: !!p.draft,
      program: program
        ? { id: program.id, status: programStatus(program), totalWeeks: program.total_weeks, loggedWeeks: programLoggedWeekIndexes(program.id) }
        : null,
    };
  });
  const linked = new Set(phases.map((p) => p.program?.id).filter((x): x is number => x != null));
  const programOptions: PlanProgramOption[] = programs.map((p) => ({
    id: p.id,
    name: p.name?.trim() || "Untitled programme",
    status: programStatus(p),
    weeks: p.total_weeks,
    linked: linked.has(p.id),
  }));

  // The goals table.
  const fmtShort = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const meetingsById = new Map(listMeetings(clientId).map((m) => [m.id, m] as const));
  const goals: PlanGoalRow[] = getGoalSummaries(clientId).map(({ goal, view }) => {
    const t = goal.tracked_by ?? null;
    let live = "";
    let pct = goal.done ? 100 : 0;
    let rule = "Text only";
    let by: string | null = null;
    if (view.kind === "metric" && t?.kind === "metric") {
      const figure = (view.barLabel ?? "").split(" · ")[0];
      // The figure alone: the coach reads it against the rule underneath.
      live = figure;
      pct = view.reached ? 100 : Math.round((view.bar ?? 0) * 100);
      const s = seriesForKey(clientId, t.metricKey);
      rule = `Metric · ${s?.name ?? "Metric"} ${t.op} ${fmtNumber(t.target)}${s?.unit ? ` ${s.unit}` : ""} · by ${fmtShort(t.byDate)}`;
      by = fmtShort(t.byDate);
    } else if (view.kind === "exercise" && t?.kind === "exercise") {
      live = (view.right ?? "").replace(/^best /, "").split(" · ")[0];
      const name = getData().exercises.find((e) => e.id === t.exerciseId)?.name ?? "Exercise";
      const sets = loggedSetsForExercise(clientId, t.exerciseId, t.gymId ?? null).filter((s) => s.weight != null);
      const best = sets.length ? Math.max(...sets.map((s) => s.weight as number)) : 0;
      pct = view.reached ? 100 : Math.max(0, Math.min(99, Math.round((best / t.weight) * 100)));
      const gym = goalGymName(clientId, t);
      rule = `Exercise · ${name}${gym ? ` at ${gym}` : ""} · ${fmtNumber(t.weight)} × ${t.reps}${t.maxRpe != null ? ` @ ≤${t.maxRpe}` : ""}`;
      by = "ongoing";
    } else if (view.kind === "habit" && t?.kind === "habit") {
      live = `${view.segments?.done ?? 0} of ${view.segments?.total ?? 0}`;
      pct = Math.round(((view.segments?.done ?? 0) / Math.max(1, view.segments?.total ?? 1)) * 100);
      const name = getData().metric_definitions.find((m) => m.id === t.metricId)?.name ?? "Check-in";
      rule = `Habit · ${name} ${t.op} ${t.value.toLocaleString("en-US")} · ${t.daysPerWeek} / wk`;
      by = "ongoing";
    }
    const meeting = goal.meeting_id ? meetingsById.get(goal.meeting_id) : undefined;
    return {
      id: goal.id,
      text: goal.text,
      done: goal.done,
      kind: view.kind,
      tone: view.tone,
      live,
      pct,
      rule,
      setIn: meeting ? { meetingId: meeting.id, topic: meeting.topic || "Check-in call", date: meeting.date } : null,
      setDate: goal.created_at ?? null,
      by,
      tracking: t,
    };
  });

  const next = listMeetings(clientId)
    .filter((m) => m.status === "scheduled" && m.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1))[0];
  const currentPhase = getCurrentPhase(clientId, "nutrition") ?? getCurrentPhase(clientId, "training");
  return {
    today,
    thisWeek,
    clientName: getClient(clientId)?.name ?? "Client",
    currentPhaseName: currentPhase?.name ?? null,
    phases,
    programs: programOptions,
    goals,
    nextReview: next ? { id: next.id, date: next.date, topic: next.topic || "Check-in call" } : null,
    goalOptions: getGoalEditorOptions(clientId),
    mainGoal: getClientProfile(clientId).main_goal ?? "",
    mainGoalSavedAt: getClientProfile(clientId).main_goal_saved_at ?? null,
  };
}

function fmtNumber(n: number) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** Links a training phase to an existing programme instead of a new draft. */
export function linkPhaseToProgram(phaseId: number, programId: number) {
  const data = getData();
  const phase = data.client_phases.find((p) => p.id === phaseId);
  const program = data.training_programs.find((p) => p.id === programId);
  if (!phase || !program || phase.client_id !== program.client_id) return;
  // The old draft made for this phase, if any, has no other reason to exist.
  if (phase.program_id && phase.program_id !== programId) {
    const old = data.training_programs.find((p) => p.id === phase.program_id);
    if (old && old.status === "draft" && !old.scheduled_at) removeProgram(old.id);
  }
  phase.program_id = programId;
  phase.track = "training";
  persist();
  // A live or scheduled programme dictates the dates; a draft follows the phase.
  if (program.status === "deployed" || program.scheduled_at) syncProgramPhase(programId);
  else if (program.name?.trim()) {
    phase.name = phase.name || program.name;
    persist();
  }
}

/** The goal's starting line moves with it: progress counts from this date. */
export function setClientGoalStart(id: number, startDate: string) {
  const data = getData();
  const goal = data.client_goals.find((g) => g.id === id);
  if (!goal) return;
  goal.created_at = startDate;
  persist();
}

// ---- Client avatar: set by the client, shown to the coach everywhere ------

export function saveClientAvatar(clientId: number, buffer: Buffer, mimeType: string): string {
  const client = getData().clients.find((c) => c.id === clientId);
  if (!client) return "";
  const ext = (mimeType.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const dir = path.join(DATA_DIR, "uploads", "avatars", String(clientId));
  fs.mkdirSync(dir, { recursive: true });
  const filename = `avatar.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  const previous = client.avatar_path?.split("?")[0].split("/").pop();
  if (previous && previous !== filename) {
    try {
      fs.unlinkSync(path.join(dir, previous));
    } catch {
      /* already gone */
    }
  }
  client.avatar_path = `/uploads/avatars/${clientId}/${filename}?v=${Date.now()}`;
  persist();
  return client.avatar_path;
}

export function removeClientAvatar(clientId: number) {
  const client = getData().clients.find((c) => c.id === clientId);
  if (!client) return;
  const previous = client.avatar_path?.split("?")[0].split("/").pop();
  if (previous) {
    try {
      fs.unlinkSync(path.join(DATA_DIR, "uploads", "avatars", String(clientId), previous));
    } catch {
      /* already gone */
    }
  }
  client.avatar_path = null;
  persist();
}

// ---- Coach profile: written by the coach, read by their clients -----------

export function getCoachProfile(coachId: number): CoachProfile | null {
  return getData().coach_profiles.find((p) => p.coach_id === coachId) ?? null;
}

// A coach account has an email but no name; "finlay.smith@…" reads as
// "Finlay Smith" until they give their display name.
function nameFromCoachEmail(email: string): string {
  const words = (email.split("@")[0] ?? "").split(/[._-]+/).filter(Boolean);
  return words.length ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "Coach";
}

/** The profile as the screens render it, with fallbacks; null for a user who is not a coach. */
export function getCoachProfileView(coachId: number): CoachProfileView | null {
  const data = getData();
  const user = data.users.find((u) => u.id === coachId && u.role === "coach");
  if (!user) return null;
  const p = getCoachProfile(coachId);
  return {
    coachId,
    email: user.email,
    displayName: p?.display_name?.trim() || nameFromCoachEmail(user.email),
    title: p?.title ?? "",
    headline: p?.headline ?? "",
    location: p?.location ?? "",
    languages: p?.languages ?? "",
    yearsCoaching: p?.years_coaching ?? null,
    intro: p?.intro ?? "",
    bio: p?.bio ?? "",
    quote: p?.quote ?? "",
    specialties: p?.specialties ?? [],
    studies: p?.studies ?? [],
    experience: p?.experience ?? [],
    outside: p?.outside ?? "",
    replyNote: p?.reply_note ?? "",
    heroPath: p?.hero_path ?? null,
    candidPath: p?.candid_path ?? null,
    avatarPath: p?.avatar_path ?? null,
    published: !!p?.published && !!p.display_name?.trim(),
    clientCount: data.clients.filter((c) => c.coach_id === coachId).length,
    updatedAt: p?.updated_at ?? null,
  };
}

/** The profile of the client's own coach. */
export function getCoachProfileForClient(clientId: number): CoachProfileView | null {
  const coachId = coachIdOfClient(clientId);
  return coachId == null ? null : getCoachProfileView(coachId);
}

function ensureCoachProfile(coachId: number): CoachProfile {
  const data = getData();
  let profile = data.coach_profiles.find((p) => p.coach_id === coachId);
  if (!profile) {
    profile = {
      coach_id: coachId,
      display_name: null,
      title: null,
      headline: null,
      location: null,
      languages: null,
      years_coaching: null,
      hero_path: null,
      candid_path: null,
      avatar_path: null,
      intro: null,
      bio: null,
      quote: null,
      specialties: [],
      studies: [],
      experience: [],
      outside: null,
      reply_note: null,
      published: false,
      updated_at: null,
    };
    data.coach_profiles.push(profile);
  }
  return profile;
}

export function saveCoachProfile(coachId: number, fields: CoachProfileFields) {
  const p = ensureCoachProfile(coachId);
  const orNull = (s: string) => s.trim() || null;
  p.display_name = orNull(fields.displayName);
  p.title = orNull(fields.title);
  p.headline = orNull(fields.headline);
  p.location = orNull(fields.location);
  p.languages = orNull(fields.languages);
  p.years_coaching = fields.yearsCoaching;
  p.intro = orNull(fields.intro);
  p.bio = orNull(fields.bio);
  p.quote = orNull(fields.quote);
  p.specialties = fields.specialties;
  p.studies = fields.studies;
  p.experience = fields.experience;
  p.outside = orNull(fields.outside);
  p.reply_note = orNull(fields.replyNote);
  // Publishing needs a name: clearing it takes the profile back to the minimal card.
  if (!p.display_name) p.published = false;
  p.updated_at = new Date().toISOString();
  persist();
}

/** False when publishing is refused because there is no display name. */
export function setCoachProfilePublished(coachId: number, published: boolean): boolean {
  const p = ensureCoachProfile(coachId);
  if (published && !p.display_name?.trim()) return false;
  p.published = published;
  p.updated_at = new Date().toISOString();
  persist();
  return true;
}

export type CoachPhotoKind = "hero" | "candid" | "avatar";
const COACH_PHOTO_FIELD = { hero: "hero_path", candid: "candid_path", avatar: "avatar_path" } as const;

export function saveCoachPhoto(coachId: number, kind: CoachPhotoKind, buffer: Buffer, mimeType: string): string {
  const profile = ensureCoachProfile(coachId);
  const ext = (mimeType.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const dir = path.join(DATA_DIR, "uploads", "coaches", String(coachId));
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${kind}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  const field = COACH_PHOTO_FIELD[kind];
  const previous = profile[field]?.split("?")[0].split("/").pop();
  if (previous && previous !== filename) {
    try {
      fs.unlinkSync(path.join(dir, previous));
    } catch {
      /* already gone */
    }
  }
  const saved = `/uploads/coaches/${coachId}/${filename}?v=${Date.now()}`;
  profile[field] = saved;
  profile.updated_at = new Date().toISOString();
  persist();
  return saved;
}

/** Returns the path that was removed, for the storage bucket. */
export function removeCoachPhoto(coachId: number, kind: CoachPhotoKind): string | null {
  const profile = getCoachProfile(coachId);
  if (!profile) return null;
  const field = COACH_PHOTO_FIELD[kind];
  const previous = profile[field];
  const file = previous?.split("?")[0].split("/").pop();
  if (file) {
    try {
      fs.unlinkSync(path.join(DATA_DIR, "uploads", "coaches", String(coachId), file));
    } catch {
      /* already gone */
    }
  }
  profile[field] = null;
  profile.updated_at = new Date().toISOString();
  persist();
  return previous;
}

// ---- Food diary ------------------------------------------------------------

export type FoodMeal = string;
export const FOOD_MEALS: { id: FoodMeal; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snacks", label: "Snacks" },
];

/** A food as the diary's search shows it: per 100 g, with its portions. */
export type FoodOption = {
  id: string;
  name: string;
  /** "Your food" for the client's own; the catalog's full name for a common food; the USDA category otherwise. */
  hint: string;
  /** Own, packaged and common foods show first; "more" folds away under a count. */
  group: "own" | "packaged" | "common" | "more";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: [string, number][];
};

const catalogOption = (f: CatalogFood, group: FoodOption["group"]): FoodOption => ({ id: f.id, name: f.name, hint: f.category, group, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, servings: f.servings });
const customOption = (f: CustomFood): FoodOption => ({
  id: `custom:${f.id}`,
  name: f.name,
  hint: "Your food",
  group: "own",
  kcal: f.kcal,
  protein: f.protein,
  carbs: f.carbs,
  fat: f.fat,
  servings: f.serving_label && f.serving_grams ? [[f.serving_label, f.serving_grams]] : [],
});

const offOption = (f: OffFood): FoodOption => ({
  id: `off:${f.code}`,
  name: f.name,
  hint: [f.brand, f.quantity].filter(Boolean).join(" · ") || "Packaged",
  group: "packaged",
  kcal: f.kcal,
  protein: f.protein,
  carbs: f.carbs,
  fat: f.fat,
  servings: f.serving_label && f.serving_grams ? [[f.serving_label, f.serving_grams]] : [],
});

/** Products from Open Food Facts into the store: new ones added, known ones refreshed. */
export function rememberOffProducts(products: OffProduct[]): FoodOption[] {
  const data = getData();
  const now = new Date().toISOString();
  const out: FoodOption[] = [];
  for (const p of products) {
    let row = data.off_foods.find((f) => f.code === p.code);
    if (row) Object.assign(row, p, { fetched_at: now });
    else {
      row = { id: allocId("off_foods"), ...p, fetched_at: now };
      data.off_foods.push(row);
    }
    out.push(offOption(row));
  }
  if (products.length) persist();
  return out;
}

export function getOffFoodByCode(code: string): FoodOption | null {
  const f = getData().off_foods.find((x) => x.code === code);
  return f ? offOption(f) : null;
}

export function getFoodOption(clientId: number, foodId: string): FoodOption | null {
  if (foodId.startsWith("off:")) return getOffFoodByCode(foodId.slice(4));
  if (foodId.startsWith("custom:")) {
    const f = getData().custom_foods.find((c) => c.id === Number(foodId.slice(7)) && c.client_id === clientId);
    return f ? customOption(f) : null;
  }
  const f = getCatalogFood(foodId);
  return f ? catalogOption(f, "more") : null;
}

/** The client's own foods first when they match, then the catalog. */
export function searchFoods(clientId: number, query: string, limit = 30): FoodOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const own = getData()
    .custom_foods.filter((c) => c.client_id === clientId && c.name.toLowerCase().includes(q))
    .map(customOption);
  // Packaged products already fetched once, by name or brand.
  const words = q.split(/\s+/).filter(Boolean);
  const packaged = getData()
    .off_foods.filter((f) => {
      const hay = `${f.name} ${f.brand ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .slice(0, 8)
    .map(offOption);
  const hits = searchCatalog(query, limit);
  return [...own, ...packaged, ...hits.common.map((f) => catalogOption(f, "common")), ...hits.more.map((f) => catalogOption(f, "more"))].slice(0, limit + hits.common.length + packaged.length);
}

/** What the client logged most often lately, for the top of an empty search. */
export function recentFoods(clientId: number, limit = 8): FoodOption[] {
  const seen = new Map<string, number>();
  const entries = getData().food_entries.filter((e) => e.client_id === clientId);
  for (const e of entries.slice(-200)) seen.set(e.food_id, (seen.get(e.food_id) ?? 0) + 1);
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => getFoodOption(clientId, id))
    .filter((f): f is FoodOption => !!f)
    .slice(0, limit);
}

export function listFoodEntries(clientId: number, date: string): FoodEntry[] {
  return getData()
    .food_entries.filter((e) => e.client_id === clientId && e.date === date)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The day's kcal from the diary into the calorie log the coach reads, when the client pushes it. Nothing logged in the diary: nothing happens. */
export function pushFoodDayToCalorieLog(clientId: number, date: string): boolean {
  const entries = listFoodEntries(clientId, date);
  if (entries.length === 0) return false;
  const kcal = Math.round(entries.reduce((s, e) => s + e.kcal, 0));
  setCalorieLog(clientId, date, kcal, undefined, foodDayType(clientId, date), "diary");
  return true;
}

/** The four standard meals, then the ones the client added for that day (or that hold food on it). */
export function listFoodMeals(clientId: number, date: string): { id: FoodMeal; label: string; own: boolean }[] {
  const data = getData();
  const withFood = new Set(data.food_entries.filter((e) => e.client_id === clientId && e.date === date).map((e) => e.meal));
  const extra = data.food_meals
    .filter((m) => m.client_id === clientId && (m.date === date || withFood.has(`m:${m.id}`)))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => ({ id: `m:${m.id}`, label: m.name, own: true }));
  const all = [...FOOD_MEALS.map((m) => ({ ...m, own: false })), ...extra];
  const order = getClient(clientId)?.meal_order;
  if (!order?.length) return all;
  const rank = new Map(order.map((id, i) => [id, i]));
  return all.map((m, i) => ({ m, i })).sort((a, b) => (rank.get(a.m.id) ?? 1000 + a.i) - (rank.get(b.m.id) ?? 1000 + b.i)).map((x) => x.m);
}

/** The meals in the order the client put them; ids not theirs are ignored, missing ones keep their place at the end. */
export function reorderFoodMeals(clientId: number, date: string, ids: string[]) {
  const client = getClient(clientId);
  if (!client) return;
  const have = new Set(listFoodMeals(clientId, date).map((m) => m.id));
  // Meals from other days keep their place in the order; today's are put as asked.
  const kept = (client.meal_order ?? []).filter((id) => !have.has(id));
  client.meal_order = [...ids.filter((id) => have.has(id)), ...kept];
  persist();
}

export function hasFoodMeal(clientId: number, meal: string, date: string): boolean {
  return listFoodMeals(clientId, date).some((m) => m.id === meal);
}

export function addFoodMeal(clientId: number, name: string, date: string): FoodMealSlot {
  const data = getData();
  const row: FoodMealSlot = { id: allocId("food_meals"), client_id: clientId, name, date, created_at: new Date().toISOString() };
  data.food_meals.push(row);
  persist();
  return row;
}

/** Only an empty meal goes; one with food in it stays. */
export function renameFoodMeal(clientId: number, id: number, name: string): boolean {
  const row = getData().food_meals.find((m) => m.id === id && m.client_id === clientId);
  if (!row) return false;
  row.name = name;
  persist();
  return true;
}

export function removeFoodMeal(clientId: number, id: number): boolean {
  const data = getData();
  const row = data.food_meals.find((m) => m.id === id && m.client_id === clientId);
  if (!row) return false;
  if (data.food_entries.some((e) => e.client_id === clientId && e.meal === `m:${id}`)) return false;
  data.food_meals = data.food_meals.filter((m) => m !== row);
  persist();
  return true;
}

/** Everything in one meal on one day, copied into a meal on another (the same food and amounts, logged now). */
export function copyFoodMeal(clientId: number, fromDate: string, fromMeal: string, toDate: string, toMeal: string): number {
  const data = getData();
  const rows = listFoodEntries(clientId, fromDate).filter((e) => e.meal === fromMeal);
  const now = new Date().toISOString();
  const to = mealOnDay(clientId, toMeal, toDate);
  for (const e of rows) data.food_entries.push({ ...e, id: allocId("food_entries"), date: toDate, meal: to, logged_at: now });
  if (rows.length) {
    persist();
  }
  return rows.length;
}

export type SavedMealView = { id: number; name: string; kcal: number; count: number; names: string[] };

export function listSavedMeals(clientId: number): SavedMealView[] {
  return getData()
    .saved_meals.filter((m) => m.client_id === clientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((m) => ({ id: m.id, name: m.name, kcal: Math.round(m.items.reduce((s, i) => s + i.kcal, 0)), count: m.items.length, names: [...new Set(m.items.map((i) => i.name))] }));
}

/** One meal on one day, kept under a name to add again. */
export function saveMeal(clientId: number, date: string, meal: FoodMeal, name: string): SavedMeal | null {
  const rows = listFoodEntries(clientId, date).filter((e) => e.meal === meal);
  if (rows.length === 0) return null;
  const data = getData();
  const row: SavedMeal = {
    id: allocId("saved_meals"),
    client_id: clientId,
    name,
    items: rows.map((e) => ({ food_id: e.food_id, name: e.name, grams: e.grams, serving: e.serving, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat })),
    created_at: new Date().toISOString(),
  };
  data.saved_meals.push(row);
  persist();
  return row;
}

export function deleteSavedMeal(clientId: number, id: number): boolean {
  const data = getData();
  const before = data.saved_meals.length;
  data.saved_meals = data.saved_meals.filter((m) => !(m.id === id && m.client_id === clientId));
  if (data.saved_meals.length === before) return false;
  persist();
  return true;
}

/** Where a meal id from another day (or a saved day) lands on a date: itself when it is a standard meal or already on that day, else an added meal of the same name on that day, made if needed; Snacks when the source meal is gone. */
function mealOnDay(clientId: number, meal: string, date: string): string {
  if (hasFoodMeal(clientId, meal, date)) return meal;
  const data = getData();
  const source = meal.startsWith("m:") ? data.food_meals.find((m) => m.id === Number(meal.slice(2)) && m.client_id === clientId) : null;
  if (!source) return "snacks";
  const twin = data.food_meals.find((m) => m.client_id === clientId && m.date === date && m.name.toLowerCase() === source.name.toLowerCase());
  return `m:${twin ? twin.id : addFoodMeal(clientId, source.name, date).id}`;
}

/** A saved meal's foods and amounts into a meal on a day, logged now. */
export function addSavedMeal(clientId: number, id: number, date: string, meal: FoodMeal): number {
  const data = getData();
  const saved = data.saved_meals.find((m) => m.id === id && m.client_id === clientId);
  if (!saved || !hasFoodMeal(clientId, meal, date)) return 0;
  const now = new Date().toISOString();
  for (const i of saved.items) data.food_entries.push({ id: allocId("food_entries"), client_id: clientId, date, meal, ...i, logged_at: now });
  persist();
  return saved.items.length;
}

export type SavedDayView = { id: number; name: string; kcal: number; count: number; dayType: "training" | "rest" | null };

export function listSavedDays(clientId: number): SavedDayView[] {
  return getData()
    .saved_days.filter((d) => d.client_id === clientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((d) => ({ id: d.id, name: d.name, kcal: Math.round(d.items.reduce((s, i) => s + i.kcal, 0)), count: d.items.length, dayType: d.day_type ?? null }));
}

/** One whole day, kept under a name to log again. */
export function saveDay(clientId: number, date: string, name: string): SavedDay | null {
  const rows = listFoodEntries(clientId, date);
  if (rows.length === 0) return null;
  const data = getData();
  const row: SavedDay = {
    id: allocId("saved_days"),
    client_id: clientId,
    name,
    day_type: foodDayType(clientId, date),
    items: rows.map((e) => ({ meal: e.meal, food_id: e.food_id, name: e.name, grams: e.grams, serving: e.serving, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat })),
    created_at: new Date().toISOString(),
  };
  data.saved_days.push(row);
  persist();
  return row;
}

export function deleteSavedDay(clientId: number, id: number): boolean {
  const data = getData();
  const before = data.saved_days.length;
  data.saved_days = data.saved_days.filter((d) => !(d.id === id && d.client_id === clientId));
  if (data.saved_days.length === before) return false;
  persist();
  return true;
}

/** A saved day's meals onto a date, logged now; meals that no longer exist go to Snacks. */
export function addSavedDay(clientId: number, id: number, date: string): number {
  const data = getData();
  const saved = data.saved_days.find((d) => d.id === id && d.client_id === clientId);
  if (!saved) return 0;
  const now = new Date().toISOString();
  const landing = new Map<string, string>();
  for (const i of saved.items) {
    if (!landing.has(i.meal)) landing.set(i.meal, mealOnDay(clientId, i.meal, date));
    data.food_entries.push({ id: allocId("food_entries"), client_id: clientId, date, ...i, meal: landing.get(i.meal)!, logged_at: now });
  }
  if (saved.items.length) persist();
  return saved.items.length;
}

/** Every meal of one day into another, the same foods and amounts, logged now; meals that no longer exist go to Snacks. */
export function copyFoodDay(clientId: number, fromDate: string, toDate: string): number {
  const data = getData();
  const rows = listFoodEntries(clientId, fromDate);
  const now = new Date().toISOString();
  const landing = new Map<string, string>();
  for (const e of rows) {
    if (!landing.has(e.meal)) landing.set(e.meal, mealOnDay(clientId, e.meal, toDate));
    data.food_entries.push({ ...e, id: allocId("food_entries"), date: toDate, meal: landing.get(e.meal)!, logged_at: now });
  }
  if (rows.length) persist();
  return rows.length;
}

export function addFoodEntry(clientId: number, date: string, meal: FoodMeal, foodId: string, grams: number, serving: string | null): FoodEntry | null {
  const food = getFoodOption(clientId, foodId);
  if (!food || !hasFoodMeal(clientId, meal, date)) return null;
  const data = getData();
  const k = grams / 100;
  const entry: FoodEntry = {
    id: allocId("food_entries"),
    client_id: clientId,
    date,
    meal,
    food_id: foodId,
    name: food.name,
    grams: r1(grams),
    serving,
    kcal: r1(food.kcal * k),
    protein: r1(food.protein * k),
    carbs: r1(food.carbs * k),
    fat: r1(food.fat * k),
    logged_at: new Date().toISOString(),
  };
  data.food_entries.push(entry);
  persist();
  return entry;
}

export function updateFoodEntry(clientId: number, id: number, grams: number, serving: string | null): boolean {
  const e = getData().food_entries.find((x) => x.id === id && x.client_id === clientId);
  if (!e) return false;
  const food = getFoodOption(clientId, e.food_id);
  // The food is gone (a custom one deleted): scale the snapshot instead.
  const per100 = food ?? { kcal: (e.kcal / e.grams) * 100, protein: (e.protein / e.grams) * 100, carbs: (e.carbs / e.grams) * 100, fat: (e.fat / e.grams) * 100 };
  const k = grams / 100;
  e.grams = r1(grams);
  e.serving = serving;
  e.kcal = r1(per100.kcal * k);
  e.protein = r1(per100.protein * k);
  e.carbs = r1(per100.carbs * k);
  e.fat = r1(per100.fat * k);
  persist();
  return true;
}

export function removeFoodEntry(clientId: number, id: number): boolean {
  const data = getData();
  const e = data.food_entries.find((x) => x.id === id && x.client_id === clientId);
  if (!e) return false;
  data.food_entries = data.food_entries.filter((x) => x !== e);
  persist();
  return true;
}

export function addCustomFood(clientId: number, food: { name: string; kcal: number; protein: number; carbs: number; fat: number; servingLabel: string | null; servingGrams: number | null }): CustomFood {
  const data = getData();
  const row: CustomFood = {
    id: allocId("custom_foods"),
    client_id: clientId,
    name: food.name,
    kcal: r1(food.kcal),
    protein: r1(food.protein),
    carbs: r1(food.carbs),
    fat: r1(food.fat),
    serving_label: food.servingLabel,
    serving_grams: food.servingGrams,
    created_at: new Date().toISOString(),
  };
  data.custom_foods.push(row);
  persist();
  return row;
}

// ---- Meal photos ----
// One picture per meal per day, taken by the client from their food diary.
// Filed by date and meal key rather than by row id so a second picture
// simply replaces the first, on the disk as well as in the table.

/** The client's picture of one meal, or null. */
export function getMealPhoto(clientId: number, date: string, meal: string): string | null {
  return getData().meal_photos.find((p) => p.client_id === clientId && p.date === date && p.meal === meal)?.file_path ?? null;
}

/** Every meal on a date that has a picture, by meal key. */
export function mealPhotosOn(clientId: number, date: string): Map<string, string> {
  return new Map(getData().meal_photos.filter((p) => p.client_id === clientId && p.date === date).map((p) => [p.meal, p.file_path] as const));
}

/** Writes the picture to the disk and files it. Returns its public path. */
export function saveMealPhoto(clientId: number, date: string, meal: string, buffer: Buffer, mimeType: string): string {
  const ext = (mimeType.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  // "m:12" is a meal the client added; a colon is not a filename anywhere.
  const slug = meal.replace(/[^a-z0-9]/gi, "-");
  const dir = path.join(DATA_DIR, "uploads", "meals", String(clientId), date);
  fs.mkdirSync(dir, { recursive: true });
  // The extension can change between pictures (.heic then .jpg); drop any
  // earlier one for this meal so the old file is not left orphaned.
  for (const existing of fs.readdirSync(dir)) {
    if (existing.startsWith(`${slug}.`)) fs.rmSync(path.join(dir, existing), { force: true });
  }
  const filename = `${slug}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  const publicPath = `/uploads/meals/${clientId}/${date}/${filename}`;

  const data = getData();
  const row = data.meal_photos.find((p) => p.client_id === clientId && p.date === date && p.meal === meal);
  if (row) {
    row.file_path = publicPath;
    row.uploaded_at = new Date().toISOString();
  } else {
    data.meal_photos.push({ id: allocId("meal_photos"), client_id: clientId, date, meal, file_path: publicPath, uploaded_at: new Date().toISOString() });
  }
  persist();
  return publicPath;
}

/** Forgets a meal's picture. Returns the path it had, for the bucket copy. */
export function removeMealPhoto(clientId: number, date: string, meal: string): string | null {
  const data = getData();
  const row = data.meal_photos.find((p) => p.client_id === clientId && p.date === date && p.meal === meal);
  if (!row) return null;
  const was = row.file_path;
  data.meal_photos = data.meal_photos.filter((p) => p !== row);
  const onDisk = path.join(DATA_DIR, was.startsWith("/") ? was.slice(1) : was);
  fs.rmSync(onDisk, { force: true });
  persist();
  return was;
}

/** Everything the diary screen needs for one day. */
export type FoodDiaryView = {
  date: string;
  /** "Today", "Yesterday", "12 September". */
  dateLabel: string;
  /** The day's targets, training or rest as the client called it (else by sets); null without targets. */
  target: { kcal: number; protein: number; carbs: number; fat: number } | null;
  eaten: { kcal: number; protein: number; carbs: number; fat: number };
  meals: { id: FoodMeal; label: string; own: boolean; kcal: number; protein: number; carbs: number; fat: number; entries: FoodEntry[]; /** The saved meal this is a copy of, by name, when it still matches one. */ savedAs: string | null; /** The client's picture of this meal, when they took one. */ photo: string | null }[];
  recent: FoodOption[];
  /** The client's saved meals, newest first. */
  saved: SavedMealView[];
  /** The client's saved days, newest first. */
  savedDays: SavedDayView[];
  /** The saved day this day is a copy of, by name, while it still matches one. */
  savedDayAs: string | null;
  savedDayId: number | null;
  /** Meals with food in them on the last two weeks' other days, newest first, to copy from. */
  previous: { date: string; dateLabel: string; meal: FoodMeal; mealLabel: string; kcal: number; names: string[] }[];
  /** Dates in the last month with anything logged, for the dots on the week strip. */
  loggedDays: string[];
  /** Which targets the day counts down from. */
  dayType: "training" | "rest";
  /** What the calorie log holds for the day, pushed from here or typed; null when nothing is logged. */
  loggedKcal: number | null;
};

const dayLabelFor = (date: string, today: string): string => {
  const d = new Date(`${date}T00:00:00`);
  const y = new Date(`${today}T00:00:00`);
  y.setDate(y.getDate() - 1);
  if (date === today) return "Today";
  if (date === localDateStr(y)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
};

/** Training or rest on a date: as set on the diary, else as logged with the calories, else by whether a set was logged. */
export function foodDayType(clientId: number, date: string): "training" | "rest" {
  const set = getData().food_days.find((d) => d.client_id === clientId && d.date === date)?.day_type;
  if (set) return set;
  const log = getCalorieLog(clientId, date);
  if (log?.day_type) return log.day_type;
  return trainingDates(clientId).has(date) ? "training" : "rest";
}

export function setFoodDayType(clientId: number, date: string, dayType: "training" | "rest") {
  const data = getData();
  const row = data.food_days.find((d) => d.client_id === clientId && d.date === date);
  if (row) row.day_type = dayType;
  else data.food_days.push({ id: allocId("food_days"), client_id: clientId, date, day_type: dayType } as FoodDay);
  // The calorie log the coach reads says the same.
  const log = getCalorieLog(clientId, date);
  if (log) setCalorieLog(clientId, date, log.kcal, undefined, dayType);
  persist();
}

/** The kcal and macro targets the diary counts down from on a date: the ring's, for the kind of day it is. */
export function foodDiaryTargetOn(clientId: number, date: string): FoodDiaryView["target"] {
  const s = getNutritionGoalsSummary(clientId);
  const trained = foodDayType(clientId, date) === "training";
  const kcal = trained ? s.trainingKcal : s.restKcal;
  if (!(kcal > 0)) return null;
  return {
    kcal,
    protein: trained ? s.trainingProtein : s.restProtein,
    carbs: trained ? s.trainingCarbs : s.restCarbs,
    fat: trained ? s.trainingFats : s.restFats,
  };
}

// ---- What the client actually ate, for the coach ----------------------
// Every figure here is reduced from the day's own entries: a day's kcal, its
// macros and everything the summary says come from the same rows the meals
// are drawn from, so a total can never disagree with the breakdown under it.

export type LoggedFood = { name: string; quantity: string; kcal: number; protein: number; carbs: number; fat: number };
export type LoggedMeal = { id: string; label: string; kcal: number; protein: number; carbs: number; fat: number; foods: LoggedFood[]; /** The client's picture of this meal, when they took one. */ photo: string | null };
export type LoggedDay = {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  isTraining: boolean;
  /** That day's target, by the day type the client logged it as. */
  target: number | null;
  proteinTarget: number | null;
  note: string | null;
  meals: LoggedMeal[];
};
export type LoggedDaysView = {
  days: LoggedDay[];
  /** Days in the window, whether logged or not, so "21 of 28" is honest. */
  windowDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  /** Logged days within ±200 kcal of their target, and how many had one. */
  onTarget: number;
  judged: number;
};

/** The days a client logged food on, newest first, inside a date range. */
export function getLoggedDays(clientId: number, from: string, to: string): LoggedDaysView {
  const data = getData();
  const derived = getNutritionGoalsSummary(clientId);
  const trainedOn = trainingDates(clientId);
  const dayType = new Map(data.calorie_logs.filter((c) => c.client_id === clientId).map((c) => [c.date, c] as const));
  const entries = data.food_entries.filter((e) => e.client_id === clientId && e.date >= from && e.date <= to);

  const byDate = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  const days: LoggedDay[] = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, rows]) => {
      const labels = new Map(listFoodMeals(clientId, date).map((m) => [m.id, m.label] as const));
      const photos = mealPhotosOn(clientId, date);
      const order = [...labels.keys()];
      const meals = new Map<string, LoggedMeal>();
      for (const e of rows) {
        const meal = meals.get(e.meal) ?? { id: e.meal, label: labels.get(e.meal) ?? "Meal", kcal: 0, protein: 0, carbs: 0, fat: 0, foods: [], photo: photos.get(e.meal) ?? null };
        meal.kcal += e.kcal;
        meal.protein += e.protein;
        meal.carbs += e.carbs;
        meal.fat += e.fat;
        meal.foods.push({
          name: e.name,
          quantity: e.serving || `${Math.round(e.grams)} g`,
          kcal: Math.round(e.kcal),
          protein: r1(e.protein),
          carbs: r1(e.carbs),
          fat: r1(e.fat),
        });
        meals.set(e.meal, meal);
      }
      const log = dayType.get(date);
      const isTraining = log?.day_type ? log.day_type === "training" : trainedOn.has(date);
      const sum = (k: "kcal" | "protein" | "carbs" | "fat") => rows.reduce((t, e) => t + e[k], 0);
      return {
        date,
        kcal: Math.round(sum("kcal")),
        protein: Math.round(sum("protein")),
        carbs: Math.round(sum("carbs")),
        fat: Math.round(sum("fat")),
        isTraining,
        target: (isTraining ? derived.trainingKcal : derived.restKcal) || null,
        proteinTarget: (isTraining ? derived.trainingProtein : derived.restProtein) || null,
        note: log?.note?.trim() || null,
        meals: [...meals.values()]
          .map((m) => ({ ...m, kcal: Math.round(m.kcal), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) }))
          .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
      };
    });

  const span = Math.max(1, Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1);
  const judged = days.filter((d) => d.target != null);
  const avg = (list: number[]) => (list.length ? Math.round(list.reduce((t, v) => t + v, 0) / list.length) : null);
  return {
    days,
    windowDays: span,
    avgKcal: avg(days.map((d) => d.kcal)),
    avgProtein: avg(days.map((d) => d.protein)),
    onTarget: judged.filter((d) => Math.abs(d.kcal - (d.target as number)) <= 200).length,
    judged: judged.length,
  };
}

// ---- Logged data: one lookup behind every figure on the block ----------
// A table cell, a feed tile, a metric's last value and the Change row all
// read the same map. Nothing about a period is stored — no day total, no
// "complete" flag, no delta: they are all derived from these values, so a
// summary can never disagree with the rows it summarises.

export type LoggedMetric = {
  id: number;
  name: string;
  unit: string;
  category: string;
  categoryLabel: string;
  /** The category's own colour, for the column head. */
  colour: string;
  goodDirection: "up" | "down" | "none";
};
export type LoggedPeriod = { key: string; label: string };
export type LoggedValues = {
  metrics: LoggedMetric[];
  /** Newest first, as both the table and the feed read them. */
  periods: LoggedPeriod[];
  /** "<metricId>:<periodKey>" to the value the client submitted. */
  values: Record<string, number>;
  /** The client's note for a period, when they left one. */
  notes: Record<string, string>;
};

const CATEGORY_COLOUR: Record<string, string> = {
  sleep: "#4c42a8",
  activity: "#1f7a4d",
  lifestyle: "#a8761f",
  wellbeing: "#2f5d8f",
  body: "#b8471f",
  measurements: "#b8471f",
  stress: "#b8471f",
  fatigue: "#a8761f",
  nutrition: "#1f7a4d",
  training: "#4c42a8",
};

/** Everything the Logged data block reads, for one cadence. */
export function getLoggedValues(clientId: number, cadence: "daily" | "weekly", count: number): LoggedValues {
  const data = getData();
  const defs = listAllMetrics(clientId).filter((m) => m.frequency === cadence);
  const metrics: LoggedMetric[] = defs.map((m) => {
    const g = metricGroup(m.category);
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      category: g.key,
      categoryLabel: g.label,
      colour: CATEGORY_COLOUR[g.key] ?? "#5b6472",
      goodDirection: m.good_direction ?? "none",
    };
  });

  // The periods asked for, newest first, whether or not anything came in:
  // a gap is data, so it has to have a row.
  const today = localDateStr();
  const periods: LoggedPeriod[] = [];
  for (let i = 0; i < count; i++) {
    if (cadence === "daily") {
      const d = new Date(`${today}T00:00:00`);
      d.setDate(d.getDate() - i);
      const key = localDateStr(d);
      periods.push({ key, label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) });
    } else {
      const d = new Date(`${weekStart(today)}T00:00:00`);
      d.setDate(d.getDate() - i * 7);
      const key = localDateStr(d);
      periods.push({ key, label: `Week ${isoWeekNumber(key)}` });
    }
  }

  const keys = new Set(periods.map((p) => p.key));
  const values: Record<string, number> = {};
  const ids = new Set(defs.map((m) => m.id));
  for (const e of data.metric_entries) {
    if (!ids.has(e.metric_definition_id) || e.value == null || !keys.has(e.period)) continue;
    values[`${e.metric_definition_id}:${e.period}`] = e.value;
  }

  const notes: Record<string, string> = {};
  for (const n of data.check_in_notes ?? []) {
    if (n.client_id !== clientId || n.kind !== cadence || !keys.has(n.period)) continue;
    if (n.text.trim()) notes[n.period] = n.text.trim();
  }

  return { metrics, periods, values, notes };
}

/** The ISO week number of the Monday given. */
function isoWeekNumber(monday: string): number {
  const d = new Date(`${monday}T00:00:00`);
  d.setDate(d.getDate() + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

/** Which way a metric is meant to move. */
export function setMetricDirection(id: number, direction: "up" | "down" | "none") {
  const m = getData().metric_definitions.find((x) => x.id === id);
  if (!m) return;
  m.good_direction = direction;
  persist();
}

export function getFoodDiary(clientId: number, date: string): FoodDiaryView {
  const today = localDateStr();
  const entries = listFoodEntries(clientId, date);
  const sum = (k: "kcal" | "protein" | "carbs" | "fat") => r1(entries.reduce((s, e) => s + e[k], 0));
  const meals = listFoodMeals(clientId, date);
  const labelOf = new Map<string, string>([...FOOD_MEALS.map((m) => [m.id, m.label] as [string, string]), ...getData().food_meals.filter((m) => m.client_id === clientId).map((m) => [`m:${m.id}`, m.name] as [string, string])]);
  // The same foods in the same amounts as a saved meal: it is that meal.
  const savedKeys = getData()
    .saved_meals.filter((s) => s.client_id === clientId)
    .map((s) => ({ name: s.name, key: s.items.map((i) => `${i.food_id}@${i.grams}`).sort().join("|") }));
  // The other days' meals, newest first, so a day can be built from one before it.
  const since = new Date(`${today}T00:00:00`);
  since.setDate(since.getDate() - 14);
  const sinceStr = localDateStr(since);
  const month = new Date(`${today}T00:00:00`);
  month.setDate(month.getDate() - 31);
  const monthAgo = localDateStr(month);
  const previousMap = new Map<string, FoodDiaryView["previous"][number]>();
  for (const e of getData().food_entries.filter((x) => x.client_id === clientId && x.date !== date && x.date >= sinceStr && x.date <= today)) {
    const key = `${e.date}|${e.meal}`;
    const row = previousMap.get(key) ?? { date: e.date, dateLabel: dayLabelFor(e.date, today), meal: e.meal, mealLabel: labelOf.get(e.meal) ?? "Meal", kcal: 0, names: [] };
    row.kcal += e.kcal;
    if (!row.names.includes(e.name)) row.names.push(e.name);
    previousMap.set(key, row);
  }
  const photos = mealPhotosOn(clientId, date);
  const order = new Map(meals.map((m, i) => [m.id, i]));
  const previous = [...previousMap.values()]
    .map((p) => ({ ...p, kcal: Math.round(p.kcal) }))
    .sort((a, b) => b.date.localeCompare(a.date) || (order.get(a.meal) ?? 99) - (order.get(b.meal) ?? 99));
  return {
    date,
    dateLabel: dayLabelFor(date, today),
    target: foodDiaryTargetOn(clientId, date),
    dayType: foodDayType(clientId, date),
    loggedKcal: getCalorieLog(clientId, date)?.kcal ?? null,
    eaten: { kcal: sum("kcal"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat") },
    meals: meals.map((m) => {
      const rows = entries.filter((e) => e.meal === m.id);
      const tot = (k: "kcal" | "protein" | "carbs" | "fat") => r1(rows.reduce((s, e) => s + e[k], 0));
      const key = rows.map((e) => `${e.food_id}@${e.grams}`).sort().join("|");
      const savedAs = rows.length ? savedKeys.find((s) => s.key === key)?.name ?? null : null;
      return { ...m, kcal: Math.round(tot("kcal")), protein: tot("protein"), carbs: tot("carbs"), fat: tot("fat"), entries: rows, savedAs, photo: photos.get(m.id) ?? null };
    }),
    recent: recentFoods(clientId),
    saved: listSavedMeals(clientId),
    savedDays: listSavedDays(clientId),
    ...(() => {
      if (entries.length === 0) return { savedDayAs: null, savedDayId: null };
      // Meals by name, since a copied custom meal gets a new id on its day.
      const nameOf = (meal: string) => labelOf.get(meal)?.toLowerCase() ?? meal;
      const key = entries.map((e) => `${nameOf(e.meal)}@${e.food_id}@${e.grams}`).sort().join("|");
      const hit = getData()
        .saved_days.filter((d) => d.client_id === clientId)
        .find((d) => d.items.map((i) => `${nameOf(i.meal)}@${i.food_id}@${i.grams}`).sort().join("|") === key);
      return { savedDayAs: hit?.name ?? null, savedDayId: hit?.id ?? null };
    })(),
    previous,
    loggedDays: [...new Set(getData().food_entries.filter((e) => e.client_id === clientId && e.date >= monthAgo && e.date <= today).map((e) => e.date))],
  };
}
