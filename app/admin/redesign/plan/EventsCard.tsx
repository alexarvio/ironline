"use client";

import Pager from "../Pager";
import { repeatWords, WEEKDAY_LETTERS, isoWeekday } from "../../../lib/eventRepeat";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addClientEventAction, deleteClientEventAction, updateClientEventAction } from "../../../lib/actions";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { PlusIcon } from "../../../components/icons";
import { MonthRange } from "../MonthRange";
import { AddCells, chromeOf, EmptyLane, eventIsPast, eventLanes, EventMark, eventPlace, gridFor, LANE, LaneRow, rgbOf, standingParts, Timeline, type Category, type PlanEvent } from "./timelineParts";
import DateText from "../DateText";
import { dayMonth, logDate, logDateWidth } from "../../../lib/dayMonth";
import { EVENT_TYPES, eventTypeOf, isEventTypeId } from "../../../lib/eventTypes";
import { SepJoin } from "../Sep";
import { Fold } from "../Fold";

// The New event dialog after the client's sheet and the phase dialog (10 Oct):
// a category pill in the title, category tiles with icons, the dates as pills.
const CUSTOM_ICON = "M20 12.5 12.5 20a1.5 1.5 0 0 1-2.1 0L4 13.6V4h9.6l6.4 6.4a1.5 1.5 0 0 1 0 2.1zM8 8h.01";
const iconOf = (id: string | null) => (isEventTypeId(id) ? eventTypeOf(id) : null);
/** The arrow between two dates: the pop-up's Starts → Ends, and the log's 14/10 → 5/11 (21 Oct, Alex). */
function RangeArrow() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
export function KindIcon({ id, size = 20 }: { id: string | null; size?: number }) {
  const t = iconOf(id);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {t?.fill && <path d={t.fill} fill="currentColor" stroke="none" opacity={0.35} />}
      <path d={t ? t.icon : CUSTOM_ICON} />
    </svg>
  );
}

// Events on the plan: what happens in the client's life that the plan has to
// live with, on the same week grid as the phases, under the same "now" line.
// A stretch (a trip, a holiday, a wedding weekend) is a bar; a moment (started
// creatine, a car accident) is a pin. As the weeks slide under the line, a
// coming event walks towards it; a past one slides off to the left, so the
// log under the grid keeps every event, newest first, for looking back.
// Real, not a draft: events and the coach's own categories save through
// the actions in lib/actions.ts and come back from the loader.

/** An events lane is a phase's track (21 Oct, Alex: the same size); the lanes, the bars and the pins are drawn in timelineParts.tsx. */
export { LANE as EV_LANE, chromeOf, rgbOf, standingParts };
export type { Category, PlanEvent };

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return isoOf(x);
};
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);

export type EventsCardProps = {
  clientId: number;
  events: PlanEvent[];
  categories: Category[];
  today: string;
  thisWeek: string;
  /** How far through this week it is, 0 to 1, from the server so both renders agree. */
  intoWeek: number;
  /** The 3 / 6 / 9 / 12 month choices. The card keeps its own choice (10 Oct), apart from the phases'. */
  windows: readonly { months: number; weeks: number }[];
  /** Told when its saves start and end, for the one status beside the plan's title. */
  onSaving?: (busy: boolean) => void;
  /** The client's first name: an event they added says "From Alex" (21 Oct, Alex), not "From client". */
  firstName?: string;
};
const EV_WIN_KEY = "rq-events-window";

