"use client";

import { ArrowRightIcon, CalendarIcon, CheckIcon, ClockIcon } from "../components/icons";
import TrendCarousel, { TrendMetric } from "./TrendCarousel";
import type { ClientPlanView, PlanPhaseView, PlanTrackView } from "../lib/queries";
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
  phase,
  plan,
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
}: {
  dateLabel: string;
  name: string;
  /** Goal / phase from the coach's card, e.g. "Fat loss". */
  phase: string;
  /** The coach's phase timeline, when one exists; drives the plan card. */
  plan: ClientPlanView | null;
  /** Anything quieter beside it, currently the current-week label. */
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
}) {
  // Check-in is a full-screen pushed view owned by AppShell; a due row just
  // asks it to open on that row's section.
  const openCheckIn = useOpenCheckIn();

  const dayTarget = totalDays || 7;

  return (
    <div className="home-dark">
      <div className="home-dark-datebar">{dateLabel}</div>
      {/* The header is the plan's summary: name, then the phase the coach
          has them in and the week. When the coach has drawn a phase
          timeline, one row per track sits under it: the phase running now,
          how far through it they are, and what follows. */}
      <div className="home-dark-headrow">
        <div className="home-dark-headmain">
          <div className="home-dark-name">{name}</div>
          <div className="home-dark-subrow">
            <span className="home-dark-phase">{phase}</span>
            {subLine && <span className="home-dark-sub">{subLine}</span>}
            {goalNote && <span className="home-dark-goal">{goalNote}</span>}
          </div>
        </div>
      </div>
      {plan && <PlanRows plan={plan} />}

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

// ---- Plan rows: one per track with phases, under the name. ----

const TRACK_ORDER = ["nutrition", "training", "lifestyle"];

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
/** Whole days from a to b (b - a), both ISO dates. */
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
const addDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-${String(d.getDate()).padStart(2, "0")}`;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** "8 weeks" from 7+ days, rounded up; "6 days" under a week. */
const spanWords = (days: number) => (days >= 7 ? plural(Math.ceil(days / 7), "week") : plural(days, "day"));

function PlanRows({ plan }: { plan: ClientPlanView }) {
  const today = plan.today;
  const rows = TRACK_ORDER.map((id) => plan.tracks.find((t) => t.track === id))
    .filter((t): t is PlanTrackView => !!t)
    .map((t) => {
      const sorted = [...t.phases].sort((a, b) => (a.startWeek < b.startWeek ? -1 : 1));
      // The phase running this week, else the next one coming up.
      const running = sorted.find((p) => p.startWeek <= today && addDays(p.endWeek, 6) >= today) ?? null;
      const shown = running ?? sorted.find((p) => p.startWeek > today) ?? null;
      if (!shown) return null;
      const upNext = sorted.find((p) => p.startWeek > shown.endWeek) ?? null;
      return { track: t, phase: shown, running: !!running, upNext };
    })
    .filter((r): r is NonNullable<typeof r> => !!r);
  if (rows.length === 0) return null;

  return (
    <div className="home-plan-rows">
      {rows.map(({ track, phase, running, upNext }) => (
        <PlanRow key={track.track} track={track} phase={phase} running={running} upNext={upNext} today={today} />
      ))}
    </div>
  );
}

function PlanRow({
  track,
  phase,
  running,
  upNext,
  today,
}: {
  track: PlanTrackView;
  phase: PlanPhaseView;
  running: boolean;
  upNext: PlanPhaseView | null;
  today: string;
}) {
  const totalWeeks = phase.weeks;
  const totalDays = totalWeeks * 7;
  const endDate = addDays(phase.endWeek, 6);

  let timeLeft: string;
  let doneDays = 0;
  if (running) {
    // Days left counts today through the phase's last Sunday.
    const remaining = daysBetween(today, endDate) + 1;
    timeLeft = remaining <= 1 ? "Last day" : `${spanWords(remaining)} to go`;
    doneDays = Math.min(totalDays, Math.max(0, daysBetween(phase.startWeek, today)));
  } else {
    timeLeft = `Starts in ${spanWords(daysBetween(today, phase.startWeek))}`;
  }
  const weekNow = Math.min(totalWeeks, Math.floor(doneDays / 7) + 1);

  return (
    <div className={`home-plan-row ${track.track}`}>
      <div className="home-plan-row-head">
        <span className="home-plan-tag">{track.label}</span>
        <span className="home-plan-name">{phase.name}</span>
        <span className="home-plan-left">{timeLeft}</span>
      </div>
      <div className="home-plan-bar">
        <div className="home-plan-bar-fill" style={{ width: `${(doneDays / totalDays) * 100}%` }} />
      </div>
      <div className="home-plan-row-foot">
        <span>{running ? `Week ${weekNow} of ${totalWeeks}` : plural(totalWeeks, "week")}</span>
        {upNext && (
          <span>
            Up next: <b>{upNext.name}</b>
          </span>
        )}
      </div>
    </div>
  );
}
