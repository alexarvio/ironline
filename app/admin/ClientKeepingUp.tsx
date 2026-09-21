"use client";

import type { ClientEngagement, EngagementPart } from "../lib/queries";
import { useTween } from "../components/useTween";

// How much of what the coach set up the client actually does — a scoreboard,
// read at a glance.
//
// One score, and the three behaviours it is made of. The score is the MEAN OF
// THE THREE RATES, never a pooled count: over a month a client is asked for
// ~27 food days, ~31 check-ins and 8 sessions, so pooling would make training
// an eighth of the score and a client could stop training altogether while
// the number barely moved. Scoring each behaviour as done ÷ asked first, then
// averaging, gives each an equal third whatever its rhythm — which is the
// only reason a daily habit and a weekly one can sit in one figure at all.
//
// One window, and it moves: the thirty days ending today, so tomorrow it is
// the thirty ending tomorrow. Nothing to choose between — a card with a
// 7/30 switch on it asks the coach a question before it answers one — and
// the same thirty days against the thirty before them is the comparison
// that actually says something.
const tone = (pct: number) => (pct >= 80 ? "good" : pct >= 50 ? "mid" : "low");

const STROKE = 10;
const SIZE = 136;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export default function ClientKeepingUp({ firstName, engagement }: { firstName: string; engagement: ClientEngagement }) {
  if (engagement.overall == null) return null;
  const shift = engagement.previous == null ? null : engagement.overall - engagement.previous;

  return (
    <section className="ch-card">
      <div className="ch-head tint">
        <div className="ch-head-titles">
          <span className="ch-label">Keeping up</span>
          <span className="ch-head-sub">
            {/* A client newer than the window is counted from their first day, and the line says so. */}
            What {firstName} filled in ·{" "}
            {engagement.since
              ? `since ${new Date(`${engagement.since}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
              : `last ${engagement.days} days`}
          </span>
        </div>
      </div>

      <div className="ch-board">
        <div className="ch-board-score">
          <Dial pct={engagement.overall} />
          <span className="ch-board-word">Overall</span>
          {/* A score with no direction is just a number. */}
          {shift == null ? (
            <span className="ch-trend flat">nothing to compare yet</span>
          ) : shift === 0 ? (
            <span className="ch-trend flat">level with the {engagement.days} days before</span>
          ) : (
            <span className={`ch-trend ${shift > 0 ? "up" : "down"}`}>
              {shift > 0 ? "▲" : "▼"} {Math.abs(shift)} on the {engagement.days} days before
            </span>
          )}
        </div>

        <div className="ch-board-rows">
          {engagement.parts.map((p) => (
            <Row key={p.id} part={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

// The overall, as the one dial. One eased value drives the arc and the figure
// so they arrive together.
function Dial({ pct }: { pct: number }) {
  const shown = useTween(pct);
  const filled = (Math.max(0, Math.min(100, shown)) / 100) * C;
  return (
    <div className="ch-dial" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#eef0f3" strokeWidth={STROKE} />
          <circle
            className={`ch-dial-arc ${tone(pct)}`}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            // A round cap on a zero-length arc still draws a dot, which reads
            // as "a little bit done" when nothing is.
            strokeOpacity={filled > 0.5 ? 1 : 0}
            style={{ strokeDasharray: `${filled} ${C}` }}
          />
        </g>
      </svg>
      <span className="ch-dial-figure">
        {Math.round(shown)}
        <small>%</small>
      </span>
    </div>
  );
}

function Row({ part }: { part: EngagementPart }) {
  const shown = useTween(part.pct);
  return (
    <div className="ch-score-row">
      <span className="ch-score-name">{part.label}</span>
      <span className="ch-score-pct">{Math.round(shown)}%</span>
      <span className="ch-score-track">
        <span className={`ch-score-fill ${tone(part.pct)}`} style={{ width: `${Math.max(0, Math.min(100, shown))}%` }} />
      </span>
      <span className="ch-score-detail">
        {part.detail}
        {part.note && <em>{part.note}</em>}
      </span>
    </div>
  );
}
