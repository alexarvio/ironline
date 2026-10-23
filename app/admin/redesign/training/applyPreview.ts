"use server";

import { coachForClient } from "../../../lib/auth";
import { getData } from "../../../lib/db";
import { clientIdForProgramDay } from "../../../lib/tenancy";
import { getProgramForWeek, listPrograms } from "../../../lib/queries";
import { applyReader } from "./applyPreviewData";
import type { ApplyPreview } from "./applyShape";

// The confirms' read (ApplyChanges.tsx) of what Apply to the rest and a session's Apply to remaining weeks would change
// in the later weeks, for the client's coach alone. How it is read: applyPreviewData.ts, which the page's read shares.

/** Apply to the rest: the week on screen copied onto each of `toWeeks` (copyProgramWeek). */
export async function previewApplyWeekAction(clientId: number, fromWeek: number, toWeeks: number[]): Promise<ApplyPreview | null> {
  if (!(await coachForClient(clientId))) return null;
  const program = getProgramForWeek(clientId, fromWeek);
  if (!program) return null;
  return applyReader(clientId).week(program, fromWeek, toWeeks);
}

/** A session's Apply to remaining weeks: it, as it is, into the same slot of every later week (copyProgramDayToLaterWeeks). */
export async function previewApplySessionAction(programDayId: number): Promise<ApplyPreview | null> {
  const clientId = clientIdForProgramDay(programDayId);
  if (clientId == null || !(await coachForClient(clientId))) return null;
  const src = getData().program_days.find((d) => d.id === programDayId);
  if (!src) return null;
  const program = listPrograms(clientId).find((p) => src.week_number >= p.start_week && src.week_number < p.start_week + p.total_weeks);
  if (!program) return null;
  return applyReader(clientId).session(src, program);
}
