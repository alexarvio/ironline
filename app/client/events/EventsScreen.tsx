"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { clientAddEventAction, clientDeleteEventAction, clientUpdateEventAction } from "../../lib/actions";
import { eventTypeOf, EVENT_TYPES, type EventTypeId } from "../../lib/eventTypes";
import { dayOf, daysBetween, shortDay } from "../../lib/eventDates";
import { ChevronLeftIcon } from "../../components/icons";
import { useCoachIdentity } from "../CheckInContext";
import type { HomeEvent, HomeEvents } from "../EventsCard";
import AddEventSheet, { type EventValues } from "./AddEventSheet";

// The Events screen (9 Oct), restyled as an itinerary (15 Oct): one 1px
// spine, thin rings with fine-line category icons, light type, no cards.
// Coming up runs down to the TODAY marker, what is happening now sits just
// under it with a hairline progress, and the past fades below in grey. The
// client adds from the white pill on top; a row opens in place on a tap
// with its note, who set it, and for the client's own, Edit and Delete.

type Sheet = { event: HomeEvent | null; type: EventTypeId; initial?: EventValues | null; error?: string | null } | null;
const LAST_TYPE_KEY = "ironline:last-event-type";
const FILTER_KEY = "norcoach:events-filter";
const PAGE = 20;

type Status = "next" | "now" | "past";
/** Ongoing supplements that began earlier sit in the past as "Ongoing"; everything else covering today is now. */
const ongoing = (e: HomeEvent, today: string) => e.kind === "supplement" && !e.phase && e.start < today && e.end >= today;
const statusOf = (e: HomeEvent, today: string): Status => (e.start > today ? "next" : e.end >= today && !ongoing(e, today) ? "now" : "past");

// A phase on the timeline: one flag in the track's colour, as the plan draws it.
const FLAG = "M5 21V4M5 4h11.5l-2.5 4.5 2.5 4.5H5";
const PHASES = {
  training: { label: "Training phase", color: "#3a3390", rgb: "58,51,144", icon: FLAG },
  nutrition: { label: "Nutrition phase", color: "#1f7a4d", rgb: "31,122,77", icon: FLAG },
  lifestyle: { label: "Lifestyle phase", color: "#a8761f", rgb: "168,118,31", icon: FLAG },
};
type Chrome = { label: string; color: string; rgb: string; icon: string };
const chromeOf = (e: HomeEvent): Chrome => {
  if (e.phase) return PHASES[e.phase];
  const t = eventTypeOf(e.kind);
  return { label: t.label, color: t.color, rgb: t.rgb, icon: t.icon };
};
/** Which filter chip an event belongs to. */
const groupOf = (e: HomeEvent): string => (e.phase ? "phase" : eventTypeOf(e.kind).id);
const GROUP_LABELS: Record<string, string> = { trip: "Trips", supplement: "Supplements", health: "Health", training: "Training", work: "Work", other: "Other", phase: "Phases" };

// Every event opens, the coach's too, with Edit and Delete (10 Oct); a phase only when it has objectives to show.
const hasMore = (e: HomeEvent) => (e.phase ? !!e.note : true);

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const monthOf = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];

/** The row's "when" line. */
function whenOf(e: HomeEvent, status: Status, today: string): string {
  if (status === "next") {
    const n = daysBetween(today, e.start);
    if (n <= 1) return "Tomorrow";
    if (n < 21) return `In ${n} days`;
    if (n <= 60) return `In ${Math.round(n / 7)} weeks`;
    return shortDay(e.start, today);
  }
  if (status === "now") {
    if (e.start === e.end) return "Today";
    const { day, total } = dayOf(e, today);
    return `Day ${day} of ${total}`;
  }
  if (ongoing(e, today)) return "Ongoing";
  const n = daysBetween(e.end, today);
  const ago = n <= 30 ? `${n} day${n === 1 ? "" : "s"} ago` : shortDay(e.end, today);
  return e.start === e.end ? ago : `Ended · ${ago}`;
}

