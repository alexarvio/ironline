"use client";

import { useState, useTransition } from "react";
import { setClientMainGoalAction } from "../lib/actions";

// The one headline goal for the client, shown under their name on Home. A
// sentence, not a metric: "Drop to 84 kg for the wedding in November".
// Saves itself when the field loses focus, like the builder's cells; the
// line under it says when it last did.
export default function PlanMainGoalCard({
  clientId,
  clientName,
  value,
  savedLabel,
}: {
  clientId: number;
  clientName: string;
  value: string;
  /** "12 Sep, 14:02", or null when it has never been saved from here. */
  savedLabel: string | null;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, startSaving] = useTransition();
  const firstName = clientName.split(" ")[0];

  const save = () => {
    const next = draft.trim();
    if (next === value.trim()) return;
    startSaving(async () => {
      await setClientMainGoalAction(clientId, next);
    });
  };

  return (
    <section className="pl-card pl-maingoal">
      <div className="pl-inline-head">
        <span className="pl-eyebrow">Main goal</span>
        <span className="pl-helper">Shows under {firstName}&rsquo;s name on their Home. One sentence.</span>
      </div>
      <input
        className="pl-maingoal-input"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") setDraft(value);
        }}
        placeholder="e.g. Drop to 84 kg and keep the bench moving"
        aria-label="Main goal"
        maxLength={140}
      />
      <p className="pl-saved" aria-live="polite">
        {saving ? "Saving…" : savedLabel ? `Saved ${savedLabel}` : ""}
      </p>
    </section>
  );
}
