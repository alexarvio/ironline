"use client";

import Pager from "../Pager";
import { useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { deleteClientConfirmedAction, saveCoachNoteAction, sendChatMessageAction } from "../../../lib/actions";
import { useOpenChat } from "../ChatPanel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import ClientCardEditor from "../../ClientCardEditor";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { AccountIcon, ChatIcon, MoreIcon, TrashIcon } from "../../../components/icons";
import type { OverviewInfoRow, OverviewPanel } from "../../../lib/queries";
// Types only: homeBoard.ts re-exports the server's reader, which must never reach the browser.
import type { HomeBoard, MuscleGroup, MuscleWindow, PerGroup } from "../../../lib/homeBoard";
import { MessageDialog } from "../training/TrainingDraft";
import AppAccessButton from "./AppAccessButton";
import type { ClientAccess } from "../../../lib/access-actions";
import { dayMonth, logDate, logDateWidth } from "../../../lib/dayMonth";
import { SepJoin } from "../Sep";
import { TRACK_ACCENT, TRACK_LABEL } from "../../phaseChrome";
import { TrackIcon } from "../plan/PlanDraft";
import type { PhaseTrack } from "../../../lib/db";

// The client's Home (21 Oct, Alex: built from the Home mockup, root "rd trn rls rh"): Training's header, then the board.
//
// - The header: face, name (the whole of it, wrapping if it must), nothing after it;
//   App access, Details and Message as white pills, ⋯ to delete.
// - Since: what they did since the coach last looked, one quiet line.
// - The three tracks (Lifestyle, Training, Nutrition): the phase, its week and how far in, then the one figure that
//   matters right under it. A tile opens its tab.
// - Muscle balance (sets or volume per group over 7d, 30d or the phase, one against the window before or several
//   together) beside Strength (all six groups, over 7d, 30d or the phase) and Weight (the phase's readings).
// - Consistency (the last 30 days, a square a day, per behaviour) with Meetings (the next call big, the last at the foot)
//   and Invoices (what is owed big; the last paid and the next to be made at the foot) beside it; each opens its tab.
// - Activity: what they did, one kind at a time, a page at a time; every row leads with its date.
// Details is a pop-up: member info, coaching info and the coach's own note.

/** at: when it happened (ms), for the row's date. href: the thing itself (a session, a food day, an invoice), from feedHref. */
export type DraftEvent = { id: string; category: string; text: string; note: string | null; at: number; when: string; tab: string; href: string | null };
export type DraftHome = {
  name: string;
  initial: string;
  avatarPath: string | null;
  /** The whole client card, for the live editor in the Details dialog. */
  panel: OverviewPanel;
  coachNote: { text: string; savedLabel: string | null };
  events: DraftEvent[];
  /** The client's login, for the App access button (read with the page: no second call). */
  access: ClientAccess;
  /** The board: tracks, calls, invoices, muscle balance, strength, weight, consistency (app/lib/homeBoard.ts). */
  board: HomeBoard;
};

const savedToast = (what: string) => toast.success("Saved", { description: what });

// The tabs' ids, as the shell names them.
const DRAFT_TAB: Record<string, string> = {
  plan: "plan",
  training: "training",
  nutrition: "nutrition",
  measurements: "measurements",
  meetings: "meetings",
  photos: "pictures",
  messages: "messages",
  invoices: "invoices",
  billing: "invoices",
};
/** A track's tab in the shell (Lifestyle is "measurements"). */
const TRACK_TAB: Record<PhaseTrack, string> = { lifestyle: "measurements", training: "training", nutrition: "nutrition" };
const TRACK_ORDER: PhaseTrack[] = ["lifestyle", "training", "nutrition"];

// Activity: All first, then one kind at a time; every source category has a home here.
const FILTERS: { id: string; label: string; has: (e: DraftEvent) => boolean }[] = [
  { id: "all", label: "All", has: () => true },
  { id: "training", label: "Training", has: (e) => e.category === "training" },
  { id: "nutrition", label: "Nutrition", has: (e) => e.category === "nutrition" },
  { id: "lifestyle", label: "Lifestyle", has: (e) => e.category === "measurements" },
  { id: "invoices", label: "Invoices", has: (e) => e.category === "billing" },
  // A call asked for or a note on one: with the meetings, not the messages.
  { id: "meetings", label: "Meetings", has: (e) => e.category === "meetings" || e.tab === "meetings" },
  { id: "messages", label: "Messages", has: (e) => (e.category === "messages" || e.category === "notes") && e.tab !== "meetings" },
];
const PAGE = 20;

/** A line the server writes with "a · b": its parts, for a bar between them (design rules 1). Never cut inside “…”: the
    client's own words (an event called "Trip · Rome") stay whole. `bars`: " | " parts it too, for the board's own strings
    alone (a tile's "P 200 | C 300 | F 80"); Activity's texts carry session names that may hold one ("Upper | Push"). */
const parts = (s: string, bars = false) => {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "“") depth++;
    else if (s[i] === "”") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (s.startsWith(" · ", i) || (bars && s.startsWith(" | ", i)))) {
      out.push(s.slice(from, i));
      from = i + 3;
      i += 2;
    }
  }
  out.push(s.slice(from));
  return out.map((p) => p.trim()).filter(Boolean);
};
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The card's dates as every date in words is written (design rules 7): 25/5, 12/3/1994. */
const dated = (rows: OverviewInfoRow[]) => rows.map((r) => (ISO_DAY.test(r.value) ? { ...r, value: dayMonth(r.value) } : r));
/** A day or a moment, as a time: a yyyy-mm-dd day at its noon. */
const timeOf = (d: string) => new Date(ISO_DAY.test(d) ? `${d}T12:00:00` : d).getTime();
/** An Activity row's clock time ("18:48"), from the server's "21/10 · 18:48"; none when only the day is known. */
const clockOf = (when: string) => parts(when).find((p) => /^\d{1,2}:\d{2}$/.test(p)) ?? null;

