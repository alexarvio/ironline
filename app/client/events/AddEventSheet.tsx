"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { EVENT_TYPES, eventTypeOf, type EventTypeId } from "../../lib/eventTypes";
import { addDays, durationLabel, longDay } from "../../lib/eventDates";
import { useCoachIdentity } from "../CheckInContext";
import type { HomeEvent } from "../EventsCard";
import { CoachAvatar } from "./CoachAvatar";

// The "New event" sheet (9 Oct), colour-coded: the type picked colours the
// top of the sheet (wash, glow, grabber, the pill by the title), the picker
// and the title field. The date section and the Add button stay navy
// whatever the type. Opened from the navy card or one of its chips; the
// same sheet edits an event of the client's own.

export type EventValues = { type: EventTypeId; title: string; start: string; end: string; note: string };

export function TypeIcon({ path, size = 14, stroke = 2 }: { path: string; size?: number; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const valid = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso);
const fmt = (iso: string, today: string) => {
  if (!valid(iso)) return null;
  if (iso === today) return "Today";
  const d = new Date(`${iso}T00:00:00`);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export default function AddEventSheet({
  event = null,
  initialType,
  initial = null,
  error = null,
  coachName,
  today,
  pending = false,
  onClose,
  onSubmit,
  onDelete,
}: {
  /** Changing this one; null, a new event. */
  event?: HomeEvent | null;
  initialType: EventTypeId;
  /** Values to come back with after a failed save. */
  initial?: EventValues | null;
  error?: string | null;
  coachName: string;
  today: string;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (v: EventValues) => void;
  /** Editing: removes the event, after the sheet's own confirm. */
  onDelete?: () => void;
}) {
  const coach = useCoachIdentity();
  const seed: EventValues | null = initial ?? (event ? { type: eventTypeOf(event.kind).id, title: event.title, start: event.start, end: event.end, note: event.note } : null);
  const [type, setType] = useState<EventTypeId>(seed?.type ?? initialType);
  const [title, setTitle] = useState(seed?.title ?? "");
  const [oneDay, setOneDay] = useState(seed ? seed.start === seed.end : !!eventTypeOf(initialType).oneDay);
  const [touchedMode, setTouchedMode] = useState(!!seed);
  const [start, setStart] = useState(seed?.start ?? today);
  const [end, setEnd] = useState(seed ? seed.end : addDays(today, 6));
  const [note, setNote] = useState(seed?.note ?? "");
  const [titleFocus, setTitleFocus] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [sure, setSure] = useState(false);
  const t = eventTypeOf(type);
  const endOk = oneDay || (valid(end) && end >= start);
  const ok = title.trim().length > 0 && valid(start) && endOk;
  const dirty = title.trim() !== (seed?.title ?? "") || note.trim() !== (seed?.note ?? "");

  // ---- The type: its colour everywhere marked (type); Supplement opens on One day until the mode is touched.
  const pickType = (id: EventTypeId) => {
    setType(id);
    if (!touchedMode && eventTypeOf(id).oneDay) setOneDay(true);
  };
  const setMode = (one: boolean) => {
    setTouchedMode(true);
    if (one === oneDay) return;
    setOneDay(one);
    // Range → one day keeps the start; one day → range gives it a week.
    if (!one) setEnd(addDays(start, 6));
  };
  const moveStart = (v: string) => {
    setStart(v);
    if (valid(v) && valid(end) && end < v) setEnd(v);
  };

  const submit = () => {
    if (!ok || pending) return;
    onSubmit({ type, title: title.trim().slice(0, 60), start, end: oneDay ? start : end, note: note.trim().slice(0, 280) });
  };
  const close = () => {
    if (pending) return;
    if (dirty && !event) setDiscard(true);
    else onClose();
  };

  // ---- Focus: the title once the slide-in is done; back to the opener after.
  const sheet = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => titleRef.current?.focus(), 300);
    return () => {
      clearTimeout(t);
      opener.current?.focus?.();
    };
  }, []);

  // ---- Escape closes; Tab stays inside.
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(el.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled])")).filter((x) => x.offsetParent !== null || (x as HTMLInputElement).type === "date");
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // ---- The keyboard: the sheet lifts above it, and the field being typed in stays in view.
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setLift(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);
  const keepInView = (e: React.FocusEvent<HTMLElement>) => {
    const box = sheet.current;
    if (!box) return;
    const r = e.currentTarget.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.bottom > b.bottom - 16) box.scrollTop += r.bottom - (b.bottom - 16);
    else if (r.top < b.top + 16) box.scrollTop -= b.top + 16 - r.top;
  };

  // ---- Drag down past 120px lets go.
  const [drag, setDrag] = useState<{ y0: number; dy: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("textarea, input") || (sheet.current?.scrollTop ?? 0) > 0) return;
    setDrag({ y0: e.touches[0].clientY, dy: 0 });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dy: Math.max(0, e.touches[0].clientY - drag.y0) });
  };
  const onTouchEnd = () => {
    if (!drag) return;
    const let_go = drag.dy > 120;
    setDrag(null);
    if (let_go) close();
  };

  const style = { "--c": t.color, "--rgb": t.rgb, bottom: lift || undefined, transform: drag ? `translateY(${drag.dy}px)` : undefined } as React.CSSProperties;
  const label = event ? "Edit event" : "New event";

  return createPortal(
    <div className="ev-scrim" role="presentation" onClick={close}>
      <div
        ref={sheet}
        className={`evs${drag ? " dragging" : ""}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-event-title"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="evs-wash" aria-hidden="true" />
        <span className="evs-glow" aria-hidden="true" />
        <div className="evs-in">
          <span className="evs-grab" aria-hidden="true" />

          <div className="evs-head">
            <h2 id="new-event-title">{label}</h2>
            <span className="evs-pill">
              <TypeIcon path={t.icon} size={12} stroke={2.4} />
              {t.label}
            </span>
            <button type="button" className="evs-x" onClick={close} aria-label="Close" disabled={pending}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <TypePicker value={type} onPick={pickType} />

          <label className="evs-field">
            <span className="evs-label">What&rsquo;s happening</span>
            <span className={`evs-title${titleFocus || title ? " ring" : ""}`}>
              <TypeIcon path={t.icon} size={16} stroke={2.2} />
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={(e) => {
                  setTitleFocus(true);
                  keepInView(e);
                }}
                onBlur={() => setTitleFocus(false)}
                placeholder={t.placeholder}
                maxLength={60}
                required
                enterKeyHint="next"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </span>
          </label>

          <WhenSection oneDay={oneDay} start={start} end={end} today={today} onMode={setMode} onStart={moveStart} onEnd={setEnd} />

          <span className="evs-note">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} onFocus={keepInView} placeholder={`Anything ${coachName} should know? (optional)`} maxLength={280} aria-label="Note" />
            {note.length > 240 && <small>{note.length}/280</small>}
          </span>

          <SaveBar type={t} editing={!!event} ok={ok} pending={pending} error={error} coachName={coachName} coachPhoto={coach?.photoPath ?? null} onSave={submit} />

          {event && onDelete && (
            <button type="button" className={`evs-delete${sure ? " sure" : ""}`} onClick={() => (sure ? onDelete() : setSure(true))} disabled={pending}>
              {sure ? "Yes, delete it" : "Delete event"}
            </button>
          )}

          {discard && (
            <div className="evs-discard" role="alertdialog" aria-label="Discard this event?">
              <span>Discard this event?</span>
              <button type="button" className="evs-discard-yes" onClick={onClose}>
                Discard
              </button>
              <button type="button" className="evs-discard-no" onClick={() => setDiscard(false)}>
                Keep editing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- The picker: every tile in its own colour; the one picked filled solid.

function TypePicker({ value, onPick }: { value: EventTypeId; onPick: (id: EventTypeId) => void }) {
  return (
    <div className="evs-types" role="radiogroup" aria-label="Type">
      {EVENT_TYPES.map((x) => {
        const on = x.id === value;
        return (
          <button key={x.id} type="button" role="radio" aria-checked={on} className={`evs-type${on ? " on" : ""}`} style={{ "--tc": x.color, "--trgb": x.rgb } as React.CSSProperties} onClick={() => onPick(x.id)}>
            <span className="evs-type-disc">
              <TypeIcon path={x.icon} size={15} stroke={2.2} />
            </span>
            {x.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- When: navy, whatever the type. Starts → Ends, or one Date.

function WhenSection({ oneDay, start, end, today, onMode, onStart, onEnd }: { oneDay: boolean; start: string; end: string; today: string; onMode: (one: boolean) => void; onStart: (v: string) => void; onEnd: (v: string) => void }) {
  const field = (head: string, value: string, min: string | undefined, onChange: (v: string) => void, extra = "") => {
    const shown = fmt(value, today);
    return (
      <span className={`evs-date${shown ? "" : " empty"}${extra}`}>
        <span className="evs-date-head">{head}</span>
        <b>{shown ?? "Pick a date"}</b>
        <input type="date" value={value} min={min} onChange={(e) => onChange(e.target.value)} aria-label={`${head[0] + head.slice(1).toLowerCase()}, ${valid(value) ? longDay(value) : "not set"}`} />
      </span>
    );
  };
  return (
    <div className="evs-when">
      <div className="evs-when-head">
        <span className="evs-label">When</span>
        <div className="evs-seg" role="group" aria-label="A date range or one day">
          <button type="button" className={!oneDay ? "on" : ""} aria-pressed={!oneDay} onClick={() => onMode(false)}>
            Date range
          </button>
          <button type="button" className={oneDay ? "on" : ""} aria-pressed={oneDay} onClick={() => onMode(true)}>
            One day
          </button>
        </div>
      </div>
      <div className="evs-dates">
        {oneDay ? (
          field("DATE", start, undefined, onStart)
        ) : (
          <>
            {field("STARTS", start, undefined, onStart)}
            <span className="evs-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
            {field("ENDS", end, start, onEnd, " ends")}
          </>
        )}
      </div>
      <span className="evs-dur" aria-live="polite">
        {valid(start) && (oneDay || valid(end)) ? durationLabel(start, oneDay ? start : end < start ? start : end, today) : "Pick the dates"}
      </span>
    </div>
  );
}

// ---- Save: navy, whatever the type; the type's icon is the one cue.

function SaveBar({ type, editing, ok, pending, error, coachName, coachPhoto, onSave }: { type: ReturnType<typeof eventTypeOf>; editing: boolean; ok: boolean; pending: boolean; error: string | null; coachName: string; coachPhoto: string | null; onSave: () => void }) {
  return (
    <div className="evs-savebar">
      <button type="button" className="evs-save" onClick={onSave} aria-disabled={!ok || pending} disabled={!ok || pending}>
        {pending ? <span className="evs-spin" aria-hidden="true" /> : <TypeIcon path={type.icon} size={16} stroke={2.2} />}
        {pending ? (editing ? "Saving…" : "Adding…") : editing ? "Save changes" : `Add ${type.label.toLowerCase()} to your plan`}
      </button>
      {error && <p className="evs-error" role="alert">{error}</p>}
      <span className="evs-sub">
        <CoachAvatar name={coachName} photoPath={coachPhoto} size={18} ring="row" />
        {coachName} sees it on your plan straight away.
      </span>
    </div>
  );
}
