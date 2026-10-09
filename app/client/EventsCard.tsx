"use client";

import { useState, useTransition } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { clientAddEventAction, clientDeleteEventAction, clientUpdateEventAction } from "../lib/actions";
import { NO_CATEGORY, paletteOf } from "../admin/redesign/palette";
import { useOpenEvents } from "./CheckInContext";
import { eventTypeOf } from "../lib/eventTypes";
import { TypeIcon } from "./events/AddEventSheet";

// Home's "Events" card (7 Oct): what is coming up in the client's life that
// the plan should know about: a trip, an injury, the day they started a
// supplement. The coach adds these on the Plan tab's Events grid; here the
// client adds their own, and they land on that same grid at once (and in the
// coach's activity). The client can change or remove only what they added;
// the coach's events are listed read-only, so both see the same calendar.

export type HomeEvent = { id: number; kind: string | null; title: string; start: string; end: string; note: string; /** The client added it. */ mine: boolean };
export type HomeEventCategory = { id: string; label: string; color: string };
export type HomeEvents = { list: HomeEvent[]; categories: HomeEventCategory[] };

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
export const shortDate = (d: string) => parse(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const relative = (today: string, d: string) => {
  const n = daysBetween(today, d);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
};
export const standing = (today: string, e: HomeEvent) => {
  if (e.start === e.end || today < e.start) return relative(today, e.start);
  if (today > e.end) return `ended ${relative(today, e.end)}`;
  const left = daysBetween(today, e.end);
  return left === 0 ? "last day" : `${left} day${left === 1 ? "" : "s"} left`;
};
export const chromeOf = (cats: HomeEventCategory[], kind: string | null) => {
  const c = kind ? cats.find((x) => x.id === kind) : null;
  return c ? { ...paletteOf(c.color), label: c.label } : { ...NO_CATEGORY, label: "Event" };
};

export default function EventsCard({ events, today }: { events: HomeEvents; coachName?: string; today: string }) {
  const openEvents = useOpenEvents();
  // A glance (9 Oct): the event running now, if any, with the next one to
  // come under it; else just the next one to come. The whole list, with Add,
  // Change and Remove, is the Events screen (8 Oct).
  const coming = events.list.filter((e) => e.end >= today).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id));
  const running = coming.find((e) => e.start <= today) ?? null;
  const next = coming.find((e) => e.start > today) ?? null;
  // Rows in the type's colour, as the Events screen draws them (9 Oct): the
  // type's icon for a dot, a chevron where there is a note to read there.
  const vars = (e: HomeEvent) => {
    const t = eventTypeOf(e.kind);
    return { t, style: { "--c": t.color, "--rgb": t.rgb } as React.CSSProperties };
  };
  return (
    <section className="hm-ev" aria-label="Events">
      <button type="button" className="hm-ev-open" onClick={() => openEvents?.()} aria-label="Events: open your events">
        <span className="hm-ev-head">
          <span className="hm-eyebrow">Events</span>
          <span className="hm-ev-chev" aria-hidden="true">›</span>
        </span>
        {(running || next) && (
          <span className="hm-ev-list">
            {running &&
              (() => {
                // In it now: the row on the type's tint with its aura, a "Now" chip, the title, and until when.
                const { t, style } = vars(running);
                return (
                  <span className="hm-ev-row on" style={style}>
                    <i className="hm-ev-now">
                      <TypeIcon path={t.icon} fill={t.fill} size={11} stroke={2.4} />
                      Now
                    </i>
                    <span className="hm-ev-title">{running.title}</span>
                    <span className="hm-ev-when">{running.start === running.end ? "today" : `until ${shortDate(running.end)}`}</span>
                    {running.note && <span className="hm-ev-more" aria-hidden="true">›</span>}
                  </span>
                );
              })()}
            {next &&
              (() => {
                // The one after: "Next up", the title, and when.
                const { t, style } = vars(next);
                return (
                  <span className="hm-ev-row next" style={style}>
                    <i className="hm-ev-ico">
                      <TypeIcon path={t.icon} fill={t.fill} size={13} stroke={2.2} />
                    </i>
                    <span className="hm-ev-next-text">
                      <span className="hm-ev-tag">Next up</span>
                      <span className="hm-ev-next-line">
                        <span className="hm-ev-title">{next.title}</span>
                        <span className="hm-ev-when">{next.start === next.end ? shortDate(next.start) : `${shortDate(next.start)} – ${shortDate(next.end)}`}</span>
                      </span>
                    </span>
                    {next.note && <span className="hm-ev-more" aria-hidden="true">›</span>}
                  </span>
                );
              })()}
          </span>
        )}
        {!running && !next && <span className="hm-ev-empty">Nothing logged yet.</span>}
      </button>
    </section>
  );
}

