"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../../lib/actions";
import { ChevronLeftIcon } from "../../components/icons";
import { notificationTypeOf, type NotificationCategory } from "../../lib/notificationTypes";
import type { EventTypeId } from "../../lib/eventTypes";
import { dayLabel, localDayKey, timeLabel } from "../../lib/notificationDates";
import { pic } from "../../lib/pic";
import { useBack, useCoachIdentity, useNavigateTab, useOpenCheckIn, useOpenEvents, useOpenLink, useOpenMeetings, useOpenMessages } from "../CheckInContext";
import type { LinkView } from "../../lib/messageLinks";
import { TypeIcon } from "../events/AddEventSheet";
import VideoReplySheet, { type VideoReplyView } from "../VideoReplySheet";

// The Notifications screen, "Clean feed" (9 Oct): what the coach did,
// grouped by day, newest first. In the hairline language since 16 Oct: flat
// rows on the page with a hairline between them; an unread one has the ink
// dot and a heavier title. The coach's face with a badge for the category on
// every row. Long words are cut to two lines with a chevron that opens them
// in place. No reminders here: those live on Home.

export type NotifView = {
  id: number;
  category: NotificationCategory;
  eventType: EventTypeId | null;
  title: string;
  body: string | null;
  createdAt: string;
  read: boolean;
  actionTab: string | null;
  actionRef: number | null;
  /** A reply to the client's video, opened right here. */
  videoReply: VideoReplyView | null;
  /** The exact thing it is about, as a message link (24 Oct, Alex): a tap opens it as a message's link does. */
  link?: LinkView | null;
};

const PAGE = 30;

export default function NotificationsScreen({ items, clientId, coachName }: { items: NotifView[]; clientId: number; coachName: string }) {
  const coachFirst = coachName.trim().split(/\s+/)[0] || "your coach";
  const coach = useCoachIdentity();
  const back = useBack();
  const navigate = useNavigateTab();
  const openLink = useOpenLink();
  const openMessages = useOpenMessages();
  const openEvents = useOpenEvents();
  const openMeetings = useOpenMeetings();
  const openCheckIn = useOpenCheckIn();
  const [, start] = useTransition();

  // Read state kept here so a tap settles at once; the server follows.
  const [readIds, setReadIds] = useState<Set<number>>(() => new Set());
  const isRead = (n: NotifView) => n.read || readIds.has(n.id);
  const unread = items.filter((n) => !isRead(n)).length;
  const [shown, setShown] = useState(PAGE);
  const [watching, setWatching] = useState<VideoReplyView | null>(null);
  const [todayKey, setTodayKey] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setTodayKey(localDayKey(new Date().toISOString())), 0);
    return () => clearTimeout(t);
  }, []);

  // More as the end comes near.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= items.length) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setShown((n) => n + PAGE), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, items.length]);

  const open = (n: NotifView) => {
    if (!isRead(n)) {
      setReadIds((s) => new Set(s).add(n.id));
      start(() => markNotificationReadAction(n.id));
    }
    if (n.link && !n.link.gone && openLink) openLink(n.link);
    else if (n.actionTab === "chat") openMessages?.();
    else if (n.actionTab === "video") {
      if (n.videoReply) setWatching(n.videoReply);
    } else if (n.category === "event_added" || n.category === "event_changed") openEvents?.(n.actionRef ?? undefined);
    else if (n.category === "meeting_booked" || n.category === "meeting_changed" || n.category === "meeting_notes") openMeetings?.(n.actionRef ?? undefined);
    else if (n.category === "checkin_comment") openCheckIn?.("daily");
    // A training note with no session of its own (a new plan, a week added): the tab, never its ref as a session
    // (a programme's or a phase's id can be one; 24 Oct, Alex).
    else if (n.actionTab) navigate?.(n.actionTab, n.actionTab === "training" ? undefined : n.actionRef ?? undefined);
  };
  const markAll = () => {
    if (!unread) return;
    setReadIds(new Set(items.map((n) => n.id)));
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    start(() => markAllNotificationsReadAction(fd));
  };

  // Days, newest first; items newest first within.
  const sorted = [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id)).slice(0, shown);
  const days: { key: string; items: NotifView[] }[] = [];
  for (const n of sorted) {
    const key = localDayKey(n.createdAt);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(n);
    else days.push({ key, items: [n] });
  }

  return (
    <>
      <header className="cn-header ntf-nav evp-nav">
        <button type="button" className="cn-icon-btn" onClick={() => back?.()} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">Notifications</h1>
        </div>
        <button type="button" className={`ntf-markall${unread ? "" : " off"}`} onClick={markAll} aria-disabled={!unread} disabled={!unread}>
          {unread ? "Mark all read" : "All read"}
        </button>
      </header>
      <main className="cn-body">
        <div className="ntf-scroll">
          {items.length === 0 ? (
            <div className="ntf-empty">
              <span className="ntf-empty-bell" aria-hidden="true">
                <TypeIcon path="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4" size={22} stroke={2} />
              </span>
              <b>Nothing yet</b>
              <small>When {coachFirst} books a call, replies to a video or changes your plan, it shows up here.</small>
            </div>
          ) : (
            days.map((d) => {
              const fresh = d.items.filter((n) => !isRead(n)).length;
              return (
                <section key={d.key} className="ntf-day">
                  <h2 className="ntf-day-head">
                    <span>{todayKey ? dayLabel(d.key, todayKey) : dayLabel(d.key, d.key)}</span>
                    {fresh > 0 && <span className="ntf-day-new" aria-hidden="true">{fresh} new</span>}
                  </h2>
                  {d.items.map((n) => (
                    <NotificationItem key={n.id} n={n} read={isRead(n)} todayKey={todayKey} coachFirst={coachFirst} coachPhoto={coach?.photoPath ?? null} onOpen={() => open(n)} />
                  ))}
                </section>
              );
            })
          )}
          {shown < items.length && (
            <div ref={sentinel} className="ntf-loading">
              Loading…
            </div>
          )}
        </div>
      </main>
      {watching && <VideoReplySheet reply={watching} onClose={() => setWatching(null)} />}
    </>
  );
}

