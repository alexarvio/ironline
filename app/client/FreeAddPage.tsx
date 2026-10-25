"use client";

import { useState } from "react";
import type { LibraryPick } from "./workoutShared";
import { Bars } from "./Bars";

// A free session's own page (19 Oct, Alex: "an empty canvas"): the next
// exercise, typed. Matches from the coach's library come up as the name is
// typed, as on the admin's add row, with "Create" for one that isn't there.
// A pick is only a name: the session stays the client's own. It sits after
// the exercises added so far, before the wrap-up.

export default function FreeAddPage({
  library,
  count,
  onAdd,
}: {
  library: LibraryPick[];
  /** Exercises in the session so far. */
  count: number;
  /** Adds it; resolves once it is in the session (false when it could not be). */
  onAdd: (pick: { exerciseId: number | null; name: string; group: string }) => Promise<boolean>;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const matches = needle ? library.filter((e) => e.name.toLowerCase().includes(needle)).sort((a, b) => Number(!a.name.toLowerCase().startsWith(needle)) - Number(!b.name.toLowerCase().startsWith(needle)) || a.name.localeCompare(b.name)).slice(0, 8) : [];
  const exact = library.some((e) => e.name.toLowerCase() === needle);

  const add = async (pick: { exerciseId: number | null; name: string; group: string }) => {
    if (busy || !pick.name.trim()) return;
    setBusy(true);
    setProblem(null);
    const ok = await onAdd(pick).catch(() => false);
    setBusy(false);
    if (ok) setQ("");
    else setProblem("That didn't add. Try again.");
  };
  const create = () => add({ exerciseId: null, name: q.trim(), group: "other" });
  // Cardio of one's own (19 Oct): its own page, time and distance typed in there.
  const createCardio = () => add({ exerciseId: null, name: q.trim(), group: "cardio" });

  return (
    <div className="wo-page-inner fa">
      <div className="fa-head">
        <span className="fa-eyebrow"><Bars parts={["Rogue session", count === 0 ? "nothing yet" : `${count} exercise${count === 1 ? "" : "s"}`]} /></span>
        <h2 className="fa-title">Add exercise</h2>
      </div>
      <input
        className="fa-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !needle) return;
          const first = matches[0];
          if (first && first.name.toLowerCase() === needle) add({ exerciseId: first.id, name: first.name, group: first.group });
          else if (!exact) create();
        }}
        placeholder="Type an exercise"
        aria-label="Type an exercise"
        enterKeyHint="done"
        disabled={busy}
      />
      {problem && (
        <p className="fa-problem" role="alert">
          {problem}
        </p>
      )}
      {needle && (
        <div className="fa-list" role="listbox" aria-label="Matches">
          {matches.map((e) => (
            <button key={e.id} type="button" role="option" aria-selected={false} className="fa-row" onClick={() => add({ exerciseId: e.id, name: e.name, group: e.group })} disabled={busy}>
              {/* The row is the button (19 Oct, Alex): no "Add"; Cardio sits where it was. */}
              <span className="fa-row-name">{e.name}</span>
              {e.group === "cardio" && <small className="fa-tag">Cardio</small>}
            </button>
          ))}
          {!exact && (
            // One row for one's own (19 Oct, Alex: two "Create" rows read as the
            // same thing twice): the name, then which kind, Strength or Cardio.
            <div className="fa-row fa-create">
              <span className="fa-row-name">Create &ldquo;{q.trim()}&rdquo;</span>
              <span className="fa-kinds" role="group" aria-label={`Create ${q.trim()} as`}>
                <button type="button" className="fa-kind" onClick={create} disabled={busy}>
                  Strength
                </button>
                <button type="button" className="fa-kind cardio" onClick={createCardio} disabled={busy}>
                  Cardio
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
