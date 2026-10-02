"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartIcon } from "../components/icons";
import { logMetricPeriodAction } from "../lib/actions";
import { useOpenCheckIn } from "./CheckInContext";
import { tidyDecimal } from "./workoutShared";
import { Bar, progressOf, short, type HomePhase } from "./PhaseCards";

// Home's lifestyle card (29 Sep, "ring + one at a time"): a white card
// under the greeting, above the Training / Nutrition carousel. A ring with
// one segment a metric and "{n} of {total}" in the middle, the phase and
// its week, then one page a metric to log right here: the name with page
// dots, the last value (a tap copies it in), the field and Save on one
// row. Swiping is how you skip; Save slides on to the next one still to
// log. Logged pages show a green pill and Edit. All in: a green ring and a
// one-line foot with Open.

export type HomeLifestyleMetric = {
  id: string;
  name: string;
  /** "L", "kg", "h", "" (steps), "/ 5" */
  unit: string;
  precision: number;
  kind: "number" | "scale";
  scale?: { min: number; max: number };
  min?: number;
  max?: number;
  /** Logged today. */
  today: number | null;
  /** The most recent value before today. */
  last: { value: number; date: string } | null;
  locked: boolean;
  /** Asked once a week: logged for this week, not today. */
  weekly?: boolean;
  /** Asked once a month (1 Oct): logged for this month. */
  monthly?: boolean;
  /** A day other than today: yesterday's question left open, asked once today's are in. */
  date?: string;
};
const keyOf = (m: HomeLifestyleMetric) => (m.date ? `${m.date}:${m.id}` : m.id);

const SAND = "#9fe3dc";
const SAND_OFF = "rgba(255,255,255,.28)";
const GREEN = "#6fd39b";
const DAY = 86400000;
const dayNum = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / DAY;
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmt = (v: number, p: number) => v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: p });
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The space between two metrics in the swipe (2 Oct): .hl-pager's gap in globals.css. */
const PAGE_GAP = 20;
/** How far one metric is from the next: its width and the gap. */
const stepOf = (el: HTMLElement) => el.clientWidth + PAGE_GAP;

/** Drives scrollLeft to `to` over 280ms (ease-out cubic) with the snap off, then puts it back. */
function animateScroll(el: HTMLElement, to: number, done: () => void) {
  const from = el.scrollLeft;
  const t0 = performance.now();
  el.style.scrollSnapType = "none";
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / 280);
    el.scrollLeft = from + (to - from) * (1 - Math.pow(1 - k, 3));
    if (k < 1) requestAnimationFrame(step);
    else {
      el.style.scrollSnapType = "";
      done();
    }
  };
  requestAnimationFrame(step);
}


/** "Week 3 · 4 weeks left", the phase cards' maths; "Last week" when none are left. */
function weekParts(ph: HomePhase, today: string): { week: string; left: string | null } {
  const t = dayNum(today);
  const s = dayNum(ph.start);
  if (!ph.end) return { week: `Week ${Math.max(1, Math.ceil((t - s + 1) / 7))}`, left: null };
  const e = dayNum(ph.end);
  const totalDays = e - s + 1;
  const elapsed = Math.min(totalDays, Math.max(0, t - s + 1));
  const weeks = Math.ceil(totalDays / 7);
  const week = Math.min(weeks, Math.max(1, Math.ceil(elapsed / 7)));
  const left = Math.max(0, Math.floor((e - t) / 7));
  return { week: `Week ${week}`, left: left === 0 ? "Last week" : `${left} week${left === 1 ? "" : "s"} left` };
}

