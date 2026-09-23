"use server";

import { redirect } from "next/navigation";
import { lookupOpenFoodFacts, searchOpenFoodFacts } from "./foods/openfoodfacts";
import { revalidatePath } from "next/cache";
import {
  canAccessClient,
  coachForClient,
  getSessionUser,
  isOwner,
  findUserByEmail,
  createUser,
  requireClientAccess,
  requireCoach,
} from "./auth";
import { sendInviteEmail } from "./mail";
import { parseMessageLink, type MessageLink } from "./messageLinks";
import { headers } from "next/headers";
import {
  clientIdForInvoice,
  clientIdForMeasurementField,
  clientIdForMetricDefinition,
  clientIdForProgramDay,
  clientIdForSkinfold,
  clientIdForTrainingColumn,
  coachOwnsExercise,
  coachOwnsMeeting,
  coachOwnsMetricTemplate,
  coachOwnsMetricTemplateItem,
  coachOwnsReportTemplate,
  coachOwnsReportTemplateSection,
  meetingIdForNote,
} from "./tenancy";
import {
  getClientIdForCardio,
  setCardioDone,
  addClientGoal,
  listClientGoals,
  updateClientGoal,
  reorderClientGoals,
  setClientGoalStart,
  getClientIdForGoal,
  type GoalTracking,
  addCustomTrainingColumn,
  addExercise,
  addExerciseToDay,
  applyDayChanges,
  programLoggedWeekIndexes,
  type DayChanges,
  addExerciseToRemainingWeeks,
  addInvoice,
  addMeasurementField,
  addMeeting,
  updateMeeting,
  completeMeeting,
  getClientIdForMeeting,
  DEFAULT_MEETING_DURATION,
  addMeetingNote,
  addMetricDefinition,
  copyPhaseMetrics,
  deployPhaseNow,
  phaseEmptyReason,
  getPhaseById,
  addMetricTemplateCategory,
  addMetricTemplateItem,
  addPhotoSlot,
  reorderPhotoSlots,
  setPhotoInstructions,
  setPhotoStartDate,
  setPhotoSlotPaused,
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
  removeProgramWeek,
  scheduleProgramDeploy,
  updateProgramTotalWeeks,
  listReportTemplateSections,
  listWeekNumbers,
  listMeasurementFields,
  listMetricDefinitions,
  logCoachActivity,
  markAllNotificationsRead,
  markCoachNotesRead,
  markNotificationRead,
  markReportOpened,
  logSet,
  OTHER_ITEMS,
  removeReportTemplateSection,
  sendReport,
  updateReportSummary,
  removeAssignment,
  removeClient,
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
  getClientProfile,
  saveClientProfile,
  setClientMainGoal,
  patchClientProfile,
  renameClient,
  saveNutritionPlan,
  savePhotoPeriodNote,
  savePhotoUpload,
  saveMealPhoto,
  getMealPhoto,
  removeMealPhoto,
  requestExerciseVideo,
  removeVideoRequest,
  getClientIdForVideoRequest,
  saveRequestedVideo,
  markVideoSeen,
  sendVideoReply,
  removeVideoReply,
  markVideoReplySeen,
  saveDemoVideoUpload,
  setAssignmentCustomValue,
  setClientGoalDone,
  setClientPreference,
  setMeasurementFieldVisibleToClient,
  setMetricVisibleToClient,
  setClientUnits,
  setDayLabel,
  copyProgramWeek,
  setInvoiceStatus,
  setMeasurementValue,
  setMeetingStatus,
  setMetricEntry,
  setMetricCadence,
  saveChatMedia,
  type ChatMedia,
  sendChatMessage,
  setChatReaction,
  editChatMessage,
  deleteChatMessage,
  setChatMessageLink,
  setChatMessagePinned,
  addClientEvent,
  updateClientEvent,
  deleteClientEvent,
  addEventCategory,
  updateEventCategory,
  deleteEventCategory,
  describeMessageLink,
  hasMealComment,
  isSessionComplete,
  removeMealComment,
  editMealComment,
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
  getClientIdForSetLog,
  updateSetLog,
  publishWeek,
  getClientIdForPhotoSlot,
  getClientIdForNotification,
  getClientIdForReport,
  markExerciseNoteRead,
  setExerciseNoteKind,
  setAssignmentDemoUrl,
  setBuiltinColumnVisible,
  setCardioColumnVisible,
  listPrograms,
  getProgramCurrentWeekIndex,
  addSession,
  removeSession,
  setNutritionDayTargets,
  setNutritionNote,
  setNutritionWater,
  addSupplementRow,
  applySupplementChanges,
  type SupplementChanges,
  updateSupplementRow,
  removeSupplementRow,
  addMetricsFromLibraryPhased,
  getNutritionPlan,
  addClientPhase,
  updateClientPhase,
  removeClientPhase,
  setNutritionPhaseDraft,
  schedulePhase,
  unschedulePhase,
  getClientIdForPhase,
  PHASE_TRACKS,
  setCalorieLog,
  setCheckInNote,
  setClientExerciseNote,
  addClientGym,
  removeClientGym,
  getClientIdForGym,
  pickGymForDay,
  setSessionSkipReason,
  startSession,
  endSession,
  setHomeGym,
  markClientEventsSeen,
  setCoachNote,
  setMetricDirection,
  setWarmupSets,
  setClientProgramNote,
  searchFoods,
  addFoodEntry,
  updateFoodEntry,
  removeFoodEntry,
  addCustomFood,
  addFoodMeal,
  removeFoodMeal,
  renameFoodMeal,
  reorderFoodMeals,
  copyFoodMeal,
  copyFoodDay,
  saveDay,
  deleteSavedDay,
  addSavedDay,
  hasFoodMeal,
  getFoodDiary,
  setFoodDayType,
  pushFoodDayToCalorieLog,
  saveMeal,
  deleteSavedMeal,
  addSavedMeal,
  rememberOffProducts,
  getOffFoodByCode,
  localDateStr,
  type FoodDiaryView,
  type FoodMeal,
  type FoodOption,
  getClientIdForProgram,
  reorderAssignments,
  reorderSessions,
  copyProgramDay,
  copyProgramDayToLaterWeeks,
  copyProgramDayToNewSession,
  clearProgramDay,
  findProgramById,
  applyDayOrderToLaterWeeks,
  setExerciseVideoUrl,
  saveLibraryVideoUpload,
  getExerciseIdForAssignment,
  saveClientAvatar,
  removeClientAvatar,
  getCoachProfile,
  getCoachProfileView,
  removeCoachPhoto,
  saveCoachPhoto,
  type CoachPhotoKind,
  saveCoachProfile,
  setCoachProfilePublished,
} from "./queries";
import { writeReportNarrative } from "./reportAi";
import { COACH_PROFILE_LIMITS } from "./coachProfileView";
import { deleteUpload, keyOf, putUpload } from "./storage";
import type { ReportSectionType } from "./reportSectionTypes";

// OWNERSHIP RULE for every coach action below: a coach may only touch their
// own clients (and their own library). Each action works out the client from
// the row it acts on and passes it to coachForClient, which gives back the
// coach or null; on null the action quietly does nothing. See tenancy.ts.

export async function addExerciseAction(formData: FormData) {
  const programDayId = Number(formData.get("programDayId"));
  const exerciseId = Number(formData.get("exerciseId"));
  const coach = await coachForClient(clientIdForProgramDay(programDayId));
  if (!coach || !coachOwnsExercise(coach.id, exerciseId)) return;
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
  // "Also add to the remaining weeks": same prescription, same weekday,
  // every later week of this programme. Opt-in per add, never remembered.
  if (formData.get("applyToRemainingWeeks") === "1") {
    addExerciseToRemainingWeeks(programDayId, exerciseId, sets, reps, targetWeight, rpe, tempo, notes);
  }
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function removeExerciseAction(formData: FormData) {
  const assignmentId = Number(formData.get("assignmentId"));
  if (!(await coachForClient(getClientIdForAssignment(assignmentId)))) return;
  removeAssignment(assignmentId);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// One shared action for every editable target field on an already-added
// assignment (sets/reps/targetWeight/rpe/tempo/notes) — each field's input
// submits itself on blur with only its own name present, so this only ever
// touches the one field that changed.
export async function updateAssignmentAction(formData: FormData) {
  const assignmentId = Number(formData.get("assignmentId"));
  if (!(await coachForClient(getClientIdForAssignment(assignmentId)))) return;
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
  if (formData.has("noteKind")) {
    const raw = String(formData.get("noteKind") || "");
    const kind = raw === "form" || raw === "load" || raw === "tempo" ? raw : null;
    setExerciseNoteKind(assignmentId, kind);
  }
  revalidatePath("/client");
  revalidatePath("/admin");
}

// Returns the new exercise so the picker can select it for the row it was
// added from, without waiting for the refreshed library to come back.
export async function addExerciseToLibraryAction(formData: FormData): Promise<{ id: number; name: string } | null> {
  const coach = await requireCoach();
  const name = String(formData.get("name") || "").trim();
  const muscleGroup = String(formData.get("muscleGroup") || "other");
  const videoUrl = String(formData.get("videoUrl") || "").trim() || null;
  if (!name) return null;
  const exercise = addExercise(coach.id, name, muscleGroup, videoUrl);
  revalidatePath("/admin");
  return { id: exercise.id, name: exercise.name };
}

export async function updateTrainingColumnAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(clientIdForTrainingColumn(id)))) return;
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  updateTrainingColumn(id, label);
  revalidatePath("/admin");
}

export async function setTrainingColumnVisibleAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(clientIdForTrainingColumn(id)))) return;
  const visible = formData.get("visible") === "true";
  setTrainingColumnVisible(id, visible);
  revalidatePath("/admin");
}

export async function addTrainingColumnAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  addCustomTrainingColumn(clientId, label);
  revalidatePath("/admin");
}

export async function removeCustomTrainingColumnAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(clientIdForTrainingColumn(id)))) return;
  removeCustomTrainingColumn(id);
  revalidatePath("/admin");
}

export async function setAssignmentCustomValueAction(formData: FormData) {
  const assignmentId = Number(formData.get("assignmentId"));
  const columnId = Number(formData.get("columnId"));
  const owner = getClientIdForAssignment(assignmentId);
  if (owner !== clientIdForTrainingColumn(columnId) || !(await coachForClient(owner))) return;
  const value = String(formData.get("value") || "");
  setAssignmentCustomValue(assignmentId, columnId, value);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// "Copy week N here" in the builder toolbar — duplicates the previous
// week's plan onto the one being edited so a coach progressing a block
// isn't retyping every session.
export async function copyProgramWeekAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const fromWeek = Number(formData.get("fromWeek"));
  const toWeek = Number(formData.get("toWeek"));
  if (!clientId || !fromWeek || !toWeek) return;
  copyProgramWeek(clientId, fromWeek, toWeek);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function setLabelAction(formData: FormData) {
  const programDayId = Number(formData.get("programDayId"));
  if (!(await coachForClient(clientIdForProgramDay(programDayId)))) return;
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
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const weekLinkBase = String(formData.get("weekLinkBase") || "/admin");
  const existingWeeks = listWeekNumbers(clientId);
  const startWeek = (existingWeeks.length > 0 ? Math.max(...existingWeeks) : 0) + 1;
  createProgram(clientId, "", 1, startWeek);
  revalidatePath("/admin");
  redirect(weekLinkBase || "/admin");
}

/**
 * Appends one week to a programme. Either blank, or a clone of a week that
 * already has a split — the popover offers the last BUILT week rather than
 * the trailing one, so "copy" isn't a no-op right after adding an empty week.
 */
export async function addProgramWeekAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const programId = Number(formData.get("programId"));
  const copyFrom = formData.get("copyFrom") ? Number(formData.get("copyFrom")) : null;

  const program = listPrograms(clientId).find((p) => p.id === programId);
  if (!program) return;

  const newTotal = program.total_weeks + 1;
  // "Blank week" means blank: the copy-from-week-1 seeding is only for
  // lengthening from the Plan tab. The copy option overwrites anyway.
  updateProgramTotalWeeks(programId, newTotal, false);

  const newWeekNumber = program.start_week + newTotal - 1;
  if (copyFrom) copyProgramWeek(clientId, copyFrom, newWeekNumber);
  // A week added to a programme the client already has must go out with
  // it: new days are created as drafts, and the client's Training tab shows
  // published days only, so without this the new week arrived empty.
  if (program.status === "deployed") publishWeek(clientId, newWeekNumber);

  revalidatePath("/admin");
  revalidatePath("/client");
}

