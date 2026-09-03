import { setMetricCadenceAction } from "../lib/actions";

const OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
] as const;

// Daily / Weekly on a check-in column row. (Monthly was dropped: the client
// app has two rhythms, and anything still marked monthly rides in Weekly.) Each option is its own
// small form posting the new cadence, so it works without client JS and
// saves the moment it is clicked, like everything else on this tab. The
// current cadence is the filled segment; clicking it again does nothing.
export default function MetricCadenceToggle({
  metricId,
  value,
  name,
}: {
  metricId: number;
  value: string;
  name: string;
}) {
  return (
    <span className="ms-cadence-toggle" role="group" aria-label={`How often ${name} is logged`}>
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <form key={o.value} action={setMetricCadenceAction}>
            <input type="hidden" name="id" value={metricId} />
            <input type="hidden" name="frequency" value={o.value} />
            <button
              type="submit"
              className={`ms-cadence-opt${active ? " active" : ""}`}
              aria-pressed={active}
              disabled={active}
              title={active ? `Logged ${o.label.toLowerCase()}` : `Ask for this ${o.label.toLowerCase()} instead`}
            >
              {o.label}
            </button>
          </form>
        );
      })}
    </span>
  );
}
