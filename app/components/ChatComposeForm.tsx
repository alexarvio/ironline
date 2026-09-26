"use client";

import { useRef, useState, useTransition } from "react";
import { sendChatMessageAction } from "../lib/actions";
import type { MessageAbout } from "../lib/messageLinks";
import VoiceRecordButton from "./VoiceRecordButton";

// Deliberately does NOT import from ../lib/queries (see CheckInHub.tsx for
// why a "use client" file importing queries.ts breaks the dev server).
// Three ways to send: type and hit Send; tap the paperclip to pick a photo,
// video or any file, which goes at once; or hold the mic for a voice
// message, which goes when it stops. The mic and Send share the right-hand
// spot: the mic while the box is empty, Send as soon as anything is typed.
const ACCEPT = "image/*,video/*,audio/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip";

export default function ChatComposeForm({ clientId, sender, about = null, onClearAbout }: { clientId: number; sender: "client" | "coach"; /** What the next message is about: a chip over the box, sent as its link. */ about?: MessageAbout | null; onClearAbout?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const fit = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const sendFile = (file: File) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("text", "");
    fd.set("file", file);
    if (about) fd.set("link", JSON.stringify(about.link));
    start(async () => {
      await sendChatMessageAction(fd);
      onClearAbout?.();
    });
  };

  return (
    <>
    {about && (
      <div className="chat-about">
        <span className="chat-about-text">
          <span className="chat-about-label">About</span>
          <span className="chat-about-name">{about.label}</span>
        </span>
        <button type="button" className="chat-about-x" onClick={onClearAbout} aria-label="Don't attach this">
          ×
        </button>
      </div>
    )}
    <form
      ref={formRef}
      className="chat-compose-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || pending) return;
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("text", text.trim());
        if (about) fd.set("link", JSON.stringify(about.link));
        start(async () => {
          await sendChatMessageAction(fd);
          setText("");
          if (boxRef.current) boxRef.current.style.height = "auto";
          onClearAbout?.();
        });
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sender" value={sender} />
      <button type="button" className="chat-attach-btn" aria-label="Attach a photo, video or file" onClick={() => fileInputRef.current?.click()} disabled={pending}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path
            d="M17.5 8.5l-8 8a3.5 3.5 0 0 1-5-5l8.3-8.3a2.4 2.4 0 0 1 3.4 3.4l-8.1 8.1a1.3 1.3 0 0 1-1.9-1.9l7-7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="chat-attach-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) sendFile(f);
        }}
      />
      {/* Grows with what is typed, up to a few lines, then scrolls. Enter
          sends at a keyboard; on a phone it is a new line and Send sends. */}
      <textarea
        ref={boxRef}
        name="text"
        className="chat-compose-box"
        rows={1}
        placeholder="Message…"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          fit(e.currentTarget);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia("(pointer: coarse)").matches) {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        disabled={pending}
      />
      {text.trim() ? (
        <button type="submit" className="btn chat-send-btn" disabled={pending}>
          {pending ? "…" : "Send"}
        </button>
      ) : (
        <VoiceRecordButton className="chat-attach-btn chat-mic-btn" onRecorded={sendFile} disabled={pending} />
      )}
    </form>
    </>
  );
}
