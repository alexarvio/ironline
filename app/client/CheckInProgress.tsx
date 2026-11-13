"use client";

import { monotonePath } from "../lib/monotoneCurve";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import type { CheckInSection } from "./CheckInScreen";
import { GOAL_COLOR, VERDICT_TONE, VERDICT_WORD, type WeightGoalVerdict } from "../lib/weightGoal";
import { Bars } from "./Bars";
import { pic } from "../lib/pic";
import { dayWords } from "../lib/clientDates";
// The check-in's Progress view (23 Oct, Alex: built from the approved mockup,
// docs/boards/checkin-progress-mockup.html; hairline, flat on the page): a
// row of metric chips, then the chosen metric with no card round it, its
// category's colour only on the eyebrow, the line, the goal and the latest
// point (all else ink and grey). The latest value big, with the change over
// the shown range (green the metric's good way, red the other, grey with
// none), and a 1W / 1M / 3M / All capsule. Under it the plain history,
// newest first, twenty a page, each value with its change on the one
// before. No averages, no week grouping.
//
// The types mirror CheckInHistory in lib/queries.ts, which a client file
// can't import.
export type CheckInSeries = {
  key: string;
  name: string;
  unit: string;
  scaleMax: number | null;
  cadence: "daily" | "weekly" | "monthly" | "measurement";
  /** The admin group the metric belongs to (its label), and that group's colour for the chart. */
  category: string;
  colour: string;
  colourRgb: string;
  /** The coach's target for it, if any: the dashed line. */
  target: number | null;
  /** Which way is good for it (the metric's good_direction); absent reads as "none". */
  goodDirection?: "up" | "down" | "none";
  /** Decimals to show: 0, 1 or 2. */
  precision: number;
  points: { date: string; value: number; at: string | null }[];
  /** The Weight chart's alone (empty with none): the weight goals, by date, in the series' unit (2 Nov, Alex). */
  goals?: ClientGoalLine[];
  /** The Phase range's first day (3 Nov, Alex); null with no phase started. */
  phaseStart?: string | null;
};
/** A weight goal on the Weight chart: weights in the series' unit; setBy the coach's first name or "you". */
export type ClientGoalLine = {
  id: number;
  target: number;
  byDate: string;
  start: number;
  startDate: string;
  mine: boolean;
  setBy: string;
  byPhoto: string | null;
  active: boolean;
  settled: boolean;
  verdict: WeightGoalVerdict | null;
  toGo: number | null;
  reachedOn: string | null;
  missedBy: number | null;
};
export type CheckInFeedDay = {
  date: string;
  items: { name: string; value: string }[];
  note: string | null;
  dailyTotal: number;
  dailyDone: number;
  /** The day as the form's sections, to change it from the feed. */
  edit: CheckInSection[];
};
export type CheckInHistory = { series: CheckInSeries[]; days: CheckInFeedDay[] };

