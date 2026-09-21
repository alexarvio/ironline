"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { addClientPhaseAction, removeClientPhaseAction, schedulePhaseAction, updateClientPhaseAction } from "../lib/actions";
import type { ClientPhase, PhaseTrack } from "../lib/db";
import PhaseCalendar, { isoWeek, mondayOf, monthOf, type CalMonth, type PlannedRange } from "./PhaseCalendar";
import { phaseChrome, phaseStateOf, STATE_LABEL, TRACK_LABEL, TRACK_PALETTE, type PhaseState } from "./phaseChrome";

export { isoWeek };

const TRACKS: PhaseTrack[] = ["nutrition", "training", "lifestyle"];
const LENGTHS = [4, 6, 8, 12];

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
const parse = (s: string) => new Date(`${s}T00:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (date: string, n: number) => {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
const weeksBetween = (a: string, b: string) => Math.round(daysBetween(a, b) / 7);
// Start and End as they read in their fields, and how they are typed:
// 21/09/2026 (or with - . or a space between), 21092026, or 2026-09-21.
const fieldDate = (d: string) => (d ? parse(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const fieldDay = (d: string) => (d ? parse(d).toLocaleDateString("en-GB", { weekday: "short" }) : "");
/** The day typed, once it is a whole real date; null until then. */
const typedDate = (raw: string): string | null => {
  const s = raw.trim();
  let d: number, m: number, y: number;
  let r = /^([0-9]{1,2})[/.\- ]([0-9]{1,2})[/.\- ]([0-9]{4})$/.exec(s);
  if (r) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^([0-9]{2})([0-9]{2})([0-9]{4})$/.exec(s))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/.exec(s))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  const date = new Date(y, m - 1, d);
  if (y < 2000 || y > 2100 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return iso(date);
};

// "+ Add phase" in the Plan card's header, or any button that opens the same
// dialog. With `phase` set it edits (and can delete) that phase.
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
  /** A new phase's first week; in "schedule" mode, the week the span slides to. */
  defaultStart?: string;
  defaultEnd?: string;
  /** The other phases, for the calendar's planned bars and the overlap warning. */
  others?: PhaseNeighbour[];
  /** Programmes a new training phase could be linked to. */
  programs?: PhaseProgramOption[];
  /** Show the track chips. Only the Plan screen's “Add phase” does: every
      other way in already knows which track it is about. */
  chooseTrack?: boolean;
  /** "schedule": the last step for a draft — named, dated and sent out. */
  mode?: "edit" | "schedule";
  /** Scheduling a training phase: its length is its programme's, so only the start is picked. */
  lockedWeeks?: number | null;
  /** Start on a Monday, end on a Sunday, so a phase is whole weeks — what the
      Plan timeline draws. Off only for a track that one day needs part-weeks. */
  snapToWeeks?: boolean;
  onClose: () => void;
};

// Schedule or edit a phase, the same dialog on Plan, Training, Nutrition and
// Measurements. Its colours come from the phase's state (phaseChrome), which
// is worked out from the dates on screen on every render: move a live
// phase's start into the future and it turns scheduled blue as you click.
export function PhaseDialog({
  clientId,
  phase,
  program,
  today: todayProp,
  defaultTrack,
  defaultStart,
  defaultEnd,
  others = [],
  programs = [],
  chooseTrack = false,
  mode = "edit",
  lockedWeeks = null,
  snapToWeeks = true,
  onClose,
}: PhaseDialogProps) {
  const today = todayProp ?? iso(new Date());
  const scheduling = mode === "schedule" && !!phase;
  const editing = !!phase && !scheduling;
  const snapStart = (d: string) => (snapToWeeks ? mondayOf(d) : d);
  const snapEnd = (d: string) => (snapToWeeks ? addDays(mondayOf(d), 6) : d);

  // The selection is held as its first and last DAY; the form posts weeks.
  const [initial] = useState(() => {
    if (scheduling) {
      const from = snapStart(defaultStart ?? phase.start_week);
      const weeks = lockedWeeks ?? weeksBetween(phase.start_week, phase.end_week) + 1;
      return { from, to: addDays(from, weeks * 7 - 1) };
    }
    if (phase) return { from: phase.start_week, to: addDays(phase.end_week, 6) };
    if (defaultStart) return { from: snapStart(defaultStart), to: snapEnd(defaultEnd ?? defaultStart) };
    return { from: "", to: "" };
  });
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [name, setName] = useState(phase?.name ?? "");
  const [track, setTrack] = useState<PhaseTrack>(phase?.track ?? defaultTrack ?? "nutrition");
  // A live or scheduled programme starts on its deploy week; only the end moves.
  const startLocked = !scheduling && !!program && program.status !== "draft";
  const endLocked = !!lockedWeeks;
  // Exactly one end is armed: the one the next click in the calendar sets.
  const [active, setActive] = useState<"start" | "end">(startLocked ? "end" : "start");
  const [month, setMonth] = useState<CalMonth>(() => monthOf(initial.from || today));
  const [programChoice, setProgramChoice] = useState<string>("new");
  const [adjust, setAdjust] = useState(true);
  const [confirming, setConfirming] = useState(false);
  // Delete asks first: one click used to remove the phase outright.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    nameRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ---- The state, and so the colours: derived, never stored ----
  // A new phase is a draft on every track until it is deployed. Scheduling
  // shows what the phase is about to become.
  const isDraft = scheduling ? false : !phase ? true : !!phase.draft || program?.status === "draft";
  const startWeek = from ? mondayOf(from) : "";
  const endWeek = to ? mondayOf(to) : "";
  const state: PhaseState = startWeek ? phaseStateOf({ draft: isDraft, startWeek, endWeek: endWeek || startWeek, today }) : isDraft ? "draft" : "scheduled";
  const sel = phaseChrome(track, state);
  const palette = TRACK_PALETTE[track];
  const savedState = phase ? phaseStateOf({ draft: isDraft, startWeek: phase.start_week, endWeek: phase.end_week, today }) : null;
  const wasLive = editing && savedState === "live";

  // ---- Picking ----
  const pick = (day: string) => {
    if (endLocked) {
      // A programme's length is fixed: the click moves the whole span.
      const s = snapStart(day);
      setFrom(s);
      setTo(addDays(s, lockedWeeks! * 7 - 1));
      return;
    }
    if (active === "start" && !startLocked) {
      const s = snapStart(day);
      setFrom(s);
      if (!to || to < s) setTo(snapEnd(day));
      setActive("end");
      return;
    }
    const e = snapEnd(day);
    if (!from) {
      setFrom(snapStart(day));
      setTo(e);
      return;
    }
    // Before the start: that day becomes the start, rather than a range that
    // runs backwards. The end stays armed.
    if (e < from) {
      if (!startLocked) setFrom(snapStart(day));
      return;
    }
    setTo(e);
    if (!startLocked) setActive("start");
  };
  // What is being typed into Start or End; null shows the day it holds.
  const [typing, setTyping] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  // A whole date typed into a field does what a click on that day does for
  // that end, and the calendar turns to its month. Phases are whole weeks,
  // so a Wednesday selects its week. An end before the start is not taken.
  const typeDate = (end: "start" | "end", raw: string) => {
    setTyping((t) => ({ ...t, [end]: raw }));
    const day = typedDate(raw);
    if (!day) return;
    if (end === "start") {
      if (startLocked) return;
      const s = snapStart(day);
      setFrom(s);
      if (endLocked) setTo(addDays(s, lockedWeeks! * 7 - 1));
      else if (!to || to < s) setTo(snapEnd(day));
    } else {
      if (endLocked) return;
      const e = snapEnd(day);
      if (from && e < from) return;
      if (!from) setFrom(snapStart(day));
      setTo(e);
    }
    setMonth(monthOf(day));
  };
  // Typed, whole, and not taken: said in the field rather than ignored.
  const refused = (end: "start" | "end") => {
    const raw = typing[end];
    if (raw == null || raw.replace(/[^0-9]/g, "").length < 8) return false;
    const day = typedDate(raw);
    return !day || (end === "end" && !!from && snapEnd(day) < from);
  };
  const arm = (end: "start" | "end") => {
    setActive(end);
    const day = end === "start" ? from : to;
    if (day) setMonth(monthOf(day));
  };
  const setLength = (weeks: number) => {
    if (!from) return;
    setTo(addDays(mondayOf(from), weeks * 7 - 1));
  };

  // ---- What is on screen ----
  const weeks = from && to ? weeksBetween(mondayOf(from), mondayOf(to)) + 1 : 0;
  const days = from && to ? daysBetween(from, to) + 1 : 0;
  const planned: PlannedRange[] = others
    .filter((o) => o.track === track && !(phase && o.id === phase.id))
    .map((o) => ({ name: o.name, from: o.start_week, to: addDays(o.end_week, 6) }));
  const overlap = !!from && !!to && planned.some((p) => p.from <= to && p.to >= from);

  // A training phase's programme follows the phase's length.
  const weekDelta = program && !scheduling ? weeks - program.totalWeeks : 0;
  let removable = 0;
  if (program && weekDelta < 0) {
    for (let i = program.totalWeeks; i > weeks; i--) {
      if (program.loggedWeeks.includes(i)) break;
      removable += 1;
    }
  }
  const removeFrom = program ? program.totalWeeks - removable + 1 : 0;
  const removeLabel = removable === 0 ? null : removable === 1 ? `week ${program!.totalWeeks}` : `weeks ${removeFrom}–${program!.totalWeeks}`;
  const datesChanged = !!phase && (startWeek !== phase.start_week || endWeek !== phase.end_week);
  const trackChanged = !!phase && track !== phase.track;

  const ready = name.trim().length > 0 && !!from && !!to;
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    if (confirmingDelete) {
      setTimeout(onClose, 0);
      return;
    }
    if (!ready) {
      e.preventDefault();
      return;
    }
    if (wasLive && (datesChanged || trackChanged) && !confirming) {
      e.preventDefault();
      setConfirming(true);
      return;
    }
    setTimeout(onClose, 0);
  };

  const available = programs.filter((p) => !p.linked);
  const vars = { "--sel-edge": sel.edge, "--sel-soft": sel.soft, "--sel-band": sel.band } as CSSProperties;
  const title = scheduling ? "Schedule phase" : editing ? "Edit phase" : "New phase";
  const action = scheduling ? schedulePhaseAction : editing ? updateClientPhaseAction : addClientPhaseAction;

  return createPortal(
    <div className="pl-dlg-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pl-dlg" role="dialog" aria-modal="true" aria-label={title} style={vars}>
        <header className="pl-dlg-head">
          <h2>{title}</h2>
          {/* The tag names the track and always wears its colours; the chip
              beside it says what state the phase is in, in that state's. */}
          <span className="pl-track-tag" style={{ background: palette.tint, color: palette.ink }}>
            {TRACK_LABEL[track]}
          </span>
          <span className="pl-dlg-state" style={{ background: sel.chipBg, color: sel.chipInk }}>
            {STATE_LABEL[state]}
          </span>
        </header>

        <form action={action} className="pl-dlg-form" onSubmit={submit}>
          <div className="pl-dlg-body">
            {phase ? <input type="hidden" name="id" value={phase.id} /> : <input type="hidden" name="clientId" value={clientId} />}
            {!scheduling && <input type="hidden" name="track" value={program ? "training" : track} />}
            <input type="hidden" name="start" value={startWeek} />
            <input type="hidden" name="end" value={endWeek} />
            {program && weekDelta !== 0 && adjust && <input type="hidden" name="adjustProgram" value="1" />}
            {!phase && track === "training" && <input type="hidden" name="programId" value={programChoice} />}

            {/* Only where the track is genuinely an open question: the Plan
                screen's "Add phase". Everywhere else the way in already said
                which track you meant. */}
            {chooseTrack && !phase && (
              <div className="pl-dlg-field">
                <span className="pl-dlg-label">Track</span>
                <div className="pl-chips">
                  {TRACKS.map((t) => {
                    const on = t === track;
                    const p = TRACK_PALETTE[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`pl-chip${on ? " active" : ""}`}
                        style={on ? { background: p.tint, color: p.ink, borderColor: p.ink } : undefined}
                        onClick={() => setTrack(t)}
                        disabled={!!program}
                      >
                        {TRACK_LABEL[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="pl-dlg-field">
              <span className="pl-dlg-label">Name</span>
              <input ref={nameRef} name="name" type="text" className="pl-dlg-input" placeholder="Name this phase" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            </label>

            {/* Two fields, one armed: the ring says which end the next click
                in the calendar sets. Either can be typed as well: a whole
                date selects it in the calendar. */}
            <div className="pl-dlg-ends">
              {(["start", "end"] as const).map((end) => {
                const locked = end === "start" ? startLocked : endLocked;
                const value = end === "start" ? from : to;
                const label = end === "start" ? "Start" : "End";
                return (
                  <label
                    key={end}
                    className={`pl-dlg-end${active === end && !locked ? " on" : ""}${locked ? " locked" : ""}${refused(end) ? " bad" : ""}`}
                    title={
                      locked
                        ? end === "start"
                          ? "A live or scheduled programme starts on its deploy week"
                          : "Its length follows the programme: add or remove weeks in Training"
                        : undefined
                    }
                  >
                    <span className="pl-dlg-label">{label}</span>
                    <span className="pl-dlg-date-row">
                      <input
                        className="pl-dlg-date"
                        type="text"
                        inputMode="numeric"
                        placeholder="dd/mm/yyyy"
                        maxLength={10}
                        value={typing[end] ?? fieldDate(value)}
                        onFocus={(e) => {
                          arm(end);
                          e.currentTarget.select();
                        }}
                        onChange={(e) => typeDate(end, e.target.value)}
                        onBlur={() => setTyping((t) => ({ ...t, [end]: null }))}
                        onKeyDown={(e) => {
                          // Enter settles the date rather than sending the form.
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        disabled={locked}
                        aria-label={`${label} date, day month year`}
                      />
                      <small>{refused(end) ? (typedDate(typing[end] ?? "") ? "before the start" : "not a date") : fieldDay(value)}</small>
                    </span>
                  </label>
                );
              })}
            </div>

            <PhaseCalendar month={month} onMonth={setMonth} from={from} to={to} onPick={pick} planned={planned} chrome={sel} />

            <div className="pl-cal-legend">
              <span>
                <i className={`pl-cal-sw${sel.dashed ? " dashed" : ""}`} style={{ background: sel.band, borderColor: sel.edge }} />
                {state === "draft" ? "Draft — not deployed" : state === "scheduled" ? "Scheduled" : "This phase"}
              </span>
              {planned.length > 0 && (
                <span>
                  <i className="pl-cal-sw planned" /> already planned
                </span>
              )}
              {overlap && (
                <span className="pl-overlap">
                  <i className="pl-cal-sw planned clash" /> overlap
                </span>
              )}
            </div>

            <div className="pl-dlg-length">
              <div>
                <b>{weeks ? `${weeks} week${weeks === 1 ? "" : "s"}` : "No dates yet"}</b>
                {overlap ? (
                  <small className="pl-overlap">Overlaps a phase already on this track</small>
                ) : (
                  from && to && (
                    <small>
                      W{isoWeek(from)} → W{isoWeek(to)} · {days} day{days === 1 ? "" : "s"}
                    </small>
                  )
                )}
              </div>
              {!endLocked && (
                <div className="pl-dlg-pills">
                  {LENGTHS.map((n) => (
                    <button key={n} type="button" className={weeks === n ? "on" : undefined} onClick={() => setLength(n)} disabled={!from}>
                      {n} wk
                    </button>
                  ))}
                </div>
              )}
            </div>

            {endLocked && <p className="ph-note">Its length follows the programme: add or remove weeks in Training.</p>}
            {startLocked && program && (
              <p className="ph-note">
                This is the {program.status === "live" ? "live" : "scheduled"} training programme. It starts on its deploy week; move the end to shorten or extend it.
              </p>
            )}
            {!phase && track === "nutrition" && <p className="ph-note">It starts as a draft only you see. Set its targets on the Nutrition tab, then deploy it.</p>}
            {!phase && track === "training" && (
              <label className="pl-dlg-field">
                <span className="pl-dlg-label">Programme</span>
                <select value={programChoice} onChange={(e) => setProgramChoice(e.target.value)} className="ph-select">
                  <option value="new">Create new programme (draft) · {weeks || "?"} weeks</option>
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
          </div>

          <footer className="pl-dlg-foot">
            {confirmingDelete && phase ? (
              <div className="pl-dlg-ask" role="alert">
                <span>
                  <strong>Delete {phase.name}?</strong>
                  {wasLive && " The client is in this phase right now."}
                  {phase.track === "nutrition"
                    ? " Its daily targets and note go with it."
                    : phase.program_id
                    ? " A programme with nothing built yet goes with it; anything built, scheduled or live stays on the Training tab."
                    : ""}{" "}
                  Anything already logged stays. This can&rsquo;t be undone.
                </span>
                <div className="pl-dlg-actions">
                  <button type="button" className="pl-dlg-cancel" onClick={() => setConfirmingDelete(false)}>
                    Back
                  </button>
                  <button type="submit" formAction={removeClientPhaseAction} className="pl-dlg-danger" formNoValidate>
                    Yes, delete
                  </button>
                </div>
              </div>
            ) : confirming ? (
              <div className="pl-dlg-ask" role="alert">
                <span>
                  <strong>This phase is live.</strong> The client is in it right now, and their app changes as soon as you save.
                  {program && weekDelta !== 0 && adjust && " The training programme changes with it."}
                </span>
                <div className="pl-dlg-actions">
                  <button type="button" className="pl-dlg-cancel" onClick={() => setConfirming(false)}>
                    Back
                  </button>
                  <button type="submit" className="pl-dlg-save">
                    Yes, save
                  </button>
                </div>
              </div>
            ) : (
              <>
                {editing && (
                  <button type="button" className="pl-text-btn danger" onClick={() => setConfirmingDelete(true)}>
                    Delete
                  </button>
                )}
                <div className="pl-dlg-actions">
                  <button type="button" className="pl-dlg-cancel" onClick={onClose}>
                    Cancel
                  </button>
                  <button type="submit" className="pl-dlg-save" disabled={!ready}>
                    {scheduling ? (startWeek && startWeek <= today ? "Make it live" : "Schedule it") : "Save"}
                  </button>
                </div>
              </>
            )}
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}
