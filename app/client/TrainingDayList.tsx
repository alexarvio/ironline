"use client";

import { useEffect, useState } from "react";
import TrainingDaySession, { SessionCardio, SessionExercise } from "./TrainingDaySession";
import type { GymOption } from "./GymPicker";
import { useFocusRef, useTrainingFocus } from "./CheckInContext";

export type TrainingDayProps = {
  key: number;
  title: string;
  exercises: SessionExercise[];
  cardio: SessionCardio[];
  skipReason: string;
  /** When the client opened the session to train, and when they ended it. */
  startedAt: string | null;
  endedAt: string | null;
  /** The day the week should land on: the first one not fully logged. */
  defaultOpen: boolean;
  /** The client's gyms, and the one this session is at. */
  gyms: GymOption[];
  gymId: number | null;
};

// The week's sessions as rows. Tapping one opens it as its own screen over
// the app (see TrainingDaySession); one screen at a time, and its back
// button comes back to this list where it was.
export default function TrainingDayList({ days }: { days: TrainingDayProps[] }) {
  const [openKey, setOpenKey] = useState<number | null>(() => days.find((d) => d.defaultOpen)?.key ?? null);
  // Arriving from Home's "Start" or a coach message's link: unfold that session;
  // the session itself goes straight into the workout (autoStart).
  const focus = useFocusRef();
  // From a coach message's link: the exercise in that session to open.
  const focusExercise = useTrainingFocus()?.exercise ?? null;
  // Applied once per arrival, never for a fresh days array: every saved set
  // re-renders the list with a new array.
  useEffect(() => {
    if (focus == null || !days.some((d) => d.key === focus)) return;
    const t = setTimeout(() => setOpenKey(focus), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new arrival only; see above.
  }, [focus, focusExercise]);
  return (
    <>
      {days.map((d, i) => (
        <div key={d.key} className="ts-day-anchor">
          <TrainingDaySession
            title={d.title}
            dayId={d.key}
            index={i + 1}
            gyms={d.gyms}
            gymId={d.gymId}
            exercises={d.exercises}
            cardio={d.cardio}
            skipReason={d.skipReason}
            startedAt={d.startedAt}
            endedAt={d.endedAt}
            open={openKey === d.key}
            focusExercise={d.key === focus ? focusExercise : null}
            autoStart={d.key === focus}
            onToggle={() => setOpenKey((k) => (k === d.key ? null : d.key))}
          />
        </div>
      ))}
    </>
  );
}
