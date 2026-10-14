"use client";

import { useRef } from "react";
import type React from "react";
import Link from "next/link";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import type { PhaseTrack } from "../../../lib/db";
import { TRACK_LABEL } from "../../phaseChrome";
import type { OverviewClient } from "./load";
import { daysBetween, daysLeft, nextOnTrack, phaseState, phaseStatus, prevOnTrack, shortDate, TRACK_COLOR, weekIndexOf, weekSegments, weeksOf, type OverviewPhase, type PhaseState } from "./timeline";

// A phase's detail (14 Oct), from a bar on the Phases timeline. Read-only:
// the track pill and a state chip, the name, the client's first name, the
// weeks as segments with the current one part-filled, the coach's
// objectives, what comes after on the track, and one way out: Open plan.
// A draft wears a dashed rust box and says DRAFT · NOT SENT, so it is
// recognisable at once. ← and → move along the track.

const TRACK_ICON: Record<PhaseTrack, string> = {
  lifestyle: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  training: "M6.5 8v8M17.5 8v8M4 10v4M20 10v4M6.5 12h11",
  nutrition: "M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7",
};
const first = (name: string) => name.split(" ")[0];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const inWords = (days: number) => (days >= 14 ? plural(Math.round(days / 7), "week") : plural(days, "day"));

/** Where the phase is edited: the track's own tab, on this phase. */
export const planHref = (clientId: number, p: OverviewPhase) =>
  p.track === "training" ? `/admin/redesign/training?client=${clientId}${p.programId ? `&program=${p.programId}` : ""}` : `/admin/redesign/${p.track === "nutrition" ? "nutrition" : "measurements"}?client=${clientId}&phase=${p.id}`;

function chipOf(p: OverviewPhase, state: PhaseState, today: string): { text: string; cls: string } {
  if (state === "soon") {
    const d = daysLeft(p, today);
    return { text: d <= 0 ? "Ends today" : d === 1 ? "Ends tomorrow" : `Ends in ${d} days`, cls: "soon" };
  }
  if (state === "running") return { text: `Week ${weekIndexOf(p, today)} of ${weeksOf(p)}`, cls: "track" };
  if (state === "upcoming") return { text: `Starts in ${daysBetween(today, p.start)} days`, cls: "track" };
  if (state === "draft") return { text: "Draft · not sent", cls: "draft" };
  return { text: "Done", cls: "done" };
}