// NOTE: there is no updateProgramWeeksAction any more. A programme's length
// used to be a number a coach typed beside its name, which could disagree with
// the weeks actually on the rail; "+ Add week" (addProgramWeekAction above) is
// now the only way to make a programme longer.

export async function renameProgramAction(formData: FormData) {
  const programId = Number(formData.get("programId"));
  if (!(await coachForClient(getClientIdForProgram(programId)))) return;
  const name = String(formData.get("name") || "");
  renameProgram(programId, name);
  revalidatePath("/admin");
}

export async function deployProgramAction(formData: FormData) {
  const programId = Number(formData.get("programId"));
  if (!(await coachForClient(getClientIdForProgram(programId)))) return;
  // The name is what the client sees as their phase, so an unnamed
  // programme can't go out. The button is disabled too; this is the backstop.
  if (!programHasName(programId)) return;
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
  const programId = Number(formData.get("programId"));
  if (!(await coachForClient(getClientIdForProgram(programId)))) return;
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  if (!programHasName(programId)) return;
  if (date && time) {
    const when = new Date(`${date}T${time}:00`);
    if (!Number.isNaN(when.getTime())) {
      scheduleProgramDeploy(programId, when.toISOString());
    }
  }
  revalidatePath("/admin");
}

function programHasName(programId: number): boolean {
  return !!findProgramById(programId)?.name?.trim();
}

export async function cancelProgramScheduleAction(formData: FormData) {
  const programId = Number(formData.get("programId"));
  if (!(await coachForClient(getClientIdForProgram(programId)))) return;
  scheduleProgramDeploy(programId, null);
  revalidatePath("/admin");
}

// Only ever offered in the UI for a draft program — deploying moves it out
// of reach of this action entirely, so there's no risk of pulling a program
// out from under a client who's already seen it.
export async function removeProgramAction(formData: FormData) {
  const programId = Number(formData.get("programId"));
  if (!(await coachForClient(getClientIdForProgram(programId)))) return;
  const weekLinkBase = String(formData.get("weekLinkBase") || "/admin");
  removeProgram(programId);
  revalidatePath("/admin");
  redirect(weekLinkBase || "/admin");
}

// The client's own note on an exercise (machine settings, cues). The
// assignment says which exercise and whose; the note is stored per exercise.
export async function saveExerciseNoteAction(formData: FormData) {
  const assignmentId = Number(formData.get("assignmentId"));
  const owner = getClientIdForAssignment(assignmentId);
  // "My notes" are the client's own and private: only the client writes them,
  // not a coach previewing their app.
  if ((await getSessionUser())?.role !== "client") return;
  if (owner == null || !(await canAccessClient(owner))) return;
  const exerciseId = getExerciseIdForAssignment(assignmentId);
  if (exerciseId == null) return;
  // Notes are per gym; a gym that is not this client's counts as none.
  const gymId = Number(formData.get("gymId")) || null;
  setClientExerciseNote(owner, exerciseId, String(formData.get("text") ?? ""), gymId != null && getClientIdForGym(gymId) === owner ? gymId : null);
  revalidatePath("/client");
}

// The client's note about the whole programme; the programme says whose.
export async function saveProgramNoteAction(formData: FormData) {
  const programId = Number(formData.get("programId"));
  const owner = getClientIdForProgram(programId);
  if (owner == null || !(await canAccessClient(owner))) return;
  setClientProgramNote(owner, programId, String(formData.get("text") ?? ""));
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function logSetAction(formData: FormData) {
  const assignmentId = Number(formData.get("assignmentId"));

  // The assignment decides whose data this is; the session decides whether
  // the caller may write it. A client posting someone else's assignment id
  // gets a silent no-op.
  const owner = getClientIdForAssignment(assignmentId);
  if (owner == null || !(await canAccessClient(owner))) return;

  const setNumber = Number(formData.get("setNumber"));
  // Decimal comma from European keypads is accepted alongside the dot.
  const num = (key: string) => {
    const raw = String(formData.get(key) ?? "").replace(",", ".");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const weight = num("weight");
  const reps = num("reps");
  const rpe = num("rpe");
  // The gym the session is at; one that is not this client's counts as none.
  const gymId = Number(formData.get("gymId")) || null;

  logSet(assignmentId, setNumber, weight, reps, rpe, gymId != null && getClientIdForGym(gymId) === owner ? gymId : null);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// Corrects a set the client already logged. Same ownership rule as logging:
// the set's assignment decides whose data it is, the session decides whether
// the caller may write it.
export async function updateSetAction(formData: FormData) {
  const setLogId = Number(formData.get("setLogId"));
  const owner = getClientIdForSetLog(setLogId);
  if (owner == null || !(await canAccessClient(owner))) return;

  const num = (key: string) => {
    const raw = String(formData.get(key) ?? "").replace(",", ".");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  updateSetLog(setLogId, num("weight"), num("reps"), num("rpe"));
  revalidatePath("/client");
  revalidatePath("/admin");
}

// ---- New client: the member record and their login, made together --------
// The New client dialog's two steps post here once, on its last button.
// Nothing is written before that, so Cancel leaves no trace.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENDERS = new Set(["Male", "Female", "Other"]);

export type NewClientPayload = {
  firstName: string;
  lastName: string;
  birthdate: string;
  gender: string;
  heightCm: string;
  startingWeightKg: string;
  email: string;
  phoneCode: string;
  phone: string;
  address: string;
  password: string;
  invite: boolean;
};

/** Whether an address already signs someone in: checked as the coach leaves the field, not at save. */
export async function checkLoginEmailAction(email: string): Promise<{ taken: boolean }> {
  await requireCoach();
  const e = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { taken: false };
  return { taken: !!findUserByEmail(e) };
}

export async function createClientWithLoginAction(
  p: NewClientPayload
): Promise<{ ok: true; clientId: number; invited: boolean; inviteFailed: boolean } | { ok: false; error: string }> {
  const coach = await requireCoach();
  const s = (v: unknown) => String(v ?? "").trim();
  const num = (v: unknown) => {
    const n = Number(s(v).replace(",", "."));
    return s(v) && Number.isFinite(n) && n > 0 ? n : null;
  };
  const first = s(p?.firstName);
  const last = s(p?.lastName);
  const email = s(p?.email).toLowerCase();
  const password = String(p?.password ?? "");
  if (!first || !last) return { ok: false, error: "A first and a last name are needed." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "That email doesn't look right." };
  if (password.length < 8) return { ok: false, error: "The password needs at least 8 characters." };
  if (findUserByEmail(email)) return { ok: false, error: "That email already has an account." };

  // The record, then the login. If the login cannot be made, the record goes
  // too: a client with no way in, that the coach did not ask for, is worse
  // than trying again.
  const client = createClient(`${first} ${last}`, coach.id);
  try {
    createUser(email, password, "client", client.id, true);
  } catch (error) {
    removeClient(client.id);
    return { ok: false, error: error instanceof Error ? error.message : "The login could not be made." };
  }
  const birthdate = s(p.birthdate);
  const phoneCode = s(p.phoneCode);
  patchClientProfile(client.id, {
    birthdate: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(birthdate) ? birthdate : null,
    gender: GENDERS.has(s(p.gender)) ? s(p.gender) : null,
    height_cm: num(p.heightCm),
    starting_weight_kg: num(p.startingWeightKg),
    email,
    // The dial code and the national number are kept apart, and joined only
    // for show, so a country is never guessed back out of a typed string.
    phone_code: /^\+[0-9]{1,4}$/.test(phoneCode) ? phoneCode : null,
    phone: s(p.phone) || null,
    address: s(p.address) || null,
  });
  revalidatePath("/admin");

  if (!p.invite) return { ok: true, clientId: client.id, invited: false, inviteFailed: false };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const invited = await sendInviteEmail({
    to: email,
    firstName: first,
    coachName: getCoachProfile(coach.id)?.display_name || "Your coach",
    password,
    signInUrl: `${proto}://${host}/login`,
  });
  return { ok: true, clientId: client.id, invited, inviteFailed: !invited };
}

export async function addInvoiceAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const status = String(formData.get("status") || "unpaid") as
    | "unpaid"
    | "sent"
    | "paid"
    | "due";
  if (!description) return;
  addInvoice(clientId, description, amount, status);
  logCoachActivity(clientId, `Sent a new invoice: "${description}"`, { kind: "general" });
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setInvoiceStatusAction(formData: FormData) {
  const invoiceId = Number(formData.get("invoiceId"));
  if (!(await coachForClient(clientIdForInvoice(invoiceId)))) return;
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
  const loggedAt = new Date().toISOString();
  fields.forEach((field) => {
    const raw = formData.get(`field_${field.id}`);
    if (raw === null || raw === "") return;
    // Phones on European locales type the decimal comma.
    const value = Number(String(raw).replace(",", "."));
    setMeasurementValue(field.id, date, Number.isFinite(value) ? value : null, loggedAt);
  });
  if (formData.has("note")) setCheckInNote(clientId, "measurements", date, String(formData.get("note") ?? "").slice(0, 500));

  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeMeasurementCheckInAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const date = String(formData.get("date") || "");
  removeMeasurementCheckIn(clientId, date);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function addMeasurementFieldAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  if (!name) return;
  addMeasurementField(clientId, name, unit);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updateMeasurementFieldAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(clientIdForMeasurementField(id)))) return;
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  if (!name) return;
  updateMeasurementField(id, name, unit);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeMeasurementFieldAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(clientIdForMeasurementField(id)))) return;
  removeMeasurementField(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function addSkinfoldEntryAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const date = String(formData.get("date") || "");
  const site = String(formData.get("site") || "");
  if (!date || !site) return;
  const readingRaw = formData.get("readingMm");
  addSkinfoldEntry(clientId, date, site, readingRaw ? Number(readingRaw) : null);
  revalidatePath("/admin");
}

export async function removeSkinfoldEntryAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(clientIdForSkinfold(id)))) return;
  removeSkinfoldEntry(id);
  revalidatePath("/admin");
}

/**
 * Commits every ticked library item in one go. The picks arrive as a single
 * JSON field rather than a checkbox per item, because the dropdown is a
 * client component holding its own selection and one submit is one write.
 */
export async function addMetricsFromLibraryAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  let picks: { name: string; unit: string; group: string; cadence: "daily" | "weekly" | "monthly" }[] = [];
  try {
    picks = JSON.parse(String(formData.get("picks") || "[]"));
  } catch {
    return;
  }
  if (!Array.isArray(picks) || picks.length === 0) return;
  const rawPhase = String(formData.get("phaseId") ?? "");
  addMetricsFromLibraryPhased(clientId, picks, /^\d+$/.test(rawPhase) ? Number(rawPhase) : null);
  revalidatePath("/admin");
  revalidatePath("/client");
}

/**
 * The tracked-metrics draft, applied in one go (MetricsPending): removals,
 * daily / weekly switches, then what was added. True when it landed.
 */
