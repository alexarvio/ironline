import { agreedPoints } from "../../lib/meetingDates";
import "./notes.css";

// A call's notes, one way (3 Nov, Alex: section 4 of docs/boards/drawn-several-ways-mockup.html): the Meetings screen's
// calls and Home's Meeting summary alike. The points as To focus on draws its goals, a small ink ring each on a thin line
// down the left, nothing to tick and no kind colour; a one-line summary a plain paragraph. The coach's typed dashes and
// numbers go (agreedPoints).
export default function MeetingNotes({ notes, title }: { notes: string[] | string | null | undefined; /** The summary's own title, where nothing over it says it already (Home). */ title?: string | null }) {
  const { points, prose } = agreedPoints(notes);
  if (points.length === 0 && !title) return null;
  return (
    <div className="mt-notes">
      {title && <b className="mt-notes-title">{title}</b>}
      {points.length > 0 &&
        (prose ? (
          <p className="mt-notes-prose">{points[0]}</p>
        ) : (
          <ul className="mt-notes-list">
            {points.map((p, i) => (
              <li key={i} className="mt-notes-pt">
                <svg className="mt-notes-node" width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
                  <circle cx="5.5" cy="5.5" r="4.2" />
                </svg>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
