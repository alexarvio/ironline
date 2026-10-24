"use client";

import { useEffect, useRef, useState } from "react";
import PictureCycle from "./PictureCycle";
import { CalendarIcon, ChecklistIcon, ChevronDownIcon, ChevronLeftIcon, DumbbellIcon } from "../components/icons";
import FitTitle from "./FitTitle";
import CheckInProgress, { type CheckInFeedDay, type CheckInHistory } from "./CheckInProgress";
import CheckInDialog, { buildGroups, dayLabel, type CheckInForm } from "./CheckInDialog";
import PhaseObjectives from "./PhaseObjectives";
import CoachCard from "./CoachCard";
import { useCoachIdentity } from "./CheckInContext";
import ActivityCalendar, { type ActivityDay } from "./ActivityCalendar";
import { landOnSoon } from "../lib/landOn";

// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx for why
// a "use client" file importing queries.ts breaks the dev server). All data
// comes in as plain props, computed server-side by getCheckInSections().

export type CheckInMetric = {
  id: string;
  name: string;
  unit: string;
  step: string;
  value: string;
  hint: string | null;
  scaleMax: number | null;
  /** The last reading before this period, and the day it was for. */
  last: { value: number; period: string } | null;
  /** When this period's reading was saved (ISO), if it was. */
  loggedAt: string | null;
  /** When in the day it is asked for (metricAskAt). */
  askAt?: "morning" | "anytime" | "evening";
  /** The metric's group, for its colour on the pop-up. */
  category?: string;
};
export type CheckInSection = {
  id: "daily" | "weekly" | "monthly" | "measurements";
  label: string;
  intro: string;
  /** The client's note for this period, if they wrote one. */
  note: string | null;
  metrics: CheckInMetric[];
};
// Everything the screen needs, computed server-side by getCheckInSections()
// and handed down through AppShell. Progress pictures have their own screen.
export type CheckInProps = {
  dateLabel: string;
  today: string;
  /** The client's own lifestyle pictures (14 Oct), taking turns behind the banner. */
  pictures?: string[];
  sections: CheckInSection[];
  // Which segments still have no entry for their current period.
  dueSections: string[];
  /** The weekly check-in's window is open (from the coach's weekday to the week's end). */
  weeklyOpen: boolean;
  /** The monthly one's: from the coach's day of the month to the month's end. */
  monthlyOpen: boolean;
  /** Every metric's readings, for Progress. */
  history: CheckInHistory;
  /** The coach's objectives for the lifestyle phase, as on its Home card. */
  objectives: string[];
  /** The coach's note on the lifestyle phase (21 Oct), as Training shows its own; null when none. */
  coachNote?: { text: string; date: string | null } | null;
  /** The hub's strip: check-in streak and workouts this month (active days come from the calendar). */
  stats: { streak: number; workoutsThisMonth: number };
  /** Every day something was done (training, food, check-ins), newest first, for the Calendar view. */
  calendar: ActivityDay[];
};

// The check-in under a photo banner (13 Oct, Alex): no ledger on the page
// any more. Today is a row like the days under it, "Tue, Oct 13 · 5 still
// to fill" with Fill in (or Edit once it is in); the last seven days sit
// under it, each with Fill in or Edit. Any of those opens the day's lines
// in a centred pop-up (CheckInDialog), which saves and folds away, and the
// screen stays where it was. Progress and Calendar are as before.

