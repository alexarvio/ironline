import { logMetricPeriodAction } from "../lib/actions";
import { listMetricDefinitions, localDateStr } from "../lib/queries";
import CheckinCategoryCard from "./CheckinCategoryCard";

export default function TrackerLogForm({
  clientId,
  frequency,
  loggedForPeriod,
}: {
  clientId: number;
  frequency: "daily" | "weekly";
  loggedForPeriod: boolean;
}) {
  const definitions = listMetricDefinitions(clientId, frequency);
  if (definitions.length === 0) return null;

  return (
    <CheckinCategoryCard
      title={frequency === "daily" ? "Daily check-in" : "Weekly check-in"}
      subtitle={
        frequency === "daily"
          ? "Whatever your coach set up for you to log each day."
          : "One entry covers the whole week."
      }
      statusLabel={loggedForPeriod ? "Logged" : `${definitions.length} to log`}
      statusDone={loggedForPeriod}
      defaultOpen={!loggedForPeriod}
    >
      <form action={logMetricPeriodAction} className="tracker-metric-form">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="frequency" value={frequency} />
        {/* No date picker for the client — daily always logs against today,
            weekly always logs against the current week, so there's nothing
            to pick. */}
        <input type="hidden" name="date" value={localDateStr()} />
        {definitions.map((def) => (
          <div key={def.id} className="tracker-metric-row">
            <label htmlFor={`${frequency}-metric-${def.id}`}>
              {def.name}
              {def.unit ? <span className="tracker-metric-unit"> ({def.unit})</span> : null}
            </label>
            <input
              id={`${frequency}-metric-${def.id}`}
              name={`metric_${def.id}`}
              type="number"
              step="0.1"
              placeholder="—"
            />
          </div>
        ))}
        <button className="btn" type="submit">
          Save
        </button>
      </form>
    </CheckinCategoryCard>
  );
}
