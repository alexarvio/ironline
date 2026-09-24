"use client";

import { useEffect, useState, useTransition } from "react";
import { markNotificationReadAction } from "../lib/actions";
import { AppleIcon, CalendarIcon, CameraIcon, ChatIcon, ChevronDownIcon, DumbbellIcon, HeartIcon, TargetIcon } from "../components/icons";
import GoalRow from "../components/GoalRow";
import CoachMark from "./CoachMark";
import MessageLinkChip from "./MessageLinkChip";
import VideoReplySheet, { type VideoReplyView } from "./VideoReplySheet";
import type { LinkView } from "../lib/messageLinks";
import { useNavigateTab, useOpenCheckIn, useOpenCoach, useOpenLink, useOpenMessages, useOpenNotifications, useOpenPhotos } from "./CheckInContext";
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
  /** The start as an ISO stamp, and how long it runs, so the card can follow the clock. */
  startIso: string | null;
  durationMinutes: number;
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
        <LatestActivityCard a={latestActivity} coach={coach} />
        {upcoming && <MeetingCard m={upcoming} recap={recap} coachFirstName={coach.firstName} />}
      </div>
    </div>
  );
}

// ---- 1 · Banner: the greeting, and the goals behind its chevron ------------

const GOALS_KEY = "ironline:home-goals-open";

function HomeBanner({ dateLabel, firstName, goals }: { dateLabel: string; firstName: string; goals: GoalRowView[] }) {
  // "Hello" on the server, the time of day once the phone says what it is.
  const [hello, setHello] = useState("Hello");
  useEffect(() => {
    const t = setTimeout(() => {
      const h = new Date().getHours();
      setHello(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    }, 0);
    return () => clearTimeout(t);
  }, []);
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
      <div className="hm-eyebrow hm-date">{dateLabel}</div>
      {hasGoals ? (
        <button type="button" className="hm-greet-btn" onClick={toggle} aria-expanded={open} aria-controls="hm-goals">
          <h1 className="hm-greeting">{hello}, {firstName}.</h1>
          <span className={`hm-greet-chev${open ? " open" : ""}`} aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>
      ) : (
        <h1 className="hm-greeting">{hello}, {firstName}.</h1>
      )}

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
        <div className="hm-hero-kicker">
          Training · Week {session.weekNow}
          {(session.streak ?? 0) >= 2 && ` · ${session.streak} weeks in a row`}
        </div>
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
  // A task just landed: a short buzz on phones that can.
  const [seenDue, setSeenDue] = useState(due);
  if (seenDue !== due) {
    setSeenDue(due);
    if (due < seenDue) {
      try {
        navigator.vibrate?.(40);
      } catch {}
    }
  }
  const go = (item: CheckInItem) => (item.type === "photos" ? openPhotos?.() : openCheckIn?.(item.type));
  return (
    <section className="hm-tasks">
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">Today&rsquo;s tasks</span>
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
                <CountUp n={item.done} /> of {item.total}
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

// The badge on the coach's avatar says what they did: play for a video
// reply, the dumbbell for training, the apple for nutrition, and so on.
function badgeOf(a: LatestActivity): { cls: string; icon: React.ReactNode } {
  const stroke = (d: string) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  switch (a.kind) {
    case "video":
      return { cls: "video", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg> };
    case "comment":
      if (a.context === "nutrition") return { cls: "nutrition", icon: <AppleIcon /> };
      if (a.context === "checkin") return { cls: "checkin", icon: stroke("M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 11a4 4 0 0 1 8 0M12 13l2-2") };
      if (a.context === "photos") return { cls: "photos", icon: <CameraIcon /> };
      return { cls: "training", icon: <DumbbellIcon /> };
    case "deploy":
      if (a.track === "nutrition") return { cls: "nutrition", icon: <AppleIcon /> };
      if (a.track === "lifestyle") return { cls: "lifestyle", icon: <HeartIcon /> };
      return { cls: "training", icon: <DumbbellIcon /> };
    case "goal":
      return { cls: "message", icon: <TargetIcon /> };
    case "meeting":
      return { cls: "message", icon: <CalendarIcon /> };
    case "welcome":
      return { cls: "welcome", icon: stroke("M12 3l2.4 5.6L20 9.3l-4.4 4 1.2 6L12 16.4 7.2 19.3l1.2-6L4 9.3l5.6-.7z") };
    default:
      return { cls: "message", icon: <ChatIcon /> };
  }
}

const KIND_WORDS: Record<LatestActivity["kind"], string> = {
  video: "video reply",
  comment: "comment",
  message: "message",
  deploy: "update",
  goal: "new goal",
  meeting: "meeting",
  report: "report",
  welcome: "welcome",
};

function LatestActivityCard({ a, coach }: { a: LatestActivity; coach: { firstName: string; photoPath: string | null } }) {
  const openMessages = useOpenMessages();
  const openNotifications = useOpenNotifications();
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
        document.querySelector(".hm-mt")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      case "welcome":
        openCoach?.();
        return;
      default:
        goToTab?.(a.actionTab ?? "training", a.actionRef ?? undefined);
    }
  };
  const kindWord = a.kind === "deploy" ? (a.track === "nutrition" ? "new nutrition phase" : a.track === "lifestyle" ? "lifestyle update" : "new training") : KIND_WORDS[a.kind];
  const badge = badgeOf(a);
  const initial = (coach.firstName || "C").trim().charAt(0).toUpperCase();
  return (
    <article className="hm-lt" aria-label={`Latest from ${coach.firstName}: ${a.title}`}>
      <div className="hm-lt-inner">
        {/* Keyed on the title so a new item cross-fades in and its badge pops. */}
        <div key={a.title} className={`hm-lt-body${a.unseen ? " unseen" : ""}`}>
          <button type="button" className="hm-lt-avatar" onClick={() => openCoach?.()} aria-label={`Open ${coach.firstName}'s profile`}>
            {coach.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
              <img src={coach.photoPath} alt="" />
            ) : (
              <span className="hm-lt-initial">{initial}</span>
            )}
            <span className={`hm-lt-badge ${badge.cls}`} aria-hidden="true">
              {badge.icon}
            </span>
          </button>
          <div className="hm-lt-text">
            <div className="hm-lt-meta">
              <span>
                {a.unseen && <span className="hm-lt-dot" aria-hidden="true" />}
                {coach.firstName} · {kindWord}
              </span>
              <span>{a.whenLabel}</span>
            </div>
            <h3 className="hm-lt-title">{a.title}</h3>
            {a.body && <p className="hm-lt-desc">{a.body}</p>}
            {a.link && a.kind === "message" && (
              <div className="hm-lt-chip">
                <MessageLinkChip view={a.link} />
              </div>
            )}
          </div>
        </div>
        <div className="hm-lt-foot">
          {a.moreThisWeek > 0 && (
            <button type="button" className="hm-lt-more" onClick={() => openNotifications?.()}>
              + {a.moreThisWeek} more
            </button>
          )}
          <button type="button" className="hm-lt-cta" onClick={follow}>
            {a.cta} →
          </button>
        </div>
      </div>
      {watching && a.videoReply && <VideoReplySheet reply={a.videoReply} onClose={() => setWatching(false)} />}
    </article>
  );
}

