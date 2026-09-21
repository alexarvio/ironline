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
    // The same head as Phases and Goals below it: the tinted band, the name
    // in navy, the helper under it, and what the card has to say on the
    // right where those two keep their controls. It was the one card on the
    // tab wearing a plain white strip, which made it read as a caption above
    // the page rather than the first of three cards.
    <section className="pl-card pl-maingoal">
      <div className="pl-card-head">
        <div className="pl-card-titles">
          <span className="pl-eyebrow">Main goal</span>
          <span className="pl-helper">Shows under {firstName}&rsquo;s name on their Home. One sentence.</span>
        </div>
        <div className="pl-card-tools">
          <span className="pl-saved" aria-live="polite">
            {saving ? "Saving…" : savedLabel ? `Saved ${savedLabel}` : ""}
          </span>
        </div>
      </div>
      <div className="pl-maingoal-body">
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
      </div>
    </section>
  );
}
