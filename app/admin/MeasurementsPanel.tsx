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
  phaseEmptyReason,
} from "../lib/queries";
import CheckInDaySelect from "./CheckInDaySelect";
import SavedStamp from "./SavedStamp";
import { MetricsPendingProvider, WhenNothingQueued } from "./MetricsPending";
import MetricLibrary, { LibraryPackView } from "./MetricLibrary";
import MetricGroups, { type MetricRow } from "./MetricGroups";
import MeasurementsBlock from "./MeasurementsBlock";
import LifestylePhaseHeader from "./LifestylePhaseHeader";
import CopyPhaseMetrics from "./CopyPhaseMetrics";
import LoggedDataBlock from "./LoggedDataBlock";
import MessageAboutButton from "./MessageAbout";

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
  // weeks, and the feed the same periods. Only this phase's metrics, and a
  // phase that has not started has nothing logged yet: a blank canvas, not
  // the running phase's history. One that has ended reads back from its end.
  const started = !selected || selected.status === "now" || selected.status === "past";
  let until: string | undefined;
  if (selected?.status === "past") {
    const end = new Date(`${selected.end_week}T00:00:00`);
    end.setDate(end.getDate() + 6);
    until = localDateStr(end);
  }
  const scope = phases.length ? { metrics, until } : undefined;
  const daily = getLoggedValues(clientId, "daily", started ? 8 : 0, scope);
  const weekly = getLoggedValues(clientId, "weekly", started ? 5 : 0, scope);
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
  const startsOn = selected ? new Date(`${selected.start_week}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const loggedHint = !started
    ? selected?.status === "draft"
      ? "Nothing yet · a draft"
      : `Nothing yet · starts ${startsOn}`
    : totalAsked === 0
      ? "Nothing asked for yet"
      : `${totalDone} of ${totalAsked} check-ins done`;
  const notes = started ? listCheckInNotes(clientId, 12).filter((n) => !until || n.period <= until) : [];

  return (
    // One card: the phase band on top, and under it everything that belongs
    // to that phase. The band says whether the client is seeing this, so the
    // old "Live in their app / changes save as you go" strip is gone — it
    // said the same thing twice, in a paragraph.
    <section className="ph-card">
      <LifestylePhaseHeader
        clientId={clientId}
        today={today}
        phases={phases}
        selectedId={selected?.id ?? null}
        emptyReason={selected ? phaseEmptyReason(selected.id) : null}
      />

      <MeasurementsBlock
        id="metrics"
        title="Tracked metrics"
        hint={metrics.length === 0 ? "Nothing asked for yet" : `${metrics.length}${isLive || phases.length === 0 ? " live" : ""} · ${dailyCount} daily, ${metrics.length - dailyCount} weekly`}
      >
        {/* Keyed by phase: what is queued for one phase is not carried to another. */}
        <MetricsPendingProvider key={selected?.id ?? 0} clientId={clientId} phaseId={selected?.id ?? null}>
        <MetricLibrary clientId={clientId} phaseId={selected?.id ?? null} packs={packs} groups={METRIC_GROUPS.map((g) => ({ key: g.key, label: g.label }))} />
        {metrics.length === 0 && (
          <WhenNothingQueued>
          <div className="mx-blank">
            <p className="ad-panel-empty">
              {selected && (selected.status === "draft" || selected.status === "next")
                ? "A blank board. Tick what this phase should ask for, or start from the one running now."
                : "Nothing yet. Open the metric library and tick what this client should log."}
            </p>
            {selected && (selected.status === "draft" || selected.status === "next") && live && (
              <CopyPhaseMetrics clientId={clientId} fromId={live.id} toId={selected.id} fromName={live.name} />
            )}
          </div>
          </WhenNothingQueued>
        )}
        <MetricGroups metrics={rows} groupInfo={METRIC_GROUPS.map((g) => ({ key: g.key, label: g.label, tint: g.tint }))} />
        <div className="mx-foot">
          <span>Weekly check-in opens on</span>
          <CheckInDaySelect clientId={clientId} value={getClientProfile(clientId).check_in_day} />
          {/* These save as they are made; this says so when one has. */}
          <SavedStamp
            // Per phase: switching phase is not a save.
            key={selected?.id ?? 0}
            signature={`${selected?.id ?? 0}|${getClientProfile(clientId).check_in_day}|${rows.map((r) => `${r.id}:${r.frequency}:${r.groupKey}:${r.name}:${r.unit ?? ""}`).join(",")}`}
            note={selected && (selected.status === "draft" || selected.status === "next") ? "in this phase, not in their app until it is live" : "their check-in asks for this now"}
          />
        </div>
        </MetricsPendingProvider>
      </MeasurementsBlock>

      <MeasurementsBlock id="logged" title="Logged data" hint={loggedHint}>
        <LoggedDataBlock
          daily={daily}
          weekly={weekly}
          notStarted={!started ? (selected?.status === "draft" ? "Nothing logged yet. This phase is a draft." : `Nothing logged yet. This phase starts ${startsOn}.`) : null}
        />
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
                {/* A reply lands on their Home, linked to the check-in the note was on. */}
                <MessageAboutButton
                  className="ms-note-reply"
                  text="Reply"
                  target={{
                    link: { kind: "checkin", section: n.kind === "daily" ? "daily" : "weekly", period: n.period },
                    area: "Measurements",
                    label: `${KIND_LABEL[n.kind]} · ${new Date(`${n.period}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
                  }}
                />
              </div>
            ))}
          </div>
        </MeasurementsBlock>
      )}
    </section>
  );
}
