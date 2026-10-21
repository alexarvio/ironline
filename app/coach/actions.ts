"use server";

import { coachForClient, requireCoach } from "../lib/auth";
import { getClientIdForVideoRequest } from "../lib/queries";
import { listPhoneVideos, phoneReview, type PhoneReview, type PhoneVideos } from "../lib/coachPhone";
import { loadChatDock, type DockChat } from "../admin/redesign/loaders";

// The coach's phone (21 Oct): what its lists ask for every 15 s while open,
// and the one video the review screen opens. The thread itself is the
// admin's (chatDraftThreadAction), and every send, reaction and reply goes
// through the same actions as the laptop's.

export type CoachInbox = { chats: DockChat[]; videos: PhoneVideos };

export async function coachInboxAction(): Promise<CoachInbox> {
  const coach = await requireCoach();
  return { chats: loadChatDock(coach), videos: listPhoneVideos(coach.id) };
}

export async function coachReviewAction(requestId: number): Promise<PhoneReview | null> {
  const id = Number(requestId);
  if (!Number.isInteger(id) || !(await coachForClient(getClientIdForVideoRequest(id)))) return null;
  return phoneReview(id);
}
