"use server";

import { coachForClient, requireCoach } from "../lib/auth";
import { chatCurrent, timedChatRead } from "../lib/chatBus";
import { closeVideoRequest, getClientIdForVideoRequest, localDateStr } from "../lib/queries";
import { loadPhoneCalendar, type PhoneCalendar } from "./calendar";
import { listPhoneVideos, phoneReview, type PhoneReview, type PhoneVideos } from "../lib/coachPhone";
import { loadChatDock, loadMessages, type DockChat } from "../admin/redesign/loaders";
import type { DraftMessages } from "../admin/redesign/messages/MessagesDraft";
import { noteCoachReading } from "../lib/coachPush";

// The coach's phone (21 Oct): what its lists ask for every 15 s while open,
// one client's chat, the one video the review screen opens, and a week of
// the Calendar (22 Oct; its entries are written with the laptop's actions). The chat is
// the laptop's loader (loadMessages), and every send, reaction and reply goes
// through the same actions as the laptop's.

export type CoachInbox = { chats: DockChat[]; videos: PhoneVideos };

export async function coachInboxAction(): Promise<CoachInbox> {
  const coach = await requireCoach();
  return { chats: loadChatDock(coach), videos: listPhoneVideos(coach.id) };
}

/** One client's chat, as the laptop's thread reads it (loadMessages); asked for while it shows, which also keeps its pushes quiet (coachPush.ts). */
export async function coachThreadAction(clientId: number, known?: string | null): Promise<DraftMessages | null> {
  const id = Number(clientId);
  const coach = await coachForClient(id);
  if (!coach) return null;
  noteCoachReading(coach.id, id);
  // Nothing changed since the phone's copy (27 Oct): nothing to send.
  if (chatCurrent(id, known)) return null;
  return timedChatRead("chat · phone", () => loadMessages(id));
}

/** One week of the Calendar (from its Monday), as the phone's Calendar tab draws it; today is the phone's, for the clashes still to come. */
export async function coachCalendarAction(monday: string, today: string): Promise<PhoneCalendar> {
  const coach = await requireCoach();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(today)) ? String(today) : localDateStr();
  return loadPhoneCalendar(coach.id, String(monday), day);
}

/** A video or photo marked done without a reply (25 Oct, Alex): off Waiting and everywhere it waited; the inbox again. */
export async function markVideoDoneAction(requestId: number): Promise<CoachInbox | null> {
  const id = Number(requestId);
  const clientId = getClientIdForVideoRequest(id);
  if (clientId == null || !(await coachForClient(clientId))) return null;
  closeVideoRequest(id);
  const coach = await requireCoach();
  return { chats: loadChatDock(coach), videos: listPhoneVideos(coach.id) };
}

export async function coachReviewAction(requestId: number): Promise<PhoneReview | null> {
  const id = Number(requestId);
  if (!Number.isInteger(id) || !(await coachForClient(getClientIdForVideoRequest(id)))) return null;
  return phoneReview(id);
}
