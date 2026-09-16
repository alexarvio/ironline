"use client";

import { useEffect } from "react";
import { markExerciseNoteReadAction } from "../lib/actions";
import CoachMark from "./CoachMark";

// The coach's note on one exercise — a posture fix off a submitted video, a
// load instruction after an easy week — shown open in the card, between the
// target and the client's own note, so it is read without a tap. No note,
// no box. Being on screen counts as read, so the coach's side stops showing
// it as unread once the client has opened that exercise.
export default function ExerciseCoachNote({
  assignmentId,
  dateLabel,
  text,
  unread,
}: {
  /** null: a note with no read tracking (cardio). */
  assignmentId: number | null;
  dateLabel: string;
  text: string | null;
  unread: boolean;
}) {
  useEffect(() => {
    // Fire and forget: a failed write only means it is marked read next time.
    if (text && unread && assignmentId != null) void markExerciseNoteReadAction(assignmentId);
  }, [text, unread, assignmentId]);

  if (!text) return null;
  return (
    <div className="ts-coachnote">
      <div className="ts-coachnote-top">
        <span className="ts-coachnote-label coach-eyebrow">
          <CoachMark />
          From your coach
        </span>
        {dateLabel && <span className="ts-coachnote-date">{dateLabel}</span>}
      </div>
      <p className="ts-coachnote-text">{text}</p>
    </div>
  );
}
