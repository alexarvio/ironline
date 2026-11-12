"use client";

import type { ReactNode } from "react";
import RingEdge from "../components/RingEdge";
import { askShown, VideoAskMark } from "./VideoAskSheet";
import type { SessionExercise } from "./workoutShared";

/** An exercise's marks, as the coach's rows draw them and in their colours (13 Nov, Alex: "the same colors as in the admin
 *  panel"): 22px rings 6px apart, from the left PB green, sets added green, sets taken off rust, the photo or video, the
 *  swap amber. On Training's finished sessions and the workout's finish list. `finished`: a reply carried from an earlier
 *  session is left out (askShown). */
export default function ExerciseMarks({ ex, finished = false }: { ex: SessionExercise; finished?: boolean }) {
  const ask = askShown(ex.videoRequest, ex.swap != null, finished) ? ex.videoRequest : null;
  const pbs = ex.pbSets?.length ?? 0;
  const extra = ex.logs.filter((l) => l.setNumber > ex.sets).length;
  const removed = ex.coachSets != null && ex.coachSets > ex.sets ? ex.coachSets - ex.sets : 0;
  if (!pbs && !extra && !removed && !ask && !ex.swap) return null;
  return (
    <span className="tr-x-marks">
      {pbs > 0 && <XMark kind="pb" label={pbs > 1 ? `${pbs} personal bests` : "Personal best"}>PB</XMark>}
      {extra > 0 && <XMark kind="extra" label={`${extra} extra set${extra === 1 ? "" : "s"}`}>+{extra}</XMark>}
      {removed > 0 && <XMark kind="removed" label={`${removed} set${removed === 1 ? "" : "s"} taken off`}>−{removed}</XMark>}
      {ask && <VideoAskMark ask={ask} />}
      {ex.swap && (
        <XMark kind="swap" label={`Instead of ${ex.name}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />
          </svg>
        </XMark>
      )}
    </span>
  );
}

function XMark({ kind, label, children }: { kind: "pb" | "extra" | "removed" | "swap"; label: string; children: ReactNode }) {
  return (
    <span className={`tr-xmark ${kind}`} role="img" aria-label={label} title={label}>
      {children}
      <RingEdge size={22} stroke={1.5} />
    </span>
  );
}
