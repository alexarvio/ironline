"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteChatMessageAction, editChatMessageAction, markSeenAction, pinMessageAction, sendChatMessageAction, setMessageLinkAction } from "../lib/actions";
import type { LinkView } from "../lib/messageLinks";
import type { LinkTargets } from "../lib/queries";
import MessageReactions from "../components/MessageReactions";
import VoiceRecordButton from "../components/VoiceRecordButton";
import MessageLinkPicker, { LinkIcon, type PickedLink } from "./MessageLinkPicker";

// The Messages tab: one chat box. The conversation fills it, the client's
// bubbles on the left and the coach's on the right, and the bar to write in
// is docked at its foot. A message is the small thing that does not need a
// call, and the client answers from their app. A coach message can point at
// one thing in the client's app (Link to…), which the client taps straight
// through to; after sending, the coach can still reword it, point it at
// something, pin it to the top, or take it back. Either side can put one
// emoji on any message.
export type ChatMessageView = {
  id: number;
  /** The coach's own. */
  mine: boolean;
  text: string;
  when: string;
  /** "Wednesday, 16 September", for the heading a day's messages sit under. */
  day: string;
  media: { path: string; type: "image" | "video" | "audio" | "file"; name?: string | null } | null;
  link: LinkView | null;
  reactions: { coach: string | null; client: string | null };
  pinned: boolean;
  edited: boolean;
};

// How often the thread asks the server for anything new while it is open.
const POLL_MS = 15000;

