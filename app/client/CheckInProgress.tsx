"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import type { CheckInSection } from "./CheckInScreen";
import AreaChart, { type ChartPoint } from "./charts/AreaChart";

// The check-in's Progress view (28 Sep, option 9a): a row of metric chips,
// one chart card for the chosen metric in its category's colour (the
// eyebrow, the line, the fade, the target and the marker; all else neutral)
// with a 7D / 1M / 3M / All toggle, and under it the plain history, newest
// first, twenty a page. No averages, no deltas, no week grouping.
//
// The types mirror CheckInHistory in lib/queries.ts, which a client file
// can't import.
export type CheckInSeries = {
  key: string;
  name: string;
  unit: string;
  scaleMax: number | null;
  cadence: "daily" | "weekly" | "measurement";
  /** The admin group the metric belongs to (its label), and that group's colour for the chart. */
  category: string;
  colour: string;
  colourRgb: string;
  /** The coach's target for it, if any: the dashed line. */
  target: number | null;
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
const RANGES: Range[] = ["7D", "1M", "3M", "All"];
const METRIC_KEY = "ironline:progress-metric";
const RANGE_KEY = "ironline:progress-range";
const PAGE = 20;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;
const dayNum = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / DAY;
const dm = (s: string) => `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]}`;
const fmt = (v: number, p: number) => v.toLocaleString("en-GB", { minimumFractionDigits: p, maximumFractionDigits: p });
const unitOf = (s: CheckInSeries) => (s.scaleMax ? `/ ${s.scaleMax}` : s.unit);
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
  const [index, setIndex] = useState(() => {
    const last = readStore("local", METRIC_KEY);
    const i = last ? tracked.findIndex((s) => s.key === last) : -1;
    return i >= 0 ? i : 0;
  });
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
    writeStore("local", METRIC_KEY, tracked[next].key);
  };
  const chooseRange = (r: Range) => {
    setRange(r);
    writeStore("session", RANGE_KEY, r);
  };

  // A sideways swipe anywhere under the chips (the chips scroll themselves)
  // steps to the next metric: over 40px across with under 30px up or down.
  // A finger held on the chart is scrubbing it, never a swipe.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || (e.target as HTMLElement).closest(".pg-chips")) return;
    swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || (e.currentTarget as HTMLElement).querySelector(".pg-chart.scrubbing")) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dy) < 30) pick(index + (dx < 0 ? 1 : -1));
  };

  if (!series) return <p className="ci-empty">Nothing logged yet. Your first check-in shows up here.</p>;

  return (
    <div className="pg-view" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => (swipe.current = null)}>
      <MetricChips tracked={tracked} active={index} onPick={pick} />
      <MetricChartCard key={series.key} series={series} today={today} range={range} onRange={chooseRange} />
      <MetricHistory series={series} today={today} page={page} onPage={setPage} />
    </div>
  );
}

// ---- The chips: one neutral style, the chosen one dark. ----
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

// ---- The chart card. ----
const H = 164;
const TOP = 22;
const BOTTOM = 8;
const LEFT = 34;

