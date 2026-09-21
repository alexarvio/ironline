"use client";

import { useRef, useState, useTransition } from "react";
import { sendChatMessageAction } from "../lib/actions";
import type { LinkView } from "../lib/messageLinks";
import type { LinkTargets } from "../lib/queries";
import MessageLinkPicker, { LinkIcon, type PickedLink } from "./MessageLinkPicker";

// The Messages tab: one box the coach types into, and the messages already
// sent underneath. A message is a nudge the client reads on their Home ("I
// noticed bench stalled last week, so I adjusted this week") — the small
// things that do not need a call. It can point at one thing in the client's
// app (Link to…), which the client taps straight through to.
export type CoachMessage = { id: number; text: string; when: string; link: LinkView | null };

export default function MessagesWorkspace({
  clientId,
  firstName,
  messages,
  targets,
}: {
  clientId: number;
  firstName: string;
  messages: CoachMessage[];
  targets: LinkTargets;
}) {
  const [text, setText] = useState("");
  const [link, setLink] = useState<PickedLink | null>(null);
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const ready = text.trim().length > 0 && !pending;

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
      setSent(true);
      setTimeout(() => setSent(false), 2000);
      box.current?.focus();
    });
  };

  return (
    <div className="msg-wrap">
      <section className="mw-card msg-compose">
        <div className="mw-label-row">
          <span className="mw-label">Message {firstName}</span>
          <span className="mw-label-right">Lands on their Home</span>
        </div>
        <textarea
          ref={box}
          className="msg-box"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder={`e.g. Noticed your bench stalled last week, so I've bumped the reps this week. Keep the RPE honest.`}
          disabled={pending}
        />
        {/* What the message points at: optional, one thing, shown before it goes. */}
        {link && (
          <div className="msg-link-chip">
            <LinkIcon />
            <span>{link.label}</span>
            <button type="button" onClick={() => setLink(null)} aria-label="Remove the link">
              ×
            </button>
          </div>
        )}
        <div className="msg-actions">
          <MessageLinkPicker targets={targets} onPick={setLink} />
          <span className="msg-hint">{sent ? "Sent." : "Ctrl+Enter to send"}</span>
          <button type="button" className="mw-primary msg-send" onClick={send} disabled={!ready}>
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </section>

      <section className="msg-feed">
        <div className="mw-label-row">
          <span className="mw-label">Sent</span>
          <span className="mw-label-right">{messages.length ? `${messages.length} message${messages.length === 1 ? "" : "s"}` : ""}</span>
        </div>
        {messages.length === 0 ? (
          <div className="mw-empty">Nothing sent yet. The first message shows up here.</div>
        ) : (
          <ul className="msg-list">
            {messages.map((m) => (
              <li key={m.id} className="msg-item">
                <div className="msg-item-when">{m.when}</div>
                <div className="msg-item-text">{m.text}</div>
                {m.link && (
                  <div className={`msg-link-chip sent${m.link.gone ? " gone" : ""}`} title={m.link.gone ? "The client can't open this any more" : undefined}>
                    <LinkIcon />
                    <span>{m.link.label}</span>
                    {m.link.gone && <em>no longer opens</em>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