export default function MessagesWorkspace({
  clientId,
  firstName,
  messages,
  targets,
}: {
  clientId: number;
  firstName: string;
  messages: ChatMessageView[];
  targets: LinkTargets;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [link, setLink] = useState<PickedLink | null>(null);
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  // One message at a time is being reworded, or getting a link.
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [linking, setLinking] = useState<number | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const ready = text.trim().length > 0 && !pending;

  // Opening the tab reads what the client wrote: the dot on the rail and the
  // row under "Needs you" clear. Then keep the thread fresh while it is open.
  useEffect(() => {
    markSeenAction(clientId, { tab: "messages" });
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [clientId, router]);
  // The newest message is at the bottom; land there, and follow new ones.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = () => {
    if (!ready) return;
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("text", text.trim());
    if (link) fd.set("link", JSON.stringify(link.link));
    startTransition(async () => {
      await sendChatMessageAction(fd);
      setText("");
      setLink(null);
      if (box.current) box.current.style.height = "auto";
      setSent(true);
      setTimeout(() => setSent(false), 2000);
      box.current?.focus();
    });
  };
  const act = (fn: () => Promise<void>) => startTransition(fn);
  // A picture, video, voice message or file goes on its own, at once.
  const fileInput = useRef<HTMLInputElement>(null);
  const sendFile = (file: File) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("text", "");
    fd.set("file", file);
    act(() => sendChatMessageAction(fd));
  };

  // Day headings: one per day, on its first message.
  const days: { day: string; items: ChatMessageView[] }[] = [];
  for (const m of messages) {
    const last = days[days.length - 1];
    if (last && last.day === m.day) last.items.push(m);
    else days.push({ day: m.day, items: [m] });
  }
  const pinned = messages.filter((m) => m.pinned);

  const bubble = (m: ChatMessageView, inPins = false) => (
    <div key={`${inPins ? "pin-" : ""}${m.id}`} className={`msg-bubble-row${m.mine ? " mine" : " theirs"}`}>
      <div className="msg-bubble-wrap">
        <div className={`msg-bubble${m.media ? " media" : ""}`}>
          {m.media && <Media media={m.media} />}
          {editing?.id === m.id && !inPins ? (
            <div className="msg-edit">
              <textarea
                className="msg-edit-box"
                rows={2}
                value={editing.text}
                autoFocus
                onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(null);
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    saveEdit();
                  }
                }}
                aria-label="Reword the message"
              />
              <div className="msg-edit-actions">
                <button type="button" className="msg-mini" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="button" className="msg-mini primary" disabled={!editing.text.trim() || editing.text.trim() === m.text} onClick={saveEdit}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            m.text && <div className="msg-bubble-text">{m.text}</div>
          )}
          {m.link && (
            <div className={`msg-link-chip sent${m.link.gone ? " gone" : ""}`} title={m.link.gone ? "The client can't open this any more" : undefined}>
              <LinkIcon />
              <span>{m.link.label}</span>
              {m.link.gone && <em>no longer opens</em>}
            </div>
          )}
          {/* Pointing a sent message at something: the same picker as the bar's, inside the bubble. */}
          {linking === m.id && !inPins && (
            <div className="msg-relink">
              <MessageLinkPicker
                targets={targets}
                onPick={(p) => {
                  setLinking(null);
                  act(() => setMessageLinkAction(clientId, m.id, JSON.stringify(p.link)));
                }}
              />
              <button type="button" className="msg-mini" onClick={() => setLinking(null)}>
                Cancel
              </button>
            </div>
          )}
          <div className="msg-bubble-when">
            {m.mine ? "You" : firstName} · {m.when.split(", ")[1] ?? m.when}
            {m.edited && <em> · edited</em>}
            {m.pinned && <em> · pinned</em>}
          </div>
        </div>
        <div className="msg-bubble-foot">
          <MessageReactions clientId={clientId} messageId={m.id} mine={m.reactions.coach} theirs={m.reactions.client} align={m.mine ? "right" : "left"} />
          {!inPins && (
            <BubbleMenu
              mine={m.mine}
              pinned={m.pinned}
              hasLink={!!m.link}
              onEdit={() => setEditing({ id: m.id, text: m.text })}
              onLink={() => setLinking(m.id)}
              onUnlink={() => act(() => setMessageLinkAction(clientId, m.id, null))}
              onPin={() => act(() => pinMessageAction(clientId, m.id, !m.pinned))}
              onDelete={() => {
                if (window.confirm(`Delete this message? It leaves ${firstName}'s Home too.`)) act(() => deleteChatMessageAction(clientId, m.id));
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
  function saveEdit() {
    if (!editing || !editing.text.trim()) return;
    const { id, text: t } = editing;
    setEditing(null);
    act(() => editChatMessageAction(clientId, id, t));
  }

  return (
    <div className="msg-chat">
      {/* What the coach pinned: kept at the top, every message still in its place below. */}
      {pinned.length > 0 && (
        <div className="msg-pins">
          <span className="msg-pins-label">Pinned</span>
          {pinned.map((m) => bubble(m, true))}
        </div>
      )}
      <section className="msg-thread" aria-label={`Conversation with ${firstName}`}>
        {messages.length === 0 ? (
          <div className="mw-empty">Nothing yet. What you write here lands on {firstName}&rsquo;s Home, and they answer from their app.</div>
        ) : (
          days.map((d) => (
            <div key={d.day} className="msg-day">
              <div className="msg-day-label">{d.day}</div>
              {d.items.map((m) => bubble(m))}
            </div>
          ))
        )}
        <div ref={end} />
      </section>

      {/* The bar at the foot: the link it points at, if one, then the box and Send. */}
      <div className="msg-bar">
        {link && (
          <div className="msg-link-chip">
            <LinkIcon />
            <span>{link.label}</span>
            <button type="button" onClick={() => setLink(null)} aria-label="Remove the link">
              ×
            </button>
          </div>
        )}
        <div className="msg-bar-row">
          <MessageLinkPicker targets={targets} onPick={setLink} />
          <button type="button" className="msg-attach" onClick={() => fileInput.current?.click()} disabled={pending} aria-label="Send a photo, video or file" title="Photo, video or file">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M17.5 8.5l-8 8a3.5 3.5 0 0 1-5-5l8.3-8.3a2.4 2.4 0 0 1 3.4 3.4l-8.1 8.1a1.3 1.3 0 0 1-1.9-1.9l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) sendFile(f);
            }}
          />
          <VoiceRecordButton className="msg-attach msg-mic" onRecorded={sendFile} disabled={pending} />
          <textarea
            ref={box}
            className="msg-box"
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // Grows with the words, up to a few lines.
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 140)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${firstName}… (Shift+Enter for a new line)`}
            aria-label={`Message ${firstName}`}
            disabled={pending}
          />
          <button type="button" className="mw-primary msg-send" onClick={send} disabled={!ready} title={sent ? "Sent" : "Send (Enter)"}>
            {pending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// A picture shows, a video and a voice message play, any other file downloads.
function Media({ media }: { media: NonNullable<ChatMessageView["media"]> }) {
  if (media.type === "video") return <video className="msg-bubble-video" src={media.path} controls playsInline />;
  if (media.type === "audio") return <audio className="msg-bubble-audio" src={media.path} controls preload="metadata" />;
  if (media.type === "file")
    return (
      <a className="msg-bubble-file" href={media.path} download={media.name ?? undefined} target="_blank" rel="noreferrer">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
        <span>{media.name ?? "File"}</span>
      </a>
    );
  // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
  return <img className="msg-bubble-img" src={media.path} alt="" />;
}

// The ⋯ on a bubble. The coach's own: reword, point it at something, pin,
// take back. The client's: pin.
function BubbleMenu({ mine, pinned, hasLink, onEdit, onLink, onUnlink, onPin, onDelete }: { mine: boolean; pinned: boolean; hasLink: boolean; onEdit: () => void; onLink: () => void; onUnlink: () => void; onPin: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const item = (label: string, fn: () => void, danger = false) => (
    <button
      type="button"
      className={`msg-menu-item${danger ? " danger" : ""}`}
      onClick={() => {
        setOpen(false);
        fn();
      }}
    >
      {label}
    </button>
  );
  return (
    <span ref={wrap} className="msg-menu">
      <button type="button" className="mr-btn msg-menu-btn" onClick={() => setOpen((o) => !o)} aria-label="More" aria-expanded={open}>
        ⋯
      </button>
      {open && (
        <span className="msg-menu-list" role="menu">
          {mine && item("Edit", onEdit)}
          {mine && item(hasLink ? "Change the link" : "Link to…", onLink)}
          {mine && hasLink && item("Remove the link", onUnlink)}
          {item(pinned ? "Unpin" : "Pin to the top", onPin)}
          {mine && item("Delete", onDelete, true)}
        </span>
      )}
    </span>
  );
}
