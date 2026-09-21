"use client";

import { useState } from "react";
import type React from "react";
import type { LoggedMetric, LoggedValues } from "../lib/queries";
import { ChevronDownIcon } from "../components/icons";
import MessageAboutButton from "./MessageAbout";

// What the client actually submitted, two ways of reading it.
//
// Both read the SAME lookup: a value is `values["<metricId>:<periodKey>"]`,
// and missing means the client did not send it. Nothing about a period is
// stored — no total, no "complete" flag, no delta — so a summary can never
// disagree with the rows it summarises. The feed is not a second dataset: a
// feed row is one period's column of those same lookups, and a graph is one
// metric's row of them.

const n = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 1 }));
// A word unit takes a space ("8 hours"); a scale butts up ("4/5"); steps are
// self-evident from the metric's own name.
const withUnit = (v: number, unit: string) => {
  const u = unit.trim();
  if (!u || u.toLowerCase() === "steps") return n(v);
  return u.startsWith("/") ? `${n(v)}${u}` : `${n(v)} ${u}`;
};

export default function LoggedDataBlock({
  daily,
  weekly,
  dailyLong,
  weeklyLong,
  notStarted = null,
}: {
  daily: LoggedValues;
  weekly: LoggedValues;
  /** A longer run of the same lookups, for the graph's wider range (30 days, 12 weeks). */
  dailyLong?: LoggedValues;
  weeklyLong?: LoggedValues;
  /** The phase on screen has not started: nothing to show, and why. */
  notStarted?: string | null;
}) {
  const [show, setShow] = useState<"table" | "graph" | "feed">("table");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const view = cadence === "daily" ? daily : weekly;
  const valueFor = (metricId: number, period: string): number | null => view.values[`${metricId}:${period}`] ?? null;

  return (
    <>
      <div className="mx-log-controls">
        <div className="ms-viewby" role="group" aria-label="Show">
          <span className="ms-viewby-label">Show</span>
          {(["table", "graph", "feed"] as const).map((s) => (
            <button key={s} type="button" className={`ms-viewby-btn${show === s ? " on" : ""}`} onClick={() => setShow(s)} aria-pressed={show === s}>
              {s === "table" ? "Table" : s === "graph" ? "Graph" : "Feed"}
            </button>
          ))}
        </div>
        <div className="ms-viewby" role="group" aria-label="View by">
          <span className="ms-viewby-label">View by</span>
          {(["daily", "weekly"] as const).map((c) => (
            <button key={c} type="button" className={`ms-viewby-btn${cadence === c ? " on" : ""}`} onClick={() => setCadence(c)} aria-pressed={cadence === c}>
              {c === "daily" ? "Daily" : "Weekly"}
            </button>
          ))}
        </div>
      </div>

      {notStarted ? (
        <p className="mx-log-empty">{notStarted}</p>
      ) : view.metrics.length === 0 ? (
        <p className="mx-log-empty">No {cadence} metrics in this phase. Add one above.</p>
      ) : show === "table" ? (
        <Table view={view} valueFor={valueFor} />
      ) : show === "graph" ? (
        <Graphs key={cadence} view={(cadence === "daily" ? dailyLong : weeklyLong) ?? view} cadence={cadence} shortCount={cadence === "daily" ? 7 : 5} />
      ) : (
        <Feed view={view} cadence={cadence} valueFor={valueFor} />
      )}
    </>
  );
}

