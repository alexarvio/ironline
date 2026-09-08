"use client";

import { useEffect, useRef, useState } from "react";
import { addExerciseToLibraryAction } from "../lib/actions";

type Group = { slug: string; label: string };
type ExerciseOption = { id: number; name: string };

// The "Add exercise…" picker on a programme day. The popup opens on a search
// box: type and matching exercises from the whole library list at once.
// With nothing typed, the six groups sit under it as tiles; a tile opens
// that group's list. At the foot, whichever view is showing, there is a way
// to add a new exercise: a name, a group, an optional video, and Save,
// which puts it in the library and picks it for this row in one go.
export default function ExercisePicker({
  formId,
  groups,
  exercisesByGroup,
}: {
  formId: string;
  groups: readonly Group[];
  exercisesByGroup: Record<string, ExerciseOption[]>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [addingNew, setAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const pick = (ex: ExerciseOption) => {
    setSelectedId(ex.id);
    setSelectedName(ex.name);
    setOpen(false);
    setActiveGroup(null);
    setAddingNew(false);
    setQuery("");
  };

  const toggleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  };

  const q = query.trim().toLowerCase();
  const matches = q
    ? groups.flatMap((g) =>
        (exercisesByGroup[g.slug] ?? [])
          .filter((ex) => ex.name.toLowerCase().includes(q))
          .map((ex) => ({ ...ex, groupLabel: g.label }))
      )
    : [];

  // Group preselected for a new exercise: the one being browsed, else the
  // first group. Not "other": every group is a real choice on the form.
  const defaultGroup = activeGroup ?? groups[0]?.slug ?? "other";

  return (
    <div className="exercise-picker">
      <input type="hidden" name="exerciseId" form={formId} value={selectedId ?? ""} />
      <button ref={triggerRef} type="button" className="exercise-picker-trigger" onClick={toggleOpen}>
        {selectedName || "Add exercise…"}
      </button>

      {open && (
        <>
          <div className="exercise-picker-backdrop" onClick={() => setOpen(false)} />
          <div className="exercise-picker-pop" style={pos ? { top: pos.top, left: pos.left } : undefined}>
            <input
              ref={searchRef}
              type="search"
              className="exercise-picker-search"
              placeholder="Search exercises"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveGroup(null);
              }}
              aria-label="Search exercises"
            />

            {q ? (
              <div className="exercise-picker-list">
                {matches.length === 0 && (
                  <div className="empty-note" style={{ padding: "6px 4px" }}>
                    Nothing called &ldquo;{query.trim()}&rdquo; yet. Add it below.
                  </div>
                )}
                {matches.map((ex) => (
                  <button key={ex.id} type="button" className="exercise-picker-item" onClick={() => pick(ex)}>
                    {ex.name}
                    <span className="exercise-meta">{ex.groupLabel}</span>
                  </button>
                ))}
              </div>
            ) : !activeGroup ? (
              <div className="exercise-picker-groups">
                {groups.map((g) => (
                  <button
                    key={g.slug}
                    type="button"
                    className="exercise-picker-group-btn"
                    onClick={() => setActiveGroup(g.slug)}
                  >
                    {g.label}
                    <span className="exercise-meta">{exercisesByGroup[g.slug]?.length ?? 0}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="exercise-picker-header">
                  <button type="button" className="exercise-picker-back" onClick={() => setActiveGroup(null)}>
                    ‹ back
                  </button>
                  <span>{groups.find((g) => g.slug === activeGroup)?.label}</span>
                </div>
                <div className="exercise-picker-list">
                  {(exercisesByGroup[activeGroup] ?? []).length === 0 && (
                    <div className="empty-note" style={{ padding: "6px 4px" }}>
                      No exercises yet in this group.
                    </div>
                  )}
                  {(exercisesByGroup[activeGroup] ?? []).map((ex) => (
                    <button key={ex.id} type="button" className="exercise-picker-item" onClick={() => pick(ex)}>
                      {ex.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="exercise-picker-foot">
              {addingNew ? (
                <form
                  className="exercise-picker-add-form"
                  action={async (formData) => {
                    setSaving(true);
                    const created = await addExerciseToLibraryAction(formData);
                    setSaving(false);
                    if (created) pick(created);
                  }}
                >
                  <input
                    name="name"
                    type="text"
                    placeholder="Exercise name"
                    defaultValue={q ? query.trim() : ""}
                    required
                    autoFocus
                    aria-label="New exercise name"
                  />
                  <select name="muscleGroup" defaultValue={defaultGroup} aria-label="Muscle group">
                    {groups.map((g) => (
                      <option key={g.slug} value={g.slug}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <input name="videoUrl" type="url" placeholder="Video link (optional)" aria-label="Video link" />
                  <div className="exercise-picker-add-actions">
                    <button type="button" className="btn secondary btn-sm" onClick={() => setAddingNew(false)} disabled={saving}>
                      Cancel
                    </button>
                    <button className="btn btn-sm" type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save to library"}
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className="exercise-picker-add-toggle" onClick={() => setAddingNew(true)}>
                  + Add new exercise
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
