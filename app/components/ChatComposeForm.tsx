"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

export default function ChatComposeForm({
  clientId,
  sender,
  about = null,
  onClearAbout,
  onSending,
  onSent,
  replyTo = null,
  onClearReply,
  onAddEvent = null,
}: {
  /** The plus menu's "Add an event" (7 Oct): what it does; "preview" lists it greyed (a coach previewing the
      client's app can't add one as them); null leaves it out (the coach's own chat panel). */
  onAddEvent?: (() => void) | "preview" | null;
  clientId: number;
  sender: "client" | "coach";
  /** What the next message is about: a chip over the box, sent as its link. */
  about?: MessageAbout | null;
  onClearAbout?: () => void;
  /** The words just sent, before the server has them: the thread can show them at once. */
  onSending?: (text: string) => void;
  /** The server has it: the thread can ask for the real thing. */
  onSent?: () => void;
  /** The one message this answers (2 Oct, as WhatsApp): quoted over the box, sent with it. */
  replyTo?: { id: number; who: string; text: string; own: boolean } | null;
  onClearReply?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // The plus on the left (7 Oct): take a photo or video, one from the camera
  // roll, a file, and for the client an event. Each pick is its own hidden
  // input, since the camera needs "capture" and the roll must not have it.
  const cameraRef = useRef<HTMLInputElement>(null);
  const rollRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!plusOpen) return;
    const away = (e: PointerEvent) => {
      if (!plusRef.current?.contains(e.target as Node)) setPlusOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPlusOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [plusOpen]);
  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) sendFile(f);
  };
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const fit = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  // Choosing Reply on a message puts the cursor in the box.
  const replyId = replyTo?.id ?? null;
  useEffect(() => {
    if (replyId != null) boxRef.current?.focus();
  }, [replyId]);

  const sendFile = (file: File) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("text", "");
    fd.set("file", file);
    if (about) fd.set("link", JSON.stringify(about.link));
    if (replyTo) fd.set("replyTo", String(replyTo.id));
    start(async () => {
      await sendChatMessageAction(fd);
      onClearAbout?.();
      onClearReply?.();
      onSent?.();
    });
  };

  return (
    <>
    {replyTo && (
      <div className="chat-about chat-replying">
        <span className={`cm-quote static${replyTo.own ? " own" : ""}`}>
          <b>Replying to {replyTo.who}</b>
          <span>{replyTo.text}</span>
        </span>
        <button type="button" className="chat-about-x" onClick={onClearReply} aria-label="Don't reply to it">
          ×
        </button>
      </div>
    )}
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
        const words = text.trim();
        fd.set("clientId", String(clientId));
        fd.set("text", words);
        if (about) fd.set("link", JSON.stringify(about.link));
        if (replyTo) fd.set("replyTo", String(replyTo.id));
        // The box clears and the thread shows the words straight away; the
        // server's copy replaces them when it answers.
        setText("");
        if (boxRef.current) boxRef.current.style.height = "auto";
        onSending?.(words);
        start(async () => {
          await sendChatMessageAction(fd);
          onClearAbout?.();
          onClearReply?.();
          onSent?.();
        });
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sender" value={sender} />
      <div className="chat-plus" ref={plusRef}>
        <button type="button" className={`chat-attach-btn chat-plus-btn${plusOpen ? " open" : ""}`} aria-label="Add a photo, a video, a file or an event" aria-expanded={plusOpen} onClick={() => setPlusOpen((o) => !o)} disabled={pending}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        {plusOpen && (
          <div className="chat-plus-menu" role="menu">
            <button type="button" role="menuitem" className="chat-plus-row" onClick={() => { setPlusOpen(false); cameraRef.current?.click(); }}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-2h5.4l1.2 2h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.6" /></svg>
              Camera
            </button>
            <button type="button" role="menuitem" className="chat-plus-row" onClick={() => { setPlusOpen(false); rollRef.current?.click(); }}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" /><circle cx="9" cy="10" r="1.6" fill="currentColor" /><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              Camera roll
            </button>
            <button type="button" role="menuitem" className="chat-plus-row" onClick={() => { setPlusOpen(false); fileInputRef.current?.click(); }}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17.5 8.5l-8 8a3.5 3.5 0 0 1-5-5l8.3-8.3a2.4 2.4 0 0 1 3.4 3.4l-8.1 8.1a1.3 1.3 0 0 1-1.9-1.9l7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              File
            </button>
            {onAddEvent && (
              <button
                type="button"
                role="menuitem"
                className="chat-plus-row"
                disabled={onAddEvent === "preview"}
                title={onAddEvent === "preview" ? "Only the client can add one, in their own app" : undefined}
                onClick={() => {
                  setPlusOpen(false);
                  if (typeof onAddEvent === "function") onAddEvent();
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                Event
                {onAddEvent === "preview" && <small>client only</small>}
              </button>
            )}
          </div>
        )}
        <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" className="chat-attach-input" onChange={pickFile} />
        <input ref={rollRef} type="file" accept="image/*,video/*" className="chat-attach-input" onChange={pickFile} />
        <input ref={fileInputRef} type="file" accept={ACCEPT} className="chat-attach-input" onChange={pickFile} />
      </div>
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
