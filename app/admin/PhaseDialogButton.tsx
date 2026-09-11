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

export const TRACK_TONE: Record<PhaseTrack, { bg: string; fg: string; mid: string }> = {
  nutrition: { bg: "#dff3ea", fg: "#0f5c46", mid: "#9fd3bb" },
  training: { bg: "#e6e4fa", fg: "#3a3390", mid: "#b9b4ec" },
  lifestyle: { bg: "#efede6", fg: "#4a4a45", mid: "#cfcbbd" },
};

/** What the dialog knows about the programme behind a training phase. */
export type PhaseProgramInfo = {
  status: "live" | "scheduled" | "draft";
  totalWeeks: number;
  /** 1-based programme weeks with logged sets: these can't be removed. */
  loggedWeeks: number[];
};
/** Another phase on the plan, for the overlap warning. */
export type PhaseNeighbour = { id: number; track: PhaseTrack; name: string; start_week: string; end_week: string };
/** A programme a new training phase could be the plan for. */
export type PhaseProgramOption = { id: number; name: string; status: "live" | "scheduled" | "draft"; weeks: number; linked: boolean };

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mondayOf = (date: string) => {
  const d = parse(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};
const addDays = (date: string, n: number) => {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const weeksBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / (7 * DAY));
export const isoWeek = (monday: string) => {
  const d = parse(monday);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 3);
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1.getTime()) / DAY / 7) + 1;
};

