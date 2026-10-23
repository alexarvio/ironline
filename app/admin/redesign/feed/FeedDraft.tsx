"use client";

import { useMemo, useState, useTransition, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { dismissHomeActionAction } from "../../../lib/actions";
import { Toaster } from "../../../components/ui/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { CalendarIcon, ChatIcon, CheckIcon, EyeIcon, LockIcon, MoreIcon, PlayIcon, PlusIcon } from "../../../components/icons";
import Pager from "../Pager";
import { SepJoin } from "../Sep";
import KindMark from "../KindMark";
import { dayMonth, logDate, logDateWidth } from "../../../lib/dayMonth";
// Types only: feedBoard.ts re-exports the server's reader, which must never reach the browser.
import type { ActivityKind, ActivityRow, FeedBoard, NeedRow } from "../../../lib/feedBoard";

// The coach's Feed (21 Oct, Alex: built from the Feed mockup, root "rd trn rls rh rfd"): every client at once, clear at a
// glance. Training's header, Home's Since line, then
// - Needs you: one task a row (not a client a row), its wait, its action as a white pill; ⋯ Done clears it;
// - Activity: a log, one line a row, New over Earlier, one kind at a time, 20 a page.
// Facts, not explanations; dates d/m (dayMonth), a log's rows by logDate; ink, never navy; weights 500 and 600.

const PAGE = 20;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** "2 sessions", "1 check-in"; nothing for none, so the part drops out. */
const count = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : null);
/** A moment's clock time, "18:48". */
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** A row opens its place on a click anywhere on it, except on its own links and buttons (and a portaled menu's items,
    whose clicks bubble through React). Ctrl or ⌘ opens it in a new tab. */
function useRowOpen() {
  const router = useRouter();
  return (e: MouseEvent<HTMLElement>, href: string | null | undefined) => {
    if (!href) return;
    if (!e.currentTarget.contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest("a, button, [role='menuitem']")) return;
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
    else router.push(href);
  };
}

