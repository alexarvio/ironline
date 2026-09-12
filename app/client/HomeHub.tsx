"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarIcon, CheckIcon, ChevronDownIcon } from "../components/icons";
import GoalRow from "../components/GoalRow";
import { useNavigateTab, useOpenCheckIn } from "./CheckInContext";

// Deliberately does NOT import from ../lib/queries (see the note in the old
// CheckInHub.tsx this replaces — a "use client" file importing queries.ts
// breaks the dev server at runtime). All data comes in as plain props,
// computed server-side in page.tsx. The types below mirror the ones there.

export type CheckInStatus = {
  configuredCount: number;
  dueTypes: ("daily" | "weekly" | "measurements")[];
  dueNames: string;
  nextLabel: string;
};

/** One track of the coach's plan, flattened for the profile card. */
export type HomeTrack = {
  track: "nutrition" | "training" | "lifestyle";
  /** "Nutrition" — the chip and tag text. */
  label: string;
  phaseName: string;
  /** "2 weeks to go", or "Starts in 3 weeks" before it begins. */
  timeLeft: string;
  weekNow: number;
  weekTotal: number;
  /** 0..1 for the bar. */
  progress: number;
  upNext: string | null;
};

export type HomeSession = {
  dayId: number;
  name: string;
  exercises: number;
  sets: number;
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

// Home is the client's landing screen: who they are and where they are in
// the plan, then the one thing to do now, then what is coming.
export default function HomeHub({
  dateLabel,
  firstName,
  photoUrl,
  initial,
  mainGoal,
  tracks,
  session,
  goals,
  goalsMeta,
  upcoming,
  recap,
  checkInStatus,
}: {
  dateLabel: string;
  firstName: string;
  /** Null until client profile photos land; the initial stands in. */
  photoUrl: string | null;
  initial: string;
  mainGoal: string | null;
  tracks: HomeTrack[];
  session: HomeSession;
  goals: GoalRowView[];
  goalsMeta: string;
  upcoming: UpcomingMeeting;
  recap: MeetingRecap;
  checkInStatus: CheckInStatus;
}) {
  return (
    <div className="hm">
      <ProfileCard
        dateLabel={dateLabel}
        firstName={firstName}
        photoUrl={photoUrl}
        initial={initial}
        mainGoal={mainGoal}
        tracks={tracks}
      />
      <TodayCard session={session} checkInStatus={checkInStatus} hasPlan={tracks.length > 0} />
      <MeetingCard m={upcoming} recap={recap} />
      {goals.length > 0 && <GoalsCard goals={goals} meta={goalsMeta} />}
      <div className="hm-reserved">
        <span className="hm-eyebrow hm-reserved-label">Reserved</span>
      </div>
    </div>
  );
}

// ---- 1 · Profile card ----------------------------------------------------
// Collapsed it still says all three tracks are being managed, because that
// is the point of showing them at all; expanded it gives each one its own
// row. Anything longer than a phrase lives behind the chevron.

function ProfileCard({
  dateLabel,
  firstName,
  photoUrl,
  initial,
  mainGoal,
  tracks,
}: {
  dateLabel: string;
  firstName: string;
  photoUrl: string | null;
  initial: string;
  mainGoal: string | null;
  tracks: HomeTrack[];
}) {
  const [open, setOpen] = useState(false);
  const canExpand = tracks.length > 0;

  return (
    <section className="hm-card hm-profile">
      <div className="hm-profile-row">
        {photoUrl ? (
          <Image src={photoUrl} alt="" width={44} height={44} className="hm-avatar-img" />
        ) : (
          <span className="hm-avatar" aria-hidden="true">
            {initial}
          </span>
        )}
        <div className="hm-profile-main">
          <div className="hm-eyebrow">{dateLabel}</div>
          <div className="hm-name">{firstName}</div>
        </div>
        {canExpand && (
          <button
            type="button"
            className={`hm-chev-btn${open ? " open" : ""}`}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Hide the plan" : "Show the plan"}
          >
            <ChevronDownIcon />
          </button>
        )}
      </div>

      <p className={`hm-maingoal${mainGoal ? "" : " unset"}`}>
        {mainGoal ?? "Your coach hasn’t set your main goal yet"}
      </p>

      {canExpand && open && (
        <div className="hm-tracks">
          {tracks.map((t) => (
            <div key={t.track} className="hm-track">
              <div className="hm-track-head">
                <span className={`hm-chip ${t.track}`}>{t.label}</span>
                <span className="hm-track-name">{t.phaseName}</span>
                <span className={`hm-track-left ${t.track}`}>{t.timeLeft}</span>
              </div>
              <div className={`hm-track-bar ${t.track}`}>
                <div className="hm-track-bar-fill" style={{ width: `${Math.round(t.progress * 100)}%` }} />
              </div>
              <div className="hm-track-foot">
                <span>
                  Week <b>{t.weekNow}</b> of <b>{t.weekTotal}</b>
                </span>
                {t.upNext && (
                  <span>
                    Up next · <b>{t.upNext}</b>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- 2 · Today -----------------------------------------------------------
// The only navy card on the screen, because it is the only one that asks
// for something. A session is never titled by a weekday: the client trains
// it when they can, so "Tuesday" would be wrong by Wednesday.

function TodayCard({
  session,
  checkInStatus,
  hasPlan,
}: {
  session: HomeSession;
  checkInStatus: CheckInStatus;
  hasPlan: boolean;
}) {
  const openCheckIn = useOpenCheckIn();
  const goToTab = useNavigateTab();
  const dueCount = checkInStatus.dueTypes.length;
  const hasCheckIns = checkInStatus.configuredCount > 0;
  if (!session && !hasCheckIns && !hasPlan) return null;

  return (
    <section className="hm-today">
      <div className="hm-today-top">
        <span className="hm-eyebrow hm-today-eyebrow">Up next</span>
      </div>

      {session ? (
        <button type="button" className="hm-session" onClick={() => goToTab?.("training", session.dayId)}>
          <span className="hm-session-body">
            <span className="hm-session-name">{session.name}</span>
            <span className="hm-session-meta">
              {session.exercises} exercise{session.exercises === 1 ? "" : "s"} · {session.sets} sets
            </span>
          </span>
          <span className="hm-session-start">Start</span>
        </button>
      ) : (
        <p className="hm-session-empty">No session left this week</p>
      )}

      {hasCheckIns && (
        <button
          type="button"
          className="hm-checkin"
          onClick={() => openCheckIn?.(checkInStatus.dueTypes[0] ?? "daily")}
        >
          {dueCount > 0 ? (
            <span className="hm-checkin-dot" aria-hidden="true" />
          ) : (
            <span className="hm-checkin-tick" aria-hidden="true">
              <CheckIcon />
            </span>
          )}
          <span className="hm-checkin-body">
            <span className="hm-checkin-title">
              {dueCount > 0
                ? `${dueCount} check-in${dueCount === 1 ? "" : "s"} due`
                : "All check-ins done"}
            </span>
          </span>
          <span className="hm-checkin-chev" aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>
      )}
    </section>
  );
}

// ---- 3 · Next meeting ----------------------------------------------------

// The next call, and under it what the last one settled. The recap is the
// coach's own words to the client, so it is always visible rather than
// hidden behind the chevron. With nothing booked the card still stands,
// with a calendar in place of the date leaf, so a new client sees the slot
// their coach will fill rather than a gap.
function MeetingCard({ m, recap }: { m: UpcomingMeeting; recap: MeetingRecap }) {
  const [open, setOpen] = useState(false);
  // Nothing to reveal without a link: no chevron, no expanded half.
  const canExpand = !!m?.link;
  return (
    <section className="hm-card hm-meeting">
      {!m && (
        <div className="hm-meeting-row">
          <span className="hm-leaf hm-leaf-empty" aria-hidden="true">
            <CalendarIcon />
          </span>
          <div className="hm-meeting-main">
            <div className="hm-meeting-top">
              <span className="hm-eyebrow">Next with your coach</span>
            </div>
            <div className="hm-meeting-topic muted">Nothing booked yet</div>
            <div className="hm-meeting-when">Your coach sets the next call.</div>
          </div>
        </div>
      )}
      {m && (
      <div className="hm-meeting-row">
        <span className="hm-leaf" aria-hidden="true">
          <span className="hm-leaf-month">{m.monthCap}</span>
          <span className="hm-leaf-day">{m.dayNumber}</span>
          <span className="hm-leaf-weekday">{m.weekdayCap}</span>
        </span>
        <div className="hm-meeting-main">
          <div className="hm-meeting-top">
            <span className="hm-eyebrow">Next with your coach</span>
            <span className={`hm-meeting-pill${m.startingNow ? " live" : ""}`}>
              {m.startingNow ? "Starting now" : m.inLabel}
            </span>
          </div>
          <div className="hm-meeting-topic">{m.topic}</div>
          <div className="hm-meeting-when">{m.whenLabel}</div>
        </div>
        {canExpand && (
          <button
            type="button"
            className={`hm-chev-btn${open ? " open" : ""}`}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Hide the call link" : "Show the call link"}
          >
            <ChevronDownIcon />
          </button>
        )}
      </div>
      )}

      {canExpand && open && (
        <div className="hm-meeting-more">
          <a className="hm-join" href={m!.link!} target="_blank" rel="noopener noreferrer">
            Join call
          </a>
        </div>
      )}

      {recap && (
        <div className={`hm-recap${m ? " attached" : ""}`}>
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

// ---- 4 · Goals -----------------------------------------------------------

function GoalsCard({ goals, meta }: { goals: GoalRowView[]; meta: string }) {
  return (
    <section className="hm-card hm-goals">
      <div className="hm-goals-head">
        <span className="hm-eyebrow">Current goals</span>
        {meta && <span className="hm-goals-meta">{meta}</span>}
      </div>
      {goals.map((g) => (
        <GoalRow key={g.id} goal={g} />
      ))}
    </section>
  );
}
