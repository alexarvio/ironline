import type { OverviewPanel } from "../lib/queries";
import { addClientGoalAction, toggleClientGoalAction } from "../lib/actions";

// The right-hand column: everything true about this client that isn't the
// thing the coach is currently editing.
//
// It mirrors the shape of the client app's own Home screen on purpose —
// profile, then a snapshot, then goals, then the reference detail — so the
// coach is looking at roughly what the client looks at, and the two sides
// of the product stay legible to each other.
//
// This replaces the old Start Page tab. Making it a tab meant the facts a
// coach wants while building a programme were one click away from the
// programme; as a panel they're simply always there.
export default function ClientOverviewPanel({ panel, clientId }: { panel: OverviewPanel; clientId: number }) {
  return (
    <div className="ad-panel">
      {/* 1. Profile */}
      <section className="ad-panel-profile">
        <span className="ad-panel-avatar" aria-hidden="true">
          {panel.initial}
        </span>
        <div className="ad-panel-ident">
          <div className="ad-panel-name">{panel.name}</div>
          {panel.clientSince && <div className="ad-panel-since">{panel.clientSince}</div>}
          {panel.phase && <span className="ad-phase-pill">{panel.phase}</span>}
        </div>
      </section>

      {/* 2. Snapshot — equal-size cards, one line each. No sub-labels: the
             micro-label above the figure already says what it is. */}
      <section className="ad-panel-section">
        <h3 className="ad-panel-heading">Snapshot</h3>
        <div className="ad-snapshot">
          {panel.snapshot.map((s) => (
            <div key={s.label} className="ad-snap-card">
              <div className="ad-microlabel">{s.label}</div>
              <div className="ad-snap-value">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Goals — set directly here rather than in a tab. */}
      <section className="ad-panel-section">
        <h3 className="ad-panel-heading">Goals — 3 months</h3>
        {panel.goals.length === 0 ? (
          <p className="ad-panel-empty">None set yet.</p>
        ) : (
          <div className="ad-goal-list">
            {panel.goals.map((g) => (
              <form key={g.id} action={toggleClientGoalAction} className="ad-goal-row">
                <input type="hidden" name="id" value={g.id} />
                <button type="submit" className={`ad-goal-check${g.done ? " done" : ""}`} aria-label={`Mark "${g.text}" ${g.done ? "not done" : "done"}`}>
                  {g.done ? "✓" : ""}
                </button>
                <span className={`ad-goal-text${g.done ? " done" : ""}`}>{g.text}</span>
              </form>
            ))}
          </div>
        )}
        <form action={addClientGoalAction} className="ad-goal-add">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="term" value="short" />
          <input name="text" type="text" placeholder="Add a goal…" aria-label="Add a goal" />
        </form>
      </section>

      {/* 4/5. Reference detail — one line per fact, never wrapped. */}
      <section className="ad-panel-section">
        <h3 className="ad-panel-heading">Member info</h3>
        <dl className="ad-facts">
          {panel.memberInfo.map((f) => (
            <div key={f.label} className="ad-fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="ad-panel-section">
        <h3 className="ad-panel-heading">Coaching info</h3>
        <dl className="ad-facts">
          {panel.coachingInfo.map((f) => (
            <div key={f.label} className="ad-fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 6. Recent activity */}
      <section className="ad-panel-section">
        <h3 className="ad-panel-heading">Recent activity</h3>
        {panel.activity.length === 0 ? (
          <p className="ad-panel-empty">Nothing logged yet.</p>
        ) : (
          <div className="ad-activity">
            {panel.activity.map((a) => (
              <div key={a.id} className="ad-activity-row">
                <span className="ad-activity-when">{a.when}</span>
                <span className="ad-activity-text">{a.text}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
