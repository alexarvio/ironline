"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { EVENT_TYPES, eventTypeOf, type EventTypeId } from "../../lib/eventTypes";
import type { HomeEvent } from "../EventsCard";

// The add sheet (9 Oct): which type, what, when (a range or one day), a
// note, and "Add to your plan". Slides up over the Events screen; a drag
// down, the scrim, the X or Escape closes it. The same sheet changes an
// event of the client's own.

export type EventValues = { type: EventTypeId; title: string; start: string; end: string; note: string };

export function TypeIcon({ path, size = 14, stroke = 2 }: { path: string; size?: number; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

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
}) {
  const seed: EventValues | null = initial ?? (event ? { type: eventTypeOf(event.kind).id, title: event.title, start: event.start, end: event.end, note: event.note } : null);
  const [type, setType] = useState<EventTypeId>(seed?.type ?? initialType);
  const [title, setTitle] = useState(seed?.title ?? "");
  const [oneDay, setOneDay] = useState(seed ? seed.start === seed.end : !!eventTypeOf(initialType).oneDay);
  const [start, setStart] = useState(seed?.start ?? today);
  const [end, setEnd] = useState(seed?.end ?? today);
  const [note, setNote] = useState(seed?.note ?? "");
  const t = eventTypeOf(type);
  const ok = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(start) && (oneDay || /^\d{4}-\d{2}-\d{2}$/.test(end));

  // A type picked fresh (not a change) brings its default shape: supplements are a start marker.
  const pickType = (id: EventTypeId) => {
    setType(id);
    if (!event && !initial && !title.trim()) setOneDay(!!eventTypeOf(id).oneDay);
  };

  const submit = () => {
    if (!ok || pending) return;
    const e = oneDay ? start : end < start ? start : end;
    onSubmit({ type, title: title.trim().slice(0, 60), start, end: e, note: note.trim().slice(0, 280) });
  };

  // ---- Escape closes; Tab stays inside.
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>("input, textarea, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!pending) onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(el.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
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
  }, [onClose, pending]);

  // ---- Drag down to dismiss: the sheet follows the finger, lets go past 80px.
  const [drag, setDrag] = useState<{ y0: number; dy: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("textarea, input, select")) return;
    setDrag({ y0: e.touches[0].clientY, dy: 0 });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.y0);
    setDrag({ ...drag, dy });
  };
  const onTouchEnd = () => {
    if (!drag) return;
    const close = drag.dy > 80;
    setDrag(null);
    if (close && !pending) onClose();
  };

  return createPortal(
    <div className="ev-scrim" role="presentation" onClick={() => !pending && onClose()}>
      <div
        ref={sheet}
        className={`ev-sheet${drag ? " dragging" : ""}`}
        style={drag ? { transform: `translateY(${drag.dy}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ev-sheet-title"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="ev-grab" aria-hidden="true" />
        <div className="ev-sheet-head">
          <h2 id="ev-sheet-title">{event ? "Change the event" : "New event"}</h2>
          <button type="button" className="ev-x" onClick={onClose} aria-label="Close" disabled={pending}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="ev-types" role="radiogroup" aria-label="What kind of event">
          {EVENT_TYPES.map((x) => {
            const on = x.id === type;
            return (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`ev-type${on ? " on" : ""}`}
                style={on ? ({ "--c": x.color, "--rgb": x.rgb } as React.CSSProperties) : undefined}
                onClick={() => pickType(x.id)}
              >
                <TypeIcon path={x.icon} size={18} />
                {x.label}
              </button>
            );
          })}
        </div>

        <label className="ev-field">
          <span>What&rsquo;s happening</span>
          <input className="ev-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.placeholder} maxLength={60} required onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>

        <div className="ev-when">
          <div className="ev-when-row">
            <span className="ev-label">When</span>
            <div className="ev-seg" role="group" aria-label="A date range or one day">
              <button type="button" className={!oneDay ? "on" : ""} aria-pressed={!oneDay} onClick={() => setOneDay(false)}>
                Date range
              </button>
              <button type="button" className={oneDay ? "on" : ""} aria-pressed={oneDay} onClick={() => setOneDay(true)}>
                One day
              </button>
            </div>
          </div>
          <div className="ev-dates">
            <label className={`ev-date${start ? "" : " empty"}`}>
              <span>{oneDay ? "Date" : "Starts"}</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              <b>{start ? fmt(start) : "Pick a date"}</b>
            </label>
            {!oneDay && (
              <label className={`ev-date${end ? "" : " empty"}`}>
                <span>Ends</span>
                <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
                <b>{end ? fmt(end) : "Pick a date"}</b>
              </label>
            )}
          </div>
        </div>

        <textarea className="ev-note-in" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Anything ${coachName} should know? (optional)`} maxLength={280} aria-label="Note" />

        {error && <p className="ev-error" role="alert">{error}</p>}
        <button type="button" className="ev-save" onClick={submit} disabled={!ok || pending}>
          {pending ? "Saving…" : event ? "Save changes" : "Add to your plan"}
        </button>
        <small className="ev-save-sub">{coachName} sees it on your plan straight away.</small>
      </div>
    </div>,
    document.body
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Pick a date";
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
