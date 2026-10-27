"use server";

import { coachForClient, requireCoach } from "../../../lib/auth";
import { chatCurrent, timedChatRead } from "../../../lib/chatBus";
import { loadChatDock, loadMessages, type DockChat } from "../loaders";
import type { DraftMessages } from "./MessagesDraft";

/**
 * The coach's chat with one client, as the chat draws it (2 Oct): what it
 * asks for every 15 s while open and after each send, reaction or pin, in
 * place of re-reading the whole page, which redrew every tab of the client
 * under the coach's hands.
 */
export async function chatDraftThreadAction(clientId: number, known?: string | null): Promise<DraftMessages | null> {
  if (!(await coachForClient(Number(clientId)))) return null;
  // Nothing changed since the screen's copy (27 Oct): nothing to send (null, as for no access: the screen keeps its own).
  if (chatCurrent(Number(clientId), known)) return null;
  return timedChatRead("chat · laptop", () => loadMessages(Number(clientId)));
}

/**
 * Every chat of the signed-in coach's own clients, newest word first (21 Oct):
 * the chat panel's All chats on a client's screens, asked for while the panel
 * is open, every 15 s as the thread is.
 */
export async function chatListAction(): Promise<DockChat[]> {
  const coach = await requireCoach();
  return loadChatDock(coach);
}
