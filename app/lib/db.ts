import fs from "fs";
import path from "path";

// Pure-JS JSON file store — no native module, no compiler, works identically
// on any machine. Swap this file for a real database later without touching
// any page or server action; queries.ts is the only other file that reads it.

// In production this points at a mounted persistent volume (e.g. /data) so
// the JSON store and uploaded files survive redeploys/restarts; unset in
// local dev, so both default to the project directory as before.
export const DATA_DIR = process.env.DATA_DIR ?? process.cwd();
const DB_PATH = path.join(DATA_DIR, "ironline.json");

type Client = { id: number; name: string };
type Exercise = { id: number; name: string; muscle_tags: string | null; video_url: string | null };
type ProgramDay = {
  id: number;
  client_id: number;
  week_number: number;
  day_of_week: number;
  label: string | null;
  status: "draft" | "published";
  // A day with no exercises already reads as a rest day; this is the coach
  // saying so deliberately, so an empty day can be marked "Rest" rather than
  // "nothing built yet". Only settable while the day IS empty, so toggling it
  // can never discard programming. Missing on rows written before this field
  // existed, so callers treat absent as false.
  is_rest?: boolean;
};
// A multi-week training program — the coach picks a name and a length
// (total_weeks) up front; program_days for weeks [start_week, start_week +
// total_weeks) are created immediately so every week is reachable right
// away, not "unlocked" one at a time. Internally weeks are numbered
// globally-uniquely per client (program_days.week_number), but the UI only
// ever shows a week's position WITHIN its program ("Week 1".."Week N" —
// see programWeekLabel in queries.ts), so a client's second program starts
// back at "Week 1" even though its underlying week_numbers continue on.
//
// "draft"/"deployed" is a property of the whole program, not any one day —
// deploying publishes every week in the range at once. There's no
// background job runner in this app, so scheduled_at is enforced lazily:
// applyDueProgramDeployments() (called once per request from the root
// layout) deploys any program whose scheduled_at has passed the moment
// anyone next loads the app, rather than firing at the exact second.
type TrainingProgram = {
  id: number;
  client_id: number;
  name: string | null;
  start_week: number;
  total_weeks: number;
  status: "draft" | "deployed";
  deployed_at: string | null;
  scheduled_at: string | null;
};
type WorkoutAssignment = {
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
  // The coach's note on this exercise for this week. `notes` is the text and
  // long predates the rest; the three fields beside it turn that plain string
  // into something the client app can present properly — a labelled, dated,
  // collapsible panel that shows an unread dot until it's first opened.
  // Deliberately on the assignment rather than a table of its own: an
  // assignment is already "this exercise, this day, this week", which is
  // exactly the scope a note has.
  notes: string | null;
  // A movement demo for THIS prescription, not for the exercise in general:
  // the coach may want a different cue for the same lift in a different block,
  // and the exercise library's own video_url stays the fallback. The client
  // taps it in their app to watch the movement.
  demo_url: string | null;
  note_kind: "form" | "load" | "tempo" | null;
  note_at: string | null;
  note_read: boolean;
};
type SetLog = {
  id: number;
  workout_assignment_id: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe_actual: number | null;
  logged_at: string;
};
type Invoice = {
  id: number;
  client_id: number;
  description: string;
  amount: number;
  status: "unpaid" | "sent" | "paid" | "due";
  created_at: string;
  updated_at: string;
};