// ---- Figures in words.
const MINUS = "−";
/** One decimal, with its sign: +1.2, −0.4, 0.0. */
const signed1 = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? MINUS : ""}${Math.abs(r).toFixed(1)}`;
};
const kg1 = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)} kg`;
const money = (n: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n || 0);
/** "2 sessions", "1 check-in"; nothing for none, so the part drops out. */
const count = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : null);
/** Volume per group, one unit for the whole chart from its largest value: all in t once that reaches 1000 kg (one
    decimal under 10 t: "4.2 t", "22 t"), else all in kg; nothing as "0". */
const volumeIn = (max: number) => (v: number) => {
  if (!(v > 0)) return "0";
  if (max < 1000) return `${Math.round(v)} kg`;
  const t = v / 1000;
  return `${t < 10 ? Math.max(0.1, Math.round(t * 10) / 10) : Math.round(t)} t`;
};
const setsOf = (v: number) => String(Math.round(v));
/** Strength's change: one decimal under 10%, whole above; a real minus. */
const pctOf = (p: number) => (Math.abs(p) < 10 ? Math.round(p * 10) / 10 : Math.round(p));
const pctText = (r: number) => (r === 0 ? "0%" : `${r > 0 ? "+" : MINUS}${Math.abs(r)}%`);

// The radar's axes, clockwise from the top (21 Oct, Alex's mockup).
const AXES: MuscleGroup[] = ["Back", "Chest", "Core", "Legs", "Shoulders", "Arms"];
/** Strength's rows: the same six groups, always all of them (21 Oct, Alex), in the contract's order (MUSCLE_GROUPS,
    written out here: homeBoard.ts's values would bring the server's reader into the browser). */
