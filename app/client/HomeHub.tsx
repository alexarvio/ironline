"use client";

import { NOTIFICATION_TYPES, type NotificationCategory } from "../lib/notificationTypes";
import { useEffect, useRef, useState, useTransition } from "react";
import { markNotificationReadAction } from "../lib/actions";
import VideoReplySheet, { type VideoReplyView } from "./VideoReplySheet";
import PhaseCards, { TRACK_ICON, type HomePhase, type PhaseFoodToday } from "./PhaseCards";
import { defaultPhaseCover } from "../lib/phaseCovers";
import { type ProgressPics } from "./ProgressPicsCard";

import type { HomeEvent, HomeEvents } from "./EventsCard";
import { eventTypeOf } from "../lib/eventTypes";
import { isoWeekday } from "../lib/eventRepeat";
import EventsTimelineCard from "./home/EventsTimelineCard";
import type { CardCovers } from "./CardPictureSheet";
import { ChevronDownIcon } from "../components/icons";
import { tzShort } from "../lib/timezones";
import { clock, dayWords, monthWords, weekdayWords } from "../lib/clientDates";
import CoachSays from "./CoachSays";
import MeetingNotes from "./meetings/MeetingNotes";
import type { LinkView } from "../lib/messageLinks";
import { useNavigateTab, useOpenCheckIn, useOpenCoach, useOpenEvents, useOpenLink, useOpenMeetings, useOpenMessages, useOpenPhotos } from "./CheckInContext";
import { goalItemId } from "../lib/weightGoal";
import { FocusGoals } from "./home/FocusList";
import HomeWeight from "./home/HomeWeight";
import type { HomeWeight as HomeWeightData } from "./home/weightData";
import CheckInDialog, { type CheckInForm } from "./CheckInDialog";
import "./home/today.css";
import { Bars } from "./Bars";
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
  /** "Sunday 18:00 · 30 min": its parts joined by " · ", drawn on screen parted by Bars. */
  whenLabel: string;
  /** The start as a UTC moment (ISO), and how long it runs: the card shows it in the phone's timezone and follows the clock. */
  startIso: string | null;
  durationMinutes: number;
} | null;

/** The coach's recap of the last call, written for the client. */
export type MeetingRecap = { dateLabel: string; title: string; text: string } | null;


export type LatestActivity = {
  /** "focus": the coach set what to focus on (23 Oct); it opens Home at its top, where the list is. */
  /** "weightGoal": the coach set or changed a weight goal (2 Nov); it opens Events on the goal's row (actionRef its id). */
  kind: "message" | "comment" | "video" | "deploy" | "goal" | "weightGoal" | "meeting" | "report" | "welcome" | "invoice" | "focus";
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
  planGap = null,
  clientId = 0,
  cardCovers = {},
  focus = null,
  weight = null,
}: {
  /** To focus on (23 Oct, Alex): the coach's goals until the next call, under the coach's latest since 3 Nov; null, none. */
  focus?: HomeFocus | null;
  /** The weight row (3 Nov, Alex); null with no weigh-in. */
  weight?: HomeWeightData | null;
  /** Whose Home this is; the redesign mock-ups pass none. */
  clientId?: number;
  /** The client's own card pictures (12 Oct), a track at a time. */
  cardCovers?: CardCovers;
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
  // What is still to do today, counted the way the cards under it show it. Not food (3 Nov, Alex: "food diary is not
  // something to have there… that is optional"): the nutrition card keeps its Log.
  const todoItems = [
    session && (session.live || !trainedToday) ? "training" : null,
    checkInCount && checkInCount.done < checkInCount.total ? "check-in" : null,
    progressPics?.status === "due" ? "pictures" : null,
  ].filter((x): x is string => !!x);
  // What happens today, always last (6 Nov, Alex): an event on today, or one that starts today; a trip already under way
  // is not today's any more. A repeating one on one of its days. Not a phase or a weight goal: they have their own.
  const todayEvents = events.list
    .filter((e) => !e.phase && !e.goal && (e.repeat ? e.start <= today && e.end >= today && e.repeat.days.includes(isoWeekday(today)) : e.start === today))
    .sort((a, b) => a.id - b.id);
  return (
    <div className="hm">
      <HomeBanner dateLabel={dateLabel} firstName={firstName} initialHello={hello} />
      {/* Home's order since 3 Nov (Alex: option 3 of docs/boards/home-hierarchy-mockup.html, To focus on as B of
          home-focus-mockup.html): Today, what today asks (the session, the check-in, food, the shape update while one is
          open), then today's events, always last (6 Nov, Alex); the phase cards, shorter; the weight, always; the coach (their latest and To focus on under it, always
          open); then Events and Meetings. */}
      <div className="hm-body">
        {todoItems.length === 0 ? (
          <TodayDone events={todayEvents} today={today} />
        ) : (
          <TodayList
            items={todoItems}
            session={session}
            checkInCount={checkInCount}
            checkIn={hasCheckIns ? checkInForm : null}
            pics={progressPics}
            clientId={clientId}
            today={today}
            coachName={coach.firstName}
            phaseName={lifestyle?.name ?? null}
            events={todayEvents}
          />
        )}
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
        {/* The weight, always (3 Nov, Alex): Goal | 7d | 30d | Phase as the coach's card. */}
        {weight && <HomeWeight w={weight} today={today} />}
        {/* The coach's latest (21 Oct, a coach's feedback, Alex: always here, no jumping), To focus on under it, always open
            (3 Nov, Alex: B of home-focus-mockup.html, the coach's words in one place). */}
        <LatestActivityCard a={latestActivity} coach={coach} focus={focus && focus.goals.length > 0 ? focus : null} />
        {/* What is coming up in their life (7 Oct): a trip, an injury, something started. Theirs to add; the coach's listed too. Above the coach's latest (9 Oct). */}
        {/* The timeline row (15 Oct) once there is anything at all; else the old card's empty state. */}
        {/* The timeline row always (17 Oct): with nothing logged it is just Today, "Nothing on", like the Events screen. */}
        <EventsTimelineCard events={events} today={today} />
        {upcoming ? (
          <MeetingCard m={upcoming} recap={recap} coachFirstName={coach.firstName} />
        ) : (
          recap ? <LastMeetingCard recap={recap} coachFirstName={coach.firstName} /> : <NoMeetingsCard />
        )}
      </div>
    </div>
  );
}

