"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  canAccessClient,
  getSessionUser,
  requireClientAccess,
  requireCoach,
} from "./auth";
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
  createProgram,
  deployProgram,
  getClient,
  getReportTemplate,
  renameProgram,
  removeProgram,
  scheduleProgramDeploy,
  updateProgramTotalWeeks,
  listReportTemplateSections,
  listWeekNumbers,
  listMeasurementFields,
  listMetricDefinitions,
  logCoachActivity,
  markAllNotificationsRead,
  markNotificationRead,
  markReportOpened,
  logSet,
  OTHER_ITEMS,
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
  togglePinMeasurementField,
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
  setClientPreference,
  setMeasurementFieldVisibleToClient,
  setMetricVisibleToClient,
  setClientUnits,
  setDayLabel,
  setDayRest,
  copyProgramWeek,
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
  updateAssignmentFields,
  updateMeasurementField,
  updateMetricDefinition,
  updatePhotoSlot,
  updateTrainingColumn,
  VITAMIN_ITEMS,
  weekStart,
  getClientIdForAssignment,
  getClientIdForPhotoSlot,
  getClientIdForNotification,
  getClientIdForReport,
} from "./queries";
import { writeReportNarrative } from "./reportAi";
import type { ReportSectionType } from "./reportSectionTypes";

const CLIENT_ID = 3;

export async function addExerciseAction(formData: FormData) {
  await requireCoach();
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
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function removeExerciseAction(formData: FormData) {
  await requireCoach();
  const assignmentId = Number(formData.get("assignmentId"));
  removeAssignment(assignmentId);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// One shared action for every editable target field on an already-added
// assignment (sets/reps/targetWeight/rpe/tempo/notes) — each field's input
// submits itself on blur with only its own name present, so this only ever
// touches the one field that changed.
export async function updateAssignmentAction(formData: FormData) {
  await requireCoach();
  const assignmentId = Number(formData.get("assignmentId"));
  const fields: Parameters<typeof updateAssignmentFields>[1] = {};
  if (formData.has("sets")) fields.sets = Math.max(1, Number(formData.get("sets")) || 1);
  if (formData.has("reps")) fields.reps = String(formData.get("reps") || "");
  if (formData.has("targetWeight")) {
    const raw = String(formData.get("targetWeight") || "").trim();
    fields.target_weight_kg = raw ? Number(raw) : null;
  }
  if (formData.has("rpe")) {
    const raw = String(formData.get("rpe") || "").trim();
    fields.rpe_target = raw ? Number(raw) : null;
  }
  if (formData.has("tempo")) fields.tempo = String(formData.get("tempo") || "").trim() || null;
  if (formData.has("notes")) fields.notes = String(formData.get("notes") || "").trim() || null;
  updateAssignmentFields(assignmentId, fields);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function addExerciseToLibraryAction(formData: FormData) {
  await requireCoach();
  const name = String(formData.get("name") || "").trim();
  const muscleGroup = String(formData.get("muscleGroup") || "other");
  const videoUrl = String(formData.get("videoUrl") || "").trim() || null;
  if (!name) return;
  addExercise(name, muscleGroup, videoUrl);
  revalidatePath("/admin");
}

export async function updateTrainingColumnAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  updateTrainingColumn(id, label);
  revalidatePath("/admin");
}

export async function setTrainingColumnVisibleAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  const visible = formData.get("visible") === "true";
  setTrainingColumnVisible(id, visible);
  revalidatePath("/admin");
}

export async function addTrainingColumnAction(formData: FormData) {
  await requireCoach();
  const clientId = Number(formData.get("clientId"));
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  addCustomTrainingColumn(clientId, label);
  revalidatePath("/admin");
}

export async function removeCustomTrainingColumnAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  removeCustomTrainingColumn(id);
  revalidatePath("/admin");
}

