"use client";

import { useState, useTransition } from "react";
import { setPhotoStartDateAction } from "../lib/actions";

// The day the first photo sheet opens. Saves as soon as a whole date is
// picked; a half-typed date (which reads as empty) is never saved over it.
export default function PhotoStartDateInput({ clientId, value }: { clientId: number; value: string }) {
  const [date, setDate] = useState(value);
  const [, startSaving] = useTransition();

  return (
    <input
      type="date"
      className="pp-input pp-date"
      value={date}
      aria-label="Day the first sheet opens"
      onChange={(e) => {
        const next = e.target.value;
        setDate(next);
        if (!next) return;
        startSaving(async () => {
          await setPhotoStartDateAction(clientId, next);
        });
      }}
    />
  );
}