export default function PhaseDetailDialog({ client, phase: p, today, onMove }: { client: OverviewClient; phase: OverviewPhase; today: string; /** ← and →: the phase before or after on the track. */ onMove: (p: OverviewPhase) => void }) {
  const col = TRACK_COLOR[p.track];
  const state = phaseState(p, client.phases, today);
  const status = phaseStatus(p, today);
  const running = status === "running";
  const chip = chipOf(p, state, today);
  const draft = state === "draft";
  const left = daysLeft(p, today);
  const total = daysBetween(p.start, p.end) + 1;
  const weeks = weeksOf(p);
  const segments = weekSegments(p, today);
  const length = total % 7 === 0 ? plural(weeks, "week") : plural(total, "day");
  const next = nextOnTrack(p, client.phases);
  const prev = prevOnTrack(p, client.phases);
  const openRef = useRef<HTMLAnchorElement>(null);
  const href = planHref(client.id, p);

  const top = running ? `Week ${weekIndexOf(p, today)} of ${weeks}` : status === "done" ? `Finished on ${shortDate(p.end)}` : `Starts in ${inWords(daysBetween(today, p.start))}`;
  const side = running
    ? { text: `${left} day${left === 1 ? "" : "s"} left`, cls: state === "soon" ? "rust" : "track" }
    : draft
      ? { text: "Draft", cls: "rust" }
      : status === "upcoming"
        ? { text: `Sent · ${first(client.name)} sees it`, cls: "faint" }
        : { text: `${weeks} of ${weeks} weeks`, cls: "ok" };

  // After this: the next phase on the track, or the warning that nothing is.
  const after = next
    ? next.draft
      ? { text: `${next.name} · draft · from ${shortDate(next.start)}`, cls: "rust" }
      : phaseStatus(next, today) === "running"
        ? { text: `${next.name} · running since ${shortDate(next.start)}`, cls: "track" }
        : { text: `${next.name} · from ${shortDate(next.start)}`, cls: "track" }
    : status === "done"
      ? { text: "Nothing followed", cls: "faint" }
      : { text: `Nothing planned. The ${TRACK_LABEL[p.track].toLowerCase()} track ends here.`, cls: "rust" };

  const shown = p.objectives.slice(0, 4);
  const more = p.objectives.length - shown.length;

  return (
    <DialogContent
      className="phd"
      style={{ "--c": col.c, "--rgb": col.rgb } as React.CSSProperties}
      aria-describedby="phd-state"
      onOpenAutoFocus={(ev) => {
        ev.preventDefault();
        openRef.current?.focus();
      }}
      onKeyDown={(ev) => {
        if (ev.key === "ArrowLeft" && prev) onMove(prev);
        if (ev.key === "ArrowRight" && next) onMove(next);
      }}
    >
      <span className="phd-glow" aria-hidden="true" />
      <span className="phd-wash" aria-hidden="true" />
      <div className="phd-body">
        <header className="phd-head">
          <div className="phd-head-text">
            <div className="phd-pills">
              <span className="phd-track">
                <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={TRACK_ICON[p.track]} />
                </svg>
                {TRACK_LABEL[p.track]}
              </span>
              <DialogDescription id="phd-state" className={`phd-chip ${chip.cls}`}>
                {chip.text}
              </DialogDescription>
            </div>
            <DialogTitle className="phd-name">{p.name}</DialogTitle>
            <span className="phd-client">
              <span className="phd-avatar">
                {client.avatarPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
                  <img src={client.avatarPath} alt="" />
                ) : (
                  client.name.slice(0, 1).toUpperCase()
                )}
              </span>
              {first(client.name)}
            </span>
          </div>
          <DialogClose className="phd-x" aria-label="Close">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </DialogClose>
        </header>

        {/* The weeks. */}
        <div className={`phd-box${draft ? " draft" : ""}`}>
          <div className="phd-box-top">
            <b>{top}</b>
            <span className={`phd-side ${side.cls}`}>{side.text}</span>
          </div>
          {weeks > 16 ? (
            <span className="phd-bar" aria-hidden="true">
              <i style={{ width: `${(Math.min(total, Math.max(0, daysBetween(p.start, today) + 1)) / total) * 100}%` }} />
            </span>
          ) : (
            <div className="phd-weeks" style={{ gridTemplateColumns: segments.map((s) => `${s.days}fr`).join(" ") }} aria-hidden="true">
              {segments.map((s, i) => {
                const now = s.fill > 0 && s.fill < 1;
                return <i key={i} className={`phd-week${s.fill >= 1 ? " past" : now ? " now" : ""}`} style={now ? { background: `linear-gradient(90deg, var(--c) ${s.fill * 100}%, rgba(var(--rgb), 0.16) ${s.fill * 100}%)` } : undefined} />;
              })}
            </div>
          )}
          <div className="phd-dates">
            <span>{shortDate(p.start)}</span>
            <span>{length}</span>
            <span>{shortDate(p.end)}</span>
          </div>
        </div>

        {/* The coach's objectives. */}
        <section className="phd-section">
          <span className="phd-label">Objectives</span>
          {shown.length === 0 ? (
            <p className="phd-none">No objectives set</p>
          ) : (
            <ul className="phd-objectives">
              {shown.map((o, i) => (
                <li key={i}>
                  <i aria-hidden="true" />
                  {o}
                </li>
              ))}
              {more > 0 && (
                <li className="phd-more">
                  <Link href={href}>+{more} more</Link>
                </li>
              )}
            </ul>
          )}
        </section>

        {/* What follows on the track. */}
        <div className={`phd-after ${after.cls}`}>
          <span className="phd-after-label">After this</span>
          <span className="phd-after-text">{after.text}</span>
        </div>
      </div>

      <footer className="phd-foot">
        <span className="phd-note">{draft ? "Only you see a draft until it’s sent." : "Changes are made in the client’s plan."}</span>
        <Link ref={openRef} href={href} className="phd-open">
          Open plan
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </footer>
    </DialogContent>
  );
}
