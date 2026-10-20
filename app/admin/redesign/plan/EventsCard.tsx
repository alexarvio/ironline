"use client";

import Pager from "../Pager";
import { repeatWords, WEEKDAY_LETTERS, isoWeekday, type EventRepeat } from "../../../lib/eventRepeat";
import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addClientEventAction, deleteClientEventAction, updateClientEventAction } from "../../../lib/actions";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { ChevronDownIcon, PlusIcon } from "../../../components/icons";
import { gridFor, MonthRange } from "./PlanDraft";
import DateText from "../DateText";
import { dayMonth } from "../../../lib/dayMonth";
import { EVENT_TYPES, eventTypeOf, isEventTypeId } from "../../../lib/eventTypes";

// The New event dialog after the client's sheet and the phase dialog (10 Oct):
// a category pill in the title, category tiles with icons, the dates as pills.
const CUSTOM_ICON = "M20 12.5 12.5 20a1.5 1.5 0 0 1-2.1 0L4 13.6V4h9.6l6.4 6.4a1.5 1.5 0 0 1 0 2.1zM8 8h.01";
const iconOf = (id: string | null) => (isEventTypeId(id) ? eventTypeOf(id) : null);
const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};
function KindIcon({ id, size = 20 }: { id: string | null; size?: number }) {
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

/** kind is the category's id, and optional: an event can just be an event. */
export type PlanEvent = { id: number; kind: string | null; title: string; start: string; end: string; note: string; /** The client added it from their Home. */ byClient?: boolean; /** Comes back on these weekdays (19 Oct), lib/eventRepeat.ts. */ repeat?: EventRepeat | null };

export type Category = { id: string; label: string; color: string; custom: boolean };
const NONE = { tint: "#eceff3", ink: "#5b6474", line: "#c3c9d2" };
// The built-in four and the coach's own come from the loader (listEventCategories).
/** The app's six event types colour everything here (10 Oct): the same six the client's sheet has, in the same colours. Anything else is grey "Event". */
const chromeOf = (_cats: Category[], id: string | null) => {
  if (!isEventTypeId(id)) return { label: "Event", ...NONE };
  const t = eventTypeOf(id);
  return { label: t.label, tint: `rgba(${t.rgb}, 0.12)`, ink: t.color, line: `rgba(${t.rgb}, 0.45)` };
};

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return isoOf(x);
};
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
/** The timeline's week axis keeps the month's name; every other date in words is day/month (dayMonth). */
const axisDate = (d: string) => parse(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** "in 3 weeks", "in 5 days", "today", "2 days ago", "6 weeks ago". */
const relative = (today: string, d: string) => {
  const n = daysBetween(today, d);
  if (n === 0) return "today";
  const abs = Math.abs(n);
  const w = abs >= 14 ? `${Math.round(abs / 7)} weeks` : abs === 1 ? "1 day" : `${abs} days`;
  return n > 0 ? `in ${w}` : `${w} ago`;
};
/** The words on a bar or pin: where it stands against today. */
const standing = (today: string, e: PlanEvent) => {
  const single = e.start === e.end;
  // A timestamp is only ever "in 3 days", "today" or "2 days ago".
  if (single) return relative(today, e.start);
  if (today < e.start) return relative(today, e.start);
  if (today > e.end) return `ended ${relative(today, e.end)}`;
  // Repeating with no end (19 Oct): its stored end is only a horizon.
  if (e.repeat && !e.repeat.until) return "ongoing";
  const left = daysBetween(today, e.end);
  return left === 0 ? "last day" : `now · ${left} day${left === 1 ? "" : "s"} left`;
};

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
};
const EV_WIN_KEY = "rq-events-window";