export async function applyMetricChangesAction(input: {
  clientId: number;
  phaseId: number | null;
  adds: { name: string; unit: string; group: string; cadence: "daily" | "weekly"; source: "library" | "custom" }[];
  removes: number[];
  cadence: { id: number; value: "daily" | "weekly" }[];
}): Promise<boolean> {
  const clientId = Number(input?.clientId);
  if (!clientId || !(await coachForClient(clientId))) return false;
  const phaseId = input.phaseId == null ? null : Number(input.phaseId);
  // Only this client's metrics: the ids come from the page.
  const mine = (id: number) => Number.isInteger(id) && clientIdForMetricDefinition(id) === clientId;
  for (const id of Array.isArray(input.removes) ? input.removes : []) if (mine(id)) removeMetricDefinition(id);
  for (const c of Array.isArray(input.cadence) ? input.cadence : []) {
    if (mine(c.id) && (c.value === "daily" || c.value === "weekly")) setMetricCadence(c.id, c.value);
  }
  const adds = (Array.isArray(input.adds) ? input.adds : [])
    .map((a) => ({ name: String(a.name ?? "").trim().slice(0, 60), unit: String(a.unit ?? "").trim().slice(0, 20), group: String(a.group ?? "other"), cadence: a.cadence === "weekly" ? ("weekly" as const) : ("daily" as const), source: a.source }))
    .filter((a) => a.name);
  const library = adds.filter((a) => a.source === "library");
  if (library.length) addMetricsFromLibraryPhased(clientId, library.map(({ name, unit, group, cadence }) => ({ name, unit, group, cadence })), phaseId);
  for (const a of adds.filter((x) => x.source !== "library")) addMetricDefinition(clientId, a.group, a.name, a.unit, a.cadence, phaseId);
  revalidatePath("/admin");
  revalidatePath("/client");
  return true;
}

export async function addMetricDefinitionAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const category = String(formData.get("category") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  const frequency = String(formData.get("frequency") || "daily") as "daily" | "weekly" | "monthly";
  if (!name) return;
  // Set up inside a phase: that phase is what asks for it.
  const rawPhase = String(formData.get("phaseId") ?? "");
  addMetricDefinition(clientId, category, name, unit, frequency, /^\d+$/.test(rawPhase) ? Number(rawPhase) : null);
  revalidatePath("/admin");
  revalidatePath("/client");
}

/** Start a phase from what another one asks for, rather than from nothing. */
export async function copyPhaseMetricsAction(clientId: number, fromPhaseId: number | null, toPhaseId: number, fromIsLive: boolean) {
  if (!(await coachForClient(Number(clientId)))) return;
  copyPhaseMetrics(fromPhaseId == null ? null : Number(fromPhaseId), Number(toPhaseId), Number(clientId), !!fromIsLive);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updateMetricDefinitionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(clientIdForMetricDefinition(id)))) return;
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
  if (!(await coachForClient(clientIdForMetricDefinition(id)))) return;
  removeMetricDefinition(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function togglePinMetricAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(clientIdForMetricDefinition(id)))) return;
  togglePinMetric(id);
  revalidatePath("/admin");
}

export async function togglePinMeasurementFieldAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(clientIdForMeasurementField(id)))) return;
  togglePinMeasurementField(id);
  revalidatePath("/admin");
}

// ---- Tracker metric templates: coach-level presets applied to a client ----

export async function addMetricTemplateCategoryAction(formData: FormData) {
  const coach = await requireCoach();
  const name = String(formData.get("name") || "").trim();
  // Templates predate monthly and only carry the two original cadences.
  const frequency = String(formData.get("frequency") || "daily") as "daily" | "weekly";
  if (!name) return;
  addMetricTemplateCategory(coach.id, name, frequency);
  revalidatePath("/admin");
}

export async function removeMetricTemplateCategoryAction(formData: FormData) {
  const coach = await requireCoach();
  const id = Number(formData.get("id"));
  if (!coachOwnsMetricTemplate(coach.id, id)) return;
  removeMetricTemplateCategory(id);
  revalidatePath("/admin");
}

export async function addMetricTemplateItemAction(formData: FormData) {
  const coach = await requireCoach();
  const templateCategoryId = Number(formData.get("templateCategoryId"));
  if (!coachOwnsMetricTemplate(coach.id, templateCategoryId)) return;
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  if (!name) return;
  addMetricTemplateItem(templateCategoryId, name, unit);
  revalidatePath("/admin");
}

export async function removeMetricTemplateItemAction(formData: FormData) {
  const coach = await requireCoach();
  const id = Number(formData.get("id"));
  if (!coachOwnsMetricTemplateItem(coach.id, id)) return;
  removeMetricTemplateItem(id);
  revalidatePath("/admin");
}

