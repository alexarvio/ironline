"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover as PopoverPrimitive } from "radix-ui";
import { toast } from "sonner";
import { addCalendarEntryAction, removeCalendarEntryAction, updateCalendarEntryAction } from "../../../lib/actions";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { SearchIcon } from "../../../components/icons";
import DateText from "../DateText";
import { MonthRange } from "../MonthRange";
import { paletteOf, type Category } from "../palette";
import type { CalEntry } from "./CalendarDay";
import { TRAINING_ICON } from "../../../lib/eventTypes";
import { isClientCall, takesClient } from "../../../lib/calendarKinds";

// The Calendar's entry pop-up, built as the meeting scheduler (22 Oct, the
// .npd pattern): the title and the category as its tinted tag; the
// categories as tiles across the row, the icon in its colour, the chosen one
// ink; What and With as clean lines; the month on the left (MonthRange, in
// the category's colour) with the day typed or picked, the times and the
// length on the right; the note a clean line; Remove in red words on the
// left, Cancel in words and one black pill. A client is picked from a list
// that floats over the pop-up, with the line that says why they need the
// coach, as the rail shows it. Removing asks first, as a .dlh card.
// With is only for a Client call or Training (23 Oct, Alex; calendarKinds.ts):
// on any other category it keeps its room unseen, and no client is saved.

export type EntryClient = { id: number; name: string; avatarPath: string | null; /** Why they need the coach, as the rail says it; null: all good. */ reason: { text: string; color: string; rgb: string } | null };
export type Open = { entry: CalEntry | null; date: string; time: string };

