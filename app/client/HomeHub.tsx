"use client";

import { NOTIFICATION_TYPES, type NotificationCategory } from "../lib/notificationTypes";
import { useEffect, useRef, useState, useTransition } from "react";
import { markNotificationReadAction } from "../lib/actions";
import VideoReplySheet, { type VideoReplyView } from "./VideoReplySheet";
import PhaseCards, { type HomePhase, type PhaseFoodToday } from "./PhaseCards";
import { defaultPhaseCover } from "../lib/phaseCovers";
import { type ProgressPics } from "./ProgressPicsCard";
import ProgressPicsPill from "./home/ProgressPicsPill";
import type { CheckInForm } from "./CheckInDialog";
import type { HomeEvents } from "./EventsCard";
import EventsTimelineCard from "./home/EventsTimelineCard";
import type { CardCovers } from "./CardPictureSheet";
import { ChevronDownIcon } from "../components/icons";
import { tzShort } from "../lib/timezones";
import { pic } from "../lib/pic";
import type { LinkView } from "../lib/messageLinks";
import { useNavigateTab, useOpenCheckIn, useOpenCoach, useOpenLink, useOpenMeetings, useOpenMessages, useOpenPhotos } from "./CheckInContext";
import FocusList from "./home/FocusList";
import type { HomeFocus } from "../lib/focus";

