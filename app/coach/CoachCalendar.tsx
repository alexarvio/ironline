"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type React from "react";
import { removeCalendarEntryAction } from "../lib/actions";
import { dayMonth } from "../lib/dayMonth";
import { CLASH, entryChrome } from "../admin/redesign/calendar/chrome";
import { coachCalendarAction } from "./actions";
import type { PhoneCalendar, PhoneEntry } from "./calendar";
import EntrySheet, { CatIcon, entryIcon, hhmm, lengthLabel, shortDay, toMin, type EntryOpen } from "./EntrySheet";
import { Avatar, Facts, Icon, Sheet } from "./parts";

// The Calendar on the coach's phone (22 Oct, Alex): the laptop's Calendar
// (/admin/redesign/calendar) for a thumb, the same entries and the same
// actions. A week at a time on a strip (a swipe or ‹ › for another week,
// Today back), the chosen day under it as a list with its times, 24-hour;
// a swipe on the list is the next or the day before. Each entry wears its
// category's colour as the laptop draws it (calendar/chrome.ts: a 12% wash,
// its words and edge in the colour), a double-booking rust, and the
// double-bookings still to come sit over the week with a way to their day.
// A tap opens an entry: what, when, with whom, the note; Chat opens the
// client's chat, Edit the entry's sheet, Remove asks first. + adds one.