type MealMacros = { protein: number | null; fats: number | null; carbs: number | null };
type NutritionPlan = {
  client_id: number;
  // What the coach calls this phase's plan ("Lean bulk", "Cut A"). One plan
  // per client, renamed as the phase changes; absent on rows written before
  // this field existed.
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

// Coach-defined check-in columns (default: Weight/kg, Waist/cm) — the coach
// decides what the client is asked to log at each check-in, and can rename,
// add, or remove columns at any time. Values are keyed by field + date so
// adding/removing a column never touches historical data for the others.
type MeasurementFieldDef = {
  id: number;
  client_id: number;
  name: string;
  unit: string;
  order_index: number;
  // Same "deployed to the client" switch as MetricDefinition above.
  visible_to_client?: boolean;
  // Same pin as MetricDefinition: one of the six figures surfaced on the
  // coach's rail. Shared across metrics and measurements so the coach picks
  // six things total, not six of each.
  pinned?: boolean;
};
type MeasurementValue = {
  id: number;
  client_id: number;
  field_id: number;
  date: string;
  value: number | null;
};
type SkinfoldEntry = {
  id: number;
  client_id: number;
  date: string;
  site: string;
  reading_mm: number | null;
};

type MetricCadence = "daily" | "weekly" | "monthly";

type MetricDefinition = {
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
  order_index: number;
  // Up to 5 per client, surfaced at the top of their Start Page — see
  // PINNED_METRIC_LIMIT in queries.ts. Optional so existing saved data
  // without this field just reads as unpinned.
  pinned?: boolean;
  // Whether this metric is deployed to the client's check-in screen. The
  // coach can build a metric and keep it off the client app (or retire one
  // without deleting its history). Optional and read as "!== false", so
  // every metric saved before this field existed stays visible.
  visible_to_client?: boolean;
};
type MetricEntry = {
  id: number;
  metric_definition_id: number;
  period: string; // exact date for a daily metric; Monday of the week for a weekly one
  value: number | null;
};

// Coach-level (not tied to any one client) reusable metric presets — build a
// category + its metrics once (e.g. "Stress": Work/Private/Social stress),
// then apply the whole set to any client's Daily/Weekly Tracker in one click
// instead of retyping it from scratch every time a new client signs up.
type MetricTemplateCategory = {
  id: number;
  name: string;
  // The rhythm the client is asked for this on. "monthly" is what the
  // old separate measurements sheet became: cadence is a property of a
  // metric, which is why Daily Tracker and Weekly Tracker stopped being
  // their own screens.
  frequency: MetricCadence;
  order_index: number;
};
type MetricTemplateItem = {
  id: number;
  template_category_id: number;
  name: string;
  unit: string;
  order_index: number;
};

type PhotoSlot = {
  id: number;
  client_id: number;
  label: string;
  order_index: number;
};
// "period" is the start-date of whatever bucket the coach's chosen upload
// cadence puts this photo in — a Monday for weekly/biweekly, the 1st of the
// month for monthly. See photoPeriodFor() in queries.ts.
type PhotoUpload = {
  id: number;
  slot_id: number;
  period: string;
  file_path: string; // public URL path, e.g. /uploads/progress/1/3/2026-08-24.jpg
  uploaded_at: string;
};

// How often a client gets a fresh, empty photo sheet to fill in — one
// setting per client, applying to all of their photo slots at once. Default
// is weekly when no row exists yet (mirrors every other coach-configurable
// default in this file).
type PhotoCadence = "weekly" | "biweekly" | "monthly";
type PhotoSettings = {
  client_id: number;
  cadence: PhotoCadence;
};

// The coach's written feedback on one period's photo set — shape, what's
// strong, what to improve, next steps. One per (client, period); shown to
// both the coach (editable, in the expanded row) and the client (read-only,
// in their own progress history).
type PhotoPeriodNote = {
  client_id: number;
  period: string;
  shape: string;
  strengths: string;
  improvements: string;
  next_steps: string;
};

// Start Page: the coach's "Startpagina" tab — member info, coaching info, and goals.
type ClientProfile = {
  client_id: number;
  birthdate: string | null;
  // Contact details for the right-hand Member info block. Nullable because a
  // coach may never fill them in, and the panel shows an em dash rather than
  // a blank row so the shape of the block stays stable.
  // Optional so the profile rows written before these existed still satisfy
  // the type — getData()'s schema patch back-fills missing tables, not
  // missing columns. Read them with ?? null.
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
  coaching_start_date: string | null;
  current_week: string;
  goal_phase: string;
  // When the current phase began. The client's measurement deltas are
  // phase-to-date, so they need a start that moves when the coach switches
  // phase; unset falls back to coaching_start_date, which is right for a
  // client still in their first one.
  goal_phase_start_date: string | null;
  goal_date: string | null;
  check_in_day: string | null;
  steps_goal: string;
  cardio_goal: string;
  training_goal: string;
  water_goal: string;
};
type ClientGoal = {
  id: number;
  client_id: number;
  term: "short" | "long";
  text: string;
  done: boolean;
  order_index: number;
};

// Meetings: coach-scheduled check-in calls, each with its own running notes log.
type Meeting = {
  id: number;
  client_id: number;
  date: string;
  time: string;
  duration_minutes: number;
  topic: string;
  status: "scheduled" | "completed" | "canceled";
};
type MeetingNote = {
  id: number;
  meeting_id: number;
  text: string;
  created_at: string;
};

// Per-client customization of the Training exercise table: which columns
// show, in what order, and whether they're a built-in (backed by a real
// WorkoutAssignment field) or a coach-defined custom column (backed by
// AssignmentCustomValue). Mirrors the same coach-configurable-fields pattern
// used for Measurements and Trackers elsewhere in the app.
type TrainingColumn = {
  id: number;
  client_id: number;
  key: string; // builtin: "sets"|"reps"|"weight_goal"|"rpe"|"tempo"|"notes"; custom: "custom_<id>"
  label: string;
  kind: "builtin" | "custom";
  visible: boolean;
  order_index: number;
};
type AssignmentCustomValue = {
  id: number;
  workout_assignment_id: number;
  column_id: number;
  value: string;
};

// A simple message thread between one client and their coach — no threads,
// no attachments, just text in order. "sender" is which side wrote it, so
// the UI can align/color bubbles without a separate participants table.
type ChatMessage = {
  id: number;
  client_id: number;
  sender: "client" | "coach";
  text: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
  created_at: string;
};

// A log of coach-side changes worth surfacing to the client — "your coach
// updated your nutrition plan" and the like. Doubles as the client's
// notification feed (Chat and Notifications screen): the client Home tab
// still only ever shows the single latest entry (getLatestCoachActivity),
// while the notification list reads the whole thing grouped/unread.
// "reminder" entries are the one kind not written by a coach action — they're
// lazily generated by applyDueClientReminders() the same way
// applyDueProgramDeployments() lazily deploys scheduled programs, and use
// dedupe_key so the same due condition doesn't spawn a new row on every
// request.
type CoachActivityKind = "coach_note" | "report" | "programme" | "reminder" | "general";
type CoachActivityActionTab = "home" | "training" | "nutrition" | "settings" | "chat";
type CoachActivity = {
  id: number;
  client_id: number;
  message: string;
  created_at: string;
  kind: CoachActivityKind;
  read: boolean;
  action_tab: CoachActivityActionTab | null;
  action_label: string | null;
  // The row the action tab should open on arrival — currently only a
  // client_reports id, for "your coach sent you a progress report", which
  // deep-links to Settings with that report expanded.
  action_ref: number | null;
  dedupe_key: string | null;
};

// Coach-level, reusable report templates (mirrors the metric_template_*
// pattern) — a template is just an ordered set of sections; applying it to
// a client just means generating a report using that section list, nothing
// is copied/instantiated onto the client ahead of time.
type ReportSectionType = "training" | "nutrition" | "measurements" | "tracker_metric" | "photos" | "goals";
type ReportTemplate = {
  id: number;
  name: string;
  created_at: string;
};
type ReportTemplateSection = {
  id: number;
  template_id: number;
  type: ReportSectionType;
  label: string;
  // Only meaningful for type "tracker_metric" — matched by name against
  // whichever client the template is applied to (metric_definitions aren't
  // shared across clients, so a template can't reference an id directly).
  metric_name: string | null;
  order_index: number;
};

// One generated report for one client over one period. sections_snapshot
// freezes the computed numbers at generation time (JSON-stringified) so a
// past report keeps reading the same even as new data comes in later —
// only the coach's summary text is editable after generation.
type ClientReport = {
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
  // Set the first time the client expands the report in Settings. Reports
  // are client-visible only there, and one stays flagged "New" until this is
  // set. Missing on rows written before this field existed, so callers treat
  // absent as "not opened yet".
  opened_at: string | null;
};


// Per-client Settings preferences. No row means defaults (see
// DEFAULT_CLIENT_PREFERENCES in queries.ts) — only written once the client
// actually changes something, same "no row = default" pattern as the rest
// of this coach-configurable-fields file.
type ClientPreferences = {
  client_id: number;
  coach_notes: boolean;
  checkin_reminders: boolean;
  weekly_digest: boolean;
  units: "metric" | "imperial";
};

// Login accounts. Deliberately separate from Client: a Client is the coach's
// record of a person and exists from the moment the coach creates them (long
// before, or entirely without, that person ever logging in). A User is a set
// of credentials. role="client" rows carry the single client_id they're
// allowed to see — that field is the whole basis of client data isolation, so
// nothing client-facing may ever take a client id from user input instead.
type User = {
  id: number;
  email: string; // stored lowercased — this is the login lookup key
  password_hash: string; // scrypt, stored as "salt:derivedKey" in hex
  role: "coach" | "client";
  client_id: number | null; // set only for role="client"
  // Set when a coach hands out a temporary password; the client is forced
  // through a password change before they can reach any real page.
  must_change_password: boolean;
  created_at: string;
};

type Data = {
  users: User[];
  clients: Client[];
  exercises: Exercise[];
  program_days: ProgramDay[];
  workout_assignments: WorkoutAssignment[];
  set_logs: SetLog[];
  invoices: Invoice[];
  nutrition_plans: NutritionPlan[];
  measurement_fields: MeasurementFieldDef[];
  measurement_values: MeasurementValue[];
  skinfold_entries: SkinfoldEntry[];
  metric_definitions: MetricDefinition[];
  metric_entries: MetricEntry[];
  metric_template_categories: MetricTemplateCategory[];
  metric_template_items: MetricTemplateItem[];
  photo_slots: PhotoSlot[];
  photo_uploads: PhotoUpload[];
  photo_settings: PhotoSettings[];
  photo_period_notes: PhotoPeriodNote[];
  client_profiles: ClientProfile[];
  client_goals: ClientGoal[];
  meetings: Meeting[];
  meeting_notes: MeetingNote[];
  training_columns: TrainingColumn[];
  assignment_custom_values: AssignmentCustomValue[];
  chat_messages: ChatMessage[];
  coach_activity: CoachActivity[];
  report_templates: ReportTemplate[];
  report_template_sections: ReportTemplateSection[];
  client_reports: ClientReport[];
  training_programs: TrainingProgram[];
  client_preferences: ClientPreferences[];
  // The last COACH_RESET_TOKEN value that was acted on (see
  // resetCoachFromEnv in lib/auth.ts), so a reset token left sitting in the
  // environment only ever fires once.
  coach_reset_applied?: string;
  // Same idea for WORKSPACE_RESET_TOKEN (see resetWorkspaceFromEnv): the last
  // token value that wiped the client data, so it only ever fires once.
  workspace_reset_applied?: string;
  _seq: Record<string, number>;
};

function emptyData(): Data {
  return {
    users: [],
    clients: [],
    training_programs: [],
    client_preferences: [],
    exercises: [],
    program_days: [],
    workout_assignments: [],
    set_logs: [],
    invoices: [],
    nutrition_plans: [],
    measurement_fields: [],
    measurement_values: [],
    skinfold_entries: [],
    metric_definitions: [],
    metric_entries: [],
    metric_template_categories: [],
    metric_template_items: [],
    photo_slots: [],
    photo_uploads: [],
    photo_settings: [],
    photo_period_notes: [],
    client_profiles: [],
    client_goals: [],
    meetings: [],
    meeting_notes: [],
    training_columns: [],
    assignment_custom_values: [],
    chat_messages: [],
    coach_activity: [],
    report_templates: [],
    report_template_sections: [],
    client_reports: [],
    _seq: {},
  };
}

function load(): Data {
  if (!fs.existsSync(DB_PATH)) return emptyData();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as Partial<Data>;
    // Fill in any fields added since this file was last written.
    const data: Data = { ...emptyData(), ...parsed };
    // One-time tidy: until Sept 2026 every client was auto-seeded with Weight
    // and Waist measurement fields on first open. Rows that never received a
    // value are pure leftovers of that, and made a brand-new client's graph
    // picker list two figures nobody chose. Drop them; anything with data
    // stays. Safe to run on every load — it only ever removes empty rows.
    const used = new Set(data.measurement_values.map((v) => v.field_id));
    const seededNames = new Set(["weight", "waist"]);
    const before = data.measurement_fields.length;
    data.measurement_fields = data.measurement_fields.filter(
      (f) => used.has(f.id) || !seededNames.has(f.name.trim().toLowerCase())
    );
    if (data.measurement_fields.length !== before) save(data);
    return data;
  } catch {
    return emptyData();
  }
}

