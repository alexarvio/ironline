"use client";

import { useState } from "react";
import { copyProgramDayAction } from "../lib/actions";

// Copies this day's exercises (and label) onto another day of the same
// week. Pick the target, then Copy; if the target already has exercises
// the button says Replace, since that is what happens.
export default function CopyDayMenu({
  fromDayId,
  targets,
}: {
  fromDayId: number;
  targets: { id: number; name: string; hasExercises: boolean }[];
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
      <button type="submit" className={`pb-toolbar-btn${target?.hasExercises ? " danger" : ""}`}>
        {target?.hasExercises ? "Replace" : "Copy"}
      </button>
      <button type="button" className="pb-toolbar-btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
