"use client";

import { useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { dayMonth } from "../../../lib/dayMonth";
import { repeatWords } from "../../../lib/eventRepeat";
import { pic } from "../../../lib/pic";
import { STATE_LABEL, stateTagStyle } from "../../phaseChrome";
import { chromeOf, KindIcon, rgbOf } from "../plan/EventsCard";
import { eventName, eventState, relative } from "../plan/timelineParts";
import DateSpan from "./DateSpan";
import type { OverviewClient } from "./load";
import { daysBetween, type OverviewEvent } from "./timeline";

// An event's detail (14 Oct; the .dlh card since 21 Oct), from a bar or pin on the Phases timeline: the phase pop-up's
// sibling, read-only (23 Oct, Alex: events are changed on the client's own screens). One anatomy with the phase's
// (24 Oct, Alex: docs/boards/plan-popups-mockup.html): the title; its kind and state as tags; its days big (DateSpan),
// how long over where it stands on the right (a single day: where it stands alone); the track of where today is; the
// note; who added it bottom left, Open on the right.

const first = (name: string) => name.split(" ")[0];
const up = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function EventDetailDialog({ client, event: e, today, coach }: { client: OverviewClient; event: OverviewEvent; today: string; /** The coach's face for "Added by" (23 Oct, Alex: as the client's Events screen shows it). */ coach: { name: string; avatarPath: string | null } }) {
  // The kind's colour and name as the timeline wears them (EventsCard's chromeOf): a kind that isn't one of the app's is grey "Event".
  const k = chromeOf([], e.kind);
  const byClient = e.addedBy === "client";
  const state = eventState(e, today);
  const single = e.start === e.end;
  const openEnded = !!e.repeat && !e.repeat.until;
  const openRef = useRef<HTMLAnchorElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const longNote = e.note.length > 280;
  const total = daysBetween(e.start, e.end) + 1;
  // How long (a single day has none: one tile says it), then where it stands: "Day 2 of 7", "In 13 days", "Ended 21/10".
  const length = single ? null : e.repeat ? repeatWords(e.repeat, { until: false }) : `${total} days`;
  const standing = single
    ? up(relative(today, e.start))
    : state === "scheduled"
      ? up(relative(today, e.start))
      : state === "past"
        ? `Ended ${dayMonth(e.repeat?.until ?? e.end)}`
        : openEnded
          ? "Ongoing"
          : `Day ${daysBetween(e.start, today) + 1} of ${total}`;
  // Where today is along it: none for a single day or one with no end; empty to come, full once over.
  const track = single || openEnded ? null : state === "scheduled" ? 0 : state === "past" ? 1 : (daysBetween(e.start, today) + 1) / total;
  const by: { name: string; photo: string | null; initial: string } = byClient ? { name: first(client.name), photo: client.avatarPath, initial: client.name } : { name: "you", photo: coach.avatarPath, initial: coach.name };

  return (
    <DialogContent
      className="dlh mvd evd"
      style={{ "--mv": k.ink, "--mv-rgb": rgbOf(k.ink) } as React.CSSProperties}
      onOpenAutoFocus={(ev) => {
        ev.preventDefault();
        openRef.current?.focus();
      }}
    >
      <div className="dlh-head">
        <DialogTitle className="dlh-title">{eventName(e, k.label)}</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <div className="mvd-tags">
        <span className="mvd-track">
          <KindIcon id={e.kind} size={12} />
          {k.label}
        </span>
        <span className="mvd-state" style={stateTagStyle(state)}>
          {STATE_LABEL[state]}
        </span>
      </div>
      <DialogDescription asChild>
        <div>
          <DateSpan start={e.start} end={single ? e.start : openEnded ? null : e.end} today={today} facts={[length, standing]} />
        </div>
      </DialogDescription>

      {track != null && (
        <span className={`dsp-track${state === "past" ? " past" : ""}`} aria-hidden="true">
          <i style={{ width: `${Math.min(1, track) * 100}%` }} />
        </span>
      )}

      {/* The note, in quotes when the client wrote it. */}
      {e.note && (
        <div className="phd-field">
          <span className="dlh-label">Note</span>
          <p className={`evd-text evd-note${longNote && !noteOpen ? " clamp" : ""}`}>{byClient ? `“${e.note}”` : e.note}</p>
          {longNote && !noteOpen && (
            <button type="button" className="evd-more" onClick={() => setNoteOpen(true)}>
              Show more
            </button>
          )}
        </div>
      )}

      <div className="dlh-foot">
        {/* Who added it, bottom left (24 Oct, Alex: not a tag): their face and "Added by Finlay", "Added by you". */}
        <span className="dlh-by">
          <span className="evd-face" aria-hidden="true">
            {by.photo ? <img src={pic(by.photo, 96)} alt="" /> : (by.initial.trim().charAt(0) || "?").toUpperCase()}
          </span>
          Added by <b>{by.name}</b>
        </span>
        <Link ref={openRef} href={`/admin/redesign/plan?client=${client.id}`} className="dlh-go">
          Open
        </Link>
      </div>
    </DialogContent>
  );
}
