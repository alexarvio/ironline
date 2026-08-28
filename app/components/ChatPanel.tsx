import { ChatMessage } from "../lib/queries";
import ChatComposeForm from "./ChatComposeForm";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
}

// Shared by both sides of the conversation — /client renders it with
// viewer="client" (their own messages align right), /admin renders the same
// component with viewer="coach" (the coach's own messages align right
// instead). Plain text only for v1, no attachments/read-receipts.
export default function ChatPanel({
  clientId,
  viewer,
  messages,
}: {
  clientId: number;
  viewer: "client" | "coach";
  messages: ChatMessage[];
}) {
  return (
    <div className="chat-panel">
      <div className="chat-thread">
        {messages.length === 0 ? (
          <p className="empty-note">No messages yet — say hello below.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`chat-bubble-row ${m.sender === viewer ? "mine" : "theirs"}`}>
              <div className={`chat-bubble${m.media_path ? " chat-bubble-media" : ""}`}>
                {m.media_path && m.media_type === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.media_path} alt="" className="chat-bubble-img" />
                )}
                {m.media_path && m.media_type === "video" && (
                  <video src={m.media_path} controls className="chat-bubble-video" />
                )}
                {m.text && <div className="chat-bubble-text">{m.text}</div>}
                <div className="chat-bubble-time">{timeLabel(m.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <ChatComposeForm clientId={clientId} sender={viewer} />
    </div>
  );
}
