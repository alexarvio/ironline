"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarIcon, ChecklistIcon, ChevronDownIcon, ChevronLeftIcon, DumbbellIcon } from "../components/icons";
import { logMetricPeriodAction, saveMeasurementCheckInAction } from "../lib/actions";
import FitTitle from "./FitTitle";
import CheckInProgress, { type CheckInFeedDay, type CheckInHistory } from "./CheckInProgress";
import CheckInLine from "./CheckInLine";
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
};
export type CheckInSection = {
  id: "daily" | "weekly" | "measurements";
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
  sections: CheckInSection[];
  // Which segments still have no entry for their current period.
  dueSections: string[];
  /** The weekly check-in's window is open (from the coach's weekday to the week's end). */
  weeklyOpen: boolean;
  /** Every metric's readings, for Progress. */
  history: CheckInHistory;
  /** The coach's objectives for the lifestyle phase, as on its Home card. */
  objectives: string[];
  /** The hub's strip: check-in streak and workouts this month (active days come from the calendar). */
  stats: { streak: number; workoutsThisMonth: number };
  /** Every day something was done (training, food, check-ins), newest first, for the Calendar view. */
  calendar: ActivityDay[];
};

// The check-in under a photo banner (the Training and Nutrition banners'
// size), as a ledger: no card, a line a metric on the page (CheckInLine),
// today's first, then, while the weekly window is open, the week's metrics
// and the coach's measurements; the note to the coach last. The dock says
// how far in it is (TODAY, READY, SENT) and sends what changed, partial or
// not, to the same server actions as before: the daily and weekly metrics
// to logMetricPeriodAction, the measurements to saveMeasurementCheckInAction.

type RowSource = "daily" | "weekly" | "measurements";
type Row = { key: string; source: RowSource; metric: CheckInMetric };
type Group = { id: "morning" | "day" | "evening" | "week"; label: string; rows: Row[] };

// Today's lines by when in the day they're asked for (the coach's "Asked":
// metricAskAt): the morning, all day, the evening; then the week's.
const DAY_PARTS = [
  { id: "morning", label: "Morning", holds: ["morning"] },
  { id: "day", label: "All day", holds: ["anytime"] },
  { id: "evening", label: "Evening", holds: ["evening"] },
] as const;

function buildGroups(sections: CheckInSection[], weeklyOpen: boolean, weekLabel = "This week"): Group[] {
  const daily = sections.find((s) => s.id === "daily");
  const weekly = sections.find((s) => s.id === "weekly");
  const measure = sections.find((s) => s.id === "measurements");
  const rowsOf = (s: CheckInSection | undefined, source: RowSource): Row[] => (s?.metrics ?? []).map((m) => ({ key: `${source}${m.id}`, source, metric: m }));
  const groups: Group[] = [];
  const today = rowsOf(daily, "daily");
  for (const part of DAY_PARTS) {
    const rows = today.filter((r) => (part.holds as readonly string[]).includes(r.metric.askAt ?? "anytime"));
    if (rows.length) groups.push({ id: part.id, label: part.label, rows });
  }
  const week = weeklyOpen ? [...rowsOf(weekly, "weekly"), ...rowsOf(measure, "measurements")] : [];
  if (week.length) groups.push({ id: "week", label: weekLabel, rows: week });
  return groups;
}

// The one note goes with the first period on screen: the day's when there
// are daily metrics, else the week's, else the measurements'.
function noteOf(sections: CheckInSection[], rows: Row[]) {
  const source = rows[0]?.source ?? null;
  return { source, saved: (source && sections.find((s) => s.id === source)?.note) ?? "" };
}
const seedOf = (rows: Row[]) => Object.fromEntries(rows.map((r) => [r.key, r.metric.value]));

// "82.5", "82,5" and "82.50" are the same reading: the server stores the
// number, so comparing typed text against the persisted value numerically
// is what tells us whether anything has actually changed.
function sameNumber(a: string, b: string) {
  if (a === b) return true;
  if (a === "" || b === "") return false;
  return Number(a.replace(",", ".")) === Number(b.replace(",", "."));
}

