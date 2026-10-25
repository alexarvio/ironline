"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { requestMeetingAction, withdrawMeetingRequestAction } from "../../lib/actions";
import type React from "react";
import { ChevronLeftIcon } from "../../components/icons";
import { meetingTypeOf, type MeetingTypeId } from "../../lib/meetingTypes";
import { eventTypeOf } from "../../lib/eventTypes";
import { agoLabel, agreedPoints, icsDataUrl, startingNow, timeRange, untilLabel } from "../../lib/meetingDates";
import { useOpenEvents } from "../CheckInContext";
import { Bars } from "../Bars";
import { TypeIcon } from "../events/AddEventSheet";

// The Meetings screen (9 Oct), reshaped 16 Oct: calls are few, so the top is
// fixed: the white pill to ask for a call, and under it the next call as a
// pill ("No upcoming meetings" when nothing is booked), more booked behind a
// "+1 more". Under that the past is a feed in the Events itinerary style: one
// spine, light date numerals, thin rings in the call type's colour, greyed.
// The feed snaps a row to a spot near its top and that row grows; a past call
// with notes opens in place with what was agreed, as the next call does in its
// pill. Every call with notes has a chevron by its title.

export type ClientMeetingView = {
  id: number;
  title: string;
  type: MeetingTypeId;
  /** The start as a UTC moment; null for a call with no time (its date stands). */
  startIso: string | null;
  /** yyyy-mm-dd, for a call with no time. */
  date: string;
  durationMin: number;
  joinUrl: string | null;
  /** What the coach wrote for the client: one agreed point per line, or a block. */
  notes: string | null;
  linkedEvents: { id: number; title: string; kind: string | null }[];
  /** Marked a no-show by the coach. */
  missed: boolean;
};
export type MeetingRequestView = { id: number; about: string; whenSuits: string | null; createdAt: string };
export type MeetingsProps = { upcoming: ClientMeetingView[]; past: ClientMeetingView[]; request?: MeetingRequestView | null };

const PAGE = 20;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const startMsOf = (m: ClientMeetingView) => (m.startIso ? Date.parse(m.startIso) : Date.parse(`${m.date}T12:00:00`));
// The feed snaps a row to one spot near its top (16 Oct): the newest call
// sits there on open, and scrolling hands the spot down the list. 80px is
// the first row's centre under the PAST MEETINGS label.
const SPOT = 80;