function save(data: Data) {
  // On a fresh volume the mount point exists but nothing under it does.
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Reuse one in-memory copy across hot reloads in dev, always synced to disk on write.
const globalForDb = globalThis as unknown as { _jsonDb?: Data };
if (!globalForDb._jsonDb) globalForDb._jsonDb = load();

function nextId(table: string): number {
  const data = globalForDb._jsonDb!;
  data._seq[table] = (data._seq[table] ?? 0) + 1;
  return data._seq[table];
}

export function getData(): Data {
  const data = globalForDb._jsonDb!;
  // Self-heal: a dev server keeps this object in memory across hot reloads
  // (Node's globalThis survives module swaps), so a field added to the
  // schema after the server started would otherwise be missing until a full
  // restart. Patch in any defaults that aren't there yet, every call — cheap,
  // and it means "add a field, sync the file, refresh the browser" always
  // works without asking anyone to restart their dev server.
  const defaults = emptyData();
  (Object.keys(defaults) as (keyof Data)[]).forEach((key) => {
    if (data[key] === undefined) {
      (data as Record<keyof Data, unknown>)[key] = defaults[key];
    }
  });
  return data;
}

export function persist() {
  save(globalForDb._jsonDb!);
}

export function allocId(table: string): number {
  return nextId(table);
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// The client app spells days out in full on its Training day cards; the
// admin's dense week grid keeps the short forms above.
export const DAY_NAMES_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
