import { allocId, getData, persist } from "./db";
import { EXERCISE_PRESETS, METRIC_TEMPLATE_PRESETS } from "./presets";

// Who owns what, for more than one coach account.
//
// A coach owns their clients (clients.coach_id) and, through them, everything
// that hangs off a client: programmes, logs, check-ins, photos, meetings,
// notes, reports. A coach also owns their own library: exercises, metric
// template packs and report templates (coach_id on each), and the personal
// blocks on their calendar (meetings with no client, coach_id set).
//
// These checks are pure reads of the store, so they work from server actions,
// pages, routes and scripts alike. Coaches never see each other's data; there
// is no owner role that sees everything.

export function coachIdOfClient(clientId: number | null | undefined): number | null {
  if (clientId == null || !Number.isInteger(clientId)) return null;
  return getData().clients.find((c) => c.id === clientId)?.coach_id ?? null;
}

export function coachOwnsClient(coachId: number, clientId: number | null | undefined): boolean {
  return coachIdOfClient(clientId) === coachId;
}

export function coachOwnsExercise(coachId: number, exerciseId: number | null | undefined): boolean {
  if (exerciseId == null) return false;
  return getData().exercises.find((e) => e.id === exerciseId)?.coach_id === coachId;
}

export function coachOwnsMetricTemplate(coachId: number, templateCategoryId: number | null | undefined): boolean {
  if (templateCategoryId == null) return false;
  return getData().metric_template_categories.find((t) => t.id === templateCategoryId)?.coach_id === coachId;
}

export function coachOwnsMetricTemplateItem(coachId: number, itemId: number): boolean {
  const item = getData().metric_template_items.find((i) => i.id === itemId);
  return !!item && coachOwnsMetricTemplate(coachId, item.template_category_id);
}

export function coachOwnsReportTemplate(coachId: number, templateId: number | null | undefined): boolean {
  if (templateId == null) return false;
  return getData().report_templates.find((t) => t.id === templateId)?.coach_id === coachId;
}

export function coachOwnsReportTemplateSection(coachId: number, sectionId: number): boolean {
  const section = getData().report_template_sections.find((s) => s.id === sectionId);
  return !!section && coachOwnsReportTemplate(coachId, section.template_id);
}

/** A client meeting belongs to the client's coach; a personal block to its coach. */
export function coachOwnsMeeting(coachId: number, meetingId: number): boolean {
  const meeting = getData().meetings.find((m) => m.id === meetingId);
  if (!meeting) return false;
  return meeting.client_id != null ? coachOwnsClient(coachId, meeting.client_id) : meeting.coach_id === coachId;
}

// ---- Which client a row belongs to (rows without a helper in queries.ts) ----
export const clientIdForProgramDay = (id: number) => getData().program_days.find((d) => d.id === id)?.client_id ?? null;
export const clientIdForTrainingColumn = (id: number) => getData().training_columns.find((c) => c.id === id)?.client_id ?? null;
export const clientIdForInvoice = (id: number) => getData().invoices.find((i) => i.id === id)?.client_id ?? null;
export const clientIdForMeasurementField = (id: number) => getData().measurement_fields.find((f) => f.id === id)?.client_id ?? null;
export const clientIdForSkinfold = (id: number) => getData().skinfold_entries.find((s) => s.id === id)?.client_id ?? null;
export const clientIdForMetricDefinition = (id: number) => getData().metric_definitions.find((m) => m.id === id)?.client_id ?? null;
export const meetingIdForNote = (id: number) => getData().meeting_notes.find((n) => n.id === id)?.meeting_id ?? null;

/**
 * Gives a coach their own copy of the presets: the exercise library and the
 * check-in template packs. Only fills what the coach has none of, so it is
 * safe to call again and never touches what they have built or renamed.
 */
export function seedCoachLibrary(coachId: number) {
  const data = getData();
  let changed = false;

  if (!data.exercises.some((e) => e.coach_id === coachId)) {
    for (const [group, names] of Object.entries(EXERCISE_PRESETS)) {
      for (const name of names) {
        data.exercises.push({ id: allocId("exercises"), name, muscle_tags: group, video_url: null, coach_id: coachId });
      }
    }
    changed = true;
  }

  if (!data.metric_template_categories.some((t) => t.coach_id === coachId)) {
    METRIC_TEMPLATE_PRESETS.forEach((preset, i) => {
      const id = allocId("metric_template_categories");
      data.metric_template_categories.push({ id, name: preset.category, frequency: preset.frequency, order_index: i, coach_id: coachId });
      preset.items.forEach((name, j) => {
        data.metric_template_items.push({ id: allocId("metric_template_items"), template_category_id: id, name, unit: preset.unit, order_index: j });
      });
    });
    changed = true;
  }

  if (changed) persist();
}
