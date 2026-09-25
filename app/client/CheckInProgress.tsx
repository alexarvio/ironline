"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";

// The check-in's Progress view: one chart at a time, for a metric the coach
// has the client tracking. Its name sits centred on the banner's foot with a
// chevron either side to step through them, and the chart slides the way
// you went. The chart has no frame: the readings up the side on round steps,
// time running left to right (the last 7 days, month, or all of it) without
// labels; press and hold anywhere on it and a label follows your finger with
// the reading under it and its date.
//
// The types mirror CheckInHistory in lib/queries.ts, which a client file
// can't import.
export type CheckInSeries = {
  key: string;
  name: string;
  unit: string;
  scaleMax: number | null;
  cadence: "daily" | "weekly" | "measurement";
  points: { date: string; value: number; at: string | null }[];
};
export type CheckInFeedDay = { date: string; items: { name: string; value: string }[]; note: string | null };
export type CheckInHistory = { series: CheckInSeries[]; days: CheckInFeedDay[] };

type Range = "7D" | "1M" | "All";
const RANGES: Range[] = ["7D", "1M", "All"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;
const dayNum = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / DAY;
const dm = (s: string) => `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]}`;
const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
const valueText = (s: CheckInSeries, v: number) => (s.scaleMax ? `${fmt(v)}/${s.scaleMax}` : `${fmt(v)}${s.unit ? ` ${s.unit}` : ""}`);
const dateText = (s: CheckInSeries, date: string) => (s.cadence === "weekly" ? `Week of ${dm(date)}` : dm(date));

// Round steps for the side: 1, 2, 2.5 or 5 times a power of ten, about four of them.
function niceTicks(lo: number, hi: number): number[] {
  if (hi - lo < 1e-9) {
    const pad = Math.max(1, Math.abs(hi) * 0.05);
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + step / 2; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return ticks;
}

export default function CheckInProgress({ history, today }: { history: CheckInHistory; today: string }) {
  const tracked = history.series;
  const [index, setIndex] = useState(() => Math.max(0, tracked.findIndex((s) => s.points.length > 0)));
  // Which way the last step went, so the chart slides in from that side.
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const [range, setRange] = useState<Range>("1M");
  const series = tracked[index] ?? tracked[0];

  const step = (by: 1 | -1) => {
    setDir(by === 1 ? "next" : "prev");
    setIndex((i) => (i + by + tracked.length) % tracked.length);
  };

  // A sideways swipe anywhere under the banner steps too: the page follows
  // the finger, and past a quarter of the width (or a quick flick) it moves
  // on, the next metric sliding in from that side; short of that it springs
  // back. Up and down stays the page's scroll, and a reading held on the
  // chart is never taken for a swipe.
  const wrap = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | null; dx: number } | null>(null);
  const setShift = (dx: number, animate: boolean) => {
    const el = wrap.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease" : "none";
    el.style.transform = dx ? `translateX(${dx}px)` : "";
    el.style.opacity = dx ? String(Math.max(0.4, 1 - Math.abs(dx) / 600)) : "";
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (tracked.length < 2 || e.touches.length !== 1) return;
    swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), axis: null, dx: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const sw = swipe.current;
    if (!sw) return;
    if (wrap.current?.querySelector(".cg-chart.scrubbing")) {
      swipe.current = null;
      setShift(0, true);
      return;
    }
    const dx = e.touches[0].clientX - sw.x;
    const dy = e.touches[0].clientY - sw.y;
    if (!sw.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      sw.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (sw.axis !== "x") return;
    sw.dx = dx;
    setShift(dx, false);
  };
  const onTouchEnd = () => {
    const sw = swipe.current;
    swipe.current = null;
    if (!sw || sw.axis !== "x") return;
    const width = wrap.current?.clientWidth ?? 320;
    const flick = Math.abs(sw.dx) > 40 && Date.now() - sw.t < 300;
    if (Math.abs(sw.dx) > width / 4 || flick) {
      setShift(0, false);
      step(sw.dx < 0 ? 1 : -1);
    } else setShift(0, true);
  };

  if (!series) return <p className="ci-empty">Your coach hasn&rsquo;t set up anything to track yet.</p>;

  // The range back from today; with less history than that (21 days of
  // readings on 1M), the chart spans what there is, first reading to today,
  // so it never opens on an empty stretch. All: from the first reading.
  const end = dayNum(today);
  const firstDay = series.points.length ? dayNum(series.points[0].date) : end - 29;
  const rangeStart = range === "7D" ? end - 6 : range === "1M" ? end - 29 : firstDay;
  const start = series.points.length ? Math.min(Math.max(rangeStart, firstDay), end - 1) : rangeStart;
  const points = series.points.filter((p) => dayNum(p.date) >= start && dayNum(p.date) <= end);

  return (
    <div ref={wrap} className="cg" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      {/* The metric: its name centred, a chevron either end to step through. */}
      <div className="cg-switch">
        <button type="button" className="cg-switch-btn" onClick={() => step(-1)} disabled={tracked.length < 2} aria-label="Previous metric">
          <ChevronLeftIcon />
        </button>
        <span key={series.key} className={`cg-switch-name${dir ? ` ${dir}` : ""}`} aria-live="polite">
          {series.name}
        </span>
        <button type="button" className="cg-switch-btn" onClick={() => step(1)} disabled={tracked.length < 2} aria-label="Next metric">
          <ChevronRightIcon />
        </button>
      </div>

      {/* Keyed on the metric so it slides in the way the chevron went. */}
      <div key={series.key} className={`cg-slide${dir ? ` ${dir}` : ""}`}>
        <section className="cg-plot">
          <div className="cg-head">
            <div className="cg-range" role="radiogroup" aria-label="Time range">
              {RANGES.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={r === range} className={r === range ? "on" : ""} onClick={() => setRange(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Chart key={range} series={series} points={points} start={start} end={end} />
        </section>
        <ReadingsLog series={series} />

      </div>
    </div>
  );
}

// Every reading of the metric, newest first, twenty to a page: the date on
// the left, the reading on the right. Older pages behind the arrows.
const PAGE = 20;
function ReadingsLog({ series }: { series: CheckInSeries }) {
  const [page, setPage] = useState(0);
  const rows = [...series.points].reverse();
  if (rows.length === 0) return null;
  const pages = Math.ceil(rows.length / PAGE);
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const weekday = (d: string) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return (
    <section className="cg-log" aria-label={`${series.name}: every reading`}>
      <div className="cg-log-head">
        <span>Log</span>
        <span>
          {rows.length} reading{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="cg-log-list">
        {shown.map((p) => (
          <li key={p.date} className="cg-log-row">
            <span className="cg-log-date">{series.cadence === "weekly" ? dateText(series, p.date) : `${weekday(p.date)} ${dm(p.date)}`}</span>
            <span className="cg-log-value">{valueText(series, p.value)}</span>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="cg-log-pager">
          <button type="button" onClick={() => setPage((n) => Math.max(0, n - 1))} disabled={page === 0} aria-label="Newer readings">
            <ChevronLeftIcon />
          </button>
          <span>
            {page + 1} of {pages}
          </span>
          <button type="button" onClick={() => setPage((n) => Math.min(pages - 1, n + 1))} disabled={page >= pages - 1} aria-label="Older readings">
            <ChevronRightIcon />
          </button>
        </div>
      )}
    </section>
  );
}

const HOLD_MS = 250;

function Chart({ series, points, start, end }: { series: CheckInSeries; points: CheckInSeries["points"]; start: number; end: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Nothing is picked until a finger (or the mouse) is held on the chart;
  // then the label follows it, and it goes when it lets go.
  const [picked, setPicked] = useState<number | null>(null);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; sx: number; sy: number; on: boolean }>({ timer: null, x: 0, sx: 0, sy: 0, on: false });
  useEffect(() => {
    const el = box.current;
    // While a reading is held the page doesn't scroll under the finger.
    const stop = (e: TouchEvent) => {
      if (hold.current.on) e.preventDefault();
    };
    el?.addEventListener("touchmove", stop, { passive: false });
    const h = hold.current;
    return () => {
      el?.removeEventListener("touchmove", stop);
      if (h.timer) clearTimeout(h.timer);
    };
  }, []);

  const H = 212;
  // Room at the top for the label: it rides along the top edge, a dashed
  // guide running down from it to the reading.
  const pad = { l: 38, r: 10, t: 52, b: 12 };
  const w = width - pad.l - pad.r;
  const h = H - pad.t - pad.b;

  // The side: a short rating (up to 1–6) every number; a longer one even
  // steps from 0 (0, 2, 4 … 10); anything else round steps around the readings.
  const vals = points.map((p) => p.value);
  const sm = series.scaleMax;
  const ticks = sm
    ? sm <= 6
      ? Array.from({ length: sm }, (_, i) => i + 1)
      : Array.from({ length: Math.ceil(sm / Math.ceil(sm / 5)) + 1 }, (_, i) => i * Math.ceil(sm / 5))
    : niceTicks(vals.length ? Math.min(...vals) : 0, vals.length ? Math.max(...vals) : 10);
  const yLo = ticks[0];
  const yHi = ticks[ticks.length - 1];
  const x = (date: string) => pad.l + ((dayNum(date) - start) / Math.max(1, end - start)) * w;
  const y = (v: number) => pad.t + (1 - (v - yLo) / Math.max(1e-9, yHi - yLo)) * h;

  const xy = points.map((p) => ({ x: x(p.date), y: y(p.value) }));
  const line = xy.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = xy.length > 1 ? `${line} L${xy[xy.length - 1].x.toFixed(1)},${pad.t + h} L${xy[0].x.toFixed(1)},${pad.t + h} Z` : "";

  const nearest = (clientX: number) => {
    const el = box.current;
    if (!el || xy.length === 0) return null;
    const px = clientX - el.getBoundingClientRect().left;
    let best = 0;
    xy.forEach((p, i) => {
      if (Math.abs(p.x - px) < Math.abs(xy[best].x - px)) best = i;
    });
    return best;
  };
  const release = () => {
    if (hold.current.timer) clearTimeout(hold.current.timer);
    hold.current = { timer: null, x: 0, sx: 0, sy: 0, on: false };
    setPicked(null);
  };

  const sel = picked != null && picked < points.length ? picked : null;
  const selP = sel != null ? points[sel] : null;
  const selXY = sel != null ? xy[sel] : null;
  const tipW = 92;
  const tipX = selXY ? Math.min(width - pad.r - tipW, Math.max(0, selXY.x - tipW / 2)) : 0;

  return (
    <div
      ref={box}
      className={`cg-chart${sel != null ? " scrubbing" : ""}`}
      onPointerDown={(e) => {
        const el = e.currentTarget;
        const id = e.pointerId;
        hold.current.x = e.clientX;
        hold.current.sx = e.clientX;
        hold.current.sy = e.clientY;
        hold.current.timer = setTimeout(() => {
          hold.current.on = true;
          try {
            el.setPointerCapture(id);
          } catch {}
          setPicked(nearest(hold.current.x));
        }, HOLD_MS);
      }}
      onPointerMove={(e) => {
        hold.current.x = e.clientX;
        // Moving before the hold lands: a swipe or a scroll, so no reading.
        if (!hold.current.on && hold.current.timer && (Math.abs(e.clientX - hold.current.sx) > 8 || Math.abs(e.clientY - hold.current.sy) > 8)) {
          clearTimeout(hold.current.timer);
          hold.current.timer = null;
        }
        if (hold.current.on) setPicked(nearest(e.clientX));
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`${series.name} over time`}>
        <defs>
          <linearGradient id={`cg-fill-${series.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a6e" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#1e3a6e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* The side: gridlines on round steps, their values on the left. Time
            runs left to right unlabelled: holding a reading says its date. */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="cg-grid" />
            <text x={pad.l - 8} y={y(t)} className="cg-ylabel" textAnchor="end" dominantBaseline="middle">
              {fmt(t)}
            </text>
          </g>
        ))}
        {area && <path d={area} fill={`url(#cg-fill-${series.key})`} />}
        {xy.length > 1 && <path d={line} className="cg-line" />}
        {selXY && <line x1={selXY.x} x2={selXY.x} y1={44} y2={pad.t + h} className="cg-guide" />}
        {/* A dot a reading while there are few enough to tell apart; the held one always. */}
        {xy.map((p, i) =>
          i === sel || xy.length <= 31 ? <circle key={points[i].date} cx={p.x} cy={p.y} r={i === sel ? 5.5 : 2.75} className={i === sel ? "cg-dot on" : "cg-dot"} /> : null
        )}
      </svg>
      {selP && selXY && (
        <div className="cg-tip" style={{ left: tipX, top: 0 }}>
          <b>{valueText(series, selP.value)}</b>
          <small>{dateText(series, selP.date)}</small>
        </div>
      )}
      {points.length === 0 && <div className="cg-empty">No readings in this range</div>}
    </div>
  );
}
