// The coach's standing note on the targets. Read-only: the client writes to
// the coach from the Calories today card, where the note goes with the day's
// calories. Nothing shows until the coach has written one.
export default function CoachCard({ coachName, photoPath, note, noteDate }: { coachName: string; photoPath: string | null; note: string | null; noteDate: string | null }) {
  if (!note) return null;
  return (
    <section className="nd-card">
      <div className="nd-coach">
        <div className="nd-coach-head">
          <span className="nd-avatar" aria-hidden="true">
            {photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
              <img src={photoPath} alt="" />
            ) : (
              coachName.charAt(0).toUpperCase()
            )}
          </span>
          <div className="nd-coach-name">{coachName}</div>
          {noteDate && <div className="nd-coach-date">{noteDate}</div>}
        </div>
        <p className="nd-coach-note">{note}</p>
      </div>
    </section>
  );
}
