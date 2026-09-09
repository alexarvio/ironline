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

/** What the dialog knows about the programme behind a training phase. */
export type PhaseProgramInfo = {
  status: "live" | "scheduled" | "draft";
  totalWeeks: number;
  /** 1-based programme weeks with logged sets: these can't be removed. */
  loggedWeeks: number[];
};

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Monday of the week the date falls in. */
const mondayOf = (date: string) => {
  const d = parse(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return iso(d);
};
const addDays = (date: string, n: number) => {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const weeksBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / (7 * DAY));

// Either the "+ Add phase" button in the timeline head, or a phase bar in
// the grid; both open the same dialog. With `phase` set, the dialog edits
// (and can delete) that phase; without it, it adds one.
export default function PhaseDialogButton({
  clientId,
  phase,
  program,
  today,
  bar = false,
  tone,
  label,
  defaultStart,
  defaultEnd,
}: {
  clientId: number;
  phase?: ClientPhase;
  program?: PhaseProgramInfo;
  /** Server-local date, so "is this live" agrees with the timeline. */
  today?: string;
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
          {phase ? "Edit dates" : "+ Add phase"}
        </button>
      )}
      {open && (
        <PhaseDialog
          clientId={clientId}
          phase={phase}
          program={program}
          today={today}
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
  program,
  today,
  defaultStart,
  defaultEnd,
  onClose,
}: {
  clientId: number;
  phase?: ClientPhase;
  program?: PhaseProgramInfo;
  today?: string;
  defaultStart?: string;
  defaultEnd?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const editing = !!phase;
  const [start, setStart] = useState(phase?.start_week ?? defaultStart ?? "");
  const [end, setEnd] = useState(phase?.end_week ?? defaultEnd ?? "");
  const [track, setTrack] = useState<PhaseTrack>(phase?.track ?? "nutrition");
  const [adjust, setAdjust] = useState(true);
  // "Are you sure" step for a phase the client is in right now.
  const [confirming, setConfirming] = useState(false);

  // A live or scheduled programme starts on its deploy week; only the end moves.
  const startLocked = !!program && program.status !== "draft";
  const live = !!phase && !!today && phase.start_week <= today && addDays(phase.end_week, 6) >= today;

  // Where the dates will land once snapped, and what that means for the
  // programme behind a training phase.
  const snappedStart = start ? mondayOf(start) : "";
  const snappedEnd = end ? mondayOf(end) : "";
  const newWeeks = snappedStart && snappedEnd ? Math.abs(weeksBetween(snappedStart, snappedEnd)) + 1 : 0;
  const datesChanged = !!phase && (snappedStart !== phase.start_week || snappedEnd !== phase.end_week);
  const trackChanged = !!phase && track !== phase.track;
  const weekDelta = program ? newWeeks - program.totalWeeks : 0;
  // Trailing weeks that can actually go: from the end, until a logged one.
  let removable = 0;
  if (program && weekDelta < 0) {
    for (let i = program.totalWeeks; i > newWeeks; i--) {
      if (program.loggedWeeks.includes(i)) break;
      removable += 1;
    }
  }
  const removeFrom = program ? program.totalWeeks - removable + 1 : 0;
  const removeLabel =
    removable === 0
      ? null
      : removable === 1
      ? `week ${program!.totalWeeks}`
      : `weeks ${removeFrom}–${program!.totalWeeks}`;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    // A live phase asks once before its dates or track change; a rename alone doesn't.
    if (live && (datesChanged || trackChanged) && !confirming) {
      e.preventDefault();
      setConfirming(true);
      return;
    }
    setTimeout(onClose, 0);
  };

  return createPortal(
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label={editing ? "Edit phase" : "Add phase"}>
        <h2 className="pb-confirm-title">{editing ? "Edit phase" : "Add phase"}</h2>
        <p className="pb-confirm-body">
          A block on one track, from one week to another. Dates snap to the Monday of their week.
        </p>
        <form
          ref={formRef}
          action={editing ? updateClientPhaseAction : addClientPhaseAction}
          className="cd-form"
          onSubmit={submit}
        >
          {editing ? <input type="hidden" name="id" value={phase.id} /> : <input type="hidden" name="clientId" value={clientId} />}
          {program && weekDelta !== 0 && adjust && <input type="hidden" name="adjustProgram" value="1" />}
          <label className="plan-schedule-field">
            <span>Track</span>
            <select
              name="track"
              value={track}
              onChange={(e) => setTrack(e.target.value as PhaseTrack)}
              className="ph-select"
              disabled={!!program}
            >
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {program && <input type="hidden" name="track" value="training" />}
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
              <input
                name="start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
                readOnly={startLocked}
                title={startLocked ? "A programme that is live or scheduled starts on its deploy week" : undefined}
              />
            </label>
            <label className="plan-schedule-field">
              <span>To (week of)</span>
              <input name="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </label>
          </div>
          {startLocked && (
            <p className="ph-note">
              This is the {program.status === "live" ? "live" : "scheduled"} training programme. It starts on its deploy week; move the end to shorten or extend it.
            </p>
          )}

          {/* A training phase is a programme: offer to make the programme
              match the new length, and say what that means. */}
          {program && weekDelta > 0 && (
            <label className="ph-adjust">
              <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} />
              <span>
                <strong>
                  Also add {weekDelta} week{weekDelta === 1 ? "" : "s"} to the training programme
                </strong>
                New weeks are copies of week 1, ready to edit on the Training tab.
              </span>
            </label>
          )}
          {program && weekDelta < 0 && (
            <label className={removable === 0 ? "ph-adjust off" : "ph-adjust"}>
              <input type="checkbox" checked={adjust && removable > 0} disabled={removable === 0} onChange={(e) => setAdjust(e.target.checked)} />
              <span>
                {removable > 0 ? (
                  <>
                    <strong>Also delete {removeLabel} from the training programme</strong>
                    {removable < -weekDelta
                      ? "The other weeks past the new end have logged sets and stay."
                      : "Everything built for those weeks goes with them."}
                  </>
                ) : (
                  <>
                    <strong>The programme keeps its weeks</strong>
                    The weeks past the new end have logged sets, so they can't be deleted.
                  </>
                )}
              </span>
            </label>
          )}

          {confirming ? (
            <div className="ph-warn" role="alert">
              <strong>This phase is live.</strong> The client is in it right now, and their app changes as soon as you save.
              {program && weekDelta !== 0 && adjust && " The training programme changes with it."} Are you sure?
              <div className="pb-modal-foot">
                <button type="button" className="ad-btn-secondary" onClick={() => setConfirming(false)}>
                  Back
                </button>
                <button type="submit" className="ad-btn-primary">
                  Yes, save
                </button>
              </div>
            </div>
          ) : (
            <div className="pb-modal-foot">
              {editing && (
                <button type="submit" formAction={removeClientPhaseAction} className="ad-btn-secondary ph-delete" formNoValidate>
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
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}
