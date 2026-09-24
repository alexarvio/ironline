"use client";

import { useState } from "react";
import type { GymOption } from "./GymPicker";

// Which gym the session is at, asked as a bottom sheet: on "Start session"
// with two or more gyms, and again from the workout's header to change it.
// Machines differ from gym to gym, so the weights and notes follow the pick.
export default function GymSheet({
  gyms,
  gymId,
  mode,
  onPick,
  onClose,
}: {
  gyms: GymOption[];
  gymId: number | null;
  /** "start": the pick starts the session. "change": the session is going. */
  mode: "start" | "change";
  onPick: (gym: GymOption) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(gymId ?? gyms[0]?.id ?? null);
  const chosen = gyms.find((g) => g.id === picked) ?? null;
  return (
    <div className="wo-sheet-scrim" onClick={onClose}>
      <div className="wo-sheet" role="dialog" aria-label="Which gym" onClick={(e) => e.stopPropagation()}>
        <span className="wo-sheet-grab" aria-hidden="true" />
        <h2 className="wo-sheet-title">Where are you training?</h2>
        <p className="wo-sheet-sub">{mode === "start" ? "Your timer starts as soon as you pick." : "Loads and notes are kept per gym."}</p>
        <div className="wo-sheet-list">
          {gyms.map((g) => (
            <button key={g.id} type="button" className={`wo-option${g.id === picked ? " on" : ""}`} aria-pressed={g.id === picked} onClick={() => setPicked(g.id)}>
              <span className="wo-radio" aria-hidden="true" />
              <span className="wo-option-name">{g.name}</span>
              {g.id === gymId && <span className="wo-option-meta">Last used</span>}
            </button>
          ))}
        </div>
        <button type="button" className="wo-sheet-btn" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
          {mode === "start" ? "Start session" : "Done"}
        </button>
      </div>
    </div>
  );
}