export default function EventsCard({ clientId, events, categories: cats, today, thisWeek, intoWeek, windows }: EventsCardProps) {
  const router = useRouter();
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
  const { count, weeks, nowIdx, months, cols, nowLeft } = gridFor(win, thisWeek, intoWeek);
  const [, start] = useTransition();
  // Every save goes to the server and the page re-reads; the card holds no copy.
  const act = (fn: () => Promise<unknown>, said?: string) =>
    start(async () => {
      await fn();
      router.refresh();
      if (said) toast.success(said);
    });
  const [dlg, setDlg] = useState<{ event: PlanEvent | null } | null>(null);
  // Dragging on the grid (12 Oct), as the phases: a bar moves whole, or by
  // either edge; a pin moves. Nothing saves on its own: letting go opens a
  // dialog saying what changes, and Move saves it.
  type Drag = { id: number; edge: "start" | "end" | "move"; start: string; end: string; moved: boolean; origStart: string; origEnd: string; anchor: string | null };
  const [drag, setDrag] = useState<Drag | null>(null);
  const [moveDlg, setMoveDlg] = useState<{ id: number; start: string; end: string } | null>(null);
  const justDragged = useRef(false);
  const [show, setShow] = useState<"coming" | "past" | "all">("all");
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
  // Where an event sits on the grid, as fractions of its width; the grid is
  // week columns, so a day is a seventh of one.
  const place = (e: PlanEvent) => {
    const { start, end } = live(e);
    const a = daysBetween(first, start);
    const b = daysBetween(first, end) + 1;
    return { left: (Math.max(0, a) / totalDays) * 100, width: (Math.max(0.6, Math.min(totalDays, b) - Math.max(0, a)) / totalDays) * 100, visible: b > 0 && a < totalDays };
  };
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
  // grid, in the coach's category order; an event with no category rows last
  // as "Event". Within a row, overlapping events stack into lanes; a pin's
  // label needs room too.
  const onGrid = events.filter((e) => place(e).visible).sort((a, b) => (a.start < b.start ? -1 : 1));
  const laneOf = new Map<number, number>();
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
  const labelDays = (title: string) => Math.ceil((title.length * 6.6 + 28) / dayPx);
  const reach = (e: PlanEvent) => (e.start === e.end ? addDays(e.start, labelDays(e.title)) : e.end);
  const order = [...EVENT_TYPES.map((t) => t.id), null];
  const groups = order
    .map((id) => ({ id, chrome: chromeOf(cats, id), events: onGrid.filter((e) => (isEventTypeId(e.kind) ? e.kind : null) === id) }))
    .filter((g) => g.events.length > 0)
    .map((g) => {
      const lanes: PlanEvent[][] = [];
      g.events.forEach((e) => {
        let li = lanes.findIndex((l) => l.every((q) => reach(q) < e.start || q.start > reach(e)));
        if (li < 0) {
          lanes.push([]);
          li = lanes.length - 1;
        }
        lanes[li].push(e);
        laneOf.set(e.id, li);
      });
      return { ...g, laneCount: Math.max(1, lanes.length) };
    });

  // The log: every event, newest first; past ones are what slid off the grid.
  const sorted = [...events].sort((a, b) => (a.start > b.start ? -1 : 1));
  const listed = sorted.filter((e) => (show === "all" ? true : show === "coming" ? e.end >= today : e.end < today));
  const PAGE = 10;
  const pages = Math.max(1, Math.ceil(listed.length / PAGE));
  const at = Math.min(page, pages);
  const from = (at - 1) * PAGE;
  const onPage = listed.slice(from, from + PAGE);
  const pick = (id: typeof show) => {
    setShow(id);
    setPage(1);
  };

  return (
    <section className="rd-session open rn-card">
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

      {/* The same grid as the phases: months, weeks, and the events on one row of lanes. */}
      <div className="rq-tl-scroll">
        <div className="rq-tl" style={{ minWidth: Math.round(win * 63) }}>
          <div className="rq-tl-row">
            <span />
            <div className="rq-tl-clip">
              <div className="rq-tl-grid" style={cols}>
                {months.map((m) => (
                  <span key={m.start} className="rq-month" style={{ gridColumn: `${m.start + 1} / span ${m.span}` }}>
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="rq-tl-body">
            {nowLeft && <span className="rq-now" style={{ left: nowLeft }} title="Now" />}
            <div className="rq-tl-row">
              <span />
              <div className="rq-tl-clip">
                <div className="rq-tl-grid" style={cols}>
                  {weeks.map((w, i) => (
                    <span key={w} className={`rq-week${i === nowIdx ? " now" : ""}`}>
                      <small>{axisDate(w)}</small>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {groups.length === 0 && (
              <div className="rq-tl-row">
                <div className="rq-tl-label" />
                <div className="rq-tl-clip">
                  <div ref={lanesRef} className="rq-tl-grid rq-lanes rq-evlanes" style={{ ...cols, gridTemplateRows: "repeat(1, 40px)" }}>
                    {weeks.map((w, i) => (
                      <span key={w} className="rq-cell" style={{ gridColumn: i + 1, gridRow: "1 / span 1" }} />
                    ))}
                    <button type="button" className="rq-empty" style={{ gridColumn: `${nowIdx + 1} / span ${Math.min(count - nowIdx, 8)}`, gridRow: 1 }} onClick={() => setDlg({ event: null })}>
                      None yet <b>+ Add</b>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {groups.map((g, gi) => (
              <div key={g.id ?? "none"} className="rq-tl-row">
                <div className="rq-tl-label">
                  <span className="rq-track" style={{ background: g.chrome.tint, color: g.chrome.ink }}>
                    {g.chrome.label}
                  </span>
                </div>
                <div className="rq-tl-clip">
                  <div ref={gi === 0 ? lanesRef : undefined} className="rq-tl-grid rq-lanes rq-evlanes" style={{ ...cols, gridTemplateRows: `repeat(${g.laneCount}, 40px)` }} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {weeks.map((w, i) => (
                      <span key={w} className="rq-cell" style={{ gridColumn: i + 1, gridRow: `1 / span ${g.laneCount}` }} />
                    ))}
                    {g.events.map((e) => {
                      const p = place(e);
                      const k = chromeOf(cats, e.kind);
                      const single = e.start === e.end;
                      const past = e.end < today;
                      const lane = laneOf.get(e.id) ?? 0;
                      const shown = { ...e, ...live(e) };
                      const dragging = drag?.id === e.id;
                      const open = () => {
                        if (justDragged.current || drag) return;
                        setDlg({ event: e });
                      };
                      return single ? (
                        <button key={e.id} type="button" className={`rq-pin${past ? " past" : ""}${dragging ? " dragging" : ""}`} style={{ left: `${p.left}%`, top: `${6 + lane * 40}px`, color: k.ink }} onPointerDown={(ev) => beginDrag(ev, e, "move")} onClick={open} title={`${e.title} · ${dayMonth(e.start)} · ${standing(today, e)}`}>
                          <i style={{ background: k.ink }} />
                          <span className="rq-pin-text">
                            <b>{e.title}</b>
                            <small>
                              {dayMonth(shown.start)} · {standing(today, shown)}
                            </small>
                          </span>
                        </button>
                      ) : (
                        <button
                          key={e.id}
                          type="button"
                          className={`rq-evbar${past ? " past" : ""}${dragging ? " dragging" : ""}`}
                          style={{ left: `${p.left}%`, width: `${p.width}%`, top: `${6 + lane * 40}px`, background: k.tint, color: k.ink, borderColor: k.line }}
                          onPointerDown={(ev) => {
                            if ((ev.target as HTMLElement).closest(".rq-bar-edge")) return;
                            beginDrag(ev, e, "move");
                          }}
                          onClick={open}
                          title={`${e.title} · ${e.repeat ? `${repeatWords(e.repeat, { until: false })} · ` : ""}${dayMonth(e.start)} → ${e.repeat && !e.repeat.until ? "no end" : dayMonth(e.end)} · ${standing(today, e)}`}
                        >
                          <span className="rq-bar-edge left" onPointerDown={(ev) => beginDrag(ev, e, "start")} onClick={(ev) => ev.stopPropagation()} />
                          <span className="rq-bar-edge right" onPointerDown={(ev) => beginDrag(ev, e, "end")} onClick={(ev) => ev.stopPropagation()} />
                          <b>{e.title}</b>
                          <small>
                            {/* Repeating (19 Oct): the days it comes back on, not a length. */}
                            {e.repeat ? repeatWords(e.repeat, { until: false }) : `${daysBetween(shown.start, shown.end) + 1} days`} · {standing(today, shown)}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- The log: every event, past ones included. */}
      <div className={`rq-evlog${logOpen ? " open" : ""}`}>
        <div className="rq-evlog-head">
          <button type="button" className="rq-evlog-toggle" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen}>
            <span className={`rd-chev${logOpen ? " open" : ""}`} aria-hidden="true">
              <ChevronDownIcon />
            </span>
            <span className="rd-eyebrow">Log</span>
          </button>
          {logOpen && (
            <div className="rd-btn-group" role="group" aria-label="Which events">
              {(
                [
                  ["all", "All"],
                  ["coming", "Coming"],
                  ["past", "Past"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={show === id ? "on" : ""} aria-pressed={show === id} onClick={() => pick(id)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {!logOpen ? null : listed.length === 0 ? (
          <p className="rq-evlog-empty">{events.length === 0 ? "None yet" : "None"}</p>
        ) : (
          <div className="rd-rows">
            {onPage.map((e) => {
              const k = chromeOf(cats, e.kind);
              const past = e.end < today;
              return (
                <div key={e.id} className={`rd-row${past ? " rq-ev-past" : ""}`}>
                  <button type="button" className="rd-row-main rq-evrow" onClick={() => setDlg({ event: e })}>
                    <span className="rq-evrow-when">
                      <b>{e.repeat ? `${dayMonth(e.start)} → ${e.repeat.until ? dayMonth(e.end) : "no end"}` : e.start === e.end ? dayMonth(e.start) : `${dayMonth(e.start)} → ${dayMonth(e.end)}`}</b>
                      {e.repeat && <small>{repeatWords(e.repeat, { until: false })}</small>}
                    </span>
                    <span className="rq-state" style={{ background: k.tint, color: k.ink }}>
                      {k.label}
                    </span>
                    <span className="rq-evrow-main">
                      <b>
                        {e.title}
                        {e.byClient && <span className="rq-ev-by">From client</span>}
                      </b>
                      {e.note && <small>{e.note}</small>}
                    </span>
                    <span className={`rq-evrow-rel${past ? "" : " coming"}`}>{standing(today, e)}</span>
                  </button>
                </div>
              );
            })}
            <Pager className="rq-evlog-foot" page={at} pages={pages} from={from} shown={onPage.length} total={listed.length} label="Log pages" onPage={setPage} />
          </div>
        )}
      </div>

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
            onSave={(v) => {
              const was = dlg.event;
              setDlg(null);
              act(() => (was ? updateClientEventAction(clientId, was.id, v) : addClientEventAction(clientId, v)), `Event: ${v.title}`);
            }}
            onDelete={() => {
              const was = dlg.event!;
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
export function EventDialog({ today, event, cats, initialStart, onSave, onDelete }: { today: string; event: PlanEvent | null; cats: Category[]; /** A new event opens on this day. */ initialStart?: string; onSave: (v: Omit<PlanEvent, "id">) => void; onDelete: () => void }) {
  // The six types the client's sheet has (10 Oct); the coach's own categories went, so both sides speak the same six.
  // A new event starts on Trip, the first tile (14 Oct).
  const [kind, setKind] = useState<string | null>(event ? event.kind : "trip");
  const [title, setTitle] = useState(event?.title ?? "");
  // Repeats (19 Oct, Alex: sports twice a week): on these weekdays from its start, until a day or with no end.
  const [shape, setShape] = useState<"event" | "period" | "repeat">(event?.repeat ? "repeat" : event ? (event.start === event.end ? "event" : "period") : "event");
  const [start, setStart] = useState(event?.start ?? initialStart ?? today);
  const [end, setEnd] = useState(event?.end ?? addDays(initialStart ?? today, 6));
  const [note, setNote] = useState(event?.note ?? "");
  const [days, setDays] = useState<number[]>(event?.repeat?.days ?? [isoWeekday(event?.start ?? initialStart ?? today)]);
  const [until, setUntil] = useState<string | null>(event?.repeat?.until ?? null);
  const toggleDay = (d: number) => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d].sort((a, b) => a - b)));
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
        {event?.byClient && <span className="npd-from">From client</span>}
      </DialogDescription>

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

      <div className="npd-cols">
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
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
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
          {/* The repeat's days and its words keep their room in every shape, so the pop-up never changes height (20 Oct, Alex). */}
          <div className="npd-repeat" style={{ visibility: shape === "repeat" ? "visible" : "hidden" }} aria-hidden={shape !== "repeat"}>
            <div className="evr-days" role="group" aria-label="On these days">
              {WEEKDAY_LETTERS.map((l, i) => (
                <button key={i} type="button" className={days.includes(i + 1) ? "on" : ""} aria-pressed={days.includes(i + 1)} aria-label={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]} onClick={() => toggleDay(i + 1)} tabIndex={shape === "repeat" ? 0 : -1}>
                  {l}
                </button>
              ))}
            </div>
            <p className="npd-repeat-says">
              <span>{days.length ? repeatWords({ days, until }) : ""}</span>
              {until && (
                <button type="button" className="npd-act" onClick={() => setUntil(null)} tabIndex={shape === "repeat" ? 0 : -1}>
                  No end
                </button>
              )}
            </p>
          </div>
          <label className="npd-field">
            <span className="npd-label">Note</span>
            <textarea className="npd-line" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="npd-foot">
        {event && (
          <button type="button" className="npd-delete" onClick={() => setConfirming(true)}>
            Delete
          </button>
        )}
        <DialogClose className="npd-cancel">Cancel</DialogClose>
        <button type="button" className="npd-save" disabled={!ok} onClick={() => onSave({ kind, title: title.trim(), start, end: shape === "event" ? start : shape === "repeat" ? until ?? start : end, note: note.trim(), repeat: shape === "repeat" ? { days, until } : null })}>
          {event ? "Save" : "Add"}
        </button>
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
