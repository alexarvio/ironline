"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addCalendarEventAction } from "../lib/actions";

export type DayEntry = {
  id: number;
  time: string;
  durationMinutes: number;
  topic: string;
  clientId: number | null;
  clientName: string;
  status: "scheduled" | "completed" | "canceled";
};

const FIRST_HOUR = 6;
const LAST_HOUR = 21;
const DURATIONS = [15, 30, 45, 60, 90];

function hourLabel(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

// Hour rows from 6 AM to 9 PM. An entry appears in the row of its start
// hour; the rest of the row is a button that opens the add dialog with that
// hour filled in. Entries outside the range are listed above the grid so
// nothing is hidden.
export default function DayTimeline({
  date,
  month,
  meetings,
  clients,
}: {
  date: string;
  month?: string;
  meetings: DayEntry[];
  clients: { id: number; name: string }[];
}) {
  // The dialog only exists after a click, so it never renders on the server
  // and the portal needs no mounted guard.
  const [addAt, setAddAt] = useState<string | null>(null);

  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const hourOf = (t: string) => Number(t.split(":")[0]);
  const outside = meetings.filter((m) => !m.time || hourOf(m.time) < FIRST_HOUR || hourOf(m.time) > LAST_HOUR);

  return (
    <div className="cd-timeline">
      {outside.length > 0 && (
        <div className="cd-outside">
          {outside.map((m) => (
            <Entry key={m.id} m={m} />
          ))}
        </div>
      )}

      {hours.map((h) => {
        const inHour = meetings.filter((m) => m.time && hourOf(m.time) === h);
        const hh = String(h).padStart(2, "0");
        return (
          <div key={h} className="cd-hour">
            <span className="cd-hour-label">{hourLabel(h)}</span>
            <div className="cd-hour-body">
              {inHour.map((m) => (
                <Entry key={m.id} m={m} />
              ))}
              <button
                type="button"
                className="cd-hour-add"
                onClick={() => setAddAt(`${hh}:00`)}
                aria-label={`Add something at ${hourLabel(h)}`}
                title={`Add something at ${hourLabel(h)}`}
              >
                +
              </button>
            </div>
          </div>
        );
      })}

      {addAt &&
        createPortal(
          <AddDialog date={date} month={month} time={addAt} clients={clients} onClose={() => setAddAt(null)} />,
          document.body
        )}
    </div>
  );
}

function Entry({ m }: { m: DayEntry }) {
  const body = (
    <>
      <span className="cd-entry-time">
        {m.time || "–"}
        <em>{m.durationMinutes} min</em>
      </span>
      <span className="cd-entry-text">
        <span className="cd-entry-who">{m.clientName}</span>
        {m.topic && <span className="cd-entry-topic">{m.topic}</span>}
      </span>
    </>
  );
  const cls = `cd-entry${m.clientId == null ? " own" : ""}${m.status === "completed" ? " done" : ""}`;
  // A client meeting links to that client's Meetings tab; the coach's own
  // block has nowhere else to go.
  return m.clientId != null ? (
    <Link href={`/admin?client=${m.clientId}&tab=meetings`} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function AddDialog({
  date,
  month,
  time,
  clients,
  onClose,
}: {
  date: string;
  month?: string;
  time: string;
  clients: { id: number; name: string }[];
  onClose: () => void;
}) {
  const topicRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    topicRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pretty = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label="Add to the calendar">
        <h2 className="pb-confirm-title">Add to {pretty}</h2>
        <form action={addCalendarEventAction} className="cd-form">
          <input type="hidden" name="date" value={date} />
          {month && <input type="hidden" name="month" value={month} />}
          <label className="plan-schedule-field">
            <span>What</span>
            <input ref={topicRef} name="topic" type="text" placeholder="Check-in call, gym session, admin…" />
          </label>
          <div className="cd-form-row">
            <label className="plan-schedule-field">
              <span>Time</span>
              <input name="time" type="time" defaultValue={time} required />
            </label>
            <label className="plan-schedule-field">
              <span>Length</span>
              <select name="durationMinutes" defaultValue="60">
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="plan-schedule-field">
            <span>With</span>
            <select name="clientId" defaultValue="">
              <option value="">Just you (no client)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
    </div>
  );
}
