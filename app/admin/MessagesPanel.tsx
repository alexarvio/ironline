import { getClient, listChatMessages } from "../lib/queries";
import MessagesWorkspace, { type CoachMessage } from "./MessagesWorkspace";

// The Messages tab: the coach's quick notes to the client, newest first.
// Only the coach's side is shown; the client has no reply box in this beta,
// so their side of chat_messages is empty anyway.
const when = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export default function MessagesPanel({ clientId }: { clientId: number }) {
  const firstName = (getClient(clientId)?.name ?? "the client").split(" ")[0];
  const messages: CoachMessage[] = listChatMessages(clientId)
    .filter((m) => m.sender === "coach" && m.text.trim())
    .reverse()
    .map((m) => ({ id: m.id, text: m.text, when: when(m.created_at) }));
  return <MessagesWorkspace clientId={clientId} firstName={firstName} messages={messages} />;
}
