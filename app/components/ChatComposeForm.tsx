"use client";

import { useRef } from "react";
import { sendChatMessageAction } from "../lib/actions";

// Deliberately does NOT import from ../lib/queries (see CheckInHub.tsx for
// why a "use client" file importing queries.ts breaks the dev server).
// Two ways to submit: type text and hit Send, or tap the paperclip to pick a
// photo/video, which submits immediately (same auto-submit-on-pick pattern
// as PhotoUploadBox).
export default function ChatComposeForm({ clientId, sender }: { clientId: number; sender: "client" | "coach" }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={sendChatMessageAction} className="chat-compose-form">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sender" value={sender} />
      <button
        type="button"
        className="chat-attach-btn"
        aria-label="Attach a photo or video"
        onClick={() => fileInputRef.current?.click()}
      >
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
        name="file"
        accept="image/*,video/*"
        className="chat-attach-input"
        onChange={() => formRef.current?.requestSubmit()}
      />
      <input name="text" type="text" placeholder="Message…" autoComplete="off" />
      <button type="submit" className="btn">
        Send
      </button>
    </form>
  );
}
