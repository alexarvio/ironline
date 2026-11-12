"use client";

import { useKeptDraft } from "./chatOutbox";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendChatMessageAction } from "../lib/actions";
import { newOnceKey } from "../lib/onceKey";
import { withVideoFrame } from "./ChatMedia";
import { uploadFirstOrThrow } from "../lib/uploadFirst";
import type { MessageAbout } from "../lib/messageLinks";
import VoiceRecordButton from "./VoiceRecordButton";
import RingEdge from "./RingEdge";
import { ChatAttachmentRow, useChatAttachment } from "./ChatAttachment";

// Deliberately does NOT import from ../lib/queries (see CheckInHub.tsx for
// why a "use client" file importing queries.ts breaks the dev server).
// Three ways to send: type and hit Send; tap the + to pick a photo, video
// or any file, which waits over the box until Send, words with it as one
// message (4 Nov, Alex: "there's no me pressing send. It sends
// automatically"); or hold the mic for a voice message, which goes when it
// stops. The mic and Send share the right-hand spot: the mic while the box
// is empty and nothing is picked, Send as soon as either is there.
const ACCEPT = "image/*,video/*,audio/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip";

export default function ChatComposeForm({
  clientId,
  sender,
  about = null,
  onClearAbout,
  onSending,
  onSent,
  onFailed,
  replyTo = null,
  onClearReply,
  onAddEvent = null,
  onTyping,
  onSendText,
  draftKey,
}: {
  /** The words go to the screen's outbox (27 Oct, step 2: kept until the server has them) instead of being sent here. */
  onSendText?: (words: string, opts: { replyTo: number | null; link: string | null }) => void;
  /** Keeps what is typed on the phone under this key (27 Oct): leaving the chat never loses it. */
  draftKey?: string;
  /** Called as words are typed (27 Oct, Alex: Typing… on the other side). */
  onTyping?: () => void;
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
  /** The server has it: the thread can ask for the real thing. With it, the send skips the page read (the thread asks for itself). */
  onSent?: () => void;
  /** It didn't go (no connection, too big): the words just shown as sending come off again; they are back in the box. */
  onFailed?: (text: string) => void;
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
  // A pick never sends (4 Nov, Alex): it waits over the box, already going up, until Send.
  const att = useChatAttachment(clientId);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    att.pick(f);
    // At a keyboard the box takes it back, so a caption can be typed and Enter sends (4 Nov, review); a phone's
    // keyboard is left down.
    if (!window.matchMedia("(pointer: coarse)").matches) boxRef.current?.focus();
  };
  const [pending, start] = useTransition();
  const [text, setKept] = useKeptDraft(draftKey ?? "off");
  const setText = (v: string | ((t: string) => string)) => setKept(v, !!draftKey);
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

  // A send that fails (no connection, a file over the limit) must not take
  // the app down (21 Oct: a throw in the transition reached the app's error
  // screen and the words were lost). It stays unsent: the link and the reply
  // stay over the box for another try.
  const deliver = async (fd: FormData) => {
    if (onSent) fd.set("quiet", "1");
    try {
      // A photo, video, voice message or file goes ahead to the server's disk; the send carries its handle (4 Nov, Alex: memory).
      await sendChatMessageAction(await uploadFirstOrThrow(fd, "chat", clientId));
    } catch {
      return false;
    }
    onClearAbout?.();
    onClearReply?.();
    onSent?.();
    return true;
  };
  // Words sent here that didn't go (the coach's panel, no outbox): Send again with the same words is that send again,
  // its one-time key with it, so one that did arrive and only lost its answer posts once (6 Nov, one-time key).
  const failedWords = useRef<{ words: string; nonce: string } | null>(null);
  // A voice message goes as it stops (it never waits over the box).
  const sendFile = (file: File) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("text", "");
    fd.set("file", file);
    // Its one-time key (6 Nov): sent again once the signal is back, it posts once.
    fd.set("nonce", newOnceKey());
    if (about) fd.set("link", JSON.stringify(about.link));
    if (replyTo) fd.set("replyTo", String(replyTo.id));
    start(async () => {
      await deliver(await withVideoFrame(fd, file));
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
    <ChatAttachmentRow att={att} sending={pending} />
    <form
      ref={formRef}
      className="chat-compose-form"
      onSubmit={(e) => {
        e.preventDefault();
        const picked = att.current;
        if ((!text.trim() && !picked) || pending) return;
        const fd = new FormData();
        const words = text.trim();
        if (picked) {
          // The file and the words as one message, as a file with a caption always went (4 Nov, Alex). Send waits for
          // the upload begun at the pick; the row and the words stay until the server has it, so nothing is lost.
          fd.set("clientId", String(clientId));
          fd.set("text", words);
          fd.set("nonce", picked.nonce);
          if (about) fd.set("link", JSON.stringify(about.link));
          if (replyTo) fd.set("replyTo", String(replyTo.id));
          if (onSent) fd.set("quiet", "1");
          start(async () => {
            try {
              // An upload that failed or was refused says so on the row already.
              const { upload, poster } = await att.take();
              fd.set("upload", upload);
              if (poster) fd.set("poster", new File([poster], "poster.jpg", { type: "image/jpeg" }));
            } catch {
              return;
            }
            try {
              await sendChatMessageAction(fd);
            } catch {
              // The send didn't go: the row says so (4 Nov, review: nothing did), the words and it kept for Send again.
              att.failSend();
              return;
            }
            att.clear();
            setText((t) => (t.trim() === words ? "" : t));
            if (boxRef.current) boxRef.current.style.height = "auto";
            onClearAbout?.();
            onClearReply?.();
            onSent?.();
          });
          return;
        }
        if (onSendText) {
          onSendText(words, { replyTo: replyTo?.id ?? null, link: about ? JSON.stringify(about.link) : null });
          setText("");
          if (boxRef.current) boxRef.current.style.height = "auto";
          onClearAbout?.();
          onClearReply?.();
          return;
        }
        fd.set("clientId", String(clientId));
        fd.set("text", words);
        const nonce = failedWords.current?.words === words ? failedWords.current.nonce : newOnceKey();
        failedWords.current = null;
        fd.set("nonce", nonce);
        if (about) fd.set("link", JSON.stringify(about.link));
        if (replyTo) fd.set("replyTo", String(replyTo.id));
        // The box clears and the thread shows the words straight away; the
        // server's copy replaces them when it answers.
        setText("");
        if (boxRef.current) boxRef.current.style.height = "auto";
        onSending?.(words);
        start(async () => {
          if (await deliver(fd)) return;
          // Not sent: the words go back in the box (unless something new was typed meanwhile).
          failedWords.current = { words, nonce };
          onFailed?.(words);
          setText((t) => t || words);
          requestAnimationFrame(() => fit(boxRef.current));
        });
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sender" value={sender} />
      <div className="chat-plus" ref={plusRef}>
        {/* The + opens the phone's own picker in one tap (4 Nov, Alex: our Camera | Camera roll | File menu came before
            the iPhone's own Photo Library | Take Photo or Video | Choose File, and its rows took two taps); a static
            plus, never turning. A menu only where there is more than a file to add (an event). As the coach phone. */}
        <button
          type="button"
          className={`chat-attach-btn chat-plus-btn${plusOpen ? " open" : ""}`}
          aria-label={onAddEvent ? "Add a photo, a video, a file or an event" : "Send a photo, video or file"}
          aria-expanded={onAddEvent ? plusOpen : undefined}
          // The box keeps the focus as + is tapped (13 Nov, Alex: the keyboard dropped and iOS's picker menu stayed where
          // the + had been, mid-screen): the keyboard and the + stay put under the menu.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (onAddEvent ? setPlusOpen((o) => !o) : fileInputRef.current?.click())}
          disabled={pending}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <RingEdge size={38} />
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
          if (e.target.value.trim()) onTyping?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia("(pointer: coarse)").matches) {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        // Read-only, never disabled, while a send goes: a disabled box loses the focus, and the phone's keyboard drops
        // between two messages (12 Nov, Alex: the keyboard "lags").
        readOnly={pending}
        aria-busy={pending || undefined}
      />
      {/* The round ink arrow, as every chat's (27 Oct, Alex: one composer for all three). */}
      {text.trim() || att.current ? (
        <button type="submit" className="chat-send-btn chat-send-round" disabled={pending || att.current?.status === "refused"} aria-label="Send" title="Send">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
        </button>
      ) : (
        <VoiceRecordButton className="chat-attach-btn chat-mic-btn" onRecorded={sendFile} disabled={pending} ring={38} />
      )}
    </form>
    </>
  );
}
