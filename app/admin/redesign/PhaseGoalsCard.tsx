"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon } from "../../components/icons";
import { setPhaseGoalsAction } from "../../lib/actions";
import { PHASE_OBJECTIVE_CHARS, PHASE_OBJECTIVES_MAX } from "../../lib/phaseCovers";
import "./phase-goals.css";

// The coach's goals for the phase on screen, the same card on Training,
// Nutrition and Measurements: up to three, in order, shown under the phase
// on the client's Home. Folded until its head is clicked (the chevron on the
// right says which way); edits wait in the navy bar at its foot, like every
// other card's, until Apply.
export default function PhaseGoalsCard({ phaseId, phaseName, firstName, goals }: { phaseId: number | null; phaseName: string; firstName: string; goals: string[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const fill = (g: string[]) => Array.from({ length: PHASE_OBJECTIVES_MAX }, (_, i) => g[i] ?? "");
  const [rows, setRows] = useState(() => fill(goals));
  const [open, setOpen] = useState(false);
  // Another phase picked, or the saved goals changed: what is saved shows.
  // Compared by what they say, not by the array: every re-read of the page
  // (any save on it, a refresh in the background) hands in a new array with
  // the same goals, and resetting on that wiped whatever was being typed.
  const savedKey = `${phaseId}:${goals.join("|")}`;
  const [seen, setSeen] = useState(savedKey);
  if (seen !== savedKey) {
    setSeen(savedKey);
    setRows(fill(goals));
  }
  if (!phaseId) return null;

  // One change a row that differs from what is saved.
  const saved = fill(goals);
  const changes = rows.filter((g, i) => g.trim() !== saved[i].trim()).length;
  const apply = () => {
    const next = rows.map((x) => x.trim()).filter(Boolean);
    setRows(fill(next));
    startTransition(async () => {
      await setPhaseGoalsAction(phaseId, next);
      router.refresh();
      toast.success("Saved", { description: `Goals for ${phaseName}` });
    });
  };

  return (
    <section className={`rd-goals${open ? " open" : ""}`}>
      <h2 className="rd-goals-h">
        <button type="button" className="rd-goals-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="rd-goals-title">Phase goals</span>
          <span className="rd-goals-sub">Up to {PHASE_OBJECTIVES_MAX}</span>
          <span className={`rd-goals-chev${open ? " open" : ""}`} aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>
      </h2>
      {open && (
        <ol className="rd-goals-list">
          {rows.map((g, i) => (
            <li key={i}>
              <span className="rd-goals-n" aria-hidden="true">
                {i + 1}
              </span>
              <input
                type="text"
                value={g}
                maxLength={PHASE_OBJECTIVE_CHARS}
                placeholder={i === 0 ? "What this phase is for" : "Another goal (optional)"}
                aria-label={`Goal ${i + 1}`}
                onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && changes > 0) apply();
                }}
              />
            </li>
          ))}
        </ol>
      )}
      {changes > 0 && (
        <div className="rd-pending">
          <span className="rd-pending-count">{changes}</span>
          <span className="rd-pending-text">
            {changes === 1 ? "change" : "changes"} to the goals · {firstName} sees them on Home
          </span>
          <button type="button" className="rd-pending-ghost" onClick={() => setRows(saved)}>
            Discard
          </button>
          <button type="button" className="rd-pending-apply" onClick={apply}>
            Apply
          </button>
        </div>
      )}
    </section>
  );
}
