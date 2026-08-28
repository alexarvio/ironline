"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addClientGoal,
  addCustomTrainingColumn,
  addExercise,
  addExerciseToDay,
  addInvoice,
  addMeasurementField,
  addMeeting,
  addMeetingNote,
  addMetricDefinition,
  addMetricTemplateCategory,
  addMetricTemplateItem,
  addPhotoSlot,
  addReportTemplateSection,
  addSkinfoldEntry,
  applyMetricTemplateToClient,
  approveReport,
  computeReportSections,
  createClient,
  createDraftReport,
  createReportTemplate,
  deleteReport,
  deleteReportTemplate,
  duplicateWeek,
  ensureWeekSkeleton,
  getClient,
  getReportTemplate,
  listReportTemplateSections,
  listWeekNumbers,
  listMeasurementFields,
  listMetricDefinitions,
  logCoachActivity,
  logSet,
  OTHER_ITEMS,
  publishWeek,
  removeReportTemplateSection,
  sendReport,
  updateReportSummary,
  removeAssignment,
  removeClientGoal,
  removeCustomTrainingColumn,
  removeMeasurementCheckIn,
  removeMeasurementField,
  removeMeeting,
  removeMeetingNote,
  removeMetricDefinition,
  togglePinMetric,
  removeMetricTemplateCategory,
  removeMetricTemplateItem,
  removePhotoSlot,
  removeSkinfoldEntry,
  saveClientProfile,
  saveNutritionPlan,
  savePhotoPeriodNote,
  savePhotoUpload,
  setAssignmentCustomValue,
  setClientGoalDone,
  setDayLabel,
  setInvoiceStatus,
  setMeasurementValue,
  setMeetingStatus,
  setMetricEntry,
  saveChatMedia,
  sendChatMessage,
  setPhotoCadence,
  setTrainingColumnVisible,
  slugify,
  SUPPLEMENT_ITEMS,
  updateMeasurementField,
  updateMetricDefinition,
  updatePhotoSlot,
  updateTrainingColumn,
  VITAMIN_ITEMS,
  weekStart,
} from "./queries";
import { writeReportNarrative } from "./reportAi";

const CLIENT_ID = 1;
const WEEK = 1;

export async function addExerciseAction(formData: FormData) {
  const programDayId = Number(formData.get("programDayId"));
  const exerciseId = Number(formData.get("exerciseId"));
  const sets = Number(formData.get("sets")) || 3;
  const reps = String(formData.get("reps") || "8-10");
  const targetWeightRaw = formData.get("targetWeight");
  const targetWeight = targetWeightRaw ? Number(targetWeightRaw) : null;
  const rpeRaw = formData.get("rpe");
  const rpe = rpeRaw ? Number(rpeRaw) : null;
  const tempoRaw = String(formData.get("tempo") || "").trim();
  const tempo = tempoRaw || null;
  const notesRaw = String(formData.get("notes") || "").trim();
  const notes = notesRaw || null;

  addExerciseToDay(programDayId, exerciseId, sets, reps, targetWeight, rpe, tempo, notes);
  revalidatePath("/coach");
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function removeExerciseAction(formData: FormData) {
  const assignmentId = Number(formData.get("assignmentId"));
  removeAssignment(assignmentId);
  revalidatePath("/coach");
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function addExerciseToLibraryAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const muscleGroup = String(formData.get("muscleGroup") || "other");
  const videoUrl = String(formData.get("videoUrl") || "").trim() || null;
  if (!name) return;
  addExercise(name, muscleGroup, videoUrl);
  revalidatePath("/coach");
  revalidatePath("/admin");
}

export async function updateTrainingColumnAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  updateTrainingColumn(id, label);
  revalidatePath("/admin");
  revalidatePath("/coach");
}

export async function setTrainingColumnVisibleAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const visible = formData.get("visible") === "true";
  setTrainingColumnVisible(id, visible);
  revalidatePath("/admin");
  revalidatePath("/coach");
}

export async function addTrainingColumnAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  addCustomTrainingColumn(clientId, label);
  revalidatePath("/admin");
  revalidatePath("/coach");
}

export async function removeCustomTrainingColumnAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removeCustomTrainingColumn(id);
  revalidatePath("/admin");
  revalidatePath("/coach");
}

export async function setAssignmentCustomValueAction(formData: FormData) {
  const assignmentId = Number(formData.get("assignmentId"));
  const columnId = Number(formData.get("columnId"));
  const value = String(formData.get("value") || "");
  setAssignmentCustomValue(assignmentId, columnId, value);
  revalidatePath("/admin");
  revalidatePath("/coach");
  revalidatePath("/client");
}

export async function setLabelAction(formData: FormData) {
  const programDayId = Number(formData.get("programDayId"));
  const label = String(formData.get("label") || "");
  setDayLabel(programDayId, label);
  revalidatePath("/coach");
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function publishWeekAction(formData: FormData) {
  const clientId = Number(formData.get("clientId")) || CLIENT_ID;
  const week = Number(formData.get("week")) || WEEK;
  ensureWeekSkeleton(clientId, week);
  publishWeek(clientId, week);
  logCoachActivity(clientId, `Published week ${week}'s training`);
  revalidatePath("/coach");
  revalidatePath("/client");
  revalidatePath("/admin");
}

// "Deploy next week": duplicates the latest existing week's day labels and
// exercises forward one week and publishes it immediately — the client sees
// it live right away (under whichever week number getCurrentWeekNumber
// currently computes for them, once that week's date range arrives).
export async function deployNextWeekAction(formData: FormData) {
  const clientId = Number(formData.get("clientId")) || CLIENT_ID;
  const weeks = listWeekNumbers(clientId);
  const fromWeek = weeks.length > 0 ? Math.max(...weeks) : 1;
  const toWeek = fromWeek + 1;
  duplicateWeek(clientId, fromWeek, toWeek);
  publishWeek(clientId, toWeek);
  logCoachActivity(clientId, `Deployed week ${toWeek}'s training`);
  revalidatePath("/coach");
  revalidatePath("/client");
  revalidatePath("/admin");
}

// "Add a new sheet": either duplicates an existing week's exercises as a
// starting point (fromWeek provided) or creates a blank draft week (no
// fromWeek) — either way it's left as a draft for the coach to review
// before deploying, unlike deployNextWeekAction which publishes right away.
export async function addWeekSheetAction(formData: FormData) {
  const clientId = Number(formData.get("clientId")) || CLIENT_ID;
  const fromWeekRaw = formData.get("fromWeek");
  const weeks = listWeekNumbers(clientId);
  const toWeek = (weeks.length > 0 ? Math.max(...weeks) : 0) + 1;
  if (fromWeekRaw) {
    duplicateWeek(clientId, Number(fromWeekRaw), toWeek);
  } else {
    ensureWeekSkeleton(clientId, toWeek);
  }
  revalidatePath("/coach");
  revalidatePath("/admin");
}

export async function logSetAction(formData: FormData) {
  const assignmentId = Number(formData.get("assignmentId"));
  const setNumber = Number(formData.get("setNumber"));
  const weight = formData.get("weight") ? Number(formData.get("weight")) : null;
  const reps = formData.get("reps") ? Number(formData.get("reps")) : null;
  const rpe = formData.get("rpe") ? Number(formData.get("rpe")) : null;

  logSet(assignmentId, setNumber, weight, reps, rpe);
  revalidatePath("/client");
  revalidatePath("/coach");
  revalidatePath("/admin");
}

export async function createClientAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const client = createClient(name);
  revalidatePath("/admin");
  redirect(`/admin?client=${client.id}`);
}

export async function addInvoiceAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const status = String(formData.get("status") || "unpaid") as
    | "unpaid"
    | "sent"
    | "paid"
    | "due";
  if (!description) return;
  addInvoice(clientId, description, amount, status);
  logCoachActivity(clientId, `Sent a new invoice — "${description}"`);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setInvoiceStatusAction(formData: FormData) {
  const invoiceId = Number(formData.get("invoiceId"));
  const status = String(formData.get("status")) as "unpaid" | "sent" | "paid" | "due";
  setInvoiceStatus(invoiceId, status);
  revalidatePath("/admin");
}