// Deliberately does NOT import from ../lib/queries (see the note in the old
// CheckInHub.tsx this replaces — a "use client" file importing queries.ts
// breaks the dev server at runtime). All data comes in as plain props,
// computed server-side in page.tsx. The types below mirror the ones there.
//
// Home, top to bottom: the greeting, To focus on while the coach has set goals, the coach's plan as phase cards (each
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
  /** "focus": the coach set what to focus on (23 Oct); it opens Home at its top, where the list is. */
  kind: "message" | "comment" | "video" | "deploy" | "goal" | "meeting" | "report" | "welcome" | "invoice" | "focus";
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
  /** A training change: the week of the session it was in, so View opens it. */
  focusWeek?: number | null;
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
  today,
  food,
  checkInForm = null,
  events,
  trainedToday,
  todayNext = null,
  planGap = null,
  clientId = 0,
  cardCovers = {},
  focus = null,
}: {
  /** To focus on (23 Oct, Alex): the coach's goals until the next call, first under the greeting; null, none. */
  focus?: HomeFocus | null;
  /** Whose Home this is; the redesign mock-ups pass none. */
  clientId?: number;
  /** The client's own card pictures (12 Oct), a track at a time. */
  cardCovers?: CardCovers;
  /** With nothing to do: the next thing, "Next week starts Mon 13 Oct"; null, nothing to say. */
  todayNext?: string | null;
  /** No phase live on training or nutrition: what is next, if anything is scheduled. */
  planGap?: PlanGap | null;
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
  /** Today's check-in lines (13 Oct): the lifestyle card's Log opens them in a pop-up. */
  checkInForm?: CheckInForm | null;
  /** No session left this week: when the next one starts. */
  weekDone: { nextWeekLabel: string } | null;
  /** A session was ended today. */
  trainedToday: boolean;
  today: string;
  food: PhaseFoodToday;
  /** The client's events (theirs and the coach's), for the Events card. */
  events: HomeEvents;
}) {
  const lifestyle = phases.find((p) => p.track === "lifestyle") ?? null;
  const plan = phases.filter((p) => p.track !== "lifestyle");
  const hasCheckIns = !!checkInForm && checkInForm.sections.some((s) => s.metrics.length > 0);
  // The cards (13 Oct): lifestyle first, as a picture card like the others
  // (a plain "Check-in" card when there are lines to log but no phase), then
  // training and nutrition.
  // Every track always has its card (17 Oct, Alex): one with nothing deployed is an empty card that says so,
  // and names the phase the coach has scheduled, if any.
  const empty = (track: HomePhase["track"], id: number): HomePhase => ({ id, track, name: "No plan yet", start: today, end: null, coverUrl: defaultPhaseCover(track, 0), objectives: [], note: null, next: planGap?.next?.track === track ? { name: planGap.next.name, start: planGap.next.start } : null, placeholder: true });
  const cards: HomePhase[] = [
    ...(lifestyle ? [lifestyle] : hasCheckIns ? [{ id: -1, track: "lifestyle" as const, name: "Check-in", start: today, end: null, coverUrl: "/img/lifestyle-bottle.jpg", objectives: [], note: null, next: null }] : [empty("lifestyle", -10)]),
    ...(["training", "nutrition"] as const).flatMap((t, i) => {
      const own = plan.filter((p) => p.track === t);
      return own.length ? own : [empty(t, -11 - i)];
    }),
  ];
  // What is still to do today, counted the way the cards under it show it.
  const foodDone = !!food && ((!!food.mealsTotal && (food.mealsLogged ?? 0) >= food.mealsTotal) || (!!food.target && food.eaten >= food.target * 0.9));
  const todoItems = [
    checkInCount && checkInCount.done < checkInCount.total ? "check-in" : null,
    progressPics?.status === "due" ? "pictures" : null,
    session && (session.live || !trainedToday) ? "training" : null,
    // Food is a to-do only once nutrition is set up (22 Oct): a target, or a nutrition phase live.
    food && !foodDone && (!!food.target || plan.some((p) => p.track === "nutrition")) ? "food" : null,
  ].filter((x): x is string => !!x);
  return (
    <div className="hm">
      <HomeBanner dateLabel={dateLabel} firstName={firstName} initialHello={hello} />
      <div className="hm-body">
        {/* To focus on (23 Oct, Alex): the first thing they see, above Today and the cards, while the coach has set goals
            and a call is booked (24 Oct, Alex: the goals run until it). */}
        {focus && focus.goals.length > 0 && focus.until && <FocusList focus={focus} coach={coach} today={today} />}
        {/* The spine (8 Oct): Today, Your plan, then the coach, so Home is never
            empty. The cards below say what is due; Today speaks only when
            nothing is, so the top of the page still says something true. */}
        {todoItems.length === 0 && <TodayCard next={todayNext} hasPlan={plan.length > 0} nextPhaseStart={planGap?.next?.start ?? null} />}
        {/* "Your plan" (12 Oct): one swipe, lifestyle → training → nutrition, every card the same size.
            The lifestyle card's Log opens today's check-in in a pop-up (13 Oct); the card itself opens the screen. */}
        {cards.length > 0 && (
          <PhaseCards
            phases={cards}
            coachName={coach.firstName}
            today={today}
            nextSession={session ? { dayId: session.dayId, name: session.name, live: !!session.live } : null}
            food={food}
            weekDone={weekDone}
            checkInCount={checkInCount}
            checkIn={hasCheckIns ? checkInForm : null}
            clientId={clientId}
            ownCovers={cardCovers}
          />
        )}
        {/* The coach's latest right under the phases (21 Oct, a coach's feedback, Alex: always here, no jumping). */}
        <LatestActivityCard a={latestActivity} coach={coach} />
        {progressPics && <TodaysTasks pics={progressPics} />}
        {/* What is coming up in their life (7 Oct): a trip, an injury, something started. Theirs to add; the coach's listed too. Above the coach's latest (9 Oct). */}
        {/* The timeline row (15 Oct) once there is anything at all; else the old card's empty state. */}
        {/* The timeline row always (17 Oct): with nothing logged it is just Today, "Nothing on", like the Events screen. */}
        <EventsTimelineCard events={events} today={today} />
        {upcoming ? (
          <MeetingCard m={upcoming} recap={recap} coachFirstName={coach.firstName} />
        ) : (
          recap ? <LastMeetingCard recap={recap} coachFirstName={coach.firstName} /> : <NoMeetingsCard coachFirstName={coach.firstName} />
        )}
      </div>
    </div>
  );
}

// ---- 0 · Today: one line, always. What is left, or that nothing is --------

