import type { HomeFocus } from "../../lib/focus";
import { MEETING_TYPES } from "../../lib/meetingTypes";
import { pic } from "../../lib/pic";
import { Bars } from "../Bars";
import "./focus.css";

// To focus on (23 Oct, Alex): the coach's goals until the next call, the first thing on Home under the greeting.
// Drawn as a spine to the call (24 Oct, Alex: mockup B, docs/boards/to-focus-on-v2.html): each goal a small ink ring on
// one line, and the line ends at the call, a ring in the call's blue with "Your call with {Coach}" and when. Still
// bullet points: nothing to tap or tick. Shown whenever there are goals, until the coach changes them or completes the
// next call with new ones (24 Oct, Alex); the call at the line's end only while one is booked. The stored ticks stay in
// the data, unused.

const CALL = MEETING_TYPES[0]; // a call with no kind of its own is a Check-in: the blue, the camera
/** "#2f6fd6" -> "47, 111, 214", for the call's pulse. */
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

/** The call's day: "Today", "Tomorrow", else "Thu 29 Oct" (24 Oct, Alex: no "in 5 days"). */
function callDay(date: string, today: string): string {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function FocusList({ focus, coach, today }: { focus: HomeFocus; coach: { firstName: string; photoPath: string | null }; today: string }) {
  const initial = (coach.firstName || "C").trim().charAt(0).toUpperCase();
  const until = focus.until;
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
            {/* Drawn, not a box's edge: a 1.6px edge on a 9px box came out fatter on one side (25 Oct, Alex). */}
            <svg className="hm-focus-node" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <circle cx="5" cy="5" r="4.2" />
            </svg>
            <span className="hm-focus-text">{g.text}</span>
          </li>
        ))}
        {until && (
          <li className="hm-focus-call" style={{ ["--call" as string]: CALL.color, ["--call-rgb" as string]: rgbOf(CALL.color) }}>
            <span className="hm-focus-callring" aria-hidden="true">
              <svg className="hm-focus-calledge" width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="11.2" />
              </svg>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={CALL.icon} />
              </svg>
            </span>
            <span className="hm-focus-callwords">
              <b>Your call with {coach.firstName}</b>
              <span className="hm-focus-when">
                <Bars parts={[callDay(until.date, today), until.time || null]} />
              </span>
            </span>
          </li>
        )}
      </ol>
    </section>
  );
}