// Logs every field present on the form for one check-in date at once — the
// client's check-in form submits all of the coach's current columns in a
// single action, same pattern as logMetricPeriodAction for the Trackers.
export async function saveMeasurementCheckInAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const date = String(formData.get("date") || "");
  if (!date) return;

  const fields = listMeasurementFields(clientId);
  fields.forEach((field) => {
    const raw = formData.get(`field_${field.id}`);
    if (raw === null || raw === "") return;
    const value = Number(raw);
    setMeasurementValue(field.id, date, Number.isFinite(value) ? value : null);
  });

  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeMeasurementCheckInAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const date = String(formData.get("date") || "");
  removeMeasurementCheckIn(clientId, date);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function addMeasurementFieldAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  if (!name) return;
  addMeasurementField(clientId, name, unit);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updateMeasurementFieldAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  if (!name) return;
  updateMeasurementField(id, name, unit);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeMeasurementFieldAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removeMeasurementField(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function addSkinfoldEntryAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const date = String(formData.get("date") || "");
  const site = String(formData.get("site") || "");
  if (!date || !site) return;
  const readingRaw = formData.get("readingMm");
  addSkinfoldEntry(clientId, date, site, readingRaw ? Number(readingRaw) : null);
  revalidatePath("/admin");
}

export async function removeSkinfoldEntryAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removeSkinfoldEntry(id);
  revalidatePath("/admin");
}

export async function addMetricDefinitionAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const category = String(formData.get("category") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  const frequency = String(formData.get("frequency") || "daily") as "daily" | "weekly";
  if (!name) return;
  addMetricDefinition(clientId, category, name, unit, frequency);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updateMetricDefinitionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const category = String(formData.get("category") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  if (!name) return;
  updateMetricDefinition(id, category, name, unit);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeMetricDefinitionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removeMetricDefinition(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function togglePinMetricAction(formData: FormData) {
  const id = Number(formData.get("id"));
  togglePinMetric(id);
  revalidatePath("/admin");
}

// ---- Tracker metric templates: coach-level presets applied to a client ----

export async function addMetricTemplateCategoryAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const frequency = String(formData.get("frequency") || "daily") as "daily" | "weekly";
  if (!name) return;
  addMetricTemplateCategory(name, frequency);
  revalidatePath("/admin");
}

export async function removeMetricTemplateCategoryAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removeMetricTemplateCategory(id);
  revalidatePath("/admin");
}

export async function addMetricTemplateItemAction(formData: FormData) {
  const templateCategoryId = Number(formData.get("templateCategoryId"));
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  if (!name) return;
  addMetricTemplateItem(templateCategoryId, name, unit);
  revalidatePath("/admin");
}

export async function removeMetricTemplateItemAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removeMetricTemplateItem(id);
  revalidatePath("/admin");
}

export async function applyMetricTemplateAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const templateCategoryId = Number(formData.get("templateCategoryId"));
  if (!templateCategoryId) return;
  applyMetricTemplateToClient(clientId, templateCategoryId);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// Logs every metric field present on the form for one period at once — the