// One grid for the whole table: the header, every row and the Change line are
// cells of the same container, so a column cannot resolve its own width and
// drift off the heading above it.
function Table({ view, valueFor }: { view: LoggedValues; valueFor: (m: number, p: string) => number | null }) {
  const cols = `150px repeat(${view.metrics.length}, minmax(max-content, 1fr))`;

  // The change across what is on screen, not across the stored history: the
  // footer has to be provable from the rows above it.
  const change = (m: LoggedMetric) => {
    const seen = view.periods.map((p) => valueFor(m.id, p.key)).filter((v): v is number => v != null);
    if (seen.length < 2) return null;
    const [newest, oldest] = [seen[0], seen[seen.length - 1]];
    const delta = Math.round((newest - oldest) * 10) / 10;
    // A percentage of nothing is not a number, so it is left off.
    const pct = oldest === 0 ? null : Math.round((delta / Math.abs(oldest)) * 100);
    const good = m.goodDirection === "none" || delta === 0 ? "" : (m.goodDirection === "down") === delta < 0 ? " change-down" : " change-up";
    return { text: `${delta > 0 ? "+" : ""}${n(delta)}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}`, good };
  };

  return (
    <div className="tracker-overview-scroll mx-log-scroll">
      <div className="mx-log-grid" style={{ gridTemplateColumns: cols }}>
        <div className="mx-log-cell mx-log-date mx-log-head">Date</div>
        {view.metrics.map((m) => (
          <div key={m.id} className="mx-log-cell mx-log-head">
            <span className="mx-log-metric">{m.name}</span>
            <span className="mx-log-cat" style={{ color: m.colour }}>
              {m.categoryLabel}
              {m.unit ? ` · ${m.unit}` : ""}
            </span>
          </div>
        ))}

        {view.periods.map((p, i) => (
          <div key={p.key} className="contents">
            <div className={`mx-log-cell mx-log-date${i === 0 ? " now" : ""}`}>{p.label}</div>
            {view.metrics.map((m) => {
              const v = valueFor(m.id, p.key);
              return (
                <div key={m.id} className={`mx-log-cell mx-log-value${i === 0 ? " now" : ""}${v == null ? " none" : ""}`}>
                  {v == null ? "—" : n(v)}
                </div>
              );
            })}
          </div>
        ))}

        <div className="mx-log-cell mx-log-date mx-log-change">Change</div>
        {view.metrics.map((m) => {
          const c = change(m);
          return (
            <div key={m.id} className={`mx-log-cell mx-log-change${c ? c.good : " none"}`}>
              {c ? c.text : "—"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One row per period the client was asked for, whether or not anything came:
// a gap is data, and it says "Missed" rather than being left out.
function Feed({ view, cadence, valueFor }: { view: LoggedValues; cadence: "daily" | "weekly"; valueFor: (m: number, p: string) => number | null }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="mx-log-feed">
      {view.periods.map((p) => {
        const filled = view.metrics.map((m) => ({ m, v: valueFor(m.id, p.key) })).filter((x) => x.v != null) as { m: LoggedMetric; v: number }[];
        const missing = view.metrics.length - filled.length;
        const isOpen = open === p.key;
        const state = filled.length === 0 ? { text: "Missed", tone: "warn" } : missing === 0 ? { text: "Complete", tone: "good" } : { text: `${missing} missing`, tone: "none" };
        const note = view.notes[p.key];

        return (
          <div key={p.key} className={`mx-log-day${isOpen ? " open" : ""}`}>
            <button type="button" className="mx-log-row" onClick={() => setOpen((x) => (x === p.key ? null : p.key))} aria-expanded={isOpen}>
              <span className={`mx-log-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                <ChevronDownIcon />
              </span>
              <span className="mx-log-daydate">{p.label}</span>
              <span className={`mx-log-kind ${cadence}`}>{cadence === "daily" ? "Daily" : "Weekly"}</span>
              <span className="mx-log-summary">
                {filled
                  .slice(0, 3)
                  .map((x) => `${x.m.name} ${withUnit(x.v, x.m.unit)}`)
                  .join(" · ") || "Nothing submitted"}
              </span>
              <span className={`mx-log-state ${state.tone}`}>{state.text}</span>
            </button>

            {isOpen && (
              <div className="mx-log-body">
                {/* Only what was logged: the state above already says how
                    many are missing, so empty tiles would say it twice. */}
                {filled.map((x) => (
                  <div key={x.m.id} className="mx-log-tile">
                    <span className="mx-log-tile-label">{x.m.name}</span>
                    <span className="mx-log-tile-value">
                      {n(x.v)}
                      {x.m.unit && <small>{x.m.unit.startsWith("/") ? x.m.unit : ` ${x.m.unit}`}</small>}
                    </span>
                  </div>
                ))}
                {note && (
                  <div className="mx-log-note">
                    <span className="mx-log-tile-label">Note</span>
                    <p>{note}</p>
                  </div>
                )}
                <div className="ma-row">
                  <MessageAboutButton
                    target={{
                      link: { kind: "checkin", section: cadence, period: p.key },
                      area: "Measurements",
                      label: `${cadence === "daily" ? "Daily" : "Weekly"} check-in · ${p.label}`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// One big chart, one metric at a time, picked from the list beside it (the
// metrics under their categories, each with its latest figure). One at a
// time because weight in kilos and steps in thousands cannot share an axis
// without one of them going flat. The same periods as the table, oldest on
// the left; a period the client skipped is a gap in the line, not a line
// drawn across it.
function Graphs({ view, cadence, shortCount }: { view: LoggedValues; cadence: "daily" | "weekly"; shortCount: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  // The range on the chart: the last week (or five weeks), or all that was read.
  const [range, setRange] = useState<"short" | "long">("short");
  const valueFor = (metricId: number, period: string): number | null => view.values[`${metricId}:${period}`] ?? null;
  const metric = view.metrics.find((m) => m.id === picked) ?? view.metrics[0];
  const hasLong = view.periods.length > shortCount;
  const periods = [...(range === "short" ? view.periods.slice(0, shortCount) : view.periods)].reverse();
  const unitWord = cadence === "daily" ? "days" : "weeks";
  const latest = (m: LoggedMetric) => {
    for (const p of view.periods) {
      const v = valueFor(m.id, p.key);
      if (v != null) return v;
    }
    return null;
  };
  // The list folds by category, as the tracked metrics do above; the one
  // holding the metric on the chart is open.
  const cats: { label: string; colour: string; metrics: LoggedMetric[] }[] = [];
  for (const m of view.metrics) {
    let c = cats.find((x) => x.label === m.categoryLabel);
    if (!c) cats.push((c = { label: m.categoryLabel, colour: m.colour, metrics: [] }));
    c.metrics.push(m);
  }
  const [closed, setClosed] = useState<Set<string>>(new Set());

  return (
    <div className="mx-graphs">
      <nav className="mx-graph-list" aria-label="Metric on the graph">
        {cats.map((c) => {
          const open = !closed.has(c.label) || c.metrics.some((m) => m.id === metric.id);
          return (
            <div key={c.label} className="mx-graph-cat">
              <button
                type="button"
                className="mx-graph-cat-head"
                aria-expanded={open}
                onClick={() =>
                  setClosed((prev) => {
                    const next = new Set(prev);
                    if (next.has(c.label)) next.delete(c.label);
                    else next.add(c.label);
                    return next;
                  })
                }
              >
                <span className="mx-graph-key" style={{ background: c.colour }} aria-hidden="true" />
                <span>{c.label}</span>
                <span className={`mx-log-chev${open ? " open" : ""}`} aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </button>
              {open &&
                c.metrics.map((m) => {
                  const v = latest(m);
                  return (
                    <button key={m.id} type="button" className={`mx-graph-pick${m.id === metric.id ? " on" : ""}`} aria-pressed={m.id === metric.id} onClick={() => setPicked(m.id)}>
                      <span>{m.name}</span>
                      <em>{v == null ? "—" : withUnit(v, m.unit)}</em>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </nav>
      <MetricGraph
        key={metric.id}
        metric={metric}
        points={periods.map((p) => ({ label: p.label, value: valueFor(metric.id, p.key) }))}
        rangeSwitch={
          hasLong ? (
            <div className="ms-viewby" role="group" aria-label="Range">
              {(["short", "long"] as const).map((r) => (
                <button key={r} type="button" className={`ms-viewby-btn${range === r ? " on" : ""}`} onClick={() => setRange(r)} aria-pressed={range === r}>
                  Last {r === "short" ? shortCount : view.periods.length} {unitWord}
                </button>
              ))}
            </div>
          ) : null
        }
      />
    </div>
  );
}

const W = 900;
const H = 300;
const PAD = { l: 8, r: 8, t: 14, b: 10 };

// 1 / 2 / 5 steps, so the axis reads 86 / 87 / 88 rather than 86.3 / 87.1.
function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi <= lo) return [lo];
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  const step = (r > 5 ? 10 : r > 2 ? 5 : r > 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1000; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

function MetricGraph({ metric: m, points, rangeSwitch = null }: { metric: LoggedMetric; points: { label: string; value: number | null }[]; rangeSwitch?: React.ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const seen = points.map((p, i) => ({ ...p, i })).filter((p): p is { label: string; value: number; i: number } => p.value != null);
  const unit = m.unit.trim();
  const tail = unit && unit.toLowerCase() !== "steps" ? (unit.startsWith("/") ? unit : ` ${unit}`) : "";

  if (seen.length === 0) {
    return (
      <section className="mx-graph">
        <GraphHead metric={m} rangeSwitch={rangeSwitch} />
        <p className="mx-graph-empty">Nothing logged for {m.name} in this range.</p>
      </section>
    );
  }

  const first = seen[0];
  const last = seen[seen.length - 1];
  const delta = Math.round((last.value - first.value) * 10) / 10;
  const tone = seen.length < 2 || m.goodDirection === "none" || delta === 0 ? "" : (m.goodDirection === "down") === delta < 0 ? " good" : " warn";
  const avg = Math.round((seen.reduce((t, p) => t + p.value, 0) / seen.length) * 10) / 10;

  // A rating out of N sits on its own full scale, so a steady 8 does not read
  // as a cliff; everything else gets some of its range as breathing room.
  const scale = /^\/\s*(\d+)$/.exec(unit);
  const lo0 = Math.min(...seen.map((p) => p.value));
  const hi0 = Math.max(...seen.map((p) => p.value));
  const pad = hi0 - lo0 > 0 ? (hi0 - lo0) * 0.15 : Math.max(Math.abs(hi0) * 0.02, 0.5);
  const [lo, hi] = scale ? [0, Number(scale[1])] : [lo0 - pad, hi0 + pad];
  const x = (i: number) => PAD.l + (points.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (points.length - 1));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const ticks = niceTicks(lo, hi);
  // A handful of dates along the foot: first, last and a few between.
  // Up to ten periods each get their date (a week reads Mon to Sun with no
  // day left out); a longer range gets first, last and a few between.
  const dateCount = points.length <= 10 ? points.length : 6;
  const dateAt = [...new Set(Array.from({ length: dateCount }, (_, k) => (dateCount === 1 ? 0 : Math.round((k * (points.length - 1)) / (dateCount - 1)))))];

  // Runs of consecutive logged periods: each is one stroke, so a gap stays a gap.
  const runs: { i: number; value: number }[][] = [];
  for (const p of seen) {
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1].i === p.i - 1) run.push(p);
    else runs.push([p]);
  }
  const shown = hover != null ? seen.find((p) => p.i === hover) ?? null : null;
  // Every reading gets its dot while there is room for them to stay apart.
  const allDots = seen.length <= 31;

  return (
    <section className="mx-graph">
      <GraphHead metric={m} rangeSwitch={rangeSwitch} />
      <div className="mx-graph-figure">
        <span className="mx-graph-now">
          {n((shown ?? last).value)}
          {tail && <small>{tail}</small>}
        </span>
        <span className="mx-graph-when">{shown ? shown.label : `Latest · ${last.label}`}</span>
        <span className="mx-graph-stats">
          <span className={`mx-graph-delta${tone}`}>{seen.length < 2 ? "One reading" : `${delta > 0 ? "+" : ""}${n(delta)}${tail} since ${first.label}`}</span>
          <span>
            Average {n(avg)}
            {tail} · {seen.length} of {points.length} logged
          </span>
        </span>
      </div>
      <div className="mx-graph-frame">
        <div className="mx-graph-yaxis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ top: `${(y(t) / H) * 100}%` }}>
              {n(t)}
            </span>
          ))}
        </div>
        <div className="mx-graph-plot">
          <svg
            className="mx-graph-svg"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${m.name}: ${seen.length} readings, latest ${n(last.value)}${tail}`}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              // The nearest period that has a reading, by the pointer's x.
              const box = e.currentTarget.getBoundingClientRect();
              const at = ((e.clientX - box.left) / box.width) * W;
              let best = seen[0];
              for (const p of seen) if (Math.abs(x(p.i) - at) < Math.abs(x(best.i) - at)) best = p;
              setHover(best.i);
            }}
          >
            {ticks.map((t) => (
              <line key={t} className="mx-graph-base" x1={0} x2={W} y1={y(t)} y2={y(t)} vectorEffect="non-scaling-stroke" />
            ))}
            {runs.map((run, r) =>
              run.length === 1 ? null : <polyline key={r} className="mx-graph-line" points={run.map((p) => `${x(p.i)},${y(p.value)}`).join(" ")} vectorEffect="non-scaling-stroke" />
            )}
            {shown && <line className="mx-graph-cross" x1={x(shown.i)} x2={x(shown.i)} y1={0} y2={H} vectorEffect="non-scaling-stroke" />}
          </svg>
          {/* Dots sit outside the stretched SVG so they stay round. */}
          <div className="mx-graph-dots" aria-hidden="true">
            {seen
              .filter((p) => allDots || p.i === last.i || p.i === hover || runs.some((run) => run.length === 1 && run[0].i === p.i))
              .map((p) => (
                <i key={p.i} className={p.i === hover ? "on" : p.i === last.i ? "last" : ""} style={{ left: `${(x(p.i) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` }} />
              ))}
          </div>
        </div>
      </div>
      <div className="mx-graph-axis" aria-hidden="true">
        {dateAt.map((i) => (
          <span key={i} style={{ left: `${(x(i) / W) * 100}%` }}>
            {points[i].label}
          </span>
        ))}
      </div>
    </section>
  );
}

function GraphHead({ metric: m, rangeSwitch = null }: { metric: LoggedMetric; rangeSwitch?: React.ReactNode }) {
  return (
    <header className="mx-graph-head">
      <span className="mx-graph-key" style={{ background: m.colour }} aria-hidden="true" />
      <span className="mx-graph-name">{m.name}</span>
      <span className="mx-graph-catname">{m.categoryLabel}</span>
      {rangeSwitch}
    </header>
  );
}
