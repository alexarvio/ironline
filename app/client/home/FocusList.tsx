import type { HomeFocus } from "../../lib/focus";
import { pic } from "../../lib/pic";
import "./focus.css";

// To focus on (23 Oct, Alex): the coach's goals until the next call, the first thing on Home under the greeting. A goal
// is a bullet point (Alex, 23 Oct: "just bullet points", not a to-do list): a small ink dot and its words, plain text,
// nothing to tap or tick. The coach's face and name on the right; the call it runs until under it. The stored ticks stay
// in the data, unused.

/** "Until your call, Thu 29 Oct"; today, "Until your call today". */
function untilWords(until: NonNullable<HomeFocus["until"]>, today: string): string {
  if (until.date === today) return "Until your call today";
  const day = new Date(`${until.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `Until your call, ${day}`;
}

export default function FocusList({ focus, coach, today }: { focus: HomeFocus; coach: { firstName: string; photoPath: string | null }; today: string }) {
  const initial = (coach.firstName || "C").trim().charAt(0).toUpperCase();
  return (
    <section className="hm-focus" aria-label="To focus on">
      <div className="hm-tasks-head">
        <span className="hm-eyebrow">To focus on</span>
        <span className="hm-focus-from">
          <span className="hm-focus-face" aria-hidden="true">
            {coach.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
              <img src={pic(coach.photoPath, 96)} alt="" />
            ) : (
              initial
            )}
          </span>
          from {coach.firstName}
        </span>
      </div>
      <ul className="hm-focus-list">
        {focus.goals.map((g) => (
          <li key={g.id} className="hm-focus-goal">
            <span className="hm-focus-dot" aria-hidden="true" />
            <span className="hm-focus-text">{g.text}</span>
          </li>
        ))}
      </ul>
      {focus.until && <p className="hm-focus-until">{untilWords(focus.until, today)}</p>}
    </section>
  );
}
