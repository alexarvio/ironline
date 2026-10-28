"use server";

import { isOwner, requireCoach, requireCoachAccount } from "./auth";
import { putUpload } from "./storage";
import {
  addSupportMessage,
  isSupportCoach,
  listSupportThreads,
  markSupportProblemDone,
  markSupportSeen,
  saveSupportImage,
  isSupportImageType,
  SUPPORT_IMAGE_BYTES,
  supportThreadView,
  type SupportInboxRow,
  type SupportLine,
} from "./support";

// Support's actions (23 Oct; lib/support.ts). Every one asks who is asking: a coach only ever reads and writes their
// own thread (the id is the session's, never one sent up); the owner (isOwner) reads every coach's thread, answers it
// and closes its problems, and has none of their own.

export type SupportSent = { ok: true; thread: SupportLine[] } | { ok: false; error: string };

/** A coach writes: a message, or (kind=problem) a problem with where it happened and a screenshot. FormData: kind,
    text, where, file. Answers with the thread as it now stands. */
export async function sendSupportAction(formData: FormData): Promise<SupportSent> {
  // Open while read-only (28 Oct, Alex): the place to sort a billing problem out.
  const coach = await requireCoachAccount();
  if (isOwner(coach) || !isSupportCoach(coach.id)) return { ok: false, error: "Not from this account." };
  const kind = formData.get("kind") === "problem" ? "problem" : "message";
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { ok: false, error: "Nothing to send." };
  const where = kind === "problem" ? String(formData.get("where") ?? "").trim() : "";
  let imagePath: string | null = null;
  const file = kind === "problem" ? formData.get("file") : null;
  if (file instanceof File && file.size > 0) {
    if (!isSupportImageType(file.type)) return { ok: false, error: "The screenshot has to be a picture." };
    if (file.size > SUPPORT_IMAGE_BYTES) return { ok: false, error: "That screenshot is over 20 MB." };
    const buffer = Buffer.from(await file.arrayBuffer());
    imagePath = saveSupportImage(coach.id, buffer, file.type);
    await putUpload(imagePath, buffer, file.type);
  }
  addSupportMessage({ coachId: coach.id, from: "coach", kind, text, where, imagePath });
  return { ok: true, thread: supportThreadView(coach.id, "coach") };
}

/** The coach's own thread, as it stands (the section reads it again every so often). */
export async function loadSupportThreadAction(): Promise<SupportLine[]> {
  // Open while read-only (28 Oct, Alex): the place to sort a billing problem out.
  const coach = await requireCoachAccount();
  if (isOwner(coach)) return [];
  return supportThreadView(coach.id, "coach");
}

/** The coach has read the company's lines (their Support part came into view). */
export async function markSupportSeenAction(): Promise<void> {
  // Open while read-only (28 Oct, Alex): the place to sort a billing problem out.
  const coach = await requireCoachAccount();
  if (isOwner(coach)) return;
  markSupportSeen(coach.id, "coach");
}

// ---- The owner ------------------------------------------------------------------------------------------------------

/** Every coach's thread, newest first; nothing for anyone but the owner. */
export async function loadSupportInboxAction(): Promise<SupportInboxRow[]> {
  const coach = await requireCoach();
  return isOwner(coach) ? listSupportThreads() : [];
}

/** One coach's thread, as the owner sees it; null for anyone but the owner. */
export async function loadSupportThreadForOwnerAction(coachId: number): Promise<SupportLine[] | null> {
  const coach = await requireCoach();
  const id = Number(coachId);
  if (!isOwner(coach) || !Number.isInteger(id) || !isSupportCoach(id)) return null;
  return supportThreadView(id, "owner");
}

/** The owner opened a coach's thread: the coach's lines are read. */
export async function markSupportThreadSeenAction(coachId: number): Promise<void> {
  const coach = await requireCoach();
  const id = Number(coachId);
  if (!isOwner(coach) || !Number.isInteger(id)) return;
  markSupportSeen(id, "owner");
}

/** The owner answers a coach. Answers with the thread as it now stands, or null when it didn't go. */
export async function replySupportAction(coachId: number, text: string): Promise<SupportLine[] | null> {
  const coach = await requireCoach();
  const id = Number(coachId);
  const words = String(text ?? "").trim();
  if (!isOwner(coach) || !Number.isInteger(id) || !isSupportCoach(id) || !words) return null;
  // Answering is reading what came before.
  markSupportSeen(id, "owner");
  addSupportMessage({ coachId: id, from: "owner", kind: "message", text: words });
  return supportThreadView(id, "owner");
}

/** The owner closes a problem. Answers with its thread, or null. */
export async function markSupportProblemDoneAction(messageId: number): Promise<SupportLine[] | null> {
  const coach = await requireCoach();
  if (!isOwner(coach)) return null;
  const m = markSupportProblemDone(Number(messageId));
  return m ? supportThreadView(m.coach_id, "owner") : null;
}
