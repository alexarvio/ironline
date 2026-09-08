"use client";

import { setDayRestAction } from "../lib/actions";
import { usePendingDay } from "../components/DayPending";

// One segmented control split 50/50, not two buttons: "this day is a workout"
// and "this day is a rest day" are two values of one setting, and a pair of
// separate buttons reads as two independent actions.
//
// A day with exercises on it can't be flipped to rest — there's no safe
// meaning for that which doesn't throw the programming away — so the Rest
// half goes inert and says why. Turning rest back off is always safe.
//
// Inside a day card the flip is queued on the pending-changes bar like any
// other edit ("Monday → Rest day") and lands when the coach applies.
export default function DayRestToggle({
  programDayId,
  isRest,
  hasExercises,
}: {
  programDayId: number;
  isRest: boolean;
  hasExercises: boolean;
}) {
  const pending = usePendingDay();
  const rest = pending ? pending.restValue : isRest;
  const busy = pending ? pending.hasExercises : hasExercises;
  const lockedToWorkout = busy && !rest;

  if (pending) {
    return (
      <div className="pb-daytype" role="group" aria-label="Day type">
        <div className="pb-daytype-half">
          <button type="button" className={`pb-daytype-btn${!rest ? " on" : ""}`} aria-pressed={!rest} onClick={() => pending.setRest(false)}>
            Workout
          </button>
        </div>
        <div className="pb-daytype-half">
          <button
            type="button"
            className={`pb-daytype-btn${rest ? " on" : ""}`}
            aria-pressed={rest}
            disabled={lockedToWorkout}
            title={lockedToWorkout ? "Remove this day's exercises first" : undefined}
            onClick={() => pending.setRest(true)}
          >
            Rest
          </button>
        </div>
      </div>
    );
  }

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
