"use client";

import { useState } from "react";
import { ChevronDownIcon } from "../components/icons";

// The coach's objectives for the phase a tab is about (the ones on its Home
// card), folded to one row: "Objectives from Finlay" and a chevron that
// opens the numbered list. A white card on Training and Nutrition; a plain
// line on the check-in, among its other lines.
export default function PhaseObjectives({ coachName, objectives, variant = "card" }: { coachName: string; objectives: string[]; variant?: "card" | "line" }) {
  const [open, setOpen] = useState(false);
  if (objectives.length === 0) return null;
  return (
    <section className={`po po-${variant}${open ? " open" : ""}`}>
      <button type="button" className="po-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="po-label">Objectives from {coachName}</span>
        <span className="po-count">{objectives.length}</span>
        <span className={`po-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      <div className={`po-body${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="po-clip">
          <ol className="po-list">
            {objectives.map((o, i) => (
              <li key={i}>
                <span className="po-n">{i + 1}</span>
                <span className="po-text">{o}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
