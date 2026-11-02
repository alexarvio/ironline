"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, CheckIcon, EyeIcon, LockIcon, PlayIcon, PlusIcon } from "../../components/icons";
import { dismissHomeActionAction, markSeenAction } from "../../lib/actions";
import { landOnSoon } from "../../lib/landOn";
import type { DotTab, TodoItem } from "./dots";

// The to-do strip (2 Nov, Alex: "if we just use dots, it can be a little bit confusing"; mockup A with the outline round
// the whole container, docs/boards/needs-strip-mockup.html): at the top of a client's tab, under its header, one row for
// each thing the rail counts on that tab: what it is, the client's words, how long it has waited, and the action that does
// it. Done, the row goes, and with the last one the strip and the tab's dot. Nothing owed: no strip. The rows come from
// the dot trail (loadDots, dots.ts), through RedesignShell. Styles: .rd-todo in training/draft.css.

export const TodoContext = createContext<{ clientId: number; items: TodoItem[] }>({ clientId: 0, items: [] });

/** To a # on the tab showing: the tab's own listener (#session-…, #day-…, #call-…) opens the thing, then it is landed on. */
export function goToHash(hash: string) {
  const here = window.location;
  window.history.replaceState(null, "", `${here.pathname}${here.search}${hash}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  landOnSoon(() => document.getElementById(hash.slice(1)), "center", 240);
}

const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;

/** How long it has waited, as the Feed's Needs you says it: "this week" for an empty week, "3 hours", "2 days". */
function waitOf(item: TodoItem, now: number): string {
  if (item.since == null) return item.kind === "week" ? "this week" : "";
  const ms = Math.max(0, now - item.since);
  if (ms < HOUR_MS) return "just now";
  if (ms < DAY_MS) {
    const h = Math.floor(ms / HOUR_MS);
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const d = Math.floor(ms / DAY_MS);
  return `${d} ${d === 1 ? "day" : "days"}`;
}

function iconOf(kind: TodoItem["kind"]) {
  switch (kind) {
    case "setup":
    case "week":
      return <PlusIcon />;
    case "locked":
      return <LockIcon />;
    case "video":
      return <PlayIcon />;
    case "ask-call":
      return <CalendarIcon />;
    case "complete-call":
      return <CheckIcon />;
    case "read":
      return <EyeIcon />;
  }
}

/** The tab's strip. `onAct` does a row's action in place (Meetings' Mark completed and Book, Plan's New phase) and says
 *  so; anything it leaves goes to the row's place: on this tab its # (the tab opens the thing and lands on it), else there. */
export function TodoStrip({ tab, onAct }: { tab: DotTab; onAct?: (item: TodoItem) => boolean }) {
  const { clientId, items: all } = useContext(TodoContext);
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [, start] = useTransition();
  const items = (all ?? []).filter((i) => i.tab === tab);
  if (!items.length) return null;
  const go = (item: TodoItem) => {
    // Read is reading it (2 Nov): the note is marked read now, whichever tab it is on, so its row, the tab's dot and the
    // rail's count go with it even where opening it marks nothing.
    if (item.kind === "read") {
      start(async () => {
        await (item.eventId ? markSeenAction(clientId, { ids: [item.eventId] }) : dismissHomeActionAction(clientId, item.key));
        router.refresh();
      });
    }
    if (onAct?.(item)) return;
    const to = new URL(item.href, window.location.origin);
    const asks = [...to.searchParams.keys()].filter((k) => k !== "client");
    // On this tab with nothing more to ask of the server: its #. Else there.
    if (!asks.length && to.hash) goToHash(to.hash);
    else if (item.kind !== "read" || asks.length || to.pathname !== `/admin/redesign/${tab}`) router.push(item.href);
  };
  return (
    <section className="rd-todo" aria-label="To do">
      {items.map((item) => {
        const wait = waitOf(item, now);
        return (
          <div key={item.key} className="rd-todo-row">
            <span className="rd-todo-mark" aria-hidden="true">
              {iconOf(item.kind)}
            </span>
            <span className="rd-todo-what">{item.what}</span>
            {item.words && <span className="rd-todo-words">&ldquo;{item.words}&rdquo;</span>}
            {/* Worked out on the server and again in the browser: an hour may tick over between them. */}
            {wait && (
              <span className="rd-todo-wait" suppressHydrationWarning>
                {wait}
              </span>
            )}
            <button type="button" className="rd-todo-act" onClick={() => go(item)}>
              {iconOf(item.kind)}
              {item.action}
            </button>
          </div>
        );
      })}
    </section>
  );
}
