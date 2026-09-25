"use client";

import { useEffect, useState, useTransition } from "react";
import { markNotificationReadAction } from "../lib/actions";
import VideoReplySheet, { type VideoReplyView } from "./VideoReplySheet";
import PhaseCards, { type HomePhase, type PhaseFoodToday } from "./PhaseCards";
import ProgressPicsCard, { type ProgressPics } from "./ProgressPicsCard";
import QuickActions from "./QuickActions";
import { ChevronDownIcon } from "../components/icons";
import { tzShort } from "../lib/timezones";
import type { LinkView } from "../lib/messageLinks";
import { useNavigateTab, useOpenCheckIn, useOpenCoach, useOpenLink, useOpenMeetings, useOpenMessages, useOpenPhotos } from "./CheckInContext";

// Deliberately does NOT import from ../lib/queries (see the note in the old
// CheckInHub.tsx this replaces — a "use client" file importing queries.ts
// breaks the dev server at runtime). All data comes in as plain props,
// computed server-side in page.tsx. The types below mirror the ones there.
//
// Home, top to bottom: the greeting, the coach's plan as phase cards (each
// with its one thing to do), the check-in fold, the latest thing the coach
// did, and the next call when one is booked. Every block is either
// due today or the client's own; coach content shows only when it exists,
// so a brand-new client's Home is never blank.

export type HomeSession = {
  dayId: number;
  name: string;
  exercises: number;
  sets: number;
  /** Begun on the app and not ended: the button says Resume. */
  live?: boolean;
  liveStartedAt?: string | null;
  /** Its week within the programme, its place in the week, and how many there are. */
  weekNow: number;
  sessionIndex: number;
  sessionCount: number;
  /** A rough length: sets × (rest + a set), to 5 minutes. */
  estMinutes: number;
  coverUrl?: string | null;
  /** Weeks in a row with a session done, this one included. */
  streak?: number;
} | null;

export type UpcomingMeeting = {
  link: string | null;
  provider: string;
  startingNow: boolean;
  monthCap: string;
  dayNumber: string;
  /** "SUN" under the day number on the calendar leaf. */
  weekdayCap: string;
  topic: string;
  inLabel: string;
  /** "Sunday 18:00 · 30 min". */
  whenLabel: string;
  /** The start as a UTC moment (ISO), and how long it runs: the card shows it in the phone's timezone and follows the clock. */
  startIso: string | null;
  durationMinutes: number;
} | null;

/** The coach's recap of the last call, written for the client. */
export type MeetingRecap = { dateLabel: string; title: string; text: string } | null;


export type LatestActivity = {
  kind: "message" | "comment" | "video" | "deploy" | "goal" | "meeting" | "report" | "welcome";
  track?: "training" | "nutrition" | "lifestyle";
  /** For a comment: what it was on. */
  context?: "training" | "nutrition" | "checkin" | "photos";
  /** Not seen yet: a dot and a bolder title. */
  unseen: boolean;
  title: string;
  body: string | null;
  whenLabel: string;
  cta: string;
  link?: LinkView | null;
  videoReply?: VideoReplyView | null;
  actionTab?: string | null;
  actionRef?: number | null;
  /** The notification behind it, marked read when the CTA is followed. */
  notificationId?: number | null;
  /** Coach messages not read yet. */
  unread: number;
  /** Other coach items in the last 7 days. */
  moreThisWeek: number;
};

