"use client";

import { useState } from "react";
import type { LoggedMetric, LoggedValues } from "../lib/queries";
import { ChevronDownIcon } from "../components/icons";

// What the client actually submitted, two ways of reading it.
//
// Both read the SAME lookup: a value is `values["<metricId>:<periodKey>"]`,
// and missing means the client did not send it. Nothing about a period is
// stored — no total, no "complete" flag, no delta — so a summary can never
// disagree with the rows it summarises. The feed is not a second dataset: a
// feed row is one period's column of those same lookups.

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
  notStarted = null,
}: {
  daily: LoggedValues;
  weekly: LoggedValues;
  /** The phase on screen has not started: nothing to show, and why. */
  notStarted?: string | null;
}) {
  const [show, setShow] = useState<"table" | "feed">("table");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const view = cadence === "daily" ? daily : weekly;
  const valueFor = (metricId: number, period: string): number | null => view.values[`${metricId}:${period}`] ?? null;

  return (
    <>
      <div className="mx-log-controls">
        <div className="ms-viewby" role="group" aria-label="Show">
          <span className="ms-viewby-label">Show</span>
          {(["table", "feed"] as const).map((s) => (
            <button key={s} type="button" className={`ms-viewby-btn${show === s ? " on" : ""}`} onClick={() => setShow(s)} aria-pressed={show === s}>
              {s === "table" ? "Table" : "Feed"}
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