// "log today" / "log this week" form submits all currently-defined metrics
// in a single action rather than one action per field.
export async function logMetricPeriodAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const frequency = String(formData.get("frequency") || "daily") as "daily" | "weekly";
  const dateRaw = String(formData.get("date") || "");
  if (!dateRaw) return;
  const period = frequency === "weekly" ? weekStart(dateRaw) : dateRaw;

  const definitions = listMetricDefinitions(clientId, frequency);
  definitions.forEach((def) => {
    const raw = formData.get(`metric_${def.id}`);
    if (raw === null || raw === "") return;
    const value = Number(raw);
    setMetricEntry(def.id, period, Number.isFinite(value) ? value : null);
  });

  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function addPhotoSlotAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  addPhotoSlot(clientId, label);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updatePhotoSlotAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  updatePhotoSlot(id, label);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removePhotoSlotAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removePhotoSlot(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setPhotoCadenceAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const cadence = String(formData.get("cadence") || "weekly") as "weekly" | "biweekly" | "monthly";
  setPhotoCadence(clientId, cadence);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function savePhotoPeriodNoteAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const period = String(formData.get("period") || "");
  if (!period) return;
  savePhotoPeriodNote({
    client_id: clientId,
    period,
    shape: String(formData.get("shape") || ""),
    strengths: String(formData.get("strengths") || ""),
    improvements: String(formData.get("improvements") || ""),
    next_steps: String(formData.get("next_steps") || ""),
  });
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function uploadProgressPhotoAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const slotId = Number(formData.get("slotId"));
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;
  const buffer = Buffer.from(await file.arrayBuffer());
  savePhotoUpload(clientId, slotId, buffer, file.type || "image/jpeg");
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function saveNutritionPlanAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));

  const num = (name: string) => {
    const raw = formData.get(name);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const str = (name: string) => String(formData.get(name) || "");

  const meals = (prefix: "td" | "rd") =>
    Array.from({ length: 6 }, (_, i) => ({
      protein: num(`${prefix}_p_${i + 1}`),
      fats: num(`${prefix}_f_${i + 1}`),
      carbs: num(`${prefix}_c_${i + 1}`),
    }));

  const vitamins: Record<string, { quantity: string; timing: string }> = {};
  VITAMIN_ITEMS.forEach((item) => {
    const key = slugify(item);
    vitamins[key] = { quantity: str(`vit_qty_${key}`), timing: str(`vit_time_${key}`) };
  });

  const other: Record<string, { amount: string; timing: string }> = {};
  OTHER_ITEMS.forEach((item) => {
    const key = slugify(item);
    other[key] = { amount: str(`other_amt_${key}`), timing: str(`other_time_${key}`) };
  });

  const supplements: Record<string, { quantity: string; timing: string }> = {};
  SUPPLEMENT_ITEMS.forEach((item) => {
    const key = slugify(item);
    supplements[key] = { quantity: str(`supp_qty_${key}`), timing: str(`supp_time_${key}`) };
  });

  saveNutritionPlan({
    client_id: clientId,
    maintenance_kcal: num("maintenance"),
    ebf: num("ebf"),
    training_day_meals: meals("td"),
    rest_day_meals: meals("rd"),
    vitamins,
    other,
    supplements,
    coach_notes: str("coach_notes"),
  });
  logCoachActivity(clientId, "Updated your nutrition plan");

  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function saveClientProfileAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const str = (name: string) => String(formData.get(name) || "");
  const numOrNull = (name: string) => {
    const raw = formData.get(name);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const strOrNull = (name: string) => {
    const v = str(name);
    return v || null;
  };

  saveClientProfile({
    client_id: clientId,
    birthdate: strOrNull("birthdate"),
    height_cm: numOrNull("height_cm"),
    starting_weight_kg: numOrNull("starting_weight_kg"),
    coaching_start_date: strOrNull("coaching_start_date"),
    current_week: str("current_week"),
    goal_phase: str("goal_phase"),
    goal_date: strOrNull("goal_date"),
    check_in_day: strOrNull("check_in_day"),
    steps_goal: str("steps_goal"),
    cardio_goal: str("cardio_goal"),
    training_goal: str("training_goal"),
    water_goal: str("water_goal"),
  });

  revalidatePath("/admin");
}

export async function addClientGoalAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const term = String(formData.get("term") || "short") as "short" | "long";
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  addClientGoal(clientId, term, text);
  revalidatePath("/admin");
}

export async function toggleClientGoalAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const done = String(formData.get("done")) === "true";
  setClientGoalDone(id, done);
  revalidatePath("/admin");
}

export async function removeClientGoalAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removeClientGoal(id);
  revalidatePath("/admin");
}

export async function addMeetingAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const duration = Number(formData.get("durationMinutes")) || undefined;
  const topic = String(formData.get("topic") || "").trim();
  if (!date) return;
  addMeeting(clientId, date, time, topic, duration);
  logCoachActivity(clientId, topic ? `Scheduled a meeting — "${topic}"` : "Scheduled a new meeting");
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setMeetingStatusAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as "scheduled" | "completed" | "canceled";
  setMeetingStatus(id, status);
  revalidatePath("/admin");
}

export async function removeMeetingAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removeMeeting(id);
  revalidatePath("/admin");
}