export default function HomeHub({
  dateLabel,
  firstName,
  coach,
  session,
  progressPics,
  latestActivity,
  upcoming,
  recap,
  phases,
  hello = "Hello",
  checkInCount,
  weekDone,
  trainedToday,
  today,
  food,
}: {
  dateLabel: string;
  firstName: string;
  coach: { firstName: string; photoPath: string | null };
  /** The next session, for the training card's Start. */
  session: HomeSession;
  /** The progress-pictures card at the top of Today's tasks; null, none. */
  progressPics: ProgressPics;
  latestActivity: LatestActivity;
  upcoming: UpcomingMeeting;
  recap: MeetingRecap;
  phases: HomePhase[];
  /** "Good afternoon", worked out on the server in the phone's timezone. */
  hello?: string;
  /** The check-in as the screen shows it, for the lifestyle card. */
  checkInCount: { done: number; total: number } | null;
  /** No session left this week: when the next one starts. */
  weekDone: { nextWeekLabel: string } | null;
  /** A session was ended today. */
  trainedToday: boolean;
  today: string;
  food: PhaseFoodToday;
}) {
  return (
    <div className="hm">
      <HomeBanner dateLabel={dateLabel} firstName={firstName} initialHello={hello} />
      <div className="hm-body">
        {/* "Your plan" first: a card a live phase, each with its one thing to do. */}
        {phases.length > 0 && <PhaseCards phases={phases} coachName={coach.firstName} today={today} nextSession={session ? { dayId: session.dayId, name: session.name, live: !!session.live } : null} food={food} weekDone={weekDone} checkInCount={checkInCount} />}
        {/* What is still to do today, one tap each; "All completed" once it is all done. */}
        <QuickActions
          today={today}
          checkInCount={checkInCount}
          nextSession={session ? { dayId: session.dayId, name: session.name, live: !!session.live } : null}
          trainedToday={trainedToday}
          food={food}
          picsDue={progressPics?.status === "due"}
        />
        {progressPics && <TodaysTasks pics={progressPics} />}
        <LatestActivityCard a={latestActivity} coach={coach} />
        {upcoming ? (
          <MeetingCard m={upcoming} recap={recap} coachFirstName={coach.firstName} />
        ) : (
          recap && <LastMeetingCard recap={recap} coachFirstName={coach.firstName} />
        )}
      </div>
    </div>
  );
}

// ---- 1 · Banner: the date and the greeting, nothing under it ------------

