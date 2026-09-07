"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addClientPhaseAction, removeClientPhaseAction, updateClientPhaseAction } from "../lib/actions";
import type { ClientPhase, PhaseTrack } from "../lib/db";

const TRACKS: { id: PhaseTrack; label: string }[] = [
  { id: "nutrition", label: "Nutrition" },
  { id: "training", label: "Training" },
  { id: "lifestyle", label: "Lifestyle" },
];

// Either the "+ Add phase" button in the timeline head, or a phase bar in
// the grid; both open the same dialog. With `phase` set, the dialog edits
// (and can delete) that phase; without it, it adds one.
export default function PhaseDialogButton({
  clientId,
  phase,
  bar = false,
  tone,
  label,
  defaultStart,
  defaultEnd,
}: {
  clientId: number;
  phase?: ClientPhase;
  bar?: boolean;
  tone?: { bg: string; fg: string };
  label?: string;
  defaultStart?: string;
  defaultEnd?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {bar && phase ? (
        <button
          type="button"
          className="ph-bar"
          style={tone ? { background: tone.bg, color: tone.fg } : undefined}
          onClick={() => setOpen(true)}
          title={label}
          aria-label={`Edit ${phase.name}`}
        >
          <span className="ph-bar-name">{phase.name}</span>
        </button>
      ) : (
        <button type="button" className="ad-btn-secondary" onClick={() => setOpen(true)}>
          + Add phase
        </button>
      )}
      {open && (
        <PhaseDialog
          clientId={clientId}
          phase={phase}
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PhaseDialog({
  clientId,
  phase,
  defaultStart,
  defaultEnd,
  onClose,
}: {
  clientId: number;
  phase?: ClientPhase;
  defaultStart?: string;
  defaultEnd?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const editing = !!phase;

  return createPortal(
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label={editing ? "Edit phase" : "Add phase"}>
        <h2 className="pb-confirm-title">{editing ? "Edit phase" : "Add phase"}</h2>
        <p className="pb-confirm-body">
          A block on one track, from one week to another. Dates snap to the Monday of their week.
        </p>
        <form
          action={editing ? updateClientPhaseAction : addClientPhaseAction}
          className="cd-form"
          onSubmit={() => setTimeout(onClose, 0)}
        >
          {editing ? <input type="hidden" name="id" value={phase.id} /> : <input type="hidden" name="clientId" value={clientId} />}
          <label className="plan-schedule-field">
            <span>Track</span>
            <select name="track" defaultValue={phase?.track ?? "nutrition"} className="ph-select">
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-schedule-field">
            <span>Phase</span>
            <input
              ref={ref}
              name="name"
              type="text"
              placeholder="Bulk, Cut, Hypertrophy, Morning routine…"
              defaultValue={phase?.name ?? ""}
              required
              maxLength={40}
            />
          </label>
          <div className="cd-form-row">
            <label className="plan-schedule-field">
              <span>From (week of)</span>
              <input name="start" type="date" defaultValue={phase?.start_week ?? defaultStart} required />
            </label>
            <label className="plan-schedule-field">
              <span>To (week of)</span>
              <input name="end" type="date" defaultValue={phase?.end_week ?? defaultEnd} required />
            </label>
          </div>
          <div className="pb-modal-foot">
            {editing && (
              <button
                type="submit"
                formAction={removeClientPhaseAction}
                className="ad-btn-secondary ph-delete"
                formNoValidate
              >
                Delete
              </button>
            )}
            <button type="button" className="ad-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ad-btn-primary">
              {editing ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
