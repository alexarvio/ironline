import { setDayRestAction } from "../lib/actions";

// Only offered while the day is empty. Marking rest is a labelling choice —
// "this is deliberately a day off" versus "I haven't built this yet" — and
// the moment a day has exercises on it there's no safe meaning for the
// button that doesn't involve throwing that programming away, so it isn't
// shown. Turning rest back off is always safe.
export default function DayRestToggle({
  programDayId,
  isRest,
  hasExercises,
}: {
  programDayId: number;
  isRest: boolean;
  hasExercises: boolean;
}) {
  if (hasExercises && !isRest) return null;

  return (
    <form action={setDayRestAction}>
      <input type="hidden" name="programDayId" value={programDayId} />
      <input type="hidden" name="isRest" value={isRest ? "false" : "true"} />
      <button type="submit" className="pb-rest-btn">
        {isRest ? "Make training day" : "Mark rest"}
      </button>
    </form>
  );
}
