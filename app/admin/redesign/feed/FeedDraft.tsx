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
import { Sep, SepJoin } from "../Sep";
import { dayMonth, logDate, logDateWidth } from "../../../lib/dayMonth";
import { meetingTypeOf } from "../../../lib/meetingTypes";
import { TRACK_ACCENT } from "../../phaseChrome";
import { TrackIcon } from "../plan/PlanDraft";
import type { PhaseTrack } from "../../../lib/db";
// Types only: feedBoard.ts re-exports the server's reader, which must never reach the browser.
import type { ActivityKind, ActivityRow, ClientDay, FeedBoard, NeedRow } from "../../../lib/feedBoard";

// The coach's Feed (21 Oct, Alex: built from the Feed mockup, root "rd trn rls rh rfd"): every client at once, clear at a
// glance. Training's header, Home's Since line, then
// - Needs you: one task a row (not a client a row), its wait, its action as a white pill; ⋯ Done clears it;
// - Clients: a row a client, the last active first: their last 14 days as Home's Consistency strip made small, this
//   week's sessions, when they were last active, at most two state pills; All clients | Needs attention;
// - Activity: a log, one line a row, New over Earlier, one kind at a time, 20 a page.
// Facts, not explanations; dates d/m (dayMonth), a log's rows by logDate; ink, never navy; weights 500 and 600.

const PAGE = 20;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** "2 sessions", "1 check-in"; nothing for none, so the part drops out. */
const count = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : null);
/** A track's colour at a strength (a hex from phaseChrome): the soft fill under its full-strength edge. */
const tintOf = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
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
      <Clients clients={board.clients} />
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

// ---- Clients: a row a client, the last active first. The face and name, their last 14 days as Home's Consistency
// strip made small, this week's sessions, when they were last active (the date, the time faint in its own column), at
// most two state pills (the coach's side rust, the client's grey). The row opens their Home; a pill the tab that fixes it.
/** The three behaviours of a day in the tracks' order, as Home's Consistency (21 Oct, Alex). */
const STRIP: { key: "checkIn" | "trained" | "food"; label: string; track: PhaseTrack; yes: string; no: string }[] = [
  { key: "checkIn", label: "Check-in", track: "lifestyle", yes: "checked in", no: "no check-in" },
  { key: "trained", label: "Trained", track: "training", yes: "trained", no: "no session" },
  { key: "food", label: "Food", track: "nutrition", yes: "food logged", no: "no food logged" },
];
const stripColours = (track: PhaseTrack) => {
  const c = TRACK_ACCENT[track];
  return { "--c": c, "--t": tintOf(c, 0.18) } as CSSProperties;
};

function Strip({ days }: { days: ClientDay[] }) {
  const said = STRIP.map((s) => `${s.label} ${days.filter((d) => d[s.key]).length} of ${days.length}`).join(", ");
  return (
    <span className="rfd-strip" role="img" aria-label={`Last ${days.length} days: ${said}`}>
      {STRIP.map((s) => (
        <span key={s.key} className="rfd-strip-row" style={stripColours(s.track)}>
          {days.map((d) => (
            <i key={d.date} className={d[s.key] ? "on" : undefined} title={`${dayMonth(d.date)}: ${d[s.key] ? s.yes : s.no}`} />
          ))}
        </span>
      ))}
    </span>
  );
}

