"use client";

import { useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { repeatWords } from "../../../lib/eventRepeat";
import { dayMonth } from "../../../lib/dayMonth";
import { chromeOf, KindIcon, rgbOf, standingParts } from "../plan/EventsCard";
import { eventIsPast } from "../plan/timelineParts";
import { SepJoin } from "../Sep";
import type { OverviewClient } from "./load";
import { daysBetween, type OverviewEvent } from "./timeline";

// An event's detail (14 Oct; the .dlh card since 21 Oct), from a bar or pin
// on the Phases timeline: the phase pop-up's sibling. Read-only: the title,
// its kind (and From {first name}, Past) as tags, one fact line, who added it, the
// note, and one way out: Open, to the client's Plan.

const first = (name: string) => name.split(" ")[0];
/** "today", "yesterday", "3 days ago", or the date. */
const addedWhen = (d: string, today: string) => {
  if (!d) return "";
  const ago = daysBetween(d, today);
  return ago === 0 ? "today" : ago === 1 ? "yesterday" : ago < 7 ? `${ago} days ago` : dayMonth(d);
};

export default function EventDetailDialog({ client, event: e, today }: { client: OverviewClient; event: OverviewEvent; today: string }) {
  // The kind's colour and name as the timeline wears them (EventsCard's chromeOf): a kind that isn't one of the app's is grey "Event".
  const k = chromeOf([], e.kind);
  const byClient = e.addedBy === "client";
  const past = eventIsPast(e, today);
  const single = e.start === e.end;
  const openRef = useRef<HTMLAnchorElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const longNote = e.note.length > 280;
  const facts: React.ReactNode[] = single
    ? [client.name, dayMonth(e.start), ...standingParts(today, e)]
    : [client.name, `${dayMonth(e.start)} – ${e.repeat && !e.repeat.until ? "no end" : dayMonth(e.end)}`, e.repeat ? repeatWords(e.repeat, { until: false }) : `${daysBetween(e.start, e.end) + 1} days`, ...standingParts(today, e)];

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
      <DialogDescription className="dlh-what">
        <SepJoin parts={facts} />
      </DialogDescription>

      <div className="phd-field">
        <span className="dlh-label">Added by</span>
        <p className="evd-text">
          <SepJoin parts={[byClient ? first(client.name) : "You", addedWhen(e.createdAt, today)]} />
        </p>
      </div>

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
