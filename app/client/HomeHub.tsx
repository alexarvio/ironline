"use client";

import { ArrowRightIcon, CalendarIcon, CheckIcon, ClockIcon } from "../components/icons";
import TrendCarousel, { TrendMetric } from "./TrendCarousel";
import ProgressReportCard, { ReportChart, ReportStat } from "./ProgressReportCard";
import { useOpenChat, useOpenCheckIn } from "./CheckInContext";

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
export type HomeReport = {
  id: number;
  periodLabel: string;
  headline: string;
  body: string;
  stats: ReportStat[];
  chart: ReportChart;
  archived: boolean;
} | null;
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
  report,
  goals,
  upcoming,
  coachNotes,
  checkInStatus,
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
  report: HomeReport;
  goals: string[];
  upcoming: UpcomingMeeting;
  coachNotes: CoachNote[];
  checkInStatus: CheckInStatus;
}) {
  // Check-in is a full-screen pushed view owned by AppShell; a due row just
  // asks it to open on that row's section.
  const openCheckIn = useOpenCheckIn();
  // Coach notes are the coach commenting on your work; tapping one opens
  // the conversation it came from, same as the prototype.
  const openChat = useOpenChat();

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

      {report && (
        <ProgressReportCard
          reportId={report.id}
          periodLabel={report.periodLabel}
          headline={report.headline}
          body={report.body}
          stats={report.stats}
          chart={report.chart}
          archived={report.archived}
        />
      )}

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
          <p className="home-dark-empty">Nothing scheduled yet — your coach hasn&rsquo;t booked a call.</p>
        )}
      </section>

      <section className="home-dark-section">
        <span className="home-dark-section-title">Coach notes</span>
        {coachNotes.length === 0 ? (
          <p className="home-dark-empty">No notes yet — your coach&rsquo;s comments on your work will show up here.</p>
        ) : (
          <div className="home-dark-rows">
            {coachNotes.map((n) => (
              <button
                key={n.id}
                type="button"
                className="home-dark-note-row tappable"
                onClick={() => openChat?.()}
              >
                <span className={`home-dark-note-dot${n.unread ? " unread" : ""}`} aria-hidden="true" />
                <div className="home-dark-row-body">
                  <div className="home-dark-note-top">
                    <span className="home-dark-note-context">{n.context}</span>
                    <span className="home-dark-note-time">{n.timeLabel}</span>
                  </div>
                  <div className="home-dark-note-text">{n.text}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

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
