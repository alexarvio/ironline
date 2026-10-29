import CoachSays from "./CoachSays";

// The coach's standing note on the targets. Read-only: the client writes to
// the coach from the Calories today card, where the note goes with the day's
// calories. Nothing shows until the coach has written one. Drawn as every
// coach's note is (CoachSays): the face, their name and the date, the words.
export default function CoachCard({ coachName, photoPath, note, noteDate, flat = false }: { coachName: string; photoPath: string | null; note: string | null; noteDate: string | null; /** On a hairline screen (the check-in, 21 Oct): no card, the words on the page. */ flat?: boolean }) {
  if (!note) return null;
  return (
    <section className={`nd-card${flat ? " flat" : ""}`}>
      <div className="nd-coach">
        <CoachSays
          coach={{ name: coachName, photoPath }}
          label={
            <>
              {coachName}
              {noteDate && <span className="coach-says-date">{noteDate}</span>}
            </>
          }
        >
          {note}
        </CoachSays>
      </div>
    </section>
  );
}
