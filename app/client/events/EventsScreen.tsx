"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { clientAddEventAction, clientDeleteEventAction, clientUpdateEventAction } from "../../lib/actions";
import { eventTypeOf, isEventTypeId, type EventTypeId } from "../../lib/eventTypes";
import { dayOf, rangeLabel, relativeLabel, shortDay, statusOf, todayLabel } from "../../lib/eventDates";
import { ChevronLeftIcon } from "../../components/icons";
import { useCoachIdentity } from "../CheckInContext";
import type { HomeEvent, HomeEvents } from "../EventsCard";
import AddEventSheet, { TypeIcon, type EventValues } from "./AddEventSheet";
import { CoachAvatar } from "./CoachAvatar";

// The Events screen (9 Oct), the "Today line": everything in the client's
// life the plan should know about, on one rail. Coming up runs down to a
// TODAY line, what is happening now sits just under it, and earlier ones
// fade below. The client adds from the navy card on top; the coach's own
// carry the coach's face and can only be read. A row with more to it (a
// note, or the client's own with Edit and Delete) opens in place on a tap.

type Sheet = { event: HomeEvent | null; type: EventTypeId; initial?: EventValues | null; error?: string | null } | null;
const LAST_TYPE_KEY = "ironline:last-event-type";

// `me` is the client's own first name and photo (9 Oct): on the rows they added, their face, as the coach's is on the coach's.
export default function EventsScreen({ clientId, events, coachName, today, me = null, focusId = null, onBack }: { clientId: number; events: HomeEvents; coachName: string; today: string; me?: { name: string; photoPath: string | null } | null; /** An event to land on (10 Oct), from a notification: the screen scrolls to it, it glows, and it opens when there is a note. */ focusId?: number | null; onBack: () => void }) {
  const router = useRouter();
  const coach = useCoachIdentity();
  const coachPhoto = coach?.photoPath ?? null;

  // ---- The list: the server's, plus what was just added and not back yet.
  const [added, setAdded] = useState<HomeEvent[]>([]);
  const serverKey = events.list.map((e) => `${e.id}:${e.title}:${e.start}:${e.end}`).join("|");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setAdded([]);
  }
  const list = [...events.list, ...added];
  const byStart = (a: HomeEvent, b: HomeEvent) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id);
  const upcoming = list.filter((e) => statusOf(e, today) === "next").sort(byStart).reverse();
  const now = list.filter((e) => statusOf(e, today) === "now").sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : a.id - b.id));
  const past = list.filter((e) => statusOf(e, today) === "past").sort(byStart).reverse();

  // ---- The sheet, the row open in place, and a save on its way.
  const [sheet, setSheet] = useState<Sheet>(null);
  // Landed on from a notification: that event starts open (when it has more to show) and lit.
  const focused = focusId != null ? (events.list.find((e) => e.id === focusId) ?? null) : null;
  const [open, setOpen] = useState<number | null>(focused && hasMore(focused) ? focused.id : null);
  const [pending, setPending] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  // Landed on: scrolled to and open, nothing lit (10 Oct, after a flash and then a pulse both felt off).
  const landed = useRef(false);
  useEffect(() => {
    if (!focused || landed.current) return;
    landed.current = true;
    const t = setTimeout(() => rows.current.get(focused.id)?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
    return () => clearTimeout(t);
  }, [focused]);
  const rows = useRef(new Map<number, HTMLElement>());
  const lastType = (): EventTypeId => {
    try {
      const v = localStorage.getItem(LAST_TYPE_KEY);
      return isEventTypeId(v) ? v : "trip";
    } catch {
      return "trip";
    }
  };
  const openAdd = () => setSheet({ event: null, type: lastType() });

  const todayRef = useRef<HTMLDivElement>(null);
  const centred = useRef(false);
  useEffect(() => {
    if (centred.current) return;
    centred.current = true;
    // Opened on an event: the highlight below brings it into view instead of today.
    if (focused) return;
    const el = (now[0] && rows.current.get(now[0].id)) || todayRef.current;
    el?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (highlight == null) return;
    const el = rows.current.get(highlight);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setHighlight(null), 900);
    return () => clearTimeout(t);
  }, [highlight]);

  const save = async (v: EventValues) => {
    const s = sheet;
    if (!s) return;
    try {
      localStorage.setItem(LAST_TYPE_KEY, v.type);
    } catch {}
    const input = { kind: v.type, title: v.title, start: v.start, end: v.end, note: v.note };
    setSheet(null);
    if (s.event) {
      setPending(true);
      try {
        await clientUpdateEventAction(clientId, s.event.id, input);
        router.refresh();
        setHighlight(s.event.id);
      } catch {
        setSheet({ ...s, initial: v, error: "That didn't save. Try again." });
      } finally {
        setPending(false);
      }
      return;
    }
    // In its place at once; the server's copy replaces it on the refresh.
    const temp: HomeEvent = { id: -Date.now(), kind: v.type, title: v.title, start: v.start, end: v.end, note: v.note, mine: true };
    setAdded((a) => [...a, temp]);
    setHighlight(temp.id);
    try {
      const id = await clientAddEventAction(clientId, input);
      if (id == null) throw new Error("not saved");
      router.refresh();
    } catch {
      setAdded((a) => a.filter((e) => e.id !== temp.id));
      setSheet({ event: null, type: v.type, initial: v, error: "That didn't save. Try again." });
    }
  };

  const remove = async (e: HomeEvent) => {
    setPending(true);
    try {
      await clientDeleteEventAction(clientId, e.id);
      setOpen(null);
      setSheet(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const total = upcoming.length + now.length + past.length;
  const tl = todayLabel(today);
  const rowProps = (e: HomeEvent): RowProps => ({
    e,
    today,
    coachName,
    coachPhoto,
    me,
    lit: highlight === e.id,
    open: open === e.id,
    pending,
    refFn: (el) => el && rows.current.set(e.id, el),
    onToggle: () => setOpen((o) => (o === e.id ? null : e.id)),
    onEdit: () => setSheet({ event: e, type: eventTypeOf(e.kind).id }),
    onDelete: () => remove(e),
  });

  return (
    <>
      <header className="cn-header ev-nav">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">Events</h1>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>
      <main className="cn-body">
        {/* The add card above the list, not in it (10 Oct): rows slide under its edge instead of showing round it. */}
        <div className="ev-top">
          <AddEventCard coachName={coachName} onOpen={openAdd} />
        </div>
        <div className="ev-scroll">

          <div className="ev-tl">
            {upcoming.length > 0 && <div className="ev-sec ev-sec-up">Coming up</div>}
            {upcoming.map((e) => (
              <UpcomingRow key={e.id} {...rowProps(e)} />
            ))}

            <div ref={todayRef} className="ev-today" role="separator" aria-label={tl.long}>
              <span className="ev-td" aria-hidden="true" />
              <span className="ev-rail ev-rail-today" aria-hidden="true">
                <i />
              </span>
              <span className="ev-today-label">Today · {tl.short}</span>
              <span className="ev-today-rule" aria-hidden="true" />
            </div>

            {now.map((e) => (
              <NowCard key={e.id} {...rowProps(e)} />
            ))}

            {total === 0 && <p className="ev-none">Nothing logged yet.</p>}

            {past.length > 0 && <div className="ev-sec ev-sec-past">Past</div>}
            {past.map((e) => (
              <PastRow key={e.id} {...rowProps(e)} />
            ))}
          </div>
        </div>
      </main>

      {sheet && <AddEventSheet event={sheet.event} initialType={sheet.type} initial={sheet.initial ?? null} error={sheet.error ?? null} coachName={coachName} today={today} pending={pending} onClose={() => setSheet(null)} onSubmit={save} onDelete={sheet.event ? () => remove(sheet.event!) : undefined} />}
    </>
  );
}

// ---- The add card: the ask and a round +; the type is picked on the sheet.

function AddEventCard({ coachName, onOpen }: { coachName: string; onOpen: () => void }) {
  return (
    <section className="ev-addcard" aria-label="Add an event">
      <span className="ev-addcard-glow" aria-hidden="true" />
      <button type="button" className="ev-addcard-top" onClick={() => onOpen()}>
        <span className="ev-addcard-text">
          <b>Add an event</b>
          <small>A trip, an injury, the day you started something. {coachName} sees it on your plan.</small>
        </span>
        <span className="ev-addcard-plus" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
    </section>
  );
}

// ---- The rows. Each is a card with a head (the tap) and, when there is
// more to it, a body that opens in place: the note, who set it, and for
// the client's own, Edit and Delete.

type RowProps = { e: HomeEvent; today: string; coachName: string; coachPhoto: string | null; me: { name: string; photoPath: string | null } | null; lit: boolean; open: boolean; pending: boolean; refFn: (el: HTMLElement | null) => void; onToggle: () => void; onEdit: () => void; onDelete: () => void };

// Every event opens, the coach's too, with Edit and Delete (10 Oct); a phase only when it has objectives to show.
const hasMore = (e: HomeEvent) => (e.phase ? !!e.note : true);
// A phase on the timeline (9 Oct): the track's colour, as the plan draws it. One flag for every phase (10 Oct), so a
// phase reads as a phase at a glance, the colour saying which track; the event types keep their own icons.
const PHASES = {
  training: { label: "Training phase", color: "#4c42a8", rgb: "76,66,168", icon: "M5 21V4M5 4h11.5l-2.5 4.5 2.5 4.5H5", fill: undefined as string | undefined },
  nutrition: { label: "Nutrition phase", color: "#1f7a4d", rgb: "31,122,77", icon: "M5 21V4M5 4h11.5l-2.5 4.5 2.5 4.5H5", fill: undefined as string | undefined },
  lifestyle: { label: "Lifestyle phase", color: "#a8761f", rgb: "168,118,31", icon: "M5 21V4M5 4h11.5l-2.5 4.5 2.5 4.5H5", fill: undefined as string | undefined },
};
const chromeOf = (e: HomeEvent) => (e.phase ? PHASES[e.phase] : eventTypeOf(e.kind));
/** The face on the row: the coach's on theirs; on what the client added, their own photo when they set one in Settings, else nothing. */
function SetBy({ e, coachName, coachPhoto, me, size, ring }: Pick<RowProps, "e" | "coachName" | "coachPhoto" | "me"> & { size: number; ring: "card" | "row" }) {
  if (!e.mine) return <CoachAvatar name={coachName} photoPath={coachPhoto} size={size} ring={ring} />;
  if (!me?.photoPath) return null;
  return <CoachAvatar name={me.name || "You"} photoPath={me.photoPath} size={size} ring={ring} />;
}

const rowLabel = (e: HomeEvent, today: string, coachName: string) => `${e.title}, ${chromeOf(e).label}, ${rangeLabel(e, today)}, ${relativeLabel(e, today)}${e.mine ? "" : `, set by ${coachName}`}`;

function RowMore({ e, open, coachName, pending, onEdit, onDelete }: Pick<RowProps, "e" | "open" | "coachName" | "pending" | "onEdit" | "onDelete">) {
  const [sure, setSure] = useState(false);
  if (!hasMore(e)) return null;
  return (
    <div className={`ev-x${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="ev-x-clip">
        <div className="ev-x-in">
          {e.note && <p className="ev-x-note">{e.note}</p>}
          <span className="ev-x-by">{e.mine ? `Added by you · ${coachName} can see it` : e.phase ? `Set by ${coachName}` : `Set by ${coachName} · you can change it`}</span>
          {!e.phase && (
            <div className="ev-x-actions">
              <button type="button" className="ev-btn" onClick={onEdit} disabled={pending || !open} tabIndex={open ? 0 : -1}>
                Edit
              </button>
              <button type="button" className={`ev-btn danger${sure ? " sure" : ""}`} onClick={() => (sure ? onDelete() : setSure(true))} disabled={pending || !open} tabIndex={open ? 0 : -1}>
                {pending ? "Removing…" : sure ? "Yes, remove it" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chevron({ e, open }: { e: HomeEvent; open: boolean }) {
  if (!hasMore(e)) return null;
  return (
    <span className={`ev-chev${open ? " open" : ""}`} aria-hidden="true">
      ›
    </span>
  );
}

function UpcomingRow(p: RowProps) {
  const { e, today, coachName, coachPhoto, me, lit, open, refFn, onToggle } = p;
  const t = chromeOf(e);
  return (
    <div ref={refFn} className={`ev-r ev-r-up${lit ? " lit" : ""}`} style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
      <span className="ev-td" aria-hidden="true">
        <b>{Number(e.start.slice(8, 10))}</b>
        <small>{shortDay(e.start, today).split(" ")[1]}</small>
      </span>
      <span className="ev-rail" aria-hidden="true">
        <i className="ev-dot-ring">
          <TypeIcon path={t.icon} fill={t.fill} size={20} stroke={2.1} />
        </i>
      </span>
      <span className="ev-cell">
        <div className={`ev-card${open ? " open" : ""}`}>
          <button type="button" className="ev-head" onClick={onToggle} disabled={!hasMore(e)} aria-expanded={hasMore(e) ? open : undefined} aria-label={rowLabel(e, today, coachName)}>
            <span className="ev-card-row">
              <span className="ev-card-lead">
                <span className="ev-card-title">{e.title}</span>
                <Chevron e={e} open={open} />
              </span>
              <SetBy e={e} coachName={coachName} coachPhoto={coachPhoto} me={me} size={24} ring="card" />
            </span>
            {/* The dates only, and only for a stretch: a single day is on the rail, and "in 6 days" went (9 Oct), the rail says when. */}
            {e.start !== e.end && <span className="ev-card-meta">{rangeLabel(e, today)}</span>}
          </button>
          <RowMore {...p} />
        </div>
      </span>
    </div>
  );
}

function NowCard(p: RowProps) {
  const { e, today, coachName, coachPhoto, me, lit, open, refFn, onToggle } = p;
  const t = chromeOf(e);
  const { day, total } = dayOf(e, today);
  return (
    <div ref={refFn} className={`ev-r ev-r-now${lit ? " lit" : ""}`} style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
      <span className="ev-td" aria-hidden="true" />
      <span className="ev-rail ev-rail-now" aria-hidden="true" />
      <span className="ev-cell">
        <div className={`ev-now${open ? " open" : ""}`}>
          <span className="ev-aura" aria-hidden="true" />
          <button type="button" className="ev-head" onClick={onToggle} disabled={!hasMore(e)} aria-expanded={hasMore(e) ? open : undefined} aria-label={rowLabel(e, today, coachName)}>
            <span className="ev-now-eyebrow">Happening now · {t.label}</span>
            <span className="ev-card-row">
              <span className="ev-card-lead">
                <span className="ev-card-title">{e.title}</span>
                <Chevron e={e} open={open} />
              </span>
              <SetBy e={e} coachName={coachName} coachPhoto={coachPhoto} me={me} size={24} ring="card" />
            </span>
            <span className="ev-bar" role="progressbar" aria-valuenow={day} aria-valuemin={1} aria-valuemax={total} aria-label={`Day ${day} of ${total}`}>
              <i style={{ width: `${(day / total) * 100}%` }} />
            </span>
            <span className="ev-now-meta">
              <span>
                Day {day} of {total}
              </span>
              <span>until {shortDay(e.end, today)}</span>
            </span>
          </button>
          <RowMore {...p} />
        </div>
      </span>
    </div>
  );
}

function PastRow(p: RowProps) {
  const { e, today, coachName, coachPhoto, me, lit, open, refFn, onToggle } = p;
  const t = chromeOf(e);
  return (
    <div ref={refFn} className={`ev-r ev-r-past${lit ? " lit" : ""}`} style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
      <span className="ev-td" aria-hidden="true">
        <b>{Number(e.start.slice(8, 10))}</b>
        <small>{shortDay(e.start, today).split(" ")[1]}</small>
      </span>
      <span className="ev-rail" aria-hidden="true">
        <i className="ev-dot-past">
          <TypeIcon path={t.icon} fill={t.fill} size={18} stroke={2.1} />
        </i>
      </span>
      <span className="ev-cell">
        <div className={`ev-past${open ? " open" : ""}`}>
          <button type="button" className="ev-head ev-past-head" onClick={onToggle} disabled={!hasMore(e)} aria-expanded={hasMore(e) ? open : undefined} aria-label={rowLabel(e, today, coachName)}>
            <span className="ev-past-text">
              <span className="ev-card-lead">
                <span className="ev-past-title">{e.title}</span>
                <Chevron e={e} open={open} />
              </span>
              {e.start !== e.end && <span className="ev-past-meta">{rangeLabel(e, today)}</span>}
            </span>
            <SetBy e={e} coachName={coachName} coachPhoto={coachPhoto} me={me} size={22} ring="row" />
          </button>
          <RowMore {...p} />
        </div>
      </span>
    </div>
  );
}
