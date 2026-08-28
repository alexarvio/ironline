import { Fragment } from "react";
import { addMetricDefinitionAction, applyMetricTemplateAction } from "../lib/actions";
import {
  getMetricEntries,
  getPinnedMetricsSummary,
  listDistinctMetricCategories,
  listDistinctMetricNames,
  listMetricDefinitions,
  listMetricPeriods,
  listMetricTemplateCategories,
  PINNED_METRIC_LIMIT,
} from "../lib/queries";
import ComboBoxInput from "../components/ComboBoxInput";
import TrackerMetricRow from "./TrackerMetricRow";

export default function TrackerPanel({
  clientId,
  frequency,
}: {
  clientId: number;
  frequency: "daily" | "weekly";
}) {
  const definitions = listMetricDefinitions(clientId, frequency);
  const entries = getMetricEntries(definitions.map((d) => d.id));
  const periods = listMetricPeriods(definitions.map((d) => d.id));
  const templates = listMetricTemplateCategories(frequency);
  const knownCategories = listDistinctMetricCategories(frequency);
  const knownNames = listDistinctMetricNames(frequency).map((n) => n.name);

  const valueFor = (defId: number, period: string) =>
    entries.find((e) => e.metric_definition_id === defId && e.period === period)?.value ?? null;

  const categories: string[] = [];
  definitions.forEach((d) => {
    if (!categories.includes(d.category)) categories.push(d.category);
  });
  // The 5-pin limit is per client across BOTH trackers, not per frequency —
  // so this counts pins client-wide, not just the metrics in this panel.
  const pinnedCount = getPinnedMetricsSummary(clientId).length;

  return (
    <div>
      <p className="empty-note" style={{ marginBottom: 18 }}>
        {frequency === "daily"
          ? "Build whatever daily check-in metrics make sense for this client — sleep hours, water in liters, steps, a 1-5 energy rating, anything. Each metric has its own unit."
          : "Same idea, logged once a week instead of daily — good for slower-moving check-ins like stress, recovery, or overall wellbeing."}{" "}
        Nothing here is a fixed preset — add or remove metrics for this client any time.
      </p>

      <div className="nutrition-table-wrap builder-card">
        <h3 className="builder-pill-heading">Add a metric</h3>

        {templates.length > 0 && (
          <form action={applyMetricTemplateAction} className="add-invoice-form add-metric-form" style={{ marginBottom: 14 }}>
            <input type="hidden" name="clientId" value={clientId} />
            <select name="templateCategoryId" defaultValue="">
              <option value="" disabled>
                Apply a saved preset…
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="btn secondary" type="submit">
              Apply
            </button>
          </form>
        )}

        <form action={addMetricDefinitionAction} className="add-invoice-form add-metric-form">
          <input type="hidden" name="clientId" defaultValue={clientId} />
          <input type="hidden" name="frequency" defaultValue={frequency} />
          <ComboBoxInput name="category" options={knownCategories} placeholder="Category (e.g. Sleep)" />
          <ComboBoxInput name="name" options={knownNames} placeholder="Metric name (e.g. Hours of sleep)" required />
          <input name="unit" type="text" placeholder="Unit (e.g. hours)" />
          <button className="btn" type="submit">
            Add metric
          </button>
        </form>
      </div>

      {definitions.length > 0 && (
        <div className="nutrition-table-wrap">
          <h3>Overview</h3>
          {periods.length === 0 && (
            <p className="empty-note" style={{ marginBottom: 12 }}>
              Metrics are set up — nothing logged yet. This fills in automatically once the
              client logs an entry from their app. You can still edit or remove a metric below.
            </p>
          )}
          <div className="exercise-table-wrap tracker-overview-scroll">
            <table className="data-table tracker-overview-table">
              <thead>
                <tr>
                  <th className="tracker-metric-col">Metric</th>
                  {periods.map((p) => (
                    <th key={p}>{p}</th>
                  ))}
                  <th className="tracker-actions-col"></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <Fragment key={cat}>
                    <tr>
                      <td colSpan={periods.length + 2} className="tracker-category-row">
                        {cat}
                      </td>
                    </tr>
                    {definitions
                      .filter((d) => d.category === cat)
                      .map((def) => (
                        <TrackerMetricRow
                          key={def.id}
                          def={def}
                          values={periods.map((p) => ({ period: p, value: valueFor(def.id, p) }))}
                          frequency={frequency}
                          pinnedCount={pinnedCount}
                          pinLimit={PINNED_METRIC_LIMIT}
                        />
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
