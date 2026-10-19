"use client";

import { useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { eventTypeOf } from "../../../lib/eventTypes";
import { repeatWords } from "../../../lib/eventRepeat";
import type { OverviewClient } from "./load";
import { daysBetween, eventTiming, shortDate, type OverviewEvent } from "./timeline";

// An event's detail (14 Oct), from a marker on the Phases timeline: the
// phase pop-up's sibling. The category's icon big and alone, a category
// pill and a timing chip, the title, when (a date tile for one day; from,
// to, length and progress for a range), who added it, the note as a
// bubble, and one way out: Open events. Read-only.

const first = (name: string) => name.split(" ")[0];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const lengthLabel = (days: number) => (days % 7 === 0 && days >= 21 ? plural(days / 7, "week") : plural(days, "day"));
const longDate = (d: string, today: string) => {
  const x = new Date(`${d}T12:00:00`);
  return x.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", ...(d.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) });
};
const dayDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
/** "yesterday", "3 days ago", or the date. */
const addedWhen = (d: string, today: string) => {
  if (!d) return "";
  const ago = daysBetween(d, today);
  return ago === 0 ? "today" : ago === 1 ? "yesterday" : ago < 7 ? `${ago} days ago` : shortDate(d);
};

export default function EventDetailDialog({ client, event: e, today, coach }: { client: OverviewClient; event: OverviewEvent; today: string; coach: { name: string; photoPath: string | null } }) {
  const t = eventTypeOf(e.kind);
  const timing = eventTiming(e, today);
  const openRef = useRef<HTMLAnchorElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const longNote = e.note.length > 280;
  const wd = new Date(`${e.start}T12:00:00`);
  const byClient = e.addedBy === "client";

  return (
    <DialogContent
      className="evd"
      style={{ "--c": t.color, "--rgb": t.rgb } as React.CSSProperties}
      aria-describedby="evd-state"
      onOpenAutoFocus={(ev) => {
        ev.preventDefault();
        openRef.current?.focus();
      }}
    >
      <span className="evd-glow" aria-hidden="true" />
      <span className="evd-wash" aria-hidden="true" />
      <div className="evd-body">
        <header className="evd-head">
          <span className="evd-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              {t.fill && <path d={t.fill} fill="currentColor" stroke="none" opacity={0.35} />}
              <path d={t.icon} />
            </svg>
          </span>
          <div className="evd-head-text">
            <div className="evd-pills">
              <span className="evd-cat">{t.label}</span>
              <DialogDescription id="evd-state" className={`evd-chip ${timing.chip.cls}`}>
                {timing.chip.text}
              </DialogDescription>
            </div>
            <DialogTitle className="evd-title">{e.title}</DialogTitle>
          </div>
          <DialogClose className="phd-x" aria-label="Close">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </DialogClose>
        </header>

        {/* When. */}
        <div className="evd-when">
          {timing.range ? (
            <>
              <div className="evd-range">
                <span className="evd-end">
                  <small>From</small>
                  <b>{dayDate(e.start)}</b>
                </span>
                <span className="evd-len">{e.repeat ? repeatWords(e.repeat, { until: false }) : lengthLabel(timing.days)}</span>
                <span className="evd-end to">
                  <small>{e.repeat ? "Until" : "To"}</small>
                  <b>{e.repeat && !e.repeat.until ? "No end" : dayDate(e.end)}</b>
                </span>
              </div>
              <span className="evd-bar" aria-hidden="true">
                <i style={{ width: `${timing.pct * 100}%` }} />
              </span>
              <span className="evd-rel">{timing.relative}</span>
            </>
          ) : (
            <div className="evd-day">
              <span className="evd-tile" aria-hidden="true">
                <small className="wd">{wd.toLocaleDateString("en-GB", { weekday: "short" })}</small>
                <b>{wd.getDate()}</b>
                <small>{wd.toLocaleDateString("en-GB", { month: "short" })}</small>
              </span>
              <span className="evd-day-text">
                <span className="evd-date">{longDate(e.start, today)}</span>
                <span className="evd-rel">{timing.relative}</span>
              </span>
            </div>
          )}
        </div>

        {/* Who: the client, always; a small badge of the coach when the coach added it. */}
        <div className="evd-who">
          <span className="evd-avatar">
            {client.avatarPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
              <img src={client.avatarPath} alt="" />
            ) : (
              client.name.slice(0, 1).toUpperCase()
            )}
            {!byClient && (
              <span className="evd-badge" aria-label="Added by you">
                {coach.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- coach-uploaded file
                  <img src={coach.photoPath} alt="" />
                ) : (
                  coach.name.slice(0, 1).toUpperCase()
                )}
              </span>
            )}
          </span>
          <span className="evd-who-text">
            <b>{client.name}</b>
            <small>
              Added by {byClient ? first(client.name) : "you"}
              {e.createdAt ? ` · ${addedWhen(e.createdAt, today)}` : ""}
            </small>
          </span>
        </div>

        {/* The note, in quotes when the client wrote it. */}
        {e.note && (
          <>
            <p className={`evd-note${longNote && !noteOpen ? " clamp" : ""}`}>{byClient ? `“${e.note}”` : e.note}</p>
            {longNote && !noteOpen && (
              <button type="button" className="evd-more" onClick={() => setNoteOpen(true)}>
                Show more
              </button>
            )}
          </>
        )}
      </div>

      <footer className="evd-foot">
        <Link ref={openRef} href={`/admin/redesign/plan?client=${client.id}`} className="phd-open">
          Open events
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </footer>
    </DialogContent>
  );
}