function Clients({ clients }: { clients: FeedBoard["clients"] }) {
  const open = useRowOpen();
  const [view, setView] = useState<"all" | "attention">("all");
  const attention = clients.rows.filter((c) => c.attention);
  const rows = view === "attention" ? attention : clients.rows;
  // The date column as wide as the whole list's widest date, so it never moves between views.
  const dateW = useMemo(() => logDateWidth(clients.rows.map((c) => c.lastActive).filter((d): d is string => !!d)), [clients.rows]);
  const span = clients.rows.find((c) => c.days.length > 0)?.days.length ?? 14;
  const facts = [clients.activeThisWeek > 0 && `${clients.activeThisWeek} active this week`, clients.quiet > 0 && `${clients.quiet} quiet`];

  return (
    <section className="rls-section" aria-label="Clients">
      <div className="trn-weekhead">
        <Titled title="Clients">{facts.some(Boolean) ? <SepJoin parts={facts} /> : null}</Titled>
        <div className="trn-weekhead-actions">
          <div className="rd-btn-group" role="group" aria-label="Which clients">
            <button type="button" className={view === "all" ? "on" : ""} aria-pressed={view === "all"} onClick={() => setView("all")}>
              All clients
              <Sep />
              {clients.rows.length}
            </button>
            <button type="button" className={view === "attention" ? "on" : ""} aria-pressed={view === "attention"} onClick={() => setView("attention")}>
              Needs attention
              <Sep />
              {attention.length}
            </button>
          </div>
        </div>
      </div>
      <div className="rls-card rfd-card" style={{ "--rfd-date": `${dateW}px` } as CSSProperties}>
        {rows.length === 0 ? (
          <p className="rls-none">{clients.rows.length === 0 ? "No clients yet" : "None"}</p>
        ) : (
          <div className="rfd-rows">
            {rows.map((c) => (
              <div key={c.clientId} className="rls-row rfd-row">
                <div className="rls-row-main rfd-client" onClick={(e) => open(e, c.href)}>
                  <Link href={c.href} prefetch={false} className="rd-row-hit rfd-who">
                    <Face name={c.name} src={c.avatarPath} />
                    <span className="rfd-name">{c.name}</span>
                  </Link>
                  <Strip days={c.days} />
                  {c.sessions ? (
                    <span className="rfd-sessions" title={`${c.sessions.done} of ${c.sessions.planned} sessions this week`}>
                      {c.sessions.done} of {c.sessions.planned}
                    </span>
                  ) : (
                    <span className="rfd-sessions none" title="No sessions this week">
                      –
                    </span>
                  )}
                  <span className="rd-logdate rfd-last">{c.lastActive ? logDate(new Date(c.lastActive)) : <span className="rfd-dash">–</span>}</span>
                  <span className="rd-logtime">{c.lastActive ? clock(c.lastActive) : ""}</span>
                  <span className="rfd-pills">
                    {c.pills.slice(0, 2).map((p, i) => (
                      <Link key={i} href={p.href} prefetch={false} className={`trn-state rfd-pill${p.side === "coach" ? " warn" : ""}`} title={p.text}>
                        <span>{p.text}</span>
                      </Link>
                    ))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {clients.rows.length > 0 && (
        <div className="rh-key rfd-key">
          {STRIP.map((s) => (
            <span key={s.key}>
              <i className="rfd-sw" style={stripColours(s.track)} aria-hidden="true" />
              {s.label}
            </span>
          ))}
          <Sep />
          <span>Last {span} days</span>
        </div>
      )}
    </section>
  );
}

// ---- Activity: a log (design rules 8), one line a row. The date, the time in its own column, the client semi-bold, the
// kind's icon in its colour, the thing, the rest grey after it, their words in quotes. What came since the last look
// under New, the rest under Earlier. One kind at a time, 20 a page, always a full page tall; a row opens its place.
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

/** A kind's icon and colour: a track's own; a call the Check-in call's video in its blue; a message the chat bubble, grey. */
const CALL = meetingTypeOf("checkin");
const CHAT_ICON = "M4 5h16v11H9l-5 4z";
const KIND: Record<ActivityKind, { label: string; color: string; track?: PhaseTrack; path?: string }> = {
  training: { label: "Training", color: TRACK_ACCENT.training, track: "training" },
  nutrition: { label: "Nutrition", color: TRACK_ACCENT.nutrition, track: "nutrition" },
  lifestyle: { label: "Lifestyle", color: TRACK_ACCENT.lifestyle, track: "lifestyle" },
  meetings: { label: "Meetings", color: CALL.color, path: CALL.icon },
  messages: { label: "Message", color: "#5b6474", path: CHAT_ICON },
};
function KindMark({ kind }: { kind: ActivityKind }) {
  const k = KIND[kind] ?? KIND.messages;
  return (
    <span className="rfd-kind" style={{ "--c": k.color } as CSSProperties} title={k.label}>
      {k.track ? (
        <TrackIcon track={k.track} size={16} />
      ) : (
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={k.path} />
        </svg>
      )}
      <span className="sr-only">{k.label}</span>
    </span>
  );
}

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
          <span className="rd-logtime">{r.timeKnown ? clock(r.at) : ""}</span>
          <span className="rfd-name">{r.client}</span>
          <KindMark kind={r.kind} />
          <span className="rfd-line">
            <span className="rfd-title">{r.title}</span>
            {(r.rest.length > 0 || r.quote) && (
              <span className="rfd-rest">
                <SepJoin parts={[...r.rest, r.quote ? `“${r.quote}”` : null]} />
              </span>
            )}
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
