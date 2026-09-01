import { setDayRestAction } from "../lib/actions";

// One segmented control split 50/50, not two buttons: "this day is a workout"
// and "this day is a rest day" are two values of one setting, and a pair of
// separate buttons reads as two independent actions.
//
// A day with exercises on it can't be flipped to rest — there's no safe
// meaning for that which doesn't throw the programming away — so the Rest
// half goes inert and says why. Turning rest back off is always safe.
export default function DayRestToggle({
  programDayId,
  isRest,
  hasExercises,
}: {
  programDayId: number;
  isRest: boolean;
  hasExercises: boolean;
}) {
  const lockedToWorkout = hasExercises && !isRest;

  return (
    <div className="pb-daytype" role="group" aria-label="Day type">
      <form action={setDayRestAction} className="pb-daytype-half">
        <input type="hidden" name="programDayId" value={programDayId} />
        <input type="hidden" name="isRest" value="false" />
        <button type="submit" className={`pb-daytype-btn${!isRest ? " on" : ""}`} aria-pressed={!isRest}>
          Workout
        </button>
      </form>
      <form action={setDayRestAction} className="pb-daytype-half">
        <input type="hidden" name="programDayId" value={programDayId} />
        <input type="hidden" name="isRest" value="true" />
        <button
          type="submit"
          className={`pb-daytype-btn${isRest ? " on" : ""}`}
          aria-pressed={isRest}
          disabled={lockedToWorkout}
          title={lockedToWorkout ? "Remove this day's exercises first" : undefined}
        >
          Rest
        </button>
      </form>
    </div>
  );
}
