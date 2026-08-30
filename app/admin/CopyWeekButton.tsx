"use client";

import { useState } from "react";
import { copyProgramWeekAction } from "../lib/actions";

// Overwrites the week being edited with the previous one's plan, so it asks
// first when there's something to lose. `fromLabel`/`toLabel` are the
// program-relative week numbers the coach sees, not the underlying global
// week_number.
export default function CopyWeekButton({
  clientId,
  fromWeek,
  toWeek,
  fromLabel,
  toLabel,
  targetHasContent,
}: {
  clientId: number;
  fromWeek: number;
  toWeek: number;
  fromLabel: string;
  toLabel: string;
  targetHasContent: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <form action={copyProgramWeekAction} className="pb-copy-confirm">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="fromWeek" value={fromWeek} />
        <input type="hidden" name="toWeek" value={toWeek} />
        <span className="pb-copy-warning">Replace {toLabel}?</span>
        <button type="submit" className="pb-toolbar-btn danger">
          Replace
        </button>
        <button type="button" className="pb-toolbar-btn" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </form>
    );
  }

  if (targetHasContent) {
    return (
      <button type="button" className="pb-toolbar-btn" onClick={() => setConfirming(true)}>
        Copy {fromLabel} here
      </button>
    );
  }

  return (
    <form action={copyProgramWeekAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="fromWeek" value={fromWeek} />
      <input type="hidden" name="toWeek" value={toWeek} />
      <button type="submit" className="pb-toolbar-btn">
        Copy {fromLabel} here
      </button>
    </form>
  );
}
