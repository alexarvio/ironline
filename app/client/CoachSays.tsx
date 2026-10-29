import type { ReactNode } from "react";
import CoachMark from "./CoachMark";

// A note the coach wrote, one way wherever it shows (29 Oct, Alex: option A of docs/boards/coach-note-mockup.html;
// docs/DESIGN-RULES.md §9): their face (36px, the same everywhere) on the left, as tall as the label and the note's first
// line together, so it sits centred on them; a longer note runs on under the words. The workout's and the session's
// notes, the training phase's, Nutrition's, the check-in's, the shape update's instructions, the food diary's comments.
export default function CoachSays({
  label,
  children,
  coach,
}: {
  /** The small caps line over the words: `From your coach`, or the coach's name and the date. */
  label: ReactNode;
  children: ReactNode;
  /** Who, where the page knows it; else the coach from context (CoachMark). */
  coach?: { name: string; photoPath: string | null };
}) {
  return (
    <div className="coach-says">
      <CoachMark size="note" coach={coach} />
      <span className="coach-says-label">{label}</span>
      <div className="coach-says-words">{children}</div>
    </div>
  );
}