export default function EventsCard({ clientId, events: serverEvents, categories: cats, today, thisWeek, intoWeek, windows, onSaving, firstName }: EventsCardProps) {
  const router = useRouter();
  // What is on screen lives here, so a move or an edit shows the moment it is saved (20 Oct, Alex: a dragged trip
  // jumped back to its old length until the save came back). The page's re-read replaces it whenever its content changes.
  const serverKey = JSON.stringify(serverEvents);
  const [events, setEvents] = useState(serverEvents);
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setEvents(serverEvents);
  }
  // Its own window, remembered in the browser; the server renders 3 months and the saved choice follows after the first paint.
  const [win, setWinState] = useState(windows[0]?.weeks ?? 13);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(EV_WIN_KEY));
      if (windows.some((w) => w.weeks === saved)) Promise.resolve().then(() => setWinState(saved));
    } catch {}
  }, [windows]);
  const onWin = (w: number) => {
    setWinState(w);
    try {
      window.localStorage.setItem(EV_WIN_KEY, String(w));
    } catch {}
  };
  const grid = gridFor(win, thisWeek, intoWeek);
  const { count, weeks } = grid;
  const [busy, start] = useTransition();
  useEffect(() => {
    onSaving?.(busy);
  }, [busy, onSaving]);
  // Every save goes to the server and the page re-reads; the card holds no copy.
  const act = (fn: () => Promise<unknown>, said?: string) =>
    start(async () => {
      await fn();
      router.refresh();
      if (said) toast.success(said);
    });
  const [dlg, setDlg] = useState<{ event: PlanEvent | null; /** A new one from an empty spot clicked: its day and its lane's kind. */ start?: string; kind?: string | null } | null>(null);
  // An empty spot on the grid is a way in (20 Oct, Alex): the day under the pointer in its week's column, the lane's kind.
  const addAt = (week: string, ev: React.MouseEvent<HTMLElement>, kind?: string | null) => {
    if (justDragged.current || drag) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const day = Math.max(0, Math.min(6, Math.floor(((ev.clientX - r.left) / Math.max(1, r.width)) * 7)));
    setDlg({ event: null, start: addDays(week, day), kind });
  };
  // Dragging on the grid (12 Oct), as the phases: a bar moves whole, or by
  // either edge; a pin moves. Nothing saves on its own: letting go opens a
  // dialog saying what changes, and Move saves it.
  type Drag = { id: number; edge: "start" | "end" | "move"; start: string; end: string; moved: boolean; origStart: string; origEnd: string; anchor: string | null };
  const [drag, setDrag] = useState<Drag | null>(null);
  const [moveDlg, setMoveDlg] = useState<{ id: number; start: string; end: string } | null>(null);
  const justDragged = useRef(false);
  // The log folds away under the grid; open, it is ten to a page.
  const [logOpen, setLogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const first = weeks[0];
  const totalDays = count * 7;

  // The dates an event is drawn at: the drag's while it is being dragged, the
  // dialog's while the move waits for a yes, else its own.
  const live = (e: PlanEvent) => {
    const d = drag?.id === e.id ? drag : moveDlg?.id === e.id ? moveDlg : null;
    return d ? { start: d.start, end: d.end } : { start: e.start, end: e.end };
  };
  // Where an event sits on the grid (eventPlace), at the dates it is drawn at.
  const place = (e: PlanEvent) => eventPlace(live(e), first, totalDays);
  // The day under the pointer, on the grid's first lanes (every row is as wide).
  const lanesRef = useRef<HTMLDivElement>(null);
  const dayAt = (clientX: number) => {
    const el = lanesRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return addDays(first, Math.max(0, Math.min(totalDays - 1, Math.floor(((clientX - r.left) / r.width) * totalDays))));
  };
  const beginDrag = (ev: React.PointerEvent, e: PlanEvent, edge: Drag["edge"]) => {
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    ev.preventDefault();
    ev.stopPropagation();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    setDrag({ id: e.id, edge, start: e.start, end: e.end, moved: false, origStart: e.start, origEnd: e.end, anchor: edge === "move" ? dayAt(ev.clientX) : null });
  };
  const moveDrag = (ev: React.PointerEvent) => {
    if (!drag) return;
    const day = dayAt(ev.clientX);
    if (!day) return;
    setDrag((d) => {
      if (!d) return d;
      let next = d;
      if (d.edge === "move" && d.anchor) {
        const delta = daysBetween(d.anchor, day);
        next = { ...d, start: addDays(d.origStart, delta), end: addDays(d.origEnd, delta) };
      } else if (d.edge === "start") next = { ...d, start: day <= d.end ? day : d.end };
      else next = { ...d, end: day >= d.start ? day : d.start };
      return { ...next, moved: d.moved || next.start !== d.start || next.end !== d.end };
    });
  };
  const endDrag = (ev: React.PointerEvent) => {
    if (!drag) return;
    (ev.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId);
    const d = drag;
    setDrag(null);
    if (d.moved) {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 300);
    }
    if (d.start === d.origStart && d.end === d.origEnd) return;
    setMoveDlg({ id: d.id, start: d.start, end: d.end });
  };
  // One row a category (10 Oct), only for the categories with something on the
  // grid, in the app's kind order; an event with no category rows last as
  // "Event". Within a row, overlapping events stack into lanes; a pin's label
  // needs room too (eventLanes).
  const onGrid = events.filter((e) => place(e).visible).sort((a, b) => (a.start < b.start ? -1 : 1));
  // A pin's label needs room to its right: measured against the grid, so
  // the reach is what the label takes on this screen, not a guess.
  const [gridPx, setGridPx] = useState(0);
  useEffect(() => {
    const el = lanesRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setGridPx(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dayPx = gridPx > 0 ? gridPx / totalDays : 9;
  const { groups, laneOf } = eventLanes(onGrid, cats, dayPx);

  // The log keeps only what is over (21 Oct, Alex): what is on or coming is on the grid above.
  // The latest ended first, so a supplement stopped last week sits above a trip that ended a month ago.
  const listed = events
    .filter((e) => e.end < today)
    .sort((a, b) => (a.end !== b.end ? (a.end > b.end ? -1 : 1) : a.start > b.start ? -1 : 1));
  const PAGE = 10;
  const pages = Math.max(1, Math.ceil(listed.length / PAGE));
  const at = Math.min(page, pages);
  const from = (at - 1) * PAGE;
  const onPage = listed.slice(from, from + PAGE);

  return (
    // As the Phases above (20 Oct, Alex): the heading on the page, the grid and its log in one white card.
    <section className="pln-section">
      <div className="rn-card-head">
        <h2>Events</h2>
        <div className="rq-ev-tools">
          <div className="rd-btn-group" role="group" aria-label="Time shown">
            {windows.map((w) => (
              <button key={w.weeks} type="button" className={win === w.weeks ? "on" : ""} aria-pressed={win === w.weeks} onClick={() => onWin(w.weeks)}>
                {w.months} months
              </button>
            ))}
          </div>
          <button type="button" className="rd-btn" onClick={() => setDlg({ event: null })}>
            <PlusIcon /> Add
          </button>
        </div>
      </div>

      <div className="pln-card">
      {/* The same grid as the phases (timelineParts.tsx): months, the Mondays, and a row of lanes an event kind. */}
      <Timeline grid={grid} minWidth={Math.round(win * 63)} weekNumbers={false}>
        {groups.length === 0 && (
          <LaneRow grid={grid} lanes={1} events gridRef={lanesRef}>
            <AddCells grid={grid} lanes={1} label={(w) => `New event in the week of ${dayMonth(w)}`} onAdd={(w, ev) => addAt(w, ev)} />
            <EmptyLane grid={grid} onAdd={() => setDlg({ event: null })} />
          </LaneRow>
        )}
        {groups.map((g, gi) => (
          <LaneRow key={g.id ?? "none"} grid={grid} lanes={g.laneCount} events icon={<KindIcon id={g.id} size={16} />} color={g.chrome.ink} label={g.chrome.label} gridRef={gi === 0 ? lanesRef : undefined} onDragMove={moveDrag} onDragEnd={endDrag}>
            <AddCells grid={grid} lanes={g.laneCount} label={(w) => `New ${g.chrome.label.toLowerCase()} in the week of ${dayMonth(w)}`} onAdd={(w, ev) => addAt(w, ev, g.id)} />
            {g.events.map((e) => (
              <EventMark
                key={e.id}
                e={e}
                at={live(e)}
                place={place(e)}
                lane={laneOf.get(e.id) ?? 0}
                today={today}
                cats={cats}
                // A past one has no handles: it can't be moved or stretched (a pin's edges are never drawn).
                drag={eventIsPast(e, today) ? undefined : { dragging: drag?.id === e.id, onBody: (ev) => beginDrag(ev, e, "move"), onStart: (ev) => beginDrag(ev, e, "start"), onEnd: (ev) => beginDrag(ev, e, "end") }}
                onOpen={() => {
                  if (justDragged.current || drag) return;
                  setDlg({ event: e });
                }}
              />
            ))}
          </LaneRow>
        ))}
      </Timeline>

      {/* ---- The log: the events that are over, nothing else (21 Oct, Alex). */}
      <div className={`rq-evlog${logOpen ? " open" : ""}`}>
        <div className="rq-evlog-head">
          <button type="button" className="rq-evlog-toggle" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen}>
            <span className="rd-eyebrow">Log</span>
            <Fold open={logOpen} />
          </button>
        </div>
        {!logOpen ? null : listed.length === 0 ? (
          <p className="rq-evlog-empty">None yet</p>
        ) : (
          // With more than a page, the rows keep a full page's height (21 Oct, Alex: the last page made the screen jump;
          // .rd-steady): a row is 43px with its hairline (the 22px kind pill and 10px either side), over 12px of room.
          // The date column only as wide as the log needs (21 Oct, Alex: too much empty room): a range's two dates, else one.
          <div
            className={`rd-rows${pages > 1 ? " rd-steady" : ""}`}
            style={{ "--ev-when": listed.some((e) => e.repeat || e.start !== e.end) ? "188px" : `${logDateWidth(listed.map((e) => e.start))}px`, ...(pages > 1 ? { "--log-rows": PAGE, "--log-row": "43px", "--log-head": "12px" } : {}) } as React.CSSProperties}
          >
            {onPage.map((e) => {
              const k = chromeOf(cats, e.kind);
              return (
                <div key={e.id} className="rd-row">
                  <button type="button" className="rd-row-main rq-evrow" onClick={() => setDlg({ event: e })}>
                    <span className="rq-evrow-when">
                      {/* The date first, as every log (21 Oct, Alex: logDate); two get room between them (20 Oct): a faint arrow with air either side. */}
                      <b>
                        <span className="rd-logdate">{logDate(e.start)}</span>
                        {(e.repeat || e.start !== e.end) && (
                          <>
                            <i aria-hidden="true">
                              <RangeArrow />
                            </i>
                            <span className="rd-logdate">{e.repeat && !e.repeat.until ? "no end" : logDate(e.end)}</span>
                          </>
                        )}
                      </b>
                    </span>
                    {/* Then the title, its repeat days and its note running on right after it (21 Oct, Alex), so every row is
                        one line high (the log keeps one height); the kind after them. */}
                    <span className="rq-evrow-main">
                      <b>{e.title}</b>
                      {e.byClient && <span className="rq-ev-by">From {firstName || "client"}</span>}
                      {(e.repeat || e.note) && (
                        <span className="rq-evrow-note">
                          <SepJoin parts={[e.repeat ? repeatWords(e.repeat, { until: false }) : null, e.note || null]} />
                        </span>
                      )}
                    </span>
                    <span className="rq-state" style={{ background: k.tint, color: k.ink }}>
                      {k.label}
                    </span>
                    <span className="rq-evrow-rel">
                      <SepJoin parts={standingParts(today, e)} />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      {/* The log's pager floats under the card, not in it (21 Oct, Alex). */}
      {logOpen && <Pager page={at} pages={pages} from={from} shown={onPage.length} total={listed.length} label="Log pages" onPage={setPage} />}

      {/* Let go after a drag: what changes, and a yes before it saves. */}
      <Dialog open={!!moveDlg} onOpenChange={(o) => !o && setMoveDlg(null)}>
        {moveDlg && events.find((e) => e.id === moveDlg.id) && (
          <MoveEventDialog
            event={events.find((e) => e.id === moveDlg.id)!}
            start={moveDlg.start}
            end={moveDlg.end}
            cats={cats}
            onCancel={() => setMoveDlg(null)}
            onSave={() => {
              const e = events.find((x) => x.id === moveDlg.id)!;
              const { start, end } = moveDlg;
              // On screen at its new dates at once; the save follows (20 Oct, Alex: it jumped back for a second).
              setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, start, end } : x)));
              setMoveDlg(null);
              act(() => updateClientEventAction(clientId, e.id, { kind: e.kind, title: e.title, start, end, note: e.note }), `${e.title}: ${start === end ? dayMonth(start) : `${dayMonth(start)} → ${dayMonth(end)}`}`);
            }}
          />
        )}
      </Dialog>

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        {dlg && (
          <EventDialog
            today={today}
            event={dlg.event}
            cats={cats}
            firstName={firstName}
            initialStart={dlg.start}
            initialKind={dlg.kind}
            readOnly={!!dlg.event && eventIsPast(dlg.event, today)}
            onSave={(v) => {
              const was = dlg.event;
              // An edit shows at once, as a move does; a new one comes with the page's re-read (it needs its id).
              if (was) setEvents((prev) => prev.map((x) => (x.id === was.id ? { ...x, ...v } : x)));
              setDlg(null);
              act(() => (was ? updateClientEventAction(clientId, was.id, v) : addClientEventAction(clientId, v)), `Event: ${v.title}`);
            }}
            onDelete={() => {
              const was = dlg.event!;
              setEvents((prev) => prev.filter((x) => x.id !== was.id));
              setDlg(null);
              act(() => deleteClientEventAction(clientId, was.id), "Event removed");
            }}
          />
        )}
      </Dialog>
    </section>
  );
}

// ---- One event: what kind, what to call it, a moment or a stretch, and a note.
/** Also opened from the Phases overview (14 Oct), on the day clicked there. */
export function EventDialog({ today, event, cats, firstName, initialStart, initialKind, readOnly = false, onSave, onDelete }: { today: string; event: PlanEvent | null; cats: Category[]; /** For "From Alex" on an event the client added. */ firstName?: string; /** A new event opens on this day. */ initialStart?: string; /** A new event from a lane: that lane's kind (null for "Event"). */ initialKind?: string | null; /** A past event: shown, not changed (20 Oct, Alex). */ readOnly?: boolean; onSave: (v: Omit<PlanEvent, "id">) => void; onDelete: () => void }) {
  // The six types the client's sheet has (10 Oct); the coach's own categories went, so both sides speak the same six.
  // A new event starts on Trip, the first tile (14 Oct), or on the kind of the lane it was clicked on (20 Oct).
  const [kind, setKind] = useState<string | null>(event ? event.kind : initialKind !== undefined ? initialKind : "trip");
  const [title, setTitle] = useState(event?.title ?? "");
  // Repeats (19 Oct, Alex: sports twice a week): on these weekdays from its start, until a day or with no end.
  const [shape, setShape] = useState<"event" | "period" | "repeat">(event?.repeat ? "repeat" : event ? (event.start === event.end ? "event" : "period") : "event");
  const [start, setStart] = useState(event?.start ?? initialStart ?? today);
  const [end, setEnd] = useState(event?.end ?? addDays(initialStart ?? today, 6));
  const [note, setNote] = useState(event?.note ?? "");
  const [days, setDays] = useState<number[]>(event?.repeat?.days ?? [isoWeekday(event?.start ?? initialStart ?? today)]);
  const [until, setUntil] = useState<string | null>(event?.repeat?.until ?? null);
  // A long note grows down to the month's last row, never further, so the pop-up keeps its height;
  // only past that does it scroll (21 Oct, Alex). Stacked on a narrow screen, it stops at 160px.
  const colsRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const ta = noteRef.current;
    const month = colsRef.current?.firstElementChild as HTMLElement | null;
    if (!ta || !month) return;
    ta.style.overflowY = "hidden";
    ta.style.height = "auto";
    const m = month.getBoundingClientRect();
    const t = ta.getBoundingClientRect();
    // Measured while the pop-up may still be zooming in: back to its own pixels.
    const k = m.height / (month.offsetHeight || 1) || 1;
    const room = t.top >= m.bottom ? 160 : (m.bottom - t.top) / k;
    const want = ta.scrollHeight + (ta.offsetHeight - ta.clientHeight);
    ta.style.height = `${Math.min(want, room)}px`;
    ta.style.overflowY = want > room ? "auto" : "hidden";
  }, [note, shape]);
  const toggleDay =(d: number) => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d].sort((a, b) => a - b)));
  const k = chromeOf(cats, kind);
  const endOk = shape === "event" || (shape === "repeat" ? until == null || until >= start : end >= start);
  // The calendar: which month shows, and which end a click sets (a period).
  const [cursor, setCursor] = useState(start.slice(0, 7));
  const [picking, setPicking] = useState<"start" | "end">("start");
  // Ink until a category is picked, then that category's colour (the calendar draws it from --npd-c; never navy).
  const cal = kind ? k : { tint: "rgba(20, 26, 36, 0.08)", ink: "#141a24", line: "#c9cfd8" };
  const calChrome = { band: cal.tint, edge: cal.ink, soft: cal.tint, line: cal.line, chipBg: cal.tint, chipInk: cal.ink, dashed: false };
  const pickAs = (which: "start" | "end", d: string) => {
    if (which === "start" || d < start) {
      setStart(d);
      if (end < d) setEnd(d);
      setPicking("end");
    } else {
      setEnd(d);
      setPicking("start");
    }
    setCursor(d.slice(0, 7));
  };
  const pick = (d: string) => {
    if (shape === "event") {
      setStart(d);
      setEnd(d);
      return;
    }
    if (shape === "repeat") {
      // The first click sets the start, the next the last day; before the start, a new start.
      if (picking === "start" || d < start) {
        setStart(d);
        if (until && until < d) setUntil(null);
        setPicking("end");
      } else {
        setUntil(d);
        setPicking("start");
      }
      setCursor(d.slice(0, 7));
      return;
    }
    pickAs(picking, d);
  };
  const ok = title.trim().length > 0 && !!start && endOk && (shape !== "repeat" || days.length > 0);
  const placeholder = isEventTypeId(kind) ? eventTypeOf(kind).placeholder : "What happened, or will";
  // Deleting asks first (20 Oct, Alex: nothing destructive on one click).
  const [confirming, setConfirming] = useState(false);
  // The category's colour on its tag and its range; ink until one is picked.
  const ink = kind ? k.ink : "#141a24";
  // Typed as well as picked (20 Oct, Alex: the dates couldn't be typed). A start past the end takes the end with it, and a repeat's last day goes, so the dates never cross.
  const typeStart = (d: string) => {
    setStart(d);
    if (end < d) setEnd(d);
    if (until && until < d) setUntil(null);
    setCursor(d.slice(0, 7));
  };
  const typeEnd = (d: string) => {
    setEnd(d);
    setCursor(d.slice(0, 7));
  };
  const typeUntil = (d: string) => {
    setUntil(d);
    setCursor(d.slice(0, 7));
  };

  if (confirming && event)
    return (
      <DialogContent className="dlh" role="alertdialog">
        <div className="dlh-head">
          <DialogTitle className="dlh-title">Delete {event.title}?</DialogTitle>
          <DialogClose className="dlh-x" aria-label="Close">
            ✕
          </DialogClose>
        </div>
        <DialogDescription className="dlh-what">This permanently deletes the event. It can&rsquo;t be undone.</DialogDescription>
        <div className="dlh-foot">
          <button type="button" className="dlh-cancel" onClick={() => setConfirming(false)} autoFocus>
            Cancel
          </button>
          <button type="button" className="dlh-delete" onClick={onDelete}>
            Delete
          </button>
        </div>
      </DialogContent>
    );

  // The phase pop-up's pattern (20 Oct, Alex): title and tags, the category as tiles, a clean line for the words,
  // the month on the left with the dates typed or picked on the right, Cancel in words and one black pill.
  return (
    <DialogContent className="npd" style={{ "--npd-c": ink, "--npd-rgb": rgbOf(ink) } as React.CSSProperties}>
      <div className="npd-head">
        <DialogTitle className="npd-title">{event ? event.title : "New event"}</DialogTitle>
        <span className="npd-tools">
          <DialogClose className="npd-x" aria-label="Close">
            ✕
          </DialogClose>
        </span>
      </div>
      <DialogDescription className="npd-tags">
        <span className="npd-track">
          <KindIcon id={kind} size={12} />
          {k.label}
        </span>
        {event?.byClient && <span className="npd-from">From {firstName || "client"}</span>}
        {readOnly && <span className="npd-from">Past</span>}
      </DialogDescription>

      {/* A past event is shown as it was and can't be changed (20 Oct, Alex): every field below is disabled. */}
      <fieldset className="npd-ro" disabled={readOnly}>
      <div className="npd-field">
        <span className="npd-label">Category</span>
        <div className="npd-tiles four" role="radiogroup" aria-label="Category">
          {EVENT_TYPES.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={kind === x.id} className={`npd-tile${kind === x.id ? " on" : ""}`} style={{ "--tc": x.color } as React.CSSProperties} onClick={() => setKind(kind === x.id ? null : x.id)}>
              <KindIcon id={x.id} size={18} />
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <label className="npd-field">
        <span className="npd-label">What&rsquo;s happening</span>
        <input className="npd-line" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} maxLength={80} autoFocus={!event} />
      </label>

      <div ref={colsRef} className="npd-cols">
        <MonthRange from={start} to={shape === "event" ? start : shape === "repeat" ? until ?? start : end} onPick={pick} chrome={calChrome} planned={[]} cursor={cursor} setCursor={setCursor} today={today} plain legend={null} />
        <div className="npd-side">
          <div className="npd-when">
            <span className="npd-label">When</span>
            <div className="npd-seg" role="group" aria-label="One day, a stretch, or repeating">
              <button type="button" className={shape === "event" ? "on" : ""} aria-pressed={shape === "event"} onClick={() => setShape("event")}>
                One day
              </button>
              <button type="button" className={shape === "period" ? "on" : ""} aria-pressed={shape === "period"} onClick={() => setShape("period")}>
                Range
              </button>
              <button type="button" className={shape === "repeat" ? "on" : ""} aria-pressed={shape === "repeat"} onClick={() => setShape("repeat")}>
                Repeats
              </button>
            </div>
          </div>
          <div className="npd-dates">
            {shape === "event" ? (
              <div className="npd-date arm">
                <span className="npd-date-head">Date</span>
                <DateText value={start} onChange={typeStart} label="Date" />
              </div>
            ) : (
              <>
                <div className={`npd-date${picking === "start" ? " arm" : ""}`} onClick={() => setPicking("start")}>
                  <span className="npd-date-head">Starts</span>
                  <DateText value={start} onChange={typeStart} label="Start date" onFocus={() => setPicking("start")} />
                </div>
                <span className="npd-arrow" aria-hidden="true">
                  <RangeArrow />
                </span>
                <div className={`npd-date${picking === "end" ? " arm" : ""}`} onClick={() => setPicking("end")}>
                  <span className="npd-date-head">{shape === "repeat" ? "Until" : "Ends"}</span>
                  {shape === "repeat" ? (
                    <DateText value={until ?? ""} min={start} onChange={typeUntil} label="Last day" placeholder="No end" onFocus={() => setPicking("end")} />
                  ) : (
                    <DateText value={end} min={start} onChange={typeEnd} label="End date" onFocus={() => setPicking("end")} />
                  )}
                </div>
              </>
            )}
          </div>
          {/* The note sits right under the dates (20 Oct, Alex); the repeat's days come in between only when it repeats.
              The month on the left stays the tallest thing, so the pop-up keeps its height in every shape. */}
          {shape === "repeat" && (
            <div className="npd-repeat">
              <div className="evr-days" role="group" aria-label="On these days">
                {WEEKDAY_LETTERS.map((l, i) => (
                  <button key={i} type="button" className={days.includes(i + 1) ? "on" : ""} aria-pressed={days.includes(i + 1)} aria-label={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]} onClick={() => toggleDay(i + 1)}>
                    {l}
                  </button>
                ))}
              </div>
              <p className="npd-repeat-says">
                <span>{days.length ? repeatWords({ days, until }) : ""}</span>
                {until && (
                  <button type="button" className="npd-act" onClick={() => setUntil(null)}>
                    No end
                  </button>
                )}
              </p>
            </div>
          )}
          <label className="npd-field">
            <span className="npd-label">Note</span>
            <textarea ref={noteRef} className="npd-line npd-grow" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      </div>
      </fieldset>

      <div className="npd-foot">
        {readOnly ? (
          <DialogClose className="npd-cancel">Close</DialogClose>
        ) : (
          <>
            {event && (
              <button type="button" className="npd-delete" onClick={() => setConfirming(true)}>
                Delete
              </button>
            )}
            <DialogClose className="npd-cancel">Cancel</DialogClose>
            <button type="button" className="npd-save" disabled={!ok} onClick={() => onSave({ kind, title: title.trim(), start, end: shape === "event" ? start : shape === "repeat" ? until ?? start : end, note: note.trim(), repeat: shape === "repeat" ? { days, until } : null })}>
              {event ? "Save" : "Add"}
            </button>
          </>
        )}
      </div>
    </DialogContent>
  );
}

