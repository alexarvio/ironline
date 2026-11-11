"use client";

import { createContext, useContext, useState, useTransition, type CSSProperties } from "react";
import { logDate, logDateWidth } from "../../lib/dayMonth";
import { useRouter } from "next/navigation";
import { CalendarIcon, CheckIcon, EyeIcon, LockIcon, PhaseFlagIcon, PlayIcon, PlusIcon } from "../../components/icons";
import { TrackIcon } from "./plan/PlanDraft";
import { dismissHomeActionAction, markSeenAction } from "../../lib/actions";
import { Dialog } from "../../components/ui/dialog";
import { ConfirmDialog } from "./training/TrainingDraft";
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

/** What a row is about, before its words (2 Nov, Alex: "can we use the correct icons… always use the same thing"): a phase
 *  missing or still a draft, a new client's first phase, the flag the Events screen gives a phase; something missing in a
 *  track, that track's own icon (training the dumbbell, nutrition the apple, lifestyle the heart); the rest, as the action. */
function markOf(item: TodoItem) {
  if (item.key === "setup" || item.key.startsWith("track-")) return <PhaseFlagIcon />;
  if (item.key === "week") return <TrackIcon track="training" size={16} />;
  if (item.key.startsWith("empty-")) return <TrackIcon track={item.tab === "measurements" ? "lifestyle" : item.tab === "nutrition" ? "nutrition" : "training"} size={16} />;
  return iconOf(item.kind);
}

/** The tab's strip. `onAct` does a row's action in place (Meetings' Mark completed and Book, Plan's New phase) and says
 *  so; anything it leaves goes to the row's place: on this tab its # (the tab opens the thing and lands on it), else there. */
export function TodoStrip({ tab, onAct }: { tab: DotTab; onAct?: (item: TodoItem) => boolean }) {
  const { clientId, items: all } = useContext(TodoContext);
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [, start] = useTransition();
  // Marked done by hand (2 Nov, Alex: "a button to override this"): gone at once, while the server lets them go.
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [asking, setAsking] = useState<TodoItem | null>(null);
  const items = (all ?? []).filter((i) => i.tab === tab && !gone.has(i.key));
  if (!items.length) return null;
  /** The rows the coach can let go: what the Feed's round check clears (not a sign-in lock, which ends by itself, nor a
   *  new client's first phase, which is no Needs-you item). */
  const canDone = (i: TodoItem) => i.kind !== "locked" && i.key !== "setup";
  const markDone = (list: TodoItem[]) => {
    setAsking(null);
    setGone((g) => new Set([...g, ...list.map((i) => i.key)]));
    start(async () => {
      await dismissHomeActionAction(clientId, list.map((i) => i.key));
      router.refresh();
    });
  };
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
  // The needs-you rows' structure (3 Nov, Alex: "similar to the ones we just did… the buttons should be icons without
  // words"; NeedGroups): the date it came in, its mark, the thing and their words, the wait, the action as its icon alone
  // (its word the tooltip), the round check. One client's tab, so no face or name. A strip with no dates drops the column.
  const dated = items.some((i) => i.since != null);
  const dateW = logDateWidth(items.filter((i) => i.since != null).map((i) => new Date(i.since!)));
  return (
    <section className={`rd-todo${dated ? "" : " nodate"}`} aria-label="To do" style={{ "--todo-date": `${dateW}px` } as CSSProperties}>
      {items.map((item) => {
        const wait = waitOf(item, now);
        return (
          <div key={item.key} className="rd-todo-row">
            {dated && <span className="rd-logdate rd-todo-date">{item.since != null ? logDate(new Date(item.since)) : ""}</span>}
            <span className="rd-todo-mark" aria-hidden="true">
              {markOf(item)}
            </span>
            <span className="rd-todo-thing">
              <span className="rd-todo-what">{item.what}</span>
              {item.words && <span className="rd-todo-words">&ldquo;{item.words}&rdquo;</span>}
            </span>
            {/* Worked out on the server and again in the browser: an hour may tick over between them. */}
            <span className="rd-todo-wait" suppressHydrationWarning>
              {wait}
            </span>
            <button type="button" className="rd-todo-act" title={item.action} aria-label={`${item.action}: ${item.what}`} onClick={() => go(item)}>
              {iconOf(item.kind)}
            </button>
            {/* Done without doing it: asks first (the pop-up), as the Feed's round check, green under the pointer. */}
            {canDone(item) ? (
              <button type="button" className="rd-todo-done" title="Mark done" aria-label={`Mark done: ${item.what}`} onClick={() => setAsking(item)}>
                <CheckIcon />
              </button>
            ) : (
              <span className="rd-todo-done-room" aria-hidden="true" />
            )}
          </div>
        );
      })}
      <Dialog open={asking != null} onOpenChange={(o) => !o && setAsking(null)}>
        {asking && (
          <ConfirmDialog
            title="Mark as done?"
            // A confirm pop-up's words (11 Nov, Alex: A of docs/boards/popup-anatomy-mockup.html): who does what, the choice
            // starting with its verb, the verb alone on the pill.
            description={`This takes “${asking.what}” off the list without sending anything.`}
            confirm="Done"
            // Several waiting on this tab: all of them at once, ticked first.
            tick={items.filter(canDone).length > 1 ? (items.filter(canDone).length === 2 ? "Also mark the other one as done" : `Also mark the other ${items.filter(canDone).length - 1} as done`) : null}
            onConfirm={(all) => markDone(all ? items.filter(canDone) : [asking])}
          />
        )}
      </Dialog>
    </section>
  );
}
