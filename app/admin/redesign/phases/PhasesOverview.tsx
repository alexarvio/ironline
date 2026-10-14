"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover as PopoverPrimitive } from "radix-ui";
import { toast } from "sonner";
import { addClientEventAction, addClientPhaseAction, removeClientPhaseAction, updateClientPhaseAction } from "../../../lib/actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { eventTypeOf } from "../../../lib/eventTypes";
import PhaseDetailDialog from "./PhaseDetailDialog";
import type { PhaseTrack } from "../../../lib/db";
import { TRACK_LABEL } from "../../phaseChrome";
import { PhaseDialog, phaseForm } from "../plan/PlanDraft";
import { EventDialog } from "../plan/EventsCard";
import DatePick from "../DatePick";
import type { OverviewClient, PhasesOverviewData } from "./load";
import {
  addDays,
  clientStatus,
  daysLeft,
  endingSoon,
  gridLines,
  leftLabel,
  monthAnchor,
  monthMarks,
  mondayOf,
  needsAttention,
  phaseStatus,
  phasesOn,
  progressOf,
  rangeOf,
  shortDate,
  soonPhases,
  soonTag,
  sortClients,
  spanOf,
  stackEvents,
  TINY,
  TRACK_COLOR,
  TRACKS,
  weekIndexOf,
  weeksOf,
  xOf,
  type Months,
  type OverviewEvent,
  type OverviewPhase,
  type Range,
} from "./timeline";

// The Phases overview (14 Oct): every client's plan and events on one
// timeline. Ending soon on top as a list to act on (Plan next, Extend), the
// clients below, a lane a track in a fixed order (lifestyle, training,
// nutrition, then events) and only the lanes with something in them. Bars
// wear their track's colour: solid running or sent, dashed for a draft, grey
// when done, a rust ring when ending soon. Events are round markers with
// their category's icon. The maths lives in timeline.ts.

const ALL_TRACKS = new Set<PhaseTrack>(TRACKS);
const RANGES: Months[] = [3, 6, 12];
const EXTENDS = [1, 2, 4];
const first = (name: string) => name.split(" ")[0];
const PLAN = (id: number) => `/admin/redesign/plan?client=${id}`;

type Prefs = { months: Months; view: "all" | "attention" };
const DEFAULT_PREFS: Prefs = { months: 3, view: "all" };
const prefsKey = (coachId: number) => `norcoach:phases:${coachId}`;

type Picked = { client: OverviewClient; phase: OverviewPhase } | { client: OverviewClient; event: OverviewEvent } | null;

function EventIcon({ kind, size = 11 }: { kind: string | null; size?: number }) {
  const t = eventTypeOf(kind);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {t.fill && <path d={t.fill} fill="currentColor" stroke="none" opacity={0.35} />}
      <path d={t.icon} />
    </svg>
  );
}

const phaseTip = (p: OverviewPhase, today: string) => {
  const st = phaseStatus(p, today);
  const tail = st === "draft" ? " · draft" : st === "running" ? ` · ${leftLabel(daysLeft(p, today)).toLowerCase()}` : "";
  return `${TRACK_LABEL[p.track]} · ${p.name} · ${shortDate(p.start)} – ${shortDate(p.end)} · ${weeksOf(p)} week${weeksOf(p) === 1 ? "" : "s"}${tail}`;
};
const eventTip = (e: OverviewEvent) => `${eventTypeOf(e.kind).label} · ${e.title} · ${shortDate(e.start)}${e.end > e.start ? ` – ${shortDate(e.end)}` : ""}${e.note ? ` · ${e.note}` : ""} · added by ${e.addedBy === "client" ? "the client" : "you"}`;

