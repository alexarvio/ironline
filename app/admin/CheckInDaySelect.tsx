"use client";

import { useRef } from "react";
import { setCheckInDayAction } from "../lib/actions";

// Listed here rather than imported from lib/db: this is a "use client" file
// and db.ts pulls in node:fs, which cannot be bundled for the browser. Order
// matches DAY_NAMES_FULL (Monday first), which weeklyCheckInWeekday relies on.
const DAY_NAMES_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Which weekday the client's weekly check-in opens. Writes the same
// profile.check_in_day the client card's Coaching info edits, so the two
// never disagree; this one just lives next to the weekly columns it governs.
// Saves on change — a separate Save button for a one-field choice is a step
// the coach would only ever forget.
export default function CheckInDaySelect({ clientId, value }: { clientId: number; value: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const current = DAY_NAMES_FULL.find((d) => d.toLowerCase() === (value ?? "").trim().toLowerCase()) ?? "";

  return (
    <form ref={formRef} action={setCheckInDayAction} className="cid">
      <input type="hidden" name="clientId" value={clientId} />
      <label className="cid-label" htmlFor={`cid-${clientId}`}>
        Weekly check-in opens
      </label>
      <select
        id={`cid-${clientId}`}
        name="check_in_day"
        defaultValue={current}
        className="cid-select"
        onChange={() => formRef.current?.requestSubmit()}
        title="From this day until they log it, the client sees the weekly check-in as due"
      >
        <option value="">Any day (from Monday)</option>
        {DAY_NAMES_FULL.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </form>
  );
}