export default function CheckInScreen({
  clientId,
  dateLabel,
  today,
  sections,
  weeklyOpen,
  monthlyOpen,
  history,
  objectives,
  coachNote = null,
  stats,
  calendar,
  initialSection,
  focusPeriod = null,
  pictures,
  onBack,
}: {
  /** The day, week or month a coach's message is about (with initialSection its kind): it opens there in the feed. */
  focusPeriod?: string | null;
  clientId: number;
  dateLabel: string;
  today: string;
  sections: CheckInSection[];
  weeklyOpen: boolean;
  monthlyOpen: boolean;
  history: CheckInHistory;
  objectives: string[];
  coachNote?: CheckInProps["coachNote"];
  stats: CheckInProps["stats"];
  calendar: ActivityDay[];
  initialSection: string;
  dueSections: string[];
  pictures?: string[];
  onBack: () => void;
}) {
  const todayRows = buildGroups(sections, weeklyOpen, monthlyOpen).flatMap((g) => g.rows);
  const filled = todayRows.filter((r) => r.metric.value.length > 0);
  const complete = filled.length === todayRows.length && todayRows.length > 0;
  const remaining = todayRows.length - filled.length;
  // Today (the rows), Progress (a chart a metric) or Calendar; Home's
  // lifestyle card opens straight onto the last two.
  // A link to a day, week or month (24 Oct, Alex: only the last 7 days landed, weekly and monthly alike): the feed's day
  // when it is there, else the Calendar opened on it.
  const feedFocus = focusDay(history.days, initialSection, focusPeriod);
  const calendarFocus = !feedFocus && focusPeriod ? calendarDay(calendar, initialSection, focusPeriod, today) : null;
  const [view, setView] = useState<"today" | "progress" | "calendar">(calendarFocus ? "calendar" : initialSection === "progress" || initialSection === "calendar" ? initialSection : "today");
  // The day open in the pop-up, if any.
  const [open, setOpen] = useState<CheckInForm | null>(null);
  const openToday = () => setOpen({ date: today, sections, weeklyOpen, monthlyOpen });
  const openDay = (d: CheckInFeedDay) => setOpen({ date: d.date, sections: d.edit, weeklyOpen: true, monthlyOpen: true, weekLabel: "That week", monthLabel: "That month" });
  const coach = useCoachIdentity();
  const coachFirst = coach?.name.trim().split(/\s+/)[0] || "your coach";
  const [stuck, setStuck] = useState(false);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    setStuck((s) => (s ? y > 48 : y > 72));
  };

  // Nothing to check in and nothing ever logged (17 Oct, Alex): the screen is bare like Training and
  // Nutrition with no phase: a black-and-white banner, "Your lifestyle", one line. Past readings, from an
  // earlier lifestyle phase, keep the full screen so they can still be seen.
  const hasPast = history.series.some((s) => s.points.length > 0) || history.days.some((d) => d.items.length > 0);
  if (todayRows.length === 0 && !hasPast) {
    return (
      <div className="ci-screen ci-one ci-naked">
        <div className="ci-scroll">
          <div className="ci-bar">
            <button type="button" className="ci-back" onClick={onBack} aria-label="Back to home">
              <ChevronLeftIcon />
            </button>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
          <header className="tr-banner ci-banner ci-naked-banner">
            {pictures && pictures.length > 0 && <PictureCycle pictures={pictures} className="tr-banner-pic" />}
            <div className="tr-kicker">Lifestyle</div>
            <FitTitle className="tr-name">Your lifestyle</FitTitle>
          </header>
          <div className="tr-body">
            {/* The coach's note reaches the client even before anything is asked (21 Oct): "Read it" lands here. */}
            <CoachCard flat coachName={coachFirst} photoPath={coach?.photoPath ?? null} note={coachNote?.text ?? null} noteDate={coachNote?.date ?? null} />
            {/* "No plan yet" only when nothing is asked at all: a weekly-only phase before its day has a plan (22 Oct). */}
            {sections.every((s) => s.metrics.length === 0) && <p className="empty-note">No plan yet</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ci-screen ci-one">
      <div className="ci-scroll" onScroll={onScroll}>
        {/* The top row, sticky: over the photo at first, then a frosted bar. */}
        <div className={`ci-bar${stuck ? " stuck" : ""}`}>
          <button type="button" className="ci-back" onClick={onBack} aria-label="Back to home">
            <ChevronLeftIcon />
          </button>
          <h1 className="ci-title">Check-in</h1>
          <div className="ci-count" aria-label={`${filled.length} of ${todayRows.length} filled in`}>
            <span className={`ci-count-dot${complete ? " done" : ""}`} aria-hidden="true" />
            {filled.length}
            <span className="ci-count-total">/ {todayRows.length}</span>
          </div>
        </div>
        {/* The photo banner, the Training and Nutrition banners' size: the
            date, and the pills that switch between Entries, Progress and Calendar. */}
        {/* One height on all three views (23 Oct, Alex: the photo jumped as Progress made it taller). */}
        <header className="tr-banner ci-banner">
          {pictures && pictures.length > 0 && <PictureCycle pictures={pictures} className="tr-banner-pic" />}
          <div className="tr-kicker">{["Daily", weeklyOpen ? "weekly" : null, monthlyOpen && sections.some((s) => s.id === "monthly") ? "monthly" : null].filter(Boolean).join(" · ")}</div>
          <FitTitle className="tr-name">{dateLabel}</FitTitle>
          <div className="tr-weeks ci-views" role="tablist" aria-label="Check-in">
            {(["today", "progress", "calendar"] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={`tr-wk${view === v ? " on" : ""}`} onClick={() => setView(v)}>
                {v === "today" ? "Entries" : v === "progress" ? "Progress" : "Calendar"}
              </button>
            ))}
          </div>
        </header>

        <div className="ci-body">
          {/* The hub's strip (28 Sep): how it is going, at a glance. */}
          {view !== "progress" && (
            <div className="ci-stats" role="list">
              {(() => {
                const month = today.slice(0, 7);
                const monthName = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { month: "long" });
                const active = calendar.filter((d) => d.date.startsWith(month)).length;
                const tiles = [
                  { key: "streak", icon: <ChecklistIcon />, label: "Streak", value: String(stats.streak), unit: null, sub: stats.streak === 1 ? "day" : "days" },
                  { key: "workouts", icon: <DumbbellIcon />, label: "Workouts", value: String(stats.workoutsThisMonth), unit: null, sub: `in ${monthName}` },
                  { key: "active", icon: <CalendarIcon />, label: "Active", value: String(active), unit: active === 1 ? "day" : "days", sub: `of ${Number(today.slice(8, 10))} so far` },
                ];
                return (
                  <>
                    {tiles.map((t) => (
                      <span key={`l${t.key}`} className={`ci-stat-label ${t.key}`} aria-hidden="true">
                        <span className="ci-stat-icon">{t.icon}</span>
                        {t.label}
                      </span>
                    ))}
                    {tiles.map((t) => (
                      <div key={t.key} className={`ci-stat ${t.key}`} role="listitem" aria-label={`${t.label}: ${t.value}${t.unit ?? ""}${t.sub ? ` ${t.sub}` : ""}`}>
                        <b>
                          {t.value}
                          {t.unit && <small>{t.unit}</small>}
                        </b>
                        {t.sub && <span className="ci-stat-sub">{t.sub}</span>}
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          )}
          {view === "calendar" ? (
            <ActivityCalendar days={calendar} today={today} initialDay={calendarFocus} />
          ) : view === "progress" ? (
            <CheckInProgress history={history} today={today} />
          ) : todayRows.length === 0 ? (
            <>
              {/* Nothing to fill in today (a weekly-only phase, say): the goals and the coach's note still show (21 Oct). */}
              <PhaseObjectives coachName={coachFirst} objectives={objectives} variant="line" />
              <CoachCard flat coachName={coachFirst} photoPath={coach?.photoPath ?? null} note={coachNote?.text ?? null} noteDate={coachNote?.date ?? null} />
              <p className="ci-empty">Your coach hasn&rsquo;t set up any check-in metrics yet.</p>
            </>
          ) : (
            <>
              <PhaseObjectives coachName={coachFirst} objectives={objectives} variant="line" />
              {/* The coach's note on this phase, under the goals, as on Training (21 Oct). */}
              <CoachCard flat coachName={coachFirst} photoPath={coach?.photoPath ?? null} note={coachNote?.text ?? null} noteDate={coachNote?.date ?? null} />
              {/* Today, as one row: the date, what is still to fill, and the way in. */}
              <section className="ci-feed ci-today" aria-label="Today">
                <h2 className="ci-feed-title">Today</h2>
                <div className={`ci-day${complete ? " done" : filled.length > 0 ? " done unfinished" : ""}`}>
                  <button type="button" className="ci-day-head" onClick={openToday} aria-label={`${dayLabel(today)}: ${complete ? "everything filled in" : `${remaining} still to fill`}. ${filled.length > 0 ? "Edit" : "Fill in"}`}>
                    <span className="ci-day-text">
                      <span className="ci-day-date">{dayLabel(today)}</span>
                      <span className="ci-day-sub">{complete ? `${filled.length} of ${todayRows.length} logged` : filled.length > 0 ? `${remaining} still to fill` : `${todayRows.length} to fill in`}</span>
                    </span>
                    <span className="ci-day-fill">{filled.length > 0 ? "Edit" : "Fill in"}</span>
                  </button>
                </div>
              </section>
              <CheckInFeed days={history.days} onEdit={openDay} focus={feedFocus} />
            </>
          )}
        </div>
      </div>
      {open && <CheckInDialog clientId={clientId} form={open} today={today} coachName={coachFirst} onClose={() => setOpen(null)} />}
    </div>
  );
}

// The seven days before today, newest first: a green row a day something was
// logged (tap to see what), a plain one a day nothing was. Under what was
// logged, Edit opens the day's lines in the pop-up to change them; a day
// with nothing logged opens them straight away to fill in. A day's check-in
// stays the client's for as long as it is in this list.
/**
 * The day a coach's message is about (21 Oct: a link to "Weekly check-in · week
 * of 13/10" opened the check-in at its top): that day, or the newest day with
 * something logged in that week or month, while it is still in the feed.
 */
function focusDay(days: CheckInFeedDay[], section: string, period: string | null | undefined): string | null {
  if (!period) return null;
  const end = section === "weekly" ? isoPlus(period, 6) : section === "monthly" ? `${period.slice(0, 7)}-31` : period;
  const from = section === "monthly" ? `${period.slice(0, 7)}-01` : period;
  const inside = days.filter((d) => d.date >= from && d.date <= end);
  return (inside.find((d) => d.items.length > 0) ?? (section === "daily" ? inside[0] : null))?.date ?? null;
}
/** The day a link opens on the Calendar when the feed doesn't hold it: the newest day with something logged in that day,
    week or month, else its first day (never past today). */
function calendarDay(days: { date: string; sessions: unknown[]; food: unknown; checkIns: string[] }[], section: string, period: string, today: string): string {
  const end = section === "weekly" ? isoPlus(period, 6) : section === "monthly" ? `${period.slice(0, 7)}-31` : period;
  const from = section === "monthly" ? `${period.slice(0, 7)}-01` : period;
  const logged = days.filter((d) => d.date >= from && d.date <= end && (d.checkIns.length > 0 || d.sessions.length > 0 || d.food != null)).map((d) => d.date).sort();
  const day = logged[logged.length - 1] ?? from;
  return day > today ? today : day;
}
const isoPlus = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function CheckInFeed({ days, onEdit, focus = null }: { days: CheckInFeedDay[]; onEdit: (d: CheckInFeedDay) => void; /** Opened on this day and scrolled to it: a link from the chat. */ focus?: string | null }) {
  const [open, setOpen] = useState<string | null>(focus);
  const list = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focus) return;
    // Brought to the middle and lit (24 Oct, Alex: a link lands on its thing).
    return landOnSoon(() => list.current?.querySelector(`[data-day="${focus}"]`), "center", 120);
  }, [focus]);
  if (days.length === 0) return null;
  const label = (iso: string) => dayLabel(iso);
  return (
    <section ref={list} className="ci-feed" aria-label="The last seven days">
      <h2 className="ci-feed-title">Last 7 days</h2>
      {days.map((d) => {
        const done = d.items.length > 0;
        const unfinished = done && d.dailyTotal > 0 && d.dailyDone < d.dailyTotal;
        const isOpen = open === d.date;
        const fillable = !done && d.edit.length > 0;
        return (
          <div key={d.date} data-day={d.date} className={`ci-day${done ? " done" : ""}${unfinished ? " unfinished" : ""}`}>
            <button
              type="button"
              className="ci-day-head"
              disabled={!done && !fillable}
              aria-expanded={done ? isOpen : undefined}
              aria-label={fillable ? `${label(d.date)}: nothing logged. Fill in` : undefined}
              onClick={() => (done ? setOpen(isOpen ? null : d.date) : onEdit(d))}
            >
              <span className="ci-day-text">
                <span className="ci-day-date">{label(d.date)}</span>
                <span className="ci-day-sub">{done ? `${d.items.length} logged` : "Nothing logged"}</span>
              </span>
              {unfinished && <span className="ci-day-state">Unfinished</span>}
              {fillable && <span className="ci-day-fill">Fill in</span>}
              {done && (
                <span className={`ci-day-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              )}
            </button>
            {done && (
              <div className={`ci-day-body${isOpen ? " open" : ""}`}>
                <div className="ci-day-clip">
                  <div className="ci-day-list">
                    {d.items.map((it, i) => (
                      <div key={`${it.name}-${i}`} className="ci-day-row">
                        <span>{it.name}</span>
                        <b>{it.value}</b>
                      </div>
                    ))}
                    {d.note && <p className="ci-day-note">&ldquo;{d.note}&rdquo;</p>}
                    {d.edit.length > 0 && (
                      <button type="button" className="ci-day-edit" onClick={() => onEdit(d)} tabIndex={isOpen ? 0 : -1} aria-label={`Edit ${label(d.date)}`}>
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
