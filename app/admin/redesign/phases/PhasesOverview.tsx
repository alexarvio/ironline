"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover as PopoverPrimitive } from "radix-ui";
import { toast } from "sonner";
import { addClientEventAction, addClientPhaseAction, removeClientPhaseAction, updateClientPhaseAction } from "../../../lib/actions";
import { Dialog } from "../../../components/ui/dialog";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "../../../components/icons";
import { EVENT_TYPES, isEventTypeId } from "../../../lib/eventTypes";
import { dayMonth } from "../../../lib/dayMonth";
import type { PhaseTrack } from "../../../lib/db";
import { TRACK_ACCENT, TRACK_LABEL } from "../../phaseChrome";
import { gridFor, PhaseDialog, phaseForm, TrackIcon, WINDOWS, type Win } from "../plan/PlanDraft";
import { chromeOf, EV_LANE, EventDialog, KindIcon, rgbOf, type Category } from "../plan/EventsCard";
import { EventMark, eventPlace, LaneLabel, MonthsRow, packLanes, PhaseBar, weekSpan, WeeksRow, type Grid } from "../plan/timelineParts";
import DatePick from "../DatePick";
import { Sep } from "../Sep";
import { Fold } from "../Fold";
import PhaseDetailDialog from "./PhaseDetailDialog";
import EventDetailDialog from "./EventDetailDialog";
import type { OverviewClient, PhasesOverviewData } from "./load";
import { addDays, clientStatus, daysLeft, endingSoon, leftLabel, mondayOf, needsAttention, progressOf, soonPhases, TRACKS, weekIndexOf, weeksOf, type OverviewEvent, type OverviewPhase } from "./timeline";

// The Phases overview (14 Oct; drawn as the Plan since 21 Oct): Ending soon
// on top as a list to act on (Plan next, Extend), then every client on one
// timeline. The timeline is the Plan's (plan/timelineParts.tsx): months over
// weeks, the NOW line, and per client a name row over the three tracks
// (Lifestyle, Training, Nutrition) and their event kinds, each bar and pin
// as the Plan draws it. An empty week is a way in: New phase on that track,
// or New event of that kind, from there. A bar or pin opens its detail.
// The maths of ending soon and attention lives in timeline.ts.

const ALL_TRACKS = new Set<PhaseTrack>(TRACKS);
const EXTENDS = [1, 2, 4];
const first = (name: string) => name.split(" ")[0];
const PLAN = (id: number) => `/admin/redesign/plan?client=${id}`;

type View = "all" | "attention";
/** folded: the clients folded down to their name row (21 Oct, Alex), kept with the rest. */
type Prefs = { win: Win; view: View; folded: number[] };
const DEFAULT_PREFS: Prefs = { win: 13, view: "all", folded: [] };
const prefsKey = (coachId: number) => `norcoach:phases:${coachId}`;
/** What this screen saved before (3, 6 or 12 months), as the Plan's windows. */
const FROM_MONTHS: Record<number, Win> = { 3: 13, 6: 26, 9: 39, 12: 52 };
const isWin = (n: unknown): n is Win => WINDOWS.some((w) => w.weeks === n);

type Picked = { client: OverviewClient; phase: OverviewPhase } | { client: OverviewClient; event: OverviewEvent } | null;

const NONE_LEAVING = new Set<number>();

