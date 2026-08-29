"use client";

import { ReactNode, useRef, useState } from "react";
import { ArrowRightIcon, ChevronLeftIcon } from "../components/icons";
import { LineChart, Point } from "../components/LineChart";

// Deliberately does NOT import from ../lib/queries (see the note in the old
// CheckInHub.tsx this replaces — a "use client" file importing queries.ts
// breaks the dev server at runtime). All data comes in as plain props,
// computed server-side in page.tsx.
export type DueItem = { id: string; label: string; detail: string; targetTab: string };
export type HubSubTab = { id: string; label: string; content: ReactNode };
export type UpcomingMeeting = { dateLabel: string; dayLabel: string; topic: string; timeLabel: string } | null;
export type MessagePreview = { id: number; sender: "client" | "coach"; text: string; timeLabel: string };
export type CoachActivityPreview = { message: string; timeLabel: string } | null;
export type ChartMetric = {
  id: string;
  name: string;
  unit: string;
  series: Point[];
  average: number | null;
  trendPct: number | null;
};
type ReportSectionPreview = {
  label: string;
  series?: Point[];
  seriesByField?: Record<string, { points: Point[] }>;
};
export type LatestReportPreview = {
  periodStart: string;
  periodEnd: string;
  summary: string;
  sections: ReportSectionPreview[];
} | null;

