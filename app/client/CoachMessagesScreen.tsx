"use client";

import { ChevronLeftIcon } from "../components/icons";

// The coach's messages to the client, newest first, grouped by day. One-way:
// the coach writes from the Messages tab, the client reads. Every message
// also lands in Notifications; this is the place to read them together.
export type CoachMessageView = {
  id: number;
  text: string;
  /** "Wednesday, September 16" */
  dayLabel: string;
  /** "14:02" */
  timeLabel: string;
};

export type CoachMessagesProps = {
  coachName: string;
  messages: CoachMessageView[];
};

export default function CoachMessagesScreen({ coachName, messages, onBack }: CoachMessagesProps & { onBack: () => void }) {
  const days: { label: string; items: CoachMessageView[] }[] = [];
  for (const m of messages) {
    const last = days[days.length - 1];
    if (last && last.label === m.dayLabel) last.items.push(m);
    else days.push({ label: m.dayLabel, items: [m] });
  }

  return (
    <>
      <header className="cn-header">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">From {coachName}</h1>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>
      <main className="cm-body">
        {days.length === 0 ? (
          <p className="cm-empty">Nothing yet. {coachName} writes here between calls: a nudge, a tweak to the plan, a well done.</p>
        ) : (
          days.map((d) => (
            <section key={d.label} className="cm-day">
              {/* The day sits on the first bubble's line, with the time across from it. */}
              {d.items.map((m, i) => (
                <article key={m.id} className="cm-item">
                  <div className="cm-item-head">
                    <span className="cm-day-label">{i === 0 ? d.label : ""}</span>
                    <span className="cm-msg-time">{m.timeLabel}</span>
                  </div>
                  <div className="cm-msg">
                    <p className="cm-msg-text">{m.text}</p>
                  </div>
                </article>
              ))}
            </section>
          ))
        )}
        {days.length > 0 && <p className="cm-note">You can’t reply here. Bring anything up on your next call.</p>}
      </main>
    </>
  );
}
