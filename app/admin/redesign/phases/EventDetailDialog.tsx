"use client";

import { useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { repeatWords } from "../../../lib/eventRepeat";
import { chromeOf, KindIcon, rgbOf, standingParts } from "../plan/EventsCard";
import { eventIsPast } from "../plan/timelineParts";
import { SepJoin } from "../Sep";
import DateSpan from "./DateSpan";
import type { OverviewClient } from "./load";
import { daysBetween, type OverviewEvent } from "./timeline";

// An event's detail (14 Oct; the .dlh card since 21 Oct), from a bar or pin
// on the Phases timeline: the phase pop-up's sibling. Read-only (23 Oct, Alex:
// events are changed on the client's own screens): the title, its kind (and
// From {first name}, Past) as tags, its days big (DateSpan; no client name, the
// row says whose it is), who added it with their face, the note, and one way
// out: Open, to the client's Plan.

const first = (name: string) => name.split(" ")[0];

/** "In 13 days", "Now | 3 days left": the standing, its first word capitalised as it starts a line. */
const upFirst = (parts: string[]) => parts.map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p));

export default function EventDetailDialog({ client, event: e, today, coach }: { client: OverviewClient; event: OverviewEvent; today: string; /** The coach's face for "Added by" (23 Oct, Alex: as the client's Events screen shows it). */ coach: { name: string; avatarPath: string | null } }) {
  // The kind's colour and name as the timeline wears them (EventsCard's chromeOf): a kind that isn't one of the app's is grey "Event".
  const k = chromeOf([], e.kind);
  const byClient = e.addedBy === "client";
  const past = eventIsPast(e, today);
  const single = e.start === e.end;
  const openRef = useRef<HTMLAnchorElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const longNote = e.note.length > 280;
  // How long, then where it stands: "4 days" over "In 13 days"; a repeat says its days.
  const length = single ? null : e.repeat ? repeatWords(e.repeat, { until: false }) : `${daysBetween(e.start, e.end) + 1} days`;
  const standing = <SepJoin parts={upFirst(standingParts(today, e))} />;
  const by: { name: string; photo: string | null; initial: string } = byClient ? { name: first(client.name), photo: client.avatarPath, initial: client.name } : { name: "You", photo: coach.avatarPath, initial: coach.name };

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
        <DialogTitle className="dlh-title">{e.title}</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <div className="mvd-tags">
        <span className="mvd-track">
          <KindIcon id={e.kind} size={12} />
          {k.label}
        </span>
        {byClient && <span className="evd-tag">From {first(client.name)}</span>}
        {past && <span className="evd-tag">Past</span>}
      </div>
      <DialogDescription asChild>
        <div>
          {/* The days and who added it on one row (23 Oct, Alex); who added it with their face first, as the client's own
              Events screen shows it. */}
          <DateSpan
            start={e.start}
            end={single ? e.start : e.repeat && !e.repeat.until ? null : e.end}
            today={today}
            facts={[length, standing]}
            aside={
              <div className="phd-field evd-added">
                <span className="dlh-label">Added by</span>
                <span className="evd-text evd-by">
                  <span className="evd-face" aria-hidden="true">
                    {by.photo ? <img src={by.photo} alt="" /> : (by.initial.trim().charAt(0) || "?").toUpperCase()}
                  </span>
                  {/* Who, not when (23 Oct, Alex). */}
                  {by.name}
                </span>
              </div>
            }
          />
        </div>
      </DialogDescription>

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
        <Link ref={openRef} href={`/admin/redesign/plan?client=${client.id}`} className="dlh-go">
          Open
        </Link>
      </div>
    </DialogContent>
  );
}
