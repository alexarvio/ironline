"use client";

import { useState } from "react";
import { copyProgramDayAction } from "../lib/actions";

// Copies this day's exercises (and label) onto another day of the same
// week. Pick the target, then Copy; if the target already has exercises
// the button says Replace, since that is what happens. When the programme
// has later weeks, a tick also puts the copy on that weekday in each of
// them.
export default function CopyDayMenu({
  fromDayId,
  targets,
  remainingWeeks,
}: {
  fromDayId: number;
  targets: { id: number; name: string; hasExercises: boolean }[];
  /** How many weeks of the programme come after this one. */
  remainingWeeks: number;
}) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(targets[0]?.id ?? null);
  const target = targets.find((t) => t.id === targetId) ?? null;

  if (targets.length === 0) return null;

  if (!open) {
    return (
      <button type="button" className="pb-toolbar-btn" onClick={() => setOpen(true)}>
        Copy to…
      </button>
    );
  }

  return (
    <form action={copyProgramDayAction} className="pb-copy-day" onSubmit={() => setTimeout(() => setOpen(false), 0)}>
      <input type="hidden" name="fromDayId" value={fromDayId} />
      <select
        name="toDayId"
        value={targetId ?? ""}
        onChange={(e) => setTargetId(Number(e.target.value))}
        aria-label="Copy this day to"
        className="pb-copy-day-select"
      >
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.hasExercises ? " (has exercises)" : ""}
          </option>
        ))}
      </select>
      {remainingWeeks > 0 && (
        <label className="pb-copy-day-weeks">
          <input type="checkbox" name="applyToRemainingWeeks" value="1" />
          <span>
            + the {remainingWeeks} remaining week{remainingWeeks === 1 ? "" : "s"}
          </span>
        </label>
      )}
      <button type="submit" className={`pb-toolbar-btn${target?.hasExercises ? " danger" : ""}`}>
        {target?.hasExercises ? "Replace" : "Copy"}
      </button>
      <button type="button" className="pb-toolbar-btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