const PRESET: Record<string, { icon: string; placeholder: string; length: number }> = {
  call: { icon: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5", placeholder: "Week 1 check-in", length: 30 },
  training: { icon: TRAINING_ICON, placeholder: "Session with Mattia", length: 60 },
  admin: { icon: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4", placeholder: "Write programmes", length: 60 },
  personal: { icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", placeholder: "Gym, lunch, school run", length: 60 },
  content: { icon: "M4 8h3.5l2-3h5l2 3H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", placeholder: "Film the week's reels", length: 60 },
  other: { icon: "M5 12h.01M12 12h.01M19 12h.01", placeholder: "What is it?", length: 60 },
};
const TAG_ICON = "M20 12l-8 8-9-9V4h7l10 8zM7.5 7.5h.01";
const LENGTHS = [15, 30, 45, 60];
const LAST_CAT_KEY = "norcoach:cal-last-category";

const hexRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const lengthLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`);
const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const SLOTS = Array.from({ length: ((22 - 5) * 60) / 15 + 1 }, (_, i) => hhmm(5 * 60 + i * 15));
/** "1530", "15.30", "3pm" and "15:30" all read as 15:30. */
function parseTime(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(am|pm)?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const mm = Number(m[2] ?? 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || mm > 59) return null;
  return hhmm(h * 60 + mm);
}
function browserZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function CatIcon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Two times in a row get air (design rules 8): a faint grey arrow, as the event pop-up's. */
function RangeArrow() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** The client's face, 24px (28 in the list): their photo, else their initial on a hairline ring, as the Feed's. */
function Face({ name, src }: { name: string; src: string | null }) {
  return (
    <span className="cal-face" aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
        <img src={src} alt="" />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** The tiles across the whole row (design rules 5), equal widths: up to six a row, more spread over rows that hold about as many. */
const tileCols = (n: number) => (n <= 6 ? Math.max(1, n) : Math.ceil(n / Math.ceil(n / 6)));

export default function EntryDialog({ open, cats, clients, dayEntries, onDone }: { open: Open; cats: Category[]; clients: EntryClient[]; /** The day's other entries, for the overlap line. */ dayEntries: CalEntry[]; onDone: () => void }) {
  const router = useRouter();
  const e = open.entry;
  const lastCat = (() => {
    try {
      return window.localStorage.getItem(LAST_CAT_KEY);
    } catch {
      return null;
    }
  })();
  // An entry with none keeps the colour it wears, as the phone's sheet: a client's call blue, the coach's own grey.
  const [cat, setCat] = useState<string>(e ? e.category ?? (e.clientId != null ? "call" : "other") : lastCat && cats.some((c) => c.id === lastCat) ? lastCat : "call");
  const [topic, setTopic] = useState(e?.topic ?? "");
  const [date, setDate] = useState(open.date);
  const [allDay, setAllDay] = useState(e?.allDay ?? false);
  const [time, setTime] = useState(e?.time || open.time || "09:00");
  const [length, setLength] = useState<number>(e?.durationMinutes ?? PRESET[cat]?.length ?? 60);
  const [customLength, setCustomLength] = useState(e ? !LENGTHS.includes(e.durationMinutes) : false);
  const [clientId, setClientId] = useState<number | null>(e?.clientId ?? null);
  const [picking, setPicking] = useState(false);
  const [clientQ, setClientQ] = useState("");
  const [note, setNote] = useState(e?.note ?? "");
  const [removing, setRemoving] = useState(false);
  // Back from the Remove confirm by Cancel: the focus lands on Remove again, not the top of the pop-up.
  const [cameBack, setCameBack] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeTyped, setTimeTyped] = useState("");
  const [endOpen, setEndOpen] = useState(false);
  const [endTyped, setEndTyped] = useState("");
  // The month on the left: the day's month, moved by a day typed or picked further off.
  const [today] = useState(() => isoOf(new Date()));
  const [cursor, setCursor] = useState((open.date || today).slice(0, 7));
  const titleRef = useRef<HTMLInputElement>(null);

  const current = cats.find((c) => c.id === cat) ?? cats[0];
  const ink = paletteOf(current?.color ?? "blue").ink;
  const rgb = hexRgb(ink);
  const iconOf = (id: string) => PRESET[id]?.icon ?? TAG_ICON;
  const placeholder = PRESET[cat]?.placeholder ?? "What is it?";
  // Only a Client call or Training is with a client.
  const withClient = takesClient(cat);
  const client = withClient && clientId != null ? clients.find((c) => c.id === clientId) ?? null : null;
  const first = (name: string) => name.split(" ")[0];
  const endMin = toMin(time) + length;
  const ok = topic.trim().length > 0 && !!date && (allDay || !!time);

  // Overlaps with the day's other entries, as a warning only.
  const overlap = useMemo(() => {
    if (allDay || date !== open.date) return null;
    const s = toMin(time);
    const hit = dayEntries.find((x) => !x.allDay && x.id !== e?.id && toMin(x.time) < s + length && toMin(x.time) + x.durationMinutes > s);
    return hit ? `Overlaps “${hit.topic || hit.clientName || "an entry"}” ${hit.time}–${hhmm(toMin(hit.time) + hit.durationMinutes)}` : null;
  }, [allDay, date, open.date, time, length, dayEntries, e?.id]);

  // A client picked with no title yet: the title suggests itself, as a placeholder the coach can keep.
  const suggested = client && !topic.trim() ? `${current?.label ?? "Call"} · ${first(client.name)}` : null;

  const pickCat = (id: string) => {
    setCat(id);
    // A category with no client closes the picker; the client picked stays in hand (a tile tapped by mistake and back
    // loses nothing), and save sends it only with With.
    if (!takesClient(id)) {
      setPicking(false);
      setClientQ("");
    }
    if (!e && !customLength) setLength(PRESET[id]?.length ?? 60);
    try {
      window.localStorage.setItem(LAST_CAT_KEY, id);
    } catch {}
  };
  const pickDate = (d: string) => {
    setDate(d);
    setCursor(d.slice(0, 7));
  };
  const save = async () => {
    if (!ok || saving) return;
    setSaving(true);
    setError(null);
    const title = topic.trim() || suggested || "";
    // The time is in this browser's timezone, as every time on the Calendar reads.
    const v = { date, time: allDay ? "" : time, tz: allDay ? null : browserZone(), durationMinutes: length, allDay, topic: title, clientId: withClient ? clientId : null, category: cat, note: note.trim() };
    try {
      if (e) await updateCalendarEntryAction(e.id, v);
      else await addCalendarEntryAction(v);
      router.refresh();
      toast.success(e ? `${title} · saved` : `${title} · added`);
      onDone();
    } catch {
      setError("Not saved. Try again.");
    }
    setSaving(false);
  };
  const remove = async () => {
    if (!e) return;
    setSaving(true);
    await removeCalendarEntryAction(e.id);
    router.refresh();
    toast.success("Removed");
    onDone();
  };
  // The X and Cancel just close (14 Oct): no "Discard changes?" in between.
  const tryClose = onDone;
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
        ev.preventDefault();
        void save();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save reads the latest state when it runs
  }, [ok, saving, topic, date, allDay, time, length, clientId, cat, note]);

  const sortedClients = useMemo(() => {
    const q = clientQ.trim().toLowerCase();
    return clients.filter((c) => !q || c.name.toLowerCase().includes(q)).sort((a, b) => Number(!!b.reason) - Number(!!a.reason) || a.name.localeCompare(b.name));
  }, [clients, clientQ]);

  const outside = {
    onPointerDownOutside: (ev: Event) => {
      ev.preventDefault();
      tryClose();
    },
    onEscapeKeyDown: (ev: KeyboardEvent) => {
      ev.preventDefault();
      tryClose();
    },
  };

  // Removing asks first (design rules 4): the .dlh card, red Remove in words, Cancel back to the entry.
  if (removing && e)
    return (
      <DialogContent className="dlh" role="alertdialog" {...outside}>
        <div className="dlh-head">
          <DialogTitle className="dlh-title">Remove {e.topic || "this entry"}?</DialogTitle>
          <button type="button" className="dlh-x" onClick={tryClose} aria-label="Close">
            ✕
          </button>
        </div>
        <DialogDescription className="dlh-what">This permanently removes the entry. It can&rsquo;t be undone.</DialogDescription>
        <div className="dlh-foot">
          <button
            type="button"
            className="dlh-cancel"
            onClick={() => {
              setCameBack(true);
              setRemoving(false);
            }}
            autoFocus
          >
            Cancel
          </button>
          <button type="button" className="dlh-delete" onClick={() => void remove()} disabled={saving}>
            Remove
          </button>
        </div>
      </DialogContent>
    );

  return (
    <DialogContent className="npd cal-npd" style={{ "--npd-c": ink, "--npd-rgb": rgb } as React.CSSProperties} aria-describedby={undefined} {...outside}>
      <div className="npd-head">
        <DialogTitle className="npd-title">{e ? e.topic || "Edit entry" : "New entry"}</DialogTitle>
        <span className="npd-tools">
          {/* Their Meetings hold their calls alone (23 Oct, Alex), so Open is a call's. */}
          {client && isClientCall(cat) && (
            <Link href={`/admin/redesign/meetings?client=${client.id}`} className="npd-open" title={`Open ${first(client.name)}’s meetings`} aria-label={`Open ${first(client.name)}’s meetings`}>
              Open
            </Link>
          )}
          <button type="button" className="npd-x" onClick={tryClose} aria-label="Close">
            ✕
          </button>
        </span>
      </div>
      <div className="npd-tags">
        <span className="npd-track">
          <CatIcon d={iconOf(cat)} size={12} />
          {current?.label}
        </span>
      </div>

      {/* The categories as tiles across the row, the icon in its colour; the chosen one ink. */}
      <div className="npd-field">
        <span className="npd-label">Category</span>
        <div className="npd-tiles" role="radiogroup" aria-label="Category" style={{ gridTemplateColumns: `repeat(${tileCols(cats.length)}, minmax(0, 1fr))` }}>
          {cats.map((c) => {
            const on = c.id === cat;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={on} className={`npd-tile${on ? " on" : ""}`} style={{ "--tc": paletteOf(c.color).ink } as React.CSSProperties} onClick={() => pickCat(c.id)}>
                <CatIcon d={iconOf(c.id)} size={18} />
                <span className="cal-tile-name">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* What over the month, With over the times: two clean lines side by side. With only on a Client call or Training (23 Oct, Alex); on any other category it keeps its room unseen (not read out, not reached by Tab), so switching tiles never makes the pop-up jump. */}
      <div className="cal-pair">
        <label className="npd-field">
          <span className="npd-label">What</span>
          <input ref={titleRef} className="npd-line" value={topic} onChange={(x) => setTopic(x.target.value)} placeholder={suggested ?? placeholder} maxLength={80} autoFocus={!e} aria-label="What" />
        </label>
        <div className={`npd-field${withClient ? "" : " cal-with-off"}`} aria-hidden={withClient ? undefined : true} inert={!withClient}>
          <span className="npd-label">With</span>
          {client && !picking ? (
            <div className="cal-with" style={client.reason ? ({ "--rc": client.reason.color } as React.CSSProperties) : undefined}>
              <Face name={client.name} src={client.avatarPath} />
              <span className="cal-with-name">{client.name}</span>
              <small className={client.reason ? "reason" : ""}>{client.reason ? client.reason.text : "All good"}</small>
              <button type="button" className="npd-act" onClick={() => setPicking(true)}>
                Change
              </button>
            </div>
          ) : picking ? (
            /* The list floats over the pop-up (a portal), so the pop-up keeps its size; a click anywhere else closes it. Modal: its own scroll lock, else the dialog's swallows the wheel. */
            <PopoverPrimitive.Root open modal onOpenChange={(o) => !o && (setPicking(false), setClientQ(""))}>
              <PopoverPrimitive.Anchor asChild>
                <span className="cal-with on">
                  <SearchIcon />
                  <input
                    autoFocus
                    value={clientQ}
                    onChange={(x) => setClientQ(x.target.value)}
                    placeholder="Search clients"
                    aria-label="Search clients"
                    onKeyDown={(x) => {
                      if (x.key === "Escape") setPicking(false);
                      if (x.key === "Enter" && sortedClients[0]) {
                        setClientId(sortedClients[0].id);
                        setPicking(false);
                        setClientQ("");
                      }
                    }}
                  />
                </span>
              </PopoverPrimitive.Anchor>
              <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content align="start" sideOffset={6} className="cal-drop" role="listbox" onOpenAutoFocus={(ev) => ev.preventDefault()} onCloseAutoFocus={(ev) => ev.preventDefault()}>
                  {clientId != null && (
                    <button type="button" role="option" aria-selected={false} className="cal-opt" onClick={() => (setClientId(null), setPicking(false))}>
                      <span className="cal-face none" aria-hidden="true">
                        –
                      </span>
                      <span className="cal-opt-text">
                        <b>Just you</b>
                      </span>
                    </button>
                  )}
                  {sortedClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={c.id === clientId}
                      className="cal-opt"
                      style={c.reason ? ({ "--rc": c.reason.color } as React.CSSProperties) : undefined}
                      onClick={() => {
                        setClientId(c.id);
                        setPicking(false);
                        setClientQ("");
                      }}
                    >
                      <Face name={c.name} src={c.avatarPath} />
                      <span className="cal-opt-text">
                        <b>{c.name}</b>
                        <small className={c.reason ? "reason" : ""}>{c.reason ? c.reason.text : "All good"}</small>
                      </span>
                    </button>
                  ))}
                  {sortedClients.length === 0 && <p className="cal-none">No match</p>}
                </PopoverPrimitive.Content>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          ) : (
            <button type="button" className="cal-with pick" onClick={() => setPicking(true)}>
              <SearchIcon />
              <span>Pick a client</span>
            </button>
          )}
        </div>
      </div>

      <div className="npd-cols">
        {/* The month (MonthRange, the one calendar), the day in the category's colour. */}
        <MonthRange from={date} to={date} onPick={pickDate} planned={[]} cursor={cursor} setCursor={setCursor} today={today} plain legend={null} />
        <div className="npd-side">
          <div className="npd-when">
            <span className="npd-label">When</span>
            <div className="npd-seg" role="radiogroup" aria-label="Timed or all day">
              <button type="button" role="radio" aria-checked={!allDay} className={allDay ? "" : "on"} onClick={() => setAllDay(false)}>
                Timed
              </button>
              <button type="button" role="radio" aria-checked={allDay} className={allDay ? "on" : ""} onClick={() => setAllDay(true)}>
                All day
              </button>
            </div>
          </div>
          {/* The day typed or picked (design rules 7): typed here, picked on the month. */}
          <div className="npd-dates">
            <div className="npd-date arm">
              <span className="npd-date-head">Date</span>
              <DateText value={date} onChange={pickDate} label={`Day, ${date ? longDate(date) : "none"}`} />
            </div>
          </div>
          <div className="npd-dates cal-times-row">
            {allDay ? (
              /* All day: the time boxes and the lengths stay, quiet, so the pop-up keeps its height. */
              <>
                <span className="npd-date cal-still off" aria-hidden="true">
                  <span className="npd-date-head">Starts</span>
                  <b>All day</b>
                </span>
                <span className="npd-arrow" aria-hidden="true">
                  <RangeArrow />
                </span>
                <span className="npd-date cal-still off" aria-hidden="true">
                  <span className="npd-date-head">Ends</span>
                  <b>—</b>
                </span>
              </>
            ) : (
              <>
                <PopoverPrimitive.Root open={timeOpen} modal onOpenChange={setTimeOpen}>
                  <PopoverPrimitive.Trigger className="npd-date" aria-label={`Starts, ${time}`}>
                    <span className="npd-date-head">Starts</span>
                    <b>{time}</b>
                  </PopoverPrimitive.Trigger>
                  <PopoverPrimitive.Portal>
                    <PopoverPrimitive.Content align="start" sideOffset={6} className="cal-times">
                      <input
                        className="cal-times-type"
                        value={timeTyped}
                        onChange={(x) => setTimeTyped(x.target.value)}
                        placeholder="1530"
                        aria-label="Type a time"
                        onKeyDown={(x) => {
                          if (x.key === "Enter") {
                            const t = parseTime(timeTyped);
                            if (t) {
                              setTime(t);
                              setTimeTyped("");
                              setTimeOpen(false);
                            }
                          }
                        }}
                      />
                      <div className="cal-times-list">
                        {SLOTS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={`cal-time${t === time ? " on" : ""}`}
                            ref={(el) => {
                              if (el && t === time) el.scrollIntoView({ block: "center" });
                            }}
                            onClick={() => {
                              setTime(t);
                              setTimeOpen(false);
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </PopoverPrimitive.Content>
                  </PopoverPrimitive.Portal>
                </PopoverPrimitive.Root>
                <span className="npd-arrow" aria-hidden="true">
                  <RangeArrow />
                </span>
                {customLength ? (
                  /* Custom: the end is picked like the start (15 Oct), typed or from the list; the browser's time field fought every keystroke. */
                  <PopoverPrimitive.Root open={endOpen} modal onOpenChange={setEndOpen}>
                    <PopoverPrimitive.Trigger className="npd-date" aria-label={`Ends, ${hhmm(endMin)}`}>
                      <span className="npd-date-head">Ends</span>
                      <b>{hhmm(endMin)}</b>
                    </PopoverPrimitive.Trigger>
                    <PopoverPrimitive.Portal>
                      <PopoverPrimitive.Content align="start" sideOffset={6} className="cal-times">
                        <input
                          className="cal-times-type"
                          value={endTyped}
                          onChange={(x) => setEndTyped(x.target.value)}
                          placeholder="1530"
                          aria-label="Type the end time"
                          autoFocus
                          onKeyDown={(x) => {
                            if (x.key === "Enter") {
                              const t = parseTime(endTyped);
                              const m = t ? toMin(t) - toMin(time) : 0;
                              if (m > 0) {
                                setLength(m);
                                setEndTyped("");
                                setEndOpen(false);
                              }
                            }
                          }}
                        />
                        <div className="cal-times-list">
                          {SLOTS.filter((t) => toMin(t) > toMin(time)).map((t) => (
                            <button
                              key={t}
                              type="button"
                              className={`cal-time${t === hhmm(endMin) ? " on" : ""}`}
                              ref={(el) => {
                                if (el && t === hhmm(endMin)) el.scrollIntoView({ block: "center" });
                              }}
                              onClick={() => {
                                setLength(toMin(t) - toMin(time));
                                setEndOpen(false);
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </PopoverPrimitive.Content>
                    </PopoverPrimitive.Portal>
                  </PopoverPrimitive.Root>
                ) : (
                  <span className="npd-date cal-still" aria-live="polite">
                    <span className="npd-date-head">Ends</span>
                    <b>{hhmm(endMin)}</b>
                  </span>
                )}
              </>
            )}
          </div>
          {/* All day keeps the row (14 Oct): the lengths go quiet, so the pop-up never changes size. */}
          <div className="npd-field">
            <span className="npd-label">Length</span>
            <div className={`npd-seg cal-lengths${allDay ? " off" : ""}`} role="radiogroup" aria-label="Length" aria-disabled={allDay}>
              {LENGTHS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  disabled={allDay}
                  aria-checked={!allDay && !customLength && length === m}
                  className={!allDay && !customLength && length === m ? "on" : ""}
                  onClick={() => {
                    setLength(m);
                    setCustomLength(false);
                  }}
                >
                  {lengthLabel(m)}
                </button>
              ))}
              <button type="button" role="radio" disabled={allDay} aria-checked={!allDay && customLength} className={!allDay && customLength ? "on" : ""} onClick={() => setCustomLength(true)}>
                Custom
              </button>
            </div>
          </div>
          {/* Always a line, so an overlap appearing never moves the pop-up. */}
          <small className="cal-overlap">{overlap ?? " "}</small>
        </div>
      </div>

      <label className="npd-field">
        <span className="npd-label">Note</span>
        <textarea className="npd-line cal-note" value={note} onChange={(x) => setNote(x.target.value)} placeholder="What to bring up, what to prepare…" maxLength={2000} rows={2} />
      </label>

      <div className="npd-foot">
        {e && (
          <button type="button" className="npd-delete" onClick={() => setRemoving(true)} autoFocus={cameBack}>
            Remove
          </button>
        )}
        {error && (
          <span className="cal-error" role="alert">
            {error}
          </span>
        )}
        <button type="button" className="npd-cancel" onClick={tryClose}>
          Cancel
        </button>
        <button type="button" className="npd-save" disabled={!ok || saving} aria-disabled={!ok || saving} onClick={() => void save()}>
          {saving ? <span className="cal-spin" aria-hidden="true" /> : null}
          {e ? "Save" : "Add"}
        </button>
      </div>
    </DialogContent>
  );
}
