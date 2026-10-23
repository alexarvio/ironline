"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEventFromMeetingNoteAction, addMeetingAction, completeMeetingAction, removeMeetingAction, sendChatMessageAction, updateMeetingAction } from "../../../lib/actions";
import { MEETING_TYPES, meetingTypeOf, type MeetingTypeId } from "../../../lib/meetingTypes";
import { agreedPoints } from "../../../lib/meetingDates";
import type React from "react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { CalendarIcon, ChatIcon, CheckIcon, MoreIcon, PlayIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import DateText from "../DateText";
import { MonthRange } from "../MonthRange";
import { ConfirmDialog, MessageDialog } from "../training/TrainingDraft";
import { allTimezones, SERVER_TZ, tzShort, zonedToUtc } from "../../../lib/timezones";
import TimezonePicker from "./TimezonePicker";
import Picker from "../Picker";
import { useOpenChat } from "../ChatPanel";
import { dayMonth, logDate } from "../../../lib/dayMonth";
import { Sep, SepJoin } from "../Sep";
import { Fold } from "../Fold";
import { saveFocusAction, saveFocusDraftAction } from "../../../lib/focusActions";
import type { CoachFocus, FocusGoalView } from "../../../lib/focus";
import { useHoldWhile, useSaidSaved, useSaveQueue } from "../useSaveQueue";

// The calmer Meetings tab, as a draft on real data, in the Training draft's
// sheet. The next call with everything to prepare it, the calls after it,
// the past calls with their recap and notes, and a month in the schedule
// dialog to book the next one from.
//
// - The next call: the date tile, the topic (typed in place), when, and the
//   way in. Under it the prep notes, which are yours alone.
//   Cancel, reschedule, or mark it completed with a recap for the client.
// - Past calls: one row a call, newest first; open, the recap for the
//   what was agreed, written for the client.
// - Schedule: the month with this client's calls and everyone else's, the
//   picked day's bookings under it, and the same date typed beside.
// The words typed on a call (the topic, the notes, the summary, To focus on) save themselves (23 Oct, Alex: as the track
// tabs), with the tab's one status after its title; the pop-ups (schedule, link, complete, delete) end in a toast.

export type DraftGoal = { id: number; text: string; tone: "green" | "orange" | "muted"; status: string; def: string; done: boolean; meetingId: number | null };
export type DraftNote = { id: number; text: string; createdAt: string };
export type DraftMeeting = {
  id: number;
  date: string;
  time: string;
  /** The timezone the time was set in; null: the server's (Amsterdam). */
  tz: string | null;
  durationMinutes: number;
  topic: string;
  status: "scheduled" | "completed" | "no-show" | "cancelled";
  link: string | null;
  provider: string;
  host: string;
  prepNotes: string;
  /** Coach-only notes typed during the call. */
  meetingNotes: string;
  summary: string;
  /** The recap's one-line title, over the body on the client's Home. */
  summaryTitle: string;
  notes: DraftNote[];
  goals: DraftGoal[];
  /** Set on a repeating call: the series it belongs to. */
  seriesId: number | null;
  /** What kind of call (9 Oct): Check-in, Review or Other. */
  kind: MeetingTypeId;
  /** To focus on (23 Oct, Alex; lib/focus.ts), a call still to come: the next list as drafted on its tab, never sent;
      completing the call sends it. */
  focusDraft: string[];
  /** A completed call: the list it set, with the client's ticks as they ended; null, none. */
  focusSet: FocusSet | null;
};
type FocusSet = { text: string; done: boolean }[];
export type DraftDot = { date: string; time: string; durationMinutes: number; name: string; topic: string; mine: boolean; completed: boolean };
export type DraftMeetings = {
  today: string;
  /** The call the client asked for (9 Oct), until it is booked or let go. */
  request?: { id: number; about: string; whenSuits: string | null; createdAt: string } | null;
  upcoming: DraftMeeting | null;
  alsoScheduled: DraftMeeting[];
  past: DraftMeeting[];
  goals: DraftGoal[];
  dots: DraftDot[];
  others: { date: string; time: string; durationMinutes: number; name: string }[];
  lastLink: string | null;
  /** The coach's own time zone (Settings, set at onboarding): a new meeting starts in it. */
  coachTz?: string | null;
  /** To focus on (23 Oct, Alex; lib/focus.ts): the client's live list until the next call, with their ticks, and the call
      it came from; null, never set. */
  focus?: CoachFocus | null;
};

/** As lib/focus.ts keeps them (a client file can't read it): three goals, 80 characters each. */
const FOCUS_MAX = 3;
const FOCUS_CHARS = 80;
const sameWords = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
/** The lines as the server keeps them: trimmed, the empty ones and repeats dropped. */
const focusLines = (rows: string[]) => rows.map((r) => r.trim().replace(/\s+/g, " ").slice(0, FOCUS_CHARS)).filter((t, i, all) => t && all.findIndex((x) => sameWords(x, t)) === i).slice(0, FOCUS_MAX);
const fillFocus = (texts: string[]) => [...texts, "", "", ""].slice(0, FOCUS_MAX);
const FOCUS_SAMPLES = ["10,000 steps on 5 days", "Log every meal, weekend too", "In bed by 23:00"];
/** Typed words go this long after the typing stops (as Nutrition's). */
const QUIET_MS = 800;

