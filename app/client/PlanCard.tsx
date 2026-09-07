import type { ClientPlanView } from "../lib/queries";

// The full phase plan, folded out under the Home header's chevron: one
// vertical list per track with dates, the current phase marked, past ones
// dimmed. Vertical and dated because the coach's week grid is too wide for
// a phone. Pure markup; the open/closed state lives in HomeHub's header.
export default function PlanBody({ plan }: { plan: ClientPlanView }) {
  return (
    <div id="plan-body" className="plan-body">
      {plan.tracks.map((t) => (
        <div key={t.track} className="plan-track">
          <div className="plan-track-label">{t.label}</div>
          <ol className="plan-track-list">
            {t.phases.map((p) => (
              <li key={p.id} className={`plan-phase ${p.status}`}>
                <span className="plan-phase-marker" aria-hidden="true" />
                <span className="plan-phase-name">{p.name}</span>
                <span className="plan-phase-range">
                  {p.rangeLabel} · {p.weeks} wk{p.weeks === 1 ? "" : "s"}
                </span>
                {p.status === "now" && <span className="plan-phase-now">Now</span>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
