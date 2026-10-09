"use server";

import { coachForClient } from "../../../lib/auth";
import { loadMessages } from "../loaders";
import type { DraftMessages } from "./MessagesDraft";

/**
 * The coach's chat with one client, as the chat draws it (2 Oct): what it
 * asks for every 15 s while open and after each send, reaction or pin, in
 * place of re-reading the whole page, which redrew every tab of the client
 * under the coach's hands.
 */
export async function chatDraftThreadAction(clientId: number): Promise<DraftMessages | null> {
  if (!(await coachForClient(Number(clientId)))) return null;
  return loadMessages(Number(clientId));
}
