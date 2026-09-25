"use client";

import { useState } from "react";

export type LibraryOption = { id: number; name: string; note?: string | null };

// Machine taken: the client logs what they did instead. What the coach
// suggests is offered (with the coach's note); anything else is typed in.
// With no suggestions, that section is left out altogether. The coach sees the swap
// against what was prescribed.
export default function AlternativesSheet({
  exerciseName,
  coachName,
  suggested,
  swapped,
  onPick,
  onClear,
  onClose,
}: {
  exerciseName: string;
  coachName: string;
  /** Alternatives the coach set for this exercise, if any. */
  suggested: LibraryOption[];
  /** The swap already in place, if any. */
  swapped: { libraryExerciseId: number | null; name: string } | null;
  onPick: (choice: { libraryExerciseId: number | null; customName: string | null }) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<number | null>(swapped?.libraryExerciseId ?? null);
  const name = typed.trim();
  const canUse = picked != null || name.length > 0;
  const use = () => {
    if (picked != null) onPick({ libraryExerciseId: picked, customName: null });
    else if (name) onPick({ libraryExerciseId: null, customName: name });
  };
  return (
    <div className="wo-sheet-scrim" onClick={onClose}>
      <div className="wo-sheet" role="dialog" aria-label={`Swap ${exerciseName}`} onClick={(e) => e.stopPropagation()}>
        <span className="wo-sheet-grab" aria-hidden="true" />
        <h2 className="wo-sheet-title">Swap {exerciseName}</h2>
        <p className="wo-sheet-sub">Machine taken? Log what you did instead. {coachName} sees the swap.</p>
        {suggested.length > 0 && (
          <>
          <div className="wo-sheet-kicker">Suggested by {coachName}</div>
          <div className="wo-sheet-list">
            {suggested.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`wo-option${e.id === picked ? " on" : ""}`}
                aria-pressed={e.id === picked}
                onClick={() => {
                  setPicked(e.id === picked ? null : e.id);
                  setTyped("");
                }}
              >
                <span className="wo-radio" aria-hidden="true" />
                <span className="wo-option-text">
                  <span className="wo-option-name">{e.name}</span>
                  {e.note && <span className="wo-option-note">{e.note}</span>}
                </span>
              </button>
            ))}
          </div>
          </>
        )}
        <div className="wo-sheet-kicker">{suggested.length > 0 ? "Or write it down" : "What you did instead"}</div>
        <input
          className="wo-sheet-input"
          type="text"
          value={typed}
          placeholder="What you did instead"
          autoComplete="off"
          onChange={(e) => {
            setTyped(e.target.value);
            setPicked(null);
          }}
        />
        <button type="button" className="wo-sheet-btn" disabled={!canUse} onClick={use}>
          {picked != null ? "Use this" : name ? `Use “${name}”` : "Use"}
        </button>
        {swapped && (
          <button type="button" className="wo-sheet-text" onClick={onClear}>
            Back to {exerciseName}
          </button>
        )}
      </div>
    </div>
  );
}
