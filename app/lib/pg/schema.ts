import { boolean, doublePrecision, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

// The Postgres tables behind the store (phase 1 of moving off ironline.json).
//
// One table per collection in db.ts, with the same name, and one column per
// field, named exactly as the field. That identity is what lets store.ts
// load and save every collection with one generic mapping, and what keeps a
// row identical after a round trip:
//   - every column is nullable (older rows lack newer fields);
//   - `extra` holds any field a row has that is not a column here, so nothing
//     in the data is lost if the JSON grew a field this schema doesn't know;
//     `extra.__absent` lists known fields the row did not have at all, so a
//     missing field comes back missing rather than as null.
// Numbers that are not ids are double precision: a weight, a kcal count or a
// set count typed as 2.5 must survive exactly.
//
// Top-level values that are not collections (the id counters, branding, the
// reset tokens, and collections the app no longer uses) live in `kv`.

const id = () => integer("id").primaryKey();
const fk = (name: string) => integer(name);
const num = (name: string) => doublePrecision(name);
const extra = () => jsonb("extra");

export const users = pgTable("users", {
  id: id(),
  email: text("email"),
  password_hash: text("password_hash"),
  role: text("role"),
  client_id: fk("client_id"),
  must_change_password: boolean("must_change_password"),
  created_at: text("created_at"),
  extra: extra(),
});

export const clients = pgTable("clients", {
  id: id(),
  name: text("name"),
  avatar_path: text("avatar_path"),
  coach_id: fk("coach_id"),
  extra: extra(),
});

export const exercises = pgTable("exercises", {
  id: id(),
  name: text("name"),
  muscle_tags: text("muscle_tags"),
  video_url: text("video_url"),
  coach_id: fk("coach_id"),
  extra: extra(),
});

export const program_days = pgTable("program_days", {
  id: id(),
  client_id: fk("client_id"),
  week_number: num("week_number"),
  day_of_week: num("day_of_week"),
  label: text("label"),
  status: text("status"),
  is_rest: boolean("is_rest"),
  extra: extra(),
});

export const training_programs = pgTable("training_programs", {
  id: id(),
  client_id: fk("client_id"),
  name: text("name"),
  start_week: num("start_week"),
  total_weeks: num("total_weeks"),
  status: text("status"),
  deployed_at: text("deployed_at"),
  scheduled_at: text("scheduled_at"),
  extra: extra(),
});

export const client_phases = pgTable("client_phases", {
  id: id(),
  client_id: fk("client_id"),
  track: text("track"),
  name: text("name"),
  start_week: text("start_week"),
  end_week: text("end_week"),
  nutrition: jsonb("nutrition"),
  program_id: fk("program_id"),
  extra: extra(),
});

export const calorie_logs = pgTable("calorie_logs", {
  id: id(),
  client_id: fk("client_id"),
  date: text("date"),
  kcal: num("kcal"),
  logged_at: text("logged_at"),
  note: text("note"),
  extra: extra(),
});

export const check_in_notes = pgTable("check_in_notes", {
  id: id(),
  client_id: fk("client_id"),
  kind: text("kind"),
  period: text("period"),
  text: text("text"),
  created_at: text("created_at"),
  extra: extra(),
});

export const client_exercise_notes = pgTable("client_exercise_notes", {
  id: id(),
  client_id: fk("client_id"),
  exercise_id: fk("exercise_id"),
  text: text("text"),
  updated_at: text("updated_at"),
  extra: extra(),
});

export const client_gyms = pgTable("client_gyms", {
  id: id(),
  client_id: fk("client_id"),
  name: text("name"),
  created_at: text("created_at"),
  last_used_at: text("last_used_at"),
  archived: boolean("archived"),
  is_home: boolean("is_home"),
  extra: extra(),
});

export const coach_profiles = pgTable("coach_profiles", {
  coach_id: integer("coach_id").primaryKey(),
  display_name: text("display_name"),
  title: text("title"),
  headline: text("headline"),
  location: text("location"),
  languages: text("languages"),
  years_coaching: num("years_coaching"),
  hero_path: text("hero_path"),
  candid_path: text("candid_path"),
  avatar_path: text("avatar_path"),
  intro: text("intro"),
  bio: text("bio"),
  quote: text("quote"),
  specialties: jsonb("specialties"),
  studies: jsonb("studies"),
  experience: jsonb("experience"),
  outside: text("outside"),
  reply_note: text("reply_note"),
  published: boolean("published"),
  updated_at: text("updated_at"),
  extra: extra(),
});

export const client_program_notes = pgTable("client_program_notes", {
  id: id(),
  client_id: fk("client_id"),
  program_id: fk("program_id"),
  text: text("text"),
  updated_at: text("updated_at"),
  extra: extra(),
});

export const cardio_entries = pgTable("cardio_entries", {
  id: id(),
  program_day_id: fk("program_day_id"),
  name: text("name"),
  time: text("time"),
  pace: text("pace"),
  incline: text("incline"),
  distance: text("distance"),
  notes: text("notes"),
  order_index: num("order_index"),
  extra: extra(),
});

export const cardio_logs = pgTable("cardio_logs", {
  id: id(),
  cardio_entry_id: fk("cardio_entry_id"),
  client_id: fk("client_id"),
  done_at: text("done_at"),
  extra: extra(),
});

export const workout_assignments = pgTable("workout_assignments", {
  id: id(),
  program_day_id: fk("program_day_id"),
  exercise_id: fk("exercise_id"),
  order_index: num("order_index"),
  sets: num("sets"),
  reps: text("reps"),
  target_weight_kg: num("target_weight_kg"),
  rpe_target: num("rpe_target"),
  rest_seconds: num("rest_seconds"),
  tempo: text("tempo"),
  distance: text("distance"),
  time: text("time"),
  notes: text("notes"),
  demo_url: text("demo_url"),
  note_kind: text("note_kind"),
  note_at: text("note_at"),
  note_read: boolean("note_read"),
  target_set_at: text("target_set_at"),
  extra: extra(),
});

export const set_logs = pgTable("set_logs", {
  id: id(),
  workout_assignment_id: fk("workout_assignment_id"),
  set_number: num("set_number"),
  weight_kg: num("weight_kg"),
  reps: num("reps"),
  rpe_actual: num("rpe_actual"),
  logged_at: text("logged_at"),
  extra: extra(),
});

export const invoices = pgTable("invoices", {
  id: id(),
  client_id: fk("client_id"),
  description: text("description"),
  amount: num("amount"),
  status: text("status"),
  created_at: text("created_at"),
  updated_at: text("updated_at"),
  extra: extra(),
});

export const nutrition_plans = pgTable("nutrition_plans", {
  client_id: integer("client_id").primaryKey(),
  name: text("name"),
  maintenance_kcal: num("maintenance_kcal"),
  ebf: num("ebf"),
  training_day_meals: jsonb("training_day_meals"),
  rest_day_meals: jsonb("rest_day_meals"),
  vitamins: jsonb("vitamins"),
  other: jsonb("other"),
  supplements: jsonb("supplements"),
  coach_notes: text("coach_notes"),
  day_targets: jsonb("day_targets"),
  water_l: num("water_l"),
  supplement_rows: jsonb("supplement_rows"),
  extra: extra(),
});

export const measurement_fields = pgTable("measurement_fields", {
  id: id(),
  client_id: fk("client_id"),
  name: text("name"),
  unit: text("unit"),
  order_index: num("order_index"),
  visible_to_client: boolean("visible_to_client"),
  pinned: boolean("pinned"),
  extra: extra(),
});

export const measurement_values = pgTable("measurement_values", {
  id: id(),
  client_id: fk("client_id"),
  field_id: fk("field_id"),
  date: text("date"),
  value: num("value"),
  logged_at: text("logged_at"),
  extra: extra(),
});

export const skinfold_entries = pgTable("skinfold_entries", {
  id: id(),
  client_id: fk("client_id"),
  date: text("date"),
  site: text("site"),
  reading_mm: num("reading_mm"),
  extra: extra(),
});

export const metric_definitions = pgTable("metric_definitions", {
  id: id(),
  client_id: fk("client_id"),
  category: text("category"),
  name: text("name"),
  unit: text("unit"),
  frequency: text("frequency"),
  order_index: num("order_index"),
  pinned: boolean("pinned"),
  visible_to_client: boolean("visible_to_client"),
  extra: extra(),
});

export const metric_entries = pgTable("metric_entries", {
  id: id(),
  metric_definition_id: fk("metric_definition_id"),
  period: text("period"),
  value: num("value"),
  logged_at: text("logged_at"),
  extra: extra(),
});

export const metric_template_categories = pgTable("metric_template_categories", {
  id: id(),
  name: text("name"),
  frequency: text("frequency"),
  order_index: num("order_index"),
  coach_id: fk("coach_id"),
  extra: extra(),
});

export const metric_template_items = pgTable("metric_template_items", {
  id: id(),
  template_category_id: fk("template_category_id"),
  name: text("name"),
  unit: text("unit"),
  order_index: num("order_index"),
  extra: extra(),
});

export const photo_slots = pgTable("photo_slots", {
  id: id(),
  client_id: fk("client_id"),
  label: text("label"),
  order_index: num("order_index"),
  paused: boolean("paused"),
  extra: extra(),
});

export const photo_uploads = pgTable("photo_uploads", {
  id: id(),
  slot_id: fk("slot_id"),
  period: text("period"),
  file_path: text("file_path"),
  uploaded_at: text("uploaded_at"),
  extra: extra(),
});

export const photo_settings = pgTable("photo_settings", {
  client_id: integer("client_id").primaryKey(),
  cadence: text("cadence"),
  photo_start_date: text("photo_start_date"),
  photo_instructions: text("photo_instructions"),
  extra: extra(),
});

export const photo_period_notes = pgTable(
  "photo_period_notes",
  {
    client_id: integer("client_id").notNull(),
    period: text("period").notNull(),
    shape: text("shape"),
    strengths: text("strengths"),
    improvements: text("improvements"),
    next_steps: text("next_steps"),
    saved_at: text("saved_at"),
    extra: extra(),
  },
  (t) => [primaryKey({ columns: [t.client_id, t.period] })]
);

export const client_profiles = pgTable("client_profiles", {
  client_id: integer("client_id").primaryKey(),
  birthdate: text("birthdate"),
  gender: text("gender"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  height_cm: num("height_cm"),
  starting_weight_kg: num("starting_weight_kg"),
  coaching_start_date: text("coaching_start_date"),
  current_week: text("current_week"),
  goal_phase: text("goal_phase"),
  goal_phase_start_date: text("goal_phase_start_date"),
  goal_date: text("goal_date"),
  main_goal: text("main_goal"),
  main_goal_saved_at: text("main_goal_saved_at"),
  check_in_day: text("check_in_day"),
  steps_goal: text("steps_goal"),
  cardio_goal: text("cardio_goal"),
  training_goal: text("training_goal"),
  water_goal: text("water_goal"),
  extra: extra(),
});

export const client_goals = pgTable("client_goals", {
  id: id(),
  client_id: fk("client_id"),
  term: text("term"),
  text: text("text"),
  done: boolean("done"),
  order_index: num("order_index"),
  created_at: text("created_at"),
  tracked_by: jsonb("tracked_by"),
  meeting_id: fk("meeting_id"),
  extra: extra(),
});

export const meetings = pgTable("meetings", {
  id: id(),
  client_id: fk("client_id"),
  coach_id: fk("coach_id"),
  date: text("date"),
  time: text("time"),
  duration_minutes: num("duration_minutes"),
  topic: text("topic"),
  status: text("status"),
  link: text("link"),
  prep_notes: text("prep_notes"),
  summary: text("summary"),
  extra: extra(),
});

export const meeting_notes = pgTable("meeting_notes", {
  id: id(),
  meeting_id: fk("meeting_id"),
  text: text("text"),
  created_at: text("created_at"),
  extra: extra(),
});

export const training_columns = pgTable("training_columns", {
  id: id(),
  client_id: fk("client_id"),
  key: text("key"),
  label: text("label"),
  kind: text("kind"),
  visible: boolean("visible"),
  order_index: num("order_index"),
  extra: extra(),
});

export const assignment_custom_values = pgTable("assignment_custom_values", {
  id: id(),
  workout_assignment_id: fk("workout_assignment_id"),
  column_id: fk("column_id"),
  value: text("value"),
  extra: extra(),
});

export const chat_messages = pgTable("chat_messages", {
  id: id(),
  client_id: fk("client_id"),
  sender: text("sender"),
  text: text("text"),
  media_path: text("media_path"),
  media_type: text("media_type"),
  created_at: text("created_at"),
  extra: extra(),
});

export const coach_activity = pgTable("coach_activity", {
  id: id(),
  client_id: fk("client_id"),
  message: text("message"),
  created_at: text("created_at"),
  kind: text("kind"),
  read: boolean("read"),
  action_tab: text("action_tab"),
  action_label: text("action_label"),
  action_ref: fk("action_ref"),
  dedupe_key: text("dedupe_key"),
  extra: extra(),
});

export const report_templates = pgTable("report_templates", {
  id: id(),
  name: text("name"),
  created_at: text("created_at"),
  coach_id: fk("coach_id"),
  extra: extra(),
});

export const report_template_sections = pgTable("report_template_sections", {
  id: id(),
  template_id: fk("template_id"),
  type: text("type"),
  label: text("label"),
  metric_name: text("metric_name"),
  order_index: num("order_index"),
  extra: extra(),
});

export const client_reports = pgTable("client_reports", {
  id: id(),
  client_id: fk("client_id"),
  template_id: fk("template_id"),
  template_name: text("template_name"),
  period_start: text("period_start"),
  period_end: text("period_end"),
  status: text("status"),
  summary: text("summary"),
  ai_generated: boolean("ai_generated"),
  sections_snapshot: text("sections_snapshot"),
  generated_at: text("generated_at"),
  approved_at: text("approved_at"),
  sent_at: text("sent_at"),
  opened_at: text("opened_at"),
  extra: extra(),
});

export const client_preferences = pgTable("client_preferences", {
  client_id: integer("client_id").primaryKey(),
  coach_notes: boolean("coach_notes"),
  checkin_reminders: boolean("checkin_reminders"),
  weekly_digest: boolean("weekly_digest"),
  units: text("units"),
  extra: extra(),
});

/** Everything at the top level of the store that is not a collection. */
export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
});

