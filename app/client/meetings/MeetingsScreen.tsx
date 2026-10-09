"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { ChevronLeftIcon } from "../../components/icons";
import { meetingTypeOf, type MeetingTypeId } from "../../lib/meetingTypes";
import { eventTypeOf } from "../../lib/eventTypes";
import { agoLabel, agreedPoints, shortDate, startingNow, tileParts, timeRange, untilLabel } from "../../lib/meetingDates";
import { useCoachIdentity, useOpenEvents } from "../CheckInContext";
import { TypeIcon } from "../events/AddEventSheet";
import MeetingDetail from "./MeetingDetail";

// The Meetings screen, "Agreements first" (9 Oct): the next call on top,
// then what was agreed on the calls that happened, newest first, on a rail
// like the Events screen. Calls with notes are tinted cards in their type's
// colour; runs of calls without notes fold into one quiet row. Everything
// is read-only for the client: the coach books and writes.

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
  const items = groupPast(pastSorted.slice(0, shown));

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
              <div className="mt-sec">What you&rsquo;ve agreed</div>
              <div className="mt-tl">
                {items.map((it, i) =>
                  it.kind === "card" ? (
                    <AgreementCard key={it.m.id} m={it.m} now={now} last={i === items.length - 1} coachFirst={coachFirst} onOpen={() => setDetail(it.m)} />
                  ) : (
                    <NoNotesGroup key={`g-${it.ms[0].id}`} ms={it.ms} now={now} last={i === items.length - 1} onOpen={(m) => setDetail(m)} />
                  )
                )}
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
          <span className="mt-next-sub">
            {m.startIso ? timeRange(ms, m.durationMin) : "All day"} · with {coachFirst}
          </span>
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

// ---- The timeline: a card per call with notes; a run of calls without notes folded into one row.

type Item = { kind: "card"; m: ClientMeetingView } | { kind: "group"; ms: ClientMeetingView[] };
function groupPast(list: ClientMeetingView[]): Item[] {
  const out: Item[] = [];
  for (const m of list) {
    const has = agreedPoints(m.notes).points.length > 0;
    if (has) out.push({ kind: "card", m });
    else {
      const last = out[out.length - 1];
      if (last && last.kind === "group") last.ms.push(m);
      else out.push({ kind: "group", ms: [m] });
    }
  }
  return out;
}

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

function AgreementCard({ m, now, last, coachFirst, onOpen }: { m: ClientMeetingView; now: number | null; last: boolean; coachFirst: string; onOpen: () => void }) {
  const t = meetingTypeOf(m.type);
  const ms = startMsOf(m);
  const { points, prose } = agreedPoints(m.notes);
  const shown = points.slice(0, 4);
  const rest = points.length - shown.length;
  const openEvents = useOpenEvents();
  // Before the phone's clock is read, the date stands alone (no "3 days ago").
  const nowMs = now ?? ms;
  return (
    <div className={`mt-r${last ? " last" : ""}`} style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}>
      <span className="mt-rail" aria-hidden="true">
        <i className="mt-dot" />
      </span>
      <div className="mt-cell">
        <div className="mt-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())} aria-label={`${t.label} call, ${shortDate(ms, nowMs)}: ${m.title}. ${points.length} agreed point${points.length === 1 ? "" : "s"}${m.linkedEvents.length ? `, ${m.linkedEvents.length} linked event${m.linkedEvents.length === 1 ? "" : "s"}` : ""}`}>
          <span className="mt-head">
            <span className="mt-type">
              <TypeIcon path={t.icon} size={14} stroke={2.2} />
            </span>
            <span className="mt-head-text">
              <span className="mt-title">{m.title}</span>
              <span className="mt-meta">
                {shortDate(ms, nowMs)} · {t.label}
                {now != null ? ` · ${agoLabel(ms, now)}` : ""}
              </span>
            </span>
          </span>
          {prose ? (
            <p className="mt-prose">{points[0]}</p>
          ) : (
            <ul className="mt-items">
              {shown.map((p, i) => (
                <CheckItem key={i} text={p} rgb={t.rgb} color={t.color} />
              ))}
            </ul>
          )}
          {rest > 0 && <span className="mt-rest">+{rest} more</span>}
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
      <span className="sr-only">with {coachFirst}</span>
    </div>
  );
}

function NoNotesGroup({ ms, now, last, onOpen }: { ms: ClientMeetingView[]; now: number | null; last: boolean; onOpen: (m: ClientMeetingView) => void }) {
  const [open, setOpen] = useState(false);
  const one = ms.length === 1;
  const dateOf = (m: ClientMeetingView) => shortDate(startMsOf(m), now ?? startMsOf(m));
  const sub = ms.map((m) => `${dateOf(m)} · ${m.title}`).join("  ·  ");
  const head = (
    <>
      <span className="mt-group-text">
        <span className="mt-group-title">{one ? ms[0].title : `${ms.length} calls without notes`}</span>
        <span className="mt-group-sub">{sub}</span>
      </span>
      <span className="mt-group-right">{ms[0].missed && one ? "Missed" : "No notes"}</span>
      {!one && <span className={`mt-group-chev${open ? " open" : ""}`} aria-hidden="true">›</span>}
    </>
  );
  return (
    <div className={`mt-r${last ? " last" : ""}`}>
      <span className="mt-rail quiet" aria-hidden="true">
        <i className="mt-dot hollow" />
      </span>
      <div className="mt-cell">
        <div className="mt-group">
          {one ? (
            <button type="button" className="mt-group-head" onClick={() => onOpen(ms[0])}>
              {head}
            </button>
          ) : (
            <button type="button" className="mt-group-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {head}
            </button>
          )}
          {!one && (
            <div className={`mt-group-body${open ? " open" : ""}`} aria-hidden={!open}>
              <div className="mt-group-clip">
                <ul className="mt-group-list">
                  {ms.map((m) => {
                    const t = meetingTypeOf(m.type);
                    return (
                      <li key={m.id}>
                        <button type="button" className="mt-group-row" onClick={() => onOpen(m)} tabIndex={open ? 0 : -1}>
                          <span className="mt-group-row-title">{m.title}</span>
                          <span className="mt-group-row-meta">
                            {dateOf(m)} · {t.label}
                            {m.missed ? " · missed" : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