// ---- 0 · Today with nothing left to do (3 Nov, Alex: the audit's first point): the Today list's own look, no card. The
// head, then one row: the done check in green and `All set for today`, nothing under it and no action.

function TodayDone({ events, today }: { events: HomeEvent[]; today: string }) {
  return (
    <section className="hm-td" aria-label="Today">
      <span className="hm-td-head">Today</span>
      <div className="hm-td-row done">
        <span className="hm-td-icon" style={{ color: "#2f7a3f" }} aria-hidden="true">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <span className="hm-td-text">
          <span className="hm-td-title">All set for today</span>
        </span>
      </div>
      <TodayEvents events={events} today={today} />
    </section>
  );
}

// Today's events, the list's last rows (6 Nov, Alex: "always the last thing"): the event's own icon in its colour, its
// title (its kind's name when it has none), the kind as the fact, with `Until 13 Nov` after it on one that runs on, and
// View opening it on the Events screen.
function TodayEvents({ events, today }: { events: HomeEvent[]; today: string }) {
  const openEvents = useOpenEvents();
  return events.map((e) => {
    const t = eventTypeOf(e.kind);
    const title = e.title.trim() || t.label;
    const runsOn = !e.repeat && e.end > today;
    return (
      <button key={e.id} type="button" className="hm-td-row" onClick={() => openEvents?.(e.id)} aria-label={`${title}. View.`}>
        <span className="hm-td-icon" style={{ color: t.color }} aria-hidden="true">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d={t.icon} />
          </svg>
        </span>
        <span className="hm-td-text">
          <span className="hm-td-title">{title}</span>
          <span className="hm-td-fact">{runsOn ? <Bars parts={[t.label, `Until ${dayWords(e.end)}`]} /> : t.label}</span>
        </span>
        <span className="hm-td-act" aria-hidden="true">
          View
        </span>
      </button>
    );
  });
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

// ---- 0b · Today: what today asks, a row each (3 Nov, Alex: option 3 of docs/boards/home-hierarchy-mockup.html) ----
// Hairline rows flat on the page under `Today`: the thing's icon alone in its colour (3 Nov, Alex: no ring, "just like we
// have across the app"), what it is and one grey fact, and on the right its action. The session's Start (or Resume) is
// the screen's one ink pill; the check-in's Fill in and the shape update's Add (Continue once begun) are words. No food:
// it is optional (3 Nov, Alex). The phase cards keep their own.

// The app's own icons, never drawn again here (3 Nov, Alex: "the icons the same across everything"; rule §5): the
// tracks' as the phase cards and the tab bar draw them (TRACK_ICON), the shape update's the notifications' camera.
const SHAPE = NOTIFICATION_TYPES.pics_reviewed;
const TODAY_ICON = {
  training: TRACK_ICON.training,
  lifestyle: TRACK_ICON.lifestyle,
  shape: (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={SHAPE.icon} />
    </svg>
  ),
};
const TODAY_COLOR = { training: "#3a3390", lifestyle: "#a08a5c", shape: SHAPE.color };

function TodayRow({ kind, title, fact, action, ink = false, onClick }: { kind: keyof typeof TODAY_ICON; title: string; fact: React.ReactNode; action: string; ink?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="hm-td-row" onClick={onClick} aria-label={`${title}. ${action}.`}>
      <span className="hm-td-icon" style={{ color: TODAY_COLOR[kind] }} aria-hidden="true">
        {TODAY_ICON[kind]}
      </span>
      <span className="hm-td-text">
        <span className="hm-td-title">{title}</span>
        {fact && <span className="hm-td-fact">{fact}</span>}
      </span>
      <span className={`hm-td-act${ink ? " ink" : ""}`} aria-hidden="true">
        {action}
      </span>
    </button>
  );
}

function TodayList({ items, session, checkInCount, checkIn, pics, clientId, today, coachName, phaseName, events }: { items: string[]; session: HomeSession; checkInCount: { done: number; total: number } | null; checkIn: CheckInForm | null; pics: ProgressPics; clientId: number; today: string; coachName: string; phaseName: string | null; events: HomeEvent[] }) {
  const goToTab = useNavigateTab();
  const openCheckIn = useOpenCheckIn();
  const openPhotos = useOpenPhotos();
  // The check-in opens in its pop-up, as the lifestyle card's Log does (13 Oct).
  const [logOpen, setLogOpen] = useState(false);
  const n = pics ? Math.max(1, pics.total) : 0;
  const k = pics ? Math.min(n, pics.uploaded) : 0;
  return (
    <section className="hm-td" aria-label="Today">
      <span className="hm-td-head">Today</span>
      {items.includes("training") && session && (
        <TodayRow
          kind="training"
          title={session.name}
          // The exercises alone, no time estimate (4 Nov, Alex: "take that out").
          fact={`${session.exercises} exercises`}
          action={session.live ? "Resume" : "Start"}
          ink
          onClick={() => goToTab?.("training", session.dayId)}
        />
      )}
      {items.includes("check-in") && checkInCount && (
        <TodayRow
          kind="lifestyle"
          title="Check-in"
          fact={`${checkInCount.total - checkInCount.done} of ${checkInCount.total} still to fill`}
          action="Fill in"
          onClick={() => (checkIn ? setLogOpen(true) : openCheckIn?.("daily"))}
        />
      )}
      {items.includes("pictures") && pics && (
        <TodayRow kind="shape" title="Shape update" fact={`${k} of ${n} photos`} action={k > 0 ? "Continue" : "Add"} onClick={() => openPhotos?.()} />
      )}
      <TodayEvents events={events} today={today} />
      {logOpen && checkIn && <CheckInDialog clientId={clientId} form={checkIn} today={today} coachName={coachName} phaseName={phaseName} onClose={() => setLogOpen(false)} />}
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
    case "weightGoal":
      return "weight_goal";
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

function LatestActivityCard({ a, coach, focus = null }: { a: LatestActivity; coach: { firstName: string; photoPath: string | null }; /** To focus on, under the note, always open (3 Nov, Alex). */ focus?: HomeFocus | null }) {
  const openMessages = useOpenMessages();
  const openCoach = useOpenCoach();
  const openLink = useOpenLink();
  const openCheckIn = useOpenCheckIn();
  const openPhotos = useOpenPhotos();
  const openMeetings = useOpenMeetings();
  const openEvents = useOpenEvents();
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
      case "weightGoal":
        // A weight goal lands on its row on Events, as its notification does.
        openEvents?.(a.actionRef != null ? goalItemId(a.actionRef) : undefined);
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
      case "focus": {
        // New goals: their list, under this note now (3 Nov, Alex).
        const list = document.getElementById("home-focus");
        if (list) list.scrollIntoView({ behavior: "smooth", block: "center" });
        else goToTab?.("home");
        return;
      }
      case "welcome":
        openCoach?.();
        return;
      default:
        // A note about a session or an exercise opens it as a message's link does (24 Oct, Alex: a link lands on its thing).
        if (a.link && !a.link.gone && openLink) openLink(a.link);
        // A training note with no session of its own (a new plan, a week added): the tab, never its ref as a session.
        else goToTab?.(a.actionTab ?? "training", a.actionTab === "training" || !a.actionTab ? undefined : a.actionRef ?? undefined);
    }
  };
  const body = a.body?.trim() || null;
  const area = NOTIFICATION_TYPES[areaOf(a)];
  // Drawn as every coach's note (3 Nov, Alex: CoachSays): the face with the kind's badge on it, what happened as the small
  // caps label with when after it, their own words in ink under it. With no words of their own, the label is the coach's
  // name and what happened is the words. Tapping anywhere goes to where it happened.
  return (
    <section className="hm-latest-note">
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">Latest from {coach.firstName}</span>
      </div>
      <article className="hm-lt" aria-label={`Latest from ${coach.firstName}: ${a.title}`}>
        <button type="button" className={`hm-lt-body${a.unseen ? " unseen" : ""}`} onClick={follow}>
          <CoachSays
            coach={{ name: coach.firstName, photoPath: coach.photoPath }}
            badge={{ color: area.color, icon: area.icon, label: area.label }}
            label={
              <>
                <span className="coach-says-what">{body ? a.title : coach.firstName}</span>
                <span className="coach-says-date">{a.whenLabel}</span>
              </>
            }
          >
            {body ?? a.title}
          </CoachSays>
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
      {focus && <FocusGoals focus={focus} />}
      {watching && a.videoReply && <VideoReplySheet reply={a.videoReply} coachName={coach.firstName} onClose={() => setWatching(false)} />}
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
    monthCap: monthWords(d, { short: true, year: false }).toUpperCase(),
    inLabel: days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`,
    whenLabel: `${weekdayWords(d)} ${clock(d)} ${tzShort(zone, d)} · ${m.durationMinutes} min`,
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
            <span className="hm-mt-eyebrow"><Bars parts={["Next", `with ${coachFirstName}`]} /></span>
            {/* Only Today or Live (17 Oct, Alex): the countdown ("In 6 days") is gone, the date beside it says it. */}
            {(live || shown.inLabel === "Today") && (
              <span className={`hm-mt-pill${live ? " live" : " today"}`} aria-label={pillLabel}>
                {live && <span className="hm-mt-live-dot" aria-hidden="true" />}
                {pillLabel}
              </span>
            )}
          </div>
          <div className="hm-mt-title">{m.topic}</div>
          <div className="hm-mt-when"><Bars parts={shown.whenLabel.split(" · ")} /></div>
        </div>
      </div>
      {/* The call's link is always there: Join, as on Meetings (3 Nov, Alex: was Open meeting link and Join call), the white
          hairline pill before the call and the ink one from ten minutes before to the end. */}
      {m.link && (
        <a className={`hm-mt-join${joinable ? "" : " early"}`} href={m.link!} target="_blank" rel="noopener noreferrer">
          <span className="hm-mt-join-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="6" width="13" height="12" rx="2" />
              <path d="M16 10l5-3v10l-5-3z" />
            </svg>
          </span>
          Join
        </a>
      )}
      {recap && (
        <div className="hm-mt-recap">
          <span className="hm-mt-recap-label"><Bars parts={["Last meeting", recap.dateLabel]} /></span>
          <RecapFold recap={recap} />
        </div>
      )}
    </div>
    </section>
  );
}


// Nothing booked: the coach's notes from the last call instead.
// No call booked and none had yet (17 Oct, Alex): the section still shows, so the client knows calls live here. Since
// 3 Nov (Alex: words mockup) the same head as always, `Meetings` with All meetings on its right, then `None yet`;
// asking for a call is on the Meetings screen.
function NoMeetingsCard() {
  const openMeetings = useOpenMeetings();
  return (
    <section className="hm-last-meeting hm-no-meeting" aria-label="Meetings">
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">Meetings</span>
        {openMeetings && (
          <button type="button" className="hm-mt-all-link" onClick={() => openMeetings?.()}>
            All meetings
          </button>
        )}
      </div>
      <p className="hm-mt-none">None yet</p>
    </section>
  );
}

function LastMeetingCard({ recap, coachFirstName }: { recap: NonNullable<MeetingRecap>; coachFirstName: string }) {
  const openMeetings = useOpenMeetings();
  // Nothing booked (27 Oct, Alex: "always like when there is a next meeting booked… cleaner"): the same section as
  // with a call booked, Meetings and All meetings over it, the last call's label and its summary, only the next
  // call's row left out.
  return (
    <section className="hm-meeting" aria-label={`Notes from your last meeting with ${coachFirstName}`}>
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
        <div className="hm-mt-recap">
          <span className="hm-mt-recap-label"><Bars parts={["Last meeting", recap.dateLabel]} /></span>
          <RecapFold recap={recap} />
        </div>
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
        {/* The call's notes as the Meetings screen draws them (3 Nov, Alex): its title over the points on the thin line. */}
        <div className="hm-recap-clip">
          <MeetingNotes title={recap.title} notes={recap.text} />
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