/** A fine-line icon: 1.6 stroke, round caps and joins, no fills. */
function LineIcon({ path, size }: { path: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export default function MeetingsScreen({ upcoming, past, request = null, clientId = 0, coachName, focusId = null, onBack }: MeetingsProps & { clientId?: number; coachName: string; /** A call to land on (10 Oct): from a notification. The screen scrolls to it and opens it. */ focusId?: number | null; onBack: () => void }) {
  const coachFirst = coachName.trim().split(/\s+/)[0] || "your coach";
  // The phone's clock, once on the phone and then every half minute, so the
  // Join window opens and closes on its own.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setTimeout(tick, 0);
    const i = setInterval(tick, 30000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, []);
  // The booked call open in its pill, showing the coach's notes.
  const [nextOpen, setNextOpen] = useState<number | null>(null);
  // Asking for a call (9 Oct): the sheet, and the ask as it stands once sent (the server's, or the one just made).
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState<MeetingRequestView | null>(request);
  const [askKey, setAskKey] = useState(request?.id ?? null);
  if ((request?.id ?? null) !== askKey) {
    setAskKey(request?.id ?? null);
    setAsk(request);
  }
  const [pending, startTransition] = useTransition();
  const withdraw = () => {
    if (!ask) return;
    const id = ask.id;
    setAsk(null);
    startTransition(async () => {
      await withdrawMeetingRequestAction(clientId, id);
    });
  };

  // ---- Booked calls sit fixed on top, soonest first; the past is the feed under them, newest first.
  const sortedUp = [...upcoming].sort((a, b) => startMsOf(a) - startMsOf(b));
  const [next, ...later] = sortedUp;
  const [moreOpen, setMoreOpen] = useState(false);
  const pastSorted = [...past].sort((a, b) => startMsOf(b) - startMsOf(a));
  const [shown, setShown] = useState(() => (focusId != null ? Math.max(PAGE, pastSorted.findIndex((m) => m.id === focusId) + 1) : PAGE));
  const pastShown = pastSorted.slice(0, shown);

  // ---- The snap: whichever row sits at the spot is the focus and grows a little.
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<number, HTMLElement>());
  const [focusRow, setFocusRow] = useState<number | null>(pastSorted[0]?.id ?? null);
  const [open, setOpen] = useState<number | null>(null);
  const [lit, setLit] = useState<number | null>(null);
  const spotOf = (id: number) => {
    const el = rows.current.get(id);
    return el ? Math.max(0, el.offsetTop + Math.min(el.offsetHeight, 72) / 2 - SPOT) : null;
  };
  const nearest = () => {
    const box = scrollRef.current;
    if (!box) return null;
    const target = box.scrollTop + SPOT;
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
  // While a tap glides a row to the spot, the rows it passes neither take the focus nor close it.
  // The glide is driven frame by frame and re-aims at the row each frame
  // (17 Oct): the call open above it folds shut as it goes, moving the row up,
  // and a target taken once at the tap overshot by that fold and cut the ring
  // off at the top. 450ms outlasts the 300ms fold, so it lands on the settled row.
  const gliding = useRef(0);
  const glideRaf = useRef(0);
  const glideEnd = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const glideTo = (id: number) => {
    const box = scrollRef.current;
    if (!box || spotOf(id) == null) return;
    cancelAnimationFrame(glideRaf.current);
    clearTimeout(glideEnd.current);
    gliding.current = Date.now() + 1000;
    // Mandatory snapping would pull each frame back to the nearest row: off for the glide, on again once it lands.
    box.style.scrollSnapType = "none";
    const from = box.scrollTop;
    const t0 = performance.now();
    const land = () => {
      cancelAnimationFrame(glideRaf.current);
      clearTimeout(glideEnd.current);
      glideRaf.current = 0;
      const top = spotOf(id);
      if (top != null) box.scrollTop = top;
      box.style.scrollSnapType = "";
      gliding.current = 0;
    };
    const step = (now: number) => {
      const top = spotOf(id);
      if (top == null) return land();
      const k = Math.min(1, (now - t0) / 450);
      box.scrollTop = from + (top - from) * (1 - Math.pow(1 - k, 3));
      if (k < 1) glideRaf.current = requestAnimationFrame(step);
      else land();
    };
    glideRaf.current = requestAnimationFrame(step);
    // Frames stop when the app is hidden mid-glide: land it anyway, snapping back on.
    glideEnd.current = setTimeout(land, 700);
  };
  useEffect(
    () => () => {
      cancelAnimationFrame(glideRaf.current);
      clearTimeout(glideEnd.current);
    },
    []
  );
  // From a notification: a booked call opens in its pill; a past one is glided to after a beat, opened and lit.
  useEffect(() => {
    if (focusId == null) return;
    const booked = upcoming.find((x) => x.id === focusId);
    if (booked) {
      if (booked.id !== sortedUp[0]?.id) setMoreOpen(true);
      const t = setTimeout(() => {
        if (agreedPoints(booked.notes).points.length > 0) setNextOpen(booked.id);
        setLit(booked.id);
      }, 80);
      const off = setTimeout(() => setLit(null), 1400);
      return () => {
        clearTimeout(t);
        clearTimeout(off);
      };
    }
    if (!pastSorted.some((m) => m.id === focusId)) return;
    // At the spot from the first frame; a beat later it opens, whole, and glows.
    const box = scrollRef.current;
    const top = spotOf(focusId);
    if (box && top != null) {
      gliding.current = Date.now() + 1000;
      box.scrollTop = top;
    }
    setFocusRow(focusId);
    const t = setTimeout(() => {
      setOpen(focusId);
      setLit(focusId);
    }, 300);
    const off = setTimeout(() => setLit(null), 1400);
    return () => {
      clearTimeout(t);
      clearTimeout(off);
    };
  }, [focusId]); // eslint-disable-line react-hooks/exhaustive-deps
  const raf = useRef(0);
  const onScroll = () => {
    if (!raf.current)
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        if (Date.now() < gliding.current) return;
        const id = nearest();
        setFocusRow(id);
        // An open call closes once the list moves on from it.
        setOpen((o) => (o != null && o !== id ? null : o));
        const box = scrollRef.current;
        if (!box || shown >= pastSorted.length) return;
        if (box.scrollTop + box.clientHeight > box.scrollHeight - 240) setShown((n) => n + PAGE);
      });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <>
      <header className="cn-header evp-nav">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">Meetings</h1>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>
      <main className="cn-body">
        <div className="evp-top">
          {ask ? (
            <section className="evp-add asked" aria-label="Your request">
              <span className="evp-add-text">
                <b>You asked {coachFirst} for a call</b>
                <small>
                  <Bars parts={[ask.about, ask.whenSuits]} />
                </small>
              </span>
              <button type="button" className="mtp-withdraw" onClick={withdraw} disabled={pending}>
                Cancel
              </button>
            </section>
          ) : (
            <button type="button" className="evp-add" onClick={() => setAsking(true)}>
              <span className="evp-add-text">
                <b>Request a meeting</b>
                <small>Ask {coachFirst} for a call</small>
              </span>
              <span className="evp-add-plus" aria-hidden="true">
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </button>
          )}
          {/* The next call, fixed under the ask: always there, "No upcoming meetings" when nothing is booked. */}
          <NextPill m={next ?? null} now={now} coachFirst={coachFirst} open={!!next && nextOpen === next.id} lit={!!next && lit === next.id} onToggle={() => next && setNextOpen((o) => (o === next.id ? null : next.id))} />
          {later.length > 0 && (
            <>
              {moreOpen && later.map((m) => <NextPill key={m.id} m={m} now={now} coachFirst={coachFirst} open={nextOpen === m.id} lit={lit === m.id} onToggle={() => setNextOpen((o) => (o === m.id ? null : m.id))} />)}
              <button type="button" className="mtp-more" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen}>
                {moreOpen ? "Show less" : `+${later.length} more booked`}
              </button>
            </>
          )}
        </div>
        <div ref={scrollRef} className="evp-scroll mtp-scroll" onScroll={onScroll}>
          <div className="evp-tl mtp-tl">
            <span className="evp-spine" aria-hidden="true" />
            {pastSorted.length > 0 ? <div className="evp-sec">Past meetings</div> : <p className="evp-empty mtp-empty">After your first call, what you and {coachFirst} agree shows up here.</p>}
            {pastShown.map((m, i) => (
              <PastRow
                key={m.id}
                m={m}
                label={i === 0 ? "Last" : null}
                now={now}
                focus={focusRow === m.id}
                open={open === m.id}
                lit={lit === m.id}
                refFn={(el) => {
                  if (el) rows.current.set(m.id, el);
                }}
                onTap={(opens) => {
                  glideTo(m.id);
                  setFocusRow(m.id);
                  // Every row comes to the spot; only one with notes opens (17 Oct, Alex).
                  setOpen((o) => (opens && o !== m.id ? m.id : null));
                }}
              />
            ))}
          </div>
        </div>
      </main>
      {asking && <AskSheet clientId={clientId} coachFirst={coachFirst} onClose={() => setAsking(false)} onSent={(r) => (setAsk(r), setAsking(false))} />}
    </>
  );
}

