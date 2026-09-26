"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon } from "../components/icons";
import { logMetricPeriodAction, saveMeasurementCheckInAction } from "../lib/actions";
import FitTitle from "./FitTitle";
import CheckInProgress, { type CheckInFeedDay, type CheckInHistory } from "./CheckInProgress";
import CheckInLine from "./CheckInLine";
import PhaseObjectives from "./PhaseObjectives";
import { useCoachIdentity } from "./CheckInContext";

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
type Group = { id: "today" | "week"; label: string; rows: Row[] };

function buildGroups(sections: CheckInSection[], weeklyOpen: boolean): Group[] {
  const daily = sections.find((s) => s.id === "daily");
  const weekly = sections.find((s) => s.id === "weekly");
  const measure = sections.find((s) => s.id === "measurements");
  const rowsOf = (s: CheckInSection | undefined, source: RowSource): Row[] => (s?.metrics ?? []).map((m) => ({ key: `${source}${m.id}`, source, metric: m }));
  const groups: Group[] = [];
  const today = rowsOf(daily, "daily");
  if (today.length) groups.push({ id: "today", label: "Today", rows: today });
  const week = weeklyOpen ? [...rowsOf(weekly, "weekly"), ...rowsOf(measure, "measurements")] : [];
  if (week.length) groups.push({ id: "week", label: "This week", rows: week });
  return groups;
}

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
  initialSection: string;
  dueSections: string[];
  onBack: () => void;
}) {
  const groups = buildGroups(sections, weeklyOpen);
  const rows = groups.flatMap((g) => g.rows);
  // The one note goes with the first period on screen: today's when there
  // are daily metrics, else the week's, else the measurements'.
  const noteSource: RowSource | null = rows[0]?.source ?? null;
  const savedNote = (noteSource && sections.find((s) => s.id === noteSource)?.note) ?? "";

  // Seeded from what's already logged for the current period, so reopening
  // the screen shows what was sent rather than blanking it out.
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.key, r.metric.value])));
  const [note, setNote] = useState(savedNote);
  const [pending, setPending] = useState(false);
  // Today (log it, and the week behind it) or Progress (a chart a metric).
  const [view, setView] = useState<"today" | "progress">("today");

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
  const fold = () => {
    setFolding(true);
    setTimeout(() => {
      setFolding(false);
      setFolded(true);
      scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 280);
  };
  const docked = view === "today" && rows.length > 0 && !folded;
  const coach = useCoachIdentity();
  const coachFirst = coach?.name.trim().split(/\s+/)[0] || "your coach";

  // The typed lines in order, for Next on the keyboard.
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const typedKeys = rows.filter((r) => !r.metric.scaleMax).map((r) => r.key);
  const scroller = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
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
        fd.set("date", today);
        fd.set("frequency", source);
        mine.forEach((r) => fd.set(`metric_${r.metric.id}`, values[r.key] ?? ""));
        fd.set("note", withNote ? note : sections.find((s) => s.id === source)?.note ?? "");
        await logMetricPeriodAction(fd);
      }
      const measureRows = rows.filter((r) => r.source === "measurements");
      const noteWithMeasure = noteSource === "measurements";
      if (measureRows.length > 0 && (measureRows.some(changedRow) || (noteWithMeasure && noteDirty))) {
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("date", today);
        measureRows.forEach((r) => fd.set(`field_${r.metric.id}`, values[r.key] ?? ""));
        if (noteWithMeasure) fd.set("note", note);
        await saveMeasurementCheckInAction(fd);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="ci-screen ci-one">
      {/* Room at the foot for the Save bar only while it shows. */}
      <div ref={scroller} className={`ci-scroll${docked ? " docked" : ""}`}>
        {/* The photo banner, the Training and Nutrition banners' size: the
            date, and two pills that switch the screen between Today and
            Progress. */}
        <header className="tr-banner ci-banner">
          <div className="ci-bar">
            <button type="button" className="ci-back" onClick={onBack} aria-label="Back to home">
              <ChevronLeftIcon />
            </button>
            <h1 className="ci-title">Check-in</h1>
            <div className="ci-count" aria-label={`${filled.length} of ${rows.length} filled in`}>
              <span className={`ci-count-dot${complete ? " done" : ""}`} aria-hidden="true" />
              {filled.length}
              <span className="ci-count-total">/ {rows.length}</span>
            </div>
          </div>
          <div className="tr-kicker">{weeklyOpen ? "Daily · weekly" : "Daily"}</div>
          <FitTitle className="tr-name">{dateLabel}</FitTitle>
          <div className="tr-weeks ci-views" role="tablist" aria-label="Check-in">
            {(["today", "progress"] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={`tr-wk${view === v ? " on" : ""}`} onClick={() => setView(v)}>
                {v === "today" ? "Today" : "Progress"}
              </button>
            ))}
          </div>
        </header>

        <div className="ci-body">
          {view === "progress" ? (
            <CheckInProgress history={history} today={today} />
          ) : rows.length === 0 ? (
            <p className="ci-empty">Your coach hasn&rsquo;t set up any check-in metrics yet.</p>
          ) : folded ? (
            <div className="ci-folded">
              {/* Sent: a done row like a finished session on Training (the
                  light green wash), with Edit where the session says Done. */}
              <div className="ci-done-row-card" role="status" aria-live="polite">
                <span className="ci-saved-text">
                  <span className="ci-saved-title">{dateLabel}</span>
                  <span className="ci-saved-sub">
                    {filled.length} of {rows.length} logged
                  </span>
                </span>
                <button type="button" className="ci-done-edit" onClick={() => setFolded(false)}>
                  Edit
                </button>
              </div>
              <CheckInFeed days={history.days} />
            </div>
          ) : (
            <form id="ci-form" className={`ci-ledger${folding ? " folding" : ""}`} onSubmit={save} onFocus={(e) => reveal(e.target as HTMLElement)}>
              {/* The lifestyle phase's objectives, as a line like the rest. */}
              <PhaseObjectives coachName={coachFirst} objectives={objectives} variant="line" />
              {groups.map((g) => (
                <section key={g.id} id={`ci-group-${g.id}`} className="ci-group">
                  {/* Today's lines need no heading (the banner says it); the
                      week's get one when both are on screen. */}
                  {g.id === "week" && groups.length > 1 && <h2 className="ci-group-label">{g.label}</h2>}
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
                        today={today}
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
                <textarea ref={noteBox} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth knowing today?" maxLength={500} rows={2} />
              </label>
            </form>
          )}
        </div>
      </div>

      {docked && (
        <div ref={dock} className="ci-dock ci-dock-ledger" style={kb ? { bottom: kb } : undefined}>
          {/* Sent: just Done on the right (the empty text keeps it there). */}
          <div className="ci-dock-text">
            {!isSaved && (
              <>
                <div className="ci-dock-kicker">{complete ? "Ready" : "Today"}</div>
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
// logged (tap to see what), a plain one a day nothing was. Read only: a
// day's check-in can only be changed on the day.
function CheckInFeed({ days }: { days: CheckInFeedDay[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (days.length === 0) return null;
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return (
    <section className="ci-feed" aria-label="The last seven days">
      <h2 className="ci-feed-title">Last 7 days</h2>
      {days.map((d) => {
        const done = d.items.length > 0;
        const isOpen = open === d.date;
        return (
          <div key={d.date} className={`ci-day${done ? " done" : ""}`}>
            <button type="button" className="ci-day-head" disabled={!done} aria-expanded={done ? isOpen : undefined} onClick={() => setOpen(isOpen ? null : d.date)}>
              <span className="ci-day-text">
                <span className="ci-day-date">{label(d.date)}</span>
                <span className="ci-day-sub">{done ? `${d.items.length} logged` : "Nothing logged"}</span>
              </span>
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
