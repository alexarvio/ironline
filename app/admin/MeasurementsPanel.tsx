import {
  addMetricDefinitionAction,
  removeMetricDefinitionAction,
} from "../lib/actions";
import {
  getClient,
  getClientProfile,
  getMetricHistory,
  listAllMetrics,
  listGraphChoices,
  METRIC_GROUPS,
  METRIC_LIBRARY,
  metricGroup,
} from "../lib/queries";
import ClientGraphsPicker from "./ClientGraphsPicker";
import CheckInDaySelect from "./CheckInDaySelect";
import AutosaveNote from "./AutosaveNote";
import MetricLibrary, { LibraryPackView } from "./MetricLibrary";
import MetricHistoryTable from "./MetricHistoryTable";
import TrackerHistory from "./TrackerHistory";
import MetricGraphPanel from "./MetricGraphPanel";

const CADENCE_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// Check-in configuration and history.
//
// This replaces the old Daily Tracker and Weekly Tracker tabs. Cadence is a
// property of a metric, not a reason for a screen — so a coach defines
// everything the client is asked for in one list here, and reads it back in
// the two tables below.
export default function MeasurementsPanel({ clientId }: { clientId: number }) {
  const metrics = listAllMetrics(clientId);
  const existing = new Set(metrics.map((m) => `${m.frequency}|${m.name.toLowerCase()}`));

  const packs: LibraryPackView[] = METRIC_LIBRARY.map((p) => ({
    id: p.id,
    label: p.label,
    group: p.group,
    cadence: p.cadence,
    items: p.items.map((i) => ({
      ...i,
      already: existing.has(`${p.cadence}|${i.name.toLowerCase()}`),
    })),
  }));

  // Daily and weekly readings share a table; monthly measurements get their
  // own. Readings on different rhythms can't be averaged into one grid, and
  // pretending otherwise would put a month-old waist figure beside yesterday's
  // sleep as if they were comparable.
  const daily = getMetricHistory(clientId, "daily");
  const weekly = getMetricHistory(clientId, "weekly");
  const monthly = getMetricHistory(clientId, "monthly");

  const graphable = metrics.filter((m) => m.frequency !== "monthly" || true);

  const clientName = getClient(clientId)?.name ?? "the client";
  // Server-stamped on each render; AutosaveNote flips to "Saved" only when
  // this changes, i.e. after an action has run. Same pattern as ProgramBuilder.
  // eslint-disable-next-line react-hooks/purity -- a server component render is the intended clock here
  const renderedAt = Date.now();

  return (
    <div className="ms">
      {/* Every control on this tab saves itself and is live in the client's
          app at once — there is no publish step, unlike the programme. Said
          out loud here because a coach setting up columns reasonably asks
          "has this reached them?", and a tab that saves silently can't
          answer. renderedAt is stamped on the server so the note only says
          Saved once the action has actually run. */}
      <div className="ms-topbar">
        <span className="ms-topbar-live">
          <span className="ms-live-dot" aria-hidden="true" />
          Live in {clientName}&rsquo;s app
        </span>
        <AutosaveNote
          renderedAt={renderedAt}
          idleText="Changes save as you go and reach the client immediately."
          savedSuffix="· live in the client app"
        />
      </div>

      {/* ---- 1. What the client is asked to log ---- */}
      <section className="ms-section">
        <div className="ms-head">
          <h3 className="ad-microlabel">Check-in columns</h3>
          <CheckInDaySelect clientId={clientId} value={getClientProfile(clientId).check_in_day} />
        </div>
        <MetricLibrary clientId={clientId} packs={packs} />

        {metrics.length === 0 ? (
          <p className="ad-panel-empty">
            Nothing yet — open the metric library and tick what this client should log.
          </p>
        ) : (
          <div className="ms-metric-list">
            {metrics.map((m) => {
              const g = metricGroup(m.category);
              return (
                <div key={m.id} className="ms-metric-row">
                  {/* Name leads the row; the two pills are fixed width so they
                      form straight columns down the list instead of jittering
                      with the length of each word. */}
                  <span className="ms-metric-name">
                    {m.name}
                    {m.unit && <em className="ms-metric-unit">({m.unit})</em>}
                  </span>
                  <span className="ms-group-pill" style={{ background: g.tint }}>
                    {g.label}
                  </span>
                  <span className="ms-cadence-pill">{CADENCE_LABEL[m.frequency] ?? m.frequency}</span>

                  {/* No per-row visibility toggle. Being on this list IS the
                      deployment: a column here is a column the client is asked
                      for. A hide switch made a second, invisible state the
                      coach had to remember; removing a column is the way to
                      stop asking for it. */}
                  <form action={removeMetricDefinitionAction} className="ms-metric-action">
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="ms-del" aria-label={`Delete ${m.name}`} title="Delete this metric and its history">
                      ×
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}

      </section>

      {/* ---- 2. What they logged ---- */}
      <section className="ms-section">
        <TrackerHistory daily={daily} weekly={weekly} />
      </section>

      <section className="ms-section">
        <h3 className="ad-microlabel">Measurements</h3>
        <MetricHistoryTable
          history={monthly}
          emptyNote="No monthly measurements configured yet — add them from the library."
          maxHeight={250}
        />
      </section>

      {/* ---- 3. What the client sees charted ---- */}
      <section className="ms-section">
        <ClientGraphsPicker choices={listGraphChoices(clientId)} />
      </section>

      {/* ---- 4. Graph (coach's own view) ---- */}
      <section className="ms-section">
        <h3 className="ad-microlabel">Trend</h3>
        <MetricGraphPanel
          metrics={graphable.map((m) => ({
            id: m.id,
            name: m.name,
            unit: m.unit,
            cadence: CADENCE_LABEL[m.frequency] ?? m.frequency,
          }))}
        />
      </section>
    </div>
  );
}
