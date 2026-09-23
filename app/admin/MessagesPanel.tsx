import { describeMessageLink, getClient, listChatMessages, listMessageLinkTargets } from "../lib/queries";
import MessagesWorkspace, { type ChatMessageView } from "./MessagesWorkspace";

// The Messages tab: the conversation with the client, oldest first, and the
// box to write the next one. The client replies from their app, so both
// sides are here. A coach message can carry a link to one thing in the
// client's app (messageLinks.ts), and the coach can reword, re-point, pin
// or take back their own after sending.
const when = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export default function MessagesPanel({ clientId }: { clientId: number }) {
  const firstName = (getClient(clientId)?.name ?? "the client").split(" ")[0];
  const messages: ChatMessageView[] = listChatMessages(clientId)
    .filter((m) => m.text.trim() || m.media_path)
    .map((m) => ({
      id: m.id,
      mine: m.sender === "coach",
      text: m.text,
      when: when(m.created_at),
      day: dayOf(m.created_at),
      media: m.media_path ? { path: m.media_path, type: m.media_type ?? "image", name: m.media_name ?? null } : null,
      link: m.link ? describeMessageLink(clientId, m.link) : null,
      reactions: { coach: m.reactions?.coach ?? null, client: m.reactions?.client ?? null },
      pinned: !!m.pinned,
      edited: !!m.edited_at,
    }));
  return <MessagesWorkspace clientId={clientId} firstName={firstName} messages={messages} targets={listMessageLinkTargets(clientId)} />;
}
