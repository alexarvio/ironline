"use client";

import { useOptimistic, useState, useTransition, type HTMLAttributes } from "react";
import { removePhotoSlotAction, setPhotoSlotPausedAction, updatePhotoSlotAction } from "../lib/actions";

type Slot = { id: number; label: string; paused: boolean };

// One angle as a chip. A click pauses it or asks for it again. The ⋯ button
// (or a right-click) opens Rename and Delete in place of the chip.
export default function PhotoSlotRow({
  slot,
  dragging = false,
  dragProps,
}: {
  slot: Slot;
  dragging?: boolean;
  dragProps?: HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
}) {
  const [mode, setMode] = useState<"view" | "menu" | "edit" | "confirm-delete">("view");
  const [paused, setPaused] = useOptimistic(slot.paused);
  const [, startSaving] = useTransition();

  const toggle = () =>
    startSaving(async () => {
      setPaused(!paused);
      await setPhotoSlotPausedAction(slot.id, !paused);
    });

  const className = `pp-chip${paused ? " paused" : ""}${dragging ? " dragging" : ""}${mode !== "view" ? " editing" : ""}`;

  if (mode === "edit") {
    return (
      <div className={className}>
        <form
          className="pp-chip-form"
          action={async (fd) => {
            await updatePhotoSlotAction(fd);
            setMode("view");
          }}
        >
          <input type="hidden" name="id" value={slot.id} />
          <input
            name="label"
            type="text"
            defaultValue={slot.label}
            required
            autoFocus
            className="pp-chip-input"
            aria-label="Angle name"
            onKeyDown={(e) => e.key === "Escape" && setMode("view")}
          />
          <button type="submit" className="pp-chip-act">
            Save
          </button>
          <button type="button" className="pp-chip-act" onClick={() => setMode("view")}>
            Cancel
          </button>
        </form>
      </div>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <div className={className}>
        <form className="pp-chip-form" action={removePhotoSlotAction}>
          <input type="hidden" name="id" value={slot.id} />
          <span className="pp-chip-name">Delete {slot.label} and its photos?</span>
          <button type="submit" className="pp-chip-act danger">
            Delete
          </button>
          <button type="button" className="pp-chip-act" onClick={() => setMode("view")}>
            Cancel
          </button>
        </form>
      </div>
    );
  }

  if (mode === "menu") {
    return (
      <div className={className}>
        <span className="pp-chip-name">{slot.label}</span>
        <button type="button" className="pp-chip-act" onClick={() => setMode("edit")}>
          Rename
        </button>
        <button type="button" className="pp-chip-act danger" onClick={() => setMode("confirm-delete")}>
          Delete
        </button>
        <button type="button" className="pp-chip-act" aria-label="Close" onClick={() => setMode("view")}>
          ×
        </button>
      </div>
    );
  }

  return (
    <div
      className={className}
      {...dragProps}
      onContextMenu={(e) => {
        e.preventDefault();
        setMode("menu");
      }}
    >
      <button
        type="button"
        className="pp-chip-toggle"
        aria-pressed={!paused}
        title={paused ? `Ask for ${slot.label} again` : `Pause ${slot.label}`}
        onClick={toggle}
      >
        <span className="pp-chip-dot" aria-hidden="true" />
        <span className="pp-chip-name">{slot.label}</span>
        {paused && <span className="pp-chip-state">Paused</span>}
      </button>
      <button type="button" className="pp-chip-more" aria-label={`Rename or delete ${slot.label}`} onClick={() => setMode("menu")}>
        ⋯
      </button>
    </div>
  );
}
