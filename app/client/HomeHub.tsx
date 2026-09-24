"use client";

import { useEffect, useState, useTransition } from "react";
import { markNotificationReadAction } from "../lib/actions";
import { AppleIcon, ChatIcon, ChevronDownIcon, DumbbellIcon } from "../components/icons";
import GoalRow from "../components/GoalRow";
import CoachMark from "./CoachMark";
import MessageLinkChip from "./MessageLinkChip";
import VideoReplySheet, { type VideoReplyView } from "./VideoReplySheet";
import type { LinkView } from "../lib/messageLinks";
import { useNavigateTab, useOpenCheckIn, useOpenCoach, useOpenLink, useOpenMessages, useOpenPhotos } from "./CheckInContext";
import { clock, elapsedMs, useTicker } from "./workoutShared";

// Deliberately does NOT import from ../lib/queries (see the note in the old
// CheckInHub.tsx this replaces — a "use client" file importing queries.ts
// breaks the dev server at runtime). All data comes in as plain props,
// computed server-side in page.tsx. The types below mirror the ones there.
//
// Home, top to bottom: the greeting with the goals behind its chevron, the
// next session as a photo card, the check-in fold, the latest thing the
// coach did, and the next call when one is booked. Every block is either
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
} | null;

/** The coach's recap of the last call, written for the client. */
export type MeetingRecap = { dateLabel: string; text: string } | null;

export type GoalRowView = Parameters<typeof GoalRow>[0]["goal"];

export type CheckInItem = {
  key: string;
  type: "daily" | "weekly" | "measurements" | "photos";
  title: string;
  /** Logged so far of what is asked: 0 of 4. */
  done: number;
  total: number;
  due: boolean;
};

export type LatestActivity = {
  kind: "message" | "comment" | "video" | "deploy" | "goal" | "meeting" | "report" | "welcome";
  track?: "training" | "nutrition" | "lifestyle";
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
  goals,
  session,
  hasPlan,
  weekDone,
  checkIn,
  latestActivity,
  upcoming,
  recap,
}: {
  dateLabel: string;
  firstName: string;
  coach: { firstName: string; photoPath: string | null };
  /** The main goal first (kind "none"), then the tracked goals. */
  goals: GoalRowView[];
  session: HomeSession;
  hasPlan: boolean;
  /** No session left this week: when the next one starts. */
  weekDone: { nextWeekLabel: string } | null;
  checkIn: { items: CheckInItem[]; nextLabel: string } | null;
  latestActivity: LatestActivity;
  upcoming: UpcomingMeeting;
  recap: MeetingRecap;
}) {
  return (
    <div className="hm">
      <HomeBanner dateLabel={dateLabel} firstName={firstName} goals={goals} />
      <div className="hm-body">
        <UpNextHero session={session} hasPlan={hasPlan} weekDone={weekDone} />
        {checkIn && checkIn.items.length > 0 && <CheckInFold items={checkIn.items} nextLabel={checkIn.nextLabel} />}
        <LatestActivityCard a={latestActivity} coachFirstName={coach.firstName} />
        {upcoming && <MeetingCard m={upcoming} recap={recap} coachFirstName={coach.firstName} />}
      </div>
    </div>
  );
}

// ---- 1 · Banner: the greeting, and the goals behind its chevron ------------

const GOALS_KEY = "ironline:home-goals-open";

