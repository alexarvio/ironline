"use client";

import { ReactNode, useState } from "react";
import { ArrowRightIcon } from "../components/icons";

// Deliberately does NOT import from ../lib/queries (see the note in the old
// CheckInHub.tsx this replaces — a "use client" file importing queries.ts
// breaks the dev server at runtime). All data comes in as plain props,
// computed server-side in page.tsx.
export type DueItem = { id: string; label: string; detail: string; targetTab: string };
export type HubSubTab = { id: string; label: string; content: ReactNode };
export type UpcomingMeeting = { dateLabel: string; dayLabel: string; topic: string; timeLabel: string } | null;
export type MessagePreview = { id: number; sender: "client" | "coach"; text: string; timeLabel: string };
export type CoachActivityPreview = { message: string; timeLabel: string } | null;
export type PinnedMetricPreview = {
  id: number;
  name: string;
  unit: string;
  latest: number | null;
  average: number | null;
};

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
  weightTrendLabel,
  goals,
  upcoming,
  lastCoachActivity,
  recentMessages,
  dueItems,
  pinnedMetrics,
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
  weightTrendLabel: string | null;
  goals: string[];
  upcoming: UpcomingMeeting;
  lastCoachActivity: CoachActivityPreview;
  recentMessages: MessagePreview[];
  dueItems: DueItem[];
  pinnedMetrics: PinnedMetricPreview[];
  tabs: HubSubTab[];
}) {
  const [view, setView] = useState("home");

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

      <section className="home-section">
        <h3 className="home-section-title">This week</h3>
        <div className={`home-recap-grid${weightTrendLabel ? " home-recap-grid-3" : ""}`}>
          <div className="home-recap-stat">
            <div className="home-recap-value">
              {daysTrained}/{totalDays || 7}
            </div>
            <div className="home-recap-label">days trained</div>
          </div>
          <div className="home-recap-stat">
            <div className="home-recap-value">{setsThisWeek}</div>
            <div className="home-recap-label">sets logged</div>
          </div>
          {weightTrendLabel && (
            <div className="home-recap-stat">
              <div className="home-recap-value home-recap-value-trend">{weightTrendLabel}</div>
              <div className="home-recap-label">weight trend</div>
            </div>
          )}
        </div>
      </section>

      {pinnedMetrics.length > 0 && (
        <section className="home-section">
          <h3 className="home-section-title">Pinned by your coach</h3>
          <div className="pinned-metrics-grid">
            {pinnedMetrics.map((m) => (
              <div key={m.id} className="pinned-metric-card">
                <div className="pinned-metric-label">{m.name}</div>
                <div className="pinned-metric-value">
                  {m.latest != null ? `${m.latest}${m.unit ? ` ${m.unit}` : ""}` : "No entries yet"}
                </div>
                {m.average != null && <div className="pinned-metric-sub">avg {m.average.toFixed(1)}</div>}
              </div>
            ))}
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