// Either the "+ Add phase" button in the card header, or a bar in the grid;
// both open the same dialog. With `phase` set, the dialog edits (and can
// delete) that phase; without it, it adds one.
export default function PhaseDialogButton(props: Omit<PhaseDialogProps, "onClose"> & { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const { label, className, ...dialog } = props;
  return (
    <>
      <button type="button" className={className ?? "pl-primary"} onClick={() => setOpen(true)}>
        {label ?? (dialog.phase ? "Edit phase" : "+ Add phase")}
      </button>
      {open && <PhaseDialog {...dialog} onClose={() => setOpen(false)} />}
    </>
  );
}

export type PhaseDialogProps = {
  clientId: number;
  phase?: ClientPhase;
  program?: PhaseProgramInfo;
  /** Server-local date, so "is this live" agrees with the timeline. */
  today?: string;
  defaultTrack?: PhaseTrack;
  defaultStart?: string;
  defaultEnd?: string;
  /** The other phases, for the overlap warning. */
  others?: PhaseNeighbour[];
  /** Programmes a new training phase could be linked to. */
  programs?: PhaseProgramOption[];
  onClose: () => void;
};

export function PhaseDialog({ clientId, phase, program, today, defaultTrack, defaultStart, defaultEnd, others = [], programs = [], onClose }: PhaseDialogProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const editing = !!phase;
  const [start, setStart] = useState(phase?.start_week ?? defaultStart ?? "");
  const [end, setEnd] = useState(phase?.end_week ?? defaultEnd ?? "");
  const [track, setTrack] = useState<PhaseTrack>(phase?.track ?? defaultTrack ?? "nutrition");
  const [programChoice, setProgramChoice] = useState<string>("new");
  const [adjust, setAdjust] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const tone = TRACK_TONE[track];
  // A live or scheduled programme starts on its deploy week; only the end moves.
  const startLocked = !!program && program.status !== "draft";
  const live = !!phase && !!today && phase.start_week <= today && addDays(phase.end_week, 6) >= today;

  const snappedStart = start ? mondayOf(start) : "";
  const snappedEnd = end ? mondayOf(end) : "";
  const ordered = snappedStart && snappedEnd ? (snappedStart <= snappedEnd ? [snappedStart, snappedEnd] : [snappedEnd, snappedStart]) : null;
  const newWeeks = ordered ? weeksBetween(ordered[0], ordered[1]) + 1 : 0;
  const datesChanged = !!phase && (snappedStart !== phase.start_week || snappedEnd !== phase.end_week);
  const trackChanged = !!phase && track !== phase.track;
  const weekDelta = program ? newWeeks - program.totalWeeks : 0;
  let removable = 0;
  if (program && weekDelta < 0) {
    for (let i = program.totalWeeks; i > newWeeks; i--) {
      if (program.loggedWeeks.includes(i)) break;
      removable += 1;
    }
  }
  const removeFrom = program ? program.totalWeeks - removable + 1 : 0;
  const removeLabel = removable === 0 ? null : removable === 1 ? `week ${program!.totalWeeks}` : `weeks ${removeFrom}–${program!.totalWeeks}`;

  // Another phase on the same track sharing weeks with this one.
  const overlap = (() => {
    if (!ordered) return null;
    for (const o of others) {
      if (o.track !== track || (phase && o.id === phase.id)) continue;
      const lo = ordered[0] > o.start_week ? ordered[0] : o.start_week;
      const hi = ordered[1] < o.end_week ? ordered[1] : o.end_week;
      if (lo <= hi) return { name: o.name, weeks: weeksBetween(lo, hi) + 1 };
    }
    return null;
  })();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    if (live && (datesChanged || trackChanged) && !confirming) {
      e.preventDefault();
      setConfirming(true);
      return;
    }
    setTimeout(onClose, 0);
  };

  const available = programs.filter((p) => !p.linked);

  return createPortal(
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal pb-modal-sm pl-dialog" role="dialog" aria-modal="true" aria-label={editing ? "Edit phase" : "New phase"} style={{ borderTop: `4px solid ${tone.fg}` }}>
        <div className="pl-dialog-head">
          <h2 className="pb-confirm-title">{editing ? "Edit phase" : "New phase"}</h2>
          <span className="pl-track-tag" style={{ background: tone.bg, color: tone.fg }}>
            {TRACKS.find((t) => t.id === track)?.label}
          </span>
        </div>
        <form action={editing ? updateClientPhaseAction : addClientPhaseAction} className="cd-form" onSubmit={submit}>
          {editing ? <input type="hidden" name="id" value={phase.id} /> : <input type="hidden" name="clientId" value={clientId} />}
          <input type="hidden" name="track" value={program ? "training" : track} />
          {program && weekDelta !== 0 && adjust && <input type="hidden" name="adjustProgram" value="1" />}
          {!editing && track === "training" && <input type="hidden" name="programId" value={programChoice} />}

          <div className="plan-schedule-field">
            <span>Track</span>
            <div className="pl-chips">
              {TRACKS.map((t) => {
                const tt = TRACK_TONE[t.id];
                const active = t.id === track;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`pl-chip${active ? " active" : ""}`}
                    style={active ? { background: tt.bg, color: tt.fg, borderColor: tt.fg } : undefined}
                    onClick={() => setTrack(t.id)}
                    disabled={!!program}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="plan-schedule-field">
            <span>Name</span>
            <input ref={ref} name="name" type="text" placeholder="Bulk, Cut, Hypertrophy, Morning routine…" defaultValue={phase?.name ?? ""} required maxLength={40} />
          </label>
          <div className="cd-form-row">
            <label className="plan-schedule-field">
              <span>Start week</span>
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
              <span>End week</span>
              <input name="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </label>
          </div>
          {ordered && (
            <div className="pl-summary">
              <span>
                <b>
                  {newWeeks} week{newWeeks === 1 ? "" : "s"}
                </b>{" "}
                · W{isoWeek(ordered[0])} → W{isoWeek(ordered[1])}
              </span>
              {overlap && (
                <span className="pl-overlap">
                  Overlaps {overlap.name} by {overlap.weeks} week{overlap.weeks === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
          {startLocked && (
            <p className="ph-note">
              This is the {program.status === "live" ? "live" : "scheduled"} training programme. It starts on its deploy week; move the end to shorten or extend it.
            </p>
          )}

          {!editing && track === "training" && (
            <label className="plan-schedule-field">
              <span>Programme</span>
              <select value={programChoice} onChange={(e) => setProgramChoice(e.target.value)} className="ph-select">
                <option value="new">Create new programme (draft) · {newWeeks || "?"} weeks</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.status} · {p.weeks} wk
                  </option>
                ))}
              </select>
              <small className="pl-hint">Deploy later from Training.</small>
            </label>
          )}

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
                    {removable < -weekDelta ? "The other weeks past the new end have logged sets and stay." : "Everything built for those weeks goes with them."}
                  </>
                ) : (
                  <>
                    <strong>The programme keeps its weeks</strong>
                    The weeks past the new end have logged sets, so they can&rsquo;t be deleted.
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
                {editing ? "Save" : "Add phase"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}