export default function PhasesOverview({ data }: { data: PhasesOverviewData }) {
  const router = useRouter();
  const [, start] = useTransition();
  const { today, thisWeek, coachId, clients } = data;

  // What the coach last chose, kept per coach in this browser.
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(prefsKey(coachId));
      if (raw) {
        const p = JSON.parse(raw) as Partial<Prefs>;
        start(() => setPrefs({ months: RANGES.includes(p.months as Months) ? (p.months as Months) : 3, view: p.view === "attention" ? "attention" : "all" }));
      }
    } catch {}
    loaded.current = true;
  }, [coachId]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(prefsKey(coachId), JSON.stringify(prefs));
    } catch {}
  }, [prefs, coachId]);
  // Every track and the events, always (14 Oct, Alex: no toggles; every client is shown as they are).
  const tracksOn = ALL_TRACKS;
  const eventsOn = true;

  // The window: the 1st of this month, shifted by the arrows, N months on.
  const [shift, setShift] = useState(0);
  const range = useMemo(() => rangeOf(monthAnchor(today, shift), prefs.months), [today, shift, prefs.months]);

  // The track's width in pixels, for the events' label room.
  const axisRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = axisRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // The three readings of the same data: the list, the toggle's count, the order.
  const soonRows = useMemo(
    () =>
      clients
        .flatMap((c) => soonPhases(c, tracksOn, today).map((phase) => ({ client: c, phase })))
        .sort((a, b) => (a.phase.end < b.phase.end ? -1 : a.phase.end > b.phase.end ? 1 : a.client.name.localeCompare(b.client.name))),
    [clients, tracksOn, today]
  );
  const sorted = useMemo(() => sortClients(clients, tracksOn, today), [clients, tracksOn, today]);
  const attention = useMemo(() => sorted.filter((c) => needsAttention(c, tracksOn, today)), [sorted, tracksOn, today]);
  const shown = prefs.view === "attention" ? attention : sorted;

  // Acting on a phase: the row folds away, the change saves, Undo puts it back.
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<Picked>(null);
  const [newPhase, setNewPhase] = useState<{ client: OverviewClient; track: PhaseTrack; start: string; /** Plan next: the track is given. A first phase: the coach picks it. */ lock: boolean } | null>(null);
  const [newEvent, setNewEvent] = useState<{ client: OverviewClient; day: string } | null>(null);
  const leave = (id: number) => setLeaving((s) => new Set(s).add(id));
  const act = (fn: () => Promise<unknown>, said: string, undo?: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
      toast(said, undo ? { action: { label: "Undo", onClick: () => start(async () => (await undo(), router.refresh())) } } : undefined);
    });
  /** The phase's end moved to `endWeek` (its stored value), through the same action as the Plan. */
  const extend = (p: OverviewPhase, endWeek: string) => {
    leave(p.id);
    const form = (end: string) => phaseForm({ id: p.id, name: p.name, track: p.track, start: p.start, end });
    act(
      () => updateClientPhaseAction(form(endWeek)),
      `${p.name} now ends ${shortDate(addDays(endWeek, 6))}`,
      () => updateClientPhaseAction(form(p.endWeek))
    );
  };

  const months = useMemo(() => monthMarks(range), [range]);
  const lines = useMemo(() => gridLines(range), [range]);
  const todayX = xOf(today, range);
  const todayIn = today >= range.start && today < range.end;

  return (
    <div className="pov">
      <header className="pov-head">
        <div>
          <h1 className="pov-title">Phases</h1>
          <p className="pov-sub">Every client&rsquo;s plan and events on one timeline.</p>
        </div>
        <div className="pov-tools">
          <div className="pov-nav">
            <button type="button" className="pov-arrow" onClick={() => setShift((s) => s - 1)} aria-label="A month earlier">
              ‹
            </button>
            <button type="button" className="pov-today-btn" onClick={() => setShift(0)} disabled={shift === 0}>
              Today
            </button>
            <button type="button" className="pov-arrow" onClick={() => setShift((s) => s + 1)} aria-label="A month later">
              ›
            </button>
          </div>
          <div className="pov-seg" role="radiogroup" aria-label="Months shown">
            {RANGES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={prefs.months === m} className={prefs.months === m ? "on" : ""} onClick={() => setPrefs((p) => ({ ...p, months: m }))}>
                {m} months
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ---- Ending soon: a row a phase, soonest first. Hidden when there is nothing to act on. */}
      {soonRows.length > 0 && (
        <section className="pov-soon" aria-label="Ending soon">
          <div className="pov-soon-head">
            <span className="pov-soon-eyebrow">Ending soon · {soonRows.length}</span>
            <span className="pov-soon-rule">Last two weeks, nothing planned after</span>
          </div>
          <ul className="pov-soon-list">
            {soonRows.map(({ client, phase }) => {
              const col = TRACK_COLOR[phase.track];
              const left = daysLeft(phase, today);
              return (
                <li key={phase.id} className={`pov-soon-row${leaving.has(phase.id) ? " leaving" : ""}`} style={{ "--c": col.c, "--rgb": col.rgb, "--s": col.solid } as React.CSSProperties}>
                  <span className="pov-pill">{TRACK_LABEL[phase.track]}</span>
                  <span className="pov-who">
                    <Link href={PLAN(client.id)} className="pov-who-name">
                      {client.name}
                    </Link>
                    <span className="pov-who-what">{phase.name}</span>
                  </span>
                  <span className="pov-left">{leftLabel(left)}</span>
                  <span className="pov-prog" title={`Week ${weekIndexOf(phase, today)} of ${weeksOf(phase)}`} aria-label={`Week ${weekIndexOf(phase, today)} of ${weeksOf(phase)}`}>
                    <i style={{ width: `${progressOf(phase, today) * 100}%` }} />
                  </span>
                  <span className="pov-actions">
                    <button type="button" className="pov-plan" onClick={() => setNewPhase({ client, track: phase.track, start: addDays(phase.end, 1), lock: true })}>
                      Plan next
                    </button>
                    <ExtendMenu phase={phase} onPick={(endWeek) => extend(phase, endWeek)} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ---- The timeline. */}
      <section className="pov-card">
        <header className="pov-card-head">
          <div className="pov-view" role="radiogroup" aria-label="Which clients">
            <button type="button" role="radio" aria-checked={prefs.view === "all"} className={prefs.view === "all" ? "on" : ""} onClick={() => setPrefs((p) => ({ ...p, view: "all" }))}>
              All clients · {clients.length}
            </button>
            <button type="button" role="radio" aria-checked={prefs.view === "attention"} className={prefs.view === "attention" ? "on" : ""} onClick={() => setPrefs((p) => ({ ...p, view: "attention" }))}>
              Needs attention <b className="pov-count">{attention.length}</b>
            </button>
          </div>
          <div className="pov-legend" aria-hidden="true">
            <span>
              <i className="run" /> Running
            </span>
            <span>
              <i className="draft" /> Draft
            </span>
            <span>
              <i className="done" /> Done
            </span>
            <span>
              <i className="ev">
                <EventIcon kind="trip" size={8} />
              </i>{" "}
              Event
            </span>
          </div>
        </header>

        <div className="pov-grid">
          <div className="pov-axis-left" />
          <div className="pov-axis" ref={axisRef}>
            {months.map((m) => (
              <span key={m.day} className="pov-month" style={{ left: `${m.x * 100}%` }}>
                {m.label}
              </span>
            ))}
            {todayIn && (
              <span className="pov-today-pill" style={{ left: `${todayX * 100}%` }}>
                Today · {shortDate(today)}
              </span>
            )}
          </div>

          {clients.length === 0 ? (
            <p className="pov-empty">No clients yet.</p>
          ) : shown.length === 0 ? (
            <p className="pov-empty">Nobody needs attention: every running phase has something planned after it.</p>
          ) : (
            shown.map((c) => (
              <ClientBlock key={c.id} client={c} today={today} range={range} tracksOn={tracksOn} eventsOn={eventsOn} width={width} lines={lines} todayX={todayIn ? todayX : null} onPick={setPicked} onPlan={(track, startDay) => setNewPhase({ client: c, track, start: startDay, lock: false })} onEvent={(day) => setNewEvent({ client: c, day })} />
            ))
          )}
        </div>
      </section>

      {/* ---- A bar's detail (PhaseDetailDialog, read-only), or a marker's, and the way to the client's Plan. */}
      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        {picked &&
          ("phase" in picked ? (
            <PhaseDetailDialog client={picked.client} phase={picked.phase} today={today} onMove={(p) => setPicked({ client: picked.client, phase: p })} />
          ) : (
            <DialogContent className="rd-dlg">
              <DialogHeader>
                <DialogTitle>{picked.event.title}</DialogTitle>
                <DialogDescription>
                  {picked.client.name} · {eventTypeOf(picked.event.kind).label} · added by {picked.event.addedBy === "client" ? first(picked.client.name) : "you"}
                </DialogDescription>
              </DialogHeader>
              <dl className="pov-facts">
                <div>
                  <dt>Dates</dt>
                  <dd>
                    {shortDate(picked.event.start)}
                    {picked.event.end > picked.event.start && ` – ${shortDate(picked.event.end)}`}
                  </dd>
                </div>
                {picked.event.note && (
                  <div>
                    <dt>Note</dt>
                    <dd>{picked.event.note}</dd>
                  </div>
                )}
              </dl>
              <DialogFooter>
                <Link className="rd-btn primary" href={PLAN(picked.client.id)}>
                  Open {first(picked.client.name)}&rsquo;s Plan
                </Link>
              </DialogFooter>
            </DialogContent>
          ))}
      </Dialog>

      {/* ---- New phase, the Plan's own dialog, opened on the track and the day after the one ending. */}
      <Dialog open={!!newPhase} onOpenChange={(o) => !o && setNewPhase(null)}>
        {newPhase && (
          <PhaseDialog
            clientId={newPhase.client.id}
            firstName={first(newPhase.client.name)}
            today={today}
            thisWeek={thisWeek}
            phase={null}
            track={newPhase.track}
            lockTrack={newPhase.lock}
            initialStart={newPhase.start}
            others={newPhase.client.plan.phases}
            programs={newPhase.client.plan.programs}
            onSave={(v) => {
              const client = newPhase.client;
              setNewPhase(null);
              // The phase it follows leaves Ending soon: it is followed now.
              for (const p of client.phases) if (p.track === v.track && endingSoon(p, client.phases, today)) leave(p.id);
              start(async () => {
                const added = await addClientPhaseAction(phaseForm({ clientId: client.id, ...v }));
                router.refresh();
                toast(`${v.name} drafted on ${TRACK_LABEL[v.track]} for ${first(client.name)}: ${shortDate(v.start)} – ${shortDate(addDays(v.end, 6))}`, {
                  action: added
                    ? {
                        label: "Undo",
                        onClick: () =>
                          start(async () => {
                            const fd = new FormData();
                            fd.set("id", String(added.phaseId));
                            await removeClientPhaseAction(fd);
                            router.refresh();
                          }),
                      }
                    : undefined,
                });
              });
            }}
            onSend={() => setNewPhase(null)}
          />
        )}
      </Dialog>

      {/* ---- New event, the Plan's own dialog, on the day clicked. */}
      <Dialog open={!!newEvent} onOpenChange={(o) => !o && setNewEvent(null)}>
        {newEvent && (
          <EventDialog
            today={today}
            event={null}
            cats={data.categories}
            initialStart={newEvent.day}
            onSave={(v) => {
              const client = newEvent.client;
              setNewEvent(null);
              act(() => addClientEventAction(client.id, v), `Event for ${first(client.name)}: ${v.title}`);
            }}
            onDelete={() => setNewEvent(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

/** Extend: a week or two or four more, or a day picked; a training phase keeps whole weeks. */
function ExtendMenu({ phase, onPick }: { phase: OverviewPhase; onPick: (endWeek: string) => void }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const byWeeks = (n: number) => addDays(phase.endWeek, n * 7);
  const byDay = (lastDay: string) => (phase.track === "training" ? mondayOf(lastDay) : addDays(lastDay, -6));
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPicking(false);
      }}
    >
      <PopoverPrimitive.Trigger className="pov-extend" aria-label={`Extend ${phase.name}`}>
        Extend
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} className="pb-menu pov-extend-menu">
          {EXTENDS.map((n) => (
            <button
              key={n}
              type="button"
              className="pov-extend-opt"
              onClick={() => {
                setOpen(false);
                onPick(byWeeks(n));
              }}
            >
              +{n} week{n === 1 ? "" : "s"} <small>to {shortDate(addDays(byWeeks(n), 6))}</small>
            </button>
          ))}
          {picking ? (
            <div className="pov-extend-pick">
              <DatePick
                value={phase.end}
                onChange={(d) => {
                  if (d <= phase.end) return;
                  setOpen(false);
                  onPick(byDay(d));
                }}
                label="Pick the new last day"
              />
              {phase.track === "training" && <small>Training runs in whole weeks: the day picked becomes that week&rsquo;s Sunday.</small>}
            </div>
          ) : (
            <button type="button" className="pov-extend-opt" onClick={() => setPicking(true)}>
              Pick date…
            </button>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function ClientBlock({
  client: c,
  today,
  range,
  tracksOn,
  eventsOn,
  width,
  lines,
  todayX,
  onPick,
  onPlan,
  onEvent,
}: {
  client: OverviewClient;
  today: string;
  range: Range;
  tracksOn: Set<PhaseTrack>;
  eventsOn: boolean;
  width: number;
  lines: number[];
  todayX: number | null;
  onPick: (p: Picked) => void;
  onPlan: (track: PhaseTrack, start: string) => void;
  onEvent: (start: string) => void;
}) {
  // Where empty space was clicked: the chooser opens there.
  const [spot, setSpot] = useState<{ x: number; y: number; day: string } | null>(null);
  const status = clientStatus(c, tracksOn, today);
  const statusText = status.kind === "soon" ? `${TRACK_LABEL[status.track]} ends ${status.days <= 0 ? "today" : `in ${status.days} day${status.days === 1 ? "" : "s"}`}` : status.kind === "planned" ? "All planned" : "Nothing planned";

  // The lanes with something in the window, in the fixed order.
  // Two phases on one track over the same days (Sam Rivera, 14 Oct) each get a row of their own, so both are seen whole.
  const lanes = TRACKS.filter((t) => tracksOn.has(t)).flatMap((t) => {
    const rows: OverviewPhase[][] = [];
    for (const p of c.phases.filter((x) => x.track === t && spanOf(x.start, x.end, range).width >= TINY.hide).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))) {
      let row = rows.find((r) => r.every((q) => q.end < p.start || q.start > p.end));
      if (!row) rows.push((row = []));
      row.push(p);
    }
    return rows.map((phases, row) => ({ track: t, row, phases }));
  });
  const events = eventsOn ? stackEvents(c.events, range, width) : { placed: [], overflow: [] };
  const eventRows = events.placed.length || events.overflow.length ? Math.max(...events.placed.map((p) => p.row + 1), events.overflow.length ? 1 : 0) : 0;
  const nothingAtAll = phasesOn(c, tracksOn).length === 0 && (!eventsOn || c.events.length === 0);
  const empty = lanes.length === 0 && eventRows === 0;

  return (
    <div role="group" aria-label={`${c.name}, ${statusText}`} className="pov-client" style={{ display: "contents" }}>
      <div className="pov-client-cell">
        <span className="pov-avatar">
          {c.avatarPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
            <img src={c.avatarPath} alt="" />
          ) : (
            c.name.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="pov-client-text">
          <Link href={PLAN(c.id)} className="pov-client-name">
            {c.name}
          </Link>
          <small className={`pov-status ${status.kind}`}>{statusText}</small>
        </span>
      </div>
      {/* A click on empty space (14 Oct): a new phase for this client, from the day under the pointer (never before today). */}
      <div
        className="pov-track-cell"
        title="Click an empty spot to plan a phase from that day"
        onClick={(ev) => {
          if ((ev.target as HTMLElement).closest("button, a")) return;
          const rect = ev.currentTarget.getBoundingClientRect();
          const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / Math.max(1, rect.width - 20)));
          const day = addDays(range.start, Math.round(x * range.days));
          setSpot({ x, y: ev.clientY - rect.top, day: day < today ? today : day });
        }}
      >
        {/* The chooser at that spot: a phase or an event, from that day. */}
        {spot && (
          <PopoverPrimitive.Root open onOpenChange={(o) => !o && setSpot(null)}>
            <PopoverPrimitive.Anchor asChild>
              <i className="pov-spot" style={{ left: `calc(${spot.x} * (100% - 20px))`, top: spot.y }} aria-hidden="true" />
            </PopoverPrimitive.Anchor>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content align="start" sideOffset={6} className="pb-menu pov-spot-menu" onOpenAutoFocus={(e) => e.preventDefault()}>
                <span className="pov-spot-head">
                  {shortDate(spot.day)} · {first(c.name)}
                </span>
                <button
                  type="button"
                  className="pov-spot-opt"
                  onClick={() => {
                    const d = spot.day;
                    setSpot(null);
                    onPlan("training", d);
                  }}
                >
                  <i /> New phase
                </button>
                <button
                  type="button"
                  className="pov-spot-opt"
                  onClick={() => {
                    const d = spot.day;
                    setSpot(null);
                    onEvent(d);
                  }}
                >
                  <i className="ev" /> New event
                </button>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        )}
        {lines.map((x) => (
          <i key={x} className="pov-gridline" style={{ left: `${x * 100}%` }} aria-hidden="true" />
        ))}
        {todayX != null && <i className="pov-today-line" style={{ left: `${todayX * 100}%` }} aria-hidden="true" />}
        {empty ? (
          <div className="pov-none">
            {nothingAtAll ? (
              <>
                No phases yet
                <button type="button" className="pov-none-link" onClick={() => onPlan("training", today)}>
                  + Plan first phase
                </button>
              </>
            ) : (
              <>
                Nothing in these months
                <button type="button" className="pov-none-link" onClick={() => onPlan("training", today)}>
                  + Plan a phase
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {lanes.map((lane) => (
              <div key={`${lane.track}-${lane.row}`} className="pov-lane" aria-label={lane.row ? undefined : TRACK_LABEL[lane.track]}>
                {lane.phases.map((p) => {
                  const sp = spanOf(p.start, p.end, range);
                  const st = phaseStatus(p, today);
                  const soon = endingSoon(p, c.phases, today);
                  const col = TRACK_COLOR[p.track];
                  const tip = phaseTip(p, today);
                  const label = sp.width >= TINY.label;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`pov-bar ${st}${soon ? " soon" : ""}${sp.clipStart ? " clip-l" : ""}${sp.clipEnd ? " clip-r" : ""}`}
                      style={{ left: `${sp.left * 100}%`, width: `${sp.width * 100}%`, "--c": col.c, "--rgb": col.rgb, "--tint": col.tint, "--line": col.line } as React.CSSProperties}
                      title={tip}
                      aria-label={tip}
                      onClick={() => onPick({ client: c, phase: p })}
                    >
                      {label && <span>{p.name}</span>}
                      {label && soon && <em>{soonTag(daysLeft(p, today))}</em>}
                    </button>
                  );
                })}
              </div>
            ))}
            {Array.from({ length: eventRows }, (_, r) => (
              <div key={r} className="pov-ev-row" aria-label={r === 0 ? "Events" : undefined}>
                {events.placed
                  .filter((pe) => pe.row === r)
                  .map(({ event: e, x }) => {
                    const t = eventTypeOf(e.kind);
                    const tip = eventTip(e);
                    const sp = e.end > e.start ? spanOf(e.start, e.end, range) : null;
                    return (
                      <span key={e.id} className="pov-ev-slot" style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
                        {sp && sp.width > 0 && <i className="pov-ev-range" style={{ left: `${sp.left * 100}%`, width: `${sp.width * 100}%` }} aria-hidden="true" />}
                        <button type="button" className="pov-ev" style={{ left: `${x * 100}%` }} title={tip} aria-label={tip} onClick={() => onPick({ client: c, event: e })}>
                          <span className="pov-ev-mark">
                            <EventIcon kind={e.kind} />
                          </span>
                          <span className="pov-ev-label">{e.title}</span>
                        </button>
                      </span>
                    );
                  })}
                {r === 0 &&
                  events.overflow.map((o) => (
                    <PopoverPrimitive.Root key={o.x}>
                      <PopoverPrimitive.Trigger className="pov-ev-more" style={{ left: `${o.x * 100}%` }} aria-label={`${o.events.length} more events`}>
                        +{o.events.length}
                      </PopoverPrimitive.Trigger>
                      <PopoverPrimitive.Portal>
                        <PopoverPrimitive.Content align="start" sideOffset={6} className="pb-menu pov-ev-list">
                          {o.events.map((e) => {
                            const t = eventTypeOf(e.kind);
                            return (
                              <button key={e.id} type="button" className="pov-ev-list-row" style={{ "--c": t.color } as React.CSSProperties} onClick={() => onPick({ client: c, event: e })}>
                                <span className="pov-ev-mark small">
                                  <EventIcon kind={e.kind} size={10} />
                                </span>
                                <b>{e.title}</b>
                                <small>{shortDate(e.start)}</small>
                              </button>
                            );
                          })}
                        </PopoverPrimitive.Content>
                      </PopoverPrimitive.Portal>
                    </PopoverPrimitive.Root>
                  ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
