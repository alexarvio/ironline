"use client";

import { useMemo, useState } from "react";

export type LibraryOption = { id: number; name: string };

// Machine taken: the client logs what they did instead. A search over the
// coach's exercise library, or a name typed in. The coach sees the swap
// against what was prescribed.
export default function AlternativesSheet({
  exerciseName,
  coachName,
  library,
  swapped,
  onPick,
  onClear,
  onClose,
}: {
  exerciseName: string;
  coachName: string;
  library: LibraryOption[];
  /** The swap already in place, if any. */
  swapped: { libraryExerciseId: number | null; name: string } | null;
  onPick: (choice: { libraryExerciseId: number | null; customName: string | null }) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number | null>(swapped?.libraryExerciseId ?? null);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = library.filter((e) => e.name.toLowerCase() !== exerciseName.toLowerCase());
    if (!q) return list.slice(0, 8);
    return list.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [library, q, exerciseName]);
  const typed = query.trim();
  const canUse = picked != null || typed.length > 0;
  const use = () => {
    if (picked != null) onPick({ libraryExerciseId: picked, customName: null });
    else if (typed) onPick({ libraryExerciseId: null, customName: typed });
  };
  return (
    <div className="wo-sheet-scrim" onClick={onClose}>
      <div className="wo-sheet" role="dialog" aria-label={`Swap ${exerciseName}`} onClick={(e) => e.stopPropagation()}>
        <span className="wo-sheet-grab" aria-hidden="true" />
        <h2 className="wo-sheet-title">Swap {exerciseName}</h2>
        <p className="wo-sheet-sub">Machine taken? Log what you did instead. {coachName} sees the swap.</p>
        <div className="wo-sheet-kicker">{q ? "From the library" : "Or write it down"}</div>
        <input
          className="wo-sheet-input"
          type="text"
          value={query}
          placeholder="Search the library, or type a name"
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(null);
          }}
        />
        {matches.length > 0 && (
          <div className="wo-sheet-list">
            {matches.map((e) => (
              <button key={e.id} type="button" className={`wo-option${e.id === picked ? " on" : ""}`} aria-pressed={e.id === picked} onClick={() => setPicked(e.id === picked ? null : e.id)}>
                <span className="wo-radio" aria-hidden="true" />
                <span className="wo-option-name">{e.name}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" className="wo-sheet-btn" disabled={!canUse} onClick={use}>
          {picked != null ? "Use this" : typed ? `Use “${typed}”` : "Use"}
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
