"use client";

import { useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import type { PhaseTrack } from "../lib/db";
import { phaseChrome, TRACK_LABEL, TRACK_PALETTE } from "./phaseChrome";

// Sending a phase out, from a tab's header, with one confirm and no dates to
// pick. A draft whose start is in a later week is scheduled on its own dates
// (startsOn); one whose week has come, or a scheduled one made live early,
// goes live this week and keeps its length, and what happens to the phase
// running on the same track is said before anything goes out (deployPhaseNow).

const DAY = 86400000;
const parse = (s: string) => new Date(`${s}T00:00:00`);
const mondayOf = (s: string) => {
  const d = parse(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
const fmt = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default function DeployNowDialog({
  track,
  name,
  weeks,
  days,
  today,
  running,
  next = null,
  startsOn = null,
  blocked,
  onConfirm,
  onClose,
}: {
  track: PhaseTrack;
  name: string;
  /** Scheduling on its own dates: the Monday it starts (a later week). */
  startsOn?: string | null;
  /** How long it runs from this week. */
  weeks: number;
  /** A nutrition or lifestyle phase's exact length in days: it goes live today rather than this Monday. */
  days?: number;
  today: string;
  /** The phase live on this track now, which makes room for this one. */
  running: { name: string; start_week: string } | null;
  /** The next phase already set on this track: this one runs up to it. */
  next?: { name: string; start_week: string } | null;
  /** Why it can't go out yet, said instead of a button that does nothing. */
  blocked?: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, run] = useTransition();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Scheduled on its own dates when it starts later; otherwise live now:
  // from today for a nutrition or lifestyle phase, from this Monday for a
  // programme, which runs in whole weeks (deployPhaseNow does the same).
  const byDay = track !== "training";
  const later = !!startsOn && startsOn > (byDay ? today : isoOf(mondayOf(today)));
  const start = later ? parse(startsOn!) : byDay ? parse(today) : mondayOf(today);
  const full = new Date(start.getTime() + ((byDay && days ? days : weeks * 7) - 1) * DAY);
  // A nutrition or lifestyle phase stops short of the next one; a programme
  // keeps its weeks, and the next one takes over when it starts.
  const nextDay = next ? parse(next.start_week) : null;
  const cut = !later && !!nextDay && track !== "training" && full >= nextDay;
  const end = cut && nextDay ? new Date(nextDay.getTime() - DAY) : full;
  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
  const runs = [Math.floor(spanDays / 7), spanDays % 7]
    .map((n, i) => (n ? `${n} ${i === 0 ? "week" : "day"}${n === 1 ? "" : "s"}` : ""))
    .filter(Boolean)
    .join(" ");
  const dayBefore = new Date(start.getTime() - DAY);
  const chrome = phaseChrome(track, later ? "scheduled" : "live");
  const palette = TRACK_PALETTE[track];
  const what = track === "training" ? "this programme" : track === "nutrition" ? "these nutrition targets" : "this lifestyle phase";
  const handsOver = later || !next || !nextDay || nextDay > full ? null : `${next.name} takes over on ${fmt(nextDay)}, as planned.`;
  const makesRoom = later || !running
    ? null
    : track === "training"
      ? `It replaces ${running.name} as the programme the client trains.`
      : running.start_week < isoOf(start)
        ? `${running.name} ends ${byDay ? "yesterday" : "last week"}, on ${fmt(dayBefore)}.`
        : `${running.name} only started ${byDay ? "today" : "this week"}, so it goes back to a draft.`;

  return createPortal(
    <div className="pl-dlg-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pl-dlg pl-move" role="dialog" aria-modal="true" aria-label={later ? `Schedule ${name}` : `Put ${name} live`}>
        <header className="pl-dlg-head">
          <h2>{later ? `Schedule ${name}` : `Put ${name} live`}</h2>
          <span className="pl-track-tag" style={{ background: palette.tint, color: palette.ink }}>
            {TRACK_LABEL[track]}
          </span>
          <span className="pl-dlg-state" style={{ background: chrome.chipBg, color: chrome.chipInk }}>
            {later ? "Scheduled" : "Live"}
          </span>
        </header>
        <div className="pl-dlg-body">
          <div className="pl-move-rows">
            <div className="pl-move-row">
              <span className="pl-dlg-label">Goes live</span>
              <b className="pl-move-now" style={{ gridColumn: "2 / -1", color: chrome.edge }}>
                {later ? fmt(start) : `Now · from ${fmt(start)}`}
              </b>
            </div>
            <div className="pl-move-row">
              <span className="pl-dlg-label">Runs</span>
              <b style={{ gridColumn: "2 / -1" }}>
                {runs}, to {fmt(end)}
              </b>
            </div>
          </div>
          <p className={`pl-move-note${blocked ? " warn" : ""}`}>
            {blocked ??
              (later
                ? `The client gets ${what} in their app on ${fmt(start)}, by itself. Until then you can still change it or take it back to a draft.`
                : `The client gets ${what} in their app straight away.${makesRoom ? ` ${makesRoom}` : ""}${handsOver ? ` ${handsOver}` : ""}`)}
          </p>
        </div>
        <footer className="pl-dlg-foot">
          <div className="pl-dlg-actions">
            <button type="button" className="pl-dlg-cancel" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="pl-dlg-save"
              disabled={busy || !!blocked}
              onClick={() =>
                run(async () => {
                  await onConfirm();
                  onClose();
                })
              }
            >
              {busy ? (later ? "Scheduling…" : "Putting it live…") : later ? "Schedule it" : "Put it live"}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