/** The client's face, 24px: their photo, else their initial on a hairline ring. */
function Face({ name, src }: { name: string; src: string | null }) {
  return (
    <span className="rfd-face" aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
        <img src={src} alt="" />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

export default function FeedDraft({ board, now, kind }: { board: FeedBoard; /** The server's clock (ms), for the waits. */ now: number; /** ?cat=: the kind Activity opens on. */ kind?: string | null }) {
  return (
    <div className="rd trn rls rh rfd">
      {/* ---- Header: Training's, bare (no fact line, so no room kept for one). */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <div className="trn-name-row">
            <h1 className="trn-name">Feed</h1>
          </div>
        </div>
      </header>

      <SinceLine since={board.since} />
      <NeedsYou needs={board.needs} now={now} />
      <Activity rows={board.activity} kind={kind} />
      <Toaster />
    </div>
  );
}

// ---- Since the coach last looked, across every client: one quiet line, the date in ink, each count only when there is one.
function SinceLine({ since }: { since: FeedBoard["since"] }) {
  if (!since) return null;
  const facts = [
    count(since.sessions, "session", "sessions"),
    count(since.checkIns, "check-in", "check-ins"),
    count(since.foodDays, "food day", "food days"),
    count(since.messages, "message", "messages"),
    count(since.shapeUpdates, "shape update", "shape updates"),
  ];
  if (facts.every((f) => f == null)) return null;
  return (
    <p className="rh-sinceline">
      <SepJoin
        parts={[
          <span key="from">
            Since <b>{dayMonth(since.from)}</b>
          </span>,
          ...facts,
        ]}
      />
    </p>
  );
}

/** The section's title with what it holds right after it, on its line. */
function Titled({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rfd-titled">
      <h2>{title}</h2>
      {children ? <span>{children}</span> : null}
    </div>
  );
}

// ---- Needs you: a task a row. The face and name, the thing and their words, how long it has waited (rust past a day;
// a call today its time; an empty week "this week"), the action as a white pill: the row and the pill open the same
// place. ⋯ on hover: Done clears it (the row fades at once), when it can be cleared.
function needIcon(kind: NeedRow["kind"]) {
  switch (kind) {
    case "week":
      return <PlusIcon />;
    case "locked":
      return <LockIcon />;
    case "reply":
      return <ChatIcon />;
    case "video":
      return <PlayIcon />;
    case "ask-call":
    case "call":
      return <CalendarIcon />;
    case "read":
      return <EyeIcon />;
  }
}

function waitOf(n: NeedRow, now: number): { text: string; late: boolean } {
  if (n.kind === "call") return { text: n.time ? `today ${n.time}` : "today", late: false };
  if (!n.since) return { text: n.kind === "week" ? "this week" : "", late: false };
  const ms = Math.max(0, now - new Date(n.since).getTime());
  if (!Number.isFinite(ms)) return { text: "", late: false };
  if (ms < HOUR_MS) return { text: "just now", late: false };
  if (ms < DAY_MS) {
    const h = Math.floor(ms / HOUR_MS);
    return { text: `${h} ${h === 1 ? "hour" : "hours"}`, late: false };
  }
  const d = Math.floor(ms / DAY_MS);
  return { text: `${d} ${d === 1 ? "day" : "days"}`, late: true };
}

function NeedsYou({ needs, now }: { needs: NeedRow[]; now: number }) {
  const router = useRouter();
  const open = useRowOpen();
  const [, start] = useTransition();
  // Done: the row fades at once (out), then leaves the list (gone) while the server clears it.
  const [out, setOut] = useState<ReadonlySet<string>>(() => new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const rows = needs.filter((n) => !gone.has(n.key));
  const left = rows.filter((n) => !out.has(n.key)).length;
  const without = (key: string) => (s: ReadonlySet<string>) => {
    const next = new Set(s);
    next.delete(key);
    return next;
  };
  const done = (n: NeedRow) => {
    const id = n.dismissId;
    if (!id) return;
    setOut((s) => new Set(s).add(n.key));
    window.setTimeout(() => setGone((s) => new Set(s).add(n.key)), 220);
    start(async () => {
      try {
        await dismissHomeActionAction(n.clientId, id);
        router.refresh();
      } catch {
        setOut(without(n.key));
        setGone(without(n.key));
        toast.error("Couldn't save");
      }
    });
  };

  return (
    <section className="rls-section" aria-label="Needs you">
      <div className="trn-weekhead">
        <Titled title="Needs you">{left > 0 ? left : null}</Titled>
      </div>
      <div className="rls-card rfd-card">
        {rows.length === 0 ? (
          <p className="rls-none">None</p>
        ) : (
          <div className="rfd-rows">
            {rows.map((n) => {
              const w = waitOf(n, now);
              return (
                <div key={n.key} className={`rls-row rfd-row${out.has(n.key) ? " out" : ""}`}>
                  <div className="rls-row-main rfd-need" onClick={(e) => open(e, n.href)}>
                    <Link href={n.href} prefetch={false} className="rd-row-hit rfd-who">
                      <Face name={n.client} src={n.avatarPath} />
                      <span className="rfd-name">{n.client}</span>
                    </Link>
                    <span className="rfd-thing">
                      <span className="rfd-what">{n.what}</span>
                      {n.words && <span className="rfd-words">&ldquo;{n.words}&rdquo;</span>}
                    </span>
                    <span className={`rfd-wait${w.late ? " late" : ""}`}>{w.text}</span>
                    <span className="rfd-act">
                      <Link href={n.href} prefetch={false} className="trn-pill">
                        {needIcon(n.kind)} {n.action}
                      </Link>
                    </span>
                    <span className="rfd-more">
                      {n.dismissId && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className="trn-row-more" aria-label={`More for ${n.client}: ${n.what}`}>
                            <MoreIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="pb-menu">
                            <DropdownMenuItem onSelect={() => done(n)}>
                              <CheckIcon /> Done
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ---- Activity: a log (design rules 8), one line a row. The date, the time in its own column, the client semi-bold, the
// kind's icon in its colour (KindMark, as Home's), the thing, and only their own words grey after it, in quotes (23 Oct,
// Alex). What came since the last look under New, the rest under Earlier. One kind at a time, 20 a page, always a full
// page tall; a row opens its place.
type Filter = "all" | ActivityKind;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "training", label: "Training" },
  { id: "nutrition", label: "Nutrition" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "meetings", label: "Meetings" },
  { id: "messages", label: "Messages" },
];
/** ?cat= as the old Feed wrote it too ("measurements" was Lifestyle). */
const filterOf = (cat: string | null | undefined): Filter => (cat === "measurements" ? "lifestyle" : (FILTERS.find((f) => f.id === cat)?.id ?? "all"));

/** A New / Earlier label's height in the card (34px, 35 with its hairline), for the log's steady height. */
const GROUP_H = 35;

function Activity({ rows, kind }: { rows: ActivityRow[]; kind?: string | null }) {
  const open = useRowOpen();
  const [filter, setFilter] = useState<Filter>(() => filterOf(kind));
  const [page, setPage] = useState(1);
  const matching = filter === "all" ? rows : rows.filter((r) => r.kind === filter);
  const pages = Math.max(1, Math.ceil(matching.length / PAGE));
  const at = Math.min(page, pages);
  const from = (at - 1) * PAGE;
  const shown = matching.slice(from, from + PAGE);
  const pick = (id: Filter) => {
    setFilter(id);
    setPage(1);
  };
  // The date column as wide as the whole feed's widest date, so it never moves between kinds or pages.
  const dateW = useMemo(() => logDateWidth(rows.map((r) => r.at)), [rows]);
  // New and Earlier only while something under this kind is new; the steady height keeps room for both labels.
  const labelled = matching.some((r) => r.isNew);
  const anyNew = rows.some((r) => r.isNew);

  const items: ReactNode[] = [];
  let group: "new" | "earlier" | null = null;
  shown.forEach((r, i) => {
    const g = r.isNew ? "new" : "earlier";
    if (labelled && g !== group) {
      items.push(
        <p key={`group-${g}-${i}`} className="rfd-group">
          {g === "new" ? "New" : "Earlier"}
        </p>
      );
      group = g;
    }
    const date = <span className="rd-logdate">{logDate(new Date(r.at))}</span>;
    items.push(
      <div key={r.id} className={`rls-row rfd-row${r.href ? "" : " still"}`}>
        <div className="rls-row-main rfd-log" onClick={(e) => open(e, r.href)}>
          {r.href ? (
            <Link href={r.href} prefetch={false} className="rd-row-hit rfd-hit">
              {date}
            </Link>
          ) : (
            date
          )}
          <span className="rd-logtime">{r.timeKnown ? clock(r.at) : r.allDay ? "All day" : ""}</span>
          <span className="rfd-name">{r.client}</span>
          <KindMark mark={r.mark} />
          {/* The thing, then only the client's own words (23 Oct, Alex): no facts after it. */}
          <span className="rfd-line">
            <span className="rfd-title">{r.title}</span>
            {r.quote && <span className="rfd-rest">&ldquo;{r.quote}&rdquo;</span>}
          </span>
        </div>
      </div>
    );
  });

  return (
    <section className="rls-section" aria-label="Activity">
      <div className="trn-weekhead">
        <Titled title="Activity" />
        <div className="trn-weekhead-actions rh-kinds-wrap">
          <div className="rd-btn-group rh-kinds" role="group" aria-label="Which kind">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={filter === f.id ? "on" : ""} aria-pressed={filter === f.id} onClick={() => pick(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Always a full page tall (design rules 8): another kind or the last page never moves the pager. A full page is as
          many rows as All can show (up to 20), 53px a row with its hairline, and room for New and Earlier while anything is new. */}
      <div
        className="rls-card rfd-card rd-steady"
        style={{ "--rfd-date": `${dateW}px`, "--log-rows": Math.max(1, Math.min(PAGE, rows.length)), "--log-row": "53px", "--log-head": `${1 + (anyNew ? 2 * GROUP_H : 0)}px` } as CSSProperties}
      >
        {shown.length === 0 ? <p className="rls-none">None yet</p> : <div className="rfd-rows">{items}</div>}
      </div>
      {/* The pager floats under the card, not in it (21 Oct, Alex). */}
      <Pager page={at} pages={pages} from={from} shown={shown.length} total={matching.length} label="Activity pages" onPage={setPage} />
    </section>
  );
}
