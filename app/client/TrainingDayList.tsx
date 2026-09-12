"use client";

import { useEffect, useRef, useState } from "react";
import TrainingDaySession, { SessionCardio, SessionExercise } from "./TrainingDaySession";
import { useFocusRef } from "./CheckInContext";

export type TrainingDayProps = {
  key: number;
  title: string;
  exercises: SessionExercise[];
  cardio: SessionCardio[];
  /** The day the week should land on: the first one not fully logged. */
  defaultOpen: boolean;
};

// One day open at a time. Opening Friday while Wednesday is open folds
// Wednesday, so the client never scrolls past two full session lists.
// Tapping the open day's head closes it.
export default function TrainingDayList({ days }: { days: TrainingDayProps[] }) {
  const [openKey, setOpenKey] = useState<number | null>(() => days.find((d) => d.defaultOpen)?.key ?? null);
  // Arriving from Home's "Start": open that day and bring it to the top of
  // the screen, so the client lands on the session rather than above it.
  const focus = useFocusRef();
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Applied once per arrival. Every saved set re-renders the list with a
  // fresh days array, and re-running this would drag the client back to the
  // Start day: closing the day they had moved to and scrolling away from the
  // set they were logging.
  const applied = useRef<number | null>(null);
  useEffect(() => {
    if (focus == null || applied.current === focus || !days.some((d) => d.key === focus)) return;
    applied.current = focus;
    setOpenKey(focus);
    const t = setTimeout(() => rowRefs.current.get(focus)?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [focus, days]);
  return (
    <>
      {days.map((d) => (
        <div
          key={d.key}
          ref={(el) => {
            if (el) rowRefs.current.set(d.key, el);
            else rowRefs.current.delete(d.key);
          }}
          className="ts-day-anchor"
        >
        <TrainingDaySession
          title={d.title}
          exercises={d.exercises}
          cardio={d.cardio}
          open={openKey === d.key}
          onToggle={() => setOpenKey((k) => (k === d.key ? null : d.key))}
        />
        </div>
      ))}
    </>
  );
}
