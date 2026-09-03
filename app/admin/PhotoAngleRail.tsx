"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addPhotoSlotAction, removePhotoSlotAction, updatePhotoSlotAction } from "../lib/actions";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";

// The angles the coach wants, as a row of squares like the week rail: one
// per slot, its name editable in place (saves when you leave the field),
// and a dashed "+ Add angle" square at the end that asks for a name in a
// dialog. Whatever is here is what the client's photo sheet asks for.
export default function PhotoAngleRail({
  clientId,
  slots,
}: {
  clientId: number;
  slots: { id: number; label: string }[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="pa-rail">
      {slots.map((s) => (
        <div key={s.id} className="pa-square">
          <form action={updatePhotoSlotAction} className="pa-name-form">
            <input type="hidden" name="id" value={s.id} />
            <input
              name="label"
              defaultValue={s.label}
              className="pa-name"
              aria-label="Angle name"
              onBlur={(e) => {
                if (e.currentTarget.value.trim() && e.currentTarget.value !== s.label) e.currentTarget.form?.requestSubmit();
              }}
            />
          </form>
          <span className="pa-icon" aria-hidden="true">
            <CameraIcon />
          </span>
          <span className="pa-delete">
            <ConfirmDeleteButton
              action={removePhotoSlotAction}
              hiddenFields={{ id: s.id }}
              label={`Remove the ${s.label} angle`}
              description="Photos already taken for it stay in the history; the client just won't be asked for it again."
            />
          </span>
        </div>
      ))}
      <button type="button" className="pa-square pa-add" onClick={() => setAdding(true)}>
        <span className="pa-add-label">+ Add angle</span>
        <span className="pa-add-sub">{slots.length === 0 ? "e.g. Front" : `Angle ${slots.length + 1}`}</span>
      </button>

      {adding && <AddAngleDialog clientId={clientId} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddAngleDialog({ clientId, onClose }: { clientId: number; onClose: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label="Add an angle">
        <h2 className="pb-confirm-title">Add an angle</h2>
        <p className="pb-confirm-body">Name the shot the client should take, e.g. Front, Back, Front flexed, Side.</p>
        <form action={addPhotoSlotAction} className="cd-form" onSubmit={() => setTimeout(onClose, 0)}>
          <input type="hidden" name="clientId" value={clientId} />
          <label className="plan-schedule-field">
            <span>Angle</span>
            <input ref={ref} name="label" type="text" placeholder="Front" required maxLength={40} />
          </label>
          <div className="pb-modal-foot">
            <button type="button" className="ad-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ad-btn-primary">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