function HomeBanner({ dateLabel, firstName, goals }: { dateLabel: string; firstName: string; goals: GoalRowView[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (window.sessionStorage.getItem(GOALS_KEY) === "1") setOpen(true);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      window.sessionStorage.setItem(GOALS_KEY, next ? "1" : "0");
    } catch {}
  };
  const hasGoals = goals.length > 0;
  return (
    <header className="hm-banner">
      {hasGoals ? (
        <button type="button" className="hm-greet-btn" onClick={toggle} aria-expanded={open} aria-controls="hm-goals">
          <h1 className="hm-greeting">Hello, {firstName}.</h1>
          <span className={`hm-greet-chev${open ? " open" : ""}`} aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>
      ) : (
        <h1 className="hm-greeting">Hello, {firstName}.</h1>
      )}
      <div className="hm-eyebrow hm-date">{dateLabel}</div>

      {hasGoals && (
        <div id="hm-goals" className={`hm-goalpanel-fold${open ? " open" : ""}`} aria-hidden={!open}>
          <div className="hm-goalpanel-inner">
            {(() => {
              const main = goals.find((g) => g.id === -1) ?? null;
              const rest = goals.filter((g) => g.id !== -1);
              return (
                <>
                  {main && (
                    <section className="hm-goalmain">
                      <span className="hm-goalmain-kicker">Main goal</span>
                      <span className="hm-goalmain-text">{main.text}</span>
                    </section>
                  )}
                  {rest.length > 0 && (
                    <section className="hm-goallist">
                      {rest.map((g) => (
                        <GoalRow key={g.id} goal={g} variant="banner" animate={open} />
                      ))}
                    </section>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </header>
  );
}

// ---- 2 · Up next: the session as a photo card ------------------------------

function UpNextHero({ session, hasPlan, weekDone }: { session: HomeSession; hasPlan: boolean; weekDone: { nextWeekLabel: string } | null }) {
  const goToTab = useNavigateTab();
  const live = !!session?.live;
  const now = useTicker(live);
  if (!session && !hasPlan) return null;
  const photo = session?.coverUrl ?? "/brand/home-hero.jpg";

  if (!session) {
    return (
      <section className="hm-hero short">
        {/* eslint-disable-next-line @next/next/no-img-element -- a static brand photo */}
        <img className="hm-hero-photo" src={photo} alt="" loading="eager" />
        <span className="hm-hero-scrim" aria-hidden="true" />
        <div className="hm-hero-top">
          <span className="hm-hero-chip">Up next</span>
        </div>
        <div className="hm-hero-bottom">
          <div className="hm-hero-kicker">Training</div>
          <h2 className="hm-hero-title">Week done</h2>
          {weekDone && <div className="hm-hero-meta">Next week starts {weekDone.nextWeekLabel}</div>}
          <div className="hm-hero-btns">
            <button type="button" className="hm-hero-ghost" onClick={() => goToTab?.("training")}>
              See this week
            </button>
          </div>
        </div>
      </section>
    );
  }

  const first = session.weekNow === 1 && session.sessionIndex === 1;
  return (
    <section className="hm-hero">
      {/* eslint-disable-next-line @next/next/no-img-element -- a static brand photo */}
      <img className="hm-hero-photo" src={photo} alt="" loading="eager" />
      <span className="hm-hero-scrim" aria-hidden="true" />
      <div className="hm-hero-top">
        <span className="hm-hero-chip">Up next</span>
        <span className={`hm-hero-chip dark${live ? " live" : ""}`}>
          {live && <span className="hm-hero-dot" aria-hidden="true" />}
          {live ? "Live" : first ? "Your first session" : `Session ${session.sessionIndex} of ${session.sessionCount}`}
        </span>
      </div>
      <div className="hm-hero-bottom">
        <div className="hm-hero-kicker">Training · Week {session.weekNow}</div>
        <h2 className="hm-hero-title">{session.name}</h2>
        <div className="hm-hero-meta">
          {session.exercises} exercise{session.exercises === 1 ? "" : "s"}
        </div>
        <div className="hm-hero-btns">
          <button type="button" className="hm-hero-ghost" onClick={() => goToTab?.("training", session.dayId)}>
            Preview
          </button>
          <button type="button" className="hm-hero-start" onClick={() => goToTab?.("training", session.dayId, { week: null, exercise: null, start: true })}>
            {live ? (
              `Resume · ${clock(elapsedMs(session.liveStartedAt ?? null, null, now))}`
            ) : (
              <>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
                Start session
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

// ---- 3 · Check-in: measurements and pictures, folded -----------------------


function CheckInFold({ items }: { items: CheckInItem[]; nextLabel: string }) {
  const openCheckIn = useOpenCheckIn();
  const openPhotos = useOpenPhotos();
  const due = items.filter((i) => i.due).length;
  const go = (item: CheckInItem) => (item.type === "photos" ? openPhotos?.() : openCheckIn?.(item.type));
  return (
    <section className="hm-tasks">
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">Today&rsquo;s tasks</span>
        <span className={`hm-tasks-count${due === 0 ? " done" : ""}`}>{due === 0 ? "All done" : `${due} due`}</span>
      </div>
      <div className="hm-tasks-list">
        {items.map((item) => (
          <button key={item.key} type="button" className={`hm-task${item.due ? "" : " done"}`} onClick={() => go(item)}>
            <span className="hm-task-icon" aria-hidden="true">
              {item.type === "photos" ? (
                <svg viewBox="0 0 24 24">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M3 15.5 15.5 3l5.5 5.5L8.5 21z" />
                  <path d="M7 12l2 2M10 9l2 2M13 6l2 2" />
                </svg>
              )}
            </span>
            <span className="hm-task-title">{item.title}</span>
            {item.total > 0 && (
              <span className="hm-task-count">
                {item.done} of {item.total}
              </span>
            )}
            <span className="hm-task-chev" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

// ---- 4 · Latest from the coach --------------------------------------------

function KindIcon({ kind }: { kind: LatestActivity["kind"] }) {
  switch (kind) {
    case "video":
      return (
        <svg viewBox="0 0 24 24">
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="M16 10l5-3v10l-5-3z" />
        </svg>
      );
    case "deploy":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      );
    case "goal":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "meeting":
      return (
        <svg viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
    case "welcome":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.4 6.7 19.1l1-5.8L3.5 9.2l5.9-.9z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 5h16v11H8l-4 4z" />
        </svg>
      );
  }
}

function LatestActivityCard({ a, coachFirstName }: { a: LatestActivity; coachFirstName: string }) {
  const openMessages = useOpenMessages();
  const openCoach = useOpenCoach();
  const openLink = useOpenLink();
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
        if (a.link) openLink?.(a.link);
        else openMessages?.();
        return;
      case "video":
        if (a.videoReply) setWatching(true);
        return;
      case "goal":
        try {
          window.sessionStorage.setItem(GOALS_KEY, "1");
        } catch {}
        goToTab?.("home");
        return;
      case "meeting":
        document.querySelector(".hm-meeting")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      case "welcome":
        openCoach?.();
        return;
      default:
        goToTab?.(a.actionTab ?? "training", a.actionRef ?? undefined);
    }
  };
  // The icon says where it happened: training, nutrition, a video, or the chat.
  const area =
    a.kind === "video"
      ? "video"
      : a.track ?? (a.link?.area === "Training" ? "training" : a.link?.area === "Nutrition" ? "nutrition" : a.actionTab === "training" ? "training" : a.actionTab === "nutrition" ? "nutrition" : "chat");
  return (
    <section className="hm-latest">
      <div className="hm-latest-head">
        <span className="hm-eyebrow coach-eyebrow">
          <CoachMark />
          Latest from {coachFirstName}
        </span>
        <span className="hm-latest-when">{a.whenLabel}</span>
      </div>
      <div className="hm-card hm-latest-card">
        <button type="button" className="hm-latest-body" onClick={() => openMessages?.()}>
          <span className={`hm-latest-icon ${area}`} aria-hidden="true">
            {area === "training" ? <DumbbellIcon /> : area === "nutrition" ? <AppleIcon /> : area === "video" ? <KindIcon kind="video" /> : <ChatIcon />}
          </span>
          <span className="hm-latest-main">
            <span className="hm-latest-title">{a.title}</span>
            {a.body && <span className="hm-latest-text">{a.body}</span>}
          </span>
        </button>
        {a.link && a.kind === "message" && (
          <div className="hm-latest-chip">
            <MessageLinkChip view={a.link} />
          </div>
        )}
        <div className="hm-latest-foot">
          {a.unread > 0 ? (
            <button type="button" className="hm-latest-more" onClick={() => openMessages?.()}>
              {a.unread} unread message{a.unread === 1 ? "" : "s"}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="hm-latest-cta" onClick={follow}>
            {a.cta}
            <span className="hm-latest-cta-chev" aria-hidden="true" />
          </button>
        </div>
      </div>
      {watching && a.videoReply && <VideoReplySheet reply={a.videoReply} onClose={() => setWatching(false)} />}
    </section>
  );
}

// ---- 5 · Next meeting, only when booked ------------------------------------

function MeetingCard({ m, recap, coachFirstName }: { m: NonNullable<UpcomingMeeting>; recap: MeetingRecap; coachFirstName: string }) {
  return (
    <section className="hm-card hm-meeting">
      <div className="hm-meeting-row">
        <span className="hm-leaf" aria-hidden="true">
          <span className="hm-leaf-month">{m.monthCap}</span>
          <span className="hm-leaf-day">{m.dayNumber}</span>
          <span className="hm-leaf-weekday">{m.weekdayCap}</span>
        </span>
        <div className="hm-meeting-main">
          <div className="hm-meeting-top">
            <span className="hm-eyebrow">Next with {coachFirstName}</span>
            <span className={`hm-meeting-pill${m.startingNow ? " live" : ""}`}>{m.startingNow ? "Starting now" : m.inLabel}</span>
          </div>
          <div className="hm-meeting-topic">{m.topic}</div>
          <div className="hm-meeting-when">{m.whenLabel}</div>
        </div>
      </div>
      {m.link && m.startingNow && (
        <div className="hm-meeting-more">
          <a className="hm-join" href={m.link} target="_blank" rel="noopener noreferrer">
            Join call
          </a>
        </div>
      )}
      {recap && (
        <div className="hm-recap attached">
          <div className="hm-recap-head">
            <span className="hm-eyebrow">From the last meeting</span>
            <span className="hm-recap-date">{recap.dateLabel}</span>
          </div>
          <p className="hm-recap-text">{recap.text}</p>
        </div>
      )}
    </section>
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

/** The progress-pictures slot: a sheet open and missing photos, a sheet with
    every angle in ("All four · next sheet 7 Oct"), or no sheet open. */
export type HomePhotos = { state: "due" } | { state: "done"; summary: string } | null;
