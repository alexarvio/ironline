"use client";

import { useRef } from "react";
import type React from "react";
import Link from "next/link";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { phaseStateOf, STATE_LABEL, stateTagStyle, TRACK_ACCENT, TRACK_LABEL } from "../../phaseChrome";
import { phaseLengthLabel } from "../../../lib/phases";
import { dayMonth } from "../../../lib/dayMonth";
import { TrackIcon, weeksBetween } from "../plan/PlanDraft";
import { rgbOf } from "../plan/EventsCard";
import { SepJoin } from "../Sep";
import type { OverviewClient } from "./load";
import { daysLeft, endingSoon, leftLabel, mondayOf, nextOnTrack, prevOnTrack, weekSegments, type OverviewPhase } from "./timeline";

// A phase's detail (14 Oct; the .dlh card since 21 Oct), from a bar on the
// Phases timeline. Read-only: the name, its track and state tags, one fact
// line, the weeks as a strip, its goals, what comes after on the track, and
// one way out: Open, to the track's own tab. ← and → move along the track.

/** Where the phase is edited: the track's own tab, on this phase. */
export const planHref = (clientId: number, p: OverviewPhase) =>
  p.track === "training" ? `/admin/redesign/training?client=${clientId}${p.programId ? `&program=${p.programId}` : ""}` : `/admin/redesign/${p.track === "nutrition" ? "nutrition" : "measurements"}?client=${clientId}&phase=${p.id}`;

const stateOf = (p: OverviewPhase, today: string) => phaseStateOf({ draft: p.draft, startWeek: p.start, endWeek: p.endWeek, today });

export default function PhaseDetailDialog({ client, phase: p, today, onMove }: { client: OverviewClient; phase: OverviewPhase; today: string; /** ← and →: the phase before or after on the track. */ onMove: (p: OverviewPhase) => void }) {
  const accent = TRACK_ACCENT[p.track];
  const state = stateOf(p, today);
  const soon = endingSoon(p, client.phases, today);
  // The Plan bar's weeks, so the two always say the same.
  const total = weeksBetween(p.start, p.endWeek) + 1;
  const weekNow = weeksBetween(p.start, mondayOf(today)) + 1;
  // A draft has run for nobody: its strip stays empty, as its bar has no shade.
  const segments = weekSegments(p, today).map((s) => (state === "draft" ? { ...s, fill: 0 } : s));
  const elapsed = segments.reduce((n, s) => n + s.days * s.fill, 0) / Math.max(1, segments.reduce((n, s) => n + s.days, 0));
  const next = nextOnTrack(p, client.phases);
  const prev = prevOnTrack(p, client.phases);
  const nextState = next ? stateOf(next, today) : null;
  const goals = p.objectives.filter((g) => g.trim()).slice(0, 3);
  const openRef = useRef<HTMLAnchorElement>(null);

  return (
    <DialogContent
      className="dlh mvd phd"
      style={{ "--mv": accent, "--mv-rgb": rgbOf(accent) } as React.CSSProperties}
      onOpenAutoFocus={(ev) => {
        ev.preventDefault();
        openRef.current?.focus();
      }}
      onKeyDown={(ev) => {
        if (ev.key === "ArrowLeft" && prev) onMove(prev);
        if (ev.key === "ArrowRight" && next) onMove(next);
      }}
    >
      <div className="dlh-head">
        <DialogTitle className="dlh-title">{p.name}</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <div className="mvd-tags">
        <span className="mvd-track">
          <TrackIcon track={p.track} size={12} />
          {TRACK_LABEL[p.track]}
        </span>
        <span className="mvd-state" style={stateTagStyle(state)}>
          {STATE_LABEL[state]}
        </span>
      </div>
      <DialogDescription className="dlh-what">
        <SepJoin parts={[client.name, state === "live" ? `week ${weekNow} of ${total}` : phaseLengthLabel(p.start, p.endWeek), `${dayMonth(p.start)} – ${dayMonth(p.end)}`, soon && <span className="phd-soon">{leftLabel(daysLeft(p, today))}</span>]} />
      </DialogDescription>

      {/* The weeks: those behind in the track's colour, this one part filled, those to come grey. A long phase is one line. */}
      {segments.length > 16 ? (
        <span className="phd-line" aria-hidden="true">
          <i style={{ width: `${elapsed * 100}%` }} />
        </span>
      ) : (
        <span className="phd-weeks" style={{ gridTemplateColumns: segments.map((s) => `${s.days}fr`).join(" ") }} aria-hidden="true">
          {segments.map((s, i) => (
            <i key={i} className={s.fill >= 1 ? "done" : undefined} style={s.fill > 0 && s.fill < 1 ? { background: `linear-gradient(90deg, var(--mv) ${s.fill * 100}%, #eef0f3 ${s.fill * 100}%)` } : undefined} />
          ))}
        </span>
      )}

      <div className="phd-field">
        <span className="dlh-label">Phase goals</span>
        {goals.length === 0 ? (
          <p className="phd-none">None yet</p>
        ) : (
          <ul className="phd-goals">
            {goals.map((g, i) => (
              <li key={i}>
                <i aria-hidden="true" />
                {g}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="phd-field">
        <span className="dlh-label">After this</span>
        {next && nextState ? (
          <p className="phd-after">
            <b>{next.name}</b>
            <span className="mvd-state" style={stateTagStyle(nextState)}>
              {STATE_LABEL[nextState]}
            </span>
            <span className="phd-after-when">from {dayMonth(next.start)}</span>
          </p>
        ) : state === "past" ? (
          <p className="phd-none">Nothing followed</p>
        ) : (
          <p className="phd-none bad">Nothing planned</p>
        )}
      </div>

      <div className="dlh-foot">
        <Link ref={openRef} href={planHref(client.id, p)} className="dlh-go">
          Open
        </Link>
      </div>
    </DialogContent>
  );
}
