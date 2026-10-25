"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import type { CheckInSection } from "./CheckInScreen";
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

type Range = "7D" | "1M" | "3M" | "All";
const RANGE_DAYS: Record<Range, number | null> = { "7D": 7, "1M": 30, "3M": 90, All: null };
const RANGE_WORD: Record<Range, string> = { "7D": "7 days", "1M": "month", "3M": "3 months", All: "" };
// What the capsule says (the stored key stays 7D).
const RANGE_LABEL: Record<Range, string> = { "7D": "1W", "1M": "1M", "3M": "3M", All: "All" };
const RANGES: Range[] = ["7D", "1M", "3M", "All"];
const RANGE_KEY = "ironline:progress-range";
const PAGE = 20;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;
const dayNum = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / DAY;
const dm = (s: string) => `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]}`;
const fmt = (v: number, p: number) => v.toLocaleString("en-GB", { minimumFractionDigits: p, maximumFractionDigits: p });
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
  // last one, which left it on the far chip after any trip away).
  const [index, setIndex] = useState(0);
  const [range, setRange] = useState<Range>(() => {
    const r = readStore("session", RANGE_KEY) as Range | null;
    return r && RANGES.includes(r) ? r : "1M";
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
  if (!series) return <p className="ci-empty">Nothing logged yet. Your first check-in shows up here.</p>;

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
  const firstDay = dayNum(series.points[0].date);
  // Days of history, first reading to today: a range longer than that is hidden.
  const span = end - firstDay + 1;
  const ranges = RANGES.filter((r) => RANGE_DAYS[r] == null || span > RANGE_DAYS[r]!);
  const shown: Range = ranges.includes(range) ? range : "All";
  const days = RANGE_DAYS[shown];
  const start = days ? end - (days - 1) : firstDay;
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
  return (
    <section className="pg-metric" role="tabpanel" aria-label={series.name} style={{ "--cat": series.colour } as React.CSSProperties}>
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
                  <span className="pg-sr">{rangeWord ? ` over the last ${rangeWord}` : " since the first entry"}</span>
                </span>
              )}
            </div>
            <span className="pg-name">{series.name}</span>
          </div>
          <div className="pg-range" role="radiogroup" aria-label="Time range">
            {ranges.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={r === shown} className={r === shown ? "on" : ""} onClick={() => onRange(r)}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {points.length === 0 ? (
        <div className="pg-chart-empty">
          <span>Nothing logged in the last {rangeWord}</span>
          <button type="button" onClick={() => onRange("All")}>
            Show all
          </button>
        </div>
      ) : (
        <Chart key={shown} series={series} points={points} start={start} end={end} today={today} range={shown} onSwipe={onSwipe} />
      )}
    </section>
  );
}

function Chart({
  series,
  points,
  start,
  end,
  today,
  range,
  onSwipe,
}: {
  series: CheckInSeries;
  points: CheckInSeries["points"];
  start: number;
  end: number;
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
  let lo: number;
  let hi: number;
  if (series.scaleMax) {
    lo = 0.5;
    hi = series.scaleMax + 0.5;
  } else {
    const all = series.target != null ? [...vals, series.target] : vals;
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
  const x = (date: string) => ((dayNum(date) - start) / Math.max(1, end - start)) * plotW;
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * plotH;
  const crisp = (v: number) => Math.round(v) + 0.5;
  const xy = points.map((q) => ({ x: x(q.date), y: y(q.value) }));
  // Smoothed (25 Oct, Alex: "very spikey"): each corner turned into a soft bend from the middle of the leg before to the
  // middle of the leg after, the reading as its pull. The bend stays inside its two legs, so it never swings past a
  // reading; a sharp day-to-day zigzag reads as the trend it is. The ends are the first and last readings.
  const f1 = (n: number) => n.toFixed(1);
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => `${f1((a.x + b.x) / 2)} ${f1((a.y + b.y) / 2)}`;
  const line =
    xy.length < 3
      ? xy.map((q, i) => `${i ? "L" : "M"}${f1(q.x)} ${f1(q.y)}`).join("")
      : `M${f1(xy[0].x)} ${f1(xy[0].y)}L${mid(xy[0], xy[1])}` +
        xy
          .slice(1, -1)
          .map((q, k) => `Q${f1(q.x)} ${f1(q.y)} ${mid(q, xy[k + 2])}`)
          .join("") +
        `L${f1(xy[xy.length - 1].x)} ${f1(xy[xy.length - 1].y)}`;

  // The marker: the latest point until the mouse is over the chart or a
  // finger is on it, then the logged point nearest it; back to the latest on
  // release. While reading, an ink guide and ring and the value in a white
  // pill; otherwise only the latest point's ring. Two gestures on the chart
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
  const label = `${series.name}, ${range === "All" ? "all time" : `last ${RANGE_WORD[range]}`}: from ${fmt(first.value, p)} to ${fmt(last.value, p)} ${unit}. Latest ${fmt(last.value, p)} on ${dateWord(last.date)}.`;

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
          <g className="pg-chart-fade">
            {xy.length > 1 && <path className="pg-line" d={line} />}
            <circle className="pg-last" cx={xy[latest].x} cy={xy[latest].y} r={4.5} />
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
      <div className="pg-axis" style={{ paddingRight: right }}>
        <span>{dm(dayStr(start))}</span>
        {end - start >= 2 && <span>{dm(dayStr(Math.round((start + end) / 2)))}</span>}
        <span>Today</span>
      </div>
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
  const year = today.slice(0, 4);
  const dateText = (d: string) => {
    const wd = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    return `${wd} ${dm(d)}${d.slice(0, 4) === year ? "" : ` ${d.slice(0, 4)}`}`;
  };

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
