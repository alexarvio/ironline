"use client";

import { updateProgramWeeksAction } from "../lib/actions";

// Draft-only, inline-editable "how long is this program" field — set later,
// once the coach actually knows, rather than asked upfront when the
// program's created. Only ever grows: raising it creates the newly-added
// weeks' skeletons immediately; entering a smaller number than what's
// already there is a no-op (see updateProgramTotalWeeks), so nothing built
// can be silently orphaned by an accidental edit here.
export default function ProgramWeeksForm({ programId, defaultWeeks }: { programId: number; defaultWeeks: number }) {
  return (
    <form action={updateProgramWeeksAction} className="plan-weeks-form">
      <input type="hidden" name="programId" value={programId} />
      <input
        className="plan-weeks-input"
        name="totalWeeks"
        type="number"
        min={1}
        max={52}
        defaultValue={defaultWeeks}
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
      />
      <span>weeks</span>
    </form>
  );
}