export async function addMeetingNoteAction(formData: FormData) {
  const meetingId = Number(formData.get("meetingId"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  addMeetingNote(meetingId, text);
  revalidatePath("/admin");
}

export async function removeMeetingNoteAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removeMeetingNote(id);
  revalidatePath("/admin");
}

export async function sendChatMessageAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const sender = String(formData.get("sender") || "") as "client" | "coach";
  const text = String(formData.get("text") || "").trim();
  const file = formData.get("file") as File | null;
  if (!clientId || (sender !== "client" && sender !== "coach")) return;

  let media: { path: string; type: "image" | "video" } | undefined;
  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    media = saveChatMedia(clientId, buffer, file.type || "image/jpeg");
  }
  if (!text && !media) return;

  sendChatMessage(clientId, sender, text, media);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// ---- Reports ----

export async function createReportTemplateAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  createReportTemplate(name);
  revalidatePath("/admin");
}

export async function deleteReportTemplateAction(formData: FormData) {
  const id = Number(formData.get("id"));
  deleteReportTemplate(id);
  revalidatePath("/admin");
}

export async function addReportTemplateSectionAction(formData: FormData) {
  const templateId = Number(formData.get("templateId"));
  const type = String(formData.get("type") || "training") as
    | "training"
    | "nutrition"
    | "measurements"
    | "tracker_metric"
    | "photos"
    | "goals";
  const label = String(formData.get("label") || "").trim();
  const metricName = String(formData.get("metricName") || "").trim() || null;
  if (!label) return;
  addReportTemplateSection(templateId, type, label, type === "tracker_metric" ? metricName : null);
  revalidatePath("/admin");
}

export async function removeReportTemplateSectionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  removeReportTemplateSection(id);
  revalidatePath("/admin");
}

// The one action that calls the AI — pulls real data for the period, hands
// it to writeReportNarrative (falls back to a plain templated summary if
// ANTHROPIC_API_KEY isn't set), and stores the result as a new draft.
export async function generateReportAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const templateId = Number(formData.get("templateId"));
  const periodStart = String(formData.get("periodStart") || "");
  const periodEnd = String(formData.get("periodEnd") || "");
  if (!clientId || !templateId || !periodStart || !periodEnd) return;

  const template = getReportTemplate(templateId);
  const client = getClient(clientId);
  if (!template || !client) return;

  // Per-client customization for this one generation: the coach can drop
  // any of the template's sections and/or bolt on one extra tracker metric
  // that isn't in the shared template — without editing the template itself.
  // Checkboxes are checked by default in the UI, so an empty includedIds
  // (e.g. a non-JS form submit) falls back to running every section.
  const includedIds = formData.getAll("sectionId").map(Number);
  const allSections = listReportTemplateSections(templateId);
  const sectionsToRun = includedIds.length > 0 ? allSections.filter((s) => includedIds.includes(s.id)) : allSections;

  const extraMetricName = String(formData.get("extraMetricName") || "").trim();
  if (extraMetricName) {
    const extraLabel = String(formData.get("extraMetricLabel") || "").trim() || extraMetricName;
    sectionsToRun.push({
      id: -1,
      template_id: templateId,
      type: "tracker_metric",
      label: extraLabel,
      metric_name: extraMetricName,
      order_index: sectionsToRun.length,
    });
  }
  if (sectionsToRun.length === 0) return;

  const sectionsData = computeReportSections(clientId, sectionsToRun, periodStart, periodEnd);
  const { summary, aiGenerated } = await writeReportNarrative(client.name, periodStart, periodEnd, sectionsData);
  createDraftReport(clientId, templateId, template.name, periodStart, periodEnd, summary, aiGenerated, sectionsData);
  revalidatePath("/admin");
}

export async function updateReportSummaryAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const summary = String(formData.get("summary") || "");
  updateReportSummary(id, summary);
  revalidatePath("/admin");
}

export async function approveReportAction(formData: FormData) {
  const id = Number(formData.get("id"));
  approveReport(id);
  revalidatePath("/admin");
}

export async function sendReportAction(formData: FormData) {
  const id = Number(formData.get("id"));
  sendReport(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function deleteReportAction(formData: FormData) {
  const id = Number(formData.get("id"));
  deleteReport(id);
  revalidatePath("/admin");
}
