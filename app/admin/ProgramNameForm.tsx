"use client";

import { renameProgramAction } from "../lib/actions";

// Same auto-submit-on-blur pattern as DayLabelForm, one level up: names the
// whole program (e.g. "Bulk phase 2"), not any one of its weeks — weeks
// always stay "Week 1".."Week N", see programWeekLabel in queries.ts.
export default function ProgramNameForm({
  programId,
  defaultName,
  placeholder,
}: {
  programId: number;
  defaultName: string;
  placeholder: string;
}) {
  return (
    <form action={renameProgramAction} className="plan-name-form">
      <input type="hidden" name="programId" value={programId} />
      <input
        className="plan-name-input"
        name="name"
        defaultValue={defaultName}
        placeholder={placeholder}
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}
