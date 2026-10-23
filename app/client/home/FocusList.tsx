"use client";

import { useOptimistic, useTransition } from "react";
import { tickFocusAction } from "../../lib/focusActions";
import type { HomeFocus } from "../../lib/focus";
import "./focus.css";

// To focus on (23 Oct, Alex): the coach's goals until the next call, the first thing on Home under the greeting. A goal
// is a ring and its words; a tap ticks it (the ring fills ink with a white check, the words go faint), a tap again takes
// the tick back. Saved at once, shown at once. The coach's face and name on the right; the call it runs until under it.

/** "Until your call, Thu 29 Oct"; today, "Until your call today". */
function untilWords(until: NonNullable<HomeFocus["until"]>, today: string): string {
  if (until.date === today) return "Until your call today";
  const day = new Date(`${until.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `Until your call, ${day}`;
}

export default function FocusList({ focus, coach, today }: { focus: HomeFocus; coach: { firstName: string; photoPath: string | null }; today: string }) {
  const [, startTransition] = useTransition();
  // The tick shows the moment it is tapped; the server's list takes over once the save comes back.
  const [goals, tickNow] = useOptimistic(focus.goals, (list, p: { id: number; done: boolean }) => list.map((g) => (g.id === p.id ? { ...g, done: p.done } : g)));
  const tick = (id: number, done: boolean) =>
    startTransition(async () => {
      tickNow({ id, done });
      await tickFocusAction(id, done);
    });
  const initial = (coach.firstName || "C").trim().charAt(0).toUpperCase();
  return (
    <section className="hm-focus" aria-label="To focus on">
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">To focus on</span>
        <span className="hm-focus-from">
          <span className="hm-focus-face" aria-hidden="true">
            {coach.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
              <img src={coach.photoPath} alt="" />
            ) : (
              initial
            )}
          </span>
          from {coach.firstName}
        </span>
      </div>
      <ul className="hm-focus-list">
        {goals.map((g) => (
          <li key={g.id}>
            <button type="button" className={`hm-focus-goal${g.done ? " done" : ""}`} aria-pressed={g.done} onClick={() => tick(g.id, !g.done)}>
              <span className="hm-focus-ring" aria-hidden="true">
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              </span>
              <span className="hm-focus-text">{g.text}</span>
            </button>
          </li>
        ))}
      </ul>
      {focus.until && <p className="hm-focus-until">{untilWords(focus.until, today)}</p>}
    </section>
  );
}