// ---- The sheet: which kind, what, when (one day or a stretch), and a note for the coach.

export function EventSheet({ clientId, event, categories, coachName, today, onClose, onSaved }: { clientId: number; event: HomeEvent | null; categories: HomeEventCategory[]; coachName: string; today: string; onClose: () => void; /** What was just saved, for the chat to say so (7 Oct). */ onSaved?: (v: { kind: string | null; title: string; start: string; end: string; note: string }) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<string | null>(event?.kind ?? null);
  const [title, setTitle] = useState(event?.title ?? "");
  const [period, setPeriod] = useState(!!event && event.start !== event.end);
  const [from, setFrom] = useState(event?.start ?? today);
  const [to, setTo] = useState(event?.end ?? today);
  const [note, setNote] = useState(event?.note ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const end = period ? (to < from ? from : to) : from;
  const ok = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(from) && (!period || /^\d{4}-\d{2}-\d{2}$/.test(to));
  const placeholder = kind === "trip" ? "Japan with friends" : kind === "health" ? "Sprained my ankle" : kind === "family" ? "Wedding in Groningen" : kind === "work" ? "Night shifts all week" : "Started creatine, 5 g a day";
  const save = () =>
    start(async () => {
      const v = { kind, title: title.trim(), start: from, end, note: note.trim() };
      if (event) await clientUpdateEventAction(clientId, event.id, v);
      else await clientAddEventAction(clientId, v);
      onSaved?.(v);
      router.refresh();
      onClose();
    });
  const remove = () =>
    start(async () => {
      await clientDeleteEventAction(clientId, event!.id);
      router.refresh();
      onClose();
    });
  return createPortal(
    <div className="vr-sheet-scrim" role="presentation" onClick={() => !pending && onClose()}>
      <div className="pp-app-sheet hm-ev-sheet" role="dialog" aria-modal="true" aria-label={event ? "Change the event" : "Tell your coach"} onClick={(e) => e.stopPropagation()}>
        <div className="pp-app-sheet-head">
          <span className="pp-app-sheet-title">{event ? "Change the event" : `Tell ${coachName}`}</span>
          <span className="pp-app-sheet-sub">It goes on your plan, where {coachName} sees it.</span>
        </div>

        <div className="hm-ev-kinds" role="group" aria-label="What kind">
          {categories.map((c) => {
            const p = paletteOf(c.color);
            const on = kind === c.id;
            return (
              <button key={c.id} type="button" className={`hm-ev-kind${on ? " on" : ""}`} style={on ? { background: p.ink, borderColor: p.ink, color: "#fff" } : { color: p.ink }} aria-pressed={on} onClick={() => setKind(on ? null : c.id)}>
                <i style={{ background: on ? "#fff" : p.ink }} />
                {c.label}
              </button>
            );
          })}
        </div>

        <label className="hm-ev-field">
          <span>What</span>
          <input className="st-details-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} maxLength={80} autoFocus={!event} />
        </label>

        <div className="hm-ev-shape" role="group" aria-label="One day or a period">
          <button type="button" className={!period ? "on" : ""} aria-pressed={!period} onClick={() => setPeriod(false)}>
            One day
          </button>
          <button type="button" className={period ? "on" : ""} aria-pressed={period} onClick={() => setPeriod(true)}>
            A period
          </button>
        </div>
        <div className="hm-ev-dates">
          <label className="hm-ev-field">
            <span>{period ? "From" : "When"}</span>
            <input className="st-details-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          {period && (
            <label className="hm-ev-field">
              <span>To</span>
              <input className="st-details-input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
          )}
        </div>

        <label className="hm-ev-field">
          <span>Anything {coachName} should know</span>
          <textarea className="st-details-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={500} />
        </label>

        <button type="button" className="hm-ev-save" onClick={save} disabled={!ok || pending}>
          {pending ? "Saving…" : event ? "Save" : `Send to ${coachName}`}
        </button>
        {event &&
          (confirmRemove ? (
            <button type="button" className="hm-ev-remove sure" onClick={remove} disabled={pending}>
              Yes, remove it
            </button>
          ) : (
            <button type="button" className="hm-ev-remove" onClick={() => setConfirmRemove(true)} disabled={pending}>
              Remove
            </button>
          ))}
        <button type="button" className="pp-app-sheet-cancel" onClick={onClose} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}
