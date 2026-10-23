"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { addCalendarEntryAction, updateCalendarEntryAction } from "../lib/actions";
import { TRAINING_ICON } from "../lib/eventTypes";
import { takesClient } from "../lib/calendarKinds";
import { dayMonth } from "../lib/dayMonth";
import { MonthRange } from "../admin/redesign/MonthRange";
import { paletteOf, type Category } from "../admin/redesign/palette";
import type { PhoneEntry } from "./calendar";
import { Avatar, Icon, Sheet } from "./parts";

// The Calendar's entry on the phone, added or changed (22 Oct): the laptop's
// entry pop-up (calendar/EntryDialog.tsx) for a thumb, written with the same
// actions, so it is on the laptop the moment it is saved. The same fields in
// the same order: the category as tiles, What, With, the day, timed or all
// day, the start and the end, the length, a note. The day, the times and the
// client are each picked on a page of the sheet of their own (the month is
// MonthRange, the admin's one calendar), so the sheet itself stays short.
// The sheet's voice (design rules 1): white, titles at 600, small grey
// uppercase labels, fields white with a hairline (ink while typing), the
// chosen choice ink, the category's colour on its icon, one ink pill.
// With is only for a Client call or Training (23 Oct, Alex; calendarKinds.ts):
// on any other category the row keeps its room unseen, and no client is saved.