function HomeBanner({ dateLabel, firstName, initialHello }: { dateLabel: string; firstName: string; initialHello: string }) {
  // Drawn by the server in the phone's timezone (its cookie); the phone only
  // confirms it, so the greeting doesn't change after it shows.
  const [hello, setHello] = useState(initialHello);
  useEffect(() => {
    const t = setTimeout(() => {
      const h = new Date().getHours();
      setHello(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    }, 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <header className="hm-banner">
      <div className="hm-eyebrow hm-date">{dateLabel}</div>
      <h1 className="hm-greeting">
        {hello}, {firstName}.
      </h1>
    </header>
  );
}

// ---- 2 · The progress-pictures card while it is due, on its own (no
// heading: the check-in has its own way in, on the lifestyle phase card) ----

function TodaysTasks({ pics }: { pics: NonNullable<ProgressPics> }) {
  const due = pics.status === "due";
  // Just done: a short buzz on phones that can.
  const [seenDue, setSeenDue] = useState(due);
  if (seenDue !== due) {
    setSeenDue(due);
    if (!due) {
      try {
        navigator.vibrate?.(40);
      } catch {}
    }
  }
  return (
    <section className="hm-tasks" aria-label="Progress pictures">
      <ProgressPicsCard pics={pics} />
    </section>
  );
}

// ---- 4 · Latest from the coach --------------------------------------------

function LatestActivityCard({ a, coach }: { a: LatestActivity; coach: { firstName: string; photoPath: string | null } }) {
  const openMessages = useOpenMessages();
  const openCoach = useOpenCoach();
  const openLink = useOpenLink();
  const openCheckIn = useOpenCheckIn();
  const openPhotos = useOpenPhotos();
  const openMeetings = useOpenMeetings();
  const goToTab = useNavigateTab();
  const [watching, setWatching] = useState(false);
  const [, startTransition] = useTransition();
  const follow = () => {
    if (a.notificationId != null) startTransition(() => markNotificationReadAction(a.notificationId!));
    switch (a.kind) {
      case "message":
        openMessages?.();
        return;
      case "comment":
        // A comment goes to what it was on; a change to the check-in or the
        // pictures (or a new lifestyle phase) opens that screen.
        if (a.link) openLink?.(a.link);
        else if (a.context === "checkin" && openCheckIn) openCheckIn("daily");
        else if (a.context === "photos" && openPhotos) openPhotos();
        else openMessages?.();
        return;
      case "video":
        if (a.videoReply) setWatching(true);
        else openMessages?.();
        return;
      case "goal":
        // Goals are no longer on Home: the coach's message about it is in the chat.
        openMessages?.();
        return;
      case "meeting":
        // The Meetings screen: the next call, and what was agreed on the last.
        if (openMeetings) {
          openMeetings();
          return;
        }
        {
          const card = document.querySelector(".hm-mt");
          if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
          else openMessages?.();
        }
        return;
      case "welcome":
        openCoach?.();
        return;
      default:
        goToTab?.(a.actionTab ?? "training", a.actionRef ?? undefined);
    }
  };
  const initial = (coach.firstName || "C").trim().charAt(0).toUpperCase();
  const body = a.body?.trim() || null;
  // Who and when on top, what they did as the title under the name, what they
  // wrote under that. Tapping anywhere goes to where it happened.
  return (
    <section className="hm-latest-note">
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">Latest from {coach.firstName}</span>
      </div>
      <article className="hm-lt" aria-label={`Latest from ${coach.firstName}: ${a.title}`}>
        <button type="button" className={`hm-lt-body${a.unseen ? " unseen" : ""}`} onClick={follow}>
          <span className="hm-lt-avatar" aria-hidden="true">
            {coach.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
              <img src={coach.photoPath} alt="" />
            ) : (
              <span className="hm-lt-initial">{initial}</span>
            )}
          </span>
          <span className="hm-lt-text">
            <span className="hm-lt-meta">
              <span>
                {coach.firstName}
              </span>
              <span>{a.whenLabel}</span>
            </span>
            <span className="hm-lt-title">{a.title}</span>
            {body && <span className="hm-lt-desc">{body}</span>}
          </span>
        </button>
        <div className="hm-lt-foot">
          {/* Left: the chat with the coach. Right: where this happened, always
              just "View" (a.cta keeps the specific words for its label). */}
          <button type="button" className="hm-lt-more" onClick={() => openMessages?.()}>
            Open chat
            {a.unread > 0 && <span className="hm-lt-unread">{a.unread}</span>}
          </button>
          <button type="button" className="hm-lt-cta" onClick={follow} aria-label={a.cta}>
            View
          </button>
        </div>
      </article>
      {watching && a.videoReply && <VideoReplySheet reply={a.videoReply} onClose={() => setWatching(false)} />}
    </section>
  );
}

// ---- 5 · Next meeting, only when booked ------------------------------------

/** A booked call's day and time in the phone's own timezone ("Wednesday
 *  14:30 GMT+7 · 30 min" in Bangkok for 09:30 in Amsterdam). Until the phone
 *  is known (the server render), the labels as the coach typed them. */
export function localMeetingLabels(m: NonNullable<UpcomingMeeting>, now: number | null) {
  const start = m.startIso ? Date.parse(m.startIso) : NaN;
  if (now == null || !Number.isFinite(start)) return { dayNumber: m.dayNumber, monthCap: m.monthCap, inLabel: m.inLabel, whenLabel: m.whenLabel };
  const d = new Date(start);
  const t = new Date(now);
  const dayOf = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((dayOf(d) - dayOf(t)) / 86400000);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    dayNumber: String(d.getDate()),
    monthCap: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    inLabel: days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`,
    whenLabel: `${d.toLocaleDateString("en-US", { weekday: "long" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ${tzShort(zone, d)} · ${m.durationMinutes} min`,
  };
}

export function MeetingCard({ m, recap, coachFirstName }: { m: NonNullable<UpcomingMeeting>; recap: MeetingRecap; coachFirstName: string }) {
  // On Home: a way to every meeting, past and to come.
  const openMeetings = useOpenMeetings();
  // The pill and the Join button follow the clock: checked every minute
  // while Home is in front, and again when the app comes back.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const start = m.startIso ? Date.parse(m.startIso) : NaN;
  const minsToStart = now != null && Number.isFinite(start) ? (start - now) / 60000 : null;
  const live = minsToStart != null ? minsToStart <= 10 && minsToStart >= -m.durationMinutes : m.startingNow;
  const joinable = !!m.link && live;
  const shown = localMeetingLabels(m, now);
  const pillLabel = live ? "Live" : shown.inLabel;
  return (
    <section className={`hm-mt${openMeetings ? " link" : ""}`} aria-label={`Next meeting with ${coachFirstName}`} onClick={openMeetings ? (e) => openFromCard(e, openMeetings) : undefined}>
      <span className="hm-mt-glow" aria-hidden="true" />
      <div className="hm-mt-row">
        <div className="hm-mt-date">
          <b>{shown.dayNumber}</b>
          <small>{shown.monthCap}</small>
        </div>
        <div className="hm-mt-main">
          <div className="hm-mt-top">
            <span className="hm-mt-eyebrow">With {coachFirstName}</span>
            <span className={`hm-mt-pill${live ? " live" : shown.inLabel === "Today" ? " today" : ""}`} aria-label={pillLabel}>
              {live && <span className="hm-mt-live-dot" aria-hidden="true" />}
              {pillLabel}
            </span>
          </div>
          <div className="hm-mt-title">{m.topic}</div>
          <div className="hm-mt-when">{shown.whenLabel}</div>
        </div>
      </div>
      {/* The call's link is always there: Open meeting link before, Join call
          from ten minutes before to the end. */}
      {m.link && (
        <a className={`hm-mt-join${joinable ? "" : " early"}`} href={m.link!} target="_blank" rel="noopener noreferrer">
          <span className="hm-mt-join-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="6" width="13" height="12" rx="2" />
              <path d="M16 10l5-3v10l-5-3z" />
            </svg>
          </span>
          {joinable ? "Join call" : "Open meeting link"}
        </a>
      )}
      {recap && (
        <div className="hm-mt-recap">
          <span className="hm-mt-recap-label">Last meeting · {recap.dateLabel}</span>
          <RecapFold recap={recap} />
        </div>
      )}
      {openMeetings && (
        <button type="button" className="hm-mt-all" onClick={openMeetings}>
          All meetings
        </button>
      )}
    </section>
  );
}

// On Home, a tap anywhere on a meeting card opens the Meetings screen; its
// own buttons and the call's link keep doing their thing.
function openFromCard(e: React.MouseEvent, open: () => void) {
  if ((e.target as HTMLElement).closest("a, button")) return;
  open();
}

// Nothing booked: the coach's notes from the last call instead.
function LastMeetingCard({ recap, coachFirstName }: { recap: NonNullable<MeetingRecap>; coachFirstName: string }) {
  const openMeetings = useOpenMeetings();
  // A heading above, like "Latest from": the card holds the date and the notes.
  return (
    <section className="hm-last-meeting" aria-label={`Notes from your last meeting with ${coachFirstName}`}>
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">Last meeting with {coachFirstName}</span>
        {openMeetings && (
          <button type="button" className="hm-mt-all-link" onClick={openMeetings}>
            All meetings
          </button>
        )}
      </div>
      <div className={`hm-mt hm-mt-last${openMeetings ? " link" : ""}`} onClick={openMeetings ? (e) => openFromCard(e, openMeetings) : undefined}>
        <span className="hm-mt-glow" aria-hidden="true" />
        <div className="hm-mt-top">
          <span className="hm-mt-pill">{recap.dateLabel}</span>
        </div>
        <RecapFold recap={recap} />
      </div>
    </section>
  );
}

// What was agreed, folded to its title: a chevron opens the coach's full
// recap under it, eased open.
function RecapFold({ recap }: { recap: NonNullable<MeetingRecap> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hm-recap">
      <button type="button" className="hm-recap-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="hm-recap-title">{recap.title}</span>
        <span className={`hm-recap-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      <div className={`hm-recap-body${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="hm-recap-clip">
          <p className="hm-recap-text">{recap.text}</p>
        </div>
      </div>
    </div>
  );
}

// ---- Shapes the server page still builds for other tabs ---------------------

/** One track of the coach's plan, flattened. Home no longer shows them; the
    page keeps building them to know whether there is a plan at all. */
export type HomeTrack = {
  track: "nutrition" | "training" | "lifestyle";
  label: string;
  phaseName: string;
  timeLeft: string;
  weekNow: number;
  weekTotal: number;
  progress: number;
  upNext: string | null;
  coachNote: string | null;
};


// ---- Small pieces ----------------------------------------------------------


