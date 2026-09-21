"use client";

import { useEffect, useRef, useState } from "react";
import TrainingDaySession, { SessionCardio, SessionExercise } from "./TrainingDaySession";
import type { GymOption } from "./GymPicker";
import { useFocusRef, useTrainingFocus } from "./CheckInContext";

export type TrainingDayProps = {
  key: number;
  title: string;
  exercises: SessionExercise[];
  cardio: SessionCardio[];
  skipReason: string;
  /** The day the week should land on: the first one not fully logged. */
  defaultOpen: boolean;
  /** The client's gyms, and the one this session is at. */
  gyms: GymOption[];
  gymId: number | null;
};

// One day open at a time. Opening Friday while Wednesday is open folds
// Wednesday, so the client never scrolls past two full session lists.
// Tapping the open day's head closes it.
export default function TrainingDayList({ days }: { days: TrainingDayProps[] }) {
  const [openKey, setOpenKey] = useState<number | null>(() => days.find((d) => d.defaultOpen)?.key ?? null);
  // Arriving from Home's "Start": open that day and bring it to the top of
  // the screen, so the client lands on the session rather than above it.
  const focus = useFocusRef();
  // From a coach message's link: the exercise in that session to open.
  const focusExercise = useTrainingFocus()?.exercise ?? null;
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Applied once per arrival: it re-runs for a new focus, never for a fresh
  // days array. Every saved set re-renders the list with a new array, and
  // re-running then would drag the client back to the linked day.
  //
  // This used to guard with a ref ("already applied") while its cleanup
  // cleared the pending scrolls. Any re-run — React runs effects twice in
  // development, and a refreshed list arrives with a new array — cancelled
  // the scrolls and the guard then stopped them being scheduled again, so
  // the session opened but the screen never moved to it (the known issue on
  // Home's Start since 16 Sep).
  useEffect(() => {
    if (focus == null || !days.some((d) => d.key === focus)) return;
    setOpenKey(focus);
    // The tab's own scroller is moved directly, to the row's offset minus the
    // floating top bar. scrollIntoView was being dropped: a smooth scroll
    // started on the same tick as the week strip positioning itself, and the
    // browser kept only one. Instant, and repeated as the tab settles (rings
    // and bars animate in), so the session ends the top whatever shifts.
    const scroll = () => {
      const day = rowRefs.current.get(focus);
      // The linked exercise when there is one, else the session's head.
      const row = (focusExercise != null ? day?.querySelector<HTMLElement>(`[data-ex="${focusExercise}"]`) : null) ?? day;
      const scroller = row?.closest<HTMLElement>(".app-content");
      if (!row || !scroller) return;
      const bar = parseFloat(getComputedStyle(scroller.parentElement ?? scroller).getPropertyValue("--topbar-h")) || 0;
      const top = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - bar - 8;
      scroller.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    };
    const timers = [60, 300, 700].map((ms) => setTimeout(scroll, ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new arrival only; see above.
  }, [focus, focusExercise]);
  return (
    <>
      {days.map((d, i) => (
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
          dayId={d.key}
          index={i + 1}
          gyms={d.gyms}
          gymId={d.gymId}
          exercises={d.exercises}
          cardio={d.cardio}
          skipReason={d.skipReason}
          open={openKey === d.key}
          focusExercise={d.key === focus ? focusExercise : null}
          onToggle={() => setOpenKey((k) => (k === d.key ? null : d.key))}
        />
        </div>
      ))}
    </>
  );
}
