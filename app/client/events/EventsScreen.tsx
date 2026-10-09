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
import EventDetail from "./EventDetail";
import { CoachAvatar } from "./CoachAvatar";

// The Events screen (9 Oct), the "Today line": everything in the client's
// life the plan should know about, on one rail. Coming up runs down to a
// TODAY line, what is happening now sits just under it, and earlier ones
// fade below. The client adds from the navy card on top; the coach's own
// carry the coach's face and can only be read.

type Sheet = { event: HomeEvent | null; type: EventTypeId; initial?: EventValues | null; error?: string | null } | null;
const LAST_TYPE_KEY = "ironline:last-event-type";

export default function EventsScreen({ events, coachName, today, onBack }: { events: HomeEvents; coachName: string; today: string; onBack: () => void }) {
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

  // ---- The sheet, the detail, and a save on its way.
  const [sheet, setSheet] = useState<Sheet>(null);
  const [detail, setDetail] = useState<HomeEvent | null>(null);
  const [pending, setPending] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const rows = useRef(new Map<number, HTMLElement>());
  const lastType = (): EventTypeId => {
    try {
      const v = localStorage.getItem(LAST_TYPE_KEY);
      return isEventTypeId(v) ? v : "trip";
    } catch {
      return "trip";
    }
  };
  const openAdd = (type?: EventTypeId) => setSheet({ event: null, type: type ?? lastType() });

  const todayRef = useRef<HTMLDivElement>(null);
  const centred = useRef(false);
  useEffect(() => {
    if (centred.current) return;
    centred.current = true;
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
        await clientUpdateEventAction(s.event.id, input);
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
      const id = await clientAddEventAction(input);
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
      await clientDeleteEventAction(e.id);
      setDetail(null);
      setSheet(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const total = upcoming.length + now.length + past.length;
  const tl = todayLabel(today);

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
        <div className="ev-scroll">
          <AddEventCard coachName={coachName} onOpen={openAdd} />

          <div className="ev-tl">
            {upcoming.length > 0 && <div className="ev-sec ev-sec-up">Coming up</div>}
            {upcoming.map((e) => (
              <UpcomingRow key={e.id} e={e} today={today} coachName={coachName} coachPhoto={coachPhoto} lit={highlight === e.id} refFn={(el) => el && rows.current.set(e.id, el)} onOpen={() => setDetail(e)} />
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
              <NowCard key={e.id} e={e} today={today} coachName={coachName} coachPhoto={coachPhoto} lit={highlight === e.id} refFn={(el) => el && rows.current.set(e.id, el)} onOpen={() => setDetail(e)} />
            ))}

            {total === 0 && <p className="ev-none">Nothing logged yet.</p>}

            {past.length > 0 && <div className="ev-sec ev-sec-past">Earlier</div>}
            {past.map((e) => (
              <PastRow key={e.id} e={e} today={today} coachName={coachName} coachPhoto={coachPhoto} lit={highlight === e.id} refFn={(el) => el && rows.current.set(e.id, el)} onOpen={() => setDetail(e)} />
            ))}
          </div>
        </div>
      </main>

      {sheet && <AddEventSheet event={sheet.event} initialType={sheet.type} initial={sheet.initial ?? null} error={sheet.error ?? null} coachName={coachName} today={today} pending={pending} onClose={() => setSheet(null)} onSubmit={save} onDelete={sheet.event ? () => remove(sheet.event!) : undefined} />}
      {detail && !sheet && (
        <EventDetail
          event={detail}
          coachName={coachName}
          coachPhoto={coachPhoto}
          today={today}
          pending={pending}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setSheet({ event: detail, type: eventTypeOf(detail.kind).id });
            setDetail(null);
          }}
          onDelete={() => remove(detail)}
        />
      )}
    </>
  );
}

// ---- The add card: the ask, a round +, and a chip per type.

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

type RowProps = { e: HomeEvent; today: string; coachName: string; coachPhoto: string | null; lit: boolean; refFn: (el: HTMLElement | null) => void; onOpen: () => void };

