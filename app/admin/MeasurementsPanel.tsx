import {
  getClientProfile,
  getMetricEntries,
  getLoggedValues,
  listMetricsForPhase,
  listCheckInNotes,
  listLifestylePhases,
  localDateStr,
  METRIC_GROUPS,
  METRIC_LIBRARY,
  metricGroup,
} from "../lib/queries";
import CheckInDaySelect from "./CheckInDaySelect";
import MetricLibrary, { LibraryPackView } from "./MetricLibrary";
import MetricGroups, { type MetricRow } from "./MetricGroups";
import MeasurementsBlock from "./MeasurementsBlock";
import LifestylePhaseHeader from "./LifestylePhaseHeader";
import CopyPhaseMetrics from "./CopyPhaseMetrics";
import LoggedDataBlock from "./LoggedDataBlock";

const KIND_LABEL = { daily: "Daily check-in", weekly: "Weekly check-in", measurements: "Measurements" } as const;

// Check-in configuration and history.
//
// Two blocks: what the client is asked to log, and what they logged. Cadence
// is a property of a metric, not a reason for a screen, so one list defines
// everything and the tables below read it back. Daily and weekly are the only
// rhythms — a monthly figure cannot sit honestly in a grid beside yesterday's
// sleep — and nothing here charts: the client app has no chart to feed.
export default function MeasurementsPanel({ clientId, phaseParam }: { clientId: number; phaseParam?: string }) {
  // The phase being set up: the one asked for, else whatever is running.
  const phases = listLifestylePhases(clientId);
  const askedPhase = phaseParam && /^\d+$/.test(phaseParam) ? Number(phaseParam) : null;
  const live = phases.find((p) => p.status === "now") ?? null;
  const selected = phases.find((p) => p.id === askedPhase) ?? live ?? phases[0] ?? null;
  const isLive = !!selected && selected.status === "now";
  // With no phases at all the standing set is simply the client's metrics.
  const metrics = listMetricsForPhase(clientId, selected?.id ?? null, phases.length === 0 || isLive).filter((m) => m.frequency !== "monthly");
  // A column is identified by its name alone now that cadence is chosen on
  // the row rather than at add time, so "Sleep" counts as added whichever
  // rhythm it is on.
  const existing = new Set(metrics.map((m) => m.name.toLowerCase()));

  // The library's packs are defined per cadence (a daily Body pack and a
  // weekly one, say). Merged by label here so the coach sees one group per
  // theme, with any same-named item appearing once.
  const packs: LibraryPackView[] = [];
  METRIC_LIBRARY.forEach((p) => {
    let pack = packs.find((x) => x.label === p.label);
    if (!pack) {
      pack = { id: p.id, label: p.label, group: p.group, cadence: p.cadence, items: [] };
      packs.push(pack);
    }
    p.items.forEach((i) => {
      if (pack!.items.some((x) => x.name.toLowerCase() === i.name.toLowerCase())) return;
      pack!.items.push({ ...i, already: existing.has(i.name.toLowerCase()) });
    });
  });

  // Both presentations read one lookup; the table shows eight days or five
  // weeks, and the feed the same periods.
  const daily = getLoggedValues(clientId, "daily", 8);
  const weekly = getLoggedValues(clientId, "weekly", 5);
  const dailyCount = metrics.filter((m) => m.frequency === "daily").length;

  // The last thing logged against each metric, so a row says whether it is
  // actually being answered without opening the table below.
  const today = localDateStr();
  const fmtWhen = (period: string) => {
    const days = Math.round((new Date(`${period}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    if (days === 0) return "today";
    if (days === -1) return "yesterday";
    if (days > -7) return `${-days} days ago`;
    return new Date(`${period}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };
  const rows: MetricRow[] = metrics.map((m) => {
    const g = metricGroup(m.category);
    const entries = [...getMetricEntries([m.id])].sort((a, b) => a.period.localeCompare(b.period));
    const last = entries[entries.length - 1];
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      frequency: m.frequency === "weekly" ? "weekly" : "daily",
      groupKey: g.key,
      groupLabel: g.label,
      tint: g.tint,
      last: last ? `${last.value}${m.unit ? ` ${m.unit}` : ""} · ${fmtWhen(last.period)}` : null,
    };
  });

  // Check-ins done out of those asked for, derived the same way the block
  // derives its rows: a period with nothing in it is one that was missed.
  const done = (v: ReturnType<typeof getLoggedValues>) =>
    v.metrics.length === 0 ? 0 : v.periods.filter((p) => v.metrics.some((m) => v.values[`${m.id}:${p.key}`] != null)).length;
  const asked = (v: ReturnType<typeof getLoggedValues>) => (v.metrics.length === 0 ? 0 : v.periods.length);
  const totalDone = done(daily) + done(weekly);
  const totalAsked = asked(daily) + asked(weekly);
  const loggedHint = totalAsked === 0 ? "Nothing asked for yet" : `${totalDone} of ${totalAsked} check-ins done`;
  const notes = listCheckInNotes(clientId, 12);

  return (
    // One card: the phase band on top, and under it everything that belongs
    // to that phase. The band says whether the client is seeing this, so the
    // old "Live in their app / changes save as you go" strip is gone — it
    // said the same thing twice, in a paragraph.
    <section className="ph-card">
      <LifestylePhaseHeader clientId={clientId} today={today} phases={phases} selectedId={selected?.id ?? null} />

      <MeasurementsBlock
        id="metrics"
        title="Tracked metrics"
        hint={metrics.length === 0 ? "Nothing asked for yet" : `${metrics.length} live · ${dailyCount} daily, ${metrics.length - dailyCount} weekly`}
      >
        <MetricLibrary clientId={clientId} phaseId={selected && !isLive ? selected.id : null} packs={packs} groups={METRIC_GROUPS.map((g) => ({ key: g.key, label: g.label }))} />
        {metrics.length === 0 ? (
          <div className="mx-blank">
            <p className="ad-panel-empty">
              {selected && selected.status === "draft"
                ? "A blank board. Tick what this phase should ask for, or start from the one running now."
                : "Nothing yet. Open the metric library and tick what this client should log."}
            </p>
            {selected && selected.status === "draft" && live && (
              <CopyPhaseMetrics clientId={clientId} fromId={live.id} toId={selected.id} fromName={live.name} />
            )}
          </div>
        ) : (
          <MetricGroups metrics={rows} />
        )}
        <div className="mx-foot">
          <span>Weekly check-in opens on</span>
          <CheckInDaySelect clientId={clientId} value={getClientProfile(clientId).check_in_day} />
        </div>
      </MeasurementsBlock>

      <MeasurementsBlock id="logged" title="Logged data" hint={loggedHint}>
        <LoggedDataBlock daily={daily} weekly={weekly} />
      </MeasurementsBlock>

      {/* What the client wrote beside their numbers: why a day was off, what
          the figures do not say. Newest first, every section. */}
      {notes.length > 0 && (
        <MeasurementsBlock id="notes" title="Notes from the client" hint={`${notes.length}, newest first`}>
          <div className="ms-notes-list">
            {notes.map((n) => (
              <div key={n.id} className="ms-note">
                <span className="ms-note-meta">
                  {new Date(`${n.period}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {KIND_LABEL[n.kind]}
                </span>
                <span className="ms-note-text">{n.text}</span>
              </div>
            ))}
          </div>
        </MeasurementsBlock>
      )}
    </section>
  );
}
