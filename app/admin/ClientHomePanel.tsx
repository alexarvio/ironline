import type { ClientEngagement, ClientHome, OverviewPanel } from "../lib/queries";
import ClientKeepingUp from "./ClientKeepingUp";
import ClientHomeFeed from "./ClientHomeFeed";
import ClientHomeHeader from "./ClientHomeHeader";
import ClientCardEditor from "./ClientCardEditor";
import CoachNoteCard from "./CoachNoteCard";

// A client's Home: where the coach lands, read top to bottom. Who this is
// and how they are doing in one card, then what needs the coach and what the
// client has been doing down the main column, with the reference details on
// a rail beside it. Everything here is read from the same sources as the
// tabs; each row leads to the tab where the work is done.
export default function ClientHomePanel({
  clientId,
  panel,
  home,
  engagement,
}: {
  clientId: number;
  panel: OverviewPanel;
  home: ClientHome;
  /** The same figures over a week and over a month. */
  engagement: ClientEngagement;
}) {
  const firstName = panel.name.split(" ")[0] || panel.name;

  return (
    <div className="ch-home">
      <section className="ch-card ch-ident-card">
        {/* Name and face, and nothing else until it is asked for: the card,
            the contact details and the rest are a click away rather than a
            paragraph over the figures. */}
        <ClientHomeHeader clientId={clientId} panel={panel} />

        {/* What they are on, and how far through it they are. */}
        {panel.tags.length > 0 && (
          <div className="ch-phases">
            {panel.tags.map((t) => (
              <div key={t.track} className="ch-phase">
                <span className={`ch-phase-track ${t.track}`}>{t.track}</span>
                <span className="ch-phase-name">{t.label}</span>
                <span className="ch-phase-weeks">
                  week {Math.min(t.weekNow, t.weeks)} of {t.weeks}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Each fact built like the date chip on a meeting card: the name on
            a band of its own, a line under it, then the figure. Six of them
            across make one strip the eye reads in a row rather than six
            labels and six numbers it has to pair up. */}
        <div className="ch-stats">
          {panel.snapshot.map((s) => (
            <div key={s.label} className="ch-stat">
              <span className="ch-stat-label">{s.label}</span>
              <span className="ch-stat-body">
                <span className={`ch-stat-value${s.attention ? " warn" : ""}`}>{s.value}</span>
                {s.suffix && <span className="ch-stat-unit">{s.suffix}</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="ch-body">
        <div className="ch-main">
          <ClientKeepingUp firstName={firstName} engagement={engagement} />
          <ClientHomeFeed
            clientId={clientId}
            firstName={firstName}
            actions={home.actions}
            events={home.events}
            eventTotal={home.eventTotal}
            unseenCount={home.unseenCount}
          />
        </div>
        <aside className="ch-rail">
          <ClientCardEditor clientId={clientId} panel={panel} chrome="rail" />
          <CoachNoteCard clientId={clientId} text={panel.coachNote.text} savedLabel={panel.coachNote.savedLabel} />
        </aside>
      </div>
    </div>
  );
}
