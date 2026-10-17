"use client";

import { useState } from "react";
import PictureCycle from "./PictureCycle";
import { CalendarIcon, ChecklistIcon, ChevronDownIcon, ChevronLeftIcon, DumbbellIcon } from "../components/icons";
import FitTitle from "./FitTitle";
import CheckInProgress, { type CheckInFeedDay, type CheckInHistory } from "./CheckInProgress";
import CheckInDialog, { buildGroups, dayLabel, type CheckInForm } from "./CheckInDialog";
import PhaseObjectives from "./PhaseObjectives";
import { useCoachIdentity } from "./CheckInContext";
import ActivityCalendar, { type ActivityDay } from "./ActivityCalendar";

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
  stats,
  calendar,
  initialSection,
  pictures,
  onBack,
}: {
  clientId: number;
  dateLabel: string;
  today: string;
  sections: CheckInSection[];
  weeklyOpen: boolean;
  monthlyOpen: boolean;
  history: CheckInHistory;
  objectives: string[];
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
  const [view, setView] = useState<"today" | "progress" | "calendar">(initialSection === "progress" || initialSection === "calendar" ? initialSection : "today");
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
            <p className="empty-note">Your phase will be deployed soon.</p>
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
        <header className={`tr-banner ci-banner${view === "progress" ? " progress" : ""}`}>
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
            <ActivityCalendar days={calendar} today={today} />
          ) : view === "progress" ? (
            <CheckInProgress history={history} today={today} />
          ) : todayRows.length === 0 ? (
            <p className="ci-empty">Your coach hasn&rsquo;t set up any check-in metrics yet.</p>
          ) : (
            <>
              <PhaseObjectives coachName={coachFirst} objectives={objectives} variant="line" />
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
              <CheckInFeed days={history.days} onEdit={openDay} />
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
function CheckInFeed({ days, onEdit }: { days: CheckInFeedDay[]; onEdit: (d: CheckInFeedDay) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (days.length === 0) return null;
  const label = (iso: string) => dayLabel(iso);
  return (
    <section className="ci-feed" aria-label="The last seven days">
      <h2 className="ci-feed-title">Last 7 days</h2>
      {days.map((d) => {
        const done = d.items.length > 0;
        const unfinished = done && d.dailyTotal > 0 && d.dailyDone < d.dailyTotal;
        const isOpen = open === d.date;
        const fillable = !done && d.edit.length > 0;
        return (
          <div key={d.date} className={`ci-day${done ? " done" : ""}${unfinished ? " unfinished" : ""}`}>
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
                    {d.items.map((it) => (
                      <div key={it.name} className="ci-day-row">
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