// ---- After a drag: what moves, from what to what, and a yes before it saves.
function MoveEventDialog({ event: e, start, end, cats, onCancel, onSave }: { event: PlanEvent; start: string; end: string; cats: Category[]; onCancel: () => void; onSave: () => void }) {
  const k = chromeOf(cats, e.kind);
  const single = e.start === e.end;
  const len = (a: string, b: string) => `${daysBetween(a, b) + 1} day${daysBetween(a, b) === 0 ? "" : "s"}`;
  const rows = single
    ? [{ label: "Date", was: dayMonth(e.start), now: dayMonth(start) }]
    : [
        { label: "Start", was: dayMonth(e.start), now: dayMonth(start) },
        { label: "End", was: dayMonth(e.end), now: dayMonth(end) },
        { label: "Length", was: len(e.start, e.end), now: len(start, end) },
      ];
  // The phase's move pop-up, for an event (20 Oct, Alex): its category as a tinted tag, what it was struck through, the new value in its colour; no arrows, no sentences.
  return (
    <DialogContent className="dlh mvd" style={{ "--mv": k.ink, "--mv-rgb": rgbOf(k.ink) } as React.CSSProperties}>
      <div className="dlh-head">
        <DialogTitle className="dlh-title">Move {e.title}</DialogTitle>
        <button type="button" className="dlh-x" onClick={onCancel} aria-label="Close">
          ✕
        </button>
      </div>
      <DialogDescription className="mvd-tags">
        <span className="mvd-track">
          <KindIcon id={e.kind} size={12} />
          {k.label}
        </span>
      </DialogDescription>
      <div className="mvd-rows">
        {rows.map((r) => (
          <div key={r.label} className={`mvd-row${r.was === r.now ? " same" : ""}`}>
            <span className="mvd-label">{r.label}</span>
            {r.was === r.now ? (
              <span className="mvd-now">{r.now}</span>
            ) : (
              <>
                <s className="mvd-was" aria-label={`was ${r.was}`}>
                  {r.was}
                </s>
                <span className="mvd-now">{r.now}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="dlh-foot">
        <button type="button" className="dlh-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="dlh-go" onClick={onSave} autoFocus>
          Save
        </button>
      </div>
    </DialogContent>
  );
}
