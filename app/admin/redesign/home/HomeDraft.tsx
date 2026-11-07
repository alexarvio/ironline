"use client";

import Pager from "../Pager";
import { useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { deleteClientConfirmedAction, sendChatMessageAction } from "../../../lib/actions";
import { useOpenChat } from "../ChatPanel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import ClientCardEditor from "../../ClientCardEditor";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { AccountIcon, ChatIcon, MoreIcon, TrashIcon, WeightGoalIcon } from "../../../components/icons";
import type { OverviewInfoRow, OverviewPanel } from "../../../lib/queries";
// Types only: homeBoard.ts re-exports the server's reader, which must never reach the browser.
import type { HomeBoard, MuscleGroup, MuscleWindow, PerGroup } from "../../../lib/homeBoard";
import { MessageDialog } from "../training/TrainingDraft";
import AppAccessButton from "./AppAccessButton";
import type { ClientAccess } from "../../../lib/access-actions";
import { dayMonth, logDate, logDateWidth } from "../../../lib/dayMonth";
import { pic } from "../../../lib/pic";
import { newOnceKey } from "../../../lib/onceKey";
import { SepJoin } from "../Sep";
import { TRACK_ACCENT, TRACK_LABEL } from "../../phaseChrome";
import { TrackIcon } from "../plan/PlanDraft";
import type { PhaseTrack } from "../../../lib/db";
import type { PlanChoice } from "../../../lib/planText";
import KindMark from "../KindMark";
import HelpTip from "../HelpTip";
import { TodoStrip } from "../TodoStrip";
import type { ActivityMark } from "../../../lib/activityMark";
import { monotoneSegments } from "../../../lib/monotoneCurve";
// Values from weightGoal.ts are safe here: it is pure (no store, no queries).
import { addDaysIso, currentGoal, daysBetween, GOAL_COLOR, kgIn, planKgAt, VERDICT_TONE, VERDICT_WORD, type WeightGoalView } from "../../../lib/weightGoal";
import WeightGoalDialog from "../WeightGoalDialog";
import { groupColour } from "../../../lib/categoryColors";

/** Weight's own colour, its metric group's (Body): the line while a goal runs, over the goal's beige. */
const WEIGHT_BLUE = groupColour("body").hex;

// The client's Home (21 Oct, Alex: built from the Home mockup, root "rd trn rls rh"): Training's header, then the board.
//
// - The header: face, name (the whole of it, wrapping if it must), nothing after it;
//   App access, Details and Message as white pills, ⋯ to delete.
// - Since: what they did since the coach last looked, one quiet line.
// - The three tracks (Lifestyle, Training, Nutrition): the phase, its week and how far in, then the one figure that
//   matters right under it. A tile opens its tab.
// - Muscle balance (sets per group, or strength per group as an index around 100, over 7d, 30d or the phase, one
//   against the window before or several together) beside Strength (all six groups, over 7d, 30d or the phase) and
//   Weight (the phase's readings over their dates and kg).
// - Consistency (the last 30 days, a square a day, per behaviour) with Meetings (the next call big, the last at the foot)
//   and Invoices (what is owed big; the last paid and the next to be made at the foot) beside it; each opens its tab.
// - Activity: what they did, one kind at a time, a page at a time; every row leads with its date.
// Details is a pop-up: the face and one fact line, Contact, Coaching, the coach's own note, Delete at the foot.

/** at: when it happened (ms), for the row's date. href: the thing itself (a session, a food day, an invoice), from feedHref.
    text: the thing alone (FeedEvent.thing; 23 Oct, Alex: no facts after it); note: the client's own words, or none.
    mark: its icon (KindMark). timeKnown: the hour is known, written from at in the browser's zone as the Feed's.
    allDay: a call with no time, "All day" where the time goes. */
export type DraftEvent = { id: string; category: string; text: string; note: string | null; at: number; timeKnown: boolean; allDay?: boolean; mark: ActivityMark; tab: string; href: string | null };
export type DraftHome = {
  name: string;
  initial: string;
  avatarPath: string | null;
  /** The whole client card, for the live editor in the Details dialog. */
  panel: OverviewPanel;
  /** The plans the client's coach offers, and the one the client is on (23 Oct, Alex: Details' Plan; 28 Oct: their prices,
      the coach's currency, and the day billing their plan next goes, when a series bills it). */
  plans: PlanChoice[];
  planId: string | null;
  planCurrency: string;
  billedNext: string | null;
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
  // The tracks in their order everywhere, Lifestyle, Training, Nutrition (24 Oct, Alex).
  { id: "lifestyle", label: "Lifestyle", has: (e) => e.category === "measurements" },
  { id: "training", label: "Training", has: (e) => e.category === "training" },
  { id: "nutrition", label: "Nutrition", has: (e) => e.category === "nutrition" },
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
/** An Activity row's clock time ("18:48") in the coach's own zone, as the Feed's (its date is logDate's, the same). */
const clockOf = (at: number) => new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

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
const setsOf = (v: number) => String(Math.round(v));
/** Strength's Overall: one decimal under 10%, whole above; a real minus. */
const pctOf = (p: number) => (Math.abs(p) < 10 ? Math.round(p * 10) / 10 : Math.round(p));
const pctText = (r: number) => (r === 0 ? "0%" : `${r > 0 ? "+" : MINUS}${Math.abs(r)}%`);
/** A group's strength as an index (23 Oct, Alex): 100 and its mean % change, one decimal ("103.4"). */
const indexText = (pct: number) => (100 + Math.round(pct * 10) / 10).toFixed(1);
/** Where the index sits on the hexagon: a fixed 80 to 120, 100 halfway; a change past ±20% stays at the edge. */
const indexAt = (pct: number) => Math.min(1, Math.max(0, (pct + 20) / 40));

// The radar's axes, clockwise from the top (21 Oct, Alex's mockup).
const AXES: MuscleGroup[] = ["Back", "Chest", "Core", "Legs", "Shoulders", "Arms"];
/** Strength's rows: the same six groups, always all of them (21 Oct, Alex), in the contract's order (MUSCLE_GROUPS,
    written out here: homeBoard.ts's values would bring the server's reader into the browser). */
const STRENGTH_GROUPS: MuscleGroup[] = ["Back", "Chest", "Shoulders", "Arms", "Legs", "Core"];
/** Sets per group, or strength per group (23 Oct, Alex: Strength took Volume's place). */
type Measure = "sets" | "strength";
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

export default function HomeDraft({
  clientId,
  firstName,
  home,
  onOpenTab,
  dueUnlock,
}: {
  clientId: number;
  firstName: string;
  home: DraftHome;
  onOpenTab: (tab: string) => void;
  /** The dot trail (dots.ts): locked out of signing in, so App access carries the dot. */
  dueUnlock?: boolean;
}) {
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
  // the kind's icon (23 Oct, Alex: as the Feed's), then the thing. The date column is as wide as the whole feed's widest
  // date, so it never moves between kinds or pages.
  const dateW = useMemo(() => logDateWidth(home.events.map((e) => new Date(e.at))), [home.events]);
  const actGrid = { gridTemplateColumns: `${dateW}px 48px 16px minmax(0, 1fr)`, columnGap: 12 } as const;

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
                <img src={pic(home.avatarPath, 96)} alt="" />
              ) : (
                home.initial
              )}
            </button>
            <h1 className="trn-name rh-name">{home.name}</h1>
          </div>
        </div>
        <div className="trn-head-actions">
          {/* White pills with an icon, as every tab's own actions (design rules 9b). */}
          <AppAccessButton key={clientId} clientId={clientId} firstName={firstName} initial={home.access} due={!!dueUnlock} />
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
      {/* What the coach owes here (2 Nov, Alex): a sign-in lock, Unlock opening App access. */}
      <TodoStrip tab="home" onAct={(item) => item.kind === "locked" && (document.querySelector<HTMLButtonElement>(".trn-pill.rh-due")?.click(), true)} />

      {/* Nothing under the name (27 Oct, Alex: the Since line taken out, "we do not need anything there"). */}

      {/* ---- The three tracks, in their order: the phase, its week, the one figure. A tile opens its tab (Plan when none). */}
      <section className="rh-tiles" aria-label="Phases">
        {[...board.tracks]
          .sort((a, b) => TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track))
          .map((t) => (
            // Its own tab, phase or not (22 Oct, Alex): with none, that tab is where New phase is.
            <PhaseTile key={t.track} tile={t} onOpen={() => onOpenTab(TRACK_TAB[t.track])} />
          ))}
      </section>

      {/* ---- Muscle balance beside Strength and Weight (23 Oct, Alex: the Strength card back, above Weight). */}
      <div className="rh-duo">
        <MuscleCard muscles={board.muscles} strength={board.strength} />
        <div className="rh-stack">
          <StrengthCard strength={board.strength} hasPhase={board.tracks.some((t) => t.track === "training" && t.phase != null)} />
          <WeightCard weight={board.weight} goals={board.weightGoals ?? []} clientId={clientId} />
        </div>
      </div>

      {/* ---- Consistency, and beside it the calls and the invoices, each a card that opens its tab. */}
      <div className="rh-trio">
        <ConsistencyCard days={board.days} />
        <MeetingsCard next={board.nextCall} last={board.lastCall} onOpen={() => onOpenTab("meetings")} />
        <InvoicesCard owed={board.outstanding} paid={board.lastPaid} next={board.nextInvoice} onOpen={() => onOpenTab("invoices")} />
      </div>

      {/* ---- Activity: what they did, one kind at a time. A log (design rules 8): the date first as every log's
          (logDate, .rd-logdate) with the time centred in its own column (.rd-logtime), the kind's icon in its colour, the
          thing semi-bold, and only the client's own words grey after it on the one line (23 Oct, Alex). One row a
          session, its cardio in it. A row opens the thing on its tab. */}
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
                const clock = e.timeKnown ? clockOf(e.at) : e.allDay ? "All day" : null;
                return (
                  <div key={e.id} className="rls-row rh-row">
                    <div className="rls-row-main" style={actGrid} onClick={() => go(e)}>
                      <span className="rd-logdate">{logDate(new Date(e.at))}</span>
                      <span className="rd-logtime">{clock}</span>
                      <KindMark mark={e.mark} />
                      {/* The thing, then only the client's own words (23 Oct, Alex): no facts after it. */}
                      <span className="rh-what">
                        <button type="button" className="rd-row-hit rh-what-title">
                          {e.text}
                        </button>
                        {e.note && <span className="rh-what-note">&ldquo;{e.note}&rdquo;</span>}
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
            {/* The face and the name (23 Oct, Alex: no fact line; gender, height and the plan's week didn't belong here). */}
            <div className="dlh-head rh-details-head">
              <span className="rh-details-face" aria-hidden="true">
                {home.avatarPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
                  <img src={pic(home.avatarPath, 96)} alt="" />
                ) : (
                  home.initial
                )}
              </span>
              <div className="rh-details-who">
                <DialogTitle className="dlh-title">{home.name}</DialogTitle>
              </div>
              <DialogClose className="dlh-x" aria-label="Close">
                ✕
              </DialogClose>
            </div>
            <DialogDescription className="sr-only">Contact and coaching for {firstName}</DialogDescription>
            <div className="rh-details-body">
              {/* The form itself (23 Oct, Alex): typed in place, Plan and Started under Coaching, no weight, no coach note.
                  Delete of an existing thing on the left of its foot, red words (design rules 4); the ⋯'s own confirm. */}
              <ClientCardEditor
                clientId={clientId}
                panel={panel}
                chrome="rail"
                look="hairline"
                plans={home.plans}
                planId={home.planId}
                planCurrency={home.planCurrency}
                billedNext={home.billedNext}
                onClose={() => setDetails(false)}
                footStart={
                  <button
                    type="button"
                    className="dlh-delete"
                    onClick={() => {
                      setDetails(false);
                      setDeleting(true);
                    }}
                  >
                    Delete {firstName}
                  </button>
                }
              />
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
              const f = fd({ clientId, text, nonce: newOnceKey() });
              act(() => sendChatMessageAction(f), `Message to ${firstName}`);
            }}
          />
        )}
      </Dialog>
    </div>
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
      {/* Its room kept when there is none (2 Nov, Alex: Nutrition's logged average made the tiles taller on some clients
          than others): every client's tiles one height, so moving between them nothing shifts. */}
      <span className="rh-tile-note" aria-hidden={tile.note ? undefined : true}>
        {tile.note ? tileLine(tile.note) : " "}
      </span>
    </button>
  );
}

