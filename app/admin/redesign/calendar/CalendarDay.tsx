"use client";

import { useState } from "react";
import { Dialog } from "../../../components/ui/dialog";
import { ChevronDownIcon } from "../../../components/icons";
import { entryColors, type Category } from "../palette";
import EntryDialog, { type EntryClient, type Open } from "./EntryDialog";

// The Calendar's chosen day, hour by hour, and the dialog that adds to it or
// changes an entry. Every entry is a pill in its category's colour, on one
// line when it is short; one with a note has a chevron that opens the note
// under it. All-day entries sit above the hours. A click on a quarter hour
// adds something there; a click on a pill opens it.

export type CalEntry = {
  id: number;
  time: string;
  durationMinutes: number;
  allDay: boolean;
  topic: string;
  clientId: number | null;
  clientName: string;
  status: "scheduled" | "completed" | "no-show" | "cancelled";
  category: string | null;
  note: string;
  conflict: boolean;
};

const FIRST_HOUR = 6;
const LAST_HOUR = 21;
const SLOT_MIN = 15;
const SLOT_PX = 20; // one quarter-hour row

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const lengthLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);


export default function CalendarDay({ date, entries, categories, clients }: { date: string; entries: CalEntry[]; categories: Category[]; clients: EntryClient[] }) {
  const [dlg, setDlg] = useState<Open | null>(null);

  const startMin = FIRST_HOUR * 60;
  const endMin = (LAST_HOUR + 1) * 60;
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const allDay = entries.filter((e) => e.allDay);
  const timed = entries.filter((e) => !e.allDay);
  // Anything before 6 AM or after 9 PM is listed with the all-day ones, so nothing is hidden.
  const outside = timed.filter((e) => !e.time || toMin(e.time) < startMin || toMin(e.time) >= endMin);
  const placed = timed
    .filter((e) => e.time && toMin(e.time) >= startMin && toMin(e.time) < endMin)
    .map((e) => {
      const start = toMin(e.time);
      const slots = Math.max(1, Math.ceil(e.durationMinutes / SLOT_MIN));
      return { e, start, end: start + slots * SLOT_MIN, slots, col: 0, cols: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  // Entries that overlap share the width, side by side (greedy columns per cluster).
  let cluster: typeof placed = [];
  let clusterEnd = -1;
  const colEnds: number[] = [];
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    cluster.forEach((p) => (p.cols = cols));
    cluster = [];
  };
  placed.forEach((p) => {
    if (p.start >= clusterEnd) {
      flush();
      colEnds.length = 0;
    }
    let col = colEnds.findIndex((end) => end <= p.start);
    if (col === -1) col = colEnds.length;
    colEnds[col] = p.end;
    p.col = col;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.end);
  });
  flush();

  const top = [...allDay, ...outside];

  return (
    <div className="cdg">
      <div className="cdg-allday">
        <span className="cdg-allday-label">All day</span>
        <div className="cdg-allday-list">
          {top.map((e) => (
            <Pill key={e.id} e={e} cats={categories} slots={2} onOpen={() => setDlg({ entry: e, date, time: e.time || "09:00" })} />
          ))}
        </div>
      </div>

      <div className="cdg-grid" style={{ height: ((endMin - startMin) / SLOT_MIN) * SLOT_PX }}>
        {hours.map((h) => (
          <div key={h} className="cdg-hour" style={{ top: (h - FIRST_HOUR) * 4 * SLOT_PX, height: 4 * SLOT_PX }}>
            <span className="cdg-hour-label">{hourLabel(h)}</span>
            <div className="cdg-quarters">
              {[0, 15, 30, 45].map((q) => {
                const t = hhmm(h * 60 + q);
                return <button key={q} type="button" className={`cdg-quarter${q === 0 ? " first" : ""}`} onClick={() => setDlg({ entry: null, date, time: t })} aria-label={`Add something at ${t}`} title={`Add at ${t}`} />;
              })}
            </div>
          </div>
        ))}
        <div className="cdg-events">
          {placed.map((p) => {
            const width = 100 / p.cols;
            return (
              <div key={p.e.id} className="cdg-slot" style={{ top: ((p.start - startMin) / SLOT_MIN) * SLOT_PX, minHeight: p.slots * SLOT_PX, left: `${p.col * width}%`, width: `${width}%` }}>
                <Pill e={p.e} cats={categories} slots={p.slots} height={p.slots * SLOT_PX} onOpen={() => setDlg({ entry: p.e, date, time: p.e.time })} />
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        {dlg && <EntryDialog key={`${dlg.entry?.id ?? "new"}:${dlg.time}`} open={dlg} cats={categories} clients={clients} dayEntries={entries} onDone={() => setDlg(null)} />}
      </Dialog>
    </div>
  );
}

// ---- One entry on the day: its colour, the time and who, on one line when short.
function Pill({ e, cats, slots, height, onOpen }: { e: CalEntry; cats: Category[]; slots: number; height?: number; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const c = entryColors(cats, e.category, e.clientId != null);
  const who = e.clientId != null ? e.clientName : null;
  const title = who ?? (e.topic || "Busy");
  const sub = who ? e.topic : "";
  const when = e.allDay ? "" : e.time ? `${e.time}` : "–";
  const tall = slots >= 3;
  const end = e.time && !e.allDay ? hhmm(toMin(e.time) + e.durationMinutes) : "";
  return (
    <div
      className={`cdg-pill${tall ? " tall" : ""}${slots === 1 ? " tiny" : ""}${open ? " open" : ""}${e.conflict ? " conflict" : ""}${e.status === "completed" ? " done" : ""}`}
      style={{ background: c.tint, color: c.ink, borderColor: e.conflict ? "#e5b39a" : c.line, ...(height && !open ? { height } : { minHeight: height }) }}
    >
      <button type="button" className="cdg-pill-main" onClick={onOpen} title={[when, title, sub, e.allDay ? "All day" : lengthLabel(e.durationMinutes)].filter(Boolean).join(" · ")}>
        <span className="cdg-pill-line">
          {when && <b className="cdg-pill-time">{when}</b>}
          <span className="cdg-pill-title">{title}</span>
          {!tall && sub && <span className="cdg-pill-sub">· {sub}</span>}
          {!tall && !e.allDay && <small>{lengthLabel(e.durationMinutes)}</small>}
        </span>
        {tall && (
          <span className="cdg-pill-line second">
            {sub && <span className="cdg-pill-sub">{sub}</span>}
            <small>
              {e.time} – {end}
            </small>
          </span>
        )}
      </button>
      {e.note && (
        <button type="button" className="cdg-pill-chev" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Hide the note" : "Show the note"}>
          <ChevronDownIcon />
        </button>
      )}
      {open && e.note && <p className="cdg-pill-note">{e.note}</p>}
    </div>
  );
}

