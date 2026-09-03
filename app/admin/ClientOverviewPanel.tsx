import type { OverviewPanel } from "../lib/queries";
import { addClientGoalAction, removeClientGoalAction } from "../lib/actions";
import ClientCardEditor from "./ClientCardEditor";
import ClientLoginPanel from "./ClientLoginPanel";

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
export default function ClientOverviewPanel({
  panel,
  clientId,
  onboarding = false,
  loginOk,
  loginError,
}: {
  panel: OverviewPanel;
  clientId: number;
  /** True right after this client was created — the card opens in edit mode
      so the coach fills in the details while they still have them to hand. */
  onboarding?: boolean;
  /** Outcome flags from the app-access actions, passed through from the URL. */
  loginOk?: string;
  loginError?: string;
}) {
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

      {/* 2. Snapshot — one card, one hairline row per figure, label left and
             value right, as the design has it. The two-column grid of little
             cards I had here before turned six one-line facts into six boxes
             and read as a dashboard rather than a summary. */}
      <section className="ad-panel-section">
        <h3 className="ad-panel-heading">Snapshot</h3>
        <div className="ad-snapshot">
          {panel.snapshot.map((s) => (
            <div key={s.label} className="ad-snap-row">
              <span className="ad-snap-label">{s.label}</span>
              <span className="ad-snap-figure">
                <b>{s.value}</b>
                {s.suffix && <em>{s.suffix}</em>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Goals — stated, not ticked.
             These are what the coach is steering the block towards, not a
             checklist: "get to 80kg without losing bench strength" isn't done
             on a Tuesday afternoon. So each one is a bullet the coach can
             write and take away again, with no completion state to maintain. */}
      <section className="ad-panel-section">
        <div className="ad-panel-heading-row">
          <h3 className="ad-panel-heading">Goals (3 months)</h3>
          <span className="ad-goal-count">
            {panel.goals.length} goal{panel.goals.length === 1 ? "" : "s"}
          </span>
        </div>
        {panel.goals.length === 0 ? (
          <p className="ad-panel-empty">None set yet.</p>
        ) : (
          <div className="ad-goal-list">
            {panel.goals.map((g) => (
              <div key={g.id} className="ad-goal-row">
                <span className="ad-goal-bullet" aria-hidden="true" />
                <span className="ad-goal-text">{g.text}</span>
                <form action={removeClientGoalAction}>
                  <input type="hidden" name="id" value={g.id} />
                  <button type="submit" className="ad-goal-x" aria-label={`Remove goal "${g.text}"`}>
                    ×
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
        <form action={addClientGoalAction} className="ad-goal-add">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="term" value="short" />
          <input name="text" type="text" placeholder="Add a goal…" aria-label="Add a goal" required />
          <button type="submit" className="ad-btn-primary ad-goal-add-btn">
            Add
          </button>
        </form>
      </section>

      {/* 4/5. The client card. Read-only rows until the coach hits Edit —
             most of it is filled at onboarding, but an email or a phase date
             changing must not mean re-creating the client. */}
      <ClientCardEditor clientId={clientId} panel={panel} onboarding={onboarding} />

      {/* 6. App access — the client's login, created and reset from here.
             Lives with the member details because it is one: the email they
             sign in with and whether they have a way into the app at all. */}
      <section className="ad-panel-section">
        <h3 className="ad-panel-heading">App access</h3>
        <ClientLoginPanel clientId={clientId} name={panel.name} ok={loginOk} error={loginError} />
      </section>

      {/* 7. Recent activity */}
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
