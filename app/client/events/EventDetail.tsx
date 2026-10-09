"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { eventTypeOf } from "../../lib/eventTypes";
import { rangeLabel, relativeLabel, statusOf } from "../../lib/eventDates";
import type { HomeEvent } from "../EventsCard";
import { TypeIcon } from "./AddEventSheet";
import { CoachAvatar } from "./CoachAvatar";

// One event, in full (9 Oct): the type, the title, when and where it stands,
// the note, and who set it. The client's own can be changed or removed from
// here; the coach's are read as they are.

export default function EventDetail({
  event,
  coachName,
  coachPhoto,
  today,
  pending = false,
  onClose,
  onEdit,
  onDelete,
}: {
  event: HomeEvent;
  coachName: string;
  coachPhoto: string | null;
  today: string;
  pending?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = eventTypeOf(event.kind);
  const status = statusOf(event, today);
  const [sure, setSure] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);
  return createPortal(
    <div className="ev-scrim" role="presentation" onClick={() => !pending && onClose()}>
      <div className="ev-sheet ev-detail" role="dialog" aria-modal="true" aria-labelledby="ev-detail-title" style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <span className="ev-grab" aria-hidden="true" />
        <div className="ev-detail-top">
          <span className="ev-detail-tile">
            <TypeIcon path={t.icon} fill={t.fill} size={22} />
          </span>
          <span className="ev-detail-text">
            <h2 id="ev-detail-title">{event.title}</h2>
            <span className="ev-detail-when">
              {rangeLabel(event, today)} · <b>{relativeLabel(event, today)}</b>
              {status === "now" && " · happening now"}
            </span>
          </span>
          {!event.mine && <CoachAvatar name={coachName} photoPath={coachPhoto} size={28} ring="card" />}
        </div>
        {event.note && <p className="ev-detail-note">{event.note}</p>}
        <p className="ev-detail-by">{event.mine ? `Added by you · ${coachName} can see it` : `Set by ${coachName}`}</p>
        {event.mine && (
          <div className="ev-detail-actions">
            <button type="button" className="ev-btn" onClick={onEdit} disabled={pending}>
              Edit
            </button>
            {sure ? (
              <button type="button" className="ev-btn danger sure" onClick={onDelete} disabled={pending}>
                {pending ? "Removing…" : "Yes, remove it"}
              </button>
            ) : (
              <button type="button" className="ev-btn danger" onClick={() => setSure(true)} disabled={pending}>
                Delete
              </button>
            )}
          </div>
        )}
        <button type="button" className="ev-close" onClick={onClose} disabled={pending}>
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
