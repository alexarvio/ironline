// The coach's standing note on the targets. Read-only: the client writes to
// the coach from the Calories today card, where the note goes with the day's
// calories. Nothing shows until the coach has written one.
export default function CoachCard({ coachName, note, noteDate }: { coachName: string; note: string | null; noteDate: string | null }) {
  if (!note) return null;
  return (
    <section className="nd-card">
      <div className="nd-coach">
        <div className="nd-coach-head">
          <span className="nd-avatar" aria-hidden="true">
            {coachName.charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="nd-coach-name">{coachName}</div>
            {noteDate && <div className="nd-coach-date">{noteDate}</div>}
          </div>
        </div>
        <p className="nd-coach-note">{note}</p>
      </div>
    </section>
  );
}