export default function CheckInScreen({
  clientId,
  dateLabel,
  today,
  sections,
  weeklyOpen,
  history,
  objectives,
  stats,
  calendar,
  initialSection,
  onBack,
}: {
  clientId: number;
  dateLabel: string;
  today: string;
  sections: CheckInSection[];
  weeklyOpen: boolean;
  history: CheckInHistory;
  objectives: string[];
  stats: CheckInProps["stats"];
  calendar: ActivityDay[];
  initialSection: string;
  dueSections: string[];
  onBack: () => void;
}) {
  // A day from the feed being changed (its date), or null for today. While
  // one is open the ledger, the banner and the dock are that day's: its
  // lines (the daily ones, the weekly readings sent that day, the day's
  // measurements), sent to its own date. The server holds the same week.
  const [editing, setEditing] = useState<string | null>(null);
  const editDay = editing ? history.days.find((d) => d.date === editing && d.edit.length > 0) ?? null : null;
  const date = editDay?.date ?? today;
  const todayGroups = buildGroups(sections, weeklyOpen);
  const todayRows = todayGroups.flatMap((g) => g.rows);
  const groups = editDay ? buildGroups(editDay.edit, true, "That week") : todayGroups;
  const rows = groups.flatMap((g) => g.rows);
  const { source: noteSource, saved: savedNote } = noteOf(editDay?.edit ?? sections, rows);

  // Seeded from what's already logged for the current period, so reopening
  // the screen shows what was sent rather than blanking it out.
  const [values, setValues] = useState<Record<string, string>>(() => seedOf(rows));
  const [note, setNote] = useState(savedNote);
  const [pending, setPending] = useState(false);
  // Today (log it, and the week behind it) or Progress (a chart a metric).
  const [view, setView] = useState<"today" | "progress" | "calendar">("today");

  const noteDirty = note.trim() !== savedNote.trim();
  const filled = rows.filter((r) => (values[r.key] ?? "").length > 0);
  const complete = filled.length === rows.length && rows.length > 0;
  const remaining = rows.length - filled.length;

  // metric.value is what's actually persisted for this period, so comparing
  // the two tells us whether there's anything left to send. After a save the
  // server re-renders with the new values, so this settles on its own.
  const changedRow = (r: Row) => !sameNumber(values[r.key] ?? "", r.metric.value);
  const dirty = rows.some(changedRow) || noteDirty;
  const savedSomething = rows.some((r) => r.metric.value.length > 0);
  const isSaved = !dirty && savedSomething;
  // A note on its own is fine once the numbers are in; it just can't be the
  // only thing sent for a period with nothing logged.
  const canSave = dirty && (filled.length > 0 || (noteDirty && savedSomething));

  // The dock, on Today: TODAY while lines are empty, READY when all are in;
  // once what is on screen is what the coach has, just Done, which closes.
  // Sent and nothing changed since: the lines fold into the green done row
  // (with the last seven days under it). Opening a check-in sent in full
  // starts folded; one with lines still empty opens ready to type. Done
  // folds it with a short close; Edit opens it again.
  const [folded, setFolded] = useState(isSaved && complete);
  const [folding, setFolding] = useState(false);
  // Today's lines as they stood when a past day was opened (typed and not
  // sent yet, or folded), put back when it closes.
  const todayDraft = useRef<{ values: Record<string, string>; note: string; folded: boolean } | null>(null);
  // Back from a past day to the feed: today's lines as they were left.
  const closeDay = () => {
    const draft = todayDraft.current;
    todayDraft.current = null;
    setEditing(null);
    setValues(draft?.values ?? seedOf(todayRows));
    setNote(draft?.note ?? noteOf(sections, todayRows).saved);
    setFolded(draft?.folded ?? true);
  };
  const fold = () => {
    setFolding(true);
    setTimeout(() => {
      setFolding(false);
      if (editDay) closeDay();
      else setFolded(true);
      scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 280);
  };
  // A day in the feed opened to change or fill in: its lines as they were sent.
  const openDay = (d: CheckInFeedDay) => {
    const dayRows = buildGroups(d.edit, true).flatMap((g) => g.rows);
    if (!editDay) todayDraft.current = { values, note, folded };
    setEditing(d.date);
    setValues(seedOf(dayRows));
    setNote(noteOf(d.edit, dayRows).saved);
    setFolded(false);
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const dayLabel = (iso: string, long: boolean) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", long ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
  const docked = view === "today" && rows.length > 0 && !folded;
  const coach = useCoachIdentity();
  const coachFirst = coach?.name.trim().split(/\s+/)[0] || "your coach";

  // The typed lines in order, for Next on the keyboard.
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const typedKeys = rows.filter((r) => !r.metric.scaleMax).map((r) => r.key);
  const scroller = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  // The top row (back, Check-in, the count) stays put as the page scrolls:
  // over the photo at rest, on a frosted bar once the banner has gone by.
  const [stuck, setStuck] = useState(false);
  const onScroll = () => {
    const y = scroller.current?.scrollTop ?? 0;
    setStuck((s) => (s ? y > 48 : y > 72));
  };
  // The keyboard's height, from the visual viewport: the dock rides on it,
  // and the line being typed in is scrolled clear of the dock.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setKb(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => {
      vv.removeEventListener("resize", on);
      vv.removeEventListener("scroll", on);
    };
  }, []);
  const reveal = (el: HTMLElement) => {
    const box = scroller.current;
    const line = el.closest(".ci-line") as HTMLElement | null;
    if (!box || !line) return;
    const dockTop = dock.current?.getBoundingClientRect().top ?? box.getBoundingClientRect().bottom;
    const over = line.getBoundingClientRect().bottom + 16 - dockTop;
    if (over > 0) box.scrollTo({ top: box.scrollTop + over, behavior: "smooth" });
  };
  // The note grows with what is typed, up to six lines.
  const noteBox = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = noteBox.current;
    if (!el) return;
    el.style.height = "auto";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * 6 + 10)}px`;
  }, [note, view]);

  // Opened for the week (a coach's message about the weekly check-in): the
  // week's group, scrolled to once the screen is up.
  useEffect(() => {
    if (initialSection !== "weekly") return;
    const t = setTimeout(() => document.getElementById("ci-group-week")?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => clearTimeout(t);
  }, [initialSection]);

  const setValue = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || pending) return;
    setPending(true);
    try {
      // Each period is posted only when something in it changed, or when it
      // carries the note and the note changed.
      for (const source of ["daily", "weekly"] as const) {
        const mine = rows.filter((r) => r.source === source);
        const withNote = noteSource === source;
        if (mine.length === 0 || !(mine.some(changedRow) || (withNote && noteDirty))) continue;
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("date", date);
        fd.set("frequency", source);
        mine.forEach((r) => fd.set(`metric_${r.metric.id}`, values[r.key] ?? ""));
        fd.set("note", withNote ? note : (editDay?.edit ?? sections).find((s) => s.id === source)?.note ?? "");
        await logMetricPeriodAction(fd);
      }
      const measureRows = rows.filter((r) => r.source === "measurements");
      const noteWithMeasure = noteSource === "measurements";
      if (measureRows.length > 0 && (measureRows.some(changedRow) || (noteWithMeasure && noteDirty))) {
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("date", date);
        measureRows.forEach((r) => fd.set(`field_${r.metric.id}`, values[r.key] ?? ""));
        if (noteWithMeasure) fd.set("note", note);
        await saveMeasurementCheckInAction(fd);
      }
      // Sent, all of it or some: the lines fold into the day's row, which
      // says Completed or Unfinished.
      fold();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="ci-screen ci-one">
      {/* Room at the foot for the Save bar only while it shows. */}
      <div ref={scroller} className={`ci-scroll${docked ? " docked" : ""}`} onScroll={onScroll}>
        {/* The top row, sticky: over the photo at first, then a frosted bar. */}
        <div className={`ci-bar${stuck ? " stuck" : ""}`}>
          <button type="button" className="ci-back" onClick={editDay ? closeDay : onBack} aria-label={editDay ? "Back to the last 7 days" : "Back to home"}>
            <ChevronLeftIcon />
          </button>
          <h1 className="ci-title">Check-in</h1>
          <div className="ci-count" aria-label={`${filled.length} of ${rows.length} filled in`}>
            <span className={`ci-count-dot${complete ? " done" : ""}`} aria-hidden="true" />
            {filled.length}
            <span className="ci-count-total">/ {rows.length}</span>
          </div>
        </div>
        {/* The photo banner, the Training and Nutrition banners' size: the
            date, and two pills that switch the screen between Today and
            Progress. */}
        <header className="tr-banner ci-banner">
          <div className="tr-kicker">{editDay ? "Editing" : weeklyOpen ? "Daily · weekly" : "Daily"}</div>
          <FitTitle className="tr-name">{editDay ? dayLabel(editDay.date, true) : dateLabel}</FitTitle>
          <div className="tr-weeks ci-views" role="tablist" aria-label="Check-in">
            {(["today", "progress", "calendar"] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={`tr-wk${view === v ? " on" : ""}`} onClick={() => setView(v)}>
                {v === "today" ? "Today" : v === "progress" ? "Progress" : "Calendar"}
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
                // Two rows on one grid, so the columns line up: the titles, a
                // hairline, then the figures; every cell centred in its column.
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
          ) : rows.length === 0 ? (
            <p className="ci-empty">Your coach hasn&rsquo;t set up any check-in metrics yet.</p>
          ) : folded ? (
            <div className="ci-folded">
              {/* Sent: a row like a session on Training. All in: the light
                  green wash and Completed. Lines still empty: the amber of an
                  unfinished session and Unfinished. Edit opens it again. */}
              <button type="button" className={`tr-row ci-row ${complete ? "done" : "unfinished"}`} onClick={() => setFolded(false)} aria-label={`${dateLabel}: ${complete ? "completed" : "unfinished"}, ${filled.length} of ${rows.length} logged. Open to edit`}>
                <span className="tr-row-main">
                  <span className="tr-row-title">{dateLabel}</span>
                  <span className="tr-row-sub">
                    {filled.length} of {rows.length} logged
                  </span>
                </span>
                <span className={`tr-row-pill ${complete ? "done" : "unfinished"}`} role="status" aria-live="polite">
                  {complete ? "Completed" : "Unfinished"}
                </span>
                <span className="tr-row-chev" aria-hidden="true" />
              </button>
              <CheckInFeed days={history.days} onEdit={openDay} />
            </div>
          ) : (
            <>
              <form id="ci-form" className={`ci-ledger${folding ? " folding" : ""}`} onSubmit={save} onFocus={(e) => reveal(e.target as HTMLElement)}>
                {/* The lifestyle phase's objectives, as a line like the rest
                    (today's only: a past day is just its lines). */}
                {!editDay && <PhaseObjectives coachName={coachFirst} objectives={objectives} variant="line" />}
                {groups.map((g) => (
                  <section key={g.id} id={`ci-group-${g.id}`} className="ci-group">
                    {/* A heading a part of the day, and the week's, once there's more than
                        one group on screen. */}
                    {groups.length > 1 && <h2 className="ci-group-label">{g.label}</h2>}
                    {g.rows.map((r) => {
                      const t = typedKeys.indexOf(r.key);
                      return (
                        <CheckInLine
                          key={r.key}
                          ref={(el) => {
                            if (t >= 0) inputs.current[t] = el;
                          }}
                          metric={r.metric}
                          value={values[r.key] ?? ""}
                          today={date}
                          weekly={r.source === "weekly"}
                          lastTyped={t === typedKeys.length - 1}
                          onChange={(v) => setValue(r.key, v)}
                          onNext={() => inputs.current[t + 1]?.focus()}
                        />
                      );
                    })}
                  </section>
                ))}

                <label className="ci-note">
                  <span className="ci-label">Note for {coachFirst}</span>
                  <textarea ref={noteBox} value={note} onChange={(e) => setNote(e.target.value)} placeholder={editDay ? "Anything worth knowing about that day?" : "Anything worth knowing today?"} maxLength={500} rows={2} />
                </label>
              </form>
              {/* Today not sent yet: the last seven days under its lines all the
                  same, to change or fill in (not while a past day is open). */}
              {!editDay && <CheckInFeed days={history.days} onEdit={openDay} />}
            </>
          )}
        </div>
      </div>

      {docked && (
        <div ref={dock} className="ci-dock ci-dock-ledger" style={kb ? { bottom: kb } : undefined}>
          {/* Sent: just Done on the right (the empty text keeps it there). */}
          <div className="ci-dock-text">
            {!isSaved && (
              <>
                <div className="ci-dock-kicker">{complete ? "Ready" : editDay ? dayLabel(editDay.date, false) : "Today"}</div>
                <div className="ci-dock-sub">{complete ? "Everything filled in" : `${remaining} still to fill`}</div>
              </>
            )}
          </div>
          {isSaved ? (
            <button type="button" className="ci-send done" onClick={fold} disabled={folding}>
              Done
            </button>
          ) : (
            <button type="submit" form="ci-form" className="ci-send" disabled={!canSave || pending}>
              {pending ? "Sending…" : "Send"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// The seven days before today, newest first: a green row a day something was
// logged (tap to see what), a plain one a day nothing was. Under what was
// logged, Edit opens the day's lines in the ledger to change them; a day
// with nothing logged opens them straight away to fill in. A day's check-in
// stays the client's for as long as it is in this list.
function CheckInFeed({ days, onEdit }: { days: CheckInFeedDay[]; onEdit: (d: CheckInFeedDay) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (days.length === 0) return null;
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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
