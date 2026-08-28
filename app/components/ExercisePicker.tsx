"use client";

import { useRef, useState } from "react";
import { addExerciseToLibraryAction } from "../lib/actions";

type Group = { slug: string; label: string };
type ExerciseOption = { id: number; name: string };

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
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [addingNew, setAddingNew] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const pick = (ex: ExerciseOption) => {
    setSelectedId(ex.id);
    setSelectedName(ex.name);
    setOpen(false);
    setActiveGroup(null);
    setAddingNew(false);
  };

  const toggleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  };

  return (
    <div className="exercise-picker">
      <input type="hidden" name="exerciseId" form={formId} value={selectedId ?? ""} />
      <button
        ref={triggerRef}
        type="button"
        className="exercise-picker-trigger"
        onClick={toggleOpen}
      >
        {selectedName || "Add exercise…"}
      </button>

      {open && (
        <>
          <div className="exercise-picker-backdrop" onClick={() => setOpen(false)} />
          <div className="exercise-picker-pop" style={pos ? { top: pos.top, left: pos.left } : undefined}>
          {!activeGroup ? (
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
                {(exercisesByGroup[activeGroup] ?? []).length === 0 && !addingNew && (
                  <div className="empty-note" style={{ padding: "6px 4px" }}>
                    No exercises yet in this group.
                  </div>
                )}
                {(exercisesByGroup[activeGroup] ?? []).map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    className="exercise-picker-item"
                    onClick={() => pick(ex)}
                  >
                    {ex.name}
                  </button>
                ))}
              </div>

              {addingNew ? (
                <form
                  action={addExerciseToLibraryAction}
                  className="exercise-picker-add-form"
                  onSubmit={() => setTimeout(() => setAddingNew(false), 50)}
                >
                  <input type="hidden" name="muscleGroup" value={activeGroup} />
                  <input name="name" type="text" placeholder="Exercise name" required autoFocus />
                  <input name="videoUrl" type="url" placeholder="Video link (optional)" />
                  <button className="btn secondary" type="submit">
                    + Add to library
                  </button>
                </form>
              ) : (
                <button type="button" className="exercise-picker-add-toggle" onClick={() => setAddingNew(true)}>
                  + Add new exercise
                </button>
              )}
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}