export async function applyMetricTemplateAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const templateCategoryId = Number(formData.get("templateCategoryId"));
  const coach = await coachForClient(clientId);
  if (!coach || !coachOwnsMetricTemplate(coach.id, templateCategoryId)) return;
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
  const frequency = String(formData.get("frequency") || "daily") as "daily" | "weekly" | "monthly";
  const dateRaw = String(formData.get("date") || "");
  if (!dateRaw) return;
  const period = frequency === "weekly" ? weekStart(dateRaw) : dateRaw;

  const definitions = listMetricDefinitions(clientId, frequency);
  const loggedAt = new Date().toISOString();
  definitions.forEach((def) => {
    const raw = formData.get(`metric_${def.id}`);
    if (raw === null || raw === "") return;
    // Phones on European locales type the decimal comma.
    const value = Number(String(raw).replace(",", "."));
    setMetricEntry(def.id, period, Number.isFinite(value) ? value : null, loggedAt);
  });
  if (formData.has("note") && (frequency === "daily" || frequency === "weekly")) {
    setCheckInNote(clientId, frequency, period, String(formData.get("note") ?? "").slice(0, 500));
  }

  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function addPhotoSlotAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  addPhotoSlot(clientId, label);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updatePhotoSlotAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(getClientIdForPhotoSlot(id)))) return;
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  updatePhotoSlot(id, label);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removePhotoSlotAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(getClientIdForPhotoSlot(id)))) return;
  removePhotoSlot(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setPhotoCadenceAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const raw = String(formData.get("cadence") || "weekly");
  const cadence = (["weekly", "biweekly", "monthly", "sixweekly"] as const).find((c) => c === raw);
  if (!cadence) return;
  setPhotoCadence(clientId, cadence);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setPhotoSlotPausedAction(id: number, paused: boolean) {
  if (!Number.isInteger(id) || !(await coachForClient(getClientIdForPhotoSlot(id)))) return;
  setPhotoSlotPaused(id, paused === true);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function reorderPhotoSlotsAction(clientId: number, orderedIds: number[]) {
  if (!Number.isInteger(clientId) || !Array.isArray(orderedIds) || !(await coachForClient(clientId))) return;
  reorderPhotoSlots(clientId, orderedIds.map(Number).filter((n) => Number.isInteger(n)));
  revalidatePath("/admin");
  revalidatePath("/client");
}

// The photo sheet schedule in one save, when the coach presses Save: the day
// the first sheet opens (empty goes back to calendar buckets), how often a
// new one opens, and the note on how to take the pictures.
export async function savePhotoScheduleAction(
  clientId: number,
  schedule: { startDate: string; cadence: string; instructions: string }
) {
  if (!Number.isInteger(clientId) || !schedule || !(await coachForClient(clientId))) return;
  const cadence = (["weekly", "biweekly", "monthly", "sixweekly"] as const).find((c) => c === schedule.cadence);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(schedule.startDate) ? schedule.startDate : null;
  if (!cadence || (schedule.startDate && !startDate)) return;
  setPhotoCadence(clientId, cadence);
  setPhotoStartDate(clientId, startDate);
  setPhotoInstructions(clientId, String(schedule.instructions ?? "").slice(0, 600));
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function savePhotoPeriodNoteAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const period = String(formData.get("period") || "");
  if (!period) return;
  savePhotoPeriodNote({
    client_id: clientId,
    period,
    shape: String(formData.get("shape") || ""),
    strengths: String(formData.get("strengths") || ""),
    improvements: String(formData.get("improvements") || ""),
    next_steps: String(formData.get("next_steps") || ""),
    saved_at: new Date().toISOString(),
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
  // Saved to the disk, then copied into the storage bucket when it is on.
  await putUpload(savePhotoUpload(clientId, slotId, buffer, file.type || "image/jpeg"), buffer, file.type);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function uploadMealPhotoAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const date = String(formData.get("date") ?? "");
  const meal = String(formData.get("meal") ?? "");
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || !meal) return;

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;
  const buffer = Buffer.from(await file.arrayBuffer());
  const previous = getMealPhoto(clientId, date, meal);
  // Saved to the disk, then copied into the storage bucket when it is on.
  const saved = saveMealPhoto(clientId, date, meal, buffer, file.type || "image/jpeg");
  if (previous && keyOf(previous) !== keyOf(saved)) await deleteUpload(previous);
  await putUpload(saved, buffer, file.type);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// ---- Video requests ----------------------------------------------------------

// The coach asks for a video of one exercise in one session (or changes what
// they asked for). Called directly from the builder's dialog.
export async function requestExerciseVideoAction(assignmentId: number, note: string) {
  const id = Number(assignmentId);
  if (!Number.isInteger(id) || !(await coachForClient(getClientIdForAssignment(id)))) return;
  requestExerciseVideo(id, String(note ?? ""));
  revalidatePath("/admin");
  revalidatePath("/client");
}

// Takes a request back, and the video with it if one came.
export async function removeVideoRequestAction(id: number) {
  if (!Number.isInteger(id) || !(await coachForClient(getClientIdForVideoRequest(id)))) return;
  for (const file of removeVideoRequest(id)) await deleteUpload(file);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// The coach's reply goes out (its video, if any, was uploaded first through
// /api/video-reply): the comment is saved and the client is notified.
export async function sendVideoReplyAction(id: number, note: string): Promise<boolean> {
  if (!Number.isInteger(id) || !(await coachForClient(getClientIdForVideoRequest(id)))) return false;
  const ok = sendVideoReply(id, String(note ?? ""));
  revalidatePath("/admin");
  revalidatePath("/client");
  return ok;
}

export async function removeVideoReplyAction(id: number) {
  if (!Number.isInteger(id) || !(await coachForClient(getClientIdForVideoRequest(id)))) return;
  const file = removeVideoReply(id);
  if (file) await deleteUpload(file);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// The client opened their coach's reply.
export async function markVideoReplySeenAction(id: number) {
  const owner = getClientIdForVideoRequest(Number(id));
  if (owner == null) return;
  await requireClientAccess(owner);
  markVideoReplySeen(Number(id));
  revalidatePath("/client");
}

export async function markVideoSeenAction(id: number) {
  if (!Number.isInteger(id) || !(await coachForClient(getClientIdForVideoRequest(id)))) return;
  markVideoSeen(id);
  revalidatePath("/admin");
}

// The client's video for a request: 128 MB, two minutes (next.config.ts's
// body limits are sized for it); the phone checks length and size
// first and says so, this is the backstop. Returns an error to show, or null.
const MAX_REQUESTED_VIDEO_BYTES = 128 * 1024 * 1024;
export async function uploadRequestedVideoAction(formData: FormData): Promise<string | null> {
  const id = Number(formData.get("requestId"));
  const owner = getClientIdForVideoRequest(id);
  if (owner == null) return "That request is gone.";
  await requireClientAccess(owner);
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return "Choose a video first.";
  if (!file.type.startsWith("video/")) return "That doesn't look like a video.";
  if (file.size > MAX_REQUESTED_VIDEO_BYTES) return `That video is ${Math.round(file.size / 1024 / 1024)} MB. The limit is 128 MB: film in 1080p and keep it under two minutes.`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = saveRequestedVideo(id, buffer, file.type);
  if (!saved) return "That request is gone.";
  if (saved.previous) await deleteUpload(saved.previous);
  await putUpload(saved.path, buffer, file.type);
  revalidatePath("/admin");
  revalidatePath("/client");
  return null;
}

export async function removeMealPhotoAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const date = String(formData.get("date") ?? "");
  const meal = String(formData.get("meal") ?? "");
  if (!date || !meal) return;
  const was = removeMealPhoto(clientId, date, meal);
  if (was) await deleteUpload(was);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function saveNutritionTargetsAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const num = (k: string) => {
    const raw = String(formData.get(k) ?? "").trim();
    return raw === "" ? null : Number(raw);
  };
  const phaseRaw = Number(formData.get("phaseId"));
  const phaseId = Number.isInteger(phaseRaw) && phaseRaw > 0 ? phaseRaw : null;
  setNutritionDayTargets(
    clientId,
    { protein: num("t_protein"), carbs: num("t_carbs"), fats: num("t_fats") },
    { protein: num("r_protein"), carbs: num("r_carbs"), fats: num("r_fats") },
    phaseId
  );
  // Water rides along on the same form — it's one row inside the same card,
  // and a second Save button for a single number would be silly.
  if (formData.has("water")) setNutritionWater(clientId, num("water"));
  logCoachActivity(clientId, "Updated your nutrition targets", { kind: "general", actionTab: "nutrition", actionLabel: "See your targets" });
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function saveWaterGoalAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const raw = String(formData.get("water") ?? "").trim();
  setNutritionWater(clientId, raw === "" ? null : Number(raw));
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function applySupplementChangesAction(clientId: number, changes: SupplementChanges) {
  if (!(await coachForClient(clientId))) return;
  applySupplementChanges(clientId, changes);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function addSupplementRowAction(formData: FormData) {
  if (!(await coachForClient(Number(formData.get("clientId"))))) return;
  // The name typed in the footer box starts the row off; an empty box still
  // adds a blank row, which is how "+ Add item" in the band works.
  addSupplementRow(Number(formData.get("clientId")), String(formData.get("name") ?? ""));
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updateSupplementRowAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const rowId = Number(formData.get("rowId"));
  const field = String(formData.get("field") || "");
  if (field !== "name" && field !== "quantity" && field !== "timing" && field !== "notes") return;
  updateSupplementRow(clientId, rowId, field, String(formData.get("value") ?? ""));
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeSupplementRowAction(formData: FormData) {
  if (!(await coachForClient(Number(formData.get("clientId"))))) return;
  removeSupplementRow(Number(formData.get("clientId")), Number(formData.get("rowId")));
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function saveCoachNutritionNoteAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const phaseRaw = Number(formData.get("phaseId"));
  setNutritionNote(clientId, String(formData.get("note") ?? ""), Number.isInteger(phaseRaw) && phaseRaw > 0 ? phaseRaw : null);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function saveNutritionPlanAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;

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

// One-field save from the Measurements tab: the weekday the weekly check-in
// opens. Same profile column the full card edit writes, so no second source.
export async function setCheckInDayAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const day = String(formData.get("check_in_day") ?? "").trim();
  if (!(await coachForClient(clientId))) return;
  saveClientProfile({ ...getClientProfile(clientId), check_in_day: day || null });
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function saveClientProfileAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
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

// Main goal: one sentence under the client's name on Home. Written from
// the Plan tab; the card's own save leaves it alone.
export async function setClientMainGoalAction(clientId: number, text: string) {
  if (!(await coachForClient(clientId))) return;
  setClientMainGoal(clientId, text);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// The right-hand client card, saved in place.
//
// Distinct from saveClientProfileAction on purpose. That one renders every
// profile field and replaces the whole row; this form shows the subset a coach
// corrects after onboarding (a changed email, a new phase date), so it patches
// and leaves everything it doesn't show alone.
//
// Plan, current week and current weight are NOT here. They're derived from the
// live programme and the client's own logged weight — a typed-over copy would
// just be a second, wrong answer to the same question.
export async function saveClientCardAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;

  const str = (name: string) => String(formData.get(name) ?? "").trim();
  const strOrNull = (name: string) => str(name) || null;
  const numOrNull = (name: string) => {
    const raw = str(name);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  // An empty name would leave a nameless row in the client list with no way
  // back to it, so a blank one keeps the name it has.
  const name = str("name");
  if (name) renameClient(clientId, name);

  patchClientProfile(clientId, {
    birthdate: strOrNull("birthdate"),
    gender: strOrNull("gender"),
    height_cm: numOrNull("height_cm"),
    email: strOrNull("email"),
    phone_code: /^\+[0-9]{1,4}$/.test(str("phone_code")) ? str("phone_code") : null,
    phone: strOrNull("phone"),
    address: strOrNull("address"),
    coaching_start_date: strOrNull("coaching_start_date"),
    goal_phase: str("goal_phase"),
    goal_date: strOrNull("goal_date"),
    check_in_day: strOrNull("check_in_day"),
    starting_weight_kg: numOrNull("starting_weight_kg"),
  });

  revalidatePath("/admin");
}

export async function addClientGoalAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const coach = await coachForClient(clientId);
  if (!coach) return;
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  const meetingRaw = Number(formData.get("meetingId"));
  // The meeting a goal was set in must be one of this client's.
  const meetingId = Number.isInteger(meetingRaw) && meetingRaw > 0 && getClientIdForMeeting(meetingRaw) === clientId ? meetingRaw : null;
  addClientGoal(clientId, text, trackingFor(clientId, coach.id, parseGoalTracking(formData.get("tracking"))), meetingId);
  const startRaw = String(formData.get("start") ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(startRaw)) {
    const mine = listClientGoals(clientId);
    const newest = mine[mine.length - 1];
    if (newest) setClientGoalStart(newest.id, startRaw);
  }
  revalidatePath("/admin");
  revalidatePath("/client");
}

// The tracking arrives as JSON from the goal editor; anything malformed
// becomes "text only" rather than a half-tracked goal.
function parseGoalTracking(raw: FormDataEntryValue | null): GoalTracking | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(String(raw));
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const op = (v: unknown) => (v === "<=" || v === ">=" ? v : null);
    if (t?.kind === "metric") {
      const target = num(t.target);
      const o = op(t.op);
      if (typeof t.metricKey !== "string" || target == null || !o || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.byDate))) return null;
      return { kind: "metric", metricKey: t.metricKey, op: o, target, byDate: String(t.byDate) };
    }
    if (t?.kind === "exercise") {
      const exerciseId = num(t.exerciseId);
      const weight = num(t.weight);
      const reps = num(t.reps);
      if (exerciseId == null || weight == null || reps == null) return null;
      return { kind: "exercise", exerciseId, weight, reps, maxRpe: num(t.maxRpe), gymId: num(t.gymId) };
    }
    if (t?.kind === "habit") {
      const metricId = num(t.metricId);
      const value = num(t.value);
      const days = num(t.daysPerWeek);
      const o = op(t.op);
      if (metricId == null || value == null || days == null || !o) return null;
      return { kind: "habit", metricId, op: o, value, daysPerWeek: Math.max(1, Math.min(7, Math.round(days))) };
    }
  } catch {
    /* fall through */
  }
  return null;
}

// A tracked goal may only measure this client's own metrics and the coach's
// own exercises; anything else becomes a plain sentence rather than reading
// another client's numbers into this one's goal.
function trackingFor(clientId: number, coachId: number, tracking: GoalTracking | null): GoalTracking | null {
  if (!tracking) return null;
  if (tracking.kind === "exercise") {
    if (!coachOwnsExercise(coachId, tracking.exerciseId)) return null;
    // A gym that is not this client's counts as the home gym.
    const gymId = tracking.gymId != null && getClientIdForGym(tracking.gymId) === clientId ? tracking.gymId : null;
    return { ...tracking, gymId };
  }
  if (tracking.kind === "habit") return clientIdForMetricDefinition(tracking.metricId) === clientId ? tracking : null;
  const ref = /^(field|metric)-(\d+)$/.exec(tracking.metricKey);
  if (ref) {
    const owner = ref[1] === "field" ? clientIdForMeasurementField(Number(ref[2])) : clientIdForMetricDefinition(Number(ref[2]));
    if (owner !== clientId) return null;
  }
  return tracking;
}

// Called from a drag in the goals list, with no form.
export async function reorderClientGoalsAction(clientId: number, orderedIds: number[]) {
  if (!Number.isInteger(clientId) || !Array.isArray(orderedIds) || !(await coachForClient(clientId))) return;
  reorderClientGoals(clientId, orderedIds.filter((id) => Number.isInteger(id)));
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updateClientGoalAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const text = String(formData.get("text") || "").trim();
  const clientId = getClientIdForGoal(id);
  const coach = await coachForClient(clientId);
  if (!id || !text || clientId == null || !coach) return;
  updateClientGoal(id, text, trackingFor(clientId, coach.id, parseGoalTracking(formData.get("tracking"))));
  const startRaw = String(formData.get("start") ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(startRaw)) setClientGoalStart(id, startRaw);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function toggleClientGoalAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(getClientIdForGoal(id)))) return;
  const done = String(formData.get("done")) === "true";
  setClientGoalDone(id, done);
  revalidatePath("/admin");
}

// The Plan tab queues done-ticks on a pending bar and applies them together.
export async function applyGoalDoneChangesAction(changes: { id: number; done: boolean }[]) {
  const coach = await requireCoach();
  if (!Array.isArray(changes)) return;
  for (const c of changes) {
    if (!Number.isInteger(c?.id) || typeof c.done !== "boolean") continue;
    if (await coachForClient(getClientIdForGoal(c.id))) setClientGoalDone(c.id, c.done);
  }
  void coach;
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeClientGoalAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(getClientIdForGoal(id)))) return;
  removeClientGoal(id);
  revalidatePath("/admin");
}

export async function addMeetingAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const duration = Number(formData.get("durationMinutes")) || undefined;
  const topic = String(formData.get("topic") || "").trim();
  const link = String(formData.get("link") || "").trim();
  if (!date) return;
  addMeeting(clientId, date, time, topic, duration, link || null);
  logCoachActivity(clientId, topic ? `Scheduled a meeting: "${topic}"` : "Scheduled a new meeting", {
    kind: "general",
    actionTab: "home",
    actionLabel: "View schedule",
  });
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setMeetingStatusAction(formData: FormData) {
  const coach = await requireCoach();
  const id = Number(formData.get("id"));
  if (!coachOwnsMeeting(coach.id, id)) return;
  const raw = String(formData.get("status"));
  const status = raw === "completed" || raw === "no-show" || raw === "cancelled" ? raw : "scheduled";
  setMeetingStatus(id, status);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// Autosaves from the Meetings tab (topic, link, prep notes) and a
// reschedule (date, time, duration): only the fields present are written.
export async function updateMeetingAction(formData: FormData) {
  const coach = await requireCoach();
  const id = Number(formData.get("id"));
  if (!id || getClientIdForMeeting(id) == null || !coachOwnsMeeting(coach.id, id)) return;
  const patch: Parameters<typeof updateMeeting>[1] = {};
  if (formData.has("topic")) patch.topic = String(formData.get("topic") ?? "").trim();
  if (formData.has("link")) patch.link = String(formData.get("link") ?? "").trim() || null;
  if (formData.has("prepNotes")) patch.prep_notes = String(formData.get("prepNotes") ?? "");
  if (formData.has("summary")) patch.summary = String(formData.get("summary") ?? "").trim() || null;
  if (formData.has("date")) {
    const date = String(formData.get("date") ?? "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) patch.date = date;
  }
  if (formData.has("time")) patch.time = String(formData.get("time") ?? "");
  if (formData.has("durationMinutes")) patch.duration_minutes = Number(formData.get("durationMinutes")) || DEFAULT_MEETING_DURATION;
  updateMeeting(id, patch);
  // A moved call is news to the client; a reworded topic or the coach's own notes are not.
  if (patch.date || patch.time) {
    const clientId = getClientIdForMeeting(id);
    const when = patch.date ? new Date(`${patch.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }) : "the same day";
    if (clientId != null) logCoachActivity(clientId, `Your call moved to ${when}${patch.time ? ` at ${patch.time}` : ""}`, { kind: "general", actionTab: "home", actionLabel: "View schedule" });
  }
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function completeMeetingAction(formData: FormData) {
  const coach = await requireCoach();
  const id = Number(formData.get("id"));
  if (!id || !coachOwnsMeeting(coach.id, id)) return;
  // Closing the call is the moment the coach remembers what was agreed, so
  // the recap is written here. It reaches the client's Home; the prep notes
  // and the notes log stay on the coach's side.
  const summary = formData.has("summary") ? String(formData.get("summary") ?? "").trim() : "";
  if (formData.has("summary")) {
    updateMeeting(id, { summary: summary || null });
  }
  completeMeeting(id);
  // The recap is what the client takes away: tell them it is there.
  if (summary) {
    const clientId = getClientIdForMeeting(id);
    if (clientId != null) logCoachActivity(clientId, "Your coach wrote up what you agreed on the call", { kind: "general", actionTab: "home", actionLabel: "Read it" });
  }
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeMeetingAction(formData: FormData) {
  const coach = await requireCoach();
  const id = Number(formData.get("id"));
  if (!coachOwnsMeeting(coach.id, id)) return;
  removeMeeting(id);
  revalidatePath("/admin");
}

export async function addMeetingNoteAction(formData: FormData) {
  const coach = await requireCoach();
  const meetingId = Number(formData.get("meetingId"));
  if (!coachOwnsMeeting(coach.id, meetingId)) return;
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  addMeetingNote(meetingId, text);
  revalidatePath("/admin");
}

export async function removeMeetingNoteAction(formData: FormData) {
  const coach = await requireCoach();
  const id = Number(formData.get("id"));
  const meetingId = meetingIdForNote(id);
  if (meetingId == null || !coachOwnsMeeting(coach.id, meetingId)) return;
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

  let media: ChatMedia | undefined;
  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    media = saveChatMedia(clientId, buffer, file.type || "application/octet-stream", file.name);
    await putUpload(media.path, buffer, file.type || undefined);
  }
  if (!text && !media) return;

  // A link only from the coach, only one that parses, and only one the
  // client can actually open.
  let link: MessageLink | null = null;
  if (sender === "coach") {
    try {
      link = parseMessageLink(JSON.parse(String(formData.get("link") || "null")));
    } catch {
      link = null;
    }
    if (link && describeMessageLink(clientId, link).gone) link = null;
    // A meal takes one comment: a second send (two tabs, a double click) is dropped.
    if (link?.kind === "food" && link.meal && hasMealComment(clientId, link.date, link.meal)) return;
  }

  sendChatMessage(clientId, sender, text, media, link);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// A thumbs up on a message, from either side. Which side is decided by the
// session, never by the caller; null takes the reaction off again.
export async function reactToMessageAction(clientId: number, messageId: number, emoji: string | null) {
  const id = await requireClientAccess(Number(clientId));
  if (!id) return;
  const user = await getSessionUser();
  setChatReaction(id, Number(messageId), user?.role === "coach" ? "coach" : "client", emoji);
  revalidatePath("/admin");
  revalidatePath("/client");
}

/**
 * A programme with a name and a length in one step, and, when a start is
 * given, the training phase on the plan that carries its dates. Answers with
 * the programme's id. Starts as a draft: only the coach sees it.
 */
export async function createProgramWithAction(clientId: number, name: string, weeks: number, startDate: string | null): Promise<number | null> {
  if (!(await coachForClient(Number(clientId)))) return null;
  const n = Math.max(1, Math.min(52, Math.round(Number(weeks) || 1)));
  const existingWeeks = listWeekNumbers(Number(clientId));
  const startWeek = (existingWeeks.length > 0 ? Math.max(...existingWeeks) : 0) + 1;
  const program = createProgram(Number(clientId), String(name ?? "").trim(), n, startWeek);
  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const end = new Date(`${startDate}T00:00:00`);
    end.setDate(end.getDate() + (n - 1) * 7);
    addClientPhase(Number(clientId), "training", String(name ?? "").trim() || "Programme", startDate, end.toISOString().slice(0, 10), program.id);
  }
  revalidatePath("/admin");
  return program.id;
}

// ---- Events on the plan, and the coach's own categories for them.
export type EventInput = { kind?: string | null; title: string; start: string; end?: string | null; note?: string | null };

export async function addClientEventAction(clientId: number, v: EventInput) {
  if (!(await coachForClient(Number(clientId)))) return null;
  const row = addClientEvent(Number(clientId), v);
  revalidatePath("/admin");
  return row?.id ?? null;
}

export async function updateClientEventAction(clientId: number, eventId: number, v: EventInput) {
  if (!(await coachForClient(Number(clientId)))) return;
  updateClientEvent(Number(clientId), Number(eventId), v);
  revalidatePath("/admin");
}

export async function deleteClientEventAction(clientId: number, eventId: number) {
  if (!(await coachForClient(Number(clientId)))) return;
  deleteClientEvent(Number(clientId), Number(eventId));
  revalidatePath("/admin");
}

/** A category of the coach's own; answers with its id as the events store it ("c12"). */
export async function addEventCategoryAction(label: string, color: string) {
  const coach = await requireCoach();
  const row = addEventCategory(coach.id, String(label ?? ""), String(color ?? ""));
  revalidatePath("/admin");
  return row ? `c${row.id}` : null;
}

export async function updateEventCategoryAction(id: string, label: string, color: string) {
  const coach = await requireCoach();
  updateEventCategory(coach.id, Number(String(id).replace(/^c/, "")), String(label ?? ""), String(color ?? ""));
  revalidatePath("/admin");
}

export async function deleteEventCategoryAction(id: string) {
  const coach = await requireCoach();
  deleteEventCategory(coach.id, Number(String(id).replace(/^c/, "")));
  revalidatePath("/admin");
}

// ---- The coach's own messages, after sending: reword, re-point, pin, take back.
// All coach-only; the client's side of the chat is theirs to keep.
async function coachOn(clientId: number) {
  const id = await requireClientAccess(Number(clientId));
  const user = await getSessionUser();
  return id && user?.role === "coach" ? id : null;
}
const bothSides = () => {
  revalidatePath("/admin");
  revalidatePath("/client");
};

export async function editChatMessageAction(clientId: number, messageId: number, text: string) {
  const id = await coachOn(clientId);
  if (!id) return;
  editChatMessage(id, Number(messageId), String(text ?? ""));
  bothSides();
}

export async function deleteChatMessageAction(clientId: number, messageId: number) {
  const id = await coachOn(clientId);
  if (!id) return;
  deleteChatMessage(id, Number(messageId));
  bothSides();
}

/** A link on a sent message: one that parses and the client can open, or null to take it off. */
export async function setMessageLinkAction(clientId: number, messageId: number, raw: string | null) {
  const id = await coachOn(clientId);
  if (!id) return;
  let link: MessageLink | null = null;
  if (raw) {
    try {
      link = parseMessageLink(JSON.parse(raw));
    } catch {
      link = null;
    }
    if (!link || describeMessageLink(id, link).gone) return;
  }
  setChatMessageLink(id, Number(messageId), link);
  bothSides();
}

export async function pinMessageAction(clientId: number, messageId: number, pinned: boolean) {
  const id = await coachOn(clientId);
  if (!id) return;
  setChatMessagePinned(id, Number(messageId), !!pinned);
  bothSides();
}

// The coach taking back a comment on a meal (a wrong meal, a typo): it goes
// from the client's diary, their messages and their notifications.
export async function removeMealCommentAction(clientId: number, messageId: number) {
  const id = await requireClientAccess(clientId);
  const user = await getSessionUser();
  if (!id || user?.role !== "coach") return;
  removeMealComment(id, messageId);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function editMealCommentAction(clientId: number, messageId: number, text: string) {
  const id = await requireClientAccess(clientId);
  const user = await getSessionUser();
  if (!id || user?.role !== "coach") return;
  editMealComment(id, messageId, String(text).slice(0, 1000));
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

export async function markCoachNotesReadAction(clientId: number) {
  const id = await requireClientAccess(clientId);
  if (!id) return;
  markCoachNotesRead(id);
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
  const coach = await requireCoach();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  createReportTemplate(coach.id, name);
  revalidatePath("/admin");
}

export async function deleteReportTemplateAction(formData: FormData) {
  const coach = await requireCoach();
  const id = Number(formData.get("id"));
  if (!coachOwnsReportTemplate(coach.id, id)) return;
  deleteReportTemplate(id);
  revalidatePath("/admin");
}

export async function addReportTemplateSectionAction(formData: FormData) {
  const coach = await requireCoach();
  const templateId = Number(formData.get("templateId"));
  if (!coachOwnsReportTemplate(coach.id, templateId)) return;
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
  const coach = await requireCoach();
  const id = Number(formData.get("id"));
  if (!coachOwnsReportTemplateSection(coach.id, id)) return;
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
  const clientId = Number(formData.get("clientId"));
  const coach = await coachForClient(clientId);
  const periodStart = String(formData.get("periodStart") || "");
  const periodEnd = String(formData.get("periodEnd") || "");
  const client = getClient(clientId);
  if (!coach || !client || !periodStart || !periodEnd) return;

  const templateIdRaw = formData.get("templateId");
  const templateId = templateIdRaw ? Number(templateIdRaw) : null;
  if (templateId != null && !coachOwnsReportTemplate(coach.id, templateId)) return;
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
  const id = Number(formData.get("id"));
  if (!(await coachForClient(getClientIdForReport(id)))) return;
  const summary = String(formData.get("summary") || "");
  updateReportSummary(id, summary);
  revalidatePath("/admin");
}

export async function approveReportAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(getClientIdForReport(id)))) return;
  approveReport(id);
  revalidatePath("/admin");
}

export async function sendReportAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(getClientIdForReport(id)))) return;
  sendReport(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function deleteReportAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(getClientIdForReport(id)))) return;
  deleteReport(id);
  revalidatePath("/admin");
}

// Coach-side switch for whether a metric/measurement column is deployed to
// the client's check-in screen. History is untouched either way — hiding a
// metric stops it being asked for, it doesn't delete what's already logged.
export async function setMetricVisibleAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id || !(await coachForClient(clientIdForMetricDefinition(id)))) return;
  setMetricVisibleToClient(id, formData.get("visible") === "true");
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setMeasurementFieldVisibleAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id || !(await coachForClient(clientIdForMeasurementField(id)))) return;
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

/**
 * Client-side: clears the unread dot when the athlete first opens a coach's
 * note on an exercise. Reachable from the client app, so it resolves the
 * owning client from the assignment and checks the session can touch it.
 */
// The three demo-video actions return a message on failure rather than
// throwing or returning void. The dialog closes on null and shows the string
// otherwise — an upload that silently did nothing would look like it worked
// until the coach reopened the chip.

export async function setDemoUrlAction(formData: FormData): Promise<string | null> {
  const assignmentId = Number(formData.get("assignmentId"));
  if (!(await coachForClient(getClientIdForAssignment(assignmentId)))) return "That exercise no longer exists.";
  const url = String(formData.get("demoUrl") || "").trim();
  if (!url) return "Paste a link first.";
  // Only ever a link the browser will actually open. Without this, a pasted
  // "javascript:" or "data:" string becomes an anchor href on the client's
  // own screen.
  if (!/^https?:\/\//i.test(url)) return "That needs to start with http:// or https://";
  setAssignmentDemoUrl(assignmentId, url);
  revalidatePath("/admin");
  revalidatePath("/client");
  return null;
}

// The same for an exercise by itself: the demo is the exercise's (the
// library's), so an exercise just added to a session, not applied yet, can
// have one too. Uploads by exercise are uploadExerciseVideoAction.
export async function setExerciseDemoLinkAction(formData: FormData): Promise<string | null> {
  const coach = await requireCoach();
  const exerciseId = Number(formData.get("exerciseId"));
  if (!exerciseId || !coachOwnsExercise(coach.id, exerciseId)) return "That exercise no longer exists.";
  const url = String(formData.get("demoUrl") || "").trim();
  if (!url) return "Paste a link first.";
  if (!/^https?:\/\//i.test(url)) return "That needs to start with http:// or https://";
  setExerciseVideoUrl(exerciseId, url);
  revalidatePath("/admin");
  revalidatePath("/client");
  return null;
}

export async function clearExerciseDemoAction(formData: FormData) {
  const coach = await requireCoach();
  const exerciseId = Number(formData.get("exerciseId"));
  if (!exerciseId || !coachOwnsExercise(coach.id, exerciseId)) return;
  setExerciseVideoUrl(exerciseId, null);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function clearDemoAction(formData: FormData) {
  const assignmentId = Number(formData.get("assignmentId"));
  const coach = await coachForClient(getClientIdForAssignment(assignmentId));
  if (!coach) return;
  const exerciseId = getExerciseIdForAssignment(assignmentId);
  if (exerciseId != null && coachOwnsExercise(coach.id, exerciseId)) setExerciseVideoUrl(exerciseId, null);
  setAssignmentDemoUrl(assignmentId, "");
  revalidatePath("/admin");
  revalidatePath("/client");
}

// 64MB, matching serverActions.bodySizeLimit in next.config.ts. Checked here
// as well because the config only rejects the request — this is what turns
// that into a sentence the coach can read.
const MAX_DEMO_BYTES = 64 * 1024 * 1024;

export async function uploadDemoVideoAction(formData: FormData): Promise<string | null> {
  const assignmentId = Number(formData.get("assignmentId"));

  // The client comes from the assignment, not from the form, and must be one
  // of this coach's; the clip lands on the coach's own library exercise.
  const coach = await coachForClient(getClientIdForAssignment(assignmentId));
  if (!coach) return "That exercise no longer exists.";

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return "Choose a file first.";
  if (file.size > MAX_DEMO_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(0)}MB. The limit is 64MB. Trim the clip and try again.`;
  }
  if (!file.type.startsWith("video/")) return "That doesn't look like a video file.";

  const buffer = Buffer.from(await file.arrayBuffer());
  // Stored against the exercise itself, so every client who is prescribed
  // it gets the same clip. clientId is still checked above so a stale form
  // can't upload against a deleted prescription.
  const exerciseId = getExerciseIdForAssignment(assignmentId);
  if (exerciseId == null || !coachOwnsExercise(coach.id, exerciseId)) return "That exercise no longer exists.";
  const publicPath = saveLibraryVideoUpload(exerciseId, buffer, file.type);
  await putUpload(publicPath, buffer, file.type);
  setExerciseVideoUrl(exerciseId, publicPath);
  setAssignmentDemoUrl(assignmentId, "");
  revalidatePath("/admin");
  revalidatePath("/client");
  return null;
}

export async function setCardioColumnVisibleAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  setCardioColumnVisible(clientId, String(formData.get("key") || ""), formData.get("visible") === "true");
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function setBuiltinColumnVisibleAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const key = String(formData.get("key") || "");
  const visible = formData.get("visible") === "true";
  setBuiltinColumnVisible(clientId, key, visible);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// The client ticks a cardio entry off (or back on). Same ownership rule as
// logging a set: the entry says whose it is, the session says who may write.
export async function setCardioDoneAction(entryId: number, done: boolean) {
  if (!entryId) return;
  const owner = getClientIdForCardio(entryId);
  if (owner == null || !(await canAccessClient(owner))) return;
  setCardioDone(entryId, done);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function markExerciseNoteReadAction(assignmentId: number) {
  if (!assignmentId) return;
  const owner = getClientIdForAssignment(assignmentId);
  if (owner == null || !(await canAccessClient(owner))) return;
  markExerciseNoteRead(assignmentId);
  revalidatePath("/client");
}

export async function markReportOpenedAction(id: number) {
  const owner = getClientIdForReport(id);
  if (owner == null || !(await canAccessClient(owner))) return;
  markReportOpened(id);
  revalidatePath("/client");
}

// Deletes the client and everything attached to them. The confirm lives in
// the UI (ConfirmDeleteButton); this trusts that the coach meant it.
export async function deleteClientAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  removeClient(clientId);
  revalidatePath("/admin");
  revalidatePath("/client");
  redirect("/admin");
}

// Removes one week from a programme; later weeks move up. The confirm is in
// the rail's dialog. Live and past weeks of a deployed programme are refused
// here too, not just hidden in the UI, so a stale form can't delete history.
export async function removeProgramWeekAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  if (!(await coachForClient(clientId))) return;
  const programId = Number(formData.get("programId"));
  const week = Number(formData.get("week"));
  const program = listPrograms(clientId).find((p) => p.id === programId);
  if (!program || !week) return;
  // A week with logged sets is training history; it never goes from here.
  if (programLoggedWeekIndexes(programId).includes(week)) return;
  removeProgramWeek(programId, week);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// Name-only save, fired when the coach leaves the Name field on the client
// card, so the rail and panel header update straight away even if the rest
// of the card is never saved. Blank names are ignored, same as the full save.
export async function renameClientAction(clientId: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed || !(await coachForClient(clientId))) return;
  renameClient(clientId, trimmed);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// Daily / Weekly / Monthly toggle on a check-in column row.
export async function setMetricCadenceAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!(await coachForClient(clientIdForMetricDefinition(id)))) return;
  const raw = String(formData.get("frequency") ?? "");
  if (raw !== "daily" && raw !== "weekly" && raw !== "monthly") return;
  setMetricCadence(id, raw);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// An entry made from the calendar's day panel: a client meeting when a
// client is chosen, otherwise the coach's own block of time. Lands back on
// the same day in the calendar.
export async function addCalendarEventAction(formData: FormData) {
  const coach = await requireCoach();
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const duration = Number(formData.get("durationMinutes")) || undefined;
  const topic = String(formData.get("topic") || "").trim();
  const rawClient = String(formData.get("clientId") || "");
  const clientId = rawClient ? Number(rawClient) : null;
  if (!date || !time) return;
  // A client meeting only for one of this coach's clients; otherwise a block
  // on this coach's own calendar.
  if (clientId != null && !(await coachForClient(clientId))) return;
  addMeeting(clientId, date, time, topic, duration, null, coach.id);
  if (clientId) {
    logCoachActivity(clientId, topic ? `Scheduled a meeting: "${topic}"` : "Scheduled a new meeting", {
      kind: "general",
      actionTab: "home",
      actionLabel: "View schedule",
    });
  }
  revalidatePath("/admin");
  revalidatePath("/client");
  redirect(`/admin?view=calendar&month=${date.slice(0, 7)}&day=${date}`);
}

// ---- Phase timeline (coach only) ----------------------------------------

function readPhaseForm(formData: FormData) {
  const trackRaw = String(formData.get("track") ?? "");
  const track = PHASE_TRACKS.find((t) => t.id === trackRaw)?.id ?? null;
  const name = String(formData.get("name") ?? "").trim();
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!track || !name || !isDate(start) || !isDate(end)) return null;
  return { track, name, start, end };
}

export async function addClientPhaseAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const fields = readPhaseForm(formData);
  if (!fields || !(await coachForClient(clientId))) return;
  const rawProgram = String(formData.get("programId") ?? "");
  // Only one of this client's own programmes can be linked.
  const programId = /^\d+$/.test(rawProgram) && getClientIdForProgram(Number(rawProgram)) === clientId ? Number(rawProgram) : null;
  addClientPhase(clientId, fields.track, fields.name, fields.start, fields.end, programId);
  revalidatePath("/admin");
  revalidatePath("/client");
}

/** The draft is named, dated and sent: the last step of the same flow on every track. */
export async function schedulePhaseAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id || !(await coachForClient(getClientIdForPhase(id)))) return;
  if (phaseEmptyReason(id)) return;
  schedulePhase(id, String(formData.get("name") ?? ""), String(formData.get("start") ?? ""), String(formData.get("end") ?? ""));
  revalidatePath("/admin");
  revalidatePath("/client");
}