// ---- 5 · Next meeting, only when booked ------------------------------------

function MeetingCard({ m, recap, coachFirstName }: { m: NonNullable<UpcomingMeeting>; recap: MeetingRecap; coachFirstName: string }) {
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
  const [more, setMore] = useState(false);
  const longRecap = !!recap && recap.text.length > 220;
  const pillLabel = live ? "Live" : m.inLabel;
  return (
    <section className="hm-mt" aria-label={`Next meeting with ${coachFirstName}`}>
      <span className="hm-mt-glow" aria-hidden="true" />
      <div className="hm-mt-row">
        <div className="hm-mt-date">
          <b>{m.dayNumber}</b>
          <small>{m.monthCap}</small>
        </div>
        <div className="hm-mt-main">
          <div className="hm-mt-top">
            <span className="hm-mt-eyebrow">With {coachFirstName}</span>
            <span className={`hm-mt-pill${live ? " live" : m.inLabel === "Today" ? " today" : ""}`} aria-label={pillLabel}>
              {live && <span className="hm-mt-live-dot" aria-hidden="true" />}
              {pillLabel}
            </span>
          </div>
          <div className="hm-mt-title">{m.topic}</div>
          <div className="hm-mt-when">{m.whenLabel}</div>
        </div>
      </div>
      {joinable && (
        <a className="hm-mt-join" href={m.link!} target="_blank" rel="noopener noreferrer">
          <span className="hm-mt-join-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="6" width="13" height="12" rx="2" />
              <path d="M16 10l5-3v10l-5-3z" />
            </svg>
          </span>
          Join call
        </a>
      )}
      {recap && (
        <div className="hm-mt-recap">
          <span className="hm-mt-recap-label">Last meeting · {recap.dateLabel}</span>
          <p className={`hm-mt-recap-text${longRecap && !more ? " clamp" : ""}`}>{recap.text}</p>
          {longRecap && !more && (
            <button type="button" className="hm-mt-more" onClick={() => setMore(true)}>
              More
            </button>
          )}
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

// ---- Small pieces ----------------------------------------------------------

/** A figure that counts up from zero the first time it shows. */
function CountUp({ n }: { n: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (n <= 0) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 600);
      setShown(Math.round(n * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <>{n <= 0 ? 0 : shown}</>;
}

