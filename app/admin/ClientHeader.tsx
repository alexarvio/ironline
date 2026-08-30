import { ChatIcon } from "../components/icons";
import type { HeaderStat } from "../lib/queries";

// The identity block above the section tabs: who this is, where they are in
// their coaching, and the three numbers a coach glances at before doing
// anything else. Shared by every client tab.
export default function ClientHeader({
  name,
  phase,
  meta,
  stats,
  messageHref,
}: {
  name: string;
  phase: string | null;
  meta: string[];
  stats: HeaderStat[];
  messageHref: string;
}) {
  return (
    <header className="ad-client-header">
      <div className="ad-client-identity">
        <div className="ad-client-title-row">
          <h1 className="ad-client-title">{name}</h1>
          {phase && <span className="ad-client-phase">{phase}</span>}
        </div>
        {meta.length > 0 && (
          <div className="ad-client-meta">
            {meta.map((m, i) => (
              <span key={m} className="ad-client-meta-item">
                {i > 0 && (
                  <span aria-hidden="true" className="ad-client-meta-sep">
                    ·
                  </span>
                )}
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="ad-client-readouts">
        {stats.map((s) => (
          <div key={s.id} className="ad-stat">
            <div className="ad-microlabel">{s.label}</div>
            <div className="ad-stat-value-row">
              <span className={`ad-stat-value ${s.tone}`}>{s.value}</span>
              {s.unit && <span className="ad-stat-unit">{s.unit}</span>}
            </div>
          </div>
        ))}
        <a href={messageHref} className="ad-btn">
          <ChatIcon />
          Message
        </a>
      </div>
    </header>
  );
}
