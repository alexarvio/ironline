"use server";

import { coachForClient, requireCoach } from "../lib/auth";
import { getClientIdForVideoRequest } from "../lib/queries";
import { listPhoneVideos, phoneReview, type PhoneReview, type PhoneVideos } from "../lib/coachPhone";
import { loadChatDock, loadMessages, type DockChat } from "../admin/redesign/loaders";
import type { DraftMessages } from "../admin/redesign/messages/MessagesDraft";
import { noteCoachReading } from "../lib/coachPush";

// The coach's phone (21 Oct): what its lists ask for every 15 s while open,
// one client's chat, and the one video the review screen opens. The chat is
// the laptop's loader (loadMessages), and every send, reaction and reply goes
// through the same actions as the laptop's.

export type CoachInbox = { chats: DockChat[]; videos: PhoneVideos };

export async function coachInboxAction(): Promise<CoachInbox> {
  const coach = await requireCoach();
  return { chats: loadChatDock(coach), videos: listPhoneVideos(coach.id) };
}

/** One client's chat, as the laptop's thread reads it (loadMessages); asked for while it shows, which also keeps its pushes quiet (coachPush.ts). */
export async function coachThreadAction(clientId: number): Promise<DraftMessages | null> {
  const id = Number(clientId);
  const coach = await coachForClient(id);
  if (!coach) return null;
  noteCoachReading(coach.id, id);
  return loadMessages(id);
}

export async function coachReviewAction(requestId: number): Promise<PhoneReview | null> {
  const id = Number(requestId);
  if (!Number.isInteger(id) || !(await coachForClient(getClientIdForVideoRequest(id)))) return null;
  return phoneReview(id);
}