const POLL_MS = 15000;
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const parse = (iso: string) => new Date(`${iso}T12:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const mondayOf = (iso: string) => addDays(iso, -((parse(iso).getDay() + 6) % 7));
const spokenDay = (d: string) => parse(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

// The phone's day and minute, for Today and NOW; the server's day on the first paint, so it matches.
const subscribeMinute = (tick: () => void) => {
  const id = window.setInterval(tick, 15000);
  return () => window.clearInterval(id);
};
const minuteNow = () => Math.floor(Date.now() / 60000);
const noMinute = () => null;

/** Where the Calendar is and what it has read, kept by the app, so it is where it was left after a chat opened from it. */
export function useCalendarState(initial: PhoneCalendar) {
  const [weeks, setWeeks] = useState<Record<string, PhoneCalendar>>(() => ({ [initial.from]: initial }));
  const [day, setDay] = useState<string | null>(null);
  return { weeks, setWeeks, day, setDay };
}
export type CalendarState = ReturnType<typeof useCalendarState>;

/** A horizontal swipe, told from a scroll by being mostly sideways and long enough. */
function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.6) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

export default function CoachCalendar({ state, serverToday, me, onOpenChat }: { state: CalendarState; serverToday: string; /** The coach's face, for the account sheet. */ me: ReactNode; onOpenChat: (clientId: number) => void }) {
  const { weeks, setWeeks, day, setDay } = state;
  const minute = useSyncExternalStore<number | null>(subscribeMinute, minuteNow, noMinute);
  const today = minute == null ? serverToday : isoOf(new Date(minute * 60000));
  const chosen = day ?? today;
  const monday = mondayOf(chosen);
  const week = weeks[monday] ?? null;
  // The latest read: its clashes, categories and clients are the coach's whole calendar's, whichever week it was.
  const latest = week ?? Object.values(weeks)[0];
  // Which way the day, and the week, came in: the strip slides only when the week changes.
  const [slide, setSlide] = useState<"" | "next" | "prev">("");
  const [weekSlide, setWeekSlide] = useState<"" | "next" | "prev">("");
  const [opened, setOpened] = useState<number | null>(null);
  const [form, setForm] = useState<EntryOpen | null>(null);

  const load = useCallback(
    async (from: string) => {
      const next = await coachCalendarAction(from, isoOf(new Date())).catch(() => null);
      if (next) setWeeks((w) => ({ ...w, [next.from]: next }));
    },
    [setWeeks],
  );
  // This phone's timezone, for the server (lib/viewZone.ts), as the laptop's rail sets it: the entries read in it.
  useEffect(() => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const had = document.cookie.split("; ").find((c) => c.startsWith("ironline_tz="))?.slice("ironline_tz=".length);
      if (zone && had !== encodeURIComponent(zone)) document.cookie = `ironline_tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
  }, []);
  // The week on screen is read when it comes up and every 15 s while the app shows, as the lists are.
  useEffect(() => {
    void load(monday);
    const tick = () => {
      if (document.visibilityState === "visible") void load(monday);
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [monday, load]);

  const go = (d: string) => {
    if (d === chosen) return;
    setSlide(d > chosen ? "next" : "prev");
    if (mondayOf(d) !== monday) setWeekSlide(d > chosen ? "next" : "prev");
    setDay(d === today ? null : d);
  };
  const weekSwipe = useSwipe((dir) => go(addDays(chosen, dir * 7)));
  const daySwipe = useSwipe((dir) => go(addDays(chosen, dir)));

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const entries = week?.entries ?? [];
  const ofDay = (d: string) => entries.filter((e) => e.date === d);
  const list = ofDay(chosen);
  const cats = latest?.categories ?? [];
  const clients = latest?.clients ?? [];
  const clashes = latest?.clashes ?? [];
  const open = opened != null ? entries.find((e) => e.id === opened) ?? null : null;

  // NOW on today: an ink line before the first entry still to start (all-day ones stay above it).
  const nowMin = minute != null && chosen === today ? new Date(minute * 60000).getHours() * 60 + new Date(minute * 60000).getMinutes() : null;
  const nowAt = nowMin == null ? -1 : (() => {
    const i = list.findIndex((e) => !e.allDay && e.time && toMin(e.time) > nowMin);
    return i === -1 ? list.length : i;
  })();

  const addAt = () => {
    // Today: the next quarter hour; another day: 09:00, as the laptop's day opens.
    const t = nowMin != null && nowMin < 23 * 60 + 45 ? hhmm(Math.ceil((nowMin + 1) / 15) * 15) : "09:00";
    setForm({ entry: null, date: chosen, time: t });
  };
  const saved = (date: string, was: string) => {
    setForm(null);
    setOpened(null);
    if (date !== chosen) go(date);
    void load(mondayOf(date));
    if (mondayOf(was) !== mondayOf(date)) void load(mondayOf(was));
  };

  return (
    <>
      <header className="cph-head">
        <h1>Calendar</h1>
        <span className="cph-head-tools">
          <button type="button" className="cph-round" onClick={addAt} aria-label={`Add to ${spokenDay(chosen)}`}>
            <Icon name="plus" />
          </button>
          {me}
        </span>
      </header>

      {/* A double-booking still to come is a fact and its way there (the laptop's row): who overlaps whom, Open the day. */}
      {clashes.length > 0 && (
        <ul className="cph-cal-clashes" aria-label={`${clashes.length} double-booking${clashes.length === 1 ? "" : "s"}`}>
          {clashes.map((c, i) => (
            <li key={i}>
              <span>
                {c.a} <em>overlaps</em> {c.b}
              </span>
              <button type="button" className="cph-cal-fix" onClick={() => go(c.date)} aria-label={`Open ${spokenDay(c.date)}`}>
                Open {dayMonth(c.date)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="cph-cal-month">
        <h2>{parse(chosen).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
        <span className="cph-cal-pan">
          <button type="button" className="cph-round small" onClick={() => go(addDays(chosen, -7))} aria-label="Week before">
            <Icon name="back" small />
          </button>
          <button type="button" className="cph-cal-today" onClick={() => go(today)}>
            Today
          </button>
          <button type="button" className="cph-round small" onClick={() => go(addDays(chosen, 7))} aria-label="Week after">
            <Icon name="forward" small />
          </button>
        </span>
      </div>

      <div className={`cph-cal-week${weekSlide ? ` in-${weekSlide}` : ""}`} key={monday} {...weekSwipe}>
        {days.map((d, i) => {
          const marks = ofDay(d);
          return (
            <button
              key={d}
              type="button"
              className={`cph-cal-day${d === today ? " today" : ""}${d === chosen ? " on" : ""}${d < today ? " past" : ""}`}
              onClick={() => go(d)}
              aria-pressed={d === chosen}
              aria-label={`${spokenDay(d)}${marks.length ? `, ${marks.length} ${marks.length === 1 ? "entry" : "entries"}` : ""}`}
            >
              <span className="cph-cal-dow">{DOW[i]}</span>
              <span className="cph-cal-num">{Number(d.slice(8))}</span>
              {/* What is on it, a short line each in its category's colour (a clash rust), three at most. */}
              <span className="cph-cal-marks" aria-hidden="true">
                {marks.slice(0, 3).map((e) => (
                  <i key={e.id} style={{ background: e.clashes.length ? CLASH.ink : entryChrome(cats, e.category, e.clientId != null).ink }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="cph-cal-dayhead">
        <h2>
          {chosen === today ? "Today" : parse(chosen).toLocaleDateString("en-GB", { weekday: "long" })}
          <span>{dayMonth(chosen)}</span>
        </h2>
        {list.length > 0 && <span className="cph-cal-count">{`${list.length} ${list.length === 1 ? "entry" : "entries"}`}</span>}
      </div>

      <div className={`cph-cal-daybody${slide ? ` in-${slide}` : ""}`} key={chosen} {...daySwipe}>
        {!week ? null : list.length === 0 ? (
          <p className="cph-empty">Nothing booked</p>
        ) : (
          <ul className="cph-cal-list">
            {list.map((e, i) => (
              <Row key={e.id} e={e} cats={cats} now={i === nowAt} onOpen={() => setOpened(e.id)} />
            ))}
            {nowAt === list.length && <li className="cph-cal-now" aria-hidden="true" />}
          </ul>
        )}
      </div>

      {open && (
        <EntryRead
          e={open}
          cats={cats}
          avatar={open.clientId != null ? clients.find((c) => c.id === open.clientId)?.avatarPath ?? null : null}
          onClose={() => setOpened(null)}
          onChat={() => {
            const id = open.clientId;
            setOpened(null);
            if (id != null) onOpenChat(id);
          }}
          onEdit={() => {
            setOpened(null);
            setForm({ entry: open, date: open.date, time: open.time });
          }}
          onRemoved={() => {
            setOpened(null);
            void load(monday);
          }}
        />
      )}
      {form && <EntrySheet key={`${form.entry?.id ?? "new"}:${form.date}`} open={form} categories={cats} clients={clients} dayEntries={ofDay(form.date)} onClose={() => setForm(null)} onSaved={saved} />}
    </>
  );
}

/** One entry on the day: its times on the left, the entry in its category's colour on the right. */
function Row({ e, cats, now, onOpen }: { e: PhoneEntry; cats: PhoneCalendar["categories"]; now: boolean; onOpen: () => void }) {
  const clash = e.clashes.length > 0;
  const c = entryChrome(cats, e.category, e.clientId != null);
  const who = e.clientId != null ? e.clientName : null;
  // The title is always the title, the client under it (23 Oct, Alex), as the laptop's day.
  const title = e.topic || who || "Busy";
  // A call with its link joins from the list itself (25 Oct, Alex: "press on the bubble… join call"), a white pill on
  // the entry's right; the rest of the entry still opens its sheet.
  const join = e.link && e.status !== "completed" ? e.link : null;
  return (
    <>
      {now && <li className="cph-cal-now" aria-hidden="true" />}
      <li className={join ? "cph-cal-li joins" : undefined}>
        <button type="button" className={`cph-cal-entry${e.status === "completed" ? " done" : ""}`} onClick={onOpen}>
          <span className="cph-cal-time">
            {e.allDay || !e.time ? (
              <b>{e.allDay ? "All day" : "–"}</b>
            ) : (
              <>
                <b>{e.time}</b>
                <small>{hhmm(toMin(e.time) + e.durationMinutes)}</small>
              </>
            )}
          </span>
          <span className="cph-cal-pill" style={{ background: c.tint, color: c.ink, boxShadow: `inset 0 0 0 1px ${clash ? CLASH.line : c.line}` }}>
            <b>{title}</b>
            {(who && e.topic) || !e.allDay ? (
              <span className="cph-cal-sub">
                <Facts parts={[who && e.topic ? who : null, e.allDay ? null : lengthLabel(e.durationMinutes)]} />
              </span>
            ) : null}
            {clash && <span className="cph-cal-clash">Overlaps {e.clashes.join(", ")}</span>}
          </span>
        </button>
        {join && (
          <a className="cph-cal-join" href={join} target="_blank" rel="noopener noreferrer" aria-label={`Join ${title}`}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5" />
            </svg>
            Join
          </a>
        )}
      </li>
    </>
  );
}

/** An entry opened: what, its category, when, with whom and the note; then Join call (when it has a link), Chat, Edit and Remove (which asks first). */
function EntryRead({ e, cats, avatar, onClose, onChat, onEdit, onRemoved }: { e: PhoneEntry; cats: PhoneCalendar["categories"]; avatar: string | null; onClose: () => void; onChat: () => void; onEdit: () => void; onRemoved: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const c = entryChrome(cats, e.category, e.clientId != null);
  // No category: a client's call is a Client call, the coach's own Other, as their colours already say (palette.ts).
  const catId = e.category ?? (e.clientId != null ? "call" : "other");
  const cat = cats.find((x) => x.id === catId);
  const title = e.topic || (e.clientId != null ? e.clientName : "Busy");
  const first = e.clientName.split(" ")[0];
  const when = e.allDay ? "All day" : e.time ? `${e.time}–${hhmm(toMin(e.time) + e.durationMinutes)}` : null;
  const remove = async () => {
    setBusy(true);
    await removeCalendarEntryAction(e.id).catch(() => null);
    onRemoved();
  };
  return (
    <Sheet onClose={onClose} label={title}>
      {confirm ? (
        <div className="cph-confirm">
          <h2>Remove {e.topic || "this entry"}?</h2>
          <p>This permanently removes the entry. It can&rsquo;t be undone.</p>
          <div className="cph-confirm-row">
            <button type="button" className="cph-text-btn" onClick={() => setConfirm(false)}>
              Cancel
            </button>
            <button type="button" className="cph-text-btn danger" onClick={() => void remove()} disabled={busy}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="cph-read">
            <h2>{title}</h2>
            <span className="cph-read-cat" style={{ color: c.ink }}>
              <CatIcon d={entryIcon(catId)} size={14} />
              {cat?.label ?? "Other"}
            </span>
            <p className="cph-read-facts">
              <Facts parts={[shortDay(e.date), when, e.allDay ? null : lengthLabel(e.durationMinutes), e.status === "completed" ? "Done" : null]} />
            </p>
            {e.clashes.length > 0 && <p className="cph-read-clash">Overlaps {e.clashes.join(", ")}</p>}
            {e.clientId != null && (
              <span className="cph-read-with">
                <Avatar name={e.clientName} src={avatar} size={28} />
                {e.clientName}
              </span>
            )}
            {e.note && <p className="cph-read-note">{e.note}</p>}
          </div>
          {/* The call's link as an action alone, never its URL (25 Oct, Alex), opening outside the app. */}
          {e.link && (
            <a className="cph-sheet-row" href={e.link} target="_blank" rel="noopener noreferrer">
              <CatIcon d={entryIcon("call")} size={20} />
              Join call
            </a>
          )}
          {e.clientId != null && (
            <button type="button" className="cph-sheet-row" onClick={onChat}>
              <Icon name="chat" />
              Chat with {first}
            </button>
          )}
          <button type="button" className="cph-sheet-row" onClick={onEdit}>
            <Icon name="edit" />
            Edit
          </button>
          <button type="button" className="cph-sheet-row danger" onClick={() => setConfirm(true)}>
            <Icon name="trash" />
            Remove
          </button>
        </>
      )}
    </Sheet>
  );
}
