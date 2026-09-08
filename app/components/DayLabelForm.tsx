"use client";

import { setLabelAction } from "../lib/actions";
import { usePendingDay } from "./DayPending";

export default function DayLabelForm({
  programDayId,
  defaultLabel,
  placeholder,
}: {
  programDayId: number;
  defaultLabel: string;
  placeholder: string;
}) {
  const pending = usePendingDay();
  if (pending) {
    return (
      <div className="inline-row">
        <input
          className={`day-label-input${pending.labelValue !== defaultLabel ? " pb-changed" : ""}`}
          value={pending.labelValue}
          placeholder={placeholder}
          aria-label="Session label"
          onChange={(e) => pending.setLabel(e.target.value)}
        />
      </div>
    );
  }
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