function MetricChartCard({
  series,
  today,
  range,
  onRange,
}: {
  series: CheckInSeries;
  today: string;
  range: Range;
  onRange: (r: Range) => void;
}) {
  const cat = { hex: series.colour, rgb: series.colourRgb };
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
  return (
    <section className="pg-card" role="tabpanel" aria-label={series.name} style={{ "--cat": cat.hex, "--cat-rgb": cat.rgb } as React.CSSProperties}>
      <div className="pg-head">
        <div className="pg-head-text">
          <span className="pg-eyebrow">{series.category}</span>
          <span className="pg-name">{series.name}</span>
        </div>
        <div className="pg-range" role="radiogroup" aria-label="Time range">
          {ranges.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={r === shown} className={r === shown ? "on" : ""} onClick={() => onRange(r)}>
              {r}
            </button>
          ))}
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
        <Chart key={shown} series={series} points={points} start={start} end={end} today={today} range={shown} cat={cat} />
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
  cat,
}: {
  series: CheckInSeries;
  points: CheckInSeries["points"];
  start: number;
  end: number;
  today: string;
  range: Range;
  cat: { hex: string; rgb: string };
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
  const plotW = width - LEFT;
  const plotH = H - TOP - BOTTOM;
  const x = (date: string) => LEFT + ((dayNum(date) - start) / Math.max(1, end - start)) * plotW;
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * plotH;
  const xy: ChartPoint[] = points.map((q) => ({ x: x(q.date), y: y(q.value) }));
  const dense = (range === "3M" || range === "All") && points.length > 60;

  // The marker: the latest point until the mouse is over the chart or a
  // finger has been held on it a moment (a quick sideways touch is a swipe
  // to the next metric, not a scrub), then the logged point nearest it;
  // back to the latest on release.
  const latest = points.length - 1;
  const [sel, setSel] = useState(latest);
  const [scrubbing, setScrubbing] = useState(false);
  const dragging = useRef(false);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; sx: number; sy: number }>({ timer: null, x: 0, sx: 0, sy: 0 });
  useEffect(() => {
    const el = box.current;
    // While a reading is held the page doesn't scroll under the finger.
    const stop = (e: TouchEvent) => {
      if (dragging.current) e.preventDefault();
    };
    el?.addEventListener("touchmove", stop, { passive: false });
    const h = hold.current;
    return () => {
      el?.removeEventListener("touchmove", stop);
      if (h.timer) clearTimeout(h.timer);
    };
  }, []);
  const startDrag = (el: HTMLElement, pointerId: number, clientX: number) => {
    dragging.current = true;
    setScrubbing(true);
    try {
      el.setPointerCapture(pointerId);
    } catch {}
    select(nearest(clientX));
  };
  const nearest = (clientX: number) => {
    const el = box.current;
    if (!el) return latest;
    const px = clientX - el.getBoundingClientRect().left;
    // Start from where a point would sit at that x, then look either way.
    let best = Math.round(((px - LEFT) / Math.max(1, plotW)) * latest);
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
  const release = () => {
    if (hold.current.timer) clearTimeout(hold.current.timer);
    hold.current.timer = null;
    dragging.current = false;
    setScrubbing(false);
    setSel(latest);
  };

  const selP = points[sel] ?? points[latest];
  const selXY = xy[sel] ?? xy[latest];
  const dateWord = (d: string) => (d === today ? "Today" : dm(d));
  const tipText = `${fmt(selP.value, p)} ${unit}`.trim();
  const tipX = Math.min(width - 60, Math.max(48, selXY.x));
  const gridAt = [0.2, 0.5, 0.8].map((f) => lo + (hi - lo) * f);
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
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") {
            startDrag(e.currentTarget, e.pointerId, e.clientX);
            return;
          }
          const el = e.currentTarget;
          const id = e.pointerId;
          hold.current = { timer: setTimeout(() => startDrag(el, id, hold.current.x), 250), x: e.clientX, sx: e.clientX, sy: e.clientY };
        }}
        onPointerMove={(e) => {
          if (dragging.current) {
            hold.current.x = e.clientX;
            select(nearest(e.clientX));
            return;
          }
          if (e.pointerType !== "touch") {
            select(nearest(e.clientX));
            return;
          }
          // Moving before the hold lands: a swipe or a scroll, not a scrub.
          hold.current.x = e.clientX;
          if (hold.current.timer && (Math.abs(e.clientX - hold.current.sx) > 8 || Math.abs(e.clientY - hold.current.sy) > 8)) {
            clearTimeout(hold.current.timer);
            hold.current.timer = null;
          }
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setSel((s) => Math.max(0, s - 1));
          else if (e.key === "ArrowRight") setSel((s) => Math.min(latest, s + 1));
          else if (e.key === "Home") setSel(0);
          else if (e.key === "End") setSel(latest);
          else return;
          e.preventDefault();
        }}
        onBlur={release}
      >
        {gridAt.map((v) => (
          <div key={v} className="pg-grid" style={{ top: y(v) }}>
            <span>{fmt(v, p)}</span>
          </div>
        ))}
        {series.target != null && (
          <div className="pg-target" style={{ top: y(series.target) }}>
            <span>
              Target {fmt(series.target, p)} {unit}
            </span>
          </div>
        )}
        <div className="pg-chart-fade">
          <AreaChart points={xy} color={cat.hex} colorRgb={cat.rgb} width={width} height={H} bottom={H - BOTTOM} thin={dense} />
        </div>
        <div className="pg-guide" style={{ left: selXY.x }} />
        <div className="pg-knob" style={{ left: selXY.x, top: selXY.y }} />
        <div className="pg-tip" style={{ left: tipX }}>
          {tipText}
          <span>{dateWord(selP.date)}</span>
        </div>
        <span className="pg-live" aria-live="polite">
          {tipText} · {dateWord(selP.date)}
        </span>
      </div>
      <div className="pg-axis">
        <span>{dm(dayStr(start))}</span>
        <span>Today</span>
      </div>
    </>
  );
}

function dayStr(n: number): string {
  return new Date(n * DAY).toISOString().slice(0, 10);
}

// ---- History: every value, newest first, twenty a page. ----
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
      <ul className="pg-hist-list">
        {shown.map((r) => (
          <li key={r.date} className="pg-hist-row">
            <span className="pg-hist-date">{dateText(r.date)}</span>
            <span className="pg-hist-value">
              {fmt(r.value, p)}
              {unit && <small> {unit}</small>}
            </span>
          </li>
        ))}
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
            {from + 1}–{Math.min(n, from + PAGE)} of {n} · newest first
          </div>
        </nav>
      )}
    </section>
  );
}
