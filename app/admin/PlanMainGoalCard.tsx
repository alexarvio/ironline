"use client";

import { useState, useTransition } from "react";
import { setClientMainGoalAction } from "../lib/actions";

// The one headline goal for the client, shown under their name on Home. A
// sentence, not a metric: "Drop to 84 kg for the wedding in November".
// Save and Cancel appear once the text differs from what is saved.
export default function PlanMainGoalCard({ clientId, clientName, value }: { clientId: number; clientName: string; value: string }) {
  const [draft, setDraft] = useState(value);
  const [saving, start] = useTransition();
  const dirty = draft.trim() !== value.trim();
  const save = () => {
    if (!dirty) return;
    const next = draft.trim();
    start(() => setClientMainGoalAction(clientId, next));
  };
  return (
    <section className={`pl-card pl-maingoal${dirty ? " dirty" : ""}`}>
      <div className="pl-maingoal-head">
        <span className="pl-maingoal-eyebrow">Main goal</span>
        <span className="pl-maingoal-hint">Shows under {clientName.split(" ")[0]}’s name on their Home. One sentence.</span>
      </div>
      <form
        className="pl-maingoal-row"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setDraft(value);
          }}
          placeholder="e.g. Drop to 84 kg and keep the bench moving"
          aria-label="Main goal"
          maxLength={140}
        />
        {dirty && (
          <>
            <button type="button" className="ad-btn-secondary" onClick={() => setDraft(value)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="ad-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
