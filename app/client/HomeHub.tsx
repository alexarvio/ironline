"use client";

import { ArrowRightIcon, CheckIcon } from "../components/icons";
import GoalRow from "../components/GoalRow";
import type { ClientPlanView, GoalView, PlanPhaseView, PlanTrackView } from "../lib/queries";
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
  link: string | null;
  provider: string;
  startingNow: boolean;
  monthCap: string;
  dayNumber: string;
  topic: string;
  inLabel: string;
  whenLabel: string;
  durationLabel: string;
} | null;
export type CoachNote = { id: number; context: string; timeLabel: string; text: string; unread: boolean };

// Home used to be its own tab with Check-ins as a separate one; they're
// merged here so the client has one landing screen (profile + what's due
// today) and taps into a due item only when they actually need the fuller
// Tracker/Measurements/Photos view behind it.
export default function HomeHub({
  dateLabel,
  name,
  mainGoal,
  plan,
  goalNote,
  goals,
  goalsMeta,
  upcoming,
  checkInStatus,
}: {
  dateLabel: string;
  name: string;
  /** The coach's headline goal for this client, written on the Plan tab. */
  mainGoal: string | null;
  /** The coach's phase timeline, when one exists; drives the plan rows. */
  plan: ClientPlanView | null;
  /** "11 weeks to goal", from the card's goal date. */
  goalNote: string | null;
  goals: GoalView[];
  /** "set Sep 3 · review Sep 20" */
  goalsMeta: string;
  upcoming: UpcomingMeeting;
  coachNotes: CoachNote[];
  checkInStatus: CheckInStatus;
}) {
  // Check-in is a full-screen pushed view owned by AppShell; a due row just
  // asks it to open on that row's section.
  const openCheckIn = useOpenCheckIn();

  return (
    <div className="home-dark">
      <div className="home-dark-datebar">{dateLabel}</div>
      {/* The header: name, then the one goal the coach has written for
          them. When the coach has drawn a phase timeline, one row per track
          sits under it: the phase running now, how far through it they
          are, and what follows. */}
      <div className="home-dark-headrow">
        <div className="home-dark-headmain">
          <div className="home-dark-name">{name}</div>
          <div className="home-dark-subrow">
            <span className={`home-dark-phase${mainGoal ? "" : " unset"}`}>
              {mainGoal ?? "Your coach hasn\u2019t set your main goal yet"}
            </span>
            {mainGoal && goalNote && <span className="home-dark-goal">{goalNote}</span>}
          </div>
        </div>
      </div>
      {plan && <PlanRows plan={plan} />}

      {/* The next call, when one is booked. No empty state: nothing booked
          is simply nothing here. */}
      {upcoming && (
        <div className="home-meeting-card">
          <div className="home-meeting-tile">
            <div className="home-meeting-tile-month">{upcoming.monthCap}</div>
            <div className="home-meeting-tile-day">{upcoming.dayNumber}</div>
          </div>
          <div className="home-meeting-card-body">
            <div className="home-meeting-eyebrow">Next with your coach</div>
            <div className="home-meeting-topic">{upcoming.topic}</div>
            <div className="home-meeting-when">
              {upcoming.whenLabel} · {upcoming.durationLabel}
            </div>
            {upcoming.link && (
              <a className={`home-meeting-join${upcoming.startingNow ? " live" : ""}`} href={upcoming.link} target="_blank" rel="noopener noreferrer">
                Join {upcoming.provider}
              </a>
            )}
          </div>
          <span className={`home-meeting-pill${upcoming.startingNow ? " live" : ""}`}>{upcoming.startingNow ? "Starting now" : upcoming.inLabel.toLowerCase()}</span>
        </div>
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

      {goals.length > 0 && (
        <section className="home-goals-card">
          <div className="home-goals-head">
            <span className="home-goals-title">Goals</span>
            {goalsMeta && <span className="home-goals-meta">{goalsMeta}</span>}
          </div>
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
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