// ---- Muscle balance: sets or strength per group as a hexagon (23 Oct, Alex: Sets | Strength, Strength in Volume's
// place). 7d, 30d and Phase can be on together (21 Oct, Alex: "so I can compare easily"), each its own colour; none, an
// empty hexagon (21 Oct, Alex: the last one clicks off too). No Plan view (21 Oct, Alex: just the three).
// - Sets: one window on, it against the window before it (dashed grey); more, each its own shape.
// - Strength: each group's index, 100 and its mean % change in estimated one-rep max (Epley; 7d and 30d against the
//   window before, Phase since the phase began), on a fixed 80 to 120 with 100 a dashed grey ring; a group with nothing
//   to compare sits at 100, its figure a dash. One window on, its Overall and new bests on the capsule's row.
type Window = "7d" | "30d" | "phase";
const WINDOWS: Window[] = ["7d", "30d", "phase"];
/** A colour a window: 7d the training purple, 30d rose, Phase ink; none of them another track's. */
const WINDOW_COLOR: Record<Window, string> = { "7d": TRACK_ACCENT.training, "30d": "#c2417a", phase: "#141a24" };
const BEFORE_GREY = "#98a2b3";
/** Strength's figures with one window on: green over 100, red under, ink at 100. */
const UP = "#2f7a3f";
const DOWN = "#b42318";
const INK = "#141a24";
/** The hairline rings: thirds for Sets; for Strength the outer one alone, 100 being the dashed ring halfway. */
const SET_RINGS = [1 / 3, 2 / 3, 1];
const STRENGTH_RINGS = [1];
/** A shape on the hexagon: each group's reach, 0 at the centre to 1 on the outer ring. */
type Shape = { at: PerGroup; color: string; dashed?: boolean; fill?: number };
/** One window's figures under the axis names: each group's words, and their colour (none: the figure's ink). */
type Figures = Record<MuscleGroup, { text: string; color?: string }>;
const perGroup = <T,>(f: (g: MuscleGroup) => T) => Object.fromEntries(AXES.map((g) => [g, f(g)])) as Record<MuscleGroup, T>;
function MuscleCard({ muscles, strength }: { muscles: HomeBoard["muscles"]; strength: HomeBoard["strength"] }) {
  const [measure, setMeasure] = useState<Measure>("sets");
  const [picked, setPicked] = useState<Window[]>(["7d"]);
  // A window that went away (no phase any more) drops out: Phase only with a training phase, Sets and Strength alike.
  const windows = picked.filter((w) => w !== "phase" || !!muscles.phase);
  // Each on or off, all off too (an empty hexagon); the order is always 7d, 30d, Phase.
  const toggle = (w: Window) => setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : WINDOWS.filter((x) => x === w || p.includes(x))));
  const winOf = (w: Window): MuscleWindow => (w === "phase" && muscles.phase ? muscles.phase : w === "30d" ? muscles["30d"] : muscles["7d"]);
  const nameOf = (w: Window) => (w === "phase" ? `Since ${dayMonth(winOf("phase").from)}` : `Last ${w}`);
  const one = windows.length === 1;

  let shapes: Shape[] = [];
  let figures: Figures[] = [];
  let key: { label: string; color: string; dashed?: boolean }[] = [];
  let empty: boolean;
  let said: string;
  if (measure === "sets") {
    const valuesOf = (w: Window) => winOf(w).sets;
    let drawn: { v: PerGroup; color: string; dashed?: boolean; fill?: number }[] = [];
    let shown: { v: PerGroup; color?: string }[] = [];
    if (one) {
      const w = windows[0];
      drawn = [
        { v: winOf(w).prevSets, color: BEFORE_GREY, dashed: true },
        { v: valuesOf(w), color: WINDOW_COLOR[w], fill: 0.12 },
      ];
      shown = [{ v: valuesOf(w) }];
      key = [
        { label: nameOf(w), color: WINDOW_COLOR[w] },
        { label: w === "phase" ? "Before" : `${w} before`, color: BEFORE_GREY, dashed: true },
      ];
    } else if (windows.length > 1) {
      // Several at once: each its own shape, lightly filled so the ones under still show; the longest window drawn first.
      drawn = [...windows].reverse().map((w) => ({ v: valuesOf(w), color: WINDOW_COLOR[w], fill: 0.07 }));
      shown = windows.map((w) => ({ v: valuesOf(w), color: WINDOW_COLOR[w] }));
      key = windows.map((w) => ({ label: nameOf(w), color: WINDOW_COLOR[w] }));
    }
    // The largest figure on the chart reaches the outer ring.
    const scale = Math.max(1, ...drawn.flatMap((s) => AXES.map((g) => s.v[g] ?? 0)));
    shapes = drawn.map((s) => ({ at: perGroup((g) => Math.max(0, s.v[g] ?? 0) / scale), color: s.color, dashed: s.dashed, fill: s.fill }));
    figures = shown.map((s) => perGroup((g) => ({ text: setsOf(s.v[g] ?? 0), color: s.color })));
    // No data in what is picked: the hexagon alone, its rings, spokes and names (22 Oct, Alex: the shape even when
    // empty, not None yet).
    empty = windows.length > 0 && drawn.every((s) => AXES.every((g) => !(s.v[g] > 0)));
    // Said in full for a screen reader: every shape on the chart.
    const each = (v: PerGroup) => AXES.map((g) => `${g} ${setsOf(v[g] ?? 0)}`).join(", ");
    said = `Sets. ${key.map((k, i) => `${k.label}: ${each(one ? (i === 0 ? valuesOf(windows[0]) : drawn[0].v) : valuesOf(windows[i]))}`).join(". ")}`;
  } else {
    /** A window's change per group; null where the group has nothing to compare. */
    const pctsOf = (w: Window) => perGroup((g) => strength[w]?.groups.find((x) => x.group === g)?.pct ?? null);
    const drawnOf = (w: Window, fill: number): Shape => {
      const p = pctsOf(w);
      return { at: perGroup((g) => indexAt(p[g] ?? 0)), color: WINDOW_COLOR[w], fill };
    };
    if (windows.length) {
      // 100, no change: the dashed grey ring halfway out, under the windows' shapes.
      // A window with nothing to compare draws no shape (it would sit on 100 and read as no change); its figures are dashes.
      const withData = windows.filter((w) => !!strength[w]);
      shapes = [{ at: perGroup(() => indexAt(0)), color: BEFORE_GREY, dashed: true }, ...(one ? withData.map((w) => drawnOf(w, 0.12)) : [...withData].reverse().map((w) => drawnOf(w, 0.07)))];
      figures = windows.map((w) => {
        const p = pctsOf(w);
        return perGroup((g) => {
          const v = p[g];
          if (v == null) return { text: "–", color: one ? BEFORE_GREY : WINDOW_COLOR[w] };
          const r = Math.round(v * 10) / 10;
          // Several side by side: whole numbers, so three fit beside a side corner; one window keeps its decimal.
          return { text: one ? indexText(v) : String(Math.round(100 + v)), color: one ? (r > 0 ? UP : r < 0 ? DOWN : INK) : WINDOW_COLOR[w] };
        });
      });
      key = [...windows.map((w) => ({ label: nameOf(w), color: WINDOW_COLOR[w] })), { label: "100, no change", color: BEFORE_GREY, dashed: true }];
    }
    // Nothing to compare in any window picked: the hexagon alone, as Sets with nothing logged.
    empty = windows.length > 0 && windows.every((w) => !strength[w]);
    said = `Strength, 100 is no change. ${windows
      .map((w) => {
        const p = pctsOf(w);
        return `${nameOf(w)}: ${AXES.map((g) => {
          const v = p[g];
          return `${g} ${v == null ? "none" : indexText(v)}`;
        }).join(", ")}`;
      })
      .join(". ")}`;
  }
  if (!windows.length) said = "Muscle balance: no window picked";

  const spanButtons: { id: Window; label: string }[] = [
    { id: "7d", label: "7d" },
    { id: "30d", label: "30d" },
    ...(muscles.phase ? [{ id: "phase" as const, label: "Phase" }] : []),
  ];
  return (
    <section className="rls-card rh-panel rh-muscles" aria-label="Muscle balance" style={{ "--rh-c": TRACK_ACCENT.training } as CSSProperties}>
      <div className="rh-panel-head tall">
        {/* How it is worked out behind a ? (23 Oct, Alex asked for these two). */}
        <span className="rh-titled">
          <h2 className="rh-panel-title">Muscle balance</h2>
          <HelpTip title="Muscle balance">
            <p><b>Sets:</b> how many sets your client did for each muscle. The dashed line is the period before, to compare.</p>
            <p><b>Strength:</b> how much stronger each muscle got, with the Epley formula (see Strength). 100 means no change, 110 means 10% stronger, 90 means 10% weaker.</p>
            <p><b>7d, 30d, Phase:</b> the last 7 days, the last 30 days, or since this training phase started.</p>
          </HelpTip>
        </span>
        <div className="rd-btn-group" role="group" aria-label="Measure">
          {(["sets", "strength"] as const).map((m) => (
            <button key={m} type="button" className={measure === m ? "on" : ""} aria-pressed={measure === m} onClick={() => setMeasure(m)}>
              {m === "sets" ? "Sets" : "Strength"}
            </button>
          ))}
        </div>
      </div>
      {/* 7d, 30d and Phase each on or off, all off for an empty hexagon. */}
      <div className="rh-spans-row">
        <div className="rd-btn-group rh-spans" role="group" aria-label="Windows">
          {spanButtons.map((s) => {
            const on = windows.includes(s.id);
            return (
              // A window on is its colour on the hexagon as an outline and words, not the ink fill (23 Oct, Alex).
              <button key={s.id} type="button" className={on ? "on" : ""} style={{ "--win": WINDOW_COLOR[s.id] } as React.CSSProperties} aria-pressed={on} onClick={() => toggle(s.id)}>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="rh-radar-wrap">
        <Radar shapes={empty ? [] : shapes} figures={empty ? [] : figures} rings={measure === "sets" ? SET_RINGS : STRENGTH_RINGS} label={empty ? "Muscle balance: none yet" : said} />
      </div>
      {/* Always there, empty or not, so the card keeps its height. */}
      <div className="rh-key">
        {!empty &&
          key.map((k) => (
            <span key={k.label}>
              <i className={k.dashed ? "dash" : "line"} style={k.dashed ? undefined : { background: k.color }} aria-hidden="true" />
              {k.label}
            </span>
          ))}
      </div>
    </section>
  );
}

// The hexagon: hairline rings and six spokes, the shapes over them (Sets: the window before as a dashed grey outline,
// this one filled in training purple; Strength: 100 as the dashed grey ring); each axis named outside its corner with
// the windows' figures under the name. It scales with its card up to 440px wide (21 Oct, Alex: "there's a lot of
// space"), its words with it: at full size the names read about 13px and the figures 15px. The sides keep room for the
// longest name and figure ("Shoulders", "14 of 22").
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
function Radar({ shapes, figures, rings, label }: { shapes: Shape[]; figures: Figures[]; rings: number[]; label: string }) {
  const shape = (at: PerGroup) => roundedPath(AXES.map((g, i) => corner(i, RR * Math.max(0, at[g] ?? 0))), ROUND);
  const ring = (f: number) => AXES.map((_, i) => corner(i, RR * f).join(",")).join(" ");
  return (
    <svg className="rh-radar" viewBox={`0 0 ${RW} ${RH}`} role="img" aria-label={label}>
      {rings.map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#e1e5eb" strokeWidth={1} />
      ))}
      {AXES.map((g, i) => {
        const [x, y] = corner(i, RR);
        return <line key={g} x1={CX} y1={CY} x2={x} y2={y} stroke="#e1e5eb" strokeWidth={1} />;
      })}
      {shapes.map((s, i) =>
        s.dashed ? (
          <path key={i} d={shape(s.at)} fill="none" stroke={s.color} strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />
        ) : (
          <path key={i} d={shape(s.at)} fill={s.color} fillOpacity={s.fill ?? 0} stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
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
              {figures.map((s, j) => (
                <tspan key={j} dx={j ? 7 : 0} fill={s[g].color}>
                  {s[g].text}
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
function StrengthCard({ strength, hasPhase }: { strength: HomeBoard["strength"]; /** A training phase (or a programme standing for one): Phase is there to pick. */ hasPhase: boolean }) {
  const [picked, setSpan] = useState<StrengthSpan>("phase");
  // No training phase: no Phase to pick, 7d instead (22 Oct), as Muscle balance. A phase with nothing logged keeps it.
  const span: StrengthSpan = picked === "phase" && !hasPhase ? "7d" : picked;
  const w = strength?.[span] ?? null;
  const rows = STRENGTH_GROUPS.map((g) => {
    const x = w?.groups.find((s) => s.group === g);
    return { group: g, r: x ? pctOf(x.pct) : null, exercises: x?.exercises ?? 0 };
  });
  const most = Math.max(0, ...rows.map((x) => Math.abs(x.r ?? 0)));
  return (
    <section className="rls-card rh-panel" aria-label="Strength">
      <div className="rh-panel-head tall">
        <span className="rh-titled">
          <h2 className="rh-panel-title">Strength</h2>
          <HelpTip title="Strength">
            <p><b>How it’s measured:</b> each set is turned into the most your client could lift once, with the Epley formula: weight × (1 + reps ÷ 30). The best set of each day counts.</p>
            <p><b>7d, 30d:</b> the last 7 or 30 days against the 7 or 30 days before.</p>
            <p><b>Phase:</b> the latest workout against the first one of this phase.</p>
            <p><b>Each muscle:</b> the average of its exercises.</p>
            <p><b>Assisted exercises:</b> less help means stronger.</p>
          </HelpTip>
        </span>
        <span className="rh-panel-tools">
          <span className="rd-btn-group" role="group" aria-label="Window">
            {STRENGTH_SPANS.filter((s) => s.id !== "phase" || hasPhase).map((s) => (
              <button key={s.id} type="button" className={span === s.id ? "on" : ""} aria-pressed={span === s.id} onClick={() => setSpan(s.id)}>
                {s.label}
              </button>
            ))}
          </span>
        </span>
      </div>
      {/* No Overall or new bests (23 Oct, Alex: "out of here"): the groups alone. */}
      <div className="rh-str">
        {rows.map((x) => (
          <div key={x.group} className="rh-str-row" title={x.r == null ? undefined : `${x.exercises} exercise${x.exercises === 1 ? "" : "s"}`}>
            <span className="rh-str-name">{x.group}</span>
            {/* From the centre (23 Oct, Alex: a drop read as progress): a gain grows right in green, a drop left in red,
                the biggest change reaching the end. */}
            <span className="rh-str-track" aria-hidden="true">
              <i className={x.r != null && x.r < 0 ? "down" : "up"} style={{ width: !x.r || most === 0 ? 0 : `max(2px, ${(Math.abs(x.r) / most) * 50}%)` }} />
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

// ---- Weight: 7d | 30d | Phase as Strength, the latest and the change under the title; the window's readings over their
// time frame and scale (23 Oct, Alex: "there is no time frame or anything"), the latest a dot (from two readings), dashed
// where weigh-ins were missed; where they are heading, in Phase. "None yet" only with no weight at all.
/** A grid axis's day keeps its month's name (design rules 7): "5 Oct", "5 Oct 2025" in another year. */
const AXIS_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const axisDay = (ms: number) => {
  const x = new Date(ms);
  return `${x.getDate()} ${AXIS_MONTHS[x.getMonth()]}${x.getFullYear() !== new Date().getFullYear() ? ` ${x.getFullYear()}` : ""}`;
};
const DAY_MS = 86_400_000;
/** The steps Weight's grid may take, in tenths of a kg: 0.1, 0.2, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 10, 20, 50. The in-between
    steps (2 Nov, Alex: "a 3.3 kg difference… but it's quite flat… show a little bit of drama") let the frame hug the
    readings: 5 kg straight after 2 kg left a month's 4 kg in the middle 40% of the chart. */
const WEIGHT_STEPS = [1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 100, 200, 500];
/** Weight's scale: three lines a round step apart that frame the readings, the lowest at or under the lightest and the
    highest at or over the heaviest; the smallest step that does it, so the line fills the chart's height. The lines sit on
    whole steps under a kg, on any half kg above (86.5 | 89 | 91.5), never further out than they need. Tenths when a line
    is not a whole kg. A near-flat run is framed around its middle. Worked in tenths, so 84.3 stays 84.3. */
function weightGrid(vs: number[]): { lines: [number, number, number]; decimals: number } {
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  if (max - min < 0.2) {
    const mid = (min + max) / 2;
    min = mid - 0.1;
    max = mid + 0.1;
  }
  const minT = Math.floor(min * 10 + 1e-6);
  const maxT = Math.ceil(max * 10 - 1e-6);
  let s = WEIGHT_STEPS[WEIGHT_STEPS.length - 1];
  let base = Math.floor(minT / s) * s;
  for (const step of WEIGHT_STEPS) {
    const align = step < 10 ? step : 5;
    const b = Math.floor(minT / align) * align;
    if (b + 2 * step >= maxT) {
      s = step;
      base = b;
      break;
    }
  }
  const lines: [number, number, number] = [base / 10, (base + s) / 10, (base + 2 * s) / 10];
  return { lines, decimals: lines.every((v) => Number.isInteger(v)) ? 0 : 1 };
}

type WeightPoint = NonNullable<HomeBoard["weight"]>["points"][number];

// 7d | 30d | Phase (23 Oct, Alex: "the coaches want to see 7 days, 30 days and phase"), laid out as Strength above it: the
// capsule on the head's right, the latest and the change over the window on the line under the title. Phase at first,
// and only with a phase (else 30d). The chart, its dates, scale and dots follow the window; no prediction (23 Oct,
// Alex). A window with under two readings draws no chart, but keeps its room while another window has one, so
// switching never moves the card.
function WeightCard({
  weight,
  goals,
  clientId,
}: {
  weight: HomeBoard["weight"];
  /** The client's weight goals by date (2 Nov, Alex): the current one in the head, all of them on the chart. */
  goals: WeightGoalView[];
  clientId: number;
}) {
  // The Goal view first while a goal runs (2 Nov, Alex: "a toggle that switches to the graph where we see the weight goal
  // and the progress… and the line that we are tracing"): its start to its date, whatever the other windows hold.
  const [picked, setSpan] = useState<StrengthSpan | "goal">(() => (goals.some((g) => g.active) ? "goal" : "phase"));
  // The goal pop-up: a goal to change, or none for a new one.
  const [goalDlg, setGoalDlg] = useState<{ goal: WeightGoalView | null } | null>(null);
  const all = weight ? [...weight.points].sort((a, b) => timeOf(a.date) - timeOf(b.date)) : [];
  const latest = weight ? (weight.now ?? all.at(-1)?.value ?? null) : null;
  // The head (2 Nov, Alex): the current goal's verdict as the one state pill after the title, its facts after the change
  // under it (`82 kg by 20/12 | 5.6 kg to go`; settled, `Reached 14/12` or `Missed by 1.2 kg`), and + Goal always in the
  // tools, so the card never changes height between windows, readings or none.
  const cur = currentGoal(goals);
  const verdict = cur?.verdict ? <span className={`trn-state ${VERDICT_TONE[cur.verdict]}`}>{VERDICT_WORD[cur.verdict]}</span> : null;
  const goalParts: ReactNode[] = !cur
    ? []
    : cur.settled
      ? [cur.reachedOn ? `Reached ${dayMonth(cur.reachedOn)}` : cur.missedByKg != null ? `Missed by ${kgIn(cur.missedByKg, "kg")} kg` : null]
      : [`${kgIn(cur.targetKg, "kg")} kg by ${dayMonth(cur.byDate)}`, cur.toGoKg != null ? `${kgIn(cur.toGoKg, "kg")} kg to go` : null];
  // One goal at a time (2 Nov, Alex: "once there is a goal take out the option of adding another one, but give the
  // option of editing"): while one runs the pill is `Goal`, opening it; + Goal once it is reached or missed.
  const running = cur && !cur.settled ? cur : null;
  const addGoal = (
    <button type="button" className="trn-pill rh-wgoal-add" onClick={() => setGoalDlg({ goal: running })}>
      <WeightGoalIcon size={14} />
      {running ? "Goal" : "+ Goal"}
    </button>
  );
  const dialog = (
    <Dialog open={goalDlg != null} onOpenChange={(o) => !o && setGoalDlg(null)}>
      {goalDlg && (
        <WeightGoalDialog
          key={goalDlg.goal?.id ?? "new"}
          clientId={clientId}
          goal={goalDlg.goal}
          unit="kg"
          onDone={() => setGoalDlg(null)}
        />
      )}
    </Dialog>
  );
  if (!weight || latest == null)
    return (
      <section className="rls-card rh-panel rh-weight" aria-label="Weight">
        <div className="rh-panel-head tall">
          <h2 className="rh-panel-title">Weight</h2>
          {verdict}
          <span className="rh-panel-tools">{addGoal}</span>
        </div>
        {goalParts.some(Boolean) && (
          <span className="rh-under">
            <SepJoin parts={goalParts} />
          </span>
        )}
        <p className="rls-none">None yet</p>
        {dialog}
      </section>
    );
  const hasPhase = weight.windows.phase != null;
  const active = goals.find((g) => g.active) ?? null;
  const span: StrengthSpan | "goal" = picked === "goal" ? (active ? "goal" : "phase") : picked === "phase" && !hasPhase ? "30d" : picked;
  const winSpan: StrengthSpan = span === "goal" ? "30d" : span;
  const w = (winSpan === "phase" ? weight.windows.phase : weight.windows[winSpan]) ?? weight.windows["30d"];
  const inWindow = (from: string) => all.filter((p) => p.date >= from);
  // The Goal view: the readings since the goal was set, on an axis from its start to its date.
  const goalFrom = span === "goal" && active ? active.startDate : null;
  const points = goalFrom ? inWindow(goalFrom) : inWindow(w.from);
  const charted = [weight.windows["7d"], weight.windows["30d"], weight.windows.phase].some((x) => x != null && inWindow(x.from).length >= 2);
  // The goals over the window (2 Nov, Alex): the scale holds their weights and the plan where the chart begins, so the
  // dashed path and every ring sit inside the frame.
  // Only in the Goal view (3 Nov, Alex: "only show this goal line whenever the goal is toggled, not on 7d 30d or phase"):
  // the other windows are the weight alone, in ink, up to the last reading.
  const plan = goalFrom ? goalLayout(goalFrom, all.at(-1)?.date ?? null, goals, isoToday(), true) : null;
  const grid = goalFrom || points.length >= 2 ? weightGrid([...points.map((p) => p.value), ...(plan ? [...plan.segs.flatMap((s) => [s.kgA, s.kgB]), ...plan.marks.map((m) => m.kg)] : [])]) : null;
  const gridText = grid ? grid.lines.map((v) => v.toFixed(grid.decimals)) : [];
  // The gutter on the right holds the longest of the grid's kg (11px numerals, about 6.3px a character, 8px from the lines).
  const gutter = grid ? Math.max(28, Math.ceil(8 + Math.max(...gridText.map((t) => t.length)) * 6.3)) : null;
  return (
    <section className="rls-card rh-panel rh-weight" aria-label="Weight" style={gutter ? ({ "--rh-wgut": `${gutter}px` } as CSSProperties) : undefined}>
      <div className="rh-panel-head tall">
        {/* The latest beside the title (26 Oct, Alex), the change in kg and in % under it. */}
        <h2 className="rh-panel-title">
          Weight <span className="rh-wnow">{kg1(latest)}</span>
        </h2>
        {verdict}
        <span className="rh-panel-tools">
          {addGoal}
          <span className="rd-btn-group" role="group" aria-label="Window">
            {[...(active ? [{ id: "goal" as const, label: "Goal" }] : []), ...STRENGTH_SPANS.filter((s) => s.id !== "phase" || hasPhase)].map((s) => (
              <button key={s.id} type="button" className={span === s.id ? "on" : ""} aria-pressed={span === s.id} onClick={() => setSpan(s.id)}>
                {s.label}
              </button>
            ))}
          </span>
        </span>
      </div>
      <span className="rh-under">
        <SepJoin
          parts={[
            // In the Goal view, the change since the goal was set (from its start, the weigh-in it was set on).
            ...(goalFrom && active
              ? points.length > 0
                ? [<b key="kg">{signed1(latest - active.startKg)} kg</b>]
                : []
              : w.change != null && w.since
              ? [
                  <b key="kg">{signed1(w.change)} kg</b>,
                  // The change on where the window began: the latest less the change.
                  latest - w.change !== 0 ? <b key="pct">{signed1((w.change / (latest - w.change)) * 100)}%</b> : null,
                ]
              : []),
            ...goalParts,
          ]}
        />
      </span>
      {/* No "On pace for…" under it (23 Oct, Alex: take the prediction out). */}
      {grid ? (
        <WeightChart key={span} points={points} grid={grid} gridText={gridText} rhythm={weight.rhythm} plan={plan} from={goalFrom ?? undefined} onGoal={(g) => setGoalDlg({ goal: g })} />
      ) : charted ? (
        <div className="rh-wempty" aria-hidden="true" />
      ) : null}
      {dialog}
    </section>
  );
}

/** Today in the browser, yyyy-mm-dd. */
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The goals on the Weight chart (2 Nov, Alex; option B of docs/boards/weight-goal-mockup.html), in whole days from the
    window's first reading. Only with a goal being worked on (else the chart is as it was). The axis runs on past the last
    reading to the active goal's date, but never further ahead of today than twice the days shown behind it: a goal
    further out is pinned at that edge (`capped`). The dashed plan runs from the active goal's start (cut at the chart's
    left edge) to its date, then on through each later milestone, each from its start to its date; a settled goal in
    the window is a grey ring alone. */
type GoalLayout = {
  /** The chart's last day (the goal's, the cap's, or today's), and today's. */
  endN: number;
  todayN: number;
  capped: boolean;
  segs: { a: number; kgA: number; b: number; kgB: number }[];
  marks: { goal: WeightGoalView; n: number; kg: number; kind: "active" | "later" | "settled"; pinned: boolean }[];
};
function goalLayout(first: string, lastReading: string | null, goals: WeightGoalView[], today: string, whole = false): GoalLayout | null {
  const active = goals.find((g) => g.active);
  if (!active) return null;
  const nOf = (iso: string) => daysBetween(first, iso.slice(0, 10));
  const todayN = Math.max(lastReading ? nOf(lastReading) : 0, nOf(today));
  const goalN = nOf(active.byDate);
  // The Goal view (2 Nov, Alex) shows the whole goal, start to date; the other windows cap the days ahead.
  const cap = whole ? Infinity : todayN + 2 * Math.max(1, todayN);
  const endN = goalN > todayN ? Math.min(goalN, cap) : todayN;
  const capped = goalN > cap;
  const segs: GoalLayout["segs"] = [];
  const marks: GoalLayout["marks"] = [];
  for (const g of goals) {
    const gN = nOf(g.byDate);
    if (g.settled) {
      if (gN >= 0 && gN <= endN) marks.push({ goal: g, n: gN, kg: g.targetKg, kind: "settled", pinned: false });
      continue;
    }
    const a = Math.max(0, nOf(g.startDate));
    const b = Math.min(endN, gN);
    if (b > a) segs.push({ a, kgA: planKgAt(g, addDaysIso(first, a)), b, kgB: planKgAt(g, addDaysIso(first, b)) });
    if (g.active) {
      // Pinned at the edge, the ring sits where the dashed path ends there (its pill still says the goal), so the scale
      // never stretches to a goal months out and squashes the readings flat.
      if (gN >= 0) marks.push({ goal: g, n: capped ? endN : gN, kg: capped ? planKgAt(g, addDaysIso(first, endN)) : g.targetKg, kind: "active", pinned: capped });
    } else if (gN >= 0 && gN <= endN) marks.push({ goal: g, n: gN, kg: g.targetKg, kind: "later", pinned: false });
  }
  return { endN, todayN, capped, segs, marks };
}

/** Weight's chart, from two readings: the grid's three lines (top, middle, bottom of the plot) with their kg on the right,
    the readings placed by their dates, the dates under it. It stretches to the card (the stroke and the dots keep their
    size). The line joins every reading, solid, and dashed (4 3) over a stretch where weigh-ins were missed (23 Oct, Alex:
    "connect the dots anyway but have a dashed line"; `missed`, by the client's rhythm). Hovering reads the nearest
    reading by its date, never a point on the line between; with focus, ← → step the readings, Home and End the ends.
    The axis runs from the window's first reading to its last, across the whole width (23 Oct, Alex). */
function WeightChart({
  points,
  grid,
  gridText,
  rhythm,
  plan,
  from,
  onGoal,
}: {
  points: WeightPoint[];
  grid: { lines: [number, number, number] };
  gridText: string[];
  rhythm: "daily" | "weekly" | "monthly";
  /** The goals over the window (goalLayout); none draws the chart as it was. */
  plan: GoalLayout | null;
  /** The chart's first day when it is not the first reading's: the Goal view starts on the goal's start (yyyy-mm-dd). */
  from?: string;
  onGoal: (goal: WeightGoalView) => void;
}) {
  const plot = useRef<HTMLDivElement>(null);
  // The reading being read; none while the chart is only looked at.
  const [sel, setSel] = useState<number | null>(null);
  const last = points.length - 1;
  const ts = points.map((p) => timeOf(p.date));
  // From the first reading in the window (23 Oct, Alex: "20 days of 30 logged, show the full axis as 20 days"): a newer
  // client's chart fills out day by day until it holds the window, never empty room on the left. The Goal view from the
  // goal's start, readings there or not.
  const t0 = from ? timeOf(from) : ts[0];
  // Whole days from the chart's first day: a clock change between two readings must not move anything, since the server and
  // the coach's browser can sit in different time zones (one with the change, one without) and both draw the chart.
  const dayAt = ts.map((t) => Math.round((t - t0) / DAY_MS));
  // With a goal being worked on (2 Nov, Alex) the chart runs on past the last reading to its date (or the cap).
  const days = plan ? plan.endN : dayAt[last];
  const [lo, , hi] = grid.lines;
  const xOf = (n: number) => (days > 0 ? (n / days) * 100 : 0);
  const yOf = (kg: number) => ((hi - kg) / (hi - lo)) * 100;
  const xs = dayAt.map(xOf);
  const ys = points.map((p) => yOf(p.value));
  // The line in runs, each reading joined to the one before: solid where it came on time, dashed where weigh-ins were
  // missed between the two. A run goes on while the style does, so its corners stay joined.
  // Smooth through every reading, never past one (25 Oct, Alex: option B of the weight-line mockup; the rounded
  // corners before cut inside the readings, so the hover ring sat off the line): monotoneCurve, the client's Progress
  // chart's too. Each stretch is drawn in its own style, a run going on while the style does.
  // One solid line all the way (25 Oct, Alex: the dashes over missed weigh-ins "look drawn… not high definition"; option C
  // of docs/boards/weight-missed-mockup.html): the missed ones are the strip under it instead.
  // No reading yet in the Goal view: no line, the plan alone.
  const path = xs.length ? `M${xs[0].toFixed(2)} ${ys[0].toFixed(2)} ${monotoneSegments(xs.map((x, i) => ({ x, y: ys[i] }))).join(" ")}` : "";
  const anyMissed = points.some((p) => p.missed);
  // The strip: a mark a day (a week, a month, as the client is asked to weigh in), ink when a reading came in it, pale
  // when none did, across the chart's own days. It stops at today (2 Nov, Alex): the days to a goal are not missed, an
  // empty room under them instead.
  const stripEnd = plan ? plan.todayN : days;
  const strip = (() => {
    const out: { from: number; to: number; on: boolean }[] = [];
    const logged = new Set(dayAt);
    const startOf = (n: number) => {
      const d = new Date(t0 + n * DAY_MS);
      if (rhythm === "weekly") return n - ((d.getDay() + 6) % 7);
      if (rhythm === "monthly") return n - (d.getDate() - 1);
      return n;
    };
    for (let n = 0; n <= stripEnd; ) {
      const from = n;
      let to = n;
      while (to + 1 <= stripEnd && startOf(to + 1) === startOf(from)) to++;
      let on = false;
      for (let k = from; k <= to; k++) if (logged.has(k)) on = true;
      out.push({ from, to, on });
      n = to + 1;
    }
    return out;
  })();
  // The dates under it: the chart's first day, the day halfway (rounded down), the last reading's (none twice).
  const midT = t0 + Math.floor(days / 2) * DAY_MS;
  // With a goal: the first day, `Today` in ink at today, the goal's date (or the cap's day) at the right; no middle day.
  // Today at the right end says so there; one too near an end to fit beside its date is left out.
  const todayAtEnd = !!plan && plan.todayN >= days;
  const todayX = plan ? xOf(plan.todayN) : 0;
  const showToday = !!plan && !todayAtEnd && todayX >= 14 && todayX <= 86;
  const showMid = !plan && days >= 2;
  const showEnd = days > 0;
  const endT = t0 + days * DAY_MS;

  /** The reading whose date sits nearest the pointer. */
  const nearest = (clientX: number) => {
    const el = plot.current;
    if (!el || last < 0) return null;
    const r = el.getBoundingClientRect();
    const at = ((clientX - r.left) / Math.max(1, r.width)) * 100;
    let best = 0;
    xs.forEach((x, i) => {
      if (Math.abs(x - at) <= Math.abs(xs[best] - at)) best = i;
    });
    return best;
  };
  const read = sel == null ? null : points[sel];
  const readText = read ? `${kg1(read.value)}, ${dayMonth(read.date)}` : "";
  const label = last < 0 ? "Weight goal, no reading since it was set" : `Weight, ${axisDay(t0)} to ${axisDay(ts[last])}: ${kg1(points[0].value)} to ${kg1(points[last].value)}, ${points.length} readings${anyMissed ? `, ${strip.filter((p) => !p.on).length} ${rhythm === "daily" ? "days" : rhythm === "weekly" ? "weeks" : "months"} without one` : ""}`;

  return (
    <div className={`rh-wbox${plan ? " goaled" : ""}`}>
      <div className="rh-wstage">
      <div
        className="rh-wchart"
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={(e) => setSel(nearest(e.clientX))}
        onPointerDown={(e) => setSel(nearest(e.clientX))}
        onPointerLeave={() => setSel(null)}
        onFocus={() => setSel((s) => s ?? (last >= 0 ? last : null))}
        onBlur={() => setSel(null)}
        onKeyDown={(e) => {
          if (last < 0) return;
          const at = sel ?? last;
          if (e.key === "ArrowLeft") setSel(Math.max(0, at - 1));
          else if (e.key === "ArrowRight") setSel(Math.min(last, at + 1));
          else if (e.key === "Home") setSel(0);
          else if (e.key === "End") setSel(last);
          else return;
          e.preventDefault();
        }}
      >
        <div className="rh-wplot" ref={plot}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {grid.lines.map((v) => {
              const y = ((hi - v) / (hi - lo)) * 100;
              return <line key={v} x1={0} x2={100} y1={y} y2={y} stroke="#e1e5eb" strokeWidth={1} vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />;
            })}
            {/* The planned path to the goals (2 Nov, Alex), dashed in the goal's beige, under the readings. */}
            {plan && plan.segs.length > 0 && (
              <path
                d={plan.segs.map((s) => `M${xOf(s.a).toFixed(2)} ${yOf(s.kgA).toFixed(2)} L${xOf(s.b).toFixed(2)} ${yOf(s.kgB).toFixed(2)}`).join(" ")}
                fill="none"
                stroke={GOAL_COLOR}
                strokeOpacity={0.55}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {/* The weight's own Body blue in every window (3 Nov, Alex: "have the graph always this blue color"), over the
                beige plan in the Goal view (option B of docs/boards/weight-goal-colours-mockup.html). */}
            <path d={path} fill="none" stroke={WEIGHT_BLUE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {plan && !todayAtEnd && <span className="rh-wtoday" style={{ left: `${todayX}%` }} aria-hidden="true" />}
          {/* Where they stand (2 Nov, Alex): the latest weigh-in a dot, pulsing, on the line. In every window since 4 Nov
              (Alex: "on all the graphs actually... the last check-in, that's what pulsates"), not the Goal view alone. */}
          {last >= 0 && sel == null && <span className="rh-wnowdot" style={{ left: `${xs[last]}%`, top: `${ys[last]}%` }} aria-hidden="true" />}
          {grid.lines.map((v, i) => (
            <span key={v} className="rh-wgrid" style={{ top: `${((hi - v) / (hi - lo)) * 100}%` }} aria-hidden="true">
              {gridText[i]}
            </span>
          ))}
          {/* No dots (23 Oct, Alex: cleaner without); the ring marks the reading being read. */}
          {sel != null && read && (
            <>
              <span className="rh-wguide" style={{ left: `${xs[sel]}%` }} aria-hidden="true" />
              <span className="rh-wring" style={{ left: `${xs[sel]}%`, top: `${ys[sel]}%` }} aria-hidden="true" />
              {/* Over the chart at the reading's date, kept inside the card at either end: 64px holds half the widest pill
                  (about 150px, `102.4 kg | 23/12/2025` for a reading from another year) within the card's 18px padding. */}
              <span className="rh-wtip" style={{ left: `clamp(64px, ${xs[sel]}%, calc(100% + var(--rh-wgut, 32px) - 64px))` }} aria-hidden="true">
                <SepJoin parts={[kg1(read.value), <span key="d" className="rh-wtip-day">{dayMonth(read.date)}</span>]} />
              </span>
            </>
          )}
        </div>
      </div>
      {/* The goals' rings (2 Nov, Alex), over the chart and outside its role="img" box so they can be clicked and reached:
          placed spans, never svg circles (the plot stretches). The goal being worked on in beige, pulsing all the time
          (3 Nov, Alex), later milestones the same fainter, settled ones grey and still; pinned at the right edge when its
          date is past the cap, its weight and date in a white pill. A click opens the goal. */}
      {plan && plan.marks.length > 0 && (
        <div className="rh-wgoals">
          {plan.marks.map((m) => {
            const x = xOf(m.n);
            const y = yOf(m.kg);
            const what = `${kgIn(m.goal.targetKg, "kg")} kg`;
            const side = `${x < 30 ? "right" : ""} ${y < 30 ? "below" : ""}`;
            return (
              <span key={m.goal.id}>
                <button
                  type="button"
                  className={`rh-wgoal ${m.kind}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  aria-label={`Weight goal ${what} by ${dayMonth(m.goal.byDate)}${m.goal.verdict ? `, ${VERDICT_WORD[m.goal.verdict]}` : ""}`}
                  onClick={() => onGoal(m.goal)}
                />
                {/* Its weight and date in a white pill: always when pinned at the edge, else only while the ring is
                    hovered or focused (3 Nov, Alex: "take out the 92 kg… if we hover on top of it we see the value"). */}
                <span className={`rh-wgoal-pill ${m.pinned ? "" : "hover"} ${side}`} style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true">
                  <SepJoin parts={[what, <span key="d" className="rh-wtip-day">{dayMonth(m.goal.byDate)}</span>]} />
                </span>
              </span>
            );
          })}
        </div>
      )}
      </div>
      <div className="rh-wstrip" aria-hidden="true">
        {strip.map((p) => (
          // Each mark centred on its days (25 Oct, Alex: "the dot always centred" with the bar): half a day either side of
          // them, so the first and last are half as wide and a reading's dot sits over the middle of its mark.
          <i key={p.from} className={p.on ? "" : "miss"} style={{ flexGrow: Math.min(days, p.to + 0.5) - Math.max(0, p.from - 0.5) }} />
        ))}
        {/* The days ahead to a goal: room, not marks. */}
        {stripEnd + 0.5 < days && <b className="rh-wstrip-ahead" style={{ flexGrow: days - (stripEnd + 0.5) }} />}
      </div>
      <div className="rh-waxis" aria-hidden="true">
        <span>{axisDay(t0)}</span>
        {showMid && <span className="mid">{axisDay(midT)}</span>}
        {showToday && (
          <span className="today" style={{ left: `${todayX}%` }}>
            Today
          </span>
        )}
        {showEnd && <span className={`end${todayAtEnd ? " today" : ""}`}>{todayAtEnd ? "Today" : axisDay(plan ? endT : ts[last])}</span>}
      </div>
      {/* Outside the role="img" box, whose children a screen reader skips. */}
      <span className="sr-only" aria-live="polite">
        {readText}
      </span>
    </div>
  );
}

// ---- Consistency: the last 30 days (25 Oct, Alex: the Phase span dropped; a week a square read as a day, and the phases'
// lengths differ), a square a day per behaviour. A day done wears its track as a phase does (21 Oct, Alex): the colour
// soft inside, its full strength on the edge; a day not done is grey. The rows in the tracks' order (21 Oct, Alex):
// Check-in, Trained, Food, each named by its track's icon alone.
// Done in part (27 Oct, Alex): a session started and not finished, a check-in not all filled, the square in its colour
// at less strength (a fainter fill and edge).
const CONS: { key: "trained" | "food" | "checkIn"; part?: "trainedPart" | "checkInPart"; label: string; track: PhaseTrack; yes: string; some?: string; no: string }[] = [
  { key: "checkIn", part: "checkInPart", label: "Check-in", track: "lifestyle", yes: "checked in", some: "checked in, not all filled", no: "no check-in" },
  { key: "trained", part: "trainedPart", label: "Trained", track: "training", yes: "trained", some: "a session not finished", no: "no session" },
  { key: "food", label: "Food", track: "nutrition", yes: "food logged", no: "no food logged" },
];
function ConsistencyCard({ days }: { days: HomeBoard["days"] }) {
  return (
    <section className="rls-card rh-panel rh-cons" aria-label="Consistency">
      <div className="rh-panel-head">
        <h2 className="rh-panel-title">Consistency</h2>
      </div>
      {days.length === 0 ? (
        <p className="rls-none">None yet</p>
      ) : (
        <div className="rh-cons-rows">
          {CONS.map((c) => {
            const color = TRACK_ACCENT[c.track];
            const past = days.filter((d) => !d.future);
            const said = `${c.label}: ${past.filter((d) => d[c.key]).length} of ${past.length} days`;
            return (
              <div key={c.key} className="rh-cons-row" style={{ "--rh-c": color, "--rh-t": tintOf(color, 0.18), "--rh-pc": tintOf(color, 0.45), "--rh-pt": tintOf(color, 0.07) } as CSSProperties}>
                <span className="rh-cons-label" title={c.label} aria-hidden="true">
                  <TrackIcon track={c.track} size={16} />
                </span>
                <span className="rh-cons-days" role="group" aria-label={said}>
                  {days.map((d) => {
                    const part = !!(c.part && d[c.part]);
                    const cls = `rh-day${d[c.key] ? (part ? " on part" : " on") : ""}${d.future ? " ahead" : ""}`;
                    const title = d.future ? `${dayMonth(d.date)}: to come` : `${dayMonth(d.date)}: ${d[c.key] ? (part ? c.some : c.yes) : c.no}`;
                    // A done square opens that day's session, check-in or food day (7 Nov, Alex).
                    const href = d[c.key] ? d.links?.[c.key] : undefined;
                    return href ? <Link key={d.date} href={href} className={cls} title={title} aria-label={title} /> : <span key={d.date} className={cls} title={title} />;
                  })}
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