export async function setAssignmentCustomValueAction(formData: FormData) {
  await requireCoach();
  const assignmentId = Number(formData.get("assignmentId"));
  const columnId = Number(formData.get("columnId"));
  const value = String(formData.get("value") || "");
  setAssignmentCustomValue(assignmentId, columnId, value);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setDayRestAction(formData: FormData) {
  await requireCoach();
  const programDayId = Number(formData.get("programDayId"));
  const isRest = formData.get("isRest") === "true";
  setDayRest(programDayId, isRest);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// "Copy week N here" in the builder toolbar — duplicates the previous
// week's plan onto the one being edited so a coach progressing a block
// isn't retyping seven days of exercises.
export async function copyProgramWeekAction(formData: FormData) {
  await requireCoach();
  const clientId = Number(formData.get("clientId"));
  const fromWeek = Number(formData.get("fromWeek"));
  const toWeek = Number(formData.get("toWeek"));
  if (!clientId || !fromWeek || !toWeek) return;
  copyProgramWeek(clientId, fromWeek, toWeek);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function setLabelAction(formData: FormData) {
  await requireCoach();
  const programDayId = Number(formData.get("programDayId"));
  const label = String(formData.get("label") || "");
  setDayLabel(programDayId, label);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// Starts a new program: just a single blank week to begin building right
// away — no name/length upfront. Both get set later, in place, on the
// draft card itself (ProgramNameForm, ProgramWeeksForm) once the coach
// actually knows what they're building. The new program's week lives after
// every week_number the client already has (append-only, same as the old
// week-at-a-time model), but always displays as "Week 1" — see
// programWeekLabel.
export async function createProgramAction(formData: FormData) {
  await requireCoach();
  const clientId = Number(formData.get("clientId")) || CLIENT_ID;
  const weekLinkBase = String(formData.get("weekLinkBase") || "/admin");
  const existingWeeks = listWeekNumbers(clientId);
  const startWeek = (existingWeeks.length > 0 ? Math.max(...existingWeeks) : 0) + 1;
  createProgram(clientId, "", 1, startWeek);
  revalidatePath("/admin");
  redirect(weekLinkBase || "/admin");
}

export async function updateProgramWeeksAction(formData: FormData) {
  await requireCoach();
  const programId = Number(formData.get("programId"));
  const totalWeeks = Number(formData.get("totalWeeks"));
  updateProgramTotalWeeks(programId, totalWeeks);
  revalidatePath("/admin");
}

export async function renameProgramAction(formData: FormData) {
  await requireCoach();
  const programId = Number(formData.get("programId"));
  const name = String(formData.get("name") || "");
  renameProgram(programId, name);
  revalidatePath("/admin");
}

export async function deployProgramAction(formData: FormData) {
  await requireCoach();
  const programId = Number(formData.get("programId"));
  deployProgram(programId);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// Combines the coach's separate date + time inputs (local to the coach's
// own clock — there's no per-client timezone concept in this app) into an
// ISO instant, comparable against `new Date().toISOString()` in
// applyDueProgramDeployments. Silently no-ops on a missing/invalid date or
// time rather than scheduling for "right now".
export async function scheduleProgramDeployAction(formData: FormData) {
  await requireCoach();
  const programId = Number(formData.get("programId"));
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  if (date && time) {
    const when = new Date(`${date}T${time}:00`);
    if (!Number.isNaN(when.getTime())) {
      scheduleProgramDeploy(programId, when.toISOString());
    }
  }
  revalidatePath("/admin");
}

export async function cancelProgramScheduleAction(formData: FormData) {
  await requireCoach();
  const programId = Number(formData.get("programId"));
  scheduleProgramDeploy(programId, null);
  revalidatePath("/admin");
}

// Only ever offered in the UI for a draft program — deploying moves it out
// of reach of this action entirely, so there's no risk of pulling a program
// out from under a client who's already seen it.
export async function removeProgramAction(formData: FormData) {
  await requireCoach();
  const programId = Number(formData.get("programId"));
  const weekLinkBase = String(formData.get("weekLinkBase") || "/admin");
  removeProgram(programId);
  revalidatePath("/admin");
  redirect(weekLinkBase || "/admin");
}

export async function logSetAction(formData: FormData) {
  const assignmentId = Number(formData.get("assignmentId"));

  // The assignment decides whose data this is; the session decides whether
  // the caller may write it. A client posting someone else's assignment id
  // gets a silent no-op.
  const owner = getClientIdForAssignment(assignmentId);
  if (owner == null || !(await canAccessClient(owner))) return;

  const setNumber = Number(formData.get("setNumber"));
  const weight = formData.get("weight") ? Number(formData.get("weight")) : null;
  const reps = formData.get("reps") ? Number(formData.get("reps")) : null;
  const rpe = formData.get("rpe") ? Number(formData.get("rpe")) : null;

  logSet(assignmentId, setNumber, weight, reps, rpe);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function createClientAction(formData: FormData) {
  await requireCoach();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const client = createClient(name);
  revalidatePath("/admin");
  redirect(`/admin?client=${client.id}`);
}

export async function addInvoiceAction(formData: FormData) {
  await requireCoach();
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
  logCoachActivity(clientId, `Sent a new invoice — "${description}"`, { kind: "general" });
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setInvoiceStatusAction(formData: FormData) {
  await requireCoach();
  const invoiceId = Number(formData.get("invoiceId"));
  const status = String(formData.get("status")) as "unpaid" | "sent" | "paid" | "due";
  setInvoiceStatus(invoiceId, status);
  revalidatePath("/admin");
}

// Logs every field present on the form for one check-in date at once — the
// client's check-in form submits all of the coach's current columns in a
// single action, same pattern as logMetricPeriodAction for the Trackers.
export async function saveMeasurementCheckInAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
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
  await requireCoach();
  const clientId = Number(formData.get("clientId"));
  const date = String(formData.get("date") || "");
  removeMeasurementCheckIn(clientId, date);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function addMeasurementFieldAction(formData: FormData) {
  await requireCoach();
  const clientId = Number(formData.get("clientId"));
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  if (!name) return;
  addMeasurementField(clientId, name, unit);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updateMeasurementFieldAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  if (!name) return;
  updateMeasurementField(id, name, unit);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeMeasurementFieldAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  removeMeasurementField(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function addSkinfoldEntryAction(formData: FormData) {
  await requireCoach();
  const clientId = Number(formData.get("clientId"));
  const date = String(formData.get("date") || "");
  const site = String(formData.get("site") || "");
  if (!date || !site) return;
  const readingRaw = formData.get("readingMm");
  addSkinfoldEntry(clientId, date, site, readingRaw ? Number(readingRaw) : null);
  revalidatePath("/admin");
}

export async function removeSkinfoldEntryAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  removeSkinfoldEntry(id);
  revalidatePath("/admin");
}

export async function addMetricDefinitionAction(formData: FormData) {
  await requireCoach();
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
  await requireCoach();
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
  await requireCoach();
  const id = Number(formData.get("id"));
  removeMetricDefinition(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function togglePinMetricAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  togglePinMetric(id);
  revalidatePath("/admin");
}

export async function togglePinMeasurementFieldAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  togglePinMeasurementField(id);
  revalidatePath("/admin");
}

// ---- Tracker metric templates: coach-level presets applied to a client ----

export async function addMetricTemplateCategoryAction(formData: FormData) {
  await requireCoach();
  const name = String(formData.get("name") || "").trim();
  const frequency = String(formData.get("frequency") || "daily") as "daily" | "weekly";
  if (!name) return;
  addMetricTemplateCategory(name, frequency);
  revalidatePath("/admin");
}

export async function removeMetricTemplateCategoryAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  removeMetricTemplateCategory(id);
  revalidatePath("/admin");
}

export async function addMetricTemplateItemAction(formData: FormData) {
  await requireCoach();
  const templateCategoryId = Number(formData.get("templateCategoryId"));
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  if (!name) return;
  addMetricTemplateItem(templateCategoryId, name, unit);
  revalidatePath("/admin");
}

export async function removeMetricTemplateItemAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  removeMetricTemplateItem(id);
  revalidatePath("/admin");
}

export async function applyMetricTemplateAction(formData: FormData) {
  await requireCoach();
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
  // Ignores the posted client id for clients — they always write their own.
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
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
  await requireCoach();
  const clientId = Number(formData.get("clientId"));
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  addPhotoSlot(clientId, label);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updatePhotoSlotAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  updatePhotoSlot(id, label);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removePhotoSlotAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  removePhotoSlot(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setPhotoCadenceAction(formData: FormData) {
  await requireCoach();
  const clientId = Number(formData.get("clientId"));
  const cadence = String(formData.get("cadence") || "weekly") as "weekly" | "biweekly" | "monthly";
  setPhotoCadence(clientId, cadence);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function savePhotoPeriodNoteAction(formData: FormData) {
  await requireCoach();
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
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const slotId = Number(formData.get("slotId"));

  // Belt and braces: the slot must also belong to that same client, so a
  // photo can't be filed into another client's sheet.
  if (getClientIdForPhotoSlot(slotId) !== clientId) return;

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;
  const buffer = Buffer.from(await file.arrayBuffer());
  savePhotoUpload(clientId, slotId, buffer, file.type || "image/jpeg");
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function saveNutritionPlanAction(formData: FormData) {
  await requireCoach();
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
    name: str("plan_name").trim() || null,
    maintenance_kcal: num("maintenance"),
    ebf: num("ebf"),
    training_day_meals: meals("td"),
    rest_day_meals: meals("rd"),
    vitamins,
    other,
    supplements,
    coach_notes: str("coach_notes"),
  });
  logCoachActivity(clientId, "Updated your nutrition plan", {
    kind: "general",
    actionTab: "nutrition",
    actionLabel: "View nutrition",
  });

  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function saveClientProfileAction(formData: FormData) {
  await requireCoach();
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
    goal_phase_start_date: strOrNull("goal_phase_start_date"),
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
  await requireCoach();
  const clientId = Number(formData.get("clientId"));
  const term = String(formData.get("term") || "short") as "short" | "long";
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  addClientGoal(clientId, term, text);
  revalidatePath("/admin");
}

export async function toggleClientGoalAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  const done = String(formData.get("done")) === "true";
  setClientGoalDone(id, done);
  revalidatePath("/admin");
}

export async function removeClientGoalAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  removeClientGoal(id);
  revalidatePath("/admin");
}

export async function addMeetingAction(formData: FormData) {
  await requireCoach();
  const clientId = Number(formData.get("clientId"));
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const duration = Number(formData.get("durationMinutes")) || undefined;
  const topic = String(formData.get("topic") || "").trim();
  if (!date) return;
  addMeeting(clientId, date, time, topic, duration);
  logCoachActivity(clientId, topic ? `Scheduled a meeting — "${topic}"` : "Scheduled a new meeting", {
    kind: "general",
    actionTab: "home",
    actionLabel: "View schedule",
  });
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setMeetingStatusAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as "scheduled" | "completed" | "canceled";
  setMeetingStatus(id, status);
  revalidatePath("/admin");
}

export async function removeMeetingAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  removeMeeting(id);
  revalidatePath("/admin");
}

export async function addMeetingNoteAction(formData: FormData) {
  await requireCoach();
  const meetingId = Number(formData.get("meetingId"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  addMeetingNote(meetingId, text);
  revalidatePath("/admin");
}

export async function removeMeetingNoteAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  removeMeetingNote(id);
  revalidatePath("/admin");
}

export async function sendChatMessageAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));

  // Who you are is decided by your session, not by a form field. Reading
  // "sender" off the request would let a client post messages that appear
  // to come from their coach.
  const user = await getSessionUser();
  const sender: "client" | "coach" = user?.role === "coach" ? "coach" : "client";

  const text = String(formData.get("text") || "").trim();
  const file = formData.get("file") as File | null;
  if (!clientId) return;

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

// Called straight from the notification row rather than through a form —
// tapping one both marks it read and navigates, and a form that unmounts as
// the view changes is a bad place to be mid-submit.
export async function markNotificationReadAction(id: number) {
  if (!id) return;
  const owner = getClientIdForNotification(id);
  if (owner == null || !(await canAccessClient(owner))) return;
  markNotificationRead(id);
  revalidatePath("/client");
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  if (!clientId) return;
  markAllNotificationsRead(clientId);
  revalidatePath("/client");
}

// ---- Reports ----

export async function createReportTemplateAction(formData: FormData) {
  await requireCoach();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  createReportTemplate(name);
  revalidatePath("/admin");
}

export async function deleteReportTemplateAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  deleteReportTemplate(id);
  revalidatePath("/admin");
}

export async function addReportTemplateSectionAction(formData: FormData) {
  await requireCoach();
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
  await requireCoach();
  const id = Number(formData.get("id"));
  removeReportTemplateSection(id);
  revalidatePath("/admin");
}

// The one action that calls the AI — pulls real data for the period, hands
// it to writeReportNarrative (falls back to a plain templated summary if
// ANTHROPIC_API_KEY isn't set), and stores the result as a new draft.
// Two ways in: pick a saved template (templateId), or skip templates
// entirely and build a one-off section list right here for this client
// (customSections, a JSON array from GenerateReportForm's "Custom" mode) —
// a coach with no templates yet, or a client who just needs one different
// report, isn't blocked on building a template first.
export async function generateReportAction(formData: FormData) {
  await requireCoach();
  const clientId = Number(formData.get("clientId"));
  const periodStart = String(formData.get("periodStart") || "");
  const periodEnd = String(formData.get("periodEnd") || "");
  const client = getClient(clientId);
  if (!clientId || !client || !periodStart || !periodEnd) return;

  const templateIdRaw = formData.get("templateId");
  const templateId = templateIdRaw ? Number(templateIdRaw) : null;
  const customSectionsRaw = String(formData.get("customSections") || "");

  let sectionsToRun: { id: number; template_id: number; type: ReportSectionType; label: string; metric_name: string | null; order_index: number }[] = [];
  let templateName = "Custom";

  if (templateId) {
    const template = getReportTemplate(templateId);
    if (!template) return;
    templateName = template.name;

    // Per-client customization for this one generation: the coach can drop
    // any of the template's sections and/or bolt on one extra tracker metric
    // that isn't in the shared template — without editing the template itself.
    // Checkboxes are checked by default in the UI, so an empty includedIds
    // (e.g. a non-JS form submit) falls back to running every section.
    const includedIds = formData.getAll("sectionId").map(Number);
    const allSections = listReportTemplateSections(templateId);
    sectionsToRun = includedIds.length > 0 ? allSections.filter((s) => includedIds.includes(s.id)) : allSections;

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
  } else if (customSectionsRaw) {
    try {
      const parsed = JSON.parse(customSectionsRaw) as { type: ReportSectionType; label: string; metricName: string | null }[];
      sectionsToRun = parsed.map((s, i) => ({
        id: -1 - i,
        template_id: 0,
        type: s.type,
        label: s.label,
        metric_name: s.metricName || null,
        order_index: i,
      }));
    } catch {
      return;
    }
  }
  if (sectionsToRun.length === 0) return;

  const sectionsData = computeReportSections(clientId, sectionsToRun, periodStart, periodEnd);
  const { summary, aiGenerated } = await writeReportNarrative(client.name, periodStart, periodEnd, sectionsData);
  createDraftReport(clientId, templateId, templateName, periodStart, periodEnd, summary, aiGenerated, sectionsData);
  revalidatePath("/admin");
}

export async function updateReportSummaryAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  const summary = String(formData.get("summary") || "");
  updateReportSummary(id, summary);
  revalidatePath("/admin");
}

export async function approveReportAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  approveReport(id);
  revalidatePath("/admin");
}

export async function sendReportAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  sendReport(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function deleteReportAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  deleteReport(id);
  revalidatePath("/admin");
}

// Coach-side switch for whether a metric/measurement column is deployed to
// the client's check-in screen. History is untouched either way — hiding a
// metric stops it being asked for, it doesn't delete what's already logged.
export async function setMetricVisibleAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  if (!id) return;
  setMetricVisibleToClient(id, formData.get("visible") === "true");
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setMeasurementFieldVisibleAction(formData: FormData) {
  await requireCoach();
  const id = Number(formData.get("id"));
  if (!id) return;
  setMeasurementFieldVisibleToClient(id, formData.get("visible") === "true");
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setClientPreferenceAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const key = String(formData.get("key"));
  if (key !== "coach_notes" && key !== "checkin_reminders" && key !== "weekly_digest") return;
  const value = formData.get("value") === "true";
  setClientPreference(clientId, key, value);
  revalidatePath("/client");
}

export async function setClientUnitsAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const units = String(formData.get("units"));
  if (units !== "metric" && units !== "imperial") return;
  setClientUnits(clientId, units);
  revalidatePath("/client");
}

export async function markReportOpenedAction(id: number) {
  const owner = getClientIdForReport(id);
  if (owner == null || !(await canAccessClient(owner))) return;
  markReportOpened(id);
  revalidatePath("/client");
}