/**
 * Every collection, with the field(s) that identify a row. store.ts walks
 * this list to load and save; a collection missing here would not be saved.
 */
export const food_entries = pgTable("food_entries", {
  id: id(),
  client_id: fk("client_id"),
  date: text("date"),
  meal: text("meal"),
  food_id: text("food_id"),
  name: text("name"),
  grams: num("grams"),
  serving: text("serving"),
  kcal: num("kcal"),
  protein: num("protein"),
  carbs: num("carbs"),
  fat: num("fat"),
  logged_at: text("logged_at"),
  extra: extra(),
});

export const custom_foods = pgTable("custom_foods", {
  id: id(),
  client_id: fk("client_id"),
  name: text("name"),
  kcal: num("kcal"),
  protein: num("protein"),
  carbs: num("carbs"),
  fat: num("fat"),
  serving_label: text("serving_label"),
  serving_grams: num("serving_grams"),
  created_at: text("created_at"),
  extra: extra(),
});

export const food_meals = pgTable("food_meals", {
  id: id(),
  client_id: fk("client_id"),
  name: text("name"),
  created_at: text("created_at"),
  extra: extra(),
});

export const food_days = pgTable("food_days", {
  id: id(),
  client_id: fk("client_id"),
  date: text("date"),
  day_type: text("day_type"),
  extra: extra(),
});

