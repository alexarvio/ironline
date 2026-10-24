import type { HomeFocus } from "../../lib/focus";
import { MEETING_TYPES } from "../../lib/meetingTypes";
import { pic } from "../../lib/pic";
import { Bars } from "../Bars";
import "./focus.css";

// To focus on (23 Oct, Alex): the coach's goals until the next call, the first thing on Home under the greeting.
// Drawn as a spine to the call (24 Oct, Alex: mockup B, docs/boards/to-focus-on-v2.html): each goal a small ink ring on
// one line, and the line ends at the call, a ring in the call's blue with "Your call with {Coach}" and when. Still
// bullet points: nothing to tap or tick. No call booked: the line runs between the goals alone. The stored ticks stay
// in the data, unused.

const CALL = MEETING_TYPES[0]; // a call with no kind of its own is a Check-in: the blue, the camera

/** "Today", "Tomorrow", "in 5 days" for the call's day. */
function inDays(date: string, today: string): string {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

export default function FocusList({ focus, coach, today }: { focus: HomeFocus; coach: { firstName: string; photoPath: string | null }; today: string }) {
  const initial = (coach.firstName || "C").trim().charAt(0).toUpperCase();
  const until = focus.until;
  const when = until ? inDays(until.date, today) : "";
  // The day itself only when it isn't today or tomorrow: "Thu 29 Oct".
  const day = until && when.startsWith("in ") ? new Date(`${until.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : null;
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
      <ol className="hm-focus-spine">
        {focus.goals.map((g) => (
          <li key={g.id} className="hm-focus-goal">
            <span className="hm-focus-node" aria-hidden="true" />
            <span className="hm-focus-text">{g.text}</span>
          </li>
        ))}
        {until && (
          <li className="hm-focus-call" style={{ ["--call" as string]: CALL.color }}>
            <span className="hm-focus-callring" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={CALL.icon} />
              </svg>
            </span>
            <span className="hm-focus-callwords">
              <b>Your call with {coach.firstName}</b>
              <span className="hm-focus-when">
                <Bars parts={[day ?? when, until.time || null, day ? when : null]} />
              </span>
            </span>
          </li>
        )}
      </ol>
    </section>
  );
}
