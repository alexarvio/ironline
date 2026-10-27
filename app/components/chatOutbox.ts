"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendChatMessageAction } from "../lib/actions";

// Never lose a message (27 Oct, Alex: step 2 of the chat). Every chat's words go through this outbox: on screen at once,
// kept on the phone (localStorage) until the server has them, so a dropped signal, a closed app or a failed send leaves
// them waiting, faint, with Not sent and a tap to try again; they go again by themselves when the signal comes back or
// the app comes back to the front, and on the next opening of the chat. Each carries a one-time key (nonce) the server
// remembers, so a send that did arrive but whose answer was lost is never posted twice.
// Words only: a photo, video, file or voice message is sent as it always was (it is too big to keep here).

export type Outgoing<Q = unknown> = {
  /** Its one-time key: the server takes each once. */
  key: string;
  text: string;
  /** The message it answers, and its quote as the chat draws it. */
  replyTo: number | null;
  quote: Q | null;
  /** The link it carries (MessageLink as JSON). */
  link: string | null;
  failed: boolean;
  /** The newest message on screen when it was sent: a message of these words newer than it is its server copy. */
  after: number;
};

const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function useChatOutbox<Q = unknown>(clientId: number, side: "coach" | "client", delivered: () => Promise<unknown> | void) {
  const storeKey = `norcoach.outbox.${side}.${clientId}`;
  const [outbox, setOutbox] = useState<Outgoing<Q>[]>([]);
  const list = useRef<Outgoing<Q>[]>([]);
  const busy = useRef(new Set<string>());
  const after = useRef(delivered);
  useEffect(() => {
    after.current = delivered;
  });

  const update = useCallback(
    (fn: (l: Outgoing<Q>[]) => Outgoing<Q>[]) => {
      const next = fn(list.current);
      list.current = next;
      setOutbox(next);
      try {
        if (next.length) window.localStorage.setItem(storeKey, JSON.stringify(next));
        else window.localStorage.removeItem(storeKey);
      } catch {}
    },
    [storeKey]
  );

  const deliver = useCallback(
    async (o: Outgoing<Q>) => {
      if (busy.current.has(o.key)) return;
      busy.current.add(o.key);
      update((l) => l.map((x) => (x.key === o.key ? { ...x, failed: false } : x)));
      const fd = new FormData();
      fd.set("clientId", String(clientId));
      fd.set("text", o.text);
      fd.set("quiet", "1");
      fd.set("nonce", o.key);
      if (o.replyTo) fd.set("replyTo", String(o.replyTo));
      if (o.link) fd.set("link", o.link);
      try {
        await sendChatMessageAction(fd);
      } catch {
        update((l) => l.map((x) => (x.key === o.key ? { ...x, failed: true } : x)));
        busy.current.delete(o.key);
        return;
      }
      try {
        await after.current();
      } catch {}
      update((l) => l.filter((x) => x.key !== o.key));
      busy.current.delete(o.key);
    },
    [clientId, update]
  );

  // Opening the chat: whatever was left unsent here goes now (shown as waiting until it has).
  useEffect(() => {
    const t = setTimeout(() => {
      let kept: Outgoing<Q>[] = [];
      try {
        kept = JSON.parse(window.localStorage.getItem(storeKey) ?? "[]");
      } catch {}
      if (!Array.isArray(kept) || !kept.length) return;
      list.current = kept.map((o) => ({ ...o, failed: true }));
      setOutbox(list.current);
      for (const o of kept) void deliver(o);
    }, 0);
    return () => clearTimeout(t);
  }, [storeKey, deliver]);

  // The signal back, or the app back in front: what is waiting goes again.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false) return;
      for (const o of list.current) if (o.failed) void deliver(o);
    };
    window.addEventListener("online", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("online", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, [deliver]);

  const send = useCallback(
    (text: string, opts: { replyTo?: number | null; quote?: Q | null; link?: string | null; after: number }) => {
      const o: Outgoing<Q> = { key: newKey(), text, replyTo: opts.replyTo ?? null, quote: opts.quote ?? null, link: opts.link ?? null, failed: false, after: opts.after };
      update((l) => [...l, o]);
      void deliver(o);
    },
    [deliver, update]
  );
  const retry = useCallback((key: string) => {
    const o = list.current.find((x) => x.key === key);
    if (o) void deliver(o);
  }, [deliver]);
  const drop = useCallback((key: string) => update((l) => l.filter((x) => x.key !== key)), [update]);

  return { outbox, send, retry, drop };
}

/** Its server copy is on screen (a message of its words, from this side, newer than when it was sent): hide it. */
export const landed = (o: Outgoing<unknown>, own: { id: number; text: string }[]) => own.some((m) => m.id > o.after && m.text.trim() === o.text.trim());

/**
 * The words in the box, kept on the phone per chat (27 Oct): leaving the chat, or the app closing, never loses them.
 * Returns the box's value and its setter; the kept words come back on opening. `keep` false (a message being
 * edited put in the box) changes the box without keeping it.
 */
export function useKeptDraft(key: string): [string, (v: string | ((t: string) => string), keep?: boolean) => void] {
  const [text, setTextState] = useState("");
  const storeKey = `norcoach.draft.${key}`;
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const kept = window.localStorage.getItem(storeKey);
        if (kept) setTextState((cur) => cur || kept);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [storeKey]);
  const setText = useCallback(
    (v: string | ((t: string) => string), keep = true) => {
      setTextState((cur) => {
        const next = typeof v === "function" ? v(cur) : v;
        if (keep) {
          try {
            if (next.trim()) window.localStorage.setItem(storeKey, next);
            else window.localStorage.removeItem(storeKey);
          } catch {}
        }
        return next;
      });
    },
    [storeKey]
  );
  return [text, setText];
}
