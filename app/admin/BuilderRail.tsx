import { LineChart, Point } from "../components/LineChart";
import CoachNoteForm from "./CoachNoteForm";
import LiftTrendRows from "./LiftTrendRows";
import type { CheckInSnapshot } from "../lib/queries";

export type CompletedEntry = { id: number; day: string; program: string; when: string };

// The context column beside the builder: how the client is actually
// trending, what they last reported, what they've finished, and a box to
// say something about it — so writing next week's session doesn't mean
// leaving the tab to go and look any of it up.
export default function BuilderRail({
  clientId,
  clientFirstName,
  strength,
  strengthDelta,
  strengthFrom,
  lifts,
  checkIn,
  completed,
}: {
  clientId: number;
  clientFirstName: string;
  strength: Point[];
  strengthDelta: string | null;
  strengthFrom: string | null;
  lifts: { id: number; name: string; points: Point[]; delta: string; up: boolean }[];
  checkIn: CheckInSnapshot;
  completed: CompletedEntry[];
}) {
  const latest = strength.length > 0 ? strength[strength.length - 1].value : null;

  return (
    <aside className="pb-rail">
      <div className="pb-eyebrow">Strength trend</div>
      {latest == null ? (
        <p className="empty-note">Nothing logged yet — this fills in once the client trains.</p>
      ) : (
        <>
          <div className="pb-rail-headline">
            <span className="pb-rail-value">{Math.round(latest)}</span>
            {strengthDelta && <span className="pb-rail-delta">{strengthDelta}</span>}
          </div>
          {strength.length >= 2 && (
            <>
              <div className="pb-rail-chart">
                <LineChart points={strength} bleed gradientId="pb-strength" />
              </div>
              <div className="pb-rail-chart-foot">
                <span>{strengthFrom}</span>
                <span>est. volume, all lifts</span>
              </div>
            </>
          )}
        </>
      )}

      {lifts.length > 0 && <LiftTrendRows lifts={lifts} />}

      <div className="pb-rail-section">
        <div className="pb-rail-head">
          <span className="pb-eyebrow">Latest check-in</span>
          {checkIn.when && <span className="pb-rail-when">{checkIn.when}</span>}
        </div>
        {checkIn.metrics.length === 0 ? (
          <p className="empty-note">Nothing logged yet.</p>
        ) : (
          <div className="pb-rail-metrics">
            {checkIn.metrics.map((m) => (
              <div key={m.id} className="pb-rail-metric">
                <div className="pb-rail-metric-name">{m.name}</div>
                <div className="pb-rail-metric-value-row">
                  <span className="pb-rail-metric-value">{m.value}</span>
                  {m.unit && <span className="pb-rail-metric-unit">{m.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pb-rail-section">
        <span className="pb-eyebrow">Completed workouts</span>
        {completed.length === 0 ? (
          <p className="empty-note">Nothing completed yet.</p>
        ) : (
          <div className="pb-rail-completed">
            {completed.map((c) => (
              <div key={c.id} className="pb-rail-completed-row">
                <div className="pb-rail-completed-main">
                  <div className="pb-rail-completed-day">{c.day}</div>
                  <div className="pb-rail-completed-program">{c.program}</div>
                </div>
                <span className="pb-rail-completed-when">{c.when}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pb-rail-section">
        <span className="pb-eyebrow">Note to {clientFirstName}</span>
        <CoachNoteForm clientId={clientId} />
      </div>
    </aside>
  );
}