// ---- The next call as a white pill: the date as a light numeral, the title,
// when. With notes from the coach, a chevron by the title and a tap opens them
// in the pill. On the right, Add to calendar; live, it says so and carries Join.
function NextPill({ m, now, coachFirst, open = false, lit = false, onToggle }: { m: ClientMeetingView | null; now: number | null; coachFirst: string; open?: boolean; /** Landed on from a notification: a glow for a moment. */ lit?: boolean; onToggle?: () => void }) {
  if (!m) {
    return (
      <div className="mtp-next empty" aria-label="No upcoming meetings">
        <span className="mtp-next-date" aria-hidden="true">
          <i className="mtp-next-ring" />
        </span>
        <span className="evp-add-text">
          <b>No upcoming meetings</b>
        </span>
      </div>
    );
  }
  const ms = startMsOf(m);
  const d = new Date(ms);
  const live = now != null && !!m.startIso && startingNow(ms, m.durationMin, now);
  const time = m.startIso ? timeRange(ms, m.durationMin) : "All day";
  const whenParts = live ? ["Starting now", time] : [now != null ? untilLabel(ms, now) : null, time];
  const when = whenParts.filter(Boolean).join(", ");
  const t = meetingTypeOf(m.type);
  const { points, prose } = agreedPoints(m.notes);
  const has = points.length > 0;
  return (
    <div className={`mtp-next${live ? " live" : ""}${open ? " open" : ""}${lit ? " lit" : ""}`} style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
      <div className="mtp-next-row">
        <button type="button" className="mtp-next-open" onClick={onToggle} disabled={!has} aria-expanded={has ? open : undefined} aria-label={`Next call: ${m.title}, ${when}${has ? ", has notes" : ""}`}>
          <span className="mtp-next-date" aria-hidden="true">
            <b>{String(d.getDate()).padStart(2, "0")}</b>
            <small>{MONTHS[d.getMonth()]}</small>
          </span>
          <span className="evp-add-text">
            <span className="mtp-next-title">
              <b>{m.title}</b>
              {has && (
                <svg className="mtp-next-chev" viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              )}
            </span>
            <small>
              <Bars parts={whenParts} />
            </small>
          </span>
        </button>
        {/* The link opens from the pill whenever there is one (25 Oct, Alex: "I should be able to click on a link here"):
            the ink Join while it is on, a white one before. Add to calendar stays beside it. */}
        {m.joinUrl && (
          <a className={`mtp-join${live ? "" : " quiet"}`} href={m.joinUrl} target="_blank" rel="noopener noreferrer" aria-label={`Join call with ${coachFirst}`}>
            Join
          </a>
        )}
        {!live && (
          <a className="mtp-cal" href={icsDataUrl({ title: m.title, startMs: ms, durationMin: m.durationMin, url: m.joinUrl, coach: coachFirst })} download={`${m.title.replace(/[^\w ]+/g, "").trim() || "call"}.ics`} aria-label="Add to calendar">
            <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M12 13v5M9.5 15.5h5" />
            </svg>
          </a>
        )}
      </div>
      {has && (
        <div className={`ev-x mtp-next-x${open ? " open" : ""}`} aria-hidden={!open}>
          <div className="ev-x-clip">
            <div className="ev-x-in">
              {prose ? (
                <p className="mt-prose">{points[0]}</p>
              ) : (
                <ul className="mt-items">
                  {points.map((p, i) => (
                    <CheckItem key={i} text={p} rgb={t.rgb} color={t.color} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Asking for a call (9 Oct): what it is about, and when suits, in the
// client's words. Finlay gets it on Home and as a push, books the call, and
// it lands on top here like any other.

function AskSheet({ clientId, coachFirst, onClose, onSent }: { clientId: number; coachFirst: string; onClose: () => void; onSent: (r: MeetingRequestView) => void }) {
  const [about, setAbout] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const ok = about.trim().length > 0;
  const send = () => {
    if (!ok || pending) return;
    startTransition(async () => {
      const err = await requestMeetingAction(clientId, about, when);
      if (err) return setError(err);
      onSent({ id: -Date.now(), about: about.trim(), whenSuits: when.trim() || null, createdAt: new Date().toISOString() });
    });
  };
  return createPortal(
    <div className="ev-scrim" role="presentation" onClick={onClose}>
      <div className="ev-sheet mt-asksheet" role="dialog" aria-modal="true" aria-labelledby="mt-ask-title" onClick={(e) => e.stopPropagation()}>
        <span className="ev-grab" aria-hidden="true" />
        <div className="evs-head">
          <h2 id="mt-ask-title">Request a meeting</h2>
          <button type="button" className="evs-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <label className="evs-field">
          <span className="evs-label">What about</span>
          <span className="evs-title ring" style={{ "--c": "#2f6fd6" } as React.CSSProperties}>
            <input value={about} onChange={(e) => setAbout(e.target.value)} placeholder="The next phase, my knee, the plan for the holiday" maxLength={140} autoFocus />
          </span>
        </label>
        <label className="evs-field">
          <span className="evs-label">When suits you</span>
          <span className="evs-note">
            <textarea value={when} onChange={(e) => setWhen(e.target.value)} placeholder="Weekday evenings, or Saturday morning" maxLength={140} />
          </span>
        </label>
        {error && <p className="mt-ask-err">{error}</p>}
        <div className="evs-savebar">
          <button type="button" className="evs-save" onClick={send} disabled={!ok || pending} aria-disabled={!ok || pending}>
            {pending ? "Sending…" : "Request"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- Shared bits: an agreed point with its check, and an event chip.

export function CheckItem({ text, rgb, color }: { text: string; rgb: string; color: string }) {
  return (
    <li className="mt-item" style={{ "--rgb": rgb, "--c": color } as React.CSSProperties}>
      <span className="mt-check" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span>{text}</span>
    </li>
  );
}

export function EventChip({ e, onOpen }: { e: { id: number; title: string; kind: string | null }; onOpen?: () => void }) {
  const t = eventTypeOf(e.kind);
  return (
    <button
      type="button"
      className="mt-chip"
      style={{ "--ergb": t.rgb, "--ec": t.color } as React.CSSProperties}
      onClick={(ev) => {
        ev.stopPropagation();
        onOpen?.();
      }}
      aria-label={`${e.title}, ${t.label} event`}
    >
      <span className="mt-chip-ico">
        <TypeIcon path={t.icon} fill={t.fill} size={10} stroke={2.4} />
      </span>
      {e.title}
      <span className="mt-chip-chev" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

// ---- A past call on the spine: the date as a light numeral, the ring with
// the call's icon, the title and when. With notes it opens in place with what
// was agreed and the events made from it; a chevron says so.

function PastRow({ m, label, now, focus, open, lit, refFn, onTap }: { m: ClientMeetingView; label: string | null; now: number | null; focus: boolean; open: boolean; lit: boolean; refFn: (el: HTMLElement | null) => void; onTap: (opens: boolean) => void }) {
  const t = meetingTypeOf(m.type);
  const ms = startMsOf(m);
  const d = new Date(ms);
  const { points, prose } = agreedPoints(m.notes);
  const has = points.length > 0 || m.linkedEvents.length > 0;
  const openEvents = useOpenEvents();
  const ago = now != null ? agoLabel(ms, now) : "";
  const when = m.missed ? `Missed, ${ago}` : ago.charAt(0).toUpperCase() + ago.slice(1);
  // A title cut short gets the chevron too: open, the row shows it in full.
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
  }, [m.title, focus]);
  const opens = has || clipped;
  return (
    <div ref={refFn} className={`evp-r past${focus ? " focus" : ""}${open ? " open" : ""}${lit ? " lit" : ""}`} style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
      <button type="button" className={`evp-row${label ? " labelled" : ""}`} onClick={() => onTap(opens)} aria-expanded={opens ? open : undefined} aria-label={`${label ? `${label} ` : ""}${t.label} call: ${m.title}, ${when}${!has && !m.missed ? ", no notes" : ""}`}>
        <span className="evp-date" aria-hidden="true">
          <b>{String(d.getDate()).padStart(2, "0")}</b>
          <small>{MONTHS[d.getMonth()]}</small>
        </span>
        <span className="evp-node" aria-hidden="true">
          <span className="evp-ring">
            <LineIcon path={t.icon} size={18} />
          </span>
        </span>
        <span className="evp-text">
          {label && <span className="evp-label">{label}</span>}
          <span className="evp-title-row">
            <span ref={titleRef} className="evp-title">
              {m.title}
            </span>
            {opens && (
              <svg className="evp-chev" viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            )}
          </span>
          <span className="evp-when">{m.missed ? <Bars parts={["Missed", ago]} /> : when}</span>
        </span>
      </button>
      {opens && (
        <div className={`ev-x evp-x${open ? " open" : ""}`} aria-hidden={!open}>
          <div className="ev-x-clip">
            <div className="ev-x-in">
              {clipped && <p className="evp-x-title">{m.title}</p>}
              {points.length > 0 &&
                (prose ? (
                  <p className="mt-prose">{points[0]}</p>
                ) : (
                  <ul className="mt-items">
                    {points.map((p, i) => (
                      <CheckItem key={i} text={p} rgb={t.rgb} color={t.color} />
                    ))}
                  </ul>
                ))}
              {m.linkedEvents.length > 0 && (
                <span className="mt-linked">
                  <span className="mt-linked-label">Added to your events</span>
                  {m.linkedEvents.map((e) => (
                    <EventChip key={e.id} e={e} onOpen={() => openEvents?.()} />
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
