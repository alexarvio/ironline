import { togglePinMeasurementFieldAction, togglePinMetricAction } from "../lib/actions";
import { GraphChoice, PINNED_METRIC_LIMIT } from "../lib/queries";

// Which of this client's figures are charted on their phone's Home screen.
//
// One row per graphable figure with an on/off switch at the end, in the same
// row grammar as the check-in columns above it, so the coach reads it as
// "the list of things this client tracks, and which ones they see charted".
// Up to PINNED_METRIC_LIMIT can be on; past that, the remaining switches are
// disabled with the reason in their tooltip rather than failing on click.
// Server component: each switch is its own form posting to the existing
// toggle action, so it works without any client JS.
export default function ClientGraphsPicker({ choices }: { choices: GraphChoice[] }) {
  const onCount = choices.filter((c) => c.pinned).length;
  const full = onCount >= PINNED_METRIC_LIMIT;

  return (
    <div className="cg">
      <div className="ms-head">
        <h3 className="ad-microlabel">Client graphs</h3>
        <span className="cg-count" title="How many figures are charted on the client's Home screen">
          {onCount}/{PINNED_METRIC_LIMIT} shown
        </span>
      </div>
      {choices.length === 0 ? (
        <p className="ad-panel-empty">Add a check-in column or measurement first, then choose what to chart.</p>
      ) : (
        <div className="ms-metric-list">
          {choices.map((c) => {
            const blocked = !c.pinned && full;
            const thin = c.pointCount < 2;
            return (
              <div key={c.key} className={`ms-metric-row cg-row${c.pinned ? " is-on" : ""}`}>
                <span className="ms-metric-name">
                  {c.name}
                  {c.unit && <em className="ms-metric-unit">({c.unit})</em>}
                </span>
                <span className="ms-cadence-pill">{c.cadenceLabel}</span>
                <span className="cg-points" title="Logged values so far">
                  {c.pointCount} {c.pointCount === 1 ? "pt" : "pts"}
                  {c.pinned && thin && (
                    <em title="A chart needs at least two logged values before it appears on the client's screen">
                      {" "}
                      · needs 2+
                    </em>
                  )}
                </span>
                <form
                  action={c.kind === "field" ? togglePinMeasurementFieldAction : togglePinMetricAction}
                  className="ms-metric-action"
                >
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className={`cg-switch${c.pinned ? " on" : ""}`}
                    role="switch"
                    aria-checked={c.pinned}
                    aria-label={`${c.pinned ? "Stop charting" : "Chart"} ${c.name} on the client's Home screen`}
                    disabled={blocked}
                    title={
                      blocked
                        ? `Only ${PINNED_METRIC_LIMIT} can be shown at once — turn one off first.`
                        : c.pinned
                          ? "Shown on the client's Home screen"
                          : "Not shown on the client's Home screen"
                    }
                  >
                    <span className="cg-knob" />
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
      <p className="ad-field-note">
        Each figure that is on becomes one swipeable chart on the client&rsquo;s Home screen, in this order.
      </p>
    </div>
  );
}