const rowLabel = (e: HomeEvent, today: string, coachName: string) => `${e.title}, ${eventTypeOf(e.kind).label}, ${rangeLabel(e, today)}, ${relativeLabel(e, today)}${e.mine ? "" : `, set by ${coachName}`}`;

function UpcomingRow({ e, today, coachName, coachPhoto, lit, refFn, onOpen }: RowProps) {
  const t = eventTypeOf(e.kind);
  return (
    <div ref={refFn} className={`ev-r ev-r-up${lit ? " lit" : ""}`} style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
      <span className="ev-td" aria-hidden="true">
        <b>{Number(e.start.slice(8, 10))}</b>
        <small>{shortDay(e.start, today).split(" ")[1]}</small>
      </span>
      <span className="ev-rail" aria-hidden="true">
        <i className="ev-dot-ring">
          <TypeIcon path={t.icon} fill={t.fill} size={15} stroke={2.2} />
        </i>
      </span>
      <span className="ev-cell">
        <button type="button" className="ev-card" onClick={onOpen} aria-label={rowLabel(e, today, coachName)}>
          <span className="ev-card-row">
            <span className="ev-card-title">{e.title}</span>
            {!e.mine && <CoachAvatar name={coachName} photoPath={coachPhoto} size={24} ring="card" />}
            {e.note && <span className="ev-chev" aria-hidden="true">›</span>}
          </span>
          <span className="ev-card-meta">
            <span className="ev-pill">
              <TypeIcon path={t.icon} fill={t.fill} size={11} />
              {t.label}
            </span>
            <span>
              {rangeLabel(e, today)} · <b>{relativeLabel(e, today)}</b>
            </span>
          </span>
        </button>
      </span>
    </div>
  );
}

function NowCard({ e, today, coachName, coachPhoto, lit, refFn, onOpen }: RowProps) {
  const t = eventTypeOf(e.kind);
  const { day, total } = dayOf(e, today);
  return (
    <div ref={refFn} className={`ev-r ev-r-now${lit ? " lit" : ""}`} style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
      <span className="ev-td" aria-hidden="true" />
      <span className="ev-rail ev-rail-now" aria-hidden="true" />
      <span className="ev-cell">
        <button type="button" className="ev-now" onClick={onOpen} aria-label={rowLabel(e, today, coachName)}>
          <span className="ev-aura" aria-hidden="true" />
          <span className="ev-now-eyebrow">Happening now · {t.label}</span>
          <span className="ev-card-row">
            <span className="ev-card-title">{e.title}</span>
            {!e.mine && <CoachAvatar name={coachName} photoPath={coachPhoto} size={24} ring="card" />}
            {e.note && <span className="ev-chev" aria-hidden="true">›</span>}
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
      </span>
    </div>
  );
}

function PastRow({ e, today, coachName, coachPhoto, lit, refFn, onOpen }: RowProps) {
  const t = eventTypeOf(e.kind);
  return (
    <div ref={refFn} className={`ev-r ev-r-past${lit ? " lit" : ""}`} style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
      <span className="ev-td" aria-hidden="true">
        <b>{Number(e.start.slice(8, 10))}</b>
        <small>{shortDay(e.start, today).split(" ")[1]}</small>
      </span>
      <span className="ev-rail" aria-hidden="true">
        <i className="ev-dot-past">
          <TypeIcon path={t.icon} fill={t.fill} size={13} stroke={2.2} />
        </i>
      </span>
      <span className="ev-cell">
        <button type="button" className="ev-past" onClick={onOpen} aria-label={rowLabel(e, today, coachName)}>
          <span className="ev-past-text">
            <span className="ev-past-title">{e.title}</span>
            <span className="ev-past-meta">
              {rangeLabel(e, today)} · {relativeLabel(e, today)} · {t.label}
            </span>
          </span>
          {!e.mine && <CoachAvatar name={coachName} photoPath={coachPhoto} size={22} ring="row" />}
          {e.note && <span className="ev-chev" aria-hidden="true">›</span>}
        </button>
      </span>
    </div>
  );
}
