"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { requestMeetingAction } from "../../lib/actions";
import { newOnceKey } from "../../lib/onceKey";
import RingEdge from "../../components/RingEdge";
import type { MeetingRequestView } from "./MeetingsScreen";

// Request a meeting (9 Oct): one sheet, opened from the Meetings screen and from Home's Meetings (10 Nov, Alex).

export default function AskSheet({ clientId, coachFirst, onClose, onSent }: { clientId: number; coachFirst: string; onClose: () => void; onSent: (r: MeetingRequestView) => void }) {
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
    // Its one-time key, made as Request is tapped (6 Nov): sent again once the signal is back, it asks once.
    const onceKey = newOnceKey();
    startTransition(async () => {
      const err = await requestMeetingAction(clientId, about, when, onceKey);
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
            <RingEdge size={32} />
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
