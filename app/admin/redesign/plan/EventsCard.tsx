"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addClientEventAction, addEventCategoryAction, deleteClientEventAction, deleteEventCategoryAction, updateClientEventAction, updateEventCategoryAction } from "../../../lib/actions";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { ChevronDownIcon, ChevronLeftIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { pageWindow } from "../../../lib/pager";
import DatePick from "../DatePick";
import { PALETTE, paletteOf } from "../palette";

// Events on the plan: what happens in the client's life that the plan has to
// live with, on the same week grid as the phases, under the same "now" line.
// A stretch (a trip, a holiday, a wedding weekend) is a bar; a moment (started
// creatine, a car accident) is a pin. As the weeks slide under the line, a
// coming event walks towards it; a past one slides off to the left, so the
// log under the grid keeps every event, newest first, for looking back.
// Real, not a draft: events and the coach's own categories save through
// the actions in lib/actions.ts and come back from the loader.

/** kind is the category's id, and optional: an event can just be an event. */
export type PlanEvent = { id: number; kind: string | null; title: string; start: string; end: string; note: string };

export type Category = { id: string; label: string; color: string; custom: boolean };
const NONE = { tint: "#eceff3", ink: "#5b6474", line: "#c3c9d2" };
// The built-in four and the coach's own come from the loader (listEventCategories).
/** A category's colours, or grey for none (or one since removed). */
const chromeOf = (cats: Category[], id: string | null) => {
  const c = id ? cats.find((x) => x.id === id) : null;
  return c ? { label: c.label, ...paletteOf(c.color) } : { label: "Event", ...NONE };
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
const shortDate = (d: string) => parse(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const longDate = (d: string) => parse(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

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
  const left = daysBetween(today, e.end);
  return left === 0 ? "last day" : `now · ${left} day${left === 1 ? "" : "s"} left`;
};

export type EventsCardProps = {
  clientId: number;
  events: PlanEvent[];
  categories: Category[];
  today: string;
  /** The Monday of every column, in order, and how many there are. */
  weeks: string[];
  count: number;
  /** The grid's own styling: the columns, the width, the slide under "now". */
  cols: React.CSSProperties;
  months: { label: string; start: number; span: number }[];
  nowIdx: number;
  nowLeft: string;
  win: number;
  /** The 3 / 6 / 9 / 12 month switch, shared with the phases so both grids move together. */
  windows: readonly { months: number; weeks: number }[];
  onWin: (weeks: number) => void;
};

export default function EventsCard({ clientId, events, categories: cats, today, weeks, count, cols, months, nowIdx, nowLeft, win, windows, onWin }: EventsCardProps) {
  const router = useRouter();
  const [, start] = useTransition();
  // Every save goes to the server and the page re-reads; the card holds no copy.
  const act = (fn: () => Promise<unknown>, said?: string) =>
    start(async () => {
      await fn();
      router.refresh();
      if (said) toast.success(said);
    });
  const [dlg, setDlg] = useState<{ event: PlanEvent | null } | null>(null);
  const [show, setShow] = useState<"coming" | "past" | "all">("all");
  // The log folds away under the grid; open, it is ten to a page.
  const [logOpen, setLogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const first = weeks[0];
  const totalDays = count * 7;

  // Where an event sits on the grid, as fractions of its width; the grid is
  // week columns, so a day is a seventh of one.
  const place = (e: PlanEvent) => {
    const a = daysBetween(first, e.start);
    const b = daysBetween(first, e.end) + 1;
    return { left: (Math.max(0, a) / totalDays) * 100, width: (Math.max(0.6, Math.min(totalDays, b) - Math.max(0, a)) / totalDays) * 100, visible: b > 0 && a < totalDays };
  };
  // Overlapping events stack into lanes; a pin's label needs room too.
  const onGrid = events.filter((e) => place(e).visible).sort((a, b) => (a.start < b.start ? -1 : 1));
  const lanes: PlanEvent[][] = [];
  const laneOf = new Map<number, number>();
  // A pin's label needs room to its right: measured against the grid, so
  // the reach is what the label takes on this screen, not a guess.
  const lanesRef = useRef<HTMLDivElement>(null);
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
  onGrid.forEach((e) => {
    let li = lanes.findIndex((l) => l.every((q) => reach(q) < e.start || q.start > reach(e)));
    if (li < 0) {
      lanes.push([]);
      li = lanes.length - 1;
    }
    lanes[li].push(e);
    laneOf.set(e.id, li);
  });
  const laneCount = Math.max(1, lanes.length);

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
            <PlusIcon /> Add event
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
            <span className="rq-now" style={{ left: nowLeft }} title="Now" />
            <div className="rq-tl-row">
              <span />
              <div className="rq-tl-clip">
                <div className="rq-tl-grid" style={cols}>
                  {weeks.map((w, i) => (
                    <span key={w} className={`rq-week${i === nowIdx ? " now" : ""}`}>
                      <small>{shortDate(w)}</small>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="rq-tl-row">
              <div className="rq-tl-label">
                <span className="rq-track" style={{ background: "#eceff3", color: "#5b6474" }}>
                  Life
                </span>
              </div>
              <div className="rq-tl-clip">
                <div ref={lanesRef} className="rq-tl-grid rq-lanes rq-evlanes" style={{ ...cols, gridTemplateRows: `repeat(${laneCount}, 40px)` }}>
                  {weeks.map((w, i) => (
                    <span key={w} className="rq-cell" style={{ gridColumn: i + 1, gridRow: `1 / span ${laneCount}` }} />
                  ))}
                  {onGrid.length === 0 && (
                    <button type="button" className="rq-empty" style={{ gridColumn: `${nowIdx + 1} / span ${Math.min(count - nowIdx, 8)}`, gridRow: 1 }} onClick={() => setDlg({ event: null })}>
                      Nothing on the horizon <b>+ add</b>
                    </button>
                  )}
                  {onGrid.map((e) => {
                    const p = place(e);
                    const k = chromeOf(cats, e.kind);
                    const single = e.start === e.end;
                    const past = e.end < today;
                    const lane = laneOf.get(e.id) ?? 0;
                    return single ? (
                      <button
                        key={e.id}
                        type="button"
                        className={`rq-pin${past ? " past" : ""}`}
                        style={{ left: `${p.left}%`, top: `${6 + lane * 40}px`, color: k.ink }}
                        onClick={() => setDlg({ event: e })}
                        title={`${e.title} · ${longDate(e.start)} · ${standing(today, e)}`}
                      >
                        <i style={{ background: k.ink }} />
                        <span className="rq-pin-text">
                          <b>{e.title}</b>
                          <small>
                            {shortDate(e.start)} · {standing(today, e)}
                          </small>
                        </span>
                      </button>
                    ) : (
                      <button
                        key={e.id}
                        type="button"
                        className={`rq-evbar${past ? " past" : ""}`}
                        style={{ left: `${p.left}%`, width: `${p.width}%`, top: `${6 + lane * 40}px`, background: k.tint, color: k.ink, borderColor: k.line }}
                        onClick={() => setDlg({ event: e })}
                        title={`${e.title} · ${longDate(e.start)} → ${longDate(e.end)} · ${standing(today, e)}`}
                      >
                        <b>{e.title}</b>
                        <small>
                          {daysBetween(e.start, e.end) + 1} days · {standing(today, e)}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
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
          <p className="rq-evlog-empty">{events.length === 0 ? "No events yet. Add the first: a trip, an injury, the day they started something." : "Nothing of that kind."}</p>
        ) : (
          <div className="rd-rows">
            {onPage.map((e) => {
              const k = chromeOf(cats, e.kind);
              const past = e.end < today;
              return (
                <div key={e.id} className={`rd-row${past ? " rq-ev-past" : ""}`}>
                  <button type="button" className="rd-row-main rq-evrow" onClick={() => setDlg({ event: e })}>
                    <span className="rq-evrow-when">
                      <b>{e.start === e.end ? shortDate(e.start) : `${shortDate(e.start)} → ${shortDate(e.end)}`}</b>
                    </span>
                    <span className="rq-state" style={{ background: k.tint, color: k.ink }}>
                      {k.label}
                    </span>
                    <span className="rq-evrow-main">
                      <b>{e.title}</b>
                      {e.note && <small>{e.note}</small>}
                    </span>
                    <span className={`rq-evrow-rel${past ? "" : " coming"}`}>{standing(today, e)}</span>
                  </button>
                </div>
              );
            })}
            {pages > 1 && (
              <div className="rq-evlog-foot">
                <span>
                  {from + 1}–{from + onPage.length} of {listed.length}
                </span>
                <nav className="rn-pager" aria-label="Log pages">
                  <button type="button" className="rd-btn ghost sm" onClick={() => setPage(at - 1)} disabled={at === 1} aria-label="Newer">
                    <ChevronLeftIcon />
                  </button>
                  {pageWindow(at, pages).map((p, i) =>
                    p === "gap" ? (
                      <span key={`gap${i}`} className="rn-gap" aria-hidden="true">
                        …
                      </span>
                    ) : (
                      <button key={p} type="button" className={`rd-btn ghost sm${p === at ? " on" : ""}`} aria-current={p === at ? "page" : undefined} onClick={() => setPage(p)}>
                        {p}
                      </button>
                    ),
                  )}
                  <button type="button" className="rd-btn ghost sm rn-next" onClick={() => setPage(at + 1)} disabled={at === pages} aria-label="Older">
                    <ChevronLeftIcon />
                  </button>
                </nav>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        {dlg && (
          <EventDialog
            today={today}
            event={dlg.event}
            cats={cats}
            onAddCat={async (label, color) => {
              const id = await addEventCategoryAction(label, color);
              router.refresh();
              toast.success(`Category "${label}" · yours, on every client`);
              return id ?? "";
            }}
            onRenameCat={(id, label, color) => act(() => updateEventCategoryAction(id, label, color), `Category "${label}" changed`)}
            onRemoveCat={(id) => act(() => deleteEventCategoryAction(id), "Category removed · its events keep their words, lose the colour")}
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
function EventDialog({ today, event, cats, onAddCat, onRenameCat, onRemoveCat, onSave, onDelete }: { today: string; event: PlanEvent | null; cats: Category[]; onAddCat: (label: string, color: string) => Promise<string>; onRenameCat: (id: string, label: string, color: string) => void; onRemoveCat: (id: string) => void; onSave: (v: Omit<PlanEvent, "id">) => void; onDelete: () => void }) {
  const [kind, setKind] = useState<string | null>(event ? event.kind : null);
  // A category being made or changed: its name and colour, in a small row under the chips.
  const [catEdit, setCatEdit] = useState<{ id: string | null; label: string; color: string } | null>(null);
  const usedColors = new Set(cats.map((c) => c.color));
  const freeColor = PALETTE.find((p) => !usedColors.has(p.id))?.id ?? PALETTE[0].id;
  const catOk = !!catEdit && catEdit.label.trim().length > 0 && !cats.some((c) => c.id !== catEdit.id && c.label.trim().toLowerCase() === catEdit.label.trim().toLowerCase());
  const saveCat = async () => {
    if (!catEdit || !catOk) return;
    const draft = catEdit;
    setCatEdit(null);
    if (draft.id) onRenameCat(draft.id, draft.label.trim(), draft.color);
    else {
      const id = await onAddCat(draft.label.trim(), draft.color);
      if (id) setKind(id);
    }
  };
  const current = kind ? cats.find((c) => c.id === kind) ?? null : null;
  const [title, setTitle] = useState(event?.title ?? "");
  const [shape, setShape] = useState<"event" | "period">(event ? (event.start === event.end ? "event" : "period") : "event");
  const [start, setStart] = useState(event?.start ?? today);
  const [end, setEnd] = useState(event?.end ?? addDays(today, 6));
  const [note, setNote] = useState(event?.note ?? "");
  const k = chromeOf(cats, kind);
  const endOk = shape === "event" || end >= start;
  const ok = title.trim().length > 0 && !!start && endOk;
  const placeholder = kind === "trip" ? "Italy with the family" : kind === "health" ? "Sprained ankle" : kind === "family" ? "Wedding in Groningen" : kind === "work" ? "Night shifts all week" : "Started creatine, 5 g a day";
  return (
    <DialogContent className="rd-dlg rq-ev-dlg">
      <DialogHeader>
        <DialogTitle>
          <span className="rq-title-row">
            {event ? event.title : "New event"}
            <span className="rq-state" style={{ background: k.tint, color: k.ink }}>
              {k.label}
            </span>
          </span>
        </DialogTitle>
        <DialogDescription hidden>Something in their life the plan has to live with.</DialogDescription>
      </DialogHeader>

      <label className="rd-field">
        <span>What</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} maxLength={80} autoFocus={!event} />
      </label>

      <div className="rd-field">
        <span>Category</span>
        <div className="rq-kinds">
          {cats.map((x) => {
            const p = paletteOf(x.color);
            return (
              <button key={x.id} type="button" className={`rd-chip${kind === x.id ? " on" : ""}`} style={kind === x.id ? { background: p.ink, borderColor: p.ink } : undefined} onClick={() => setKind(kind === x.id ? null : x.id)} aria-pressed={kind === x.id}>
                <i className="rq-cat-dot" style={{ background: kind === x.id ? "#fff" : p.ink }} />
                {x.label}
              </button>
            );
          })}
          <button type="button" className="rd-chip alt" onClick={() => setCatEdit({ id: null, label: "", color: freeColor })}>
            + New category
          </button>
        </div>
        {/* Your own: change its name or colour, or take it off, from right here. */}
        {current?.custom && !catEdit && (
          <span className="rq-cat-own">
            <button type="button" className="rd-ex-btn" onClick={() => setCatEdit({ id: current.id, label: current.label, color: current.color })}>
              Rename or recolour
            </button>
            <button type="button" className="rd-ex-btn danger" onClick={() => onRemoveCat(current.id)}>
              Remove
            </button>
          </span>
        )}
        {catEdit && (
          <div className="rq-cat-edit">
            <input
              className="rd-input"
              value={catEdit.label}
              onChange={(e) => setCatEdit({ ...catEdit, label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveCat();
                }
                if (e.key === "Escape") setCatEdit(null);
              }}
              placeholder="Name it: Competition, Exams, Travel for work…"
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

      <div className="rd-field">
        <span>When</span>
        <div className="rd-btn-group rq-groups" role="group" aria-label="A timestamp or a period">
          <button type="button" className={shape === "event" ? "on" : ""} aria-pressed={shape === "event"} onClick={() => setShape("event")}>
            Timestamp
          </button>
          <button type="button" className={shape === "period" ? "on" : ""} aria-pressed={shape === "period"} onClick={() => setShape("period")}>
            A period
          </button>
        </div>
      </div>
      <div className="rd-field-row rq-ev-dates">
        <label className="rd-field">
          <span>{shape === "event" ? "On" : "From"}</span>
          <DatePick
            value={start}
            onChange={(d) => {
              setStart(d);
              if (end < d) setEnd(d);
            }}
            label={shape === "event" ? "On" : "From"}
          />
        </label>
        {shape === "period" && (
          <label className="rd-field">
            <span>To</span>
            <DatePick value={end} onChange={setEnd} label="To" />
          </label>
        )}
      </div>
      {shape === "period" && !endOk && <small className="rd-dlg-hint rq-ev-len">Ends before it starts.</small>}

      <label className="rd-field">
        <span>Note</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it means for the plan, for you alone." />
      </label>

      <DialogFooter>
        {event && (
          <button type="button" className="rd-btn danger" onClick={onDelete}>
            <TrashIcon /> Remove
          </button>
        )}
        <span className="rd-dlg-hint grow" />
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!ok} onClick={() => onSave({ kind, title: title.trim(), start, end: shape === "event" ? start : end, note: note.trim() })}>
          {event ? "Save" : "Add event"}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}