function NotificationItem({ n, read, todayKey, coachFirst, coachPhoto, onOpen }: { n: NotifView; read: boolean; todayKey: string | null; coachFirst: string; coachPhoto: string | null; onOpen: () => void }) {
  const t = notificationTypeOf(n.category, n.eventType);
  const gone = n.actionTab === "video" && !n.videoReply;
  const time = todayKey ? timeLabel(n.createdAt) : "";
  const system = n.category === "system";
  // Long words (16 Oct): cut to two lines as before, and when cut, a chevron
  // by the title opens the rest in place, the height eased open and shut.
  const textRef = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    const check = () => setClipped([...el.querySelectorAll<HTMLElement>(".ntf-title, .ntf-body")].some((x) => x.scrollHeight > x.clientHeight + 1));
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n.title, n.body, expanded]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = textRef.current;
    if (!el) return setExpanded((x) => !x);
    const from = el.offsetHeight;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Height from → to, then back to auto: on transitionend, or after 350ms if the browser skipped the transition.
    const ease = (to: number, done?: () => void) => {
      el.style.height = `${from}px`;
      void el.offsetHeight;
      el.style.height = `${to}px`;
      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        el.style.height = "";
        done?.();
      };
      el.addEventListener("transitionend", end, { once: true });
      setTimeout(end, 350);
    };
    if (!expanded) {
      setExpanded(true);
      if (!reduce) requestAnimationFrame(() => ease(el.scrollHeight));
    } else if (reduce) {
      setExpanded(false);
    } else {
      // Shut: measure the cut height, ease down to it, then cut the lines again.
      el.classList.remove("open");
      const to = el.offsetHeight;
      el.classList.add("open");
      ease(to, () => setExpanded(false));
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      className={`ntf-item${read ? " read" : ""}`}
      style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), onOpen())}
      aria-label={`${read ? "" : "Unread. "}${t.label}. ${n.title}.${n.body ? ` ${n.body}.` : ""} ${time}`}
    >
      <span className="ntf-avatar" aria-hidden="true">
        {system ? (
          <span className="ntf-avatar-sys">
            <TypeIcon path={t.icon} size={18} stroke={2} />
          </span>
        ) : coachPhoto ? (
          <img src={pic(coachPhoto, 96)} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="ntf-avatar-initial">{(coachFirst || "C").charAt(0).toUpperCase()}</span>
        )}
        {!system && (
          <span className="ntf-badge">
            <TypeIcon path={t.icon} size={10} stroke={2.6} />
          </span>
        )}
      </span>
      <span className="ntf-content">
        <span className="ntf-top">
          <span className="ntf-cat">{t.label}</span>
          <span className="ntf-time">{time}</span>
          {!read && <span className="ntf-dot" aria-hidden="true" />}
        </span>
        <span className="ntf-title-row">
          <span ref={textRef} className={`ntf-text${expanded ? " open" : ""}`}>
            <span className="ntf-title">{n.title}</span>
            {/* Facts parted by the drawn upright bar, never a middle dot (the rules; 23 Oct: To focus on's goals). */}
            {n.body && (
              <span className="ntf-body">
                {n.body.split(" · ").map((part, i) => (
                  <span key={i}>
                    {i > 0 && <i className="ntf-sep" aria-hidden="true" />}
                    {part}
                  </span>
                ))}
              </span>
            )}
          </span>
          {(clipped || expanded) && (
            <button type="button" className={`ntf-more${expanded ? " open" : ""}`} onClick={toggle} aria-expanded={expanded} aria-label={expanded ? "Show less" : "Show all"}>
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </span>
        <span className={`ntf-action${gone ? " gone" : ""}`}>{gone ? "No longer available" : t.action}</span>
      </span>
    </div>
  );
}
