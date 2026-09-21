"use client";

import { useEffect, useState } from "react";
import { removeMetricDefinitionAction } from "../lib/actions";
import MetricCadenceToggle from "./MetricCadenceToggle";
import { ChevronDownIcon } from "../components/icons";

// The metrics a client is asked for, grouped by what they are about. Every
// group starts closed: a client can be on a dozen columns, and a flat list of
// them was a wall to scroll past on the way to the one being changed. Which
// groups a coach leaves open is theirs, so it is remembered for them rather
// than for the client they happen to be looking at.

export type MetricRow = {
  id: number;
  name: string;
  unit: string;
  frequency: "daily" | "weekly";
  groupKey: string;
  groupLabel: string;
  tint: string;
  /** "7.5 h · yesterday", or null when nothing has been logged yet. */
  last: string | null;
};

export default function MetricGroups({ metrics }: { metrics: MetricRow[] }) {
  const groups: { key: string; label: string; tint: string; rows: MetricRow[] }[] = [];
  for (const m of metrics) {
    let g = groups.find((x) => x.key === m.groupKey);
    if (!g) groups.push((g = { key: m.groupKey, label: m.groupLabel, tint: m.tint, rows: [] }));
    g.rows.push(m);
  }
  return (
    <div className="mx-groups">
      {groups.map((g) => (
        <Group key={g.key} group={g} />
      ))}
    </div>
  );
}

function Group({ group }: { group: { key: string; label: string; tint: string; rows: MetricRow[] } }) {
  const key = `ironline.metrics.group.${group.key}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(key) === "1") setOpen(true);
    } catch {}
  }, [key]);
  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem(key, v ? "0" : "1");
      } catch {}
      return !v;
    });

  const daily = group.rows.filter((r) => r.frequency === "daily").length;
  const weekly = group.rows.length - daily;

  return (
    <div className="mx-group">
      <button type="button" className="mx-group-head" onClick={toggle} aria-expanded={open}>
        <span className={`mx-group-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
        <span className="mx-group-key" style={{ background: group.tint }} aria-hidden="true" />
        <span className="mx-group-name">{group.label}</span>
        <span className="mx-group-split">
          {daily ? `${daily} daily` : ""}
          {daily && weekly ? " · " : ""}
          {weekly ? `${weekly} weekly` : ""}
        </span>
        <span className="mx-group-count">
          {group.rows.length} {group.rows.length === 1 ? "metric" : "metrics"}
        </span>
      </button>

      {open && (
        <div className="ms-metric-list">
          {group.rows.map((m) => (
            <div key={m.id} className="ms-metric-row">
              <span className="ms-metric-name">
                {m.name}
                {m.unit && <em className="ms-metric-unit">({m.unit})</em>}
              </span>
              <span className="mx-metric-last">{m.last ?? "Nothing logged yet"}</span>
              <span className="ms-group-pill" style={{ background: m.tint }}>
                {m.groupLabel}
              </span>
              <MetricCadenceToggle metricId={m.id} value={m.frequency} name={m.name} />
              {/* Being on this list IS the deployment: a metric here is one
                  the client is asked for. Removing it stops the asking; what
                  they already logged stays. */}
              <form action={removeMetricDefinitionAction} className="ms-metric-action">
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className="ms-del" aria-label={`Delete ${m.name}`} title="Stop asking for this metric">
                  ×
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
