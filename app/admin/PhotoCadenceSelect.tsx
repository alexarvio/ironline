"use client";

import { useOptimistic, useTransition } from "react";
import { setPhotoCadenceAction } from "../lib/actions";

// Kept local (not imported from ../lib/queries) so this client component's
// bundle doesn't pull in queries.ts's server-only fs/path dependencies.
type PhotoCadence = "weekly" | "biweekly" | "monthly" | "sixweekly";

const OPTIONS: { value: PhotoCadence; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "biweekly", label: "Two weeks" },
  { value: "monthly", label: "Month" },
  { value: "sixweekly", label: "Six weeks" },
];

// A segmented control that saves on tap. The chosen segment moves at once;
// the server catches up behind it.
export default function PhotoCadenceSelect({ clientId, cadence }: { clientId: number; cadence: PhotoCadence }) {
  const [shown, setShown] = useOptimistic(cadence);
  const [, startSaving] = useTransition();

  const pick = (next: PhotoCadence) => {
    if (next === shown) return;
    startSaving(async () => {
      setShown(next);
      const fd = new FormData();
      fd.set("clientId", String(clientId));
      fd.set("cadence", next);
      await setPhotoCadenceAction(fd);
    });
  };

  return (
    <div className="pp-seg" role="radiogroup" aria-label="How often a new sheet opens">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={shown === o.value}
          className={`pp-seg-btn${shown === o.value ? " active" : ""}`}
          onClick={() => pick(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