/** A fine-line icon: 1.6 stroke, round caps and joins, no fills. */
function LineIcon({ path, size }: { path: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

// `me` is the client's own first name and photo (9 Oct): on the rows they added, their face, as the coach's is on the coach's.
export default function EventsScreen({ clientId, events, coachName, today, me = null, focusId = null, onBack }: { clientId: number; events: HomeEvents; coachName: string; today: string; me?: { name: string; photoPath: string | null } | null; focusId?: number | null; onBack: () => void }) {
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
  const list = useMemo(() => [...events.list, ...added], [events.list, added]);

  // ---- The filter: All, or one group the client has events in. It keeps for the session.
  const groups = useMemo(() => {
    const have = new Set(list.map(groupOf));
    return [...EVENT_TYPES.map((t) => t.id as string), "phase"].filter((g) => have.has(g));
  }, [list]);
  const [filter, setFilter] = useState<string>(() => {
    try {
      return window.sessionStorage.getItem(FILTER_KEY) ?? "all";
    } catch {
      return "all";
    }
  });
  const pickFilter = (g: string) => {
    setFilter(g);
    try {
      window.sessionStorage.setItem(FILTER_KEY, g);
    } catch {}
  };
  const shown = filter === "all" || !groups.includes(filter) ? list : list.filter((e) => groupOf(e) === filter);

  const byStart = (a: HomeEvent, b: HomeEvent) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id);
  // Coming up: furthest first, ending with the soonest, right above today.
  const upcoming = shown.filter((e) => statusOf(e, today) === "next").sort(byStart).reverse();
  const now = shown.filter((e) => statusOf(e, today) === "now").sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : a.id - b.id));
  const pastAll = shown.filter((e) => statusOf(e, today) === "past").sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : b.id - a.id));
  // The past comes in pages of 20 as the client scrolls near the bottom.
  const [pastShown, setPastShown] = useState(PAGE);
  const past = pastAll.slice(0, pastShown);

  // ---- The sheet, the row open in place, and a save on its way.
  const [sheet, setSheet] = useState<Sheet>(null);
  // Landed on from a notification: that event starts open (when it has more to show) and lit.
  const focused = focusId != null ? (events.list.find((e) => e.id === focusId) ?? null) : null;
  const [open, setOpen] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const landed = useRef(false);
  useEffect(() => {
    if (!focused || landed.current) return;
    landed.current = true;
    const t = setTimeout(() => {
      if (hasMore(focused)) setOpen(focused.id);
      setHighlight(focused.id);
    }, 420);
    return () => clearTimeout(t);
  }, [focused]);
  const rows = useRef(new Map<number, HTMLElement>());
  // Always Trip, the first tile (14 Oct, Alex): it used to open on the type used last.
  const openAdd = () => setSheet({ event: null, type: "trip" });

  // On open, the TODAY marker about 30% down the screen, so what is coming and what is on sit in view.
  // The list snaps a row to one spot, 36% down the screen (16 Oct): whichever
  // row sits there is the focus and grows a little. It opens on what is on
  // today, else the soonest to come, else the latest past.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const SNAP = 0.36;
  const nearest = () => {
    const box = scrollRef.current;
    if (!box) return null;
    const target = box.scrollTop + box.clientHeight * SNAP;
    let best: number | null = null;
    let dist = Infinity;
    rows.current.forEach((el, id) => {
      if (!el.isConnected) return;
      const d = Math.abs(el.offsetTop + Math.min(el.offsetHeight, 72) / 2 - target);
      if (d < dist) {
        dist = d;
        best = id;
      }
    });
    return best;
  };
  const centred = useRef(false);
  useEffect(() => {
    if (centred.current) return;
    centred.current = true;
    const box = scrollRef.current;
    if (!box) return;
    const first = now[0] ?? upcoming[upcoming.length - 1] ?? pastAll[0] ?? null;
    const el = first ? rows.current.get(first.id) : null;
    const top = el ? el.offsetTop + Math.min(el.offsetHeight, 72) / 2 : 0;
    box.scrollTop = Math.max(0, top - box.clientHeight * SNAP);
    setFocusRow(first?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const raf = useRef(0);
  const onScroll = () => {
    if (!raf.current)
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        const id = nearest();
        setFocusRow(id);
        // An open row closes once the list moves on from it (16 Oct).
        setOpen((o) => (o != null && o !== id ? null : o));
        const box = scrollRef.current;
        if (!box || pastShown >= pastAll.length) return;
        if (box.scrollTop + box.clientHeight > box.scrollHeight - 240) setPastShown((n) => n + PAGE);
      });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

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

  // One date per day (16 Oct): a row on the same day as the one above it shows no numeral.
  const ordered = [...upcoming.map((e) => ({ e, status: "next" as Status })), ...now.map((e) => ({ e, status: "now" as Status })), ...past.map((e) => ({ e, status: "past" as Status }))];
  const dateOf = (e: HomeEvent, status: Status) => (status === "now" ? today : e.start);
  const showDate = new Map<number, boolean>();
  ordered.forEach((r, i) => showDate.set(r.e.id, i === 0 || dateOf(r.e, r.status) !== dateOf(ordered[i - 1].e, ordered[i - 1].status)));
  const rowProps = (e: HomeEvent, status: Status, label: "Now" | "Next" | "Last" | null): RowProps => ({
    e,
    status,
    label,
    showDate: showDate.get(e.id) ?? true,
    today,
    coachName,
    coachPhoto,
    me,
    lit: highlight === e.id,
    focus: focusRow === e.id,
    open: open === e.id,
    pending,
    refFn: (el) => el && rows.current.set(e.id, el),
    // A tap on a row brings it to the spot as it opens (16 Oct), wherever the list was.
    onToggle: () => {
      setOpen((o) => (o === e.id ? null : e.id));
      const box = scrollRef.current;
      const el = rows.current.get(e.id);
      if (box && el) {
        box.scrollTo({ top: Math.max(0, el.offsetTop + Math.min(el.offsetHeight, 72) / 2 - box.clientHeight * SNAP), behavior: "smooth" });
        setFocusRow(e.id);
      }
    },
    onEdit: () => setSheet({ event: e, type: eventTypeOf(e.kind).id }),
    onDelete: () => remove(e),
  });

  return (
    <>
      <header className="cn-header evp-nav">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">Events</h1>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>
      <main className="cn-body">
        <div className="evp-top">
          <button type="button" className="evp-add" onClick={openAdd}>
            <span className="evp-add-text">
              <b>Add an event</b>
              <small>A trip, an injury, something you start</small>
            </span>
            <span className="evp-add-plus" aria-hidden="true">
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </button>

          {groups.length > 0 && (
            <div className="evp-chips" role="radiogroup" aria-label="Show">
              <button type="button" role="radio" aria-checked={filter === "all" || !groups.includes(filter)} className={`evp-chip${filter === "all" || !groups.includes(filter) ? " on" : ""}`} onClick={() => pickFilter("all")}>
                All
              </button>
              {groups.map((g) => {
                const t = g === "phase" ? PHASES.training : eventTypeOf(g);
                return (
                  <button key={g} type="button" role="radio" aria-checked={filter === g} className={`evp-chip${filter === g ? " on" : ""}`} style={{ "--c": t.color } as React.CSSProperties} onClick={() => pickFilter(g)}>
                    <LineIcon path={g === "phase" ? FLAG : t.icon} size={13} />
                    {GROUP_LABELS[g]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div ref={scrollRef} className="evp-scroll" onScroll={onScroll}>
          <div className="evp-tl">
            <span className="evp-spine" aria-hidden="true" />

            {list.length > 0 && upcoming.length === 0 && (
              <button type="button" className="evp-empty" onClick={openAdd}>
                Nothing planned. Add a trip or something you&rsquo;re starting
              </button>
            )}
            {upcoming.map((e, i) => (
              <EventRow key={e.id} {...rowProps(e, "next", i === upcoming.length - 1 ? "Next" : null)} />
            ))}

            {now.map((e) => (
              <EventRow key={e.id} {...rowProps(e, "now", "Now")} />
            ))}

            {past.length > 0 && <div className="evp-sec">Past</div>}
            {past.map((e, i) => (
              <EventRow key={e.id} {...rowProps(e, "past", i === 0 ? "Last" : null)} />
            ))}
          </div>
        </div>
      </main>

      {sheet && <AddEventSheet event={sheet.event} initialType={sheet.type} initial={sheet.initial ?? null} error={sheet.error ?? null} coachName={coachName} today={today} pending={pending} onClose={() => setSheet(null)} onSubmit={save} onDelete={sheet.event ? () => remove(sheet.event!) : undefined} />}
    </>
  );
}

// ---- A row: the start date as a light numeral, a ring on the spine, the title with who added it, when, and for what is on, a hairline progress. A tap opens it in place.

type RowProps = {
  e: HomeEvent;
  status: Status;
  label: "Now" | "Next" | "Last" | null;
  /** The first row of its day carries the numeral; the rest of that day none. */
  showDate: boolean;
  today: string;
  coachName: string;
  coachPhoto: string | null;
  me: { name: string; photoPath: string | null } | null;
  lit: boolean;
  /** The row at the snap point: a little bigger. */
  focus: boolean;
  open: boolean;
  pending: boolean;
  refFn: (el: HTMLElement | null) => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function EventRow(p: RowProps) {
  const { e, status, label, showDate, today, coachName, coachPhoto, me, lit, focus, open, refFn, onToggle } = p;
  const c = chromeOf(e);
  const isNow = status === "now";
  const when = whenOf(e, status, today);
  const who = e.mine ? me?.name || "You" : coachName;
  const photo = e.mine ? (me?.photoPath ?? null) : coachPhoto;
  const spoken = `${label ? `${label} ` : ""}${e.title}, ${c.label}, ${when}, added by ${who}${status === "past" ? ", past" : ""}`;
  const progress = isNow && e.start !== e.end ? dayOf(e, today) : null;
  // A title cut short (16 Oct) gets the chevron too: open, the row shows it in full.
  const titleRef = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => setClipped(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [e.title, focus]);
  const more = hasMore(e) || clipped;
  const left = progress ? progress.total - progress.day : 0;
  return (
    <div ref={refFn} className={`evp-r ${status}${lit ? " lit" : ""}${focus ? " focus" : ""}${open ? " open" : ""}`} style={{ "--c": c.color, "--rgb": c.rgb } as React.CSSProperties}>
      <button type="button" className={`evp-row${label ? " labelled" : ""}`} onClick={onToggle} disabled={!more} aria-expanded={more ? open : undefined} aria-label={spoken}>
        <span className="evp-date" aria-hidden="true">
          {showDate && (
            <>
              <b>{(isNow ? today : e.start).slice(8, 10)}</b>
              <small>{monthOf(isNow ? today : e.start)}</small>
            </>
          )}
        </span>
        <span className="evp-node" aria-hidden="true">
          <span className={`evp-ring${isNow ? " now" : ""}`}>
            <LineIcon path={c.icon} size={isNow ? 19 : 18} />
          </span>
        </span>
        <span className="evp-text">
          {label && <span className="evp-label">{label}</span>}
          <span className="evp-title-row">
            <span ref={titleRef} className="evp-title">{e.title}</span>
            {(e.note || clipped) && (
              <svg className="evp-chev" viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            )}
            <span className="evp-by" role="img" aria-label={`Added by ${who}`}>
              {photo ? <img src={photo} alt="" /> : (who || "?").trim().charAt(0).toUpperCase()}
            </span>
          </span>
          <span className="evp-when">{when}</span>
          {progress && (
            <span className="evp-progress" role="progressbar" aria-valuenow={progress.day} aria-valuemin={1} aria-valuemax={progress.total} aria-label={`Day ${progress.day} of ${progress.total}`}>
              <span className="evp-track">
                <i className="evp-fill" style={{ width: `${(progress.day / progress.total) * 100}%` }}>
                  <b className="evp-knob" />
                </i>
              </span>
              <small>{left === 0 ? "Last day" : `${left} day${left === 1 ? "" : "s"} left`}</small>
            </span>
          )}
        </span>
      </button>
      <RowMore {...p} clipped={clipped} />
    </div>
  );
}

function RowMore({ e, open, coachName, pending, clipped, onEdit, onDelete }: Pick<RowProps, "e" | "open" | "coachName" | "pending" | "onEdit" | "onDelete"> & { clipped: boolean }) {
  const [sure, setSure] = useState(false);
  if (!hasMore(e) && !clipped) return null;
  return (
    <div className={`ev-x evp-x${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="ev-x-clip">
        <div className="ev-x-in">
          {clipped && <p className="evp-x-title">{e.title}</p>}
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