// Home used to be its own tab with Check-ins as a separate one; they're
// merged here so the client has one landing screen (profile + what's due
// today) and taps into a due item only when they actually need the fuller
// Tracker/Measurements/Photos view behind it.
export default function HomeHub({
  dateLabel,
  name,
  subLine,
  goalNote,
  weightLabel,
  daysTrained,
  totalDays,
  setsThisWeek,
  chartMetrics,
  goals,
  upcoming,
  lastCoachActivity,
  recentMessages,
  dueItems,
  latestReport,
  tabs,
}: {
  dateLabel: string;
  name: string;
  subLine: string;
  goalNote: string | null;
  weightLabel: string | null;
  daysTrained: number;
  totalDays: number;
  setsThisWeek: number;
  chartMetrics: ChartMetric[];
  goals: string[];
  upcoming: UpcomingMeeting;
  lastCoachActivity: CoachActivityPreview;
  recentMessages: MessagePreview[];
  dueItems: DueItem[];
  latestReport: LatestReportPreview;
  tabs: HubSubTab[];
}) {
  const [view, setView] = useState("home");
  const carouselRef = useRef<HTMLDivElement>(null);
  // Snaps to the nearest slide index first (self-correcting even if a prior
  // scroll landed slightly off), then moves exactly one index over — a
  // relative scrollBy() fights with scroll-snap-type and can settle short.
  const scrollCarousel = (dir: 1 | -1) => {
    const el = carouselRef.current;
    const slide = el?.firstElementChild as HTMLElement | null;
    if (!el || !slide) return;
    const step = slide.getBoundingClientRect().width + 10;
    const currentIndex = Math.round(el.scrollLeft / step);
    const maxIndex = Math.round((el.scrollWidth - el.clientWidth) / step);
    const nextIndex = Math.max(0, Math.min(maxIndex, currentIndex + dir));
    el.scrollTo({ left: nextIndex * step, behavior: "smooth" });
  };

  if (view !== "home") {
    const tab = tabs.find((t) => t.id === view);
    return (
      <div>
        {/* No in-page back link — the bottom nav's Home tab returns here
            (tapping it while already on Home resets this sub-view; see
            AppShell's navResetKey). */}
        <h2 style={{ margin: "4px 0 14px" }}>{tab?.label}</h2>
        {tab?.content}
      </div>
    );
  }

  return (
    <div>
      <div className="home-date-line">{dateLabel}</div>

      <div className="home-greeting-card">
        <div className="home-greeting-name">{name}</div>
        <div className="home-greeting-sub">{subLine}</div>
        {weightLabel && <div className="home-greeting-goal">{weightLabel}</div>}
        {goalNote && <div className="home-greeting-goal">{goalNote}</div>}
      </div>

      {latestReport && (
        <section className="home-section">
          <h3 className="home-section-title">Progress report</h3>
          <div className="upcoming-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
            <div className="upcoming-title">
              {latestReport.periodStart} – {latestReport.periodEnd}
            </div>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{latestReport.summary}</p>
            {latestReport.sections
              .filter((s) => (s.series && s.series.length >= 2) || s.seriesByField)
              .map((s, i) => (
                <div key={i} style={{ width: "100%" }}>
                  <div className="exercise-meta" style={{ marginBottom: 4 }}>
                    {s.label}
                  </div>
                  {s.series && s.series.length >= 2 && (
                    <div className="report-section-chart">
                      <LineChart points={s.series} />
                    </div>
                  )}
                  {s.seriesByField &&
                    Object.entries(s.seriesByField).map(([fieldName, { points }]) => (
                      <div key={fieldName} style={{ marginBottom: 8 }}>
                        <div className="exercise-meta" style={{ marginBottom: 4 }}>
                          {fieldName}
                        </div>
                        <div className="report-section-chart">
                          <LineChart points={points} />
                        </div>
                      </div>
                    ))}
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <h3 className="home-section-title">This week</h3>
        <div className="home-recap-grid">
          <div className="home-recap-stat home-recap-stat-ring">
            <div
              className="home-days-ring"
              style={{
                background: `conic-gradient(var(--accent) 0deg ${
                  totalDays > 0 ? Math.min(1, daysTrained / totalDays) * 360 : 0
                }deg, var(--paper-raised) ${
                  totalDays > 0 ? Math.min(1, daysTrained / totalDays) * 360 : 0
                }deg 360deg)`,
              }}
            >
              <div className="home-days-ring-inner">
                {daysTrained}/{totalDays || 7}
              </div>
            </div>
            <div className="home-recap-label">days trained</div>
          </div>
          <div className="home-recap-stat">
            <div className="home-recap-value">{setsThisWeek}</div>
            <div className="home-recap-label">sets logged</div>
          </div>
        </div>
      </section>

      {chartMetrics.length > 0 && (
        <section className="home-section">
          <h3 className="home-section-title">Trends</h3>
          <div className="metric-carousel-wrap">
            {chartMetrics.length > 1 && (
              <button
                type="button"
                className="metric-carousel-arrow metric-carousel-arrow-prev"
                aria-label="Previous metric"
                onClick={() => scrollCarousel(-1)}
              >
                <ChevronLeftIcon />
              </button>
            )}
            <div className="metric-carousel" ref={carouselRef}>
              {chartMetrics.map((m) => {
                const trendDir = m.trendPct == null ? null : m.trendPct > 0 ? "up" : m.trendPct < 0 ? "down" : null;
                return (
                  <div key={m.id} className="metric-carousel-slide">
                    <div className="metric-carousel-head">
                      <span className="metric-carousel-name">{m.name}</span>
                      {m.trendPct != null && (
                        <span className={`metric-carousel-trend${trendDir ? ` ${trendDir}` : ""}`}>
                          {trendDir === "up" ? "▲" : trendDir === "down" ? "▼" : "–"} {Math.abs(m.trendPct).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {m.average != null && (
                      <div className="metric-carousel-avg">
                        avg {Number.isInteger(m.average) ? m.average : m.average.toFixed(1)}
                        {m.unit ? ` ${m.unit}` : ""}
                      </div>
                    )}
                    <div className="metric-carousel-chart">
                      <LineChart points={m.series} sparkline />
                    </div>
                  </div>
                );
              })}
            </div>
            {chartMetrics.length > 1 && (
              <button
                type="button"
                className="metric-carousel-arrow metric-carousel-arrow-next"
                aria-label="Next metric"
                onClick={() => scrollCarousel(1)}
              >
                <ArrowRightIcon />
              </button>
            )}
          </div>
        </section>
      )}

      <section className="home-section">
        <h3 className="home-section-title">Today</h3>
        {dueItems.length === 0 ? (
          <p className="empty-note">All caught up — nothing due today.</p>
        ) : (
          <div className="today-list">
            {dueItems.map((item) => (
              <button key={item.id} type="button" className="today-card" onClick={() => setView(item.targetTab)}>
                <div>
                  <div className="today-card-title">{item.label}</div>
                  <div className="today-card-detail">{item.detail}</div>
                </div>
                <span className="today-card-cta" aria-hidden="true">
                  <ArrowRightIcon />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="home-section">
        <h3 className="home-section-title">Next meeting</h3>
        {upcoming ? (
          <div className="upcoming-card">
            <div className="upcoming-date-badge">
              <div className="upcoming-date-day">{upcoming.dayLabel}</div>
              <div className="upcoming-date-num">{upcoming.dateLabel}</div>
            </div>
            <div>
              <div className="upcoming-title">{upcoming.topic}</div>
              <div className="upcoming-time">{upcoming.timeLabel}</div>
            </div>
          </div>
        ) : (
          <p className="empty-note">Nothing scheduled yet — your coach hasn&rsquo;t booked a call.</p>
        )}
      </section>

      <section className="home-section">
        <h3 className="home-section-title">Last update from your coach</h3>
        {lastCoachActivity ? (
          <div className="coach-activity-row">
            <span className="coach-activity-dot" aria-hidden="true" />
            <div>
              <div className="coach-activity-message">{lastCoachActivity.message}</div>
              <div className="coach-activity-time">{lastCoachActivity.timeLabel}</div>
            </div>
          </div>
        ) : (
          <p className="empty-note">No updates yet — you&rsquo;ll see it here when your coach changes something.</p>
        )}
      </section>

      {recentMessages.length > 0 && (
        <section className="home-section">
          <h3 className="home-section-title">Recent messages</h3>
          <div className="message-feed-list">
            {recentMessages.map((m) => (
              <div key={m.id} className="coach-preview-card">
                <div className={`coach-preview-avatar${m.sender === "client" ? " me" : ""}`}>
                  {m.sender === "coach" ? "C" : "Y"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="coach-preview-row">
                    <span className="coach-preview-name">{m.sender === "coach" ? "Coach" : "You"}</span>
                    <span className="coach-preview-time">{m.timeLabel}</span>
                  </div>
                  <div className="coach-preview-text">{m.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {goals.length > 0 && (
        <section className="home-section">
          <h3 className="home-section-title">Goals</h3>
          <div className="home-goal-list">
            {goals.map((g, i) => (
              <div key={i} className="home-goal-row">
                {g}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
