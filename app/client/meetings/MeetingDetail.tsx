"use client";

import { useEffect } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { meetingTypeOf } from "../../lib/meetingTypes";
import { agoLabel, agreedPoints, eyebrowDate, icsDataUrl, startingNow, timeRange, untilLabel } from "../../lib/meetingDates";
import { useOpenEvents } from "../CheckInContext";
import { TypeIcon } from "../events/AddEventSheet";
import { CheckItem, EventChip, startMsOf, type ClientMeetingView } from "./MeetingsScreen";

// One call in full (9 Oct), the sheet the Events screen uses: the type, when,
// and for a call to come the calendar file and Join; for one that happened,
// everything agreed and the events made from it. Nothing here is editable.

export default function MeetingDetail({ m, now, coachFirst, onClose }: { m: ClientMeetingView; now: number; coachFirst: string; onClose: () => void }) {
  const t = meetingTypeOf(m.type);
  const ms = startMsOf(m);
  const upcoming = ms + m.durationMin * 60000 >= now && !m.notes;
  const live = !!m.startIso && startingNow(ms, m.durationMin, now);
  const { points, prose } = agreedPoints(m.notes);
  const openEvents = useOpenEvents();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="ev-scrim" role="presentation" onClick={onClose}>
      <div className="ev-sheet mt-detail" role="dialog" aria-modal="true" aria-labelledby="mt-detail-title" style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <span className="ev-grab" aria-hidden="true" />
        <div className="mt-detail-top">
          <span className="mt-type big">
            <TypeIcon path={t.icon} size={22} stroke={2.2} />
          </span>
          <span className="mt-detail-text">
            <span className="mt-eyebrow">
              {t.label} · {eyebrowDate(ms)}
            </span>
            <h2 id="mt-detail-title">{m.title}</h2>
            <span className="mt-detail-when">
              {m.startIso ? timeRange(ms, m.durationMin) : "All day"} · {ms > now ? untilLabel(ms, now).toLowerCase() : agoLabel(ms, now)}
            </span>
          </span>
        </div>

        {upcoming ? (
          <div className="mt-detail-actions">
            {live && m.joinUrl && (
              <a className="mt-join wide" href={m.joinUrl} target="_blank" rel="noopener noreferrer" aria-label={`Join call with ${coachFirst}`}>
                Join
              </a>
            )}
            <a className="ev-btn" href={icsDataUrl({ title: m.title, startMs: ms, durationMin: m.durationMin, url: m.joinUrl, coach: coachFirst })} download={`${m.title.replace(/[^\w ]+/g, "").trim() || "call"}.ics`}>
              Add to calendar
            </a>
          </div>
        ) : (
          <>
            <div className="mt-sec in">What we agreed</div>
            {points.length === 0 ? (
              <p className="mt-detail-none">
                {m.missed ? "This call didn't happen." : `No notes yet. ${coachFirst} adds them after the call.`}
              </p>
            ) : prose ? (
              <p className="mt-prose">{points[0]}</p>
            ) : (
              <ul className="mt-items">
                {points.map((p, i) => (
                  <CheckItem key={i} text={p} rgb={t.rgb} color={t.color} />
                ))}
              </ul>
            )}
            {m.linkedEvents.length > 0 && (
              <>
                <div className="mt-sec in">Added to your events</div>
                <div className="mt-chips">
                  {m.linkedEvents.map((e) => (
                    <EventChip key={e.id} e={e} onOpen={() => {
                      onClose();
                      openEvents?.();
                    }} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <button type="button" className="ev-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
