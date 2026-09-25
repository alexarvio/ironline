"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addCalendarCategoryAction, addCalendarEntryAction, deleteEventCategoryAction, removeCalendarEntryAction, updateCalendarEntryAction, updateEventCategoryAction } from "../../../lib/actions";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { Switch } from "../../../components/ui/form";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import DatePick from "../DatePick";
import Picker from "../Picker";
import { PALETTE, entryColors, paletteOf, type Category } from "../palette";

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
const LENGTHS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const lengthLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);
const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

type Open = { entry: CalEntry | null; date: string; time: string };

export default function CalendarDay({ date, entries, categories, clients }: { date: string; entries: CalEntry[]; categories: Category[]; clients: { id: number; name: string }[] }) {
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
          <button type="button" className="cdg-add" onClick={() => setDlg({ entry: null, date, time: "09:00" })}>
            <PlusIcon /> Add
          </button>
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
        {dlg && <EntryDialog key={`${dlg.entry?.id ?? "new"}:${dlg.time}`} open={dlg} cats={categories} clients={clients} onDone={() => setDlg(null)} />}
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

// ---- Add or change one entry, laid out like the New client dialog: a tinted
// head, hairline rows two to a line, what is still needed at its foot.
function EntryDialog({ open, cats, clients, onDone }: { open: Open; cats: Category[]; clients: { id: number; name: string }[]; onDone: () => void }) {
  const router = useRouter();
  const [, start] = useTransition();
  const e = open.entry;
  const [topic, setTopic] = useState(e?.topic ?? "");
  const [date, setDate] = useState(open.date);
  const [allDay, setAllDay] = useState(e?.allDay ?? false);
  const [time, setTime] = useState(e?.time || open.time);
  const [length, setLength] = useState(String(e?.durationMinutes ?? 60));
  const [client, setClient] = useState(e?.clientId != null ? String(e.clientId) : "");
  const [cat, setCat] = useState<string | null>(e ? e.category : null);
  const [catTouched, setCatTouched] = useState(!!e);
  const [note, setNote] = useState(e?.note ?? "");
  const [catEdit, setCatEdit] = useState<{ id: string | null; label: string; color: string } | null>(null);

  const usedColors = new Set(cats.map((c) => c.color));
  const freeColor = PALETTE.find((p) => !usedColors.has(p.id))?.id ?? PALETTE[0].id;
  const catOk = !!catEdit && catEdit.label.trim().length > 0 && !cats.some((c) => c.id !== catEdit.id && c.label.trim().toLowerCase() === catEdit.label.trim().toLowerCase());
  const current = cat ? cats.find((c) => c.id === cat) ?? null : null;

  const act = (fn: () => Promise<unknown>, said: string) =>
    start(async () => {
      await fn();
      router.refresh();
      toast.success(said);
    });

  const saveCat = async () => {
    if (!catEdit || !catOk) return;
    const draft = catEdit;
    setCatEdit(null);
    if (draft.id) act(() => updateEventCategoryAction(draft.id!, draft.label.trim(), draft.color), `Category "${draft.label.trim()}" changed`);
    else {
      const id = await addCalendarCategoryAction(draft.label.trim(), draft.color);
      router.refresh();
      if (id) {
        setCat(id);
        setCatTouched(true);
      }
    }
  };

  const lengths = LENGTHS.includes(Number(length)) ? LENGTHS : [...LENGTHS, Number(length)].sort((a, b) => a - b);
  const missing = [!date && "a day", !allDay && !time && "a time", !topic.trim() && !client && "what it is"].filter(Boolean) as string[];
  const ok = missing.length === 0;
  const clientName = clients.find((c) => String(c.id) === client)?.name;

  const save = () => {
    if (!ok) return;
    const v = { date, time: allDay ? "" : time, durationMinutes: Number(length) || 60, allDay, topic: topic.trim(), clientId: client ? Number(client) : null, category: cat, note: note.trim() };
    onDone();
    const label = topic.trim() || clientName || "Entry";
    act(() => (e ? updateCalendarEntryAction(e.id, v) : addCalendarEntryAction(v)), e ? `${label} · saved` : `${label} · added`);
  };

  return (
    <DialogContent className="cal-dlg" aria-describedby={undefined}>
      <header className="cal-dlg-head">
        <div>
          <DialogTitle className="cal-dlg-title">{e ? "Entry" : "New entry"}</DialogTitle>
          <DialogDescription className="cal-dlg-sub">
            {date ? longDate(date) : "No day yet"}
            {e?.clientId != null && (
              <>
                {" · "}
                <Link href={`/admin/redesign/meetings?client=${e.clientId}`} className="cal-dlg-link">
                  Open {e.clientName.split(" ")[0]}&rsquo;s meetings
                </Link>
              </>
            )}
          </DialogDescription>
        </div>
        <DialogClose className="cc-dialog-x" aria-label="Close">
          ×
        </DialogClose>
      </header>

      <div className="cal-dlg-body">
        <div className="nc-grid">
          <label className="nc-row full">
            <span className="nc-label">What</span>
            <span className="nc-control">
              <input className="nc-input" value={topic} onChange={(x) => setTopic(x.target.value)} placeholder="Check-in call, gym session, admin…" maxLength={120} autoFocus={!e} onKeyDown={(x) => x.key === "Enter" && save()} />
            </span>
          </label>

          <div className="nc-row">
            <span className="nc-label">Day</span>
            <span className="nc-control">
              <DatePick value={date} onChange={setDate} label="Day" className="cal-flat" />
            </span>
          </div>
          <label className="nc-row">
            <span className="nc-label">All day</span>
            <span className="nc-control cal-switch">
              <Switch checked={allDay} onCheckedChange={setAllDay} aria-label="All day" />
              <span>{allDay ? "Yes, no time" : "No"}</span>
            </span>
          </label>

          {!allDay && (
            <>
              <label className="nc-row">
                <span className="nc-label">Starts</span>
                <span className="nc-control">
                  <input className="nc-input" type="time" step={300} value={time} onChange={(x) => setTime(x.target.value)} />
                </span>
              </label>
              <div className="nc-row">
                <span className="nc-label">Length</span>
                <span className="nc-control">
                  <Picker value={length} onChange={setLength} label="Length" className="cal-flat" options={lengths.map((m) => ({ value: String(m), label: lengthLabel(m), hint: time ? `until ${hhmm(toMin(time) + m)}` : undefined }))} />
                </span>
              </div>
            </>
          )}

          <div className="nc-row full">
            <span className="nc-label">With</span>
            <span className="nc-control">
              <Picker
                value={client}
                onChange={(v) => {
                  setClient(v);
                  if (!catTouched) setCat(v ? "call" : null);
                }}
                label="With"
                className="cal-flat"
                options={[{ value: "", label: "Just you", hint: "no client" }, ...clients.map((c) => ({ value: String(c.id), label: c.name }))]}
              />
            </span>
          </div>

          <div className="nc-row full">
            <span className="nc-label">Category</span>
            <span className="nc-control cal-cats">
              {cats.map((x) => {
                const p = paletteOf(x.color);
                const on = cat === x.id;
                return (
                  <button
                    key={x.id}
                    type="button"
                    className={`rd-chip${on ? " on" : ""}`}
                    style={on ? { background: p.ink, borderColor: p.ink } : undefined}
                    onClick={() => {
                      setCat(on ? null : x.id);
                      setCatTouched(true);
                    }}
                    aria-pressed={on}
                  >
                    <i className="rq-cat-dot" style={{ background: on ? "#fff" : p.ink }} />
                    {x.label}
                  </button>
                );
              })}
              <button type="button" className="rd-chip alt" onClick={() => setCatEdit({ id: null, label: "", color: freeColor })}>
                + New category
              </button>
            </span>
            {current?.custom && !catEdit && (
              <span className="rq-cat-own">
                <button type="button" className="rd-ex-btn" onClick={() => setCatEdit({ id: current.id, label: current.label, color: current.color })}>
                  Rename or recolour
                </button>
                <button
                  type="button"
                  className="rd-ex-btn danger"
                  onClick={() => {
                    setCat(null);
                    act(() => deleteEventCategoryAction(current.id), "Category removed · its entries go grey");
                  }}
                >
                  Remove
                </button>
              </span>
            )}
            {catEdit && (
              <div className="rq-cat-edit">
                <input
                  className="rd-input"
                  value={catEdit.label}
                  onChange={(x) => setCatEdit({ ...catEdit, label: x.target.value })}
                  onKeyDown={(x) => {
                    if (x.key === "Enter") {
                      x.preventDefault();
                      saveCat();
                    }
                  }}
                  placeholder="Name it: Content, Sales calls, Family…"
                  maxLength={24}
                  autoFocus
                  aria-label="Category name"
                />
                <span className="rq-cat-colors" role="radiogroup" aria-label="Colour">
                  {PALETTE.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={catEdit.color === p.id} className={`rq-cat-color${catEdit.color === p.id ? " on" : ""}`} style={{ background: p.ink }} onClick={() => setCatEdit({ ...catEdit, color: p.id })} aria-label={p.id} />
                  ))}
                </span>
                <span className="rq-cat-edit-actions">
                  <button type="button" className="rd-btn" onClick={() => setCatEdit(null)}>
                    Cancel
                  </button>
                  <button type="button" className="rd-btn primary" disabled={!catOk} onClick={saveCat}>
                    {catEdit.id ? "Save" : "Add"}
                  </button>
                </span>
              </div>
            )}
          </div>

          <label className="nc-row full">
            <span className="nc-label">
              Note <span className="cal-aside">only you see it</span>
            </span>
            <span className="nc-control">
              <textarea className="nc-input cal-note" rows={3} value={note} onChange={(x) => setNote(x.target.value)} placeholder="What to bring up, what to prepare…" maxLength={2000} />
            </span>
          </label>
        </div>
      </div>

      <footer className="cal-dlg-foot">
        {e && (
          <button
            type="button"
            className="rd-btn danger"
            onClick={() => {
              onDone();
              act(() => removeCalendarEntryAction(e.id), "Removed");
            }}
          >
            <TrashIcon /> Remove
          </button>
        )}
        <span className={`cal-dlg-status${ok ? "" : " bad"}`}>{ok ? "" : `Still needed: ${missing.join(", ")}`}</span>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!ok} onClick={save}>
          {e ? "Save" : "Add"}
        </button>
      </footer>
    </DialogContent>
  );
}