export const saved_meals = pgTable("saved_meals", {
  id: id(),
  client_id: fk("client_id"),
  name: text("name"),
  items: jsonb("items"),
  created_at: text("created_at"),
  extra: extra(),
});

export const off_foods = pgTable("off_foods", {
  id: id(),
  code: text("code"),
  name: text("name"),
  brand: text("brand"),
  quantity: text("quantity"),
  kcal: num("kcal"),
  protein: num("protein"),
  carbs: num("carbs"),
  fat: num("fat"),
  serving_label: text("serving_label"),
  serving_grams: num("serving_grams"),
  fetched_at: text("fetched_at"),
  extra: extra(),
});

export const saved_days = pgTable("saved_days", {
  id: id(),
  client_id: fk("client_id"),
  name: text("name"),
  items: jsonb("items"),
  created_at: text("created_at"),
  extra: extra(),
});

export const meal_photos = pgTable("meal_photos", {
  id: id(),
  client_id: fk("client_id"),
  date: text("date"),
  meal: text("meal"),
  file_path: text("file_path"),
  uploaded_at: text("uploaded_at"),
  extra: extra(),
});

export const COLLECTIONS = [
  { name: "users", table: users, key: ["id"] },
  { name: "clients", table: clients, key: ["id"] },
  { name: "exercises", table: exercises, key: ["id"] },
  { name: "program_days", table: program_days, key: ["id"] },
  { name: "training_programs", table: training_programs, key: ["id"] },
  { name: "client_phases", table: client_phases, key: ["id"] },
  { name: "calorie_logs", table: calorie_logs, key: ["id"] },
  { name: "food_entries", table: food_entries, key: ["id"] },
  { name: "custom_foods", table: custom_foods, key: ["id"] },
  { name: "food_meals", table: food_meals, key: ["id"] },
  { name: "food_days", table: food_days, key: ["id"] },
  { name: "saved_meals", table: saved_meals, key: ["id"] },
  { name: "off_foods", table: off_foods, key: ["id"] },
  { name: "saved_days", table: saved_days, key: ["id"] },
  { name: "meal_photos", table: meal_photos, key: ["id"] },
  { name: "check_in_notes", table: check_in_notes, key: ["id"] },
  { name: "client_exercise_notes", table: client_exercise_notes, key: ["id"] },
  { name: "client_gyms", table: client_gyms, key: ["id"] },
  { name: "coach_profiles", table: coach_profiles, key: ["coach_id"] },
  { name: "client_program_notes", table: client_program_notes, key: ["id"] },
  { name: "cardio_entries", table: cardio_entries, key: ["id"] },
  { name: "cardio_logs", table: cardio_logs, key: ["id"] },
  { name: "workout_assignments", table: workout_assignments, key: ["id"] },
  { name: "set_logs", table: set_logs, key: ["id"] },
  { name: "invoices", table: invoices, key: ["id"] },
  { name: "nutrition_plans", table: nutrition_plans, key: ["client_id"] },
  { name: "measurement_fields", table: measurement_fields, key: ["id"] },
  { name: "measurement_values", table: measurement_values, key: ["id"] },
  { name: "skinfold_entries", table: skinfold_entries, key: ["id"] },
  { name: "metric_definitions", table: metric_definitions, key: ["id"] },
  { name: "metric_entries", table: metric_entries, key: ["id"] },
  { name: "metric_template_categories", table: metric_template_categories, key: ["id"] },
  { name: "metric_template_items", table: metric_template_items, key: ["id"] },
  { name: "photo_slots", table: photo_slots, key: ["id"] },
  { name: "photo_uploads", table: photo_uploads, key: ["id"] },
  { name: "photo_settings", table: photo_settings, key: ["client_id"] },
  { name: "photo_period_notes", table: photo_period_notes, key: ["client_id", "period"] },
  { name: "client_profiles", table: client_profiles, key: ["client_id"] },
  { name: "client_goals", table: client_goals, key: ["id"] },
  { name: "meetings", table: meetings, key: ["id"] },
  { name: "meeting_notes", table: meeting_notes, key: ["id"] },
  { name: "training_columns", table: training_columns, key: ["id"] },
  { name: "assignment_custom_values", table: assignment_custom_values, key: ["id"] },
  { name: "chat_messages", table: chat_messages, key: ["id"] },
  { name: "coach_activity", table: coach_activity, key: ["id"] },
  { name: "report_templates", table: report_templates, key: ["id"] },
  { name: "report_template_sections", table: report_template_sections, key: ["id"] },
  { name: "client_reports", table: client_reports, key: ["id"] },
  { name: "client_preferences", table: client_preferences, key: ["client_id"] },
] as const;
