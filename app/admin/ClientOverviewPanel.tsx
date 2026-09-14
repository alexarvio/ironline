import Link from "next/link";
import type { OverviewPanel } from "../lib/queries";
import { deleteClientAction } from "../lib/actions";
import { getUserForClient } from "../lib/auth";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import { PanelCollapseButton } from "./AdminShell";
import ClientCardEditor from "./ClientCardEditor";
import ClientLoginPanel from "./ClientLoginPanel";
import PanelSection from "./PanelSection";

// The right-hand column: everything true about this client that isn't the
// thing the coach is currently editing.
//
// Header, then the snapshot (open, always), then three collapsible sections
// whose headers say what is inside when closed, then recent activity, then
// delete. A coach scans this many times a day, so nothing moves on its own:
// the only motion is a section opening and its chevron turning.
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
  const user = getUserForClient(clientId);
  const accessHint = !user ? "No login" : user.must_change_password ? "Temporary password" : "Signed up";

  return (
    <div className="ad-panel ad-client-panel">
      <header className="ad-panel-head">
        <div className="ad-panel-head-top">
          <span className="ad-panel-avatar" aria-hidden="true">
            {panel.avatarPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
              <img src={panel.avatarPath} alt="" className="ad-avatar-img" />
            ) : (
              panel.initial
            )}
          </span>
          <div className="ad-panel-ident">
            <div className="ad-panel-name">{panel.name}</div>
            {panel.clientSince && <div className="ad-panel-since">{panel.clientSince}</div>}
          </div>
          <PanelCollapseButton />
        </div>
        {panel.phase && <span className="ad-phase-pill">{panel.phase}</span>}
      </header>

      <div className="ad-panel-content">
        {/* Snapshot: one card, one hairline row per figure. Value and unit are
            separate spans so the numbers line up down the column. */}
        <section className="ad-panel-block">
          <h3 className="ad-panel-label">Snapshot</h3>
          <div className="ad-snapshot">
            {panel.snapshot.map((s) => (
              <div key={s.label} className="ad-snap-row">
                <span className="ad-snap-label">{s.label}</span>
                <span className="ad-snap-figure">
                  <span className="ad-snap-value">{s.value}</span>
                  {s.suffix && <span className="ad-snap-unit">{s.suffix}</span>}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="ad-sects">
          <ClientCardEditor clientId={clientId} panel={panel} onboarding={onboarding} />
          {/* Closed by default: the destructive controls stay behind a click.
              Open when an access action has just reported back. */}
          <PanelSection title="App access" hint={accessHint} forceOpen={!!(loginOk || loginError)}>
            <ClientLoginPanel clientId={clientId} name={panel.name} ok={loginOk} error={loginError} />
          </PanelSection>
        </div>

        <section className="ad-panel-block">
          <div className="ad-panel-label-row">
            <h3 className="ad-panel-label">Recent activity</h3>
            <Link href="/admin?view=feed" className="ad-panel-seeall">
              See all
            </Link>
          </div>
          <div className="ad-activity">
            {panel.activity.length === 0 ? (
              <p className="ad-activity-empty">Nothing logged yet.</p>
            ) : (
              panel.activity.slice(0, 3).map((a) => (
                <div key={a.id} className="ad-activity-row">
                  <span className={`ad-activity-dot${a.recent ? " recent" : ""}`} aria-hidden="true" />
                  <div className="ad-activity-main">
                    <div className="ad-activity-text">{a.text}</div>
                    <div className="ad-activity-when">{a.when}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Last, and quiet: the one action here that cannot be undone, behind
            a confirm dialog. */}
        <div className="ad-panel-delete">
          <ConfirmDeleteButton
            action={deleteClientAction}
            hiddenFields={{ clientId }}
            label={`Delete ${panel.name}`}
            description="Removes this client, their login, programmes, logged sets, check-ins, measurements, photos, invoices, meetings, notes and reports."
            text="Delete client"
          />
        </div>
      </div>
    </div>
  );
}
