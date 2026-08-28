"use client";

import { setLabelAction } from "../lib/actions";

export default function DayLabelForm({
  programDayId,
  defaultLabel,
  placeholder,
}: {
  programDayId: number;
  defaultLabel: string;
  placeholder: string;
}) {
  return (
    <form action={setLabelAction} className="inline-row">
      <input type="hidden" name="programDayId" value={programDayId} />
      <input
        className="day-label-input"
        name="label"
        defaultValue={defaultLabel}
        placeholder={placeholder}
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}