export default function HomeLifestyleCard({ clientId, today, phase, coachName, metrics: todays, yesterday = [] }: { clientId: number; today: string; phase: HomePhase | null; coachName: string; metrics: HomeLifestyleMetric[]; yesterday?: HomeLifestyleMetric[] }) {
  const router = useRouter();
  const openCheckIn = useOpenCheckIn();
  const [, start] = useTransition();
  // Values saved from here before the page has caught up, by metric id.
  const [saved, setSaved] = useState<Record<string, number>>({});
  const todayOf = (m: HomeLifestyleMetric) => saved[keyOf(m)] ?? m.today;
  const isIn = (m: HomeLifestyleMetric) => todayOf(m) != null;
  // Today's questions first, and only today's (30 Sep): yesterday's open ones
  // are asked once today's are all in, as a round of their own. The ring and
  // the dots always count the same pages.
  const todayDone = todays.every(isIn);
  const showingYesterday = todayDone && yesterday.some((m) => !isIn(m));
  const metrics = showingYesterday ? yesterday : todays;
  const total = metrics.length;
  const n = metrics.filter(isIn).length;
  const pages = metrics.length;
  const allIn = todayDone && !showingYesterday;
  const [live, setLive] = useState("");

  // The page on show: the first metric not logged today, or where the
  // session left it; the position is what the scroller says once it moves.
  const storeKey = `ironline:home-lifestyle-idx:${today}`;
  const [idx, setIdx] = useState(() => {
    let i = -1;
    try {
      const s = sessionStorage.getItem(storeKey);
      if (s != null) i = Number(s);
    } catch {}
    if (!(i >= 0 && i < pages)) i = metrics.findIndex((m) => !isIn(m));
    return i < 0 ? 0 : i;
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey, String(idx));
    } catch {}
  }, [idx, storeKey]);

  const scroller = useRef<HTMLDivElement>(null);
  const animating = useRef(false);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = idx * stepOf(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);
  // A page move from Save or a dot: no snapping while the scroll is driven,
  // an ease-out over 280ms, then the snap comes back. (scrollTo with
  // behavior: smooth is unreliable inside a snap container.)
  const goTo = (i: number, after?: () => void) => {
    const el = scroller.current;
    if (!el) return;
    setIdx(i);
    const to = i * stepOf(el);
    if (reducedMotion()) {
      el.scrollLeft = to;
      after?.();
      return;
    }
    animating.current = true;
    animateScroll(el, to, () => {
      animating.current = false;
      after?.();
    });
  };
  // Today's all in and yesterday's round begins: back to its first page.
  const round = useRef(showingYesterday);
  useEffect(() => {
    if (round.current === showingYesterday) return;
    round.current = showingYesterday;
    setIdx(0);
    if (scroller.current) scroller.current.scrollLeft = 0;
  }, [showingYesterday]);
  const onScroll = () => {
    const el = scroller.current;
    if (!el || animating.current || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / stepOf(el));
    if (i !== idx && i >= 0 && i < pages) setIdx(i);
  };

  // The next one still to log, forward from here and round again.
  const nextOpen = (from: number, logged: Record<string, number>) => {
    for (let k = 1; k <= pages; k++) {
      const j = (from + k) % pages;
      const m = metrics[j];
      if ((logged[keyOf(m)] ?? m.today) == null) return j;
    }
    return -1;
  };

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const save = (m: HomeLifestyleMetric, value: number, i: number) => {
    const keyboardOpen = document.activeElement instanceof HTMLInputElement;
    const before = saved;
    const logged = { ...saved, [keyOf(m)]: value };
    setSaved(logged);
    setError((e) => ({ ...e, [keyOf(m)]: "" }));
    setLive(`${m.name} saved`);
    const j = nextOpen(i, logged);
    if (j >= 0) goTo(j, () => keyboardOpen && inputs.current[keyOf(metrics[j])]?.focus());
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("date", m.date ?? today);
        fd.set("frequency", m.monthly ? "monthly" : m.weekly ? "weekly" : "daily");
        fd.set(`metric_${m.id}`, String(value));
        await logMetricPeriodAction(fd);
      } catch {
        setSaved(before);
        setError((e) => ({ ...e, [keyOf(m)]: "Couldn't save. Try again." }));
        goTo(i);
      }
    });
  };

  // Past midnight with the app still open: today's page is a new day.
  useEffect(() => {
    const on = () => {
      if (document.visibilityState === "visible" && localToday() !== today) router.refresh();
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [today, router]);

  if (pages === 0) return null;
  // The ring opens Progress (the charts); the phase and its timeline open the Calendar; the rest, Today.
  const open = () => openCheckIn?.("daily");
  const openProgress = () => openCheckIn?.("progress");
  const openCalendar = () => openCheckIn?.("calendar");

  return (
    <section className={`hl${allIn ? "" : " open"}`} aria-label="Lifestyle">
      {/* A water bottle on a mat at sunset behind it all (30 Sep), darkened toward the foot; the logging panel sits light on it. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a public file, framed by CSS */}
      <img className="hl-bg" src="/img/lifestyle-bottle.jpg" alt="" aria-hidden="true" draggable={false} />
      <span className="hl-scrim" aria-hidden="true" />
      {/* Built like the training card: the track chip and the week on the
          first row, the phase's name with what is left of it, the timeline
          with its first and last day, then today's ring and count. */}
      <button type="button" className="hl-top" onClick={open} aria-label={phase ? `Open Lifestyle: ${phase.name}, ${weekParts(phase, today).week}` : "Open your check-in"}>
        <span className="pc-track-chip hl-chip">
          <span className="pc-icon">
            <HeartIcon />
          </span>
          Lifestyle
        </span>
        {phase && <span className="hl-week-chip">{weekParts(phase, today).week}</span>}
      </button>
      <div className="hl-phase" role="button" tabIndex={0} onClick={openCalendar} onKeyDown={(e) => e.key === "Enter" && openCalendar()} aria-label={`Open the calendar: ${phase?.name ?? "check-in"}`}>
        {/* No lifestyle phase set: the metrics still ask, under "Check-in", with no timeline. */}
        <h3 className="hl-phase-name">{phase?.name ?? "Check-in"}</h3>
        {phase && weekParts(phase, today).left && <span className="hl-week">{weekParts(phase, today).left}</span>}
      </div>
      {phase && (
      <div className="hl-bar" onClick={openCalendar}>
        <Bar pr={progressOf(phase, today, coachName)} small />
        {phase.end && (
          <div className="hl-ends">
            <span>{short(phase.start)}</span>
            <span>{short(phase.end)}</span>
          </div>
        )}
      </div>
      )}
      {/* One block: the ring on the left (a tap opens the check-in), and
          beside it the metric to log, one page at a time; the pager folds
          away when everything is in and the foot takes its place. */}
      {/* A tap on the panel anywhere but its controls opens the check-in on Today (30 Sep). */}
      <div
        className="hl-log"
        onClick={(e) => {
          if (!(e.target as Element).closest("button, input, label, a, [role=radiogroup]")) open();
        }}
      >
        <button type="button" className="hl-ring-btn" onClick={openProgress} aria-label={`Open your progress: ${n} of ${total} logged ${showingYesterday ? "for yesterday" : "today"}`}>
          <Ring metrics={metrics} isIn={isIn} n={n} total={total} />
        </button>
        <div className="hl-log-main">
          <div className={`hl-fold${allIn ? " closed" : ""}`} aria-hidden={allIn}>
            <div className="hl-fold-clip">
              <div ref={scroller} className="hl-pager" role="region" aria-roledescription="carousel" aria-label="Today's lifestyle metrics" onScroll={onScroll}>
                {metrics.map((m, i) => (
                  <MetricPage
                    key={keyOf(m)}
                    m={m}
                    i={i}
                    idx={idx}
                    metrics={metrics}
                    isIn={isIn}
                    value={todayOf(m)}
                    error={error[keyOf(m)] ?? ""}
                    onGoTo={(j) => goTo(j)}
                    onSave={(v) => save(m, v, i)}
                    inputRef={(el) => (inputs.current[keyOf(m)] = el)}
                    onError={(msg) => setError((e) => ({ ...e, [keyOf(m)]: msg }))}
                  />
                ))}
              </div>
            </div>
          </div>
          {allIn && (
            <div className="hl-foot">
              <span>
                <b>All logged today.</b> {coachName} can see it.
              </span>
              <button type="button" className="hl-open" onClick={open}>
                Open
              </button>
            </div>
          )}
        </div>
      </div>
      <span className="hl-live" aria-live="polite">
        {live}
      </span>
    </section>
  );
}

// ---- The ring: one segment a metric, clockwise from the top; green when all are in. ----
function Ring({ metrics, isIn, n, total }: { metrics: HomeLifestyleMetric[]; isIn: (m: HomeLifestyleMetric) => boolean; n: number; total: number }) {
  // Drawn as strokes on a circle, one arc a metric, so it is only ever a ring.
  const size = 56;
  const r = 24;
  const c = size / 2;
  const seg = 360 / total;
  const gap = total === 1 ? 0 : total > 6 ? 4 : 6;
  const pt = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [c + r * Math.cos(rad), c + r * Math.sin(rad)] as const;
  };
  const arc = (a0: number, a1: number) => {
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  return (
    <span className="hl-ring" aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {n === total ? (
          <circle cx={c} cy={c} r={r} fill="none" stroke={GREEN} strokeWidth="6" />
        ) : (
          metrics.map((m, i) =>
            gap === 0 ? (
              <circle key={keyOf(m)} cx={c} cy={c} r={r} fill="none" stroke={isIn(m) ? SAND : SAND_OFF} strokeWidth="6" />
            ) : (
              <path key={keyOf(m)} d={arc(i * seg + gap / 2, (i + 1) * seg - gap / 2)} fill="none" stroke={isIn(m) ? SAND : SAND_OFF} strokeWidth="6" />
            )
          )
        )}
      </svg>
      <span className="hl-ring-in">
        <b>{n}</b>
        <small>of {total}</small>
      </span>
    </span>
  );
}// ---- One page: the name with the dots, the last value, the field and Save. ----
function MetricPage({
  m,
  i,
  idx,
  metrics,
  isIn,
  value,
  error,
  onGoTo,
  onSave,
  onError,
  inputRef,
}: {
  m: HomeLifestyleMetric;
  i: number;
  idx: number;
  metrics: HomeLifestyleMetric[];
  isIn: (m: HomeLifestyleMetric) => boolean;
  value: number | null;
  error: string;
  onGoTo: (j: number) => void;
  onSave: (v: number) => void;
  onError: (msg: string) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const total = metrics.length;
  const logged = value != null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pick, setPick] = useState<number | null>(null);
  const showField = !logged || editing;
  // More than five steps (1 to 10) don't fit beside Save: the numbers take the
  // whole row and a tap saves, after a beat that shows the pick (30 Sep).
  const steps = m.kind === "scale" ? (m.scale?.max ?? 5) - (m.scale?.min ?? 1) + 1 : 0;
  const wide = steps > 5;
  const tapTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(tapTimer.current), []);

  const lo = m.kind === "scale" ? m.scale?.min : m.min;
  const hi = m.kind === "scale" ? m.scale?.max : m.max;
  const parsed = m.kind === "scale" ? pick : draft.trim() === "" ? null : Number(draft.replace(",", "."));
  const outOfRange = parsed != null && Number.isFinite(parsed) && ((lo != null && parsed < lo) || (hi != null && parsed > hi));
  const rangeMsg = outOfRange ? `Between ${lo ?? "0"} and ${hi}${m.unit && m.kind === "number" ? ` ${m.unit}` : ""}` : "";
  const ready = parsed != null && Number.isFinite(parsed) && !outOfRange;

  const submit = () => {
    if (!ready || parsed == null) return;
    setEditing(false);
    setDraft("");
    setPick(null);
    onSave(parsed);
  };

  // The dots: every metric, or a window of seven around this page past eight.
  const win = total > 8 ? 7 : total;
  const from = total > 8 ? Math.max(0, Math.min(idx - 3, total - win)) : 0;
  const dots = metrics.slice(from, from + win);

  return (
    <div className="hl-page" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${total}: ${m.name}`}>
      <div className="hl-row1">
        <span className="hl-name">
          {m.date ? <small className="hl-when">Yesterday</small> : m.monthly ? <small className="hl-when">This month</small> : m.weekly && <small className="hl-when">This week</small>}
          {m.name}
        </span>
        <span className="hl-dots">
          {dots.map((d, k) => {
            const j = from + k;
            const edge = total > 8 && ((k === 0 && from > 0) || (k === win - 1 && from + win < total));
            return (
              <button key={keyOf(d)} type="button" className={`hl-dot${j === idx ? " on" : isIn(d) ? " in" : ""}${edge ? " edge" : ""}`} aria-label={d.name} aria-current={j === idx ? "true" : undefined} onClick={() => j !== idx && onGoTo(j)}>
                <i />
              </button>
            );
          })}
        </span>
      </div>

      {/* No line for what it was the day before (29 Sep): the page is the name, the field and Save. */}

      {showField ? (
        <form
          className="hl-row3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {m.kind === "scale" ? (
            // One pill a number, as the workout's wrap-up asks it (30 Sep).
            <span className="hl-scale" style={{ gridTemplateColumns: `repeat(${steps}, minmax(0, 1fr))` }} role="radiogroup" aria-label={m.name}>
              {Array.from({ length: steps }, (_, k) => (m.scale?.min ?? 1) + k).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={pick === v}
                  className={pick === v ? "on" : pick != null && v < pick ? "in" : ""}
                  onClick={() => {
                    setPick(v);
                    if (!wide) return;
                    window.clearTimeout(tapTimer.current);
                    tapTimer.current = window.setTimeout(() => {
                      setEditing(false);
                      setPick(null);
                      onSave(v);
                    }, 300);
                  }}
                >
                  {v}
                </button>
              ))}
            </span>
          ) : (
            <label className="hl-field">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onInput={tidyDecimal}
                onFocus={(e) => e.currentTarget.select()}
                inputMode={m.precision === 0 ? "numeric" : "decimal"}
                enterKeyHint="done"
                placeholder="0"
                aria-label={`${m.name}${m.unit ? ` in ${m.unit}` : ""}`}
                aria-invalid={outOfRange || undefined}
              />
              {m.unit && <span className="hl-unit">{m.unit}</span>}
            </label>
          )}
          {!wide && (
            <button type="submit" className={`hl-save${ready ? " ready" : ""}`} disabled={!ready} aria-disabled={!ready}>
              Save
            </button>
          )}
        </form>
      ) : (
        <div className="hl-row3">
          <span className="hl-done">
            <i aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5L20 7" />
              </svg>
            </i>
            <b>{m.kind === "scale" ? fmt(value!, 0) : fmt(value!, m.precision)}</b>
            <small>{m.kind === "scale" ? `/${m.scale?.max ?? 5}` : m.unit}</small>
          </span>
          {!m.locked && (
            <button
              type="button"
              className="hl-edit"
              onClick={() => {
                if (m.kind === "scale") setPick(value);
                else setDraft(fmt(value!, m.precision).replace(/,/g, ""));
                setEditing(true);
              }}
            >
              Edit
            </button>
          )}
        </div>
      )}
      {(rangeMsg || error) && (
        <span className="hl-error" role="alert">
          {rangeMsg || error}
        </span>
      )}
      {/* onError is here for the parent's inline errors; the range line is the page's own. */}
      {void onError}
    </div>
  );
}