export default function PhasesOverview({ data }: { data: PhasesOverviewData }) {
  const router = useRouter();
  const [, start] = useTransition();
  const { today, thisWeek, intoWeek, coachId, clients, categories } = data;

  // What the coach last chose, kept per coach in this browser.
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(prefsKey(coachId));
      if (raw) {
        const p = JSON.parse(raw) as { win?: unknown; months?: unknown; view?: unknown; folded?: unknown };
        const win = isWin(p.win) ? p.win : (typeof p.months === "number" && FROM_MONTHS[p.months]) || DEFAULT_PREFS.win;
        const folded = Array.isArray(p.folded) ? p.folded.filter((x): x is number => typeof x === "number") : [];
        start(() => setPrefs({ win, view: p.view === "attention" ? "attention" : "all", folded }));
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

  // The window, the Plan's: last week for context, this week second, the NOW line in it; ‹ steps back a month at a time.
  const [back, setBack] = useState(0);
  const grid = gridFor(prefs.win, thisWeek, intoWeek, back);

  // The three readings of the same data: the list, the toggle's count, the order.
  const soonRows = useMemo(
    () =>
      clients
        .flatMap((c) => soonPhases(c, ALL_TRACKS, today).map((phase) => ({ client: c, phase })))
        .sort((a, b) => (a.phase.end < b.phase.end ? -1 : a.phase.end > b.phase.end ? 1 : a.client.name.localeCompare(b.client.name))),
    [clients, today]
  );
  // All clients: A to Z, nothing else (14 Oct, Alex). Needs attention: only those with a phase ending soon, A to Z too.
  const sorted = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)), [clients]);
  const attention = useMemo(() => sorted.filter((c) => needsAttention(c, ALL_TRACKS, today)), [sorted, today]);
  const shown = prefs.view === "attention" ? attention : sorted;

  // A pin's label needs room to its right, measured against the grid as the Plan does.
  const weeksRef = useRef<HTMLDivElement>(null);
  const [gridPx, setGridPx] = useState(0);
  const hasRows = shown.length > 0;
  useEffect(() => {
    const el = weeksRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setGridPx(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasRows]);
  const dayPx = gridPx > 0 ? gridPx / (grid.count * 7) : 9;

  // Acting on a phase: the row folds away, the change saves, Undo puts it back. A row is held away only until the
  // server's next read lands (a new `data`): still ending soon after it (extended by a week), it comes back.
  const [leavingOf, setLeavingOf] = useState<{ of: PhasesOverviewData; ids: Set<number> } | null>(null);
  const leaving = leavingOf && leavingOf.of === data ? leavingOf.ids : NONE_LEAVING;
  const [picked, setPicked] = useState<Picked>(null);
  const [newPhase, setNewPhase] = useState<{ client: OverviewClient; track: PhaseTrack; start: string; /** Plan next: the track is given. From an empty week: the coach can still pick. */ lock: boolean } | null>(null);
  const [newEvent, setNewEvent] = useState<{ client: OverviewClient; day: string; /** From a kind's lane: that kind (null for "Event"); else the dialog's own first pick. */ kind?: string | null } | null>(null);
  const leave = (id: number) => setLeavingOf((s) => ({ of: data, ids: new Set(s && s.of === data ? s.ids : []).add(id) }));
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
      `${p.name} now ends ${dayMonth(addDays(endWeek, 6))}`,
      () => updateClientPhaseAction(form(p.endWeek))
    );
  };

  return (
    // rd pln: the Plan's hairline language (plan.css), so its bars, pins, buttons and sections are the same here.
    <div className="rd pln pov">
      <header className="rd-head bare">
        <div className="rd-head-main">
          <h1 className="rd-title">Phases</h1>
        </div>
      </header>

      {/* ---- Ending soon: a row a phase, soonest first. Hidden when there is nothing to act on. */}
      {soonRows.length > 0 && (
        <section className="pln-section" aria-label="Ending soon">
          <div className="rn-card-head">
            {/* No count after it (21 Oct, Alex): the rows say how many. */}
            <h2>Ending soon</h2>
          </div>
          <ul className="pln-card pov-soon-list">
            {soonRows.map(({ client, phase }) => {
              const accent = TRACK_ACCENT[phase.track];
              const at = `Week ${weekIndexOf(phase, today)} of ${weeksOf(phase)}`;
              return (
                <li key={phase.id} className={`pov-soon-row${leaving.has(phase.id) ? " leaving" : ""}`} style={{ "--c": accent, "--rgb": rgbOf(accent) } as React.CSSProperties}>
                  <span className="pov-tag">
                    <TrackIcon track={phase.track} size={12} />
                    {TRACK_LABEL[phase.track]}
                  </span>
                  <span className="pov-who">
                    <Link href={PLAN(client.id)} className="pov-who-name">
                      {client.name}
                    </Link>
                    <Sep />
                    <span className="pov-who-what">{phase.name}</span>
                  </span>
                  <span className="pov-left">{leftLabel(daysLeft(phase, today))}</span>
                  <span className="pov-prog" role="img" title={at} aria-label={at}>
                    <i style={{ width: `${progressOf(phase, today) * 100}%` }} />
                  </span>
                  <span className="pov-actions">
                    <button type="button" className="rd-btn" onClick={() => setNewPhase({ client, track: phase.track, start: addDays(phase.end, 1), lock: true })}>
                      <PlusIcon /> Plan next
                    </button>
                    <ExtendMenu phase={phase} onPick={(endWeek) => extend(phase, endWeek)} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ---- Every client on the Plan's timeline. */}
      <section className="pln-section">
        <div className="rn-card-head">
          <h2>Clients</h2>
          <div className="rq-ev-tools">
            <div className="rd-btn-group" role="group" aria-label="Which clients">
              <button type="button" className={prefs.view === "all" ? "on" : ""} aria-pressed={prefs.view === "all"} onClick={() => setPrefs((p) => ({ ...p, view: "all" }))}>
                All clients
                <Sep />
                {clients.length}
              </button>
              <button type="button" className={prefs.view === "attention" ? "on" : ""} aria-pressed={prefs.view === "attention"} onClick={() => setPrefs((p) => ({ ...p, view: "attention" }))}>
                Needs attention
                <Sep />
                {attention.length}
              </button>
            </div>
            <div className="rq-pan" role="group" aria-label="Move in time">
              <button type="button" className="rd-btn ghost" onClick={() => setBack((b) => b + 4)} aria-label="Earlier" title="Earlier">
                <ChevronLeftIcon />
              </button>
              <button type="button" className="rd-btn ghost rq-today" disabled={back === 0} onClick={() => setBack(0)}>
                Today
              </button>
              <button type="button" className="rd-btn ghost" disabled={back === 0} onClick={() => setBack((b) => Math.max(0, b - 4))} aria-label="Later" title="Later">
                <ChevronRightIcon />
              </button>
            </div>
            <div className="rd-btn-group" role="group" aria-label="Time shown">
              {WINDOWS.map((w) => (
                <button key={w.weeks} type="button" className={prefs.win === w.weeks ? "on" : ""} aria-pressed={prefs.win === w.weeks} onClick={() => setPrefs((p) => ({ ...p, win: w.weeks }))}>
                  {w.months} months
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="pln-card">
          {clients.length === 0 ? (
            <p className="pov-empty">No clients yet</p>
          ) : shown.length === 0 ? (
            <p className="pov-empty">Nobody</p>
          ) : (
            <div className="rq-tl-scroll">
              <div className="rq-tl" style={{ minWidth: Math.round(grid.count * 63) }}>
                <MonthsRow grid={grid} />
                <div className="rq-tl-body">
                  {/* The Plan places the line past its 108px labels; here the label column is wider (--pov-lbl, phases.css). */}
                  {grid.nowLeft && <span className="rq-now" style={{ left: grid.nowLeft.split("108px").join("var(--pov-lbl)") }} title="Now" />}
                  <WeeksRow grid={grid} gridRef={weeksRef} />
                  {shown.map((c) => (
                    <ClientBlock
                      key={c.id}
                      client={c}
                      grid={grid}
                      today={today}
                      thisWeek={thisWeek}
                      intoWeek={intoWeek}
                      dayPx={dayPx}
                      cats={categories}
                      onPick={setPicked}
                      onNewPhase={(track, startWeek) => setNewPhase({ client: c, track, start: startWeek, lock: false })}
                      onNewEvent={(day, kind) => setNewEvent({ client: c, day, kind })}
                      folded={prefs.folded.includes(c.id)}
                      onFold={() => setPrefs((p) => ({ ...p, folded: p.folded.includes(c.id) ? p.folded.filter((x) => x !== c.id) : [...p.folded, c.id] }))}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---- A bar's detail (PhaseDetailDialog, read-only), or a pin's, and the way to the client's tab. */}
      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        {picked &&
          ("phase" in picked ? (
            <PhaseDetailDialog client={picked.client} phase={picked.phase} today={today} onMove={(p) => setPicked({ client: picked.client, phase: p })} />
          ) : (
            <EventDetailDialog client={picked.client} event={picked.event} today={today} />
          ))}
      </Dialog>

      {/* ---- New phase, the Plan's own dialog: Plan next opens on the track and the day after the one ending; an empty week on that week. */}
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
                toast(`${v.name} drafted on ${TRACK_LABEL[v.track]} for ${first(client.name)}: ${dayMonth(v.start)} – ${dayMonth(addDays(v.end, 6))}`, {
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

      {/* ---- New event, the Plan's own dialog, on the day clicked and its lane's kind. */}
      <Dialog open={!!newEvent} onOpenChange={(o) => !o && setNewEvent(null)}>
        {newEvent && (
          <EventDialog
            today={today}
            event={null}
            cats={categories}
            initialStart={newEvent.day}
            initialKind={newEvent.kind}
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

/** Extend: a week or two or four more, or a day picked, to the end of its week (every track runs in whole weeks, 21 Oct). */
function ExtendMenu({ phase, onPick }: { phase: OverviewPhase; onPick: (endWeek: string) => void }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const byWeeks = (n: number) => addDays(phase.endWeek, n * 7);
  const byDay = (lastDay: string) => mondayOf(lastDay);
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPicking(false);
      }}
    >
      <PopoverPrimitive.Trigger className="rd-btn" aria-label={`Extend ${phase.name}`}>
        Extend <ChevronDownIcon />
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
              {/* The weeks alone (21 Oct, Alex: no "to 1/11"); the new end shows in the toast. */}
              +{n} week{n === 1 ? "" : "s"}
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

/** One client on the timeline: a name row, then the three tracks and their event kinds, each lane as the Plan's. */
function ClientBlock({
  client: c,
  grid,
  today,
  thisWeek,
  intoWeek,
  dayPx,
  cats,
  onPick,
  onNewPhase,
  onNewEvent,
  folded,
  onFold,
}: {
  client: OverviewClient;
  grid: Grid;
  today: string;
  thisWeek: string;
  intoWeek: number;
  dayPx: number;
  cats: Category[];
  onPick: (p: Picked) => void;
  onNewPhase: (track: PhaseTrack, startWeek: string) => void;
  onNewEvent: (day: string, kind?: string | null) => void;
  /** Folded down to its name row (21 Oct, Alex: a chevron after the name). */
  folded: boolean;
  onFold: () => void;
}) {
  const status = clientStatus(c, ALL_TRACKS, today);
  // Said only when something is ending (14 Oct): a quiet row says nothing after the name.
  const statusText = status.kind === "soon" ? `${TRACK_LABEL[status.track]} ends ${status.days <= 0 ? "today" : `in ${status.days} day${status.days === 1 ? "" : "s"}`}` : null;
  const { weeks, count, nowIdx, cols } = grid;
  const totalDays = count * 7;
  // "None yet + Add" from this week on, as the Plan's; not when this week is off the window.
  const emptyAt: React.CSSProperties | null = nowIdx < count ? { gridColumn: `${nowIdx + 1} / span ${Math.min(count - nowIdx, 8)}`, gridRow: 1 } : null;
  // An empty spot is a way in: the day under the pointer in its week's column, the lane's kind.
  const addAt = (week: string, ev: React.MouseEvent<HTMLElement>, kind?: string | null) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const day = Math.max(0, Math.min(6, Math.floor(((ev.clientX - r.left) / Math.max(1, r.width)) * 7)));
    onNewEvent(addDays(week, day), kind);
  };

  // Events: a row a kind with something on the grid, in the app's kind order, "Event" last; overlapping ones stack into lanes, a pin's label taking room too.
  const onGrid = c.events.filter((e) => eventPlace(e, grid.first, totalDays).visible).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id));
  const reach = (e: OverviewEvent) => (e.start === e.end ? addDays(e.start, Math.ceil((e.title.length * 6.6 + 28) / dayPx)) : e.end);
  const evLane = new Map<number, number>();
  const groups = [...EVENT_TYPES.map((t) => t.id), null]
    .map((id) => ({ id, chrome: chromeOf(cats, id), events: onGrid.filter((e) => (isEventTypeId(e.kind) ? e.kind : null) === id) }))
    .filter((g) => g.events.length > 0)
    .map((g) => {
      const lanes: OverviewEvent[][] = [];
      for (const e of g.events) {
        let li = lanes.findIndex((l) => l.every((q) => reach(q) < e.start || q.start > reach(e)));
        if (li < 0) {
          lanes.push([]);
          li = lanes.length - 1;
        }
        lanes[li].push(e);
        evLane.set(e.id, li);
      }
      return { ...g, laneCount: Math.max(1, lanes.length) };
    });

  return (
    <div role="group" aria-label={statusText ? `${c.name}, ${statusText}` : c.name} className="pov-client">
      {/* A click anywhere on the row folds or opens the client (21 Oct, Alex); the name still opens their Plan. */}
      <div className="pov-client-head" onClick={onFold}>
        <span className="pov-client-id">
          <span className="pov-avatar">
            {c.avatarPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
              <img src={c.avatarPath} alt="" />
            ) : (
              c.name.slice(0, 1).toUpperCase()
            )}
          </span>
          <Link href={PLAN(c.id)} className="pov-client-name" onClick={(e) => e.stopPropagation()}>
            {c.name}
          </Link>
          {/* Fold the client down to this row, or open it again (21 Oct, Alex): the chevron right after the name. */}
          <button type="button" className="pov-fold" onClick={(e) => {
              e.stopPropagation();
              onFold();
            }} aria-expanded={!folded} aria-label={folded ? `Show ${c.name}` : `Fold ${c.name}`} title={folded ? "Show" : "Fold"}>
            <Fold open={!folded} />
          </button>
          {statusText && (
            <>
              <Sep />
              <span className="pov-status">{statusText}</span>
            </>
          )}
        </span>
      </div>

      {!folded && (
        <>
      {/* Phases and events apart (21 Oct, Alex: not the same thing): each under its own quiet head with its + Add on the
          right, the events under a dashed line and a little air. Then the three tracks, always, in their order. */}
      <div className="pov-sub">
        <span className="pov-sub-label">Phases</span>
        <button type="button" className="pov-add" onClick={() => onNewPhase("training", thisWeek)} aria-label={`New phase for ${c.name}`}>
          <PlusIcon /> Add
        </button>
      </div>
      {TRACKS.map((t) => {
        const mine = c.phases.filter((p) => p.track === t).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
        const drawn = mine.filter((p) => weekSpan(p.start, p.endWeek, grid.first, count).visible);
        const lanes = packLanes(drawn, (p) => {
          const s = weekSpan(p.start, p.endWeek, grid.first, count);
          return { from: s.sc, to: s.ec };
        });
        return (
          <div key={t} className="rq-tl-row">
            <LaneLabel icon={<TrackIcon track={t} size={16} />} color={TRACK_ACCENT[t]} label={TRACK_LABEL[t]} />
            <div className="rq-tl-clip">
              <div className="rq-tl-grid rq-lanes" style={{ ...cols, gridTemplateRows: `repeat(${lanes.count}, 44px)` }}>
                {/* An empty week on a lane is a way in (the Plan's): New phase on this track, from that week. Bars sit over it. */}
                {weeks.map((w, i) => (
                  <span
                    key={w}
                    className="rq-cell add"
                    style={{ gridColumn: i + 1, gridRow: `1 / span ${lanes.count}` }}
                    role="button"
                    tabIndex={-1}
                    aria-label={`New ${TRACK_LABEL[t].toLowerCase()} phase for ${c.name} from ${dayMonth(w)}`}
                    title={`${TRACK_LABEL[t]} · ${dayMonth(w)}`}
                    onClick={() => onNewPhase(t, w)}
                  />
                ))}
                {mine.length === 0 && emptyAt && (
                  <button type="button" className="rq-empty" style={emptyAt} onClick={() => onNewPhase(t, thisWeek)}>
                    None yet <b>+ Add</b>
                  </button>
                )}
                {drawn.map((p) => (
                  <PhaseBar
                    key={p.id}
                    phase={{ id: p.id, name: p.name, track: p.track, startWeek: p.start, endWeek: p.endWeek, draft: p.draft, gap: p.gap }}
                    grid={grid}
                    row={lanes.laneOf.get(p.id) ?? 0}
                    today={today}
                    thisWeek={thisWeek}
                    intoWeek={intoWeek}
                    onOpen={() => onPick({ client: c, phase: p })}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Events: their own head, then a row a kind with something on the grid; none on the grid, None yet in the head. */}
      <div className="pov-sub ev">
        <span className="pov-sub-label">
          Events{groups.length === 0 && <em>None yet</em>}
        </span>
        <button type="button" className="pov-add" onClick={() => onNewEvent(today)} aria-label={`New event for ${c.name}`}>
          <PlusIcon /> Add
        </button>
      </div>
      {groups.map((g) => (
          <div key={g.id ?? "none"} className="rq-tl-row">
            <LaneLabel icon={<KindIcon id={g.id} size={16} />} color={g.chrome.ink} label={g.chrome.label} />
            <div className="rq-tl-clip">
              <div className="rq-tl-grid rq-lanes rq-evlanes" style={{ ...cols, gridTemplateRows: `repeat(${g.laneCount}, ${EV_LANE}px)` }}>
                {weeks.map((w, i) => (
                  <span key={w} className="rq-cell add" style={{ gridColumn: i + 1, gridRow: `1 / span ${g.laneCount}` }} role="button" tabIndex={-1} aria-label={`New ${g.chrome.label.toLowerCase()} for ${c.name} in the week of ${dayMonth(w)}`} onClick={(ev) => addAt(w, ev, g.id)} />
                ))}
                {g.events.map((e) => (
                  <EventMark key={e.id} e={e} place={eventPlace(e, grid.first, totalDays)} lane={evLane.get(e.id) ?? 0} today={today} cats={cats} onOpen={() => onPick({ client: c, event: e })} />
                ))}
              </div>
            </div>
          </div>
        ))}
        </>
      )}
    </div>
  );
}
