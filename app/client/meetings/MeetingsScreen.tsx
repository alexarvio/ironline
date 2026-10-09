"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { ChevronLeftIcon } from "../../components/icons";
import { meetingTypeOf, type MeetingTypeId } from "../../lib/meetingTypes";
import { eventTypeOf } from "../../lib/eventTypes";
import { agoLabel, agreedPoints, startingNow, tileParts, timeRange, untilLabel } from "../../lib/meetingDates";
import { useCoachIdentity, useOpenEvents } from "../CheckInContext";
import { TypeIcon } from "../events/AddEventSheet";
import MeetingDetail from "./MeetingDetail";

// The Meetings screen (9 Oct): the next call on top, then every call that
// happened, newest first, one box each on a rail laid out like the Events
// screen: the date on the left, the call's icon on the rail in its type's
// colour, the box with the title. The most recent one starts open with what
// was agreed; the rest open on a tap. A call with no notes says so. The
// client reads; the coach books and writes.

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
export type MeetingsProps = { upcoming: ClientMeetingView[]; past: ClientMeetingView[] };

const PAGE = 20;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const startMsOf = (m: ClientMeetingView) => (m.startIso ? Date.parse(m.startIso) : Date.parse(`${m.date}T12:00:00`));

export default function MeetingsScreen({ upcoming, past, coachName, onBack }: MeetingsProps & { coachName: string; onBack: () => void }) {
  const coachFirst = coachName.trim().split(/\s+/)[0] || "your coach";
  const coach = useCoachIdentity();
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
  const [detail, setDetail] = useState<ClientMeetingView | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [moreOpen, setMoreOpen] = useState(false);

  const sortedUp = [...upcoming].sort((a, b) => startMsOf(a) - startMsOf(b));
  const [next, ...later] = sortedUp;
  const pastSorted = [...past].sort((a, b) => startMsOf(b) - startMsOf(a));
  // The most recent call starts open; a tap opens another (and closes it again).
  const [open, setOpen] = useState<number | null>(pastSorted[0]?.id ?? null);

  return (
    <>
      <header className="cn-header">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">Meetings</h1>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>
      <main className="cn-body">
        <div className="mt-scroll">
          <NextCallCard m={next ?? null} now={now} coachFirst={coachFirst} onOpen={() => next && setDetail(next)} />
          {later.length > 0 && (
            <div className="mt-more">
              <button type="button" className="mt-more-btn" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen}>
                +{later.length} more booked
              </button>
              {moreOpen && (
                <ul className="mt-more-list">
                  {later.map((m) => {
                    const ms = startMsOf(m);
                    const t = tileParts(ms);
                    return (
                      <li key={m.id}>
                        <button type="button" className="mt-more-row" onClick={() => setDetail(m)}>
                          <span className="mt-more-date">
                            {t.weekday} {t.day} {t.month}
                          </span>
                          <span className="mt-more-title">{m.title}</span>
                          <span className="mt-more-time">{m.startIso ? timeRange(ms, m.durationMin) : "All day"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {pastSorted.length === 0 ? (
            <p className="mt-empty">After your first call, what you and {coachFirst} agree shows up here.</p>
          ) : (
            <>
              <div className="mt-sec">Past meetings</div>
              <div className="mt-tl">
                {pastSorted.slice(0, shown).map((m, i) => (
                  <PastCall key={m.id} m={m} now={now} open={open === m.id} latest={i === 0} onToggle={() => setOpen((o) => (o === m.id ? null : m.id))} />
                ))}
              </div>
              {pastSorted.length > shown && (
                <button type="button" className="mt-earlier" onClick={() => setShown((n) => n + PAGE)}>
                  Show earlier calls
                </button>
              )}
            </>
          )}
        </div>
      </main>
      {/* Opened by a tap, so the clock is set by then. */}
      {detail && now != null && <MeetingDetail m={detail} now={now} coachFirst={coachFirst} coachPhoto={coach?.photoPath ?? null} onClose={() => setDetail(null)} />}
    </>
  );
}

// ---- The next call: the date tile, when, and Join once it is on.

function NextCallCard({ m, now, coachFirst, onOpen }: { m: ClientMeetingView | null; now: number | null; coachFirst: string; onOpen: () => void }) {
  if (!m) {
    return (
      <section className="mt-next empty" aria-label="Next call">
        <b>Nothing booked yet</b>
        <small>When {coachFirst} books a call, it shows here.</small>
      </section>
    );
  }
  const ms = startMsOf(m);
  const t = tileParts(ms);
  const live = now != null && !!m.startIso && startingNow(ms, m.durationMin, now);
  return (
    <section className="mt-next" aria-label="Next call">
      <button type="button" className="mt-next-open" onClick={onOpen}>
        <span className="mt-tile" aria-hidden="true">
          <small>{t.weekday}</small>
          <b>{t.day}</b>
          <small>{t.month}</small>
        </span>
        <span className="mt-next-text">
          <span className={`mt-eyebrow${live ? " live" : ""}`}>
            {live && <i className="mt-pulse" aria-hidden="true" />}
            {live ? "Starting now" : `Next call · ${now == null ? "" : untilLabel(ms, now)}`}
          </span>
          <span className="mt-next-title">{m.title}</span>
          <span className="mt-next-sub">{m.startIso ? timeRange(ms, m.durationMin) : "All day"}</span>
        </span>
      </button>
      {live && m.joinUrl && (
        <a className="mt-join" href={m.joinUrl} target="_blank" rel="noopener noreferrer" aria-label={`Join call with ${coachFirst}`}>
          Join
        </a>
      )}
    </section>
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

// ---- One past call: the date on the left, the icon on the rail, the box.
// Open, it shows what was agreed and the events made from it.

function PastCall({ m, now, open, latest, onToggle }: { m: ClientMeetingView; now: number | null; open: boolean; /** The most recent call: the one box in its colour (9 Oct). */ latest: boolean; onToggle: () => void }) {
  const t = meetingTypeOf(m.type);
  const ms = startMsOf(m);
  const d = new Date(ms);
  const { points, prose } = agreedPoints(m.notes);
  const has = points.length > 0 || m.linkedEvents.length > 0;
  const openEvents = useOpenEvents();
  return (
    <div className={`mt-r${open ? " open" : ""}`} style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
      <span className="mt-td" aria-hidden="true">
        <b>{d.getDate()}</b>
        <small>{MONTHS[d.getMonth()]}</small>
      </span>
      <span className="mt-rail" aria-hidden="true">
        <i className="mt-ico">
          <TypeIcon path={t.icon} size={15} stroke={2.2} />
        </i>
      </span>
      <div className="mt-cell">
        <div className={`mt-card${latest ? " latest" : ""}`}>
          <button type="button" className="mt-head" onClick={onToggle} disabled={!has} aria-expanded={has ? open : undefined} aria-label={`${t.label} call: ${m.title}${now != null ? `, ${agoLabel(ms, now)}` : ""}${has ? `, ${points.length} agreed point${points.length === 1 ? "" : "s"}` : m.missed ? ", missed" : ", no notes"}`}>
            <span className="mt-head-text">
              <span className="mt-title">{m.title}</span>
              {now != null && <span className="mt-meta">{agoLabel(ms, now)}</span>}
            </span>
            {has ? <span className={`mt-chev${open ? " open" : ""}`} aria-hidden="true">›</span> : <span className="mt-none">{m.missed ? "Missed" : "No notes"}</span>}
          </button>
          {has && (
            <div className={`mt-body${open ? " open" : ""}`} aria-hidden={!open}>
              <div className="mt-clip">
                <div className="mt-in">
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
      </div>
    </div>
  );
}
