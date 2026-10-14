"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover as PopoverPrimitive } from "radix-ui";
import { toast } from "sonner";
import { addCalendarEntryAction, removeCalendarEntryAction, updateCalendarEntryAction } from "../../../lib/actions";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { SearchIcon, TrashIcon } from "../../../components/icons";
import DatePick from "../DatePick";
import { paletteOf, type Category } from "../palette";
import type { CalEntry } from "./CalendarDay";

// The Calendar's entry pop-up (14 Oct): the New event and New phase
// dialogs' language. A glow and a title pill in the category's colour,
// the categories as tinted tiles (six, three a row; Other grey), filled
// fields, navy day and time boxes, a navy Save. A client can be picked
// from a list that floats over the pop-up, with the line that says why
// they need the coach, as the rail shows it.

export type EntryClient = { id: number; name: string; avatarPath: string | null; /** Why they need the coach, as the rail says it; null: all good. */ reason: { text: string; color: string; rgb: string } | null };
export type Open = { entry: CalEntry | null; date: string; time: string };

const PRESET: Record<string, { icon: string; placeholder: string; length: number }> = {
  call: { icon: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5", placeholder: "e.g. Week 1 check-in", length: 30 },
  training: { icon: "M6.5 8v8M17.5 8v8M4 10v4M20 10v4M6.5 12h11", placeholder: "e.g. Session with Mattia", length: 60 },
  admin: { icon: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4", placeholder: "e.g. Write programmes", length: 60 },
  personal: { icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", placeholder: "e.g. Gym, lunch, school run", length: 60 },
  content: { icon: "M4 8h3.5l2-3h5l2 3H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", placeholder: "e.g. Film the week's reels", length: 60 },
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
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
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

function CatIcon({ d, size = 14, stroke = 2.2 }: { d: string; size?: number; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

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
  const [cat, setCat] = useState<string>(e?.category ?? (lastCat && cats.some((c) => c.id === lastCat) ? lastCat : "call"));
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
  const [discarding, setDiscarding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeTyped, setTimeTyped] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const current = cats.find((c) => c.id === cat) ?? cats[0];
  const ink = paletteOf(current?.color ?? "blue").ink;
  const rgb = hexRgb(ink);
  const iconOf = (id: string) => PRESET[id]?.icon ?? TAG_ICON;
  const placeholder = PRESET[cat]?.placeholder ?? "What is it?";
  const client = clientId != null ? clients.find((c) => c.id === clientId) ?? null : null;
  const first = (name: string) => name.split(" ")[0];
  const endMin = toMin(time) + length;
  // Changed since it opened: closing asks first.
  const [initial] = useState(() => JSON.stringify({ cat, topic, date, allDay, time, length, clientId, note }));
  const dirty = JSON.stringify({ cat, topic, date, allDay, time, length, clientId, note }) !== initial;
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
    if (!e && !customLength) setLength(PRESET[id]?.length ?? 60);
    try {
      window.localStorage.setItem(LAST_CAT_KEY, id);
    } catch {}
  };
  const save = async () => {
    if (!ok || saving) return;
    setSaving(true);
    setError(null);
    const title = topic.trim() || suggested || "";
    // The time is in this browser's timezone, as every time on the Calendar reads.
    const v = { date, time: allDay ? "" : time, tz: allDay ? null : browserZone(), durationMinutes: length, allDay, topic: title, clientId, category: cat, note: note.trim() };
    try {
      if (e) await updateCalendarEntryAction(e.id, v);
      else await addCalendarEntryAction(v);
      router.refresh();
      toast.success(e ? `${title} · saved` : `${title} · added`);
      onDone();
    } catch {
      setError("That didn’t save. Try again.");
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
  const tryClose = () => {
    if (dirty) setDiscarding(true);
    else onDone();
  };
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

  return (
    <DialogContent
      className="cal-entry"
      style={{ "--c": ink, "--rgb": rgb } as React.CSSProperties}
      aria-describedby={undefined}
      onPointerDownOutside={(ev) => {
        ev.preventDefault();
        tryClose();
      }}
      onEscapeKeyDown={(ev) => {
        ev.preventDefault();
        tryClose();
      }}
    >
      <span className="cal-entry-glow" aria-hidden="true" />
      <span className="cal-entry-wash" aria-hidden="true" />
      <div className="cal-entry-body">
        <header className="cal-entry-head">
          <div className="cal-entry-head-text">
            <div className="cal-entry-title-row">
              <DialogTitle className="cal-entry-title">{e ? "Edit entry" : "New entry"}</DialogTitle>
              <span className="cal-entry-pill">
                <CatIcon d={iconOf(cat)} size={11} stroke={2.4} />
                {current?.label}
              </span>
            </div>
            <DialogDescription className="cal-entry-sub">
              {date ? longDate(date) : "No day yet"}
              {client && (
                <>
                  {" · "}
                  <Link href={`/admin/redesign/meetings?client=${client.id}`} className="cal-entry-link">
                    Open {first(client.name)}&rsquo;s meetings
                  </Link>
                </>
              )}
            </DialogDescription>
          </div>
          <button type="button" className="cal-entry-x" onClick={tryClose} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {/* Category tiles, three a row, each in its own colour; the picked one solid. Other is grey. */}
        <div className="cal-entry-tiles" role="radiogroup" aria-label="Category">
          {cats.map((c) => {
            const cInk = paletteOf(c.color).ink;
            const on = c.id === cat;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={on} className={`cal-entry-tile${on ? " on" : ""}${c.color === "grey" ? " other" : ""}`} style={{ "--tc": cInk, "--trgb": hexRgb(cInk) } as React.CSSProperties} onClick={() => pickCat(c.id)}>
                <span className="cal-entry-disc">
                  <CatIcon d={iconOf(c.id)} size={22} stroke={2} />
                </span>
                {c.label}
              </button>
            );
          })}
        </div>

        {/* What */}
        <label className="cal-entry-field">
          <span className="cal-entry-label">What</span>
          <span className={`cal-entry-what${topic.trim() ? " ring" : ""}`}>
            <CatIcon d={iconOf(cat)} size={16} stroke={2} />
            <input ref={titleRef} value={topic} onChange={(x) => setTopic(x.target.value)} placeholder={suggested ?? placeholder} maxLength={80} autoFocus={!e} aria-label="What" />
          </span>
        </label>
        {/* With, on every category (14 Oct): the pop-up keeps one height, so switching tiles never makes it jump. */}
        <div className="cal-entry-field">
          <span className="cal-entry-label">With</span>
          {client && !picking ? (
            <div className="cal-entry-client" style={client.reason ? ({ "--rc": client.reason.color } as React.CSSProperties) : undefined}>
              <span className="cal-entry-avatar">
                {client.avatarPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
                  <img src={client.avatarPath} alt="" />
                ) : (
                  client.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="cal-entry-client-text">
                <b>{client.name}</b>
                <small className={client.reason ? "reason" : ""}>{client.reason ? client.reason.text : "All good"}</small>
              </span>
              <button type="button" className="cal-entry-change" onClick={() => setPicking(true)}>
                Change
              </button>
            </div>
          ) : picking ? (
            /* The list floats over the pop-up (a portal), so the pop-up keeps its size; a click anywhere else closes it. Modal: its own scroll lock, else the dialog's swallows the wheel. */
            <PopoverPrimitive.Root open modal onOpenChange={(o) => !o && (setPicking(false), setClientQ(""))}>
              <PopoverPrimitive.Anchor asChild>
                <span className="cal-entry-what ring">
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
                <PopoverPrimitive.Content align="start" sideOffset={6} className="cal-entry-drop" role="listbox" onOpenAutoFocus={(ev) => ev.preventDefault()} onCloseAutoFocus={(ev) => ev.preventDefault()}>
                  {clientId != null && (
                    <button type="button" role="option" aria-selected={false} className="cal-entry-opt" onClick={() => (setClientId(null), setPicking(false))}>
                      <span className="cal-entry-avatar none">–</span>
                      <span className="cal-entry-client-text">
                        <b>Just you</b>
                        <small>no client</small>
                      </span>
                    </button>
                  )}
                  {sortedClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={c.id === clientId}
                      className="cal-entry-opt"
                      style={c.reason ? ({ "--rc": c.reason.color } as React.CSSProperties) : undefined}
                      onClick={() => {
                        setClientId(c.id);
                        setPicking(false);
                        setClientQ("");
                      }}
                    >
                      <span className="cal-entry-avatar">
                        {c.avatarPath ? (
                          // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
                          <img src={c.avatarPath} alt="" />
                        ) : (
                          c.name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="cal-entry-client-text">
                        <b>{c.name}</b>
                        <small className={c.reason ? "reason" : ""}>{c.reason ? c.reason.text : "All good"}</small>
                      </span>
                    </button>
                  ))}
                  {sortedClients.length === 0 && <p className="cal-entry-none">No client by that name.</p>}
                </PopoverPrimitive.Content>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          ) : (
            <button type="button" className="cal-entry-pickbtn" onClick={() => setPicking(true)}>
              <SearchIcon />
              Pick a client · optional
            </button>
          )}
          {e && client && <small className="cal-entry-faint">{first(client.name)} sees this in their app.</small>}
        </div>

        {/* When */}
        <div className="cal-entry-field">
          <div className="cal-entry-when-head">
            <span className="cal-entry-label">When</span>
            <span className="cal-entry-seg" role="radiogroup" aria-label="Timed or all day">
              <button type="button" role="radio" aria-checked={!allDay} className={allDay ? "" : "on"} onClick={() => setAllDay(false)}>
                Timed
              </button>
              <button type="button" role="radio" aria-checked={allDay} className={allDay ? "on" : ""} onClick={() => setAllDay(true)}>
                All day
              </button>
            </span>
          </div>
          <div className="cal-entry-boxes">
            <span className="cal-entry-box">
              <span className="cal-entry-box-head">Day</span>
              <DatePick value={date} onChange={setDate} label={`Day, ${date ? longDate(date) : "none"}`} className="cal-entry-daypick" />
              <span className="cal-entry-box-val" aria-hidden="true">
                {date ? shortDate(date) : "Pick a day"}
              </span>
            </span>
            {allDay ? (
              <>
                <span className="cal-entry-box off" aria-hidden="true">
                  <span className="cal-entry-box-head">Starts</span>
                  <span className="cal-entry-box-val">All day</span>
                </span>
                <span className="cal-entry-box ends off" aria-hidden="true">
                  <span className="cal-entry-box-head">Ends</span>
                  <span className="cal-entry-box-val">—</span>
                </span>
              </>
            ) : (
              <>
                <PopoverPrimitive.Root open={timeOpen} modal onOpenChange={setTimeOpen}>
                  <PopoverPrimitive.Trigger className="cal-entry-box" aria-label={`Starts, ${time}`}>
                    <span className="cal-entry-box-head">Starts</span>
                    <span className="cal-entry-box-val">{time}</span>
                  </PopoverPrimitive.Trigger>
                  <PopoverPrimitive.Portal>
                    <PopoverPrimitive.Content align="start" sideOffset={6} className="pb-menu cal-entry-times">
                      <input
                        className="cal-entry-input small"
                        value={timeTyped}
                        onChange={(x) => setTimeTyped(x.target.value)}
                        placeholder="Type a time, e.g. 1530"
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
                      <div className="cal-entry-timelist">
                        {SLOTS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={`cal-entry-time${t === time ? " on" : ""}`}
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
                <span className="cal-entry-box ends" aria-live="polite">
                  <span className="cal-entry-box-head">Ends</span>
                  {customLength ? (
                    <input
                      className="cal-entry-box-val input"
                      type="time"
                      step={300}
                      value={hhmm(endMin)}
                      aria-label="Ends"
                      onChange={(x) => {
                        const m = toMin(x.target.value) - toMin(time);
                        if (m > 0) setLength(m);
                      }}
                    />
                  ) : (
                    <span className="cal-entry-box-val">{hhmm(endMin)}</span>
                  )}
                </span>
              </>
            )}
          </div>
          {/* All day keeps the rows (14 Oct): the boxes read All day and the lengths go quiet, so the pop-up never changes size. */}
          <div className={`cal-entry-chips${allDay ? " off" : ""}`} role="radiogroup" aria-label="Length" aria-disabled={allDay}>
            {LENGTHS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                disabled={allDay}
                aria-checked={!allDay && !customLength && length === m}
                className={`cal-entry-chip${!allDay && !customLength && length === m ? " on" : ""}`}
                onClick={() => {
                  setLength(m);
                  setCustomLength(false);
                }}
              >
                {lengthLabel(m)}
              </button>
            ))}
            <button type="button" role="radio" disabled={allDay} aria-checked={!allDay && customLength} className={`cal-entry-chip${!allDay && customLength ? " on" : ""}`} onClick={() => setCustomLength(true)}>
              Custom
            </button>
          </div>
          {/* Always a line, so an overlap appearing never moves the pop-up. */}
          <small className="cal-entry-overlap">{overlap ?? "\u00a0"}</small>
        </div>

        {/* Note */}
        <label className="cal-entry-field">
          <span className="cal-entry-label">Note</span>
          <textarea className="cal-entry-note" value={note} onChange={(x) => setNote(x.target.value)} placeholder="What to bring up, what to prepare…" maxLength={2000} rows={3} />
        </label>
        {error && <p className="cal-entry-error">{error}</p>}
      </div>

      <footer className="cal-entry-foot">
        {e &&
          (removing ? (
            <span className="cal-entry-confirm">
              Remove entry?
              <button type="button" className="cal-entry-danger" onClick={() => void remove()} disabled={saving}>
                Yes, remove
              </button>
              <button type="button" className="cal-entry-cancel" onClick={() => setRemoving(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="cal-entry-remove" onClick={() => setRemoving(true)}>
              <TrashIcon /> Remove
            </button>
          ))}
        <span className="cal-entry-spacer" />
        {discarding ? (
          <span className="cal-entry-confirm">
            Discard changes?
            <button type="button" className="cal-entry-danger" onClick={onDone}>
              Discard
            </button>
            <button type="button" className="cal-entry-cancel" onClick={() => setDiscarding(false)}>
              Keep editing
            </button>
          </span>
        ) : (
          <>
            <button type="button" className="cal-entry-cancel" onClick={tryClose}>
              Cancel
            </button>
            <button type="button" className="cal-entry-save" disabled={!ok || saving} aria-disabled={!ok || saving} onClick={() => void save()}>
              {saving ? <span className="cal-entry-spin" aria-hidden="true" /> : null}
              {e ? "Save" : "Add"}
            </button>
          </>
        )}
      </footer>
    </DialogContent>
  );
}
