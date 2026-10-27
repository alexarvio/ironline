"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Chats in real time (27 Oct, Alex), the screen's side of /api/chat/stream: one line a page, shared by every chat on
// it (the thread, the chat list, the phone's inbox). Each listener is told which chat changed, and every listener is
// told when the line (re)opens, so whatever came in while it was down is read at once. The 15 s polls stay as the
// fallback; with nothing new they send nothing (chatBus.ts).

/** `typing`: nothing changed, only that side typing in the chat. */
type Listener = (clientId: number | null, typing?: "coach" | "client") => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let closing: ReturnType<typeof setTimeout> | null = null;

const tell = (clientId: number | null, typing?: "coach" | "client") => {
  for (const fn of listeners) {
    try {
      fn(clientId, typing);
    } catch {}
  }
};

function open() {
  if (source || typeof EventSource === "undefined") return;
  const es = new EventSource("/api/chat/stream");
  source = es;
  // Opened, or opened again after a drop: everyone reads their chat once.
  es.addEventListener("hello", () => tell(null));
  es.onmessage = (e) => {
    try {
      const { c, t } = JSON.parse(e.data) as { c: number; t?: "coach" | "client" };
      if (Number.isFinite(c)) tell(c, t === "coach" || t === "client" ? t : undefined);
    } catch {}
  };
  // A phone back from the background: its line may be dead without saying so; open a fresh one.
  const back = () => {
    if (document.visibilityState !== "visible" || source !== es) return;
    es.close();
    source = null;
    document.removeEventListener("visibilitychange", back);
    open();
  };
  document.addEventListener("visibilitychange", back);
}

function hold(fn: Listener): () => void {
  listeners.add(fn);
  if (closing) clearTimeout(closing);
  closing = null;
  open();
  return () => {
    listeners.delete(fn);
    // Kept a moment, so a screen swapping one chat for another doesn't drop and reopen the line.
    if (!listeners.size)
      closing = setTimeout(() => {
        if (listeners.size) return;
        source?.close();
        source = null;
      }, 5000);
  };
}

/**
 * Calls `onChange` when the chat of `clientId` changes (or, with `clientId` "all", any chat the viewer can see), and
 * once when the line opens. Calls close together are run once (`gapMs`), so a burst of reactions is one read.
 */
export function useChatStream(clientId: number | "all" | null, onChange: () => void, gapMs = 150) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    if (clientId == null) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = hold((changed, typing) => {
      if (typing) return;
      if (changed != null && clientId !== "all" && changed !== clientId) return;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        latest.current();
      }, gapMs);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [clientId, gapMs]);
}

/** How long Typing… stays up after the last word typed (the typing side says so at most every 2 s). */
const TYPING_MS = 5000;

/**
 * Typing… (27 Oct, Alex): true while `side` is typing in the chat of `clientId`, until 5 s after their last word or
 * the moment their message (or any change to the chat) comes in.
 */
export function useChatTyping(clientId: number | null, side: "coach" | "client"): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (clientId == null) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = hold((changed, who) => {
      if (changed !== clientId || (who && who !== side)) return;
      if (timer) clearTimeout(timer);
      timer = null;
      // A change to the chat (their message has come in): their typing is over.
      if (!who) return setTyping(false);
      setTyping(true);
      timer = setTimeout(() => setTyping(false), TYPING_MS);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
      setTyping(false);
    };
  }, [clientId, side]);
  return typing;
}

/** Tells the other side this one is typing: call it on every keystroke; it speaks at most every 2 s. */
export function useTypingSignal(send: () => Promise<unknown>) {
  const last = useRef(0);
  const latest = useRef(send);
  useEffect(() => {
    latest.current = send;
  });
  return useCallback(() => {
    const now = Date.now();
    if (now - last.current < 2000) return;
    last.current = now;
    void latest.current().catch(() => {});
  }, []);
}
