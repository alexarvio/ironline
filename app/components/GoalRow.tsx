import type { GoalView } from "../lib/goalView";

// One goal as the client sees it on Home. Also the coach's "Client sees"
// preview, so the two never drift apart. The "banner" variant is the row in
// Home's goals panel: the kind above the name, the figure on the right, the
// bar under, the small line last.
// The main goal is the row the page puts first, with id -1; any other
// untracked goal is just a goal.
const KIND_LABEL: Record<GoalView["kind"], string> = { none: "Goal", metric: "Measurement", exercise: "Exercise", habit: "Habit" };

export default function GoalRow({ goal, variant = "card", animate = true }: { goal: GoalView; variant?: "card" | "banner"; animate?: boolean }) {
  const dotClass = goal.done && goal.kind === "none" ? "done" : goal.tone;

  if (variant === "banner") {
    const figure = goal.kind === "metric" ? goal.barLabel : goal.kind === "exercise" ? goal.right : goal.kind === "habit" ? goal.right : null;
    return (
      <div className={`gp-row${goal.done ? " is-done" : ""}`}>
        <div className="gp-kind">{goal.id === -1 ? "Main goal" : goal.kind === "exercise" && goal.left ? `Exercise · ${goal.left.split(" · ")[0]}` : KIND_LABEL[goal.kind]}</div>
        <div className="gp-head">
          <div className="gp-text">{goal.text}</div>
          {figure && <span className="gp-figure">{figure}</span>}
        </div>
        {goal.kind === "metric" && goal.bar != null && (
          <div className="gp-bar">
            <div className="gp-bar-fill" style={{ width: animate ? `${Math.round(goal.bar * 100)}%` : 0 }} />
          </div>
        )}
        {goal.kind === "habit" && goal.segments && (
          <span className={`gr-segments ${goal.tone}`} aria-hidden="true">
            {Array.from({ length: goal.segments.total }, (_, i) => (
              <span key={i} className={`gr-seg${i < goal.segments!.done ? " on" : ""}`} />
            ))}
          </span>
        )}
        {goal.sub && <div className={`gp-sub${goal.reached && goal.kind === "metric" ? " green" : ""}`}>{goal.sub}</div>}
      </div>
    );
  }

  return (
    <div className={`gr${goal.done ? " is-done" : ""}`}>
      <span className={`gr-dot ${dotClass}`} aria-hidden="true">
        {goal.done && goal.kind === "none" ? "✓" : ""}
      </span>
      <div className="gr-body">
        <div className="gr-head">
          <div className="gr-text">{goal.text}</div>
          {goal.kind === "metric" && goal.barLabel && (
            <span className={`gr-figure ${goal.tone}`}>{goal.barLabel}</span>
          )}
          {goal.kind === "habit" && goal.right && <span className="gr-muted">{goal.right}</span>}
        </div>

        {goal.kind === "metric" && goal.bar != null && (
          <div className={`gr-bar ${goal.tone}`}>
            <div className="gr-bar-fill" style={{ width: `${Math.round(goal.bar * 100)}%` }} />
          </div>
        )}

        {goal.kind === "exercise" && (
          <div className="gr-split">
            <span className="gr-muted">{goal.left}</span>
            <span className={`gr-figure ${goal.tone}`}>{goal.right}</span>
          </div>
        )}

        {goal.kind === "habit" && goal.segments && (
          <span className={`gr-segments ${goal.tone}`} aria-hidden="true">
            {Array.from({ length: goal.segments.total }, (_, i) => (
              <span key={i} className={`gr-seg${i < goal.segments!.done ? " on" : ""}`} />
            ))}
          </span>
        )}

        {goal.sub && <div className={`gr-sub${goal.reached && goal.kind === "metric" ? " green" : ""}`}>{goal.sub}</div>}
      </div>
    </div>
  );
}
