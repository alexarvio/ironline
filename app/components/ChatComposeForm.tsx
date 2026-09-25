"use client";

import { useRef, useState, useTransition } from "react";
import { sendChatMessageAction } from "../lib/actions";
import VoiceRecordButton from "./VoiceRecordButton";

// Deliberately does NOT import from ../lib/queries (see CheckInHub.tsx for
// why a "use client" file importing queries.ts breaks the dev server).
// Three ways to send: type and hit Send; tap the paperclip to pick a photo,
// video or any file, which goes at once; or hold the mic for a voice
// message, which goes when it stops. The mic and Send share the right-hand
// spot: the mic while the box is empty, Send as soon as anything is typed.
const ACCEPT = "image/*,video/*,audio/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip";

export default function ChatComposeForm({ clientId, sender }: { clientId: number; sender: "client" | "coach" }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [text, setText] = useState("");

  const sendFile = (file: File) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("text", "");
    fd.set("file", file);
    start(async () => {
      await sendChatMessageAction(fd);
    });
  };

  return (
    <form
      ref={formRef}
      className="chat-compose-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || pending) return;
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("text", text.trim());
        start(async () => {
          await sendChatMessageAction(fd);
          setText("");
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
      <input name="text" type="text" placeholder="Message…" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} disabled={pending} />
      {text.trim() ? (
        <button type="submit" className="btn chat-send-btn" disabled={pending}>
          {pending ? "…" : "Send"}
        </button>
      ) : (
        <VoiceRecordButton className="chat-attach-btn chat-mic-btn" onRecorded={sendFile} disabled={pending} />
      )}
    </form>
  );
}
