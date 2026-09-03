"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addCalendarEventAction, removeMeetingAction } from "../lib/actions";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";

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
const DURATIONS = [15, 30, 45, 60, 90, 120];
const SLOT_MIN = 15;
const SLOT_PX = 18; // one quarter-hour row

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

  // Quarter-hour grid. Each hour is four 15-minute slots; an entry is placed
  // at its start slot and spans ceil(duration / 15) slots, so a 30-minute
  // call takes two, a 90-minute block six. Clicking a slot adds something
  // at that quarter. Entries that overlap share the width side by side.
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const startMin = FIRST_HOUR * 60;
  const endMin = (LAST_HOUR + 1) * 60;
  const totalSlots = (endMin - startMin) / SLOT_MIN;

  const outside = meetings.filter((m) => !m.time || toMin(m.time) < startMin || toMin(m.time) >= endMin);
  const placed = meetings
    .filter((m) => m.time && toMin(m.time) >= startMin && toMin(m.time) < endMin)
    .map((m) => {
      const start = toMin(m.time);
      const slots = Math.max(1, Math.ceil(m.durationMinutes / SLOT_MIN));
      return { m, start, end: start + slots * SLOT_MIN, slots, col: 0, cols: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  // Greedy column packing within clusters of overlapping entries.
  let cluster: typeof placed = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    cluster.forEach((p) => (p.cols = cols));
    cluster = [];
  };
  const colEnds: number[] = [];
  placed.forEach((p) => {
    if (p.start >= clusterEnd) {
      flush();
      colEnds.length = 0;
    }
    let col = colEnds.findIndex((e) => e <= p.start);
    if (col === -1) col = colEnds.length;
    colEnds[col] = p.end;
    p.col = col;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.end);
  });
  flush();

  return (
    <div className="cd-timeline">
      {outside.length > 0 && (
        <div className="cd-outside">
          {outside.map((m) => (
            <Entry key={m.id} m={m} />
          ))}
        </div>
      )}

      <div className="cd-grid" style={{ height: totalSlots * SLOT_PX }}>
        {hours.map((h) => {
          const hh = String(h).padStart(2, "0");
          return (
            <div key={h} className="cd-hour-row" style={{ top: (h - FIRST_HOUR) * 4 * SLOT_PX, height: 4 * SLOT_PX }}>
              <span className="cd-hour-label">{hourLabel(h)}</span>
              <div className="cd-quarters">
                {[0, 15, 30, 45].map((q) => {
                  const mm = String(q).padStart(2, "0");
                  return (
                    <button
                      key={q}
                      type="button"
                      className={`cd-quarter${q === 0 ? " first" : ""}`}
                      onClick={() => setAddAt(`${hh}:${mm}`)}
                      aria-label={`Add something at ${hh}:${mm}`}
                      title={`Add something at ${hh}:${mm}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="cd-events">
          {placed.map((p) => {
            const width = 100 / p.cols;
            return (
              <div
                key={p.m.id}
                className="cd-event"
                style={{
                  top: ((p.start - startMin) / SLOT_MIN) * SLOT_PX,
                  height: p.slots * SLOT_PX,
                  left: `${p.col * width}%`,
                  width: `${width}%`,
                }}
              >
                <Entry m={p.m} compact={p.slots < 2} />
              </div>
            );
          })}
        </div>
      </div>

      {addAt &&
        createPortal(
          <AddDialog date={date} month={month} time={addAt} clients={clients} onClose={() => setAddAt(null)} />,
          document.body
        )}
    </div>
  );
}

function Entry({ m, compact = false }: { m: DayEntry; compact?: boolean }) {
  // A one-slot (15 min) entry has room for a single line; longer ones get
  // the time and length stacked beside the name and topic.
  const body = compact ? (
    <span className="cd-entry-line" title={`${m.time} · ${m.durationMinutes} min · ${m.clientName}${m.topic ? ` · ${m.topic}` : ""}`}>
      <strong>{m.time}</strong> {m.clientName}
      {m.topic ? ` · ${m.topic}` : ""}
    </span>
  ) : (
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
  const cls = `cd-entry${compact ? " compact" : ""}${m.clientId == null ? " own" : ""}${m.status === "completed" ? " done" : ""}`;
  // A client meeting links to that client's Meetings tab; the coach's own
  // block has nowhere else to go. Either can be deleted from here, behind
  // the shared confirm.
  return (
    <div className="cd-entry-wrap">
      {m.clientId != null ? (
        <Link href={`/admin?client=${m.clientId}&tab=meetings`} className={cls}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
      <span className="cd-entry-delete">
        <ConfirmDeleteButton
          action={removeMeetingAction}
          hiddenFields={{ id: m.id }}
          label={`Delete ${m.topic || (m.clientId != null ? `the meeting with ${m.clientName}` : "this block")}`}
          description={`${m.time || ""} · ${m.clientName}${m.topic ? ` · ${m.topic}` : ""}`}
        />
      </span>
    </div>
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