function TodayCard({ next, hasPlan, nextPhaseStart }: { next: string | null; hasPlan: boolean; /** Between phases: when the next one starts. */ nextPhaseStart: string | null }) {
  const until = nextPhaseStart ? new Date(`${nextPhaseStart}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }) : null;
  // No plan and none coming (22 Oct, Alex): "Nothing to do today" alone, no sentence on what will come.
  const sub = next ?? (hasPlan ? "Rest up." : until ? `Rest up until ${until}.` : null);
  return (
    <section className="hm-today" aria-label="Today">
      <span className="hm-eyebrow">Today</span>
      <b className="hm-today-main">Nothing to do today</b>
      {sub && <small className="hm-today-next">{sub}</small>}
    </section>
  );
}

// ---- 1b · Your plan, with no phase live: what is next, and a way to ask ----

export type PlanGap = { next: { track: "training" | "nutrition" | "lifestyle"; name: string; start: string } | null };
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
  // A quiet task row (16 Oct), not a tile: it shows while a set is due and says
  // Completed for the rest of the day the last picture went in (17 Oct, Alex:
  // it used to vanish on coming back from the pictures screen, which remounts
  // Home). When to show it at all is the server's call (homePhotos).
  return (
    <section className="hm-tasks" aria-label="Shape update">
      <ProgressPicsPill pics={pics} />
    </section>
  );
}


// ---- 4 · Latest from the coach --------------------------------------------

/** Where the coach acted, as the notifications colour it (16 Oct): the badge on the avatar. */
function areaOf(a: LatestActivity): NotificationCategory {
  switch (a.kind) {
    case "message":
    case "goal":
      return "message";
    case "comment":
      return a.context === "training" ? "training_changed" : a.context === "nutrition" ? "nutrition_changed" : a.context === "checkin" ? "checkin_comment" : a.context === "photos" ? "pics_reviewed" : "message";
    case "video":
      return "video_reply";
    case "deploy":
      return a.track === "nutrition" ? "nutrition_phase" : a.track === "lifestyle" ? "checkin_comment" : "training_block";
    case "meeting":
      return "meeting_notes";
    case "report":
      return "report";
    case "invoice":
      return "invoice";
    default:
      return "system";
  }
}

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
        goToTab?.(a.actionTab ?? "training", a.actionRef ?? undefined, a.focusWeek != null ? { week: a.focusWeek, exercise: null } : undefined);
    }
  };
  const initial = (coach.firstName || "C").trim().charAt(0).toUpperCase();
  const body = a.body?.trim() || null;
  const area = NOTIFICATION_TYPES[areaOf(a)];
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
              <img src={pic(coach.photoPath, 96)} alt="" />
            ) : (
              <span className="hm-lt-initial">{initial}</span>
            )}
            <span className="hm-lt-area" style={{ background: area.color }} title={area.label}>
              <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={area.icon} />
              </svg>
            </span>
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
          {/* Nothing to view yet (an empty cta): the chat alone. */}
          {a.cta && (
            <button type="button" className="hm-lt-cta" onClick={follow} aria-label={a.cta}>
              View
            </button>
          )}
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
    <section className="hm-meeting" aria-label={`Next meeting with ${coachFirstName}`}>
      {/* Its own head (16 Oct), like Events and Latest from: it used to read as part of the section above. */}
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">Meetings</span>
        {openMeetings && (
          <button type="button" className="hm-mt-all-link" onClick={() => openMeetings?.()}>
            All meetings
          </button>
        )}
      </div>
    <div className="hm-mt">
      <span className="hm-mt-glow" aria-hidden="true" />
      {/* Only the next call itself opens the Meetings screen (16 Oct); the recap under it folds open in place. */}
      <div className={`hm-mt-row${openMeetings ? " link" : ""}`} role={openMeetings ? "button" : undefined} tabIndex={openMeetings ? 0 : undefined} onClick={openMeetings ? () => openMeetings() : undefined} onKeyDown={openMeetings ? (e) => (e.key === "Enter" || e.key === " ") && openMeetings() : undefined}>
        <div className="hm-mt-date">
          <b>{shown.dayNumber}</b>
          <small>{shown.monthCap}</small>
        </div>
        <div className="hm-mt-main">
          <div className="hm-mt-top">
            <span className="hm-mt-eyebrow">Next · with {coachFirstName}</span>
            {/* Only Today or Live (17 Oct, Alex): the countdown ("In 6 days") is gone, the date beside it says it. */}
            {(live || shown.inLabel === "Today") && (
              <span className={`hm-mt-pill${live ? " live" : " today"}`} aria-label={pillLabel}>
                {live && <span className="hm-mt-live-dot" aria-hidden="true" />}
                {pillLabel}
              </span>
            )}
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
    </div>
    </section>
  );
}


// Nothing booked: the coach's notes from the last call instead.
// No call booked and none had yet (17 Oct, Alex): the section still shows, so the client knows calls live here, with the way to ask for one.
function NoMeetingsCard({ coachFirstName }: { coachFirstName: string }) {
  const openMeetings = useOpenMeetings();
  return (
    <section className="hm-last-meeting hm-no-meeting" aria-label={`Meetings with ${coachFirstName}`}>
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">Meetings with {coachFirstName}</span>
        {openMeetings && (
          <button type="button" className="hm-mt-all-link" onClick={() => openMeetings?.()}>
            Request a meeting
          </button>
        )}
      </div>
      <p className="hm-mt-none">No meetings yet.</p>
    </section>
  );
}

function LastMeetingCard({ recap, coachFirstName }: { recap: NonNullable<MeetingRecap>; coachFirstName: string }) {
  const openMeetings = useOpenMeetings();
  // A heading above, like "Latest from": the card holds the date and the notes.
  return (
    <section className="hm-last-meeting" aria-label={`Notes from your last meeting with ${coachFirstName}`}>
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">Last meeting with {coachFirstName}</span>
        {openMeetings && (
          <button type="button" className="hm-mt-all-link" onClick={() => openMeetings?.()}>
            All meetings
          </button>
        )}
      </div>
      <div className="hm-mt hm-mt-last">
        <span className="hm-mt-glow" aria-hidden="true" />
        {/* The date sits on the title's line, by the chevron, not on a line of its own (6 Oct). */}
        <RecapFold recap={recap} date={recap.dateLabel} />
      </div>
    </section>
  );
}

// What was agreed, folded to its title: a chevron opens the coach's full
// recap under it, eased open.
function RecapFold({ recap, date }: { recap: NonNullable<MeetingRecap>; /** Shown as a pill on the title's line, before the chevron. */ date?: string }) {
  const [open, setOpen] = useState(false);
  // Opening at the foot of Home (17 Oct, Alex): the page rides up with the notes as they unfold, so their last
  // line stays above the floating nav instead of opening behind it.
  const bodyRef = useRef<HTMLDivElement>(null);
  const toggle = () => {
    const opening = !open;
    setOpen(opening);
    const body = bodyRef.current;
    if (!opening || !body) return;
    let box: HTMLElement | null = body.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    const scroller = box ?? (document.scrollingElement as HTMLElement | null);
    if (!scroller) return;
    const until = performance.now() + 420;
    const follow = () => {
      const nav = document.querySelector(".app-bottom-nav")?.getBoundingClientRect().top ?? window.innerHeight;
      const over = body.getBoundingClientRect().bottom - (nav - 16);
      if (over > 0) scroller.scrollTop += over;
      if (performance.now() < until) requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  };
  return (
    <div className="hm-recap">
      {/* "Meeting notes" is the head; the call's name (or the coach's title) is the subheading over the notes (6 Oct). */}
      <button type="button" className="hm-recap-head" aria-expanded={open} onClick={toggle}>
        <span className="hm-recap-title">Meeting summary</span>
        {date && <span className="hm-mt-pill">{date}</span>}
        <span className={`hm-recap-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      <div ref={bodyRef} className={`hm-recap-body${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="hm-recap-clip">
          <b className="hm-recap-sub">{recap.title}</b>
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


