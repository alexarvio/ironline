"use client";

import { useEffect, useRef } from "react";

// Chats in real time (27 Oct, Alex), the screen's side of /api/chat/stream: one line a page, shared by every chat on
// it (the thread, the chat list, the phone's inbox). Each listener is told which chat changed, and every listener is
// told when the line (re)opens, so whatever came in while it was down is read at once. The 15 s polls stay as the
// fallback; with nothing new they send nothing (chatBus.ts).

type Listener = (clientId: number | null) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let closing: ReturnType<typeof setTimeout> | null = null;

const tell = (clientId: number | null) => {
  for (const fn of listeners) {
    try {
      fn(clientId);
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
      const { c } = JSON.parse(e.data) as { c: number };
      if (Number.isFinite(c)) tell(c);
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
    const off = hold((changed) => {
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