const STRENGTH_GROUPS: MuscleGroup[] = ["Back", "Chest", "Shoulders", "Arms", "Legs", "Core"];
type Measure = "sets" | "volume";
/** Strength's windows, in Muscle balance's order (21 Oct, Alex: the same toggle). */
type StrengthSpan = "7d" | "30d" | "phase";
const STRENGTH_SPANS: { id: StrengthSpan; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "phase", label: "Phase" },
];
/** A track's colour at a strength (a hex from phaseChrome): the soft fill under its full-strength edge, as a phase's bar. */
const tintOf = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export default function HomeDraft({ clientId, firstName, home, onOpenTab }: { clientId: number; firstName: string; home: DraftHome; onOpenTab: (tab: string) => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Every save goes to the server, then the page re-reads; what is on screen follows.
  const act = (fn: () => Promise<unknown>, said?: string) =>
    startTransition(async () => {
      await fn();
      router.refresh();
      if (said) savedToast(said);
    });
  const fd = (o: Record<string, string | number | null | undefined>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) if (v != null) f.set(k, String(v));
    return f;
  };
  const openChat = useOpenChat();
  const [msg, setMsg] = useState(false);
  // Message opens the chat panel on their thread, as on every tab; outside the shell, a message pop-up.
  const message = () => (openChat ? openChat() : setMsg(true));
  const [details, setDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photo, setPhoto] = useState(false);
  const panel = useMemo(() => ({ ...home.panel, memberInfo: dated(home.panel.memberInfo), coachingInfo: dated(home.panel.coachingInfo) }), [home.panel]);
  const board = home.board;

  const [filter, setFilter] = useState(FILTERS[0].id);
  const [page, setPage] = useState(1);
  const has = (FILTERS.find((f) => f.id === filter) ?? FILTERS[0]).has;
  const matching = home.events.filter(has);
  const pages = Math.max(1, Math.ceil(matching.length / PAGE));
  const at = Math.min(page, pages);
  const from = (at - 1) * PAGE;
  const shown = matching.slice(from, from + PAGE);
  const pick = (id: string) => {
    setFilter(id);
    setPage(1);
  };
  const go = (e: DraftEvent) => {
    if (e.href) return router.push(e.href);
    const t = DRAFT_TAB[e.tab];
    if (t) onOpenTab(t);
  };

  // The date at the left of its column, the time centred in one of its own (21 Oct, Alex: every time lines up), then
  // the thing. The date column is as wide as the whole feed's widest date, so it never moves between kinds or pages.
  const dateW = useMemo(() => logDateWidth(home.events.map((e) => new Date(e.at))), [home.events]);
  const actGrid = { gridTemplateColumns: `${dateW}px 48px minmax(0, 1fr)`, columnGap: 12 } as const;

  return (
    <div className="rd trn rls rh">
      {/* ---- Header: Training's, with the face before the name. No fact line, so no room kept for one. The face and
          the face sits on the name's (first) line, however many lines the whole name takes; nothing after the name. */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <span className="trn-eyebrow">Home</span>
          <div className="trn-name-row rh-name-row">
            {/* The face opens large. */}
            <button
              type="button"
              className="rh-avatar"
              onClick={() => home.avatarPath && setPhoto(true)}
              title={home.avatarPath ? "See the photo" : undefined}
              aria-label={home.avatarPath ? `${home.name}'s photo` : undefined}
              disabled={!home.avatarPath}
            >
              {home.avatarPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
                <img src={home.avatarPath} alt="" />
              ) : (
                home.initial
              )}
            </button>
            <h1 className="trn-name rh-name">{home.name}</h1>
          </div>
        </div>
        <div className="trn-head-actions">
          {/* White pills with an icon, as every tab's own actions (design rules 9b). */}
          <AppAccessButton key={clientId} clientId={clientId} firstName={firstName} initial={home.access} />
          <button type="button" className="trn-pill" onClick={() => setDetails(true)}>
            <AccountIcon /> Details
          </button>
          <button type="button" className="trn-pill" onClick={message}>
            <ChatIcon /> Message
          </button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="trn-more" aria-label={`More for ${firstName}`}>
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <TrashIcon /> Delete {firstName}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <SinceLine since={board.since} />

      {/* ---- The three tracks, in their order: the phase, its week, the one figure. A tile opens its tab (Plan when none). */}
      <section className="rh-tiles" aria-label="Phases">
        {[...board.tracks]
          .sort((a, b) => TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track))
          .map((t) => (
            <PhaseTile key={t.track} tile={t} onOpen={() => onOpenTab(t.phase ? TRACK_TAB[t.track] : "plan")} />
          ))}
      </section>

      {/* ---- Muscle balance beside Strength and Weight. */}
      <div className="rh-duo">
        <MuscleCard muscles={board.muscles} />
        <div className="rh-stack">
          <StrengthCard strength={board.strength} />
          <WeightCard weight={board.weight} />
        </div>
      </div>

      {/* ---- Consistency, and beside it the calls and the invoices, each a card that opens its tab. */}
      <div className="rh-trio">
        <ConsistencyCard days={board.days} phaseDays={board.phaseDays} />
        <MeetingsCard next={board.nextCall} last={board.lastCall} onOpen={() => onOpenTab("meetings")} />
        <InvoicesCard owed={board.outstanding} paid={board.lastPaid} next={board.nextInvoice} onOpen={() => onOpenTab("invoices")} />
      </div>

      {/* ---- Activity: what they did, one kind at a time. A log (design rules 8): the date first as every log's
          (logDate, .rd-logdate) with the time centred in its own column (.rd-logtime), the thing semi-bold, the rest in grey after it on the one
          line. A row opens the thing on its tab. */}
      <section className="rls-section">
        <div className="trn-weekhead">
          <div>
            <h2>Activity</h2>
          </div>
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
        {/* Always a full page tall (21 Oct, Alex): another kind or the last page never moves the pager. A full page is as
            many rows as All can show (up to 20), as Lifestyle's check-ins: a new client's three rows keep a short card.
            53px a row with its hairline; the first has none but the card's two 1px edges add one. */}
        <div className="rls-card rh-card rd-steady" style={{ "--log-rows": Math.max(1, Math.min(PAGE, home.events.length)), "--log-row": "53px", "--log-head": "1px" } as CSSProperties}>
          {shown.length === 0 ? (
            <p className="rls-none">None yet</p>
          ) : (
            <div className="rh-rows">
              {shown.map((e) => {
                const [head, ...rest] = parts(e.text.charAt(0).toUpperCase() + e.text.slice(1));
                const clock = clockOf(e.when);
                return (
                  <div key={e.id} className="rls-row rh-row">
                    <div className="rls-row-main" style={actGrid} onClick={() => go(e)}>
                      <span className="rd-logdate">{logDate(new Date(e.at))}</span>
                      <span className="rd-logtime">{clock}</span>
                      <span className="rh-what">
                        <button type="button" className="rd-row-hit rh-what-title">
                          {head}
                        </button>
                        {(rest.length > 0 || e.note) && (
                          <span className="rh-what-note">
                            <SepJoin parts={[...rest, e.note ? `“${e.note}”` : null]} />
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* The pager floats under the card, not in it (21 Oct, Alex). */}
        <Pager page={at} pages={pages} from={from} shown={shown.length} total={matching.length} label="Activity pages" onPage={setPage} />
      </section>

      {/* ---- Details: the card and the coach's note. Non-modal: the card's Edit opens its form in a layer of its own,
          which a modal dialog would lock out. */}
      {/* Non-modal draws no scrim of its own: the page dims behind it as behind every pop-up; a click on it closes Details. */}
      {details && createPortal(<div className="rh-scrim" aria-hidden="true" />, document.body)}
      <Dialog open={details} modal={false} onOpenChange={(o) => !o && setDetails(false)}>
        {details && (
          <DialogContent
            className="dlh rh-details"
            // Focus on the card itself (no ring on a button), so the next Tab goes on inside it, not to the page.
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).focus({ preventScroll: true });
            }}
            // Esc in the card's own edit pop-up closes that alone, not Details with it.
            onEscapeKeyDown={(e) => {
              if (document.querySelector(".cc-dialog")) e.preventDefault();
            }}
          >
            <div className="dlh-head">
              <DialogTitle className="dlh-title">{home.name}</DialogTitle>
              <DialogClose className="dlh-x" aria-label="Close">
                ✕
              </DialogClose>
            </div>
            <DialogDescription className="sr-only">Member info, coaching info and your note about {firstName}</DialogDescription>
            <div className="rh-details-body">
              <ClientCardEditor clientId={clientId} panel={panel} chrome="rail" look="hairline" />
              <CoachNote text={home.coachNote.text} savedLabel={home.coachNote.savedLabel} onSave={(v) => act(() => saveCoachNoteAction(clientId, v), "Coach note")} />
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Deleting: what goes, and their name typed to be sure. */}
      <Dialog open={deleting} onOpenChange={(o) => !o && setDeleting(false)}>
        {deleting && <DeleteClientDialog clientId={clientId} name={home.name} firstName={firstName} />}
      </Dialog>

      {/* The photo, large. */}
      <Dialog open={photo} onOpenChange={(o) => !o && setPhoto(false)}>
        {photo && home.avatarPath && (
          <DialogContent className="dlh rh-photodlg">
            <div className="dlh-head">
              <DialogTitle className="dlh-title">{home.name}</DialogTitle>
              <DialogClose className="dlh-x" aria-label="Close">
                ✕
              </DialogClose>
            </div>
            <DialogDescription className="sr-only">{home.name}&rsquo;s profile photo</DialogDescription>
            {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
            <img className="rh-photo" src={home.avatarPath} alt={`${home.name}'s photo`} />
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={msg} onOpenChange={(o) => !o && setMsg(false)}>
        {msg && (
          <MessageDialog
            firstName={firstName}
            label="Home"
            onSend={(text) => {
              setMsg(false);
              act(() => sendChatMessageAction(fd({ clientId, text })), `Message to ${firstName}`);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

// ---- Since the coach last looked: one quiet line, the date in ink, each count only when there is one.
function SinceLine({ since }: { since: HomeBoard["since"] }) {
  if (!since) return null;
  const w = since.weightChange == null || Math.round(since.weightChange * 10) === 0 ? null : `${signed1(since.weightChange)} kg`;
  const facts = [
    count(since.sessions, "session", "sessions"),
    count(since.checkIns, "check-in", "check-ins"),
    count(since.foodDays, "food day", "food days"),
    w,
    count(since.messages, "message", "messages"),
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

/** A tile's grey line, parted by bars; each part kept whole, so a narrow tile wraps between them ("P 200", "C 300"). */
const tileLine = (s: string) => (
  <SepJoin
    parts={parts(s, true).map((p, i) => (
      <span key={i} className="rh-nb">
        {p}
      </span>
    ))}
  />
);

// ---- A track's tile: its icon and label in its colour, the phase, the week and how far in over a thin bar, then the
// figure right under it (the grid gives the three one height).
function PhaseTile({ tile, onOpen }: { tile: HomeBoard["tracks"][number]; onOpen: () => void }) {
  const p = tile.phase;
  const pct = p && p.weeks > 0 ? Math.max(0, Math.min(100, (p.weekNow / p.weeks) * 100)) : 0;
  return (
    <button type="button" className="rls-card rh-tile" style={{ "--rh-c": TRACK_ACCENT[tile.track] } as CSSProperties} onClick={onOpen}>
      <span className="rh-tile-track">
        <TrackIcon track={tile.track} size={14} />
        {TRACK_LABEL[tile.track]}
      </span>
      <span className={`rh-tile-name${p ? "" : " none"}`}>{p ? p.name : "No phase"}</span>
      {p && (
        <>
          <span className="rh-tile-week">
            <span>
              Week {p.weekNow} of {p.weeks}
            </span>
            <span className="rh-tile-pct">{Math.round(pct)}%</span>
          </span>
          <span className="rh-tile-bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </span>
        </>
      )}
      {tile.figure && (
        <span className="rh-tile-fig">
          <b>{tile.figure.value}</b>
          {tile.figure.suffix && <small>{tileLine(tile.figure.suffix)}</small>}
        </span>
      )}
      {tile.note && <span className="rh-tile-note">{tileLine(tile.note)}</span>}
    </button>
  );
}

// ---- Muscle balance: sets (or volume) per group as a hexagon. 7d, 30d and Phase can be on together (21 Oct, Alex: "so
// I can compare easily"), each its own colour: one on, it against the window before it (dashed grey); more, each its own
// shape; none, an empty hexagon (21 Oct, Alex: the last one clicks off too). No Plan view (21 Oct, Alex: just the three).
type Window = "7d" | "30d" | "phase";
const WINDOWS: Window[] = ["7d", "30d", "phase"];
/** A colour a window: 7d the training purple, 30d rose, Phase ink; none of them another track's. */
const WINDOW_COLOR: Record<Window, string> = { "7d": TRACK_ACCENT.training, "30d": "#c2417a", phase: "#141a24" };
const BEFORE_GREY = "#98a2b3";
type Shape = { v: PerGroup; color: string; dashed?: boolean; fill?: number };
function MuscleCard({ muscles }: { muscles: HomeBoard["muscles"] }) {
  const [measure, setMeasure] = useState<Measure>("sets");
  const [picked, setPicked] = useState<Window[]>(["7d"]);
  // A window that went away (no phase any more) drops out.
  const windows = picked.filter((w) => w !== "phase" || !!muscles.phase);
  // Each on or off, all off too (an empty hexagon); the order is always 7d, 30d, Phase.
  const toggle = (w: Window) => setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : WINDOWS.filter((x) => x === w || p.includes(x))));
  const winOf = (w: Window): MuscleWindow => (w === "phase" && muscles.phase ? muscles.phase : w === "30d" ? muscles["30d"] : muscles["7d"]);
  const nameOf = (w: Window) => (w === "phase" ? `Since ${dayMonth(winOf("phase").from)}` : `Last ${w}`);
  const valuesOf = (w: Window) => (measure === "volume" ? winOf(w).volume : winOf(w).sets);

  let shapes: Shape[];
  let shown: { v: PerGroup; color?: string }[];
  let key: { label: string; color: string; dashed?: boolean }[];
  if (windows.length === 1) {
    const w = windows[0];
    const win = winOf(w);
    const before = measure === "volume" ? win.prevVolume : win.prevSets;
    shapes = [
      { v: before, color: BEFORE_GREY, dashed: true },
      { v: valuesOf(w), color: WINDOW_COLOR[w], fill: 0.12 },
    ];
    shown = [{ v: valuesOf(w) }];
    key = [
      { label: nameOf(w), color: WINDOW_COLOR[w] },
      { label: w === "phase" ? "Before" : `${w} before`, color: BEFORE_GREY, dashed: true },
    ];
  } else if (windows.length > 1) {
    // Several at once: each its own shape, lightly filled so the ones under still show; the longest window drawn first.
    shapes = [...windows].reverse().map((w) => ({ v: valuesOf(w), color: WINDOW_COLOR[w], fill: 0.07 }));
    shown = windows.map((w) => ({ v: valuesOf(w), color: WINDOW_COLOR[w] }));
    key = windows.map((w) => ({ label: nameOf(w), color: WINDOW_COLOR[w] }));
  } else {
    shapes = [];
    shown = [];
    key = [];
  }
  const most = Math.max(0, ...shapes.flatMap((s) => AXES.map((g) => s.v[g] ?? 0)));
  const byVolume = measure === "volume";
  const fmt = byVolume ? volumeIn(most) : setsOf;
  // No data in what is picked: None yet. Nothing picked: the hexagon alone.
  const empty = windows.length > 0 && shapes.every((s) => AXES.every((g) => !(s.v[g] > 0)));
  // Said in full for a screen reader: the measure, and every shape on the chart.
  const each = (v: PerGroup) => AXES.map((g) => `${g} ${fmt(v[g] ?? 0)}`).join(", ");
  const said = !windows.length
    ? "Muscle balance: no window picked"
    : `${byVolume ? "Volume" : "Sets"}. ${key.map((k, i) => `${k.label}: ${each(windows.length === 1 ? (i === 0 ? valuesOf(windows[0]) : shapes[0].v) : valuesOf(windows[i]))}`).join(". ")}`;

  const spanButtons: { id: Window; label: string }[] = [
    { id: "7d", label: "7d" },
    { id: "30d", label: "30d" },
    ...(muscles.phase ? [{ id: "phase" as const, label: "Phase" }] : []),
  ];
  return (
    <section className="rls-card rh-panel rh-muscles" aria-label="Muscle balance" style={{ "--rh-c": TRACK_ACCENT.training } as CSSProperties}>
      <div className="rh-panel-head tall">
        <h2 className="rh-panel-title">Muscle balance</h2>
        <div className="rd-btn-group" role="group" aria-label="Count">
          {(["sets", "volume"] as const).map((m) => (
            <button key={m} type="button" className={measure === m ? "on" : ""} aria-pressed={measure === m} onClick={() => setMeasure(m)}>
              {m === "sets" ? "Sets" : "Volume"}
            </button>
          ))}
        </div>
      </div>
      {/* 7d, 30d and Phase each on or off, all off for an empty hexagon. */}
      <div className="rd-btn-group rh-spans" role="group" aria-label="Windows">
        {spanButtons.map((s) => {
          const on = windows.includes(s.id);
          return (
            <button key={s.id} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => toggle(s.id)}>
              {s.label}
            </button>
          );
        })}
      </div>
      {empty ? (
        <p className="rls-none">None yet</p>
      ) : (
        <>
          <div className="rh-radar-wrap">
            <Radar shapes={shapes} shown={shown} fmt={fmt} label={said} />
          </div>
          <div className="rh-key">
            {key.map((k) => (
              <span key={k.label}>
                <i className={k.dashed ? "dash" : "line"} style={k.dashed ? undefined : { background: k.color }} aria-hidden="true" />
                {k.label}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// The hexagon: three hairline rings and six spokes, the window before as a dashed grey outline, this one filled in
// training purple; each axis named outside its corner with this window's figure under the name. It scales with its
// card up to 440px wide (21 Oct, Alex: "there's a lot of space"), its words with it: at full size the names read about
// 13px and the figures 15px. The sides keep room for the longest name and figure ("Shoulders", "14 of 22").
const RW = 384;
const RH = 354;
const CX = RW / 2;
const CY = 176;
const RR = 135;
const corner = (i: number, r: number) => {
  const a = ((-90 + 60 * i) * Math.PI) / 180;
  return [Math.round((CX + r * Math.cos(a)) * 10) / 10, Math.round((CY + r * Math.sin(a)) * 10) / 10] as const;
};
/** A closed shape through the corners with each corner rounded (21 Oct, Alex: "a bit round so the shape is smoother"):
    the line runs to just before a corner and curves round it, up to `r` along each side and never past half a side, so a
    spike keeps its length with a soft tip and corners sitting on the centre stay put. */
const ROUND = 16;
function roundedPath(pts: (readonly [number, number])[], r: number) {
  const n = pts.length;
  const toward = (a: readonly [number, number], b: readonly [number, number], d: number) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    return len === 0 ? a : ([a[0] + (dx / len) * d, a[1] + (dy / len) * d] as const);
  };
  const side = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const f = (p: readonly [number, number]) => `${Math.round(p[0] * 10) / 10},${Math.round(p[1] * 10) / 10}`;
  const cuts = pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const k = Math.min(r, side(prev, p) / 2, side(p, next) / 2);
    return { into: toward(p, prev, k), out: toward(p, next, k), at: p };
  });
  return `M${f(cuts[0].out)}` + cuts.slice(1).map((c) => `L${f(c.into)}Q${f(c.at)} ${f(c.out)}`).join("") + `L${f(cuts[0].into)}Q${f(cuts[0].at)} ${f(cuts[0].out)}Z`;
}
function Radar({ shapes, shown, fmt, label }: { shapes: Shape[]; shown: { v: PerGroup; color?: string }[]; fmt: (v: number) => string; label: string }) {
  const scale = Math.max(1, ...shapes.flatMap((s) => AXES.map((g) => s.v[g] ?? 0)));
  const shape = (v: PerGroup) => roundedPath(AXES.map((g, i) => corner(i, (RR * Math.max(0, v[g] ?? 0)) / scale)), ROUND);
  const ring = (f: number) => AXES.map((_, i) => corner(i, RR * f).join(",")).join(" ");
  return (
    <svg className="rh-radar" viewBox={`0 0 ${RW} ${RH}`} role="img" aria-label={label}>
      {[1 / 3, 2 / 3, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#e1e5eb" strokeWidth={1} />
      ))}
      {AXES.map((g, i) => {
        const [x, y] = corner(i, RR);
        return <line key={g} x1={CX} y1={CY} x2={x} y2={y} stroke="#e1e5eb" strokeWidth={1} />;
      })}
      {shapes.map((s, i) =>
        s.dashed ? (
          <path key={i} d={shape(s.v)} fill="none" stroke={s.color} strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />
        ) : (
          <path key={i} d={shape(s.v)} fill={s.color} fillOpacity={s.fill ?? 0} stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
        )
      )}
      {AXES.map((g, i) => {
        const [x, y] = corner(i, RR + 10);
        // Top and bottom: centred over / under the corner; the sides: beside it, the two lines either side of its height.
        const anchor = i === 0 || i === 3 ? "middle" : i < 3 ? "start" : "end";
        const [nameY, valueY] = i === 0 ? [y - 17, y - 2] : i === 3 ? [y + 12, y + 27] : [y - 3, y + 13];
        return (
          <g key={g} aria-hidden="true">
            <text className="rh-radar-name" x={x} y={nameY} textAnchor={anchor}>
              {g}
            </text>
            {/* Several windows: each figure in its window's colour, side by side. */}
            <text className="rh-radar-val" x={x} y={valueY} textAnchor={anchor}>
              {shown.map((s, j) => (
                <tspan key={j} dx={j ? 7 : 0} fill={s.color}>
                  {fmt(s.v[g] ?? 0)}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---- Strength: all six groups, each the change over the window picked (7d | 30d | Phase, as Muscle balance; Phase
// at first) as a thin ink bar and the %: green up, red down; a group with nothing to compare an empty bar and a grey "–",
// every group so in a window with nothing.
function StrengthCard({ strength }: { strength: HomeBoard["strength"] }) {
  const [span, setSpan] = useState<StrengthSpan>("phase");
  const w = strength?.[span] ?? null;
  const rows = STRENGTH_GROUPS.map((g) => {
    const x = w?.groups.find((s) => s.group === g);
    return { group: g, r: x ? pctOf(x.pct) : null, exercises: x?.exercises ?? 0 };
  });
  const most = Math.max(0, ...rows.map((x) => Math.abs(x.r ?? 0)));
  return (
    <section className="rls-card rh-panel" aria-label="Strength">
      <div className="rh-panel-head tall">
        <h2 className="rh-panel-title">Strength</h2>
        <span className="rh-panel-tools">
          <span className="rd-btn-group" role="group" aria-label="Window">
            {STRENGTH_SPANS.map((s) => (
              <button key={s.id} type="button" className={span === s.id ? "on" : ""} aria-pressed={span === s.id} onClick={() => setSpan(s.id)}>
                {s.label}
              </button>
            ))}
          </span>
        </span>
      </div>
      <div className="rh-str">
        {rows.map((x) => (
          <div key={x.group} className="rh-str-row" title={x.r == null ? undefined : `${x.exercises} exercise${x.exercises === 1 ? "" : "s"}`}>
            <span className="rh-str-name">{x.group}</span>
            <span className="rh-str-track" aria-hidden="true">
              <i style={{ width: !x.r || most === 0 ? 0 : `max(2px, ${(Math.abs(x.r) / most) * 100}%)` }} />
            </span>
            {x.r == null ? (
              <span className="rh-str-pct none">
                <span aria-hidden="true">–</span>
                <span className="sr-only">none yet</span>
              </span>
            ) : (
              <span className={`rh-str-pct${x.r > 0 ? " up" : x.r < 0 ? " down" : ""}`}>{pctText(x.r)}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Weight: the latest and the change on the title's line; the phase's readings as one ink line, the latest a dot
// (from two readings); where they are heading, when there is a phase. "None yet" only with no weight at all.
function WeightCard({ weight }: { weight: HomeBoard["weight"] }) {
  const points = weight ? [...weight.points].sort((a, b) => timeOf(a.date) - timeOf(b.date)) : [];
  const latest = weight ? (weight.now ?? points.at(-1)?.value ?? null) : null;
  if (!weight || latest == null)
    return (
      <section className="rls-card rh-panel rh-weight" aria-label="Weight">
        <div className="rh-panel-head">
          <h2 className="rh-panel-title">Weight</h2>
        </div>
        <p className="rls-none">None yet</p>
      </section>
    );
  const head = (
    <div className="rh-panel-head">
      <h2 className="rh-panel-title">Weight</h2>
      <span className="rh-wt">
        <SepJoin
          parts={[
            <b key="now">{kg1(latest)}</b>,
            weight.change != null ? (
              <span key="change">
                {signed1(weight.change)} kg <small>since {dayMonth(weight.since)}</small>
              </span>
            ) : null,
          ]}
        />
      </span>
    </div>
  );
  if (points.length < 2)
    return (
      <section className="rls-card rh-panel rh-weight" aria-label="Weight">
        {head}
      </section>
    );
  const ts = points.map((p) => timeOf(p.date));
  const span = ts[ts.length - 1] - ts[0] || 1;
  const vs = points.map((p) => p.value);
  const pad = Math.max((Math.max(...vs) - Math.min(...vs)) * 0.15, 0.4);
  const lo = Math.min(...vs) - pad;
  const hi = Math.max(...vs) + pad;
  const xy = points.map((p, i) => [((ts[i] - ts[0]) / span) * 100, ((hi - p.value) / (hi - lo)) * 100] as const);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <section className="rls-card rh-panel rh-weight" aria-label="Weight">
      {head}
      <div className="rh-spark" role="img" aria-label={`Weight from ${kg1(points[0].value)} on ${dayMonth(points[0].date)} to ${kg1(points[points.length - 1].value)} on ${dayMonth(points[points.length - 1].date)}`}>
        {/* The line stretches to the card; its stroke and the dot keep their size. */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={d} fill="none" stroke="#141a24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="rh-spark-dot" style={{ left: `${lx}%`, top: `${ly}%` }} aria-hidden="true" />
      </div>
      {weight.projection && (
        <p className="rh-pace">
          On pace for {kg1(weight.projection.value)} by {dayMonth(weight.projection.date)}
        </p>
      )}
    </section>
  );
}

// ---- Consistency: the last 30 days or the phase (as the server sends them), a square a day (a week, in a long phase) per behaviour. A day done wears its
// track as a phase does (21 Oct, Alex): the colour soft inside, its full strength on the edge; a day not done is grey.
// The rows in the tracks' order (21 Oct, Alex): Check-in, Trained, Food, each named by its track's icon alone.
const CONS: { key: "trained" | "food" | "checkIn"; label: string; track: PhaseTrack; yes: string; no: string }[] = [
  { key: "checkIn", label: "Check-in", track: "lifestyle", yes: "checked in", no: "no check-in" },
  { key: "trained", label: "Trained", track: "training", yes: "trained", no: "no session" },
  { key: "food", label: "Food", track: "nutrition", yes: "food logged", no: "no food logged" },
];
function ConsistencyCard({ days: last30, phaseDays }: { days: HomeBoard["days"]; phaseDays: HomeBoard["phaseDays"] }) {
  // 30 days | Phase (21 Oct, Alex): the phase from its first day, at least 30 squares (days to come stay empty). A phase
  // over 8 weeks goes by week (21 Oct, Alex: 180 days won't fit), a square a week, stronger the more days were done.
  const [span, setSpan] = useState<"30" | "phase">("30");
  const weeks = span === "phase" && phaseDays?.by === "week" ? phaseDays.weeks : null;
  const days = weeks ? [] : span === "phase" && phaseDays?.by === "day" ? phaseDays.days : last30;
  const count = weeks ? weeks.length : days.length;
  // Evenly spaced, no gap before a Monday (21 Oct, Alex): the two spans start on different weekdays, and the gaps moved
  // the squares when switching between them.
  return (
    <section className="rls-card rh-panel rh-cons" aria-label="Consistency">
      <div className="rh-panel-head">
        <h2 className="rh-panel-title">Consistency</h2>
        <span className="rh-cons-tools">
          {phaseDays ? (
            <span className="rd-btn-group" role="group" aria-label="Span">
              {([
                ["30", "30 days"],
                ["phase", "Phase"],
              ] as const).map(([id, word]) => (
                <button key={id} type="button" className={span === id ? "on" : ""} aria-pressed={span === id} onClick={() => setSpan(id)}>
                  {word}
                </button>
              ))}
            </span>
          ) : (
            days.length > 0 && <span className="rh-panel-aside">Last {days.length} days</span>
          )}
        </span>
      </div>
      {count === 0 ? (
        <p className="rls-none">None yet</p>
      ) : (
        <div className="rh-cons-rows">
          {CONS.map((c) => {
            const color = TRACK_ACCENT[c.track];
            let said: string;
            if (weeks) {
              const past = weeks.filter((w) => !w.future);
              said = `${c.label}: ${past.reduce((n, w) => n + w[c.key], 0)} of ${past.reduce((n, w) => n + w.days, 0)} days, over ${past.length} ${past.length === 1 ? "week" : "weeks"}`;
            } else {
              const past = days.filter((d) => !d.future);
              said = `${c.label}: ${past.filter((d) => d[c.key]).length} of ${past.length} days`;
            }
            return (
              <div key={c.key} className="rh-cons-row" style={{ "--rh-c": color, "--rh-t": tintOf(color, 0.18) } as CSSProperties}>
                <span className="rh-cons-label" title={c.label} aria-hidden="true">
                  <TrackIcon track={c.track} size={16} />
                </span>
                <span className="rh-cons-days" role="img" aria-label={said}>
                  {weeks
                    ? weeks.map((w) => {
                        const head = `Week ${w.week} (${dayMonth(w.start)})`;
                        if (w.future) return <span key={w.start} className="rh-day ahead" title={`${head}: to come`} />;
                        const n = w[c.key];
                        // The share of the week's days done sets the fill and the edge: a full week strongest.
                        const f = w.days ? n / w.days : 0;
                        const look = n ? { background: tintOf(color, 0.05 + 0.2 * f), boxShadow: `inset 0 0 0 1.5px ${tintOf(color, 0.3 + 0.7 * f)}` } : undefined;
                        return <span key={w.start} className="rh-day" style={look} title={`${head}: ${c.yes} on ${n} of ${w.days} ${w.days === 1 ? "day" : "days"}`} />;
                      })
                    : days.map((d) => (
                        <span key={d.date} className={`rh-day${d[c.key] ? " on" : ""}${d.future ? " ahead" : ""}`} title={d.future ? `${dayMonth(d.date)}: to come` : `${dayMonth(d.date)}: ${d[c.key] ? c.yes : c.no}`} />
                      ))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** A small-caps label and its fact under it, in a card that opens a tab. */
function SideFact({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <span className="rh-side-fact">
      {label && <span className="rh-side-label">{label}</span>}
      <span className="rh-side-line">{children}</span>
    </span>
  );
}

// ---- Meetings, beside Consistency (21 Oct, Alex: the next call leads): the next call big under the title, its day
// with the time grey after it and its title on a line of its own; the last one over quiet at the card's foot, over a
// hairline. Opens Meetings.
function MeetingsCard({ next, last, onOpen }: { next: HomeBoard["nextCall"]; last: HomeBoard["lastCall"]; onOpen: () => void }) {
  return (
    <button type="button" className="rls-card rh-panel rh-side" onClick={onOpen}>
      <span className="rh-panel-title">Meetings</span>
      <span className="rh-lead">
        <span className="rh-side-label">Next call</span>
        {next ? (
          <>
            <span className="rh-lead-big">
              <b>{dayMonth(next.date)}</b>
              {next.time && <span className="rh-lead-time">{next.time}</span>}
            </span>
            {next.title && <span className="rh-lead-title">{next.title}</span>}
          </>
        ) : (
          <span className="rh-lead-none">None booked</span>
        )}
      </span>
      <span className="rh-side-foot">
        <SideFact label="Last call">
          {last ? (
            <SepJoin
              parts={[
                <b key="d">{dayMonth(last.date)}</b>,
                last.title ? (
                  <span key="t" className="rh-side-what">
                    {last.title}
                  </span>
                ) : null,
                last.missed ? (
                  <span key="m" className="rh-side-missed">
                    Missed
                  </span>
                ) : null,
              ]}
            />
          ) : (
            <span className="rh-side-none">None yet</span>
          )}
        </SideFact>
      </span>
    </button>
  );
}

// ---- Invoices, beside Meetings, the same shape: what is owed big (rust) and how many invoices; at the foot, quiet, the
// last one paid and the next one a series will make, each only when there is one. Opens Invoices.
function InvoicesCard({ owed, paid, next, onOpen }: { owed: HomeBoard["outstanding"]; paid: HomeBoard["lastPaid"]; next: HomeBoard["nextInvoice"]; onOpen: () => void }) {
  const owing = owed != null && owed.amount > 0;
  return (
    <button type="button" className="rls-card rh-panel rh-side" onClick={onOpen}>
      <span className="rh-panel-title">Invoices</span>
      <span className="rh-lead">
        {owed ? (
          <>
            <span className="rh-side-label">Outstanding</span>
            <span className="rh-lead-big">
              <b className={owing ? "owed" : undefined}>{money(owed.amount, owed.currency)}</b>
            </span>
            <span className="rh-lead-sub">
              {owed.count} invoice{owed.count === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          // Nothing owed: the words alone, no "Outstanding" over them (design rules 1: say a thing once).
          <span className="rh-lead-none">Nothing outstanding</span>
        )}
      </span>
      {(paid || next) && (
        <span className="rh-side-foot">
          {paid && (
            <SideFact label="Last paid">
              <SepJoin parts={[<b key="d">{dayMonth(paid.date)}</b>, <span key="a">{money(paid.amount, paid.currency)}</span>]} />
            </SideFact>
          )}
          {next && (
            <SideFact label="Next">
              <SepJoin parts={[<b key="d">{dayMonth(next.date)}</b>, <span key="a">{money(next.amount, next.currency)}</span>]} />
            </SideFact>
          )}
        </span>
      )}
    </button>
  );
}

// The coach's own note, theirs alone: a note that saves (design rules 4). No line until something is typed; then the
// line, Cancel and Save.
function CoachNote({ text, savedLabel, onSave }: { text: string; savedLabel: string | null; onSave: (text: string) => void }) {
  const [saved, setSaved] = useState(text);
  const [draft, setDraft] = useState(text);
  const typed = draft.trim() !== saved.trim();
  return (
    <section className="rh-note">
      <span className="dlh-label">
        <SepJoin parts={["Coach note", savedLabel && saved ? savedLabel : null]} />
      </span>
      <textarea className={`rh-note-text${typed ? " typed" : ""}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Add a note" aria-label="Coach note" />
      {typed && (
        <div className="rh-note-foot">
          <button type="button" className="dlh-cancel" onClick={() => setDraft(saved)}>
            Cancel
          </button>
          <button
            type="button"
            className="dlh-go"
            onClick={() => {
              setSaved(draft.trim());
              setDraft(draft.trim());
              onSave(draft.trim());
            }}
          >
            Save
          </button>
        </div>
      )}
    </section>
  );
}

// ---- Delete a client: everything of theirs goes, their invoices stay. Their name typed to be sure.
function DeleteClientDialog({ clientId, name, firstName }: { clientId: number; name: string; firstName: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const ok = typed.trim().toLowerCase() === name.trim().toLowerCase();
  // Opened from the ⋯ menu: the field takes the keyboard a beat after the dialog's own focus move (as DeleteSessionDialog).
  const field = useRef<HTMLInputElement>(null);
  const go = () =>
    start(async () => {
      const err = await deleteClientConfirmedAction(clientId, typed);
      if (err) return setError(err);
      toast.success(`${name} deleted`);
      router.push("/admin/redesign/feed");
    });
  return (
    <DialogContent
      className="dlh"
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        setTimeout(() => field.current?.focus(), 60);
      }}
    >
      <div className="dlh-head">
        <DialogTitle className="dlh-title">Delete {name}?</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <DialogDescription className="dlh-note">
        This permanently deletes {firstName}&rsquo;s login, programmes, logged sets, check-ins, photos, meetings and chat. It can&rsquo;t be undone. Their invoices stay.
      </DialogDescription>
      <label className="rh-field">
        <span className="dlh-label">Type their name</span>
        <input
          className="dlh-line"
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && ok && !busy && go()}
          placeholder={name}
          ref={field}
          autoComplete="off"
        />
      </label>
      {error && <p className="dlh-error">{error}</p>}
      <div className="dlh-foot">
        <DialogClose className="dlh-cancel" disabled={busy}>
          Cancel
        </DialogClose>
        <button type="button" className="dlh-delete" onClick={go} disabled={!ok || busy}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </DialogContent>
  );
}