// A draft out on the dates it already has: scheduled for its start week.
// (One whose week has come goes out with deployPhaseNowAction instead.)
export async function schedulePhaseOnItsDatesAction(id: number) {
  const phaseId = Number(id);
  if (!Number.isInteger(phaseId) || !(await coachForClient(getClientIdForPhase(phaseId)))) return;
  if (phaseEmptyReason(phaseId)) return;
  const phase = getPhaseById(phaseId);
  if (!phase) return;
  schedulePhase(phaseId, phase.name, phase.start_week, phase.end_week);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// Straight out, no dates to pick: the phase goes live this week.
export async function deployPhaseNowAction(id: number) {
  if (!Number.isInteger(id) || !(await coachForClient(getClientIdForPhase(id)))) return;
  // Nothing in it yet: nothing to send.
  if (phaseEmptyReason(id)) return;
  deployPhaseNow(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// The phase dialog's buttons for a draft: what was changed in the dialog is
// saved and the draft goes out, in one step — on its dates (scheduled, or
// live if its week has come), or now from this week.
export async function saveAndSchedulePhaseAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const fields = readPhaseForm(formData);
  if (!id || !fields || !(await coachForClient(getClientIdForPhase(id)))) return;
  updateClientPhase(id, fields.track, fields.name, fields.start, fields.end, formData.get("adjustProgram") === "1");
  // The edits are kept; an empty draft just doesn't go out.
  if (!phaseEmptyReason(id)) schedulePhase(id, fields.name, fields.start, fields.end);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function saveAndDeployPhaseNowAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const fields = readPhaseForm(formData);
  if (!id || !fields || !(await coachForClient(getClientIdForPhase(id)))) return;
  updateClientPhase(id, fields.track, fields.name, fields.start, fields.end, formData.get("adjustProgram") === "1");
  if (!phaseEmptyReason(id)) deployPhaseNow(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function unschedulePhaseAction(id: number) {
  if (!(await coachForClient(getClientIdForPhase(Number(id))))) return;
  unschedulePhase(Number(id));
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function updateClientPhaseAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const fields = readPhaseForm(formData);
  if (!id || !fields || !(await coachForClient(getClientIdForPhase(id)))) return;
  updateClientPhase(id, fields.track, fields.name, fields.start, fields.end, formData.get("adjustProgram") === "1");
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeClientPhaseAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id || !(await coachForClient(getClientIdForPhase(id)))) return;
  removeClientPhase(id);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// A draft nutrition phase goes out: scheduled when it starts in a later
// week, live when its start week has come. Called directly, not via a form.
export async function deployNutritionPhaseAction(phaseId: number) {
  if (!Number.isInteger(phaseId) || !(await coachForClient(getClientIdForPhase(phaseId)))) return;
  setNutritionPhaseDraft(phaseId, false);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// A scheduled nutrition phase back to draft, off the client's plan again.
export async function draftNutritionPhaseAction(phaseId: number) {
  if (!Number.isInteger(phaseId) || !(await coachForClient(getClientIdForPhase(phaseId)))) return;
  setNutritionPhaseDraft(phaseId, true);
  revalidatePath("/admin");
  revalidatePath("/client");
}

// ---- Calorie log (client's own daily kcal) --------------------------------

export async function logCaloriesAction(formData: FormData) {
  // Clients always write their own; the posted id is ignored for them.
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const raw = String(formData.get("kcal") ?? "").replace(",", ".").trim();
  const kcal = raw === "" ? null : Math.round(Number(raw));
  if (kcal != null && (!Number.isFinite(kcal) || kcal < 0 || kcal > 20000)) return;
  const note = formData.has("note") ? String(formData.get("note") ?? "").trim().slice(0, 500) || null : undefined;
  // Training or rest, as the client called the day; absent keeps what it was.
  const rawDayType = formData.get("dayType");
  const dayType = rawDayType === "training" || rawDayType === "rest" ? rawDayType : undefined;
  setCalorieLog(clientId, date, kcal, note, dayType, null);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// ---- Reorder / copy within a day --------------------------------------------

// Called directly from the drag handler with the new order, not via a form.
export async function reorderSessionsAction(clientId: number, week: number, orderedIds: number[]) {
  if (!(await coachForClient(Number(clientId)))) return;
  reorderSessions(Number(clientId), Number(week), (orderedIds ?? []).map(Number).filter((n) => Number.isInteger(n)));
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function reorderAssignmentsAction(programDayId: number, orderedIds: number[]) {
  if (!Number.isInteger(programDayId) || !Array.isArray(orderedIds)) return;
  if (!(await coachForClient(clientIdForProgramDay(programDayId)))) return;
  reorderAssignments(programDayId, orderedIds.map(Number).filter((n) => Number.isInteger(n)));
  revalidatePath("/client");
  revalidatePath("/admin");
}

// Copy a session onto another session of its week, or into a new one
// (toDayId "new"). Opt-in per copy: the same in every later week too.
export async function copyProgramDayAction(formData: FormData) {
  const fromDayId = Number(formData.get("fromDayId"));
  const to = String(formData.get("toDayId") ?? "");
  const owner = clientIdForProgramDay(fromDayId);
  if (!fromDayId || owner == null || !(await coachForClient(owner))) return;
  const laterWeeks = formData.get("applyToRemainingWeeks") === "1";
  if (to === "new") {
    copyProgramDayToNewSession(fromDayId, laterWeeks);
  } else {
    const toDayId = Number(to);
    if (!toDayId || clientIdForProgramDay(toDayId) !== owner) return;
    copyProgramDay(fromDayId, toDayId);
    if (laterWeeks) copyProgramDayToLaterWeeks(fromDayId, toDayId);
  }
  revalidatePath("/client");
  revalidatePath("/admin");
}


// ---- Library video straight from the exercise picker's add-new form -------

export async function uploadExerciseVideoAction(formData: FormData): Promise<string | null> {
  const coach = await requireCoach();
  const exerciseId = Number(formData.get("exerciseId"));
  if (!exerciseId || !coachOwnsExercise(coach.id, exerciseId)) return "That exercise no longer exists.";
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return "Choose a file first.";
  if (file.size > MAX_DEMO_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(0)}MB. The limit is 64MB. Trim the clip and try again.`;
  }
  if (!file.type.startsWith("video/")) return "That doesn't look like a video file.";
  const buffer = Buffer.from(await file.arrayBuffer());
  const videoPath = saveLibraryVideoUpload(exerciseId, buffer, file.type);
  await putUpload(videoPath, buffer, file.type);
  setExerciseVideoUrl(exerciseId, videoPath);
  revalidatePath("/admin");
  revalidatePath("/client");
  return null;
}

export async function clearProgramDayAction(formData: FormData) {
  const programDayId = Number(formData.get("programDayId"));
  if (!programDayId || !(await coachForClient(clientIdForProgramDay(programDayId)))) return;
  clearProgramDay(programDayId);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// "+ Add session" under a week in the builder.
export async function addSessionAction(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const week = Number(formData.get("week"));
  if (!clientId || !week || !(await coachForClient(clientId))) return;
  addSession(clientId, week);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// Deleting a session from its header; the ones after it move up.
export async function removeSessionAction(formData: FormData) {
  const programDayId = Number(formData.get("programDayId"));
  if (!programDayId || !(await coachForClient(clientIdForProgramDay(programDayId)))) return;
  removeSession(programDayId);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// Called from the reorder bar after a drop, with no form.
export async function applyDayOrderToLaterWeeksAction(programDayId: number) {
  if (!Number.isInteger(programDayId) || !(await coachForClient(clientIdForProgramDay(programDayId)))) return;
  applyDayOrderToLaterWeeks(programDayId);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// The pending-changes bar posts every queued edit on a day card at once.
export type { DayFieldKey } from "./queries";
export type DayChangesPayload = DayChanges;

export async function applyDayChangesAction(
  payload: DayChangesPayload
): Promise<{ ok: true; skipped: string[] } | { ok: false; error: string }> {
  if (!Number.isInteger(payload?.programDayId)) return { ok: false, error: "Unknown day" };
  const coach = await coachForClient(clientIdForProgramDay(payload.programDayId));
  if (!coach) return { ok: false, error: "Unknown day" };
  // Exercises added to the day must come from this coach's own library.
  if ((payload.added ?? []).some((a) => !coachOwnsExercise(coach.id, a.exerciseId))) return { ok: false, error: "Unknown exercise" };
  // A finished session takes no new exercises (the builder hides the row; this is the backstop).
  if ((payload.added ?? []).length > 0 && isSessionComplete(payload.programDayId)) return { ok: false, error: "This session is completed" };
  try {
    const { skipped } = applyDayChanges({
      programDayId: payload.programDayId,
      alsoRemaining: !!payload.alsoRemaining,
      label: typeof payload.label === "string" ? payload.label.trim() : null,
      rest: typeof payload.rest === "boolean" ? payload.rest : null,
      fields: payload.fields ?? {},
      custom: payload.custom ?? {},
      gyms: payload.gyms ?? {},
      cardio: {
        fields: payload.cardio?.fields ?? {},
        removed: (payload.cardio?.removed ?? []).filter((id) => Number.isInteger(id)),
        added: payload.cardio?.added ?? [],
        order: Array.isArray(payload.cardio?.order) ? payload.cardio.order.filter((id) => Number.isInteger(id)) : null,
      },
      removed: (payload.removed ?? []).filter((id) => Number.isInteger(id)),
      added: (payload.added ?? []).filter((a) => Number.isInteger(a.exerciseId)),
      order: Array.isArray(payload.order) ? payload.order.filter((id) => Number.isInteger(id)) : null,
    });
    revalidatePath("/client");
    revalidatePath("/admin");
    return { ok: true, skipped };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

// ---- Gyms -----------------------------------------------------------------
// Only the coach keeps a client's gym list: it shapes the builder's weights
// and lanes, so it is not something a client should be able to reshape. The
// client picks one of those gyms per session.

export async function addGymAction(clientId: number, name: string): Promise<{ id: number; name: string } | null> {
  if (!(await coachForClient(Number(clientId)))) return null;
  const gym = addClientGym(Number(clientId), String(name ?? ""));
  revalidatePath("/client");
  revalidatePath("/admin");
  return gym ? { id: gym.id, name: gym.name } : null;
}

/** The gym the client trains at most: its weights are the plain targets. */
export async function setHomeGymAction(gymId: number) {
  if (!(await coachForClient(getClientIdForGym(Number(gymId))))) return;
  setHomeGym(Number(gymId));
  revalidatePath("/admin");
  revalidatePath("/client");
}

export async function removeGymAction(gymId: number) {
  if (!(await coachForClient(getClientIdForGym(Number(gymId))))) return;
  removeClientGym(Number(gymId));
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function pickGymAction(programDayId: number, gymId: number) {
  const owner = clientIdForProgramDay(Number(programDayId));
  if (owner == null || getClientIdForGym(Number(gymId)) !== owner || !(await canAccessClient(owner))) return;
  pickGymForDay(Number(programDayId), Number(gymId));
  revalidatePath("/client");
  revalidatePath("/admin");
}

/** Which way a metric is meant to move, for the Change row's colour. */
export async function setMetricDirectionAction(id: number, direction: "up" | "down" | "none") {
  if (!(await coachForClient(clientIdForMetricDefinition(Number(id))))) return;
  setMetricDirection(Number(id), direction);
  revalidatePath("/admin");
}

export async function saveCoachNoteAction(clientId: number, text: string) {
  if (!(await coachForClient(Number(clientId)))) return;
  setCoachNote(Number(clientId), String(text ?? ""));
  revalidatePath("/admin");
}

// The coach has looked at something on a client's Home: it stops being new.
export async function markSeenAction(clientId: number, which: { all: true } | { dayId: number } | { ids: string[] } | { tab: string }) {
  if (!(await coachForClient(Number(clientId)))) return;
  markClientEventsSeen(Number(clientId), which);
  revalidatePath("/admin");
}

export async function saveWarmupSetsAction(assignmentId: number, sets: { weight_kg: number | null; reps: number | null }[]) {
  const owner = getClientIdForAssignment(Number(assignmentId));
  if (owner == null || !(await canAccessClient(owner)) || !Array.isArray(sets)) return;
  setWarmupSets(Number(assignmentId), sets);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// The session clock: a valid ISO timestamp from the phone, else now.
function stampOrNow(at: unknown) {
  const t = typeof at === "string" ? Date.parse(at) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

export async function startSessionAction(programDayId: number, at?: string) {
  const owner = clientIdForProgramDay(Number(programDayId));
  if (owner == null || !(await canAccessClient(owner))) return;
  startSession(Number(programDayId), stampOrNow(at));
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function endSessionAction(programDayId: number, at?: string) {
  const owner = clientIdForProgramDay(Number(programDayId));
  if (owner == null || !(await canAccessClient(owner))) return;
  endSession(Number(programDayId), stampOrNow(at));
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function saveSkipReasonAction(programDayId: number, text: string) {
  const owner = clientIdForProgramDay(Number(programDayId));
  if (owner == null || !(await canAccessClient(owner))) return;
  setSessionSkipReason(Number(programDayId), String(text ?? ""));
  revalidatePath("/client");
  revalidatePath("/admin");
}

// ---- Client avatar --------------------------------------------------------
// The client sets it from Settings; a coach may also set or clear it.
// requireClientAccess pins a client to their own id regardless of the form.

export async function uploadClientAvatarAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0 || file.size > 6 * 1024 * 1024) return;
  if (!file.type.startsWith("image/")) return;
  const previous = getClient(clientId)?.avatar_path ?? null;
  const body = Buffer.from(await file.arrayBuffer());
  const saved = saveClientAvatar(clientId, body, file.type);
  // A new extension is a new file; the old one goes from the bucket too.
  if (previous && keyOf(previous) !== keyOf(saved)) await deleteUpload(previous);
  await putUpload(saved, body, file.type);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// ---- Coach profile ----------------------------------------------------------
// A coach edits their own profile. The owner may edit any coach's, named by
// coachId; for anyone else that field is ignored.

async function profileCoachId(formData: FormData): Promise<number> {
  const coach = await requireCoach();
  const asked = Number(formData.get("coachId"));
  if (isOwner(coach) && Number.isInteger(asked) && asked > 0 && asked !== coach.id && getCoachProfileView(asked)) return asked;
  return coach.id;
}

function revalidateCoachProfile() {
  revalidatePath("/admin/profile");
  revalidatePath("/client");
}

function jsonList(formData: FormData, key: string): unknown[] {
  try {
    const value = JSON.parse(String(formData.get(key) ?? "[]"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export async function saveCoachProfileAction(formData: FormData) {
  const coachId = await profileCoachId(formData);
  const field = (key: keyof typeof COACH_PROFILE_LIMITS) => clip(formData.get(key), COACH_PROFILE_LIMITS[key]);
  const rawYears = String(formData.get("yearsCoaching") ?? "").trim();
  const years = Number(rawYears);
  saveCoachProfile(coachId, {
    displayName: field("displayName"),
    title: field("title"),
    headline: field("headline"),
    location: field("location"),
    languages: field("languages"),
    yearsCoaching: rawYears === "" || !Number.isFinite(years) || years < 0 ? null : Math.min(80, Math.round(years)),
    intro: field("intro"),
    bio: field("bio"),
    quote: field("quote"),
    outside: field("outside"),
    replyNote: field("replyNote"),
    specialties: [...new Set(jsonList(formData, "specialties").map((v) => clip(v, 40)).filter(Boolean))].slice(0, COACH_PROFILE_LIMITS.specialties),
    studies: jsonList(formData, "studies")
      .map((v) => {
        const o = (v ?? {}) as Record<string, unknown>;
        return { title: clip(o.title, 80), place: clip(o.place, 80), year: clip(o.year, 12) };
      })
      .filter((s) => s.title || s.place)
      .slice(0, 12),
    experience: jsonList(formData, "experience")
      .map((v) => {
        const o = (v ?? {}) as Record<string, unknown>;
        return { years: clip(o.years, 20), role: clip(o.role, 80), place: clip(o.place, 80) };
      })
      .filter((r) => r.role || r.place)
      .slice(0, 20),
  });
  revalidateCoachProfile();
}

export async function publishCoachProfileAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const coachId = await profileCoachId(formData);
  const ok = setCoachProfilePublished(coachId, formData.get("published") === "1");
  revalidateCoachProfile();
  return ok ? { ok: true } : { ok: false, error: "Add your display name and save before publishing." };
}

function coachPhotoKind(v: FormDataEntryValue | null): CoachPhotoKind {
  return v === "candid" || v === "avatar" ? v : "hero";
}

export async function uploadCoachPhotoAction(formData: FormData) {
  const coachId = await profileCoachId(formData);
  const kind = coachPhotoKind(formData.get("kind"));
  const file = formData.get("file") as File | null;
  // Same checks as the client avatar.
  if (!file || file.size === 0 || file.size > 6 * 1024 * 1024) return;
  if (!file.type.startsWith("image/")) return;
  const current = getCoachProfile(coachId);
  const previous = (kind === "hero" ? current?.hero_path : kind === "candid" ? current?.candid_path : current?.avatar_path) ?? null;
  const body = Buffer.from(await file.arrayBuffer());
  const saved = saveCoachPhoto(coachId, kind, body, file.type);
  if (previous && keyOf(previous) !== keyOf(saved)) await deleteUpload(previous);
  await putUpload(saved, body, file.type);
  revalidateCoachProfile();
}

export async function removeCoachPhotoAction(formData: FormData) {
  const coachId = await profileCoachId(formData);
  const kind = coachPhotoKind(formData.get("kind"));
  const previous = removeCoachPhoto(coachId, kind);
  await deleteUpload(previous);
  revalidateCoachProfile();
}

export async function removeClientAvatarAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const previous = getClient(clientId)?.avatar_path ?? null;
  removeClientAvatar(clientId);
  await deleteUpload(previous);
  revalidatePath("/client");
  revalidatePath("/admin");
}

// The client's own contact details, edited from Settings. The session decides
// whose profile this is; the clientId in the form is only checked against it.
// The login email is not touched here: this is the contact email the coach
// sees on the member card.
export async function saveMyDetailsAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  if (!clientId) return;
  const field = (name: string) => {
    const v = String(formData.get(name) ?? "").trim();
    return v ? v.slice(0, 200) : null;
  };
  patchClientProfile(clientId, { email: field("email"), phone: field("phone"), address: field("address") });
  revalidatePath("/client");
  revalidatePath("/admin");
}

// ---- Food diary ------------------------------------------------------------

export async function searchFoodsAction(clientId: number, query: string): Promise<FoodOption[]> {
  const owner = await requireClientAccess(Number(clientId));
  return searchFoods(owner, String(query ?? "").slice(0, 80));
}

const gramsOf = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 && n <= 5000 ? n : null;
};

export async function addFoodEntryAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const date = String(formData.get("date") ?? "");
  const meal = String(formData.get("meal") ?? "");
  const foodId = String(formData.get("foodId") ?? "");
  const grams = gramsOf(formData.get("grams"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !hasFoodMeal(clientId, meal, date) || !foodId || grams == null) return;
  const serving = String(formData.get("serving") ?? "").trim().slice(0, 80) || null;
  addFoodEntry(clientId, date, meal as FoodMeal, foodId, grams, serving);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function updateFoodEntryAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const id = Number(formData.get("id"));
  const grams = gramsOf(formData.get("grams"));
  if (!Number.isInteger(id) || grams == null) return;
  const serving = String(formData.get("serving") ?? "").trim().slice(0, 80) || null;
  updateFoodEntry(clientId, id, grams, serving);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function removeFoodEntryAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  removeFoodEntry(clientId, id);
  revalidatePath("/client");
  revalidatePath("/admin");
}

/** Returns the new food's id ("custom:12") so the diary can add it straight away. */
export async function addCustomFoodAction(formData: FormData): Promise<string | null> {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const num = (k: string, max: number) => {
    const n = Number(String(formData.get(k) ?? "").replace(",", ".").trim() || "0");
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  };
  const kcal = num("kcal", 2000);
  const protein = num("protein", 100);
  const carbs = num("carbs", 100);
  const fat = num("fat", 100);
  if (!name || kcal == null || protein == null || carbs == null || fat == null) return null;
  const servingLabel = String(formData.get("servingLabel") ?? "").trim().slice(0, 40) || null;
  const servingGrams = gramsOf(formData.get("servingGrams"));
  const row = addCustomFood(clientId, { name, kcal, protein, carbs, fat, servingLabel: servingLabel && servingGrams ? servingLabel : null, servingGrams: servingLabel && servingGrams ? servingGrams : null });
  revalidatePath("/client");
  return `custom:${row.id}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// The diary steps back through the last month; nothing after today.
function diaryDateOk(date: string): boolean {
  if (!DATE.test(date)) return false;
  const today = localDateStr();
  const floor = new Date(`${today}T00:00:00`);
  floor.setDate(floor.getDate() - 30);
  return date <= today && date >= localDateStr(floor);
}

export async function getFoodDiaryAction(clientId: number, date: string): Promise<FoodDiaryView | null> {
  const owner = await requireClientAccess(Number(clientId));
  if (!diaryDateOk(String(date))) return null;
  return getFoodDiary(owner, String(date));
}

export async function addFoodMealAction(formData: FormData): Promise<string | null> {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  const date = String(formData.get("date") ?? "");
  if (!name || !diaryDateOk(date)) return null;
  const row = addFoodMeal(clientId, name, date);
  revalidatePath("/client");
  return `m:${row.id}`;
}

export async function renameFoodMealAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const id = Number(String(formData.get("meal") ?? "").replace(/^m:/, ""));
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  if (!Number.isInteger(id) || !name) return;
  renameFoodMeal(clientId, id, name);
  revalidatePath("/client");
}

export async function removeFoodMealAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const id = Number(String(formData.get("meal") ?? "").replace(/^m:/, ""));
  if (!Number.isInteger(id)) return;
  removeFoodMeal(clientId, id);
  revalidatePath("/client");
}

export async function copyFoodMealAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const fromDate = String(formData.get("fromDate") ?? "");
  const fromMeal = String(formData.get("fromMeal") ?? "");
  const toDate = String(formData.get("toDate") ?? "");
  const toMeal = String(formData.get("toMeal") ?? "");
  if (!DATE.test(fromDate) || !diaryDateOk(toDate)) return;
  copyFoodMeal(clientId, fromDate, fromMeal, toDate, toMeal);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function setFoodDayTypeAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const date = String(formData.get("date") ?? "");
  const dayType = formData.get("dayType");
  if (!diaryDateOk(date) || (dayType !== "training" && dayType !== "rest")) return;
  setFoodDayType(clientId, date, dayType);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function reorderFoodMealsAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const date = String(formData.get("date") ?? "");
  if (!DATE.test(date)) return;
  const ids = String(formData.get("order") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
  reorderFoodMeals(clientId, date, ids);
  revalidatePath("/client");
}

export async function pushFoodDayAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const date = String(formData.get("date") ?? "");
  if (!diaryDateOk(date)) return;
  pushFoodDayToCalorieLog(clientId, date);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function saveMealAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const date = String(formData.get("date") ?? "");
  const meal = String(formData.get("meal") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!DATE.test(date) || !name) return;
  saveMeal(clientId, date, meal, name);
  revalidatePath("/client");
}

export async function deleteSavedMealAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  deleteSavedMeal(clientId, id);
  revalidatePath("/client");
}

export async function addSavedMealAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const id = Number(formData.get("id"));
  const date = String(formData.get("date") ?? "");
  const meal = String(formData.get("meal") ?? "");
  if (!Number.isInteger(id) || !diaryDateOk(date)) return;
  addSavedMeal(clientId, id, date, meal);
  revalidatePath("/client");
}

// ---- Open Food Facts ---------------------------------------------------------

/** Packaged products by name. { error } when the service does not answer. */
export async function searchPackagedAction(clientId: number, query: string): Promise<{ rows: FoodOption[]; error?: string }> {
  await requireClientAccess(Number(clientId));
  try {
    const products = await searchOpenFoodFacts(String(query ?? "").slice(0, 80));
    return { rows: rememberOffProducts(products) };
  } catch {
    return { rows: [], error: "Open Food Facts did not answer. Try again in a moment." };
  }
}

/** One product by barcode, from the store when known, else fetched. null: not in Open Food Facts. */
export async function lookupBarcodeAction(clientId: number, barcode: string): Promise<{ food: FoodOption | null; error?: string }> {
  await requireClientAccess(Number(clientId));
  const code = String(barcode ?? "").replace(/\D/g, "").slice(0, 20);
  if (!code) return { food: null };
  const known = getOffFoodByCode(code);
  if (known) return { food: known };
  try {
    const product = await lookupOpenFoodFacts(code);
    if (!product) return { food: null };
    return { food: rememberOffProducts([product])[0] ?? null };
  } catch {
    return { food: null, error: "Open Food Facts did not answer. Try again in a moment." };
  }
}

export async function copyFoodDayAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const fromDate = String(formData.get("fromDate") ?? "");
  const toDate = String(formData.get("toDate") ?? "");
  if (!DATE.test(fromDate) || !diaryDateOk(toDate) || fromDate === toDate) return;
  copyFoodDay(clientId, fromDate, toDate);
  revalidatePath("/client");
  revalidatePath("/admin");
}

export async function saveDayAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const date = String(formData.get("date") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!DATE.test(date) || !name) return;
  saveDay(clientId, date, name);
  revalidatePath("/client");
}

export async function deleteSavedDayAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  deleteSavedDay(clientId, id);
  revalidatePath("/client");
}

export async function addSavedDayAction(formData: FormData) {
  const clientId = await requireClientAccess(Number(formData.get("clientId")));
  const id = Number(formData.get("id"));
  const date = String(formData.get("date") ?? "");
  if (!Number.isInteger(id) || !diaryDateOk(date)) return;
  addSavedDay(clientId, id, date);
  revalidatePath("/client");
  revalidatePath("/admin");
}