/** A preset category's icon, its placeholder and its usual length, as the laptop's pop-up has them. A coach's own category wears the tag. */
export const ENTRY_PRESET: Record<string, { icon: string; placeholder: string; length: number }> = {
  call: { icon: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5", placeholder: "Week 1 check-in", length: 30 },
  training: { icon: TRAINING_ICON, placeholder: "Session with Mattia", length: 60 },
  admin: { icon: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4", placeholder: "Write programmes", length: 60 },
  personal: { icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", placeholder: "Gym, lunch, school run", length: 60 },
  content: { icon: "M4 8h3.5l2-3h5l2 3H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", placeholder: "Film the week's reels", length: 60 },
  other: { icon: "M5 12h.01M12 12h.01M19 12h.01", placeholder: "What is it?", length: 60 },
};
const TAG_ICON = "M20 12l-8 8-9-9V4h7l10 8zM7.5 7.5h.01";
export const entryIcon = (category: string | null | undefined) => (category && ENTRY_PRESET[category]?.icon) || TAG_ICON;
const LENGTHS = [15, 30, 45, 60];
// The laptop's key: the last category picked comes back first.
const LAST_CAT_KEY = "norcoach:cal-last-category";

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const lengthLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** "Thu 22/10": the weekday before the day/month numerals (design rules 7). */
export const shortDay = (d: string) => `${new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" })} ${dayMonth(d)}`;
const QUARTERS = Array.from({ length: 96 }, (_, i) => hhmm(i * 15));
function browserZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function CatIcon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg className="cph-ico" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export type EntryOpen = { entry: PhoneEntry | null; date: string; time: string };
type Client = { id: number; name: string; avatarPath: string | null };
type Page = "form" | "with" | "date" | "start" | "end";

export default function EntrySheet({
  open,
  categories,
  clients,
  dayEntries,
  onClose,
  onSaved,
}: {
  open: EntryOpen;
  categories: Category[];
  clients: Client[];
  /** What else is on the day it opened on, for the overlap line. */
  dayEntries: PhoneEntry[];
  onClose: () => void;
  /** Saved: the day it is on now, and the day it was on. */
  onSaved: (date: string, was: string) => void;
}) {
  const e = open.entry;
  const [cat, setCat] = useState<string>(() => {
    if (e?.category) return e.category;
    // An entry with none keeps the colour it wears: a client's call blue, the coach's own grey.
    if (e) return e.clientId != null ? "call" : "other";
    try {
      const last = window.localStorage.getItem(LAST_CAT_KEY);
      if (last && categories.some((c) => c.id === last)) return last;
    } catch {}
    return "call";
  });
  const [topic, setTopic] = useState(e?.topic ?? "");
  const [date, setDate] = useState(open.date);
  const [allDay, setAllDay] = useState(e?.allDay ?? false);
  const [time, setTime] = useState(e?.time || open.time || "09:00");
  const [length, setLength] = useState<number>(e?.durationMinutes ?? ENTRY_PRESET[cat]?.length ?? 60);
  const [customLength, setCustomLength] = useState(e ? !LENGTHS.includes(e.durationMinutes) : false);
  const [clientId, setClientId] = useState<number | null>(e?.clientId ?? null);
  const [note, setNote] = useState(e?.note ?? "");
  const [page, setPage] = useState<Page>("form");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(() => isoOf(new Date()));
  const [cursor, setCursor] = useState(open.date.slice(0, 7));

  const current = categories.find((c) => c.id === cat) ?? categories[0];
  // Only a Client call or Training is with a client.
  const withClient = takesClient(cat);
  const client = withClient && clientId != null ? clients.find((c) => c.id === clientId) ?? null : null;
  const first = (name: string) => name.split(" ")[0];
  const endMin = toMin(time) + length;
  const ok = !!date && (allDay || !!time);
  // A client picked with no title yet: the laptop's suggestion, kept when nothing is typed.
  const suggested = client && !topic.trim() ? `${current?.label ?? "Call"} · ${first(client.name)}` : null;
  const title = topic.trim() || suggested || "";

  // Overlaps with the day's other entries, as a warning only (the laptop's line).
  const overlap = useMemo(() => {
    if (allDay || date !== open.date) return null;
    const s = toMin(time);
    const hit = dayEntries.find((x) => !x.allDay && x.id !== e?.id && x.time && toMin(x.time) < s + length && toMin(x.time) + x.durationMinutes > s);
    return hit ? `Overlaps “${hit.topic || hit.clientName || "an entry"}” ${hit.time}–${hhmm(toMin(hit.time) + hit.durationMinutes)}` : null;
  }, [allDay, date, open.date, time, length, dayEntries, e?.id]);

  const pickCat = (id: string) => {
    setCat(id);
    // The client picked stays in hand (a tile tapped by mistake and back loses nothing); save sends it only with With.
    if (!e && !customLength) setLength(ENTRY_PRESET[id]?.length ?? 60);
    try {
      window.localStorage.setItem(LAST_CAT_KEY, id);
    } catch {}
  };
  const save = async () => {
    if (!ok || !title || saving) return;
    setSaving(true);
    setError(null);
    // The time is in this phone's timezone, as every time on the Calendar reads.
    const v = { date, time: allDay ? "" : time, tz: allDay ? null : browserZone(), durationMinutes: length, allDay, topic: title, clientId: withClient ? clientId : null, category: cat, note: note.trim() };
    try {
      if (e) await updateCalendarEntryAction(e.id, v);
      else if ((await addCalendarEntryAction(v)) == null) throw new Error("not saved");
      onSaved(date, open.date);
    } catch {
      setError("Not saved. Try again.");
      setSaving(false);
    }
  };

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return clients.filter((c) => !n || c.name.toLowerCase().includes(n));
  }, [clients, q]);

  // A list of times opens on the one picked, in the middle.
  const pickedTime = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (page === "start" || page === "end") pickedTime.current?.scrollIntoView({ block: "center" });
  }, [page]);

  const back = (
    <button type="button" className="cph-icon-btn" onClick={() => setPage("form")} aria-label="Back">
      <Icon name="back" />
    </button>
  );

  if (page === "with" && withClient)
    return (
      <Sheet onClose={onClose} label="With" className="tall">
        <div className="cph-ent-sub">
          {back}
          <h2>With</h2>
        </div>
        <label className="cph-search">
          <Icon name="search" />
          <input type="search" value={q} onChange={(x) => setQ(x.target.value)} placeholder="Search clients" aria-label="Search clients" enterKeyHint="search" />
        </label>
        <div className="cph-ent-scroll" role="listbox" aria-label="Clients">
          <button type="button" role="option" aria-selected={clientId == null} className="cph-ent-who" onClick={() => (setClientId(null), setPage("form"))}>
            <span className="cph-av cph-ent-none" style={{ width: 32, height: 32 }} aria-hidden="true">
              –
            </span>
            <b>Just you</b>
            {clientId == null && <Icon name="check" small />}
          </button>
          {shown.map((c) => (
            <button key={c.id} type="button" role="option" aria-selected={c.id === clientId} className="cph-ent-who" onClick={() => (setClientId(c.id), setQ(""), setPage("form"))}>
              <Avatar name={c.name} src={c.avatarPath} size={32} />
              <b>{c.name}</b>
              {c.id === clientId && <Icon name="check" small />}
            </button>
          ))}
          {shown.length === 0 && <p className="cph-empty">No match</p>}
        </div>
      </Sheet>
    );

  if (page === "date")
    return (
      <Sheet onClose={onClose} label="Date">
        <div className="cph-ent-sub">
          {back}
          <h2>Date</h2>
        </div>
        <div className="cph-ent-month">
          <MonthRange
            from={date}
            to={date}
            onPick={(d) => {
              setDate(d);
              setCursor(d.slice(0, 7));
              setPage("form");
            }}
            planned={[]}
            cursor={cursor}
            setCursor={setCursor}
            today={today}
            plain
            legend={null}
          />
        </div>
      </Sheet>
    );

  if (page === "start" || page === "end") {
    const isEnd = page === "end";
    const list = isEnd ? QUARTERS.filter((t) => toMin(t) > toMin(time)) : QUARTERS;
    const on = isEnd ? hhmm(endMin) : time;
    return (
      <Sheet onClose={onClose} label={isEnd ? "Ends" : "Starts"} className="tall">
        <div className="cph-ent-sub">
          {back}
          <h2>{isEnd ? "Ends" : "Starts"}</h2>
        </div>
        <div className="cph-ent-scroll cph-ent-times">
          {list.map((t) => (
            <button
              key={t}
              ref={t === on ? pickedTime : undefined}
              type="button"
              className={`cph-ent-time${t === on ? " on" : ""}`}
              aria-pressed={t === on}
              onClick={() => {
                if (isEnd) setLength(toMin(t) - toMin(time));
                else setTime(t);
                setPage("form");
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} label={e ? "Edit entry" : "New entry"} className="tall">
      <div className="cph-ent">
        <h2 className="cph-ent-title">{e ? "Edit entry" : "New entry"}</h2>

        <span className="cph-ent-label">Category</span>
        <div className="cph-ent-tiles" role="radiogroup" aria-label="Category">
          {categories.map((c) => {
            const picked = c.id === cat;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={picked} className={`cph-ent-tile${picked ? " on" : ""}`} style={{ "--tc": paletteOf(c.color).ink } as React.CSSProperties} onClick={() => pickCat(c.id)}>
                <CatIcon d={entryIcon(c.id)} />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        <label className="cph-ent-label" htmlFor="cph-ent-what">
          What
        </label>
        <input id="cph-ent-what" className="cph-ent-box" value={topic} onChange={(x) => setTopic(x.target.value)} placeholder={suggested ?? ENTRY_PRESET[cat]?.placeholder ?? "What is it?"} maxLength={80} enterKeyHint="done" />

        {/* With on a Client call or Training alone (23 Oct, Alex); on any other category it keeps its room unseen (not
            read out, not reached), so tapping tiles never makes the sheet jump, as the laptop's pop-up. */}
        <div className={`cph-ent-withrow${withClient ? "" : " off"}`} aria-hidden={withClient ? undefined : true} inert={!withClient}>
          <span className="cph-ent-label">With</span>
          <button type="button" className="cph-ent-box cph-ent-with" onClick={() => setPage("with")}>
            {client ? (
              <>
                <Avatar name={client.name} src={client.avatarPath} size={26} />
                <b>{client.name}</b>
                <span className="cph-ent-act">Change</span>
              </>
            ) : (
              <>
                <Icon name="search" small />
                <span className="cph-ent-quiet">Pick a client</span>
              </>
            )}
          </button>
        </div>

        <div className="cph-ent-two">
          <div>
            <span className="cph-ent-label">Date</span>
            <button type="button" className="cph-ent-box cph-ent-pick" onClick={() => setPage("date")} aria-label={`Date, ${shortDay(date)}`}>
              {shortDay(date)}
            </button>
          </div>
          <div>
            <span className="cph-ent-label">When</span>
            <div className="cph-seg" role="radiogroup" aria-label="Timed or all day">
              <button type="button" role="radio" aria-checked={!allDay} className={allDay ? "" : "on"} onClick={() => setAllDay(false)}>
                Timed
              </button>
              <button type="button" role="radio" aria-checked={allDay} className={allDay ? "on" : ""} onClick={() => setAllDay(true)}>
                All day
              </button>
            </div>
          </div>
        </div>

        {/* All day keeps the times and the lengths, quiet, so the sheet never changes height (the laptop's, 14 Oct). */}
        <div className="cph-ent-times-row">
          <div>
            <span className="cph-ent-label">Starts</span>
            <button type="button" className="cph-ent-box cph-ent-pick" disabled={allDay} onClick={() => setPage("start")} aria-label={allDay ? "All day" : `Starts, ${time}`}>
              {allDay ? "All day" : time}
            </button>
          </div>
          <span className="cph-ent-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
          <div>
            <span className="cph-ent-label">Ends</span>
            <button type="button" className={`cph-ent-box cph-ent-pick${customLength ? "" : " still"}`} disabled={allDay || !customLength} onClick={() => setPage("end")} aria-label={allDay ? "All day" : `Ends, ${hhmm(endMin)}`}>
              {allDay ? "—" : hhmm(endMin)}
            </button>
          </div>
        </div>

        <span className="cph-ent-label">Length</span>
        <div className="cph-seg" role="radiogroup" aria-label="Length" aria-disabled={allDay}>
          {LENGTHS.map((m) => {
            const on = !allDay && !customLength && length === m;
            return (
              <button key={m} type="button" role="radio" disabled={allDay} aria-checked={on} className={on ? "on" : ""} onClick={() => (setLength(m), setCustomLength(false))}>
                {lengthLabel(m)}
              </button>
            );
          })}
          <button type="button" role="radio" disabled={allDay} aria-checked={!allDay && customLength} className={!allDay && customLength ? "on" : ""} onClick={() => setCustomLength(true)}>
            Custom
          </button>
        </div>
        {/* Always a line, so an overlap appearing never moves the sheet. */}
        <small className="cph-ent-overlap">{overlap ?? " "}</small>

        <label className="cph-ent-label" htmlFor="cph-ent-note">
          Note
        </label>
        {/* A note with Save right under it: no box and no line (design rules 6). */}
        <textarea id="cph-ent-note" className="cph-ent-note" value={note} onChange={(x) => setNote(x.target.value)} placeholder="What to bring up, what to prepare…" maxLength={2000} rows={2} />

        {error && (
          <p className="cph-error" role="alert">
            {error}
          </p>
        )}
        <div className="cph-ent-foot">
          <button type="button" className="cph-text-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="cph-pill ink small" disabled={!ok || !title || saving} onClick={() => void save()}>
            {e ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