const savedToast = (what: string) => toast.success("Saved", { description: what });
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDaysIso = (iso: string, n: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const monthCap = (d: string) => parse(d).toLocaleDateString("en-GB", { month: "short" });
const dayNum = (d: string) => String(parse(d).getDate());
/** Dates in words are day/month (dayMonth, 20 Oct, Alex); the day picker's head keeps its words, and the past calls lead with logDate (21 Oct). */
const dayHead = (d: string) => parse(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
const toMin = (t: string) => {
  const [h, m] = t.split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
};
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** "9" → "09:00", "930" → "09:30", "14.30" → "14:30"; anything unreadable is left as typed. */
const tidyTime = (raw: string) => {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const h = digits.length <= 2 ? Number(digits) : Number(digits.slice(0, -2));
  const m = digits.length <= 2 ? 0 : Number(digits.slice(-2));
  return h > 23 || m > 59 ? raw : fromMin(h * 60 + m);
};
const endTime = (time: string, dur: number) => (time ? fromMin(toMin(time) + dur) : "");
const STATUS: Record<DraftMeeting["status"], { text: string; cls: string }> = { scheduled: { text: "Scheduled", cls: "" }, completed: { text: "Completed", cls: "up" }, "no-show": { text: "No-show", cls: "down" }, cancelled: { text: "Cancelled", cls: "" } };
/** A call's title (21 Oct, Alex): the recap's title once written, else the topic, else its kind ("Review call"). */
const titleOf = (m: { summaryTitle: string; topic: string; kind: MeetingTypeId }) => m.summaryTitle.trim() || m.topic.trim() || `${meetingTypeOf(m.kind).label} call`;

/** The title with the kind after it; with no title of its own, the kind's name faint (the tag would say it twice). Past
    calls keep the kind in a column of their own (`tag={false}`). */
function CallTitle({ m, tag = true }: { m: { summaryTitle: string; topic: string; kind: MeetingTypeId }; tag?: boolean }) {
  const own = m.summaryTitle.trim() || m.topic.trim();
  return own ? (
    <>
      {own}
      {tag && <KindTag kind={m.kind} />}
    </>
  ) : (
    <span className="rt-untitled">{titleOf(m)}</span>
  );
}

/** The kind of call as a tag in its colour (21 Oct, Alex: it showed nowhere): the tint behind, the icon and word in it.
    `wide`: a column's tag, the column's width with the word centred, as every pill down a column. */
function KindTag({ kind, wide }: { kind: MeetingTypeId; wide?: boolean }) {
  const t = meetingTypeOf(kind);
  return (
    <span className={`rt-kind${wide ? " wide" : ""}`} style={{ color: t.color, background: `rgba(${t.rgb}, 0.12)` }}>
      <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={t.icon} />
      </svg>
      {t.label}
    </span>
  );
}

const providerOf = (link: string) => {
  try {
    const host = new URL(link.trim()).hostname.toLowerCase();
    if (host.endsWith("meet.google.com")) return "Google Meet";
    if (host.endsWith("zoom.us")) return "Zoom";
    if (host.endsWith("teams.microsoft.com") || host.endsWith("teams.live.com")) return "Teams";
    return "Join call";
  } catch {
    return null;
  }
};

type Dlg = { kind: "message"; label: string } | { kind: "schedule"; date: string; reschedule: DraftMeeting | null; topic?: string } | { kind: "link"; meetingId: number } | { kind: "complete"; meetingId: number } | { kind: "delete"; meetingId: number } | null;

type MeetingsProps = { clientId: number; firstName: string; plan: DraftMeetings };

/** Keyed per client (as Home): another client in the rail starts the tab afresh, so one client's calls, words waiting
 *  and save status never show, or save, under the next. */
export default function MeetingsDraft(props: MeetingsProps) {
  return <MeetingsBoard key={props.clientId} {...props} />;
}

function MeetingsBoard({ clientId, firstName, plan }: MeetingsProps) {
  const today = plan.today;
  // Everything on screen lives in state so the draft can show what an action would do.
  const [meetings, setMeetings] = useState<DraftMeeting[]>([...(plan.upcoming ? [plan.upcoming] : []), ...plan.alsoScheduled, ...plan.past]);
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
  // ---- Autosave (23 Oct, Alex: as Training, Lifestyle and Nutrition): the words typed on a call go through one queue,
  // a moment after the typing stops or on leaving the field; the tab's status after its title says how it stands.
  const [refreshing, startRefresh] = useTransition();
  const reRead = () => startRefresh(() => router.refresh());
  const q = useSaveQueue(reRead);
  // The fields with words typed that haven't gone yet (their quiet moment still running).
  const [waiting, setWaiting] = useState<string[]>([]);
  // Words still waiting are not saved yet (as Nutrition's): Saving… until they have gone.
  const busy = q.saving || waiting.length > 0;
  const saidSaved = useSaidSaved(busy);
  const onWaiting = (key: string, on: boolean) => setWaiting((w) => (on ? (w.includes(key) ? w : [...w, key]) : w.includes(key) ? w.filter((k) => k !== key) : w));
  // While a save is on its way, failed, or its re-read is coming, what the server says is older than the screen.
  const hold = q.saving || q.failed || refreshing;
  const auto: Autosave = { hold, onWaiting };
  useHoldWhile(q.saving || q.failed || waiting.length > 0);
  const saveMeeting = (id: number, f: Record<string, string>) =>
    q.save(async () => {
      await updateMeetingAction(fd({ id, ...f }));
      return true;
    });
  // Compared by content: every refresh hands in new objects with the same
  // values, and resetting on those collapsed panels and threw work away.
  // Never while words wait or save: the screen is newer than the server then.
  const planKey = JSON.stringify([plan.upcoming, plan.alsoScheduled, plan.past]);
  const [seenPlan, setSeenPlan] = useState(planKey);
  if (seenPlan !== planKey && !hold && waiting.length === 0) {
    setSeenPlan(planKey);
    setMeetings([...(plan.upcoming ? [plan.upcoming] : []), ...plan.alsoScheduled, ...plan.past]);
  }
  // To focus on: the client's list as saved, and the call it came from, shown at once on a save (by content too: a
  // refresh is new objects).
  const focusKey = JSON.stringify([plan.focus?.goals ?? [], plan.focus?.meetingId ?? null]);
  const [seenFocus, setSeenFocus] = useState(focusKey);
  const [focusGoals, setFocusGoals] = useState<FocusGoalView[]>(plan.focus?.goals ?? []);
  const [focusFrom, setFocusFrom] = useState<number | null>(plan.focus?.meetingId ?? null);
  if (seenFocus !== focusKey && !hold && waiting.length === 0) {
    setSeenFocus(focusKey);
    setFocusGoals(plan.focus?.goals ?? []);
    setFocusFrom(plan.focus?.meetingId ?? null);
  }
  /** The lines as the list will be after an edit between calls: a goal kept with the same words keeps its tick (as setFocus does). */
  const keepTicks = (lines: string[]): FocusGoalView[] =>
    lines.map((text, i) => {
      const kept = focusGoals.find((g) => sameWords(g.text, text));
      return { id: kept?.id ?? -(i + 1), text, done: kept?.done ?? false };
    });
  const focusDone = focusGoals.filter((g) => g.done).length;
  /** The live list as typed, through the queue, straight to the client: on the past call that holds it (`holderId`), or in
   *  its own section while no completed call can. */
  const saveFocus = (lines: string[], holderId?: number) => {
    setFocusGoals(keepTicks(lines));
    if (holderId != null) setFocusFrom(holderId);
    q.save(async () => {
      await saveFocusAction(fd({ clientId, goals: JSON.stringify(lines), holderId }));
      return true;
    });
  };
  const [dlg, setDlg] = useState<Dlg>(null);
  // Messaging slides the chat in from the right (ChatPanel, 2 Oct).
  const openChat = useOpenChat();
  const close = () => setDlg(null);
  const patchMeeting = (id: number, f: Partial<DraftMeeting>) => setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...f } : m)));
  const byId = (id: number) => meetings.find((m) => m.id === id) ?? null;
  // The calls still to come after this one in its series.
  const laterOf = (id: number) => {
    const m = byId(id);
    if (!m?.seriesId) return [];
    return meetings.filter((x) => x.seriesId === m.seriesId && x.id !== id && x.status === "scheduled" && (x.date > m.date || (x.date === m.date && x.time > m.time))).map((x) => x.id);
  };

  const scheduled = meetings.filter((m) => m.status === "scheduled" && m.date >= today).sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1));
  const upcoming = scheduled[0] ?? null;
  const also = scheduled.slice(1);
  const past = meetings.filter((m) => !(m.status === "scheduled" && m.date >= today)).sort((a, b) => (a.date < b.date ? 1 : -1));
  // To focus on (23 Oct, Alex: "deployed the moment I mark as completed this meeting, and then I can still edit it once it
  // goes down to past calls until I set a new sheet of to focus on on the next call"): the completed call the live list
  // came from, else the latest completed call, holds it (focusHolder, lib/focus.ts); its open row is where it is edited.
  const completedCalls = meetings.filter((m) => m.status === "completed").sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.time !== b.time ? (a.time < b.time ? 1 : -1) : b.id - a.id));
  const holder = completedCalls.find((m) => m.id === focusFrom) ?? completedCalls[0] ?? null;
  /** A call still to come: the next list as drafted on its To focus on tab, kept with the call and never sent. */
  const saveDraft = (id: number, lines: string[]) => {
    patchMeeting(id, { focusDraft: lines });
    q.save(async () => {
      await saveFocusDraftAction(fd({ meetingId: id, goals: JSON.stringify(lines) }));
      return true;
    });
  };
  // None open at first (21 Oct, Alex): a row opens when it is clicked.
  const [openPast, setOpenPast] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(upcoming?.date ?? today);
  // The month's dots: what came from the server, with what was done here on top.
  const dots: DraftDot[] = [...plan.dots.filter((d) => !d.mine || meetings.some((m) => m.date === d.date && m.time === d.time && m.status !== "cancelled")), ...meetings.filter((m) => m.id < 0 && m.status !== "cancelled").map((m) => ({ date: m.date, time: m.time, durationMinutes: m.durationMinutes, name: firstName, topic: m.topic, mine: true, completed: m.status === "completed" }))];

  // ---- A call still to come, as the next call shows it (21 Oct, Alex: an Also scheduled row opens on the same): its title
  // typed in place, when, its link, and the notes one at a time. In a row the tile, the eyebrow and when are the row's own.
  const [tabs, setTabs] = useState<Record<number, "prep" | "meeting" | "summary" | "focus">>({});
  const [openAlso, setOpenAlso] = useState<number | null>(null);
  // The tile, the title (its time after it), the link, ⋯ (23 Oct, Alex: no length or how soon on the right).
  const aGrid = { gridTemplateColumns: "44px minmax(200px, 1fr) auto 32px", columnGap: 24 } as const;
  /** The call's link on its row: Add a link, or Join with its host and Edit (once, not again in the body). */
  const linkControl = (m: DraftMeeting) =>
    m.link ? (
      <span className="rt-linkcell">
        <a className="trn-pill" href={m.link} target="_blank" rel="noopener noreferrer">
          <PlayIcon /> Join {m.provider}
        </a>
        <span className="rt-host">
          {m.host}
          <button type="button" onClick={() => setDlg({ kind: "link", meetingId: m.id })}>
            Edit
          </button>
        </span>
      </span>
    ) : (
      <button type="button" className="trn-pill" onClick={() => setDlg({ kind: "link", meetingId: m.id })}>
        <PlusIcon /> Add a link
      </button>
    );
  const callBody = (m: DraftMeeting) => {
    const tab = tabs[m.id] ?? "prep";
    return (
      <>
        <div className="rt-band">
          <div className="rt-band-main">
            {/* The row's title follows each key; the words go a moment after the typing stops. */}
            <TopicField key={`t${m.id}`} value={m.topic} auto={auto} name={`topic${m.id}`} onType={(v) => patchMeeting(m.id, { topic: v })} onSend={(v) => saveMeeting(m.id, { topic: v.trim() })} />
          </div>
        </div>
        <div className="rt-body">
          {/* Prep notes and meeting notes are the coach's own; the summary is what the client gets on Home once the call is
              completed; To focus on (23 Oct, Alex) is the next list for the top of their Home, a draft kept with the call
              until it is completed (the live one is on the past call that holds it). */}
          <div className="rt-notes-tabs">
            <div className="rd-btn-group" role="radiogroup" aria-label="Notes">
              {(["prep", "meeting", "summary", "focus"] as const).map((t) => (
                <button key={t} type="button" role="radio" className={tab === t ? "on" : ""} aria-checked={tab === t} onClick={() => setTabs((x) => ({ ...x, [m.id]: t }))}>
                  {t === "prep" ? "Prep notes" : t === "meeting" ? "Meeting notes" : t === "summary" ? `Summary for ${firstName}` : "To focus on"}
                </button>
              ))}
            </div>
          </div>
          {tab === "focus" ? (
            <FocusLines key={`f${m.id}`} goals={m.focusDraft.map((text, i) => ({ id: -(i + 1), text, done: false }))} onSave={(lines) => saveDraft(m.id, lines)} auto={auto} name={`draft${m.id}`} />
          ) : tab === "prep" ? (
            <PrepNotes
              key={`p${m.id}`}
              value={m.prepNotes}
              auto={auto}
              name={`prep${m.id}`}
              onSave={(v) => {
                patchMeeting(m.id, { prepNotes: v });
                saveMeeting(m.id, { prepNotes: v });
              }}
            />
          ) : tab === "meeting" ? (
            <PrepNotes
              key={`m${m.id}`}
              label="Meeting notes"
              value={m.meetingNotes}
              auto={auto}
              name={`notes${m.id}`}
              onSave={(v) => {
                patchMeeting(m.id, { meetingNotes: v });
                saveMeeting(m.id, { meetingNotes: v });
              }}
            />
          ) : (
            <PastBody
              key={`s${m.id}`}
              bare
              m={m}
              firstName={firstName}
              auto={auto}
              onSend={(f) => {
                patchMeeting(m.id, f);
                saveMeeting(m.id, f);
              }}
              onAddEvent={(line) => act(() => addEventFromMeetingNoteAction(fd({ meetingId: m.id, text: line, date: m.date })), `Added to ${firstName}'s events: ${line}`)}
            />
          )}
        </div>
      </>
    );
  };

  // A call still to come as a row (21 Oct, Alex): the date tile, its title with its time and the chevron after it, its
  // link on the right (23 Oct, Alex: where its length and how soon were), ⋯; open, the call's body under it. The next call and Also scheduled are both this.
  const [nextOpen, setNextOpen] = useState(true);
  const callRow = (m: DraftMeeting, isOpen: boolean, toggle: () => void) => (
    <div key={m.id} className={`rd-row rt-arow${isOpen ? " open" : ""}`}>
      {/* A click anywhere opens it; for the keyboard the title is the button, ⋯ its sibling (no controls nested in a button). */}
      <div className="rd-row-main" style={aGrid} onClick={toggle}>
        <span className="rt-tile">
          <small>{monthCap(m.date)}</small>
          <b>{dayNum(m.date)}</b>
        </span>
        <span className="rd-ex">
          <span className="rd-ex-name rt-call">
            <button type="button" className="rd-row-hit" aria-expanded={isOpen}>
              <CallTitle m={m} />
              {/* Its small fact, the time, before the chevron (design rules 8). */}
              {m.time && <span className="rt-facts">{`${m.time} – ${endTime(m.time, m.durationMinutes)} ${zoneOf(m)}`}</span>}
              <Fold open={isOpen} />
            </button>
          </span>
        </span>
        <span className="rt-linkslot" onClick={(e) => e.stopPropagation()}>
          {/* The client's ticks on the next call (23 Oct, Alex), while there are goals: the count in ink. */}
          {m.id === upcoming?.id && focusGoals.length > 0 && (
            <span className="rt-ticks" title="To focus on">
              <span className="sr-only">To focus on: </span>
              <b>
                {focusDone} of {focusGoals.length}
              </b>{" "}
              done
            </span>
          )}
          {linkControl(m)}
        </span>
        <span className="rd-row-more" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="trn-row-more" aria-label={`More for ${m.topic || "call"}`}>
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={() => setDlg({ kind: "schedule", date: m.date, reschedule: m })}>
                <CalendarIcon /> Reschedule
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "delete", meetingId: m.id })}>
                <TrashIcon /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      {isOpen && <div className="rt-rowbody">{callBody(m)}</div>}
    </div>
  );
  // The kind of call in a column of its own by Status (21 Oct, Alex: so it always lines up), its tag the column's width.
  const pGrid = { gridTemplateColumns: "150px minmax(200px, 1fr) 110px 130px 32px", columnGap: 24 } as const;

  return (
    // Built as the track tabs are (21 Oct, Alex): Training's header, each section's title on the page and its content in one hairline card.
    <div className="rd trn rls rt">
      {/* ---- Header. */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <span className="trn-eyebrow">Meetings</span>
          <div className="trn-name-row">
            <h1 className="trn-name">{firstName}&rsquo;s calls</h1>
            {/* The tab's one save status after its title, as Training's (23 Oct, Alex). */}
            {q.failed ? (
              <span className="trn-allsaved failed" role="alert">
                Not saved<Sep />
                <button type="button" onClick={q.retry}>
                  Retry
                </button>
              </span>
            ) : (
              // Nothing until something is saved (22 Oct, Alex).
              saidSaved && (
                <span className={`trn-allsaved${busy ? " saving" : ""}`} role="status">
                  {busy ? "Saving…" : "All changes saved"}
                </span>
              )
            )}
          </div>
        </div>
        <div className="trn-head-actions">
          {/* White pills, as Training's Phase goals and Note (21 Oct, Alex: the black ones were heavy). */}
          <button type="button" className="trn-pill" onClick={() => setDlg({ kind: "schedule", date: selectedDay, reschedule: null })}>
            <CalendarIcon /> Schedule a meeting
          </button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="trn-more" aria-label="More for meetings">
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={() => (openChat ? openChat() : setDlg({ kind: "message", label: "Meetings" }))}>
                <ChatIcon /> Message about meetings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ---- A call the client asked for (9 Oct): on top until a call is booked, which answers it. A hairline row, no blue box. */}
      {plan.request && (
        <section className="rt-ask" aria-label="Call requested">
          <span className="rt-ask-text">
            <b>{firstName} asked for a call</b>
            <span>
              <SepJoin parts={[`“${plan.request.about}”`, plan.request.whenSuits]} />
            </span>
          </span>
          <button type="button" className="trn-pill" onClick={() => setDlg({ kind: "schedule", date: selectedDay, reschedule: null, topic: plan.request!.about })}>
            <CalendarIcon /> Schedule a call
          </button>
        </section>
      )}
      {/* ---- The next call. Nothing booked: no card (Schedule a meeting is where one gets booked). */}
      {upcoming && (
        <section className="rls-section">
          <div className="trn-weekhead">
            <div>
              <h2>Next call</h2>
            </div>
            <div className="trn-weekhead-actions">
              {/* The one button that commits; Reschedule and Delete are the row's ⋯, as on every call. */}
              <button type="button" className="trn-pill" onClick={() => setDlg({ kind: "complete", meetingId: upcoming.id })}>
                <CheckIcon /> Mark completed
              </button>
            </div>
          </div>
          {/* The same row as Also scheduled (21 Oct, Alex: the two exactly alike), open at first. */}
          <div className="rls-card rt-card rt-calls">
            <div className="rd-rows">{callRow(upcoming, nextOpen, () => setNextOpen((o) => !o))}</div>
          </div>
        </section>
      )}

      {/* ---- Goals set with no completed call to hold them (set before a call was ever completed): the list on its own, to
          see the client's ticks, edit or clear it. Once a call is completed, its row in Past calls holds the list. */}
      {!holder && focusGoals.length > 0 && (
        <section className="rls-section">
          <div className="trn-weekhead">
            <div>
              <h2>To focus on</h2>
            </div>
          </div>
          <div className="rls-card rt-card rt-focus-card">
            <FocusLines key={`focus-${clientId}`} goals={focusGoals} onSave={saveFocus} auto={auto} name="focus" />
          </div>
        </section>
      )}

      {/* ---- Also scheduled: a row a call; it opens on what the next call has (21 Oct, Alex): its title to type, its link, its notes. */}
      {also.length > 0 && (
        <section className="rls-section">
          <div className="trn-weekhead">
            <div>
              <h2>Also scheduled</h2>
            </div>
          </div>
          <div className="rls-card rt-card rt-calls">
            <div className="rd-rows">
              {also.map((m) => callRow(m, openAlso === m.id, () => setOpenAlso((x) => (x === m.id ? null : m.id))))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Past calls. */}
      <section className="rls-section">
        <div className="trn-weekhead">
          <div>
            <h2>Past calls</h2>
          </div>
        </div>
        <div className="rls-card rt-card">
          {past.length === 0 ? (
            <p className="rt-none">None yet</p>
          ) : (
            <div className="rd-rows">
              <div className="rd-cols" aria-hidden="true" style={pGrid}>
                <span>Date</span>
                <span>Call</span>
                <span>Type</span>
                <span>Status</span>
                <span />
              </div>
              {past.map((m) => {
                const isOpen = openPast === m.id;
                const st = STATUS[m.status];
                return (
                  <div key={m.id} className={`rd-row rn-day${isOpen ? " open" : ""}`}>
                    {/* A click anywhere opens it; for the keyboard the date is the button, ⋯ its sibling. */}
                    <div className="rd-row-main" style={pGrid} onClick={() => setOpenPast((x) => (x === m.id ? null : m.id))}>
                      <span className="rd-ex">
                        <span className="rd-ex-name">
                          <button type="button" className="rd-row-hit" aria-expanded={isOpen}>
                            <span className="rd-logdate">{logDate(m.date)}</span>
                            <Fold open={isOpen} />
                          </button>
                        </span>
                      </span>
                      <span className="rd-ex">
                        <span className="rd-ex-name rt-call">
                          <CallTitle m={m} tag={false} />
                        </span>
                      </span>
                      <span>
                        <KindTag kind={m.kind} wide />
                      </span>
                      <span>
                        <span className={`rt-state ${st.cls}`}>{st.text}</span>
                      </span>
                      <span className="rd-row-more" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className="trn-row-more" aria-label={`More for ${m.topic || "call"}`}>
                            <MoreIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="pb-menu">
                            <DropdownMenuItem onSelect={() => (openChat ? openChat() : setDlg({ kind: "message", label: `${m.topic || "Check-in call"} · ${dayMonth(m.date)}` }))}>
                              <ChatIcon /> Message about this call
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "delete", meetingId: m.id })}>
                              <TrashIcon /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    </div>
                    {isOpen && (
                      <PastBody
                        m={m}
                        firstName={firstName}
                        auto={auto}
                        onSend={(f) => {
                          patchMeeting(m.id, f);
                          saveMeeting(m.id, f);
                        }}
                        onAddEvent={(line) => act(() => addEventFromMeetingNoteAction(fd({ meetingId: m.id, text: line, date: m.date })), `Added to ${firstName}'s events: ${line}`)}
                        focus={
                          // The call holding the live list: typed in place, straight to the client, until the next call
                          // is completed. An older call: the list it set, as it ended, read only. None set: nothing.
                          m.id === holder?.id ? (
                            <FocusLines key={`hf${m.id}`} goals={focusGoals} onSave={(lines) => saveFocus(lines, m.id)} auto={auto} name={`focus${m.id}`} />
                          ) : m.focusSet?.length ? (
                            <FocusRecord goals={m.focusSet} />
                          ) : null
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ---- Dialogs. One open at a time. */}
      <Dialog open={dlg != null} onOpenChange={(o) => !o && close()}>
        {dlg?.kind === "message" && (
          <MessageDialog
            firstName={firstName}
            label={dlg.label}
            onSend={(text) => {
              const label = dlg.label;
              close();
              act(() => sendChatMessageAction(fd({ clientId, text })));
              toast.success("Sent", { description: `${firstName} gets it on Home, about ${label}.` });
            }}
          />
        )}
        {dlg?.kind === "schedule" && (
          <ScheduleDialog
            date={dlg.date}
            reschedule={dlg.reschedule}
            initialTopic={dlg.topic ?? ""}
            lastLink={plan.lastLink}
            coachTz={plan.coachTz ?? null}
            dots={dots}
            today={today}
            onSave={(v) => {
              if (dlg.reschedule) {
                patchMeeting(dlg.reschedule.id, { ...v, kind: v.meetingType, provider: v.link ? (providerOf(v.link) ?? "Join call") : "", host: v.link ? new URL(v.link).hostname : "" });
                act(() => updateMeetingAction(fd({ id: dlg.reschedule!.id, date: v.date, time: v.time, tz: v.tz, durationMinutes: v.durationMinutes, topic: v.topic, link: v.link ?? "", meetingType: v.meetingType })), `Moved to ${dayMonth(v.date)}${v.time ? ` at ${v.time}` : ""} · ${firstName} sees the new time`);
              } else {
                act(
                  () => addMeetingAction(fd({ clientId, date: v.date, time: v.time, tz: v.tz, durationMinutes: v.durationMinutes, topic: v.topic, link: v.link ?? "", repeatWeeks: v.repeatWeeks, count: v.count, meetingType: v.meetingType })),
                  v.repeatWeeks
                    ? `${v.count} calls, ${v.repeatWeeks === 1 ? "weekly" : `every ${v.repeatWeeks} weeks`} from ${dayMonth(v.date)}${v.time ? ` at ${v.time}` : ""} · ${firstName} sees them on Home`
                    : `${v.topic || "Check-in call"} on ${dayMonth(v.date)}${v.time ? ` at ${v.time}` : ""} · ${firstName} sees it on Home`
                );
              }
              setSelectedDay(v.date);
              close();
            }}
          />
        )}
        {dlg?.kind === "link" && byId(dlg.meetingId) && (
          <LinkDialog
            value={byId(dlg.meetingId)!.link ?? ""}
            onSave={(link) => {
              patchMeeting(dlg.meetingId, { link: link || null, provider: link ? (providerOf(link) ?? "Join call") : "", host: link ? new URL(link).hostname : "" });
              const id = dlg.meetingId;
              close();
              act(() => updateMeetingAction(fd({ id, link })), link ? `Link: ${firstName} gets a Join button` : "Link removed");
            }}
          />
        )}
        {dlg?.kind === "complete" && byId(dlg.meetingId) && (
          <CompleteDialog
            firstName={firstName}
            value={byId(dlg.meetingId)!.summary}
            title={byId(dlg.meetingId)!.summaryTitle}
            // The call's own draft (its To focus on tab), else the live list as it is.
            goals={byId(dlg.meetingId)!.focusDraft.length ? byId(dlg.meetingId)!.focusDraft : focusGoals.map((g) => g.text)}
            onComplete={(summary, summaryTitle, lines) => {
              const id = dlg.meetingId;
              // To focus on goes with the call, at once (23 Oct, Alex: "every time this is set on a new call the old ones
              // get overridden"): the lines replace the whole list, every tick reset, the same words too. The call holds
              // it from now; the call that held it keeps it as it ended, ticks and all.
              if (holder && holder.id !== id && (plan.focus || focusGoals.length)) patchMeeting(holder.id, { focusSet: focusGoals.length ? focusGoals.map(({ text, done }) => ({ text, done })) : null });
              patchMeeting(id, { status: "completed", summary, summaryTitle, focusDraft: [], focusSet: lines.length ? lines.map((text) => ({ text, done: false })) : null });
              setFocusGoals(lines.map((text, i) => ({ id: -(i + 1), text, done: false })));
              setFocusFrom(id);
              setOpenPast(id);
              close();
              act(
                async () => {
                  await completeMeetingAction(fd({ id, summary, summaryTitle, withFocus: 1 }));
                  await saveFocusAction(fd({ clientId, meetingId: id, fromCall: 1, goals: JSON.stringify(lines) }));
                },
                summary || summaryTitle ? `Completed, recap${lines.length ? " and To focus on" : ""} sent to ${firstName}'s Home` : lines.length ? `Completed, To focus on sent to ${firstName}'s Home` : "Completed"
              );
            }}
          />
        )}
        {dlg?.kind === "delete" && byId(dlg.meetingId) && (
          <ConfirmDialog
            title={`Delete ${byId(dlg.meetingId)!.topic || "this call"}?`}
            description="The call goes, with its notes and recap. Goals set in it stay."
            confirm="Delete"
            danger
            tick={laterOf(dlg.meetingId).length ? `Also delete the ${laterOf(dlg.meetingId).length} later ${laterOf(dlg.meetingId).length === 1 ? "call" : "calls"} in this series` : null}
            onConfirm={(also) => {
              const gone = new Set([dlg.meetingId, ...(also ? laterOf(dlg.meetingId) : [])]);
              setMeetings((prev) => prev.filter((m) => !gone.has(m.id)));
              const id = dlg.meetingId;
              close();
              act(() => removeMeetingAction(fd({ id, following: also ? "1" : "" })), gone.size > 1 ? `${gone.size} calls deleted` : "Call deleted");
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

/** How a field saves itself: the queue's state (`hold`: a save on its way, failed, or its re-read still coming, so the
 *  server's words are older than the screen's) and the fields with words still waiting for their quiet moment. */
type Autosave = { hold: boolean; onWaiting: (name: string, on: boolean) => void };

/** Words that save themselves (23 Oct, Alex: Meetings as the track tabs). What is typed stays in the field and goes a
 *  moment after the typing stops, on leaving the field, or as the row closes or the tab switches. The saved words come in
 *  only while the field is left and nothing is on its way, so a save coming back never moves or trims what is being
 *  typed. `typed`: typed since the field was entered (the note's line shows). */
function useAutoText(saved: string, onSend: (v: string) => void, { hold, onWaiting }: Autosave, name: string) {
  const [text, setText] = useState(saved);
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState(false);
  const [seen, setSeen] = useState(saved);
  if (seen !== saved && !focused && !hold) {
    setSeen(saved);
    setText(saved);
  }
  const now = useRef(text);
  const send = useRef(onSend);
  const wait = useRef(onWaiting);
  useEffect(() => {
    now.current = text;
    send.current = onSend;
    wait.current = onWaiting;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    wait.current(name, false);
    send.current(now.current);
  };
  // The row closing or the tab switching with words still waiting: they go now.
  useEffect(
    () => () => flush(),
    // Unmount only; the refs hold what is current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  return {
    text,
    typed,
    focused,
    bind: {
      value: text,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const v = e.target.value;
        setText(v);
        setTyped(true);
        now.current = v;
        dirty.current = true;
        wait.current(name, true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, QUIET_MS);
      },
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        setTyped(false);
        flush();
      },
    },
  };
}

/** The call's topic, typed in place on its band; the row's title follows each key (`onType`), Enter leaves it. */
function TopicField({ value, auto, name, onType, onSend }: { value: string; auto: Autosave; name: string; onType: (v: string) => void; onSend: (v: string) => void }) {
  const f = useAutoText(value, onSend, auto, name);
  return (
    <input
      className="rt-topic"
      {...f.bind}
      onChange={(e) => {
        f.bind.onChange(e);
        onType(e.target.value);
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder="Topic"
      aria-label="Topic"
    />
  );
}

/** The coach's prep notes (or meeting notes) on a call: words on the page, no box; the line comes up once something is
 *  typed (as every note), and the words save themselves (23 Oct, Alex: no Cancel or Save). */
function PrepNotes({ value, onSave, auto, name, label = "Prep notes" }: { value: string; onSave: (v: string) => void; auto: Autosave; name: string; /** "Prep notes" or "Meeting notes": both the coach's own. */ label?: string }) {
  const f = useAutoText(value, (v) => onSave(v.trim()), auto, name);
  return (
    <div className="rt-note">
      <textarea className={`rt-note-text${f.typed ? " typed" : ""}`} {...f.bind} placeholder="What to cover, what to ask, what changed since last time…" aria-label={label} />
    </div>
  );
}

/** To focus on (23 Oct, Alex), three lines, each with the client's tick as a small ring (ink once ticked, the words grey);
 *  typed in place, saved by itself as the list is left. The live list on the past call that holds it: it is news on the
 *  client's Home and phone, and half a goal shouldn't be; a word taken out and typed back keeps its tick (ticks go by the
 *  words). A call still to come drafts the next list with it, no ticks yet. */
function FocusLines({ goals, onSave, auto: { hold, onWaiting }, name }: { goals: FocusGoalView[]; onSave: (lines: string[]) => void; auto: Autosave; name: string }) {
  const saved = goals.map((g) => g.text);
  const savedKey = saved.join("\n");
  const [rows, setRows] = useState(() => fillFocus(saved));
  const [focused, setFocused] = useState(false);
  // The saved list comes in by content (never on a refresh's new objects), and only while the list is left and nothing is
  // on its way, so a line being typed never jumps.
  const [seen, setSeen] = useState(savedKey);
  if (seen !== savedKey && !focused && !hold) {
    setSeen(savedKey);
    if (rows.join("\n") !== fillFocus(saved).join("\n")) setRows(fillFocus(saved));
  }
  const now = useRef(rows);
  const savedNow = useRef(savedKey);
  const send = useRef(onSave);
  const wait = useRef(onWaiting);
  useEffect(() => {
    now.current = rows;
    savedNow.current = savedKey;
    send.current = onSave;
    wait.current = onWaiting;
  });
  const dirty = useRef(false);
  /** The list is left, closed, or Enter on its last line: the lines go then, never on a pause. */
  const flush = () => {
    if (!dirty.current) return;
    const lines = focusLines(now.current);
    dirty.current = false;
    wait.current(name, false);
    if (lines.join("\n") !== savedNow.current) send.current(lines);
  };
  useEffect(
    () => () => flush(),
    // Unmount only; the refs hold what is current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const change = (i: number, v: string) => {
    const next = now.current.map((x, j) => (j === i ? v : x));
    setRows(next);
    now.current = next;
    dirty.current = true;
    wait.current(name, true);
  };
  return (
    <div className="rt-focus">
      <ul
        className="rt-focus-list"
        aria-label="To focus on"
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          // The window losing focus (another app or browser tab) keeps the line focused: half a goal doesn't go.
          if (document.activeElement === e.target) return;
          // Moving between its lines is still in the list.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setFocused(false);
          flush();
        }}
      >
        {rows.map((g, i) => {
          const goal = g.trim() ? goals.find((x) => sameWords(x.text, g)) : undefined;
          const done = !!goal?.done;
          const typed = g.trim().replace(/\s+/g, " ") !== (saved[i] ?? "");
          return (
            <li key={i} className={`${g.trim() ? "" : "empty"}${done ? " done" : ""}`}>
              <span className="rt-focus-ring" aria-hidden="true">
                {done && <FocusTick />}
              </span>
              <input
                value={g}
                maxLength={FOCUS_CHARS}
                onChange={(e) => change(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const next = e.currentTarget.closest("li")?.nextElementSibling?.querySelector("input") as HTMLInputElement | null;
                  if (next) next.focus();
                  else flush();
                }}
                className={typed ? "typed" : undefined}
                placeholder={FOCUS_SAMPLES[i]}
                aria-label={`Goal ${i + 1}${done ? ", done" : ""}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A call's summary for the client: under the next call the words alone; on a past call its one-line title over them.
 *  Both save themselves (23 Oct, Alex). */
function PastBody({ m, firstName, onSend, auto, bare, onAddEvent, focus }: { m: DraftMeeting; firstName: string; onSend: (f: { summary: string } | { summaryTitle: string }) => void; auto: Autosave; /** Under the next call: no label or title of its own. */ bare?: boolean; /** A saved line of the recap as an event on the client's plan (9 Oct). */ onAddEvent?: (line: string) => void; /** A past call's To focus on (23 Oct, Alex), under its summary: the live list on the call that holds it, else the list it set. */ focus?: React.ReactNode }) {
  const recap = useAutoText(m.summary, (v) => onSend({ summary: v.trim() }), auto, `summary${m.id}`);
  // The title starts as the call's name (the Meetings screen's subheading), unless the coach wrote one. Bare (a call still
  // to come) has no title field: it is never typed, so never sent.
  // Typed and put back as it was, nothing goes (the call's name would become a title of its own).
  const shownTitle = m.summaryTitle || m.topic || "Check-in call";
  const title = useAutoText(shownTitle, (v) => {
      if (v.trim() !== shownTitle.trim()) onSend({ summaryTitle: v.trim() });
    }, auto, `title${m.id}`);
  // The saved lines as events once the summary is left and saved, so typing never brings them in and out under it.
  const settled = !recap.focused && recap.text.trim() === m.summary.trim();
  return (
    <div className={`rt-past${bare ? " bare" : ""}`}>
      {!bare && <span className="rt-past-label">Summary for {firstName}</span>}
      {!bare && <input className="rt-recap-title" {...title.bind} maxLength={80} placeholder="A one-line title" aria-label="Recap title" />}
      <textarea className={`rt-note-text${recap.typed ? " typed" : ""}${bare ? "" : " short"}`} {...recap.bind} placeholder={`What you covered and what ${firstName} agreed to…`} aria-label={`Summary for ${firstName}`} />
      {/* The saved lines, each one an event on the client's plan in a click (9 Oct): a trip they mentioned, a supplement to start. */}
      {onAddEvent && settled && !agreedPoints(m.summary).prose && agreedPoints(m.summary).points.length > 0 && (
        <ul className="rt-lines" aria-label="Agreed points">
          {agreedPoints(m.summary).points.map((line, i) => (
            <li key={i} className="dlh-line">
              <span>{line}</span>
              <button type="button" className="rd-chip" onClick={() => onAddEvent(line)}>
                <PlusIcon /> Add as event
              </button>
            </li>
          ))}
        </ul>
      )}
      {focus && (
        <>
          <span className="rt-past-label rt-focus-label">To focus on</span>
          {focus}
        </>
      )}
    </div>
  );
}

/** The client's tick in a goal's ring: a white check on the ring's ink. */
function FocusTick() {
  return (
    <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

/** The list an older call set (23 Oct, Alex), read only: each goal's ring as the client left it (ink once ticked, the
 *  words grey), as the call holding the list draws it. */
function FocusRecord({ goals }: { goals: FocusSet }) {
  return (
    <ul className="rt-focus-list read" aria-label="To focus on">
      {goals.map((g, i) => (
        <li key={i} className={g.done ? "done" : ""}>
          <span className="rt-focus-ring" aria-hidden="true">
            {g.done && <FocusTick />}
          </span>
          <span className="rt-focus-words">
            {g.text}
            {g.done && <span className="sr-only">, done</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The month at a glance: this client's calls, everyone else's, and the picked day's bookings under it. The phase pop-up's
 *  calendar (MonthRange, 21 Oct, Alex: one calendar, a week per wheel step), the picked day in ink, the calls as dots. */
function MiniCalendar({ today, selected, dots, onPick }: { today: string; selected: string; dots: DraftDot[]; onPick: (d: string) => void }) {
  const [cursor, setCursor] = useState(() => (selected || today).slice(0, 7));
  // A day typed into the Date field brings its month up (a click on the month leaves the weeks where they are).
  const [shown, setShown] = useState(selected);
  if (shown !== selected) {
    setShown(selected);
    if (/^\d{4}-\d{2}-\d{2}$/.test(selected)) setCursor(selected.slice(0, 7));
  }
  const byDate = new Map<string, DraftDot[]>();
  dots.forEach((d) => byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]));
  const onDay = [...(byDate.get(selected) ?? [])].sort((a, b) => (a.time < b.time ? -1 : 1));
  return (
    <div className="rt-cal">
      <MonthRange
        from={selected}
        to={selected}
        onPick={onPick}
        planned={[]}
        cursor={cursor}
        setCursor={setCursor}
        today={today}
        plain
        legend={null}
        marks={(d) => {
          const list = byDate.get(d);
          return list?.length ? (
            <span className="rt-cal-dots">
              {list.slice(0, 3).map((x, j) => (
                <i key={j} className={x.mine ? "mine" : ""} />
              ))}
            </span>
          ) : null;
        }}
      />
      <div className="rt-day">
        <div className="rt-day-head">
          <span>{dayHead(selected)}</span>
        </div>
        <div className="rt-day-list">
          {onDay.length === 0 ? (
            <p className="rt-empty" style={{ padding: 0 }}>
              Nothing booked.
            </p>
          ) : (
            onDay.map((e, i) => (
              <div key={i} className={`rt-day-row${e.mine ? " mine" : ""}`}>
                <b>{e.time ? `${e.time} – ${endTime(e.time, e.durationMinutes)}` : "no time"}</b>
                <span>
                  <SepJoin parts={[e.name, e.topic, e.completed ? "done" : null]} />
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="rt-legend">
        <span>
          <i className="mine" /> this client
        </span>
        <span>
          <i /> others
        </span>
      </div>
    </div>
  );
}

/** Booking a call, or moving one: the day, a 24-hour time, how long, what about, the way in. The event pop-up's pattern
 *  (21 Oct): the kind as tiles, a clean line for the words, the month on the left with the fields on the right, Cancel and one black pill. */
function ScheduleDialog({ date: initialDate, reschedule, initialTopic = "", lastLink, coachTz, dots, today, onSave }: { date: string; reschedule: DraftMeeting | null; initialTopic?: string; lastLink: string | null; coachTz: string | null; dots: DraftDot[]; today: string; onSave: (v: { date: string; time: string; tz: string; durationMinutes: number; topic: string; link: string | null; repeatWeeks: number; count: number; meetingType: MeetingTypeId }) => void }) {
  const [date, setDate] = useState(reschedule?.date ?? initialDate);
  const [time, setTime] = useState(reschedule?.time ?? "");
  // The time is in the coach's own timezone unless they pick another; a
  // reschedule keeps the meeting's. The client sees it in theirs.
  const [tz, setTz] = useState(() => (reschedule ? reschedule.tz || SERVER_TZ : coachTz || Intl.DateTimeFormat().resolvedOptions().timeZone || SERVER_TZ));
  const [zones] = useState(() => {
    const list = allTimezones();
    return list.includes(tz) ? list : [tz, ...list];
  });
  const [duration, setDuration] = useState(reschedule?.durationMinutes ?? 30);
  // What kind of call (9 Oct): the client's Meetings screen colours it by this.
  const [mtype, setMtype] = useState<MeetingTypeId>(reschedule?.kind ?? "checkin");
  const [topic, setTopic] = useState(reschedule?.topic ?? initialTopic);
  const [link, setLink] = useState(reschedule?.link ?? "");
  // A new call can repeat: every 1, 2 or 4 weeks, this many times (0: once).
  const [repeatWeeks, setRepeatWeeks] = useState(0);
  const [count, setCount] = useState("6");
  const calls = Math.min(26, Math.max(2, Number(count) || 2));
  const lastDate = date ? addDaysIso(date, (calls - 1) * repeatWeeks * 7) : "";
  const linkOk = link.trim() === "" || providerOf(link) != null;
  const kind = MEETING_TYPES.find((t) => t.id === mtype) ?? MEETING_TYPES[0];
  return (
    <DialogContent className="npd rt-npd" style={{ "--npd-c": kind.color, "--npd-rgb": kind.rgb } as React.CSSProperties}>
      <div className="npd-head">
        <DialogTitle className="npd-title">{reschedule ? `Reschedule ${reschedule.topic || "the call"}` : "Schedule a meeting"}</DialogTitle>
        <span className="npd-tools">
          <DialogClose className="npd-x" aria-label="Close">
            ✕
          </DialogClose>
        </span>
      </div>
      <DialogDescription className="sr-only">{reschedule ? "A new day and time for the call" : "The day, time and length of a new call"}</DialogDescription>

      <div className="npd-field">
        <span className="npd-label">Kind of call</span>
        <div className="npd-tiles" role="radiogroup" aria-label="Kind of call">
          {MEETING_TYPES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={mtype === t.id} className={`npd-tile${mtype === t.id ? " on" : ""}`} style={{ "--tc": t.color } as React.CSSProperties} onClick={() => setMtype(t.id)}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={t.icon} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <label className="npd-field">
        <span className="npd-label">Topic</span>
        <input className="npd-line" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Week 6 check-in" maxLength={80} autoFocus={!reschedule} />
      </label>

      <div className="npd-cols">
        <MiniCalendar today={today} selected={date} dots={dots} onPick={setDate} />
        <div className="npd-side">
          {/* Date and time side by side, the timezone they are in under them. */}
          <div className="npd-dates">
            <div className="npd-date arm">
              <span className="npd-date-head">Date</span>
              <DateText value={date} onChange={setDate} label="Date" />
            </div>
            <div className="npd-date">
              <span className="npd-date-head">
                <SepJoin parts={["Time", "24h"]} />
              </span>
              <input className="rd-input rdt" type="text" inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} onBlur={() => setTime(tidyTime(time))} placeholder="14:30" aria-label="Time, 24-hour" />
            </div>
          </div>
          <div className="npd-field">
            <span className="npd-label">Timezone</span>
            <TimezonePicker value={tz} zones={zones} onChange={setTz} />
          </div>
          <div className="npd-field">
            <span className="npd-label">Length</span>
            <div className="npd-seg" role="radiogroup" aria-label="Length">
              {[15, 30, 45, 60].map((d) => (
                <button key={d} type="button" role="radio" aria-checked={duration === d} className={duration === d ? "on" : ""} onClick={() => setDuration(d)}>
                  {d} min
                </button>
              ))}
            </div>
          </div>
          {!reschedule && (
            <div className="npd-field">
              <span className="npd-label">Repeat</span>
              <Picker
                value={String(repeatWeeks)}
                onChange={(v) => setRepeatWeeks(Number(v))}
                label="Repeat"
                options={[
                  { value: "0", label: "Once" },
                  { value: "1", label: "Weekly" },
                  { value: "2", label: "Every 2 weeks" },
                  { value: "4", label: "Every 4 weeks" },
                ]}
              />
              {repeatWeeks > 0 && (
                <span className="rt-repeat">
                  <input type="text" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 2))} onBlur={() => setCount(String(calls))} aria-label="How many calls" />
                  calls{date ? `, the last on ${dayMonth(lastDate)}` : ""}
                </span>
              )}
            </div>
          )}
          <label className="npd-field">
            <span className="npd-label rt-label-row">
              Meeting link
              {lastLink && !link && (
                <button type="button" className="npd-act" onClick={() => setLink(lastLink)}>
                  Reuse last
                </button>
              )}
            </span>
            <input className="npd-line" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
          </label>
        </div>
      </div>

      <div className="npd-foot">
        {link.trim() && !linkOk && <span className="rt-bad">Not a meeting link yet.</span>}
        <DialogClose className="npd-cancel">Cancel</DialogClose>
        <button type="button" className="npd-save" disabled={!date || !linkOk} onClick={() => onSave({ date, time: tidyTime(time), tz, durationMinutes: duration, topic: topic.trim(), link: link.trim() || null, repeatWeeks, count: repeatWeeks ? calls : 1, meetingType: mtype })}>
          {reschedule ? "Move" : repeatWeeks ? `Schedule ${calls}` : "Schedule"}
        </button>
      </div>
    </DialogContent>
  );
}

/** The call's link, on its own so a long URL has room and the provider is read back before saving. */
function LinkDialog({ value, onSave }: { value: string; onSave: (link: string) => void }) {
  const [link, setLink] = useState(value);
  const provider = link.trim() ? providerOf(link) : null;
  const ok = link.trim() === "" || provider != null;
  return (
    <DialogContent className="dlh">
      <div className="dlh-head">
        <DialogTitle className="dlh-title">Meeting link</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <DialogDescription className="sr-only">The link the client joins the call with</DialogDescription>
      <input className="dlh-line" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" aria-label="Link" autoFocus onKeyDown={(e) => e.key === "Enter" && ok && onSave(link.trim())} />
      {link.trim() && !provider && <p className="dlh-error">Not a meeting link yet.</p>}
      <div className="dlh-foot">
        <DialogClose className="dlh-cancel">Cancel</DialogClose>
        {value && !link.trim() ? (
          <button type="button" className="dlh-delete" onClick={() => onSave("")}>
            Remove
          </button>
        ) : (
          <button type="button" className="dlh-go" disabled={!ok || !link.trim()} onClick={() => onSave(link.trim())}>
            {value ? "Save" : "Add"}
          </button>
        )}
      </div>
    </DialogContent>
  );
}

/** Marking a call completed: the last chance to tell the client what came out of it, and what to focus on until the next. */
function CompleteDialog({ firstName, value, title: initialTitle, goals, onComplete }: { firstName: string; value: string; title: string; /** The lines' first words: the call's draft, else the client's live list. */ goals: string[]; onComplete: (summary: string, title: string, focus: string[]) => void }) {
  const [recap, setRecap] = useState(value);
  const [title, setTitle] = useState(initialTitle);
  const [rows, setRows] = useState(() => fillFocus(goals));
  const lines = focusLines(rows);
  return (
    <DialogContent className="dlh rt-complete">
      <div className="dlh-head">
        <DialogTitle className="dlh-title">How did the call go?</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <DialogDescription className="sr-only">A summary for {firstName}, on their Home</DialogDescription>
      {/* A title first (the one line on the client's Home), then what was agreed (opens under it). */}
      <label className="rt-field">
        <span className="dlh-label">Title</span>
        <input className="dlh-line" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Calories held, bench to 100 kg" autoFocus />
      </label>
      <label className="rt-field">
        <span className="dlh-label">Summary for {firstName}</span>
        <textarea className="dlh-line" rows={4} value={recap} onChange={(e) => setRecap(e.target.value)} placeholder="What you covered and what you agreed…" onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && recap.trim() && onComplete(recap.trim(), title.trim(), lines)} />
      </label>
      {/* To focus on (23 Oct, Alex): up to three goals until the next call, Phase goals' look (a dot and a clean line each). */}
      <div className="rt-field">
        <span className="dlh-label" id="rt-focus-label">
          To focus on
        </span>
        <ul className="rt-goals" aria-labelledby="rt-focus-label">
          {rows.map((g, i) => (
            <li key={i} className={g.trim() ? "" : "empty"}>
              <i aria-hidden="true" />
              <input
                value={g}
                maxLength={FOCUS_CHARS}
                onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  (e.currentTarget.closest("li")?.nextElementSibling?.querySelector("input") as HTMLInputElement | null)?.focus();
                }}
                placeholder={FOCUS_SAMPLES[i]}
                aria-label={`Goal ${i + 1}`}
              />
            </li>
          ))}
        </ul>
      </div>
      <div className="dlh-foot">
        {/* Without a summary: the goals typed still go with it. */}
        <button type="button" className="dlh-cancel" onClick={() => onComplete("", "", lines)}>
          Complete without one
        </button>
        <button type="button" className="dlh-go" disabled={!recap.trim()} onClick={() => onComplete(recap.trim(), title.trim(), lines)}>
          Complete
        </button>
      </div>
    </DialogContent>
  );
}


/** "GMT+7": the timezone a meeting's time reads in, at that moment. */
function zoneOf(m: { date: string; time: string; tz: string | null }): string {
  const tz = m.tz || SERVER_TZ;
  return tzShort(tz, zonedToUtc(m.date, m.time, tz));
}
