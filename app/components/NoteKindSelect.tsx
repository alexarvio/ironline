"use client";

import { updateAssignmentAction } from "../lib/actions";

// Inlined rather than imported from lib/queries: this is a "use client"
// component, and queries.ts reaches for node:fs — importing it here breaks
// the build. These are labels, not data, so a local copy is the right call.
// The matching type lives in queries.ts beside the schema.
const NOTE_KINDS = [
  { value: "form", label: "Form", hint: "Technique or posture, usually off a video" },
  { value: "load", label: "Load", hint: "Weight or intensity instruction" },
  { value: "tempo", label: "Tempo", hint: "Speed of the rep" },
] as const;

// Sits under the Notes field in the program builder: says what a note is
// about, so the client's app can head it "FORM · FINLAY" rather than just
// "NOTE". Same auto-save-on-change idiom as the other builder fields — no
// separate save step.
//
// Only shown once there's a note to label; an empty exercise doesn't need a
// kind, and offering one would imply a note exists.
export default function NoteKindSelect({
  assignmentId,
  value,
}: {
  assignmentId: number;
  value: string | null;
}) {
  return (
    <form action={updateAssignmentAction}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <select
        name="noteKind"
        className="note-kind-select"
        defaultValue={value ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="What this note is about"
      >
        <option value="">Kind…</option>
        {NOTE_KINDS.map((k) => (
          <option key={k.value} value={k.value} title={k.hint}>
            {k.label}
          </option>
        ))}
      </select>
    </form>
  );
}
