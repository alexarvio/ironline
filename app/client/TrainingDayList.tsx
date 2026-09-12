"use client";

import { useState } from "react";
import TrainingDaySession, { SessionExercise } from "./TrainingDaySession";

export type TrainingDayProps = {
  key: number;
  dayName: string;
  label: string | null;
  exercises: SessionExercise[];
  /** The day the week should land on: the first one not fully logged. */
  defaultOpen: boolean;
};

// One day open at a time. Opening Friday while Wednesday is open folds
// Wednesday, so the client never scrolls past two full session lists.
// Tapping the open day's head closes it.
export default function TrainingDayList({ days }: { days: TrainingDayProps[] }) {
  const [openKey, setOpenKey] = useState<number | null>(() => days.find((d) => d.defaultOpen)?.key ?? null);
  return (
    <>
      {days.map((d) => (
        <TrainingDaySession
          key={d.key}
          dayName={d.dayName}
          label={d.label}
          exercises={d.exercises}
          open={openKey === d.key}
          onToggle={() => setOpenKey((k) => (k === d.key ? null : d.key))}
        />
      ))}
    </>
  );
}
