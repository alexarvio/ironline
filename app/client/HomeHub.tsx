"use client";

import { ArrowRightIcon, CalendarIcon, CheckIcon, ClockIcon } from "../components/icons";
import TrendCarousel, { TrendMetric } from "./TrendCarousel";
import { useOpenCheckIn } from "./CheckInContext";

// Deliberately does NOT import from ../lib/queries (see the note in the old
// CheckInHub.tsx this replaces — a "use client" file importing queries.ts
// breaks the dev server at runtime). All data comes in as plain props,
// computed server-side in page.tsx.
// Home reports check-in status as one line — it no longer enumerates each
// outstanding item, so it needs the counts, not the items.
export type CheckInStatus = {
  configuredCount: number;
  dueTypes: ("daily" | "weekly" | "measurements")[];
  dueNames: string;
  nextLabel: string;
};
export type UpcomingMeeting = {
  monthCap: string;
  dayNumber: string;
  topic: string;
  inLabel: string;
  whenLabel: string;
  durationLabel: string;
} | null;
export type CoachNote = { id: number; context: string; timeLabel: string; text: string; unread: boolean };
export type { TrendMetric };

// Home used to be its own tab with Check-ins as a separate one; they're
// merged here so the client has one landing screen (profile + what's due
// today) and taps into a due item only when they actually need the fuller
// Tracker/Measurements/Photos view behind it.
export default function HomeHub({
  dateLabel,
  name,
  subLine,
  goalNote,
  daysTrained,
  totalDays,
  setsThisWeek,
  setsPlanned,
  volumeTrendLabel,
  trendMetrics,
  goals,
  upcoming,
  coachNotes,
  checkInStatus,
  photos,
}: {
  dateLabel: string;
  name: string;
  subLine: string;
  goalNote: string | null;
  daysTrained: number;
  totalDays: number;
  setsThisWeek: number;
  setsPlanned: number;
  volumeTrendLabel: string | null;
  trendMetrics: TrendMetric[];
  goals: string[];
  upcoming: UpcomingMeeting;
  coachNotes: CoachNote[];
  checkInStatus: CheckInStatus;
  /** Progress pictures: its own card, separate from the check-ins. */
  photos?: { configured: boolean; due: boolean; uploaded: number; total: number; periodLabel: string; nextLabel: string };
}) {
  // Check-in is a full-screen pushed view owned by AppShell; a due row just
  // asks it to open on that row's section.
  const openCheckIn = useOpenCheckIn();

  const dayTarget = totalDays || 7;

  return (
    <div className="home-dark">
      <div className="home-dark-datebar">{dateLabel}</div>
      <div className="home-dark-name">{name}</div>
      <div className="home-dark-subrow">
        <span className="home-dark-sub">{subLine}</span>
        {goalNote && <span className="home-dark-goal">{goalNote}</span>}
      </div>

      <div className="home-dark-hr" />

      <div className="home-dark-stats">
        <div className="home-dark-stat">
          <div className="home-dark-stat-label">Days trained</div>
          <div className="home-dark-stat-value-row">
            <span className="home-dark-stat-value">{daysTrained}</span>
            <span className="home-dark-stat-of">of {dayTarget}</span>
          </div>
          <div className="home-dark-segments">
            {Array.from({ length: dayTarget }, (_, i) => (
              <span key={i} className={`home-dark-segment${i < daysTrained ? " filled" : ""}`} />
            ))}
          </div>
          <div className="home-dark-stat-caption">
            {daysTrained >= dayTarget ? "Week complete" : `${dayTarget - daysTrained} left this week`}
          </div>
        </div>
        <div className="home-dark-stat-divider" />
        <div className="home-dark-stat">
          <div className="home-dark-stat-label">Sets logged</div>
          <div className="home-dark-stat-value-row">
            <span className="home-dark-stat-value">{setsThisWeek}</span>
            {volumeTrendLabel && <span className="home-dark-stat-delta">{volumeTrendLabel}</span>}
          </div>
          <div className="home-dark-bar">
            <div
              className="home-dark-bar-fill"
              style={{ width: `${setsPlanned > 0 ? Math.min(1, setsThisWeek / setsPlanned) * 100 : 0}%` }}
            />
          </div>
          <div className="home-dark-stat-caption">
            {setsPlanned > 0 ? `${setsThisWeek} of ${setsPlanned} planned` : "Nothing planned this week"}
          </div>
        </div>
      </div>

      <TrendCarousel metrics={trendMetrics} />

      {checkInStatus.configuredCount > 0 && (
        <section className="home-dark-section">
          <span className="home-dark-section-title">Check-ins</span>
          <button type="button" className="home-checkin-row" onClick={() => openCheckIn?.(checkInStatus.dueTypes[0] ?? "daily")}>
            <div className="home-checkin-body">
              {checkInStatus.dueTypes.length > 0 ? (
                <>
                  <div className="home-checkin-title">
                    {checkInStatus.dueTypes.length} check-in{checkInStatus.dueTypes.length === 1 ? "" : "s"} due
                  </div>
                  <div className="home-checkin-detail due">{checkInStatus.dueNames} · tap to log</div>
                </>
              ) : (
                <>
                  <div className="home-checkin-title">All check-ins up to date</div>
                  <div className="home-checkin-detail">{checkInStatus.nextLabel}</div>
                </>
              )}
            </div>
            <span
              className={`home-checkin-mark${checkInStatus.dueTypes.length > 0 ? " due" : ""}`}
              aria-hidden="true"
            >
              {checkInStatus.dueTypes.length > 0 ? <ArrowRightIcon /> : <CheckIcon />}
            </span>
          </button>
        </section>
      )}

      {photos?.configured && (
        <section className="home-dark-section">
          <span className="home-dark-section-title">Progress pictures</span>
          <button type="button" className="home-checkin-row" onClick={() => openCheckIn?.("measurements")}>
            <div className="home-checkin-body">
              {photos.due ? (
                <>
                  <div className="home-checkin-title">
                    {photos.uploaded} of {photos.total} photos this set
                  </div>
                  <div className="home-checkin-detail due">{photos.periodLabel} · tap to add</div>
                </>
              ) : (
                <>
                  <div className="home-checkin-title">This set is complete</div>
                  <div className="home-checkin-detail">{photos.nextLabel}</div>
                </>
              )}
            </div>
            <span className={`home-checkin-mark${photos.due ? " due" : ""}`} aria-hidden="true">
              {photos.due ? <ArrowRightIcon /> : <CheckIcon />}
            </span>
          </button>
        </section>
      )}

      <section className="home-dark-section">
        <span className="home-dark-section-title">Next with your coach</span>
        {upcoming ? (
          <div className="home-meeting-row">
            <div className="home-meeting-date">
              <div className="home-meeting-month">{upcoming.monthCap}</div>
              <div className="home-meeting-day">{upcoming.dayNumber}</div>
            </div>
            <div className="home-meeting-body">
              <div className="home-meeting-title-row">
                <span className="home-meeting-title">{upcoming.topic}</span>
                <span className="home-meeting-in">{upcoming.inLabel}</span>
              </div>
              <div className="home-meeting-meta">
                <span className="home-meeting-meta-item">
                  <CalendarIcon />
                  {upcoming.whenLabel}
                </span>
                <span className="home-meeting-meta-item">
                  <ClockIcon />
                  {upcoming.durationLabel}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="home-dark-empty">Nothing scheduled yet. Your coach hasn&rsquo;t booked a call.</p>
        )}
      </section>

      {/* No "Coach notes" section here any more. It listed chat messages from
          the coach, and chat is cut from this beta, so it could only ever say
          "No notes yet". The coach's guidance reaches the client through the
          nutrition note and per-exercise notes instead. coachNotes stays a
          prop so the bell's unread state keeps working. */}

      {goals.length > 0 && (
        <section className="home-dark-section">
          <span className="home-dark-section-title">Goals</span>
          <div className="home-dark-rows">
            {goals.map((g, i) => (
              <div key={i} className="home-dark-goal-row">
                <span className="home-dark-goal-index">{String(i + 1).padStart(2, "0")}</span>
                <span className="home-dark-goal-text">{g}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