// Goal (2 Nov, Alex: a toggle to the goal's own graph, the line traced and where they stand): from the goal's start to its
// day, offered on Weight while a goal runs.
// The ranges as everywhere else (3 Nov, Alex: "the toggles the same as everywhere else"): Goal while one runs, 7d, 30d,
// and Phase from the live phase's first day (phaseStart). Was 1W | 1M | 3M | All.
type Range = "Goal" | "7D" | "30D" | "Phase";
const RANGE_DAYS: Record<Range, number | null> = { Goal: null, "7D": 7, "30D": 30, Phase: null };
const RANGE_WORD: Record<Range, string> = { Goal: "since the goal was set", "7D": "in the last 7 days", "30D": "in the last 30 days", Phase: "in this phase" };
const RANGE_LABEL: Record<Range, string> = { Goal: "Goal", "7D": "7d", "30D": "30d", Phase: "Phase" };
const RANGES: Range[] = ["Goal", "7D", "30D", "Phase"];
const RANGE_KEY = "ironline:progress-range";
const PAGE = 20;
const DAY = 86400000;
const dayNum = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / DAY;
/** "2 Nov", the year after it when it isn't this one (3 Nov, Alex: dates through clientDates). */
const dm = (s: string) => dayWords(s);
const fmt = (v: number, p: number) => v.toLocaleString("en-GB", { minimumFractionDigits: p, maximumFractionDigits: p });
/** A goal's weight: "82", "87.6". */
const one = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: 1 });
/** "20 Dec", the year after it when it isn't this one. */
const dmy = (s: string, _today: string) => dayWords(s);
const unitOf = (s: CheckInSeries) => (s.scaleMax ? `/ ${s.scaleMax}` : s.unit);
/** A change rounded to the metric's decimals: +0.4, −1.8, or 0.0 with no sign. */
const signed = (v: number, p: number) => {
  const r = Number(v.toFixed(p));
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${fmt(Math.abs(r), p)}`;
};
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function readStore(store: "local" | "session", key: string): string | null {
  try {
    return (store === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function writeStore(store: "local" | "session", key: string, value: string) {
  try {
    (store === "local" ? localStorage : sessionStorage).setItem(key, value);
  } catch {}
}

export default function CheckInProgress({ history, today }: { history: CheckInHistory; today: string }) {
  // Only metrics with something logged get a chip, in the Today tab's order.
  // A legacy measurement field with a tracked metric's name (Weight twice) is
  // the same thing: the metric's chip stands for both.
  const tracked = useMemo(() => {
    const seen = new Set<string>();
    return history.series.filter((s) => {
      if (s.points.length === 0) return false;
      const name = s.name.trim().toLowerCase();
      if (s.cadence === "measurement" && seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [history.series]);
  // Always the first metric on arrival (28 Sep: it used to remember the
  // last one, which left it on the far chip after any trip away); from Home's weight (3 Nov), Weight, once.
  const [index, setIndex] = useState(() => {
    const pick = readStore("session", "nc-progress-pick");
    if (pick !== "weight") return 0;
    try {
      sessionStorage.removeItem("nc-progress-pick");
    } catch {}
    return Math.max(0, tracked.findIndex((s) => /\bweight\b/i.test(s.name)));
  });
  const [range, setRange] = useState<Range>(() => {
    const r = readStore("session", RANGE_KEY) as Range | null;
    // Goal first (2 Nov, Alex): Weight opens on it while a goal runs; any other metric falls to 30d.
    return r && RANGES.includes(r) ? r : "Goal";
  });
  const [page, setPage] = useState(0);
  const series = tracked[Math.min(index, tracked.length - 1)];

  const pick = (i: number) => {
    const n = tracked.length;
    if (n < 2) return;
    const next = (i + n) % n;
    setIndex(next);
    setPage(0);
  };
  const chooseRange = (r: Range) => {
    setRange(r);
    writeStore("session", RANGE_KEY, r);
  };

  // The chips pick a metric; so does a swipe across the chart (10 Oct): left
  // for the next, right for the one before. A hold on the chart reads values.
  if (!series) return null;

  return (
    <div className="pg-view">
      <MetricChips tracked={tracked} active={index} onPick={pick} />
      <MetricPanel key={series.key} series={series} today={today} range={range} onRange={chooseRange} onSwipe={(d) => pick(index + d)} />
      <MetricHistory series={series} today={today} page={page} onPage={setPage} />
    </div>
  );
}

// ---- The chips: white with the hairline, the chosen one ink. ----
function MetricChips({ tracked, active, onPick }: { tracked: CheckInSeries[]; active: number; onPick: (i: number) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    const chip = el?.children[active] as HTMLElement | undefined;
    if (!el || !chip) return;
    // Fully into view, with the 16px gutter kept either side.
    const left = chip.offsetLeft - 16;
    const right = chip.offsetLeft + chip.offsetWidth + 16;
    let to = el.scrollLeft;
    if (left < el.scrollLeft) to = left;
    else if (right > el.scrollLeft + el.clientWidth) to = right - el.clientWidth;
    if (to !== el.scrollLeft) el.scrollTo({ left: Math.max(0, to), behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active]);
  return (
    <div ref={scroller} className="pg-chips" role="tablist" aria-label="Metric">
      {tracked.map((s, i) => (
        <button key={s.key} type="button" role="tab" aria-selected={i === active} className={`pg-chip${i === active ? " on" : ""}`} onClick={() => onPick(i)}>
          {s.name}
        </button>
      ))}
    </div>
  );
}

// ---- The metric, flat on the page: its head, the chart, the axis. ----
// The chart's box: a band on top for the reading pill, then the plot.
const H = 200;
const TOP = 30;
const BOTTOM = 4;

function MetricPanel({
  series,
  today,
  range,
  onRange,
  onSwipe,
}: {
  series: CheckInSeries;
  today: string;
  range: Range;
  onRange: (r: Range) => void;
  /** A swipe across the chart: +1 the next metric, -1 the one before. */
  onSwipe: (dir: 1 | -1) => void;
}) {
  const end = dayNum(today);
  const runningGoal = series.goals?.find((g) => g.active) ?? null;
  const phaseStart = series.phaseStart ? dayNum(series.phaseStart) : null;
  const ranges = RANGES.filter((r) => (r === "Goal" ? !!runningGoal : r === "Phase" ? phaseStart != null : true));
  const shown: Range = ranges.includes(range) ? range : "30D";
  const days = RANGE_DAYS[shown];
  // The Goal range from the goal's start; with nothing weighed since, from the last reading before it, so the line has
  // where it came from.
  const goalStart = runningGoal ? dayNum(runningGoal.startDate) : end;
  const before = series.points.filter((q) => dayNum(q.date) < goalStart).at(-1);
  const start =
    shown === "Goal" && runningGoal
      ? series.points.some((q) => dayNum(q.date) >= goalStart) || !before ? goalStart : dayNum(before.date)
      : shown === "Phase" && phaseStart != null
        ? phaseStart
        : end - ((days ?? 30) - 1);
  const points = useMemo(() => series.points.filter((p) => dayNum(p.date) >= start), [series.points, start]);

  const rangeWord = RANGE_WORD[shown];
  const p = series.precision;
  const unit = unitOf(series);
  const latest = series.points[series.points.length - 1];
  // The change over the shown range: green when it moves the way the metric
  // is good (up or down, as the coach's tables colour it), red the other way;
  // with no way set, toward the coach's target or away; grey otherwise.
  const move = points.length > 1 ? Number((points[points.length - 1].value - points[0].value).toFixed(p)) : null;
  const dir = series.goodDirection ?? "none";
  let tone = "";
  if (move && dir !== "none") tone = (dir === "down") === move < 0 ? " good" : " bad";
  else if (move && series.target != null) {
    const before = Math.abs(points[0].value - series.target);
    const now = Math.abs(points[points.length - 1].value - series.target);
    tone = now < before ? " good" : now > before ? " bad" : "";
  }
  const moveUnit = series.scaleMax ? "" : series.unit;
  // The weight goal (2 Nov, Alex: "great to see the goal as a line traced and where we stand in that line"; mockup B):
  // the one being worked on as a grey line under the value, in the Goal range alone (4 Nov, Alex); the plot runs on past
  // today to its day, the days to come at most twice the days shown, else it stops there and the goal is pinned at its edge.
  const activeGoal = runningGoal;
  const goalDay = activeGoal ? dayNum(activeGoal.byDate) : null;
  // The goal's line and the days to it only in the Goal range (3 Nov, Alex: "only show this goal line whenever the goal is
  // toggled, not on 7d 30d or phase"); the other ranges end today.
  const plotEnd = shown === "Goal" && goalDay != null && goalDay > end ? goalDay : end;
  const goalFacts = (() => {
    if (!activeGoal) return [];
    const g = activeGoal;
    const head = `${one(g.target)} ${unit} by ${dmy(g.byDate, today)}`;
    if (g.settled) {
      return [
        head,
        g.verdict === "reached" ? (
          <span className="pg-goal-v good">Reached {dmy(g.reachedOn ?? g.byDate, today)}</span>
        ) : (
          <span className="pg-goal-v">Missed{g.missedBy != null && g.missedBy > 0 ? ` by ${one(g.missedBy)} ${unit}` : ""}</span>
        ),
      ];
    }
    return [
      head,
      g.toGo != null && g.toGo > 0 && `${one(g.toGo)} ${unit} to go`,
      g.verdict && <span className={`pg-goal-v ${VERDICT_TONE[g.verdict]}`}>{VERDICT_WORD[g.verdict]}</span>,
    ];
  })();
  return (
    <section className="pg-metric" role="tabpanel" aria-label={series.name} style={{ "--cat": series.colour, "--goal": GOAL_COLOR } as React.CSSProperties}>
      <div className="pg-head">
        <span className="pg-eyebrow">{series.category}</span>
        <div className="pg-row">
          <div className="pg-head-text">
            <div className="pg-now">
              <b>{fmt(latest.value, p)}</b>
              {unit && <small>{unit}</small>}
              {move != null && (
                <span className={`pg-delta${tone}`}>
                  {signed(move, p)}
                  {moveUnit && ` ${moveUnit}`}
                  <span className="pg-sr">{` ${rangeWord}`}</span>
                </span>
              )}
            </div>
            {/* No name under the figure (14 Nov, Alex): the picked chip above says which metric it is. */}
          </div>
          <div className="pg-range" role="radiogroup" aria-label="Time range">
            {ranges.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={r === shown} className={r === shown ? "on" : ""} onClick={() => onRange(r)}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        {/* The goal is the coach's to set (2 Nov, Alex): the client reads it, with no action, the coach's face first as on an
            event they added. Only in the Goal range (4 Nov, Alex: "that's not something that we should show if it's just
            like previous weight"); in 7d, 30d and Phase its room is kept, unseen, so switching moves nothing. A goal
            settled with none running has no Goal range, so no line. */}
        {activeGoal && (
          <div className={`pg-goal${shown === "Goal" ? "" : " off"}`} aria-hidden={shown === "Goal" ? undefined : true}>
            <span className="evp-by pg-goal-by" role="img" aria-label={`Set by ${activeGoal.setBy}`}>
              {activeGoal.byPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
                <img src={pic(activeGoal.byPhoto, 96)} alt="" />
              ) : (
                (activeGoal.setBy || "?").trim().charAt(0).toUpperCase()
              )}
            </span>
            <span className="pg-goal-facts">
              <Bars parts={goalFacts} />
            </span>
          </div>
        )}
      </div>
      {points.length === 0 ? (
        <div className="pg-chart-empty">
          <span>Nothing logged {rangeWord}</span>
          {/* The widest range there is (the phase, else 30 days) when it isn't this one. */}
          {(() => {
            const widest: Range = ranges.includes("Phase") ? "Phase" : "30D";
            return widest !== shown ? (
              <button type="button" onClick={() => onRange(widest)}>
                {RANGE_LABEL[widest]}
              </button>
            ) : null;
          })()}
        </div>
      ) : (
        <Chart key={shown} series={series} points={points} start={start} end={end} plotEnd={plotEnd} today={today} range={shown} onSwipe={onSwipe} />
      )}
    </section>
  );
}

function Chart({
  series,
  points,
  start,
  end,
  plotEnd,
  today,
  range,
  onSwipe,
}: {
  series: CheckInSeries;
  points: CheckInSeries["points"];
  start: number;
  /** Today. */
  end: number;
  /** Where the plot ends: today, or on to the weight goal's day. */
  plotEnd: number;
  today: string;
  range: Range;
  onSwipe: (dir: 1 | -1) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(311);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(200, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const p = series.precision;
  const unit = unitOf(series);
  const vals = points.map((q) => q.value);
  // The weight goal's planned path (2 Nov, Alex; mockup B): a straight dashed line from where they were when it was
  // set to the goal, then on through the milestones after it, clipped to the days shown; a ring on each goal. The
  // later milestones fainter. A goal past the plot's end is pinned at its right edge with its weight and day.
  const plan = (() => {
    if (range !== "Goal") return null;
    const gs = series.goals ?? [];
    const at = gs.findIndex((g) => g.active);
    if (at < 0) return null;
    const path = gs.slice(at).filter((g, i) => i === 0 || !g.settled);
    const segs: { n0: number; v0: number; n1: number; v1: number; later: boolean }[] = [];
    const rings: { n: number; v: number; target: number; later: boolean; pinned: boolean; byDate: string }[] = [];
    for (const [i, g] of path.entries()) {
      const a = dayNum(g.startDate);
      const b = dayNum(g.byDate);
      const valueAt = (n: number) => (b <= a ? g.target : g.start + (g.target - g.start) * Math.min(1, Math.max(0, (n - a) / (b - a))));
      const n0 = Math.max(start, a);
      const n1 = Math.min(plotEnd, b);
      if (n1 > n0) segs.push({ n0, v0: valueAt(n0), n1, v1: valueAt(n1), later: i > 0 });
      if (b <= plotEnd) {
        if (b >= start) rings.push({ n: b, v: g.target, target: g.target, later: i > 0, pinned: false, byDate: g.byDate });
      } else {
        // Pinned at the edge, on the dashed line's end there (its pill says the goal), so the scale never stretches to a
        // goal months out and flattens the readings.
        if (i === 0) rings.push({ n: plotEnd, v: valueAt(plotEnd), target: g.target, later: false, pinned: true, byDate: g.byDate });
        break;
      }
    }
    return { segs, rings };
  })();
  let lo: number;
  let hi: number;
  if (series.scaleMax) {
    lo = 0.5;
    hi = series.scaleMax + 0.5;
  } else {
    const planVals = plan ? [...plan.segs.flatMap((s) => [s.v0, s.v1]), ...plan.rings.map((r) => r.v)] : [];
    const all = [...vals, ...(series.target != null ? [series.target] : []), ...planVals];
    lo = Math.min(...all);
    hi = Math.max(...all);
    const pad = (hi - lo || 1) * 0.15;
    lo -= pad;
    hi += pad;
  }
  // Three faint grid lines, each at a value it can name exactly: a scale's
  // whole steps (3, 6, 9 of 10), else a quarter, half and three quarters up,
  // rounded to the metric's decimals.
  const gridAt = (() => {
    const sm = series.scaleMax;
    const at = sm
      ? [1, 2, 3].map((k) => k * Math.max(1, Math.round(sm / 3.3))).filter((v) => v <= sm)
      : [0.25, 0.5, 0.75].map((f) => Number((lo + (hi - lo) * f).toFixed(p)));
    return [...new Set(at)];
  })();
  // Their values sit on the right, past the lines' end.
  const right = Math.max(30, Math.ceil(6 + Math.max(...gridAt.map((v) => fmt(v, p).length)) * 6.2));
  const plotW = width - right;
  const plotH = H - TOP - BOTTOM;
  // Days to x: the first day shown to the plot's end (today, or on to a weight goal's day).
  const xd = (n: number) => ((n - start) / Math.max(1, plotEnd - start)) * plotW;
  const x = (date: string) => xd(dayNum(date));
  const xToday = xd(end);
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * plotH;
  const crisp = (v: number) => Math.round(v) + 0.5;
  const xy = points.map((q) => ({ x: x(q.date), y: y(q.value) }));
  // Smooth through every reading, never past one (25 Oct, Alex: "very spikey", then option B of the weight-line mockup):
  // monotoneCurve, as Home's Weight card on the coach's side, so the ring always sits on the line.
  const line = monotonePath(xy);
  // Under it, a mark a day (a week, a month, as the metric is asked; a measurement by the week), in the category's colour
  // when something was logged in it, pale when not (25 Oct, Alex: option C of the missed weigh-ins mockup, the coach's
  // Weight card's too).
  const strip = (() => {
    const per = series.cadence === "daily" ? "day" : series.cadence === "monthly" ? "month" : "week";
    const startOf = (n: number) => {
      const d = new Date(n * DAY);
      if (per === "week") return n - ((d.getUTCDay() + 6) % 7);
      if (per === "month") return n - (d.getUTCDate() - 1);
      return n;
    };
    const logged = new Set(points.map((q) => dayNum(q.date)));
    const out: { from: number; to: number; on: boolean }[] = [];
    for (let n = start; n <= end; ) {
      let to = n;
      while (to + 1 <= end && startOf(to + 1) === startOf(n)) to++;
      let on = false;
      for (let k = n; k <= to; k++) if (logged.has(k)) on = true;
      out.push({ from: n, to, on });
      n = to + 1;
    }
    return out;
  })();

  // The marker: the latest point until the mouse is over the chart or a
  // finger is on it, then the logged point nearest it; back to the latest on
  // release. While reading, an ink guide and ring and the value in a white
  // pill; otherwise only the latest point's pulsing dot. Two gestures on the chart
  // (10 Oct): a finger that lands and stays (a fifth of a second) scrubs,
  // the marker following it; a finger
  // that moves sideways straight away is a swipe, the chart slides with it
  // and lets go into the next metric (left) or the one before (right). An
  // up or down move is nothing: the chart owns its touches, so the page is
  // not scrolling either way.
  const HOLD_MS = 200;
  const SWIPE_PX = 48;
  const latest = points.length - 1;
  const [sel, setSel] = useState(latest);
  const [scrubbing, setScrubbing] = useState(false);
  // A value is being read: the mouse over the chart, a finger on it, or the arrow keys.
  const [reading, setReading] = useState(false);
  const [shift, setShift] = useState(0);
  const dragging = useRef(false);
  type Gesture = { x: number; y: number; mode: "wait" | "scrub" | "swipe" | "off"; timer: number };
  const gesture = useRef<Gesture | null>(null);
  useEffect(() => {
    const el = box.current;
    // While a finger is on the chart the page doesn't scroll under it.
    const stop = (e: TouchEvent) => {
      if (gesture.current) e.preventDefault();
    };
    el?.addEventListener("touchmove", stop, { passive: false });
    return () => {
      el?.removeEventListener("touchmove", stop);
      if (gesture.current) clearTimeout(gesture.current.timer);
    };
  }, []);
  const startDrag = (el: HTMLElement, pointerId: number, clientX: number, clientY: number) => {
    try {
      el.setPointerCapture(pointerId);
    } catch {}
    if (gesture.current) clearTimeout(gesture.current.timer);
    const g: Gesture = { x: clientX, y: clientY, mode: "wait", timer: 0 };
    g.timer = window.setTimeout(() => {
      if (gesture.current !== g || g.mode !== "wait") return;
      g.mode = "scrub";
      dragging.current = true;
      setScrubbing(true);
      navigator.vibrate?.(8);
    }, HOLD_MS);
    gesture.current = g;
    // The value under the finger shows at once; the hold decides what the move does.
    setReading(true);
    select(nearest(clientX));
  };
  const moveDrag = (clientX: number, clientY: number, pointerType: string) => {
    const g = gesture.current;
    if (!g) {
      if (pointerType !== "touch") {
        setReading(true);
        select(nearest(clientX));
      }
      return;
    }
    if (g.mode === "scrub") return select(nearest(clientX));
    if (g.mode === "swipe") return setShift(clientX - g.x);
    if (g.mode !== "wait") return;
    const dx = clientX - g.x;
    const dy = clientY - g.y;
    if (Math.hypot(dx, dy) < 10) return;
    clearTimeout(g.timer);
    setReading(false);
    if (Math.abs(dx) > Math.abs(dy)) {
      g.mode = "swipe";
      setSel(latest);
      setShift(dx);
    } else {
      g.mode = "off";
      setSel(latest);
    }
  };
  const nearest = (clientX: number) => {
    const el = box.current;
    if (!el) return latest;
    const px = clientX - el.getBoundingClientRect().left;
    // Start from where a point would sit at that x, then look either way.
    let best = Math.round((px / Math.max(1, plotW)) * latest);
    best = Math.max(0, Math.min(latest, best));
    for (;;) {
      const l = best > 0 && Math.abs(xy[best - 1].x - px) < Math.abs(xy[best].x - px);
      const r = best < latest && Math.abs(xy[best + 1].x - px) < Math.abs(xy[best].x - px);
      if (l) best--;
      else if (r) best++;
      else break;
    }
    return best;
  };
  const select = (i: number) => {
    setSel((cur) => {
      if (cur !== i && dragging.current) navigator.vibrate?.(5);
      return i;
    });
  };
  const release = (clientX?: number) => {
    const g = gesture.current;
    gesture.current = null;
    if (g) clearTimeout(g.timer);
    dragging.current = false;
    setScrubbing(false);
    setReading(false);
    setSel(latest);
    setShift(0);
    if (g?.mode === "swipe" && clientX != null) {
      const dx = clientX - g.x;
      if (Math.abs(dx) >= SWIPE_PX) onSwipe(dx < 0 ? 1 : -1);
    }
  };

  const selP = points[sel] ?? points[latest];
  const selXY = xy[sel] ?? xy[latest];
  const dateWord = (d: string) => (d === today ? "Today" : dm(d));
  const tipText = `${fmt(selP.value, p)} ${unit}`.trim();
  const tipX = Math.min(width - 60, Math.max(48, selXY.x));
  const first = points[0];
  const last = points[latest];
  const label = `${series.name}, ${RANGE_WORD[range]}: from ${fmt(first.value, p)} to ${fmt(last.value, p)} ${unit}. Latest ${fmt(last.value, p)} on ${dateWord(last.date)}.${plan?.rings[0] ? ` Goal ${one(plan.rings[0].target)} ${unit} by ${dmy(plan.rings[0].byDate, today)}.` : ""}`;

  return (
    <>
      <div
        ref={box}
        className={`pg-chart${scrubbing ? " scrubbing" : ""}`}
        role="img"
        aria-label={label}
        tabIndex={0}
        // A finger (or the mouse button) on the chart scrubs from the moment
        // it lands and follows every move; the chart owns its touches
        // (touch-action: none), since letting the page pan meant iOS took
        // the finger for scrolling and the drag stopped.
        style={shift ? { height: H, transform: `translateX(${Math.round(shift * 0.35)}px)`, opacity: Math.max(0.4, 1 - Math.abs(shift) / 400) } : { height: H }}
        onPointerDown={(e) => startDrag(e.currentTarget, e.pointerId, e.clientX, e.clientY)}
        onPointerMove={(e) => moveDrag(e.clientX, e.clientY, e.pointerType)}
        onPointerUp={(e) => release(e.clientX)}
        onPointerCancel={() => release()}
        onPointerLeave={() => {
          if (!gesture.current) release();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setSel((s) => Math.max(0, s - 1));
          else if (e.key === "ArrowRight") setSel((s) => Math.min(latest, s + 1));
          else if (e.key === "Home") setSel(0);
          else if (e.key === "End") setSel(latest);
          else return;
          setReading(true);
          e.preventDefault();
        }}
        onBlur={() => release()}
      >
        <svg className="pg-chart-svg" width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
          {gridAt.map((v) => (
            <line key={v} className="pg-grid" x1={0} x2={plotW} y1={crisp(y(v))} y2={crisp(y(v))} />
          ))}
          {series.target != null && <line className="pg-target" x1={0} x2={plotW} y1={y(series.target)} y2={y(series.target)} />}
          {/* The latest a dot, pulsing, where they stand now (2 Nov, Alex, with a goal; 4 Nov, Alex: "on all the graphs"):
              every metric in its colour, every range; with a goal the line and dot in the weight's own blue over the beige
              plan (3 Nov, Alex). */}
          <g className="pg-chart-fade">
            {plan?.segs.map((s) => (
              <line key={`s${s.n0}`} className={`pg-plan${s.later ? " later" : ""}`} x1={xd(s.n0)} y1={y(s.v0)} x2={xd(s.n1)} y2={y(s.v1)} />
            ))}
            {xy.length > 1 && <path className="pg-line" d={line} />}
            <circle className="pg-nowpulse" cx={xy[latest].x} cy={xy[latest].y} r={4.5} />
            <circle className="pg-last" cx={xy[latest].x} cy={xy[latest].y} r={4.5} />
            {/* The goal being worked on pulses all the time in its beige (3 Nov, Alex), as on the coach's card. */}
            {plan?.rings.map((r) =>
              r.later ? null : <circle key={`p${r.n}`} className="pg-goalpulse" cx={xd(r.n)} cy={y(r.v)} r={5} />,
            )}
            {plan?.rings.map((r) => (
              <circle key={`r${r.n}`} className={`pg-goalring${r.later ? " later" : ""}`} cx={xd(r.n)} cy={y(r.v)} r={5} />
            ))}
          </g>
          {reading && (
            <>
              <line className="pg-guide" x1={selXY.x} x2={selXY.x} y1={TOP} y2={H - BOTTOM} />
              <circle className="pg-knob" cx={selXY.x} cy={selXY.y} r={4.5} />
            </>
          )}
        </svg>
        {gridAt.map((v) => (
          <span key={v} className="pg-grid-label" style={{ top: crisp(y(v)), left: plotW + 6 }}>
            {fmt(v, p)}
          </span>
        ))}
        {series.target != null && (
          <span className="pg-target-label" style={{ top: y(series.target) }}>
            Goal {fmt(series.target, p)}
          </span>
        )}
        {plan?.rings.map((r) =>
          r.pinned ? (
            <span key={`l${r.n}`} className="pg-goal-pin" style={{ top: y(r.v), left: xd(r.n) }}>
              <Bars parts={[`${one(r.target)} ${unit}`, dmy(r.byDate, today)]} />
            </span>
          ) : (
            <span key={`l${r.n}`} className={`pg-goal-label${r.later ? " later" : ""}${xd(r.n) < 56 ? " after" : ""}`} style={{ top: y(r.v), left: xd(r.n) }}>
              {one(r.v)} {unit}
            </span>
          )
        )}
        {reading && (
          <div className="pg-tip" style={{ left: tipX }}>
            {tipText}
            <span>{dateWord(selP.date)}</span>
          </div>
        )}
      </div>
      {/* Outside the role="img" box, whose children screen readers skip. */}
      <span className="pg-live" aria-live="polite">
        {tipText}, {dateWord(selP.date)}
      </span>
      {/* The strip stops at today, its marks still under their days, when the plot runs on to a goal (2 Nov, Alex). */}
      {/* Under the plot alone, the chart's own 16px either side (3 Nov, Alex: it ran out to the screen's edge on the left). */}
      <div className="pg-strip" style={{ marginLeft: 16, marginRight: 16 + right + Math.max(0, plotW - xToday) }} aria-hidden="true">
        {strip.map((q) => (
          // Centred on its days, the ends half as wide, so a reading's ring sits over the middle of its mark (25 Oct, Alex).
          <i key={q.from} className={q.on ? "on" : ""} style={{ flexGrow: Math.min(end, q.to + 0.5) - Math.max(start, q.from - 0.5) }} />
        ))}
      </div>
      {plotEnd > end ? (
        // Run on to a goal: the first day, Today where today is, and the plot's last day on the right (2 Nov, Alex).
        <div className="pg-axis pg-axis-goal" style={{ marginRight: 16 + right }}>
          <span>{dm(dayStr(start))}</span>
          {xToday > 44 && plotW - xToday > 52 && (
            <span className="now" style={{ left: xToday }}>
              Today
            </span>
          )}
          <span>{dmy(dayStr(plotEnd), today)}</span>
        </div>
      ) : (
        <div className="pg-axis" style={{ paddingRight: right }}>
          <span>{dm(dayStr(start))}</span>
          {end - start >= 2 && <span>{dm(dayStr(Math.round((start + end) / 2)))}</span>}
          <span>Today</span>
        </div>
      )}
    </>
  );
}

function dayStr(n: number): string {
  return new Date(n * DAY).toISOString().slice(0, 10);
}

// ---- History: every value, newest first, twenty a page, each with its
// change on the one before. Flat rows parted by space alone. ----
function MetricHistory({ series, today, page, onPage }: { series: CheckInSeries; today: string; page: number; onPage: (n: number) => void }) {
  const head = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => [...series.points].reverse(), [series.points]);
  const n = rows.length;
  const pages = Math.max(1, Math.ceil(n / PAGE));
  const cur = Math.min(page, pages - 1);
  const from = cur * PAGE;
  const shown = rows.slice(from, from + PAGE);
  const p = series.precision;
  const unit = unitOf(series);
  const dateText = (d: string) => dayWords(d, { weekday: "short" });

  const go = (to: number) => {
    const next = Math.max(0, Math.min(pages - 1, to));
    if (next === cur) return;
    onPage(next);
    const h = head.current;
    const sc = h?.closest(".ci-scroll") as HTMLElement | null;
    if (h && sc) {
      const top = sc.scrollTop + h.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12;
      sc.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? "auto" : "smooth" });
    }
  };

  // Up to five page numbers, windowed around the current one.
  const winFrom = Math.max(0, Math.min(cur - 2, pages - 5));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => winFrom + i);

  return (
    <section className="pg-hist" aria-label={`${series.name}: history`}>
      <div ref={head} className="pg-hist-head">
        <span className="pg-hist-title">History</span>
        <span className="pg-hist-count">
          {n} {n === 1 ? "entry" : "entries"}
        </span>
      </div>
      {/* The values and their changes in columns down the page (23 Oct, Alex): the change column as wide as the page's
          widest change, so every value ends at one edge and every change at another. */}
      <ul
        className="pg-hist-list"
        style={{ "--pg-chg": `${Math.max(0, ...shown.map((r, k) => (rows[from + k + 1] ? signed(r.value - rows[from + k + 1].value, p).length : 0)))}ch` } as React.CSSProperties}
      >
        {shown.map((r, k) => {
          const before = rows[from + k + 1];
          return (
            <li key={r.date} className="pg-hist-row">
              <span className="pg-hist-date">{dateText(r.date)}</span>
              <span className="pg-hist-value">
                <span className="pg-hist-num">
                  {fmt(r.value, p)}
                  {unit && ` ${unit}`}
                </span>
                <small>{before ? signed(r.value - before.value, p) : ""}</small>
              </span>
            </li>
          );
        })}
      </ul>
      {n > PAGE && (
        <nav className="pg-pager" aria-label="History pages">
          <div className="pg-pager-row">
            <button type="button" className="pg-pager-arrow" onClick={() => go(cur - 1)} disabled={cur === 0} aria-label="Newer">
              <ChevronLeftIcon />
            </button>
            {nums.map((i) => (
              <button key={i} type="button" className={`pg-pager-num${i === cur ? " on" : ""}`} onClick={() => go(i)} aria-label={`Page ${i + 1}`} aria-current={i === cur ? "page" : undefined}>
                {i + 1}
              </button>
            ))}
            <button type="button" className="pg-pager-arrow" onClick={() => go(cur + 1)} disabled={cur >= pages - 1} aria-label="Older">
              <ChevronRightIcon />
            </button>
          </div>
          <div className="pg-pager-caption">
            {from + 1}–{Math.min(n, from + PAGE)} of {n}
          </div>
        </nav>
      )}
    </section>
  );
}
