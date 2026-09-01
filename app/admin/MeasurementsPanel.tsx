import {
  addMetricDefinitionAction,
  removeMetricDefinitionAction,
  setMetricVisibleAction,
} from "../lib/actions";
import {
  getMetricHistory,
  listAllMetrics,
  METRIC_GROUPS,
  METRIC_LIBRARY,
  metricGroup,
} from "../lib/queries";
import MetricLibrary, { LibraryPackView } from "./MetricLibrary";
import MetricHistoryTable from "./MetricHistoryTable";
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

  return (
    <div className="ms">
      {/* ---- 1. What the client is asked to log ---- */}
      <section className="ms-section">
        <div className="ms-head">
          <h3 className="ad-microlabel">Check-in columns</h3>
          <MetricLibrary clientId={clientId} packs={packs} />
        </div>

        {metrics.length === 0 ? (
          <p className="ad-panel-empty">
            Nothing yet — open the metric library and tick what this client should log.
          </p>
        ) : (
          <div className="ms-metric-list">
            {metrics.map((m) => {
              const g = metricGroup(m.category);
              const visible = m.visible_to_client !== false;
              return (
                <div key={m.id} className="ms-metric-row">
                  {/* Fixed-width group and cadence pills, so they form
                      straight columns instead of jittering with word length. */}
                  <span className="ms-group-pill" style={{ background: g.tint }}>
                    {g.label}
                  </span>
                  <span className="ms-cadence-pill">{CADENCE_LABEL[m.frequency] ?? m.frequency}</span>
                  <span className="ms-metric-name">{m.name}</span>
                  <span className="ms-metric-unit">{m.unit || "—"}</span>

                  {/* Hidden metrics stay configured and keep their history;
                      they just drop off the client's check-in. */}
                  <form action={setMetricVisibleAction} className="ms-metric-action">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="visible" value={visible ? "false" : "true"} />
                    <button
                      type="submit"
                      className={`ms-eye${visible ? " on" : ""}`}
                      title={visible ? "On the client's check-in — click to hide" : "Hidden from the client — click to show"}
                      aria-label={visible ? `Hide ${m.name}` : `Show ${m.name}`}
                    >
                      {visible ? "◉" : "◌"}
                    </button>
                  </form>

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

        {/* The manual row stays for one-offs the library doesn't cover. */}
        <form action={addMetricDefinitionAction} className="ms-manual">
          <input type="hidden" name="clientId" value={clientId} />
          <input name="name" type="text" placeholder="Metric name" aria-label="Metric name" required />
          <input name="unit" type="text" placeholder="Unit" aria-label="Unit" />
          <select name="frequency" aria-label="Cadence" defaultValue="daily">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <select name="category" aria-label="Group" defaultValue="other">
            {METRIC_GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn secondary btn-sm">
            Add
          </button>
        </form>
      </section>

      {/* ---- 2. What they logged ---- */}
      <section className="ms-section">
        <h3 className="ad-microlabel">Daily &amp; weekly tracker</h3>
        <div className="ms-tables">
          <MetricHistoryTable
            history={daily}
            emptyNote="No daily metrics configured yet."
            maxHeight={290}
          />
          {weekly.columns.length > 0 && (
            <MetricHistoryTable
              history={weekly}
              emptyNote="No weekly metrics configured yet."
              maxHeight={290}
            />
          )}
        </div>
      </section>

      <section className="ms-section">
        <h3 className="ad-microlabel">Measurements</h3>
        <MetricHistoryTable
          history={monthly}
          emptyNote="No monthly measurements configured yet — add them from the library."
          maxHeight={250}
        />
      </section>

      {/* ---- 3. Graph ---- */}
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
