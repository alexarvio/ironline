import { LineChart } from "../components/LineChart";
import CoachNoteForm from "./CoachNoteForm";
import LiftTrendRows from "./LiftTrendRows";
import {
  getCompletedDaysForClient,
  getExerciseStrengthSeries,
  getLatestCheckInSnapshot,
  getStrengthSeries,
  listLoggedExercisesForClient,
  listPrograms,
  programWeekLabel,
} from "../lib/queries";
import { DAY_NAMES_FULL } from "../lib/db";

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// The shell's right panel, shown on every client tab: how the client is
// actually trending, what they last reported, what they've finished, and a
// box to say something about it — so working on any part of their coaching
// doesn't mean leaving the tab to go and look any of it up. Queries its own
// data so a page only has to hand it a client.
export default function ClientRail({ clientId, clientName }: { clientId: number; clientName: string }) {
  const strength = getStrengthSeries(clientId, 3650);
  const strengthFrom = strength.length > 0 ? fmtDay(strength[0].date) : null;
  const strengthDelta = (() => {
    if (strength.length < 2) return null;
    const first = strength[0].value;
    const last = strength[strength.length - 1].value;
    if (!first) return null;
    const pct = ((last - first) / first) * 100;
    return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
  })();

  const lifts = listLoggedExercisesForClient(clientId)
    .map((e) => {
      const points = getExerciseStrengthSeries(clientId, e.id, 3650);
      if (points.length < 2) return null;
      const diff = points[points.length - 1].value - points[0].value;
      return {
        id: e.id,
        name: e.name,
        points,
        delta: diff === 0 ? "±0" : `${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)}`,
        up: diff > 0,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .slice(0, 6);

  const programs = listPrograms(clientId);
  const completed = getCompletedDaysForClient(clientId, 6).map((d) => {
    const program = programs.find((p) => d.weekNumber >= p.start_week && d.weekNumber < p.start_week + p.total_weeks);
    return {
      id: d.dayId,
      day: `${DAY_NAMES_FULL[d.dayOfWeek - 1]}${d.label ? ` — ${d.label}` : ""}`,
      program: program ? `${program.name || "Program"} · ${programWeekLabel(program, d.weekNumber)}` : `Week ${d.weekNumber}`,
      when: d.completedAt,
    };
  });

  const checkIn = getLatestCheckInSnapshot(clientId);
  const clientFirstName = clientName.split(" ")[0] || "your client";

  const latest = strength.length > 0 ? strength[strength.length - 1].value : null;

  return (
    <div className="ad-rail-body">
      <div className="pb-eyebrow">Strength trend</div>
      {latest == null ? (
        <p className="empty-note">Nothing logged yet — this fills in once the client trains.</p>
      ) : (
        <>
          <div className="pb-rail-headline">
            <span className="pb-rail-value">{Math.round(latest)}</span>
            {strengthDelta && (
              <span className={`pb-rail-delta${strengthDelta.startsWith("−") || strengthDelta.startsWith("-") ? " down" : ""}`}>
                {strengthDelta}
              </span>
            )}
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
          <p className="empty-note">
            Nothing pinned yet — pin up to six from Daily Tracker, Weekly Tracker or Measurements.
          </p>
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
    </div>
  );
}
