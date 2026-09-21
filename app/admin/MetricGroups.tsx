"use client";

import { useEffect, useState } from "react";
import { removeMetricDefinitionAction } from "../lib/actions";
import MetricCadenceToggle from "./MetricCadenceToggle";
import { ChevronDownIcon } from "../components/icons";
import { useMetricsPending } from "./MetricsPending";

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
  /** Queued on the bar, not saved yet. */
  isNew?: boolean;
};

export default function MetricGroups({ metrics: saved, groupInfo = [] }: { metrics: MetricRow[]; groupInfo?: { key: string; label: string; tint: string }[] }) {
  const pending = useMetricsPending();
  // What is queued shows in place: added rows in their group, marked new.
  const metrics: MetricRow[] = [
    ...saved,
    ...(pending?.adds ?? []).map((a) => {
      const g = groupInfo.find((x) => x.key === a.group) ?? groupInfo.find((x) => x.key === "other") ?? { key: a.group, label: "Other", tint: "#dfe6ef" };
      return { id: a.tempId, name: a.name, unit: a.unit, frequency: a.cadence, groupKey: g.key, groupLabel: g.label, tint: g.tint, last: null, isNew: true };
    }),
  ];
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
  const pending = useMetricsPending();
  const [chosen, setOpen] = useState(false);
  // A group something was just added to opens, so the addition is seen.
  const hasNew = group.rows.some((r) => r.isNew);
  const open = chosen || hasNew;
  // … and stays open once they are applied, rather than folding over them.
  useEffect(() => {
    if (!hasNew) return;
    setOpen(true);
    try {
      localStorage.setItem(key, "1");
    } catch {}
  }, [hasNew, key]);
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
          {group.rows.map((m) => {
            const going = !!pending?.removes.has(m.id);
            const frequency = pending?.cadence[m.id] ?? m.frequency;
            return (
            <div key={m.id} className={`ms-metric-row${m.isNew ? " is-new" : ""}${going ? " is-going" : ""}`}>
              <span className="ms-metric-name">
                {m.name}
                {m.unit && <em className="ms-metric-unit">({m.unit})</em>}
              </span>
              <span className="mx-metric-last">{m.isNew ? "New · not saved yet" : going ? "Will be removed" : m.last ?? "Nothing logged yet"}</span>
              <span className="ms-group-pill" style={{ background: m.tint }}>
                {m.groupLabel}
              </span>
              {pending ? (
                <span className="ms-cadence-toggle" role="group" aria-label={`How often ${m.name} is logged`}>
                  {(["daily", "weekly"] as const).map((o) => (
                    <button key={o} type="button" className={`ms-cadence-opt${frequency === o ? " active" : ""}`} aria-pressed={frequency === o} disabled={going} onClick={() => pending.setCadence(m.id, o, m.isNew ? null : m.frequency)}>
                      {o === "daily" ? "Daily" : "Weekly"}
                    </button>
                  ))}
                </span>
              ) : (
                <MetricCadenceToggle metricId={m.id} value={m.frequency} name={m.name} />
              )}
              {/* Being on this list IS the deployment: a metric here is one
                  the client is asked for. Removing it stops the asking; what
                  they already logged stays. */}
              {pending ? (
                <span className="ms-metric-action">
                  <button type="button" className="ms-del" onClick={() => pending.toggleRemove(m.id)} aria-label={going ? `Keep ${m.name}` : `Remove ${m.name}`} title={going ? "Keep it" : m.isNew ? "Don't add it" : "Stop asking for this metric"}>
                    {going ? "↺" : "×"}
                  </button>
                </span>
              ) : (
                <form action={removeMetricDefinitionAction} className="ms-metric-action">
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="ms-del" aria-label={`Delete ${m.name}`} title="Stop asking for this metric">
                    ×
                  </button>
                </form>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
