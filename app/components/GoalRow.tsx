import type { GoalView } from "../lib/goalView";

// One goal as the client sees it on Home. Also the coach's "Client sees"
// preview, so the two never drift apart.
export default function GoalRow({ goal }: { goal: GoalView }) {
  const dotClass = goal.done && goal.kind === "none" ? "done" : goal.tone;
  return (
    <div className={`gr${goal.done ? " is-done" : ""}`}>
      <span className={`gr-dot ${dotClass}`} aria-hidden="true">
        {goal.done && goal.kind === "none" ? "✓" : ""}
      </span>
      <div className="gr-body">
        <div className="gr-text">{goal.text}</div>

        {goal.kind === "metric" && goal.bar != null && (
          <>
            <div className={`gr-bar ${goal.tone}`}>
              <div className="gr-bar-fill" style={{ width: `${Math.round(goal.bar * 100)}%` }} />
            </div>
            {goal.barLabel && <div className={`gr-figure ${goal.tone}`}>{goal.barLabel}</div>}
          </>
        )}

        {goal.kind === "exercise" && (
          <div className="gr-split">
            <span className="gr-muted">{goal.left}</span>
            <span className={`gr-figure ${goal.tone}`}>{goal.right}</span>
          </div>
        )}

        {goal.kind === "habit" && goal.segments && (
          <div className="gr-split">
            <span className={`gr-segments ${goal.tone}`} aria-hidden="true">
              {Array.from({ length: goal.segments.total }, (_, i) => (
                <span key={i} className={`gr-seg${i < goal.segments!.done ? " on" : ""}`} />
              ))}
            </span>
            <span className={`gr-figure ${goal.tone}`}>{goal.right}</span>
          </div>
        )}

        {goal.sub && <div className={`gr-sub${goal.reached && goal.kind === "metric" ? " green" : ""}`}>{goal.sub}</div>}
      </div>
    </div>
  );
}
