"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../../lib/actions";
import { ChevronLeftIcon } from "../../components/icons";
import { notificationTypeOf, type NotificationCategory } from "../../lib/notificationTypes";
import type { EventTypeId } from "../../lib/eventTypes";
import { dayLabel, localDayKey, timeLabel } from "../../lib/notificationDates";
import { useBack, useCoachIdentity, useNavigateTab, useOpenCheckIn, useOpenEvents, useOpenMeetings, useOpenMessages } from "../CheckInContext";
import { TypeIcon } from "../events/AddEventSheet";
import VideoReplySheet, { type VideoReplyView } from "../VideoReplySheet";

// The Notifications screen, "Clean feed" (9 Oct): what the coach did,
// grouped by day, newest first; unread ones are lifted cards in their
// category's colour, read ones flat rows. The coach's face with a badge
// for the category on every row. No reminders here: those live on Home.

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
};

const PAGE = 30;

export default function NotificationsScreen({ items, clientId, coachName }: { items: NotifView[]; clientId: number; coachName: string }) {
  const coachFirst = coachName.trim().split(/\s+/)[0] || "your coach";
  const coach = useCoachIdentity();
  const back = useBack();
  const navigate = useNavigateTab();
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
    if (n.actionTab === "chat") openMessages?.();
    else if (n.actionTab === "video") {
      if (n.videoReply) setWatching(n.videoReply);
    } else if (n.category === "event_added" || n.category === "event_changed") openEvents?.();
    else if (n.category === "meeting_booked" || n.category === "meeting_changed" || n.category === "meeting_notes") openMeetings?.();
    else if (n.category === "checkin_comment") openCheckIn?.("daily");
    else if (n.actionTab) navigate?.(n.actionTab, n.actionRef ?? undefined);
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
      <header className="cn-header ntf-nav">
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
  return (
    <button
      type="button"
      className={`ntf-item${read ? " read" : ""}`}
      style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}
      onClick={onOpen}
      aria-label={`${read ? "" : "Unread. "}${t.label}. ${n.title}.${n.body ? ` ${n.body}.` : ""} ${time}`}
    >
      <span className="ntf-avatar" aria-hidden="true">
        {system ? (
          <span className="ntf-avatar-sys">
            <TypeIcon path={t.icon} size={18} stroke={2} />
          </span>
        ) : coachPhoto ? (
          <img src={coachPhoto} alt="" />
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
        <span className="ntf-title">{n.title}</span>
        <span className="ntf-bottom">
          <span className="ntf-body">{n.body ?? ""}</span>
          <span className={`ntf-action${gone ? " gone" : ""}`}>{gone ? "No longer available" : t.action}</span>
        </span>
      </span>
    </button>
  );
}
