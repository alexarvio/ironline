"use client";

import { useMemo, useState } from "react";
import type { LibraryPick } from "./workoutShared";

// A free session's own page (19 Oct, Alex: "an empty canvas"): what to do
// next, picked from the coach's library or named by the client. It sits
// after the exercises already added, before the wrap-up, so a session is
// built one exercise at a time in the workout itself. The workout's language:
// hairlines, ink, no boxes but the search.

export default function FreeAddPage({
  library,
  coachName,
  count,
  onAdd,
}: {
  library: LibraryPick[];
  coachName: string;
  /** Exercises in the session so far. */
  count: number;
  /** Adds it; resolves once it is in the session (false when it could not be). */
  onAdd: (pick: { exerciseId: number | null; name: string; group: string }) => Promise<boolean>;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  // By group, then name; while typing, only what matches.
  const groups = useMemo(() => {
    const hits = library.filter((e) => !needle || e.name.toLowerCase().includes(needle)).sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
    const out: { group: string; items: LibraryPick[] }[] = [];
    for (const e of hits) {
      const last = out[out.length - 1];
      if (last && last.group === e.group) last.items.push(e);
      else out.push({ group: e.group, items: [e] });
    }
    return out;
  }, [library, needle]);
  const exact = library.some((e) => e.name.toLowerCase() === needle);

  const add = async (pick: { exerciseId: number | null; name: string; group: string }) => {
    if (busy) return;
    setBusy(pick.name);
    setProblem(null);
    const ok = await onAdd(pick).catch(() => false);
    setBusy(null);
    if (ok) setQ("");
    else setProblem("That didn't add. Try again.");
  };

  return (
    <div className="wo-page-inner fa">
      <div className="fa-head">
        <span className="fa-eyebrow">Free session · {count === 0 ? "nothing yet" : `${count} exercise${count === 1 ? "" : "s"}`}</span>
        <h2 className="fa-title">{count === 0 ? "What are you training?" : "Add another"}</h2>
        <p className="fa-sub">From {coachName}&rsquo;s library, or one of your own. No targets: log what you do.</p>
      </div>
      <input className="fa-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && needle && !exact && add({ exerciseId: null, name: q.trim(), group: "other" })} placeholder="Search exercises" aria-label="Search exercises" enterKeyHint="go" />
      {problem && (
        <p className="fa-problem" role="alert">
          {problem}
        </p>
      )}
      {needle && !exact && (
        <button type="button" className="fa-own" onClick={() => add({ exerciseId: null, name: q.trim(), group: "other" })} disabled={!!busy}>
          <span className="fa-plus" aria-hidden="true">+</span>
          <span>
            Add &ldquo;{q.trim()}&rdquo;
            <small>Your own, not in the library</small>
          </span>
        </button>
      )}
      <div className="fa-list">
        {groups.map((g) => (
          <div key={g.group} className="fa-group">
            <span className="fa-group-label">{g.group}</span>
            {g.items.map((e) => (
              <button key={e.id} type="button" className="fa-row" onClick={() => add({ exerciseId: e.id, name: e.name, group: e.group })} disabled={!!busy}>
                <span className="fa-row-name">{e.name}</span>
                <span className="fa-row-add">{busy === e.name ? "Adding…" : "Add"}</span>
              </button>
            ))}
          </div>
        ))}
        {groups.length === 0 && !needle && <p className="fa-empty">Type the exercise to add it.</p>}
      </div>
    </div>
  );
}
