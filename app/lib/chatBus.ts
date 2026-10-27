// Chats in real time (27 Oct, Alex: "if it lags or bugs too much people won't like it"). Every change to a chat (a
// message, an edit, a reaction, a pin, a delete, a picture's look, the coach reading it) bumps that chat's revision
// and tells everyone listening (/api/chat/stream), so an open chat reads itself again within a second instead of on
// its 15 s poll. The thread actions take the revision the screen holds and send nothing when it is still current, so
// the polls left as a fallback cost next to nothing.
//
// One server process holds the store (as presence.ts), so the listeners live in memory. Kept on globalThis: server
// actions and route handlers can load this module twice, and both must share one set of listeners.

/** `typing`: no change, only that side typing (27 Oct, Alex: Typing…). */
type Listener = (clientId: number, rev: string, typing?: "coach" | "client") => void;
type Bus = { epoch: string; revs: Map<number, number>; listeners: Set<Listener> };

const g = globalThis as unknown as { __norcoachChatBus?: Bus };
const bus: Bus = (g.__norcoachChatBus ??= { epoch: Date.now().toString(36), revs: new Map(), listeners: new Set() });

/** Today on the server's clock (as queries.localDateStr; not imported, so queries can import this file). */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** The chat's revision: the server's start, how many changes since, and the day (the "Today" labels move at midnight). */
export function chatRev(clientId: number): string {
  return `${bus.epoch}.${bus.revs.get(clientId) ?? 0}.${today()}`;
}

/** Something in this client's chat changed: a new revision, and everyone listening is told. */
export function chatChanged(clientId: number | null | undefined) {
  if (clientId == null) return;
  bus.revs.set(clientId, (bus.revs.get(clientId) ?? 0) + 1);
  const rev = chatRev(clientId);
  for (const fn of bus.listeners) {
    try {
      fn(clientId, rev);
    } catch {}
  }
}

/** One side typing in this chat (27 Oct): told to everyone listening, nothing changed. At most once a second a side. */
const lastTyping = new Map<string, number>();
export function chatTyping(clientId: number, side: "coach" | "client") {
  const key = `${clientId}:${side}`;
  const now = Date.now();
  if (now - (lastTyping.get(key) ?? 0) < 1000) return;
  lastTyping.set(key, now);
  const rev = chatRev(clientId);
  for (const fn of bus.listeners) {
    try {
      fn(clientId, rev, side);
    } catch {}
  }
}

/** Listen for every chat change; returns the way to stop. */
export function onChatChange(fn: Listener): () => void {
  bus.listeners.add(fn);
  return () => void bus.listeners.delete(fn);
}

/** Still current: the screen already holds this revision, so nothing needs sending. */
export const chatCurrent = (clientId: number, known: string | null | undefined) => !!known && known === chatRev(clientId);

/** A chat read, timed for /api/timing (27 Oct: "measure before and after"): how long it took and its size in KB. */
export function timedChatRead<T>(screen: string, read: () => T): T {
  const t0 = performance.now();
  const out = read();
  const ms = performance.now() - t0;
  void import("./timing").then(({ recordTiming }) => {
    let kb = 0;
    try {
      kb = JSON.stringify(out).length / 1024;
    } catch {}
    recordTiming(screen, ms, { kb });
  });
  return out;
}
