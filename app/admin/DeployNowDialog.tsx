"use client";

import { useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import type { PhaseTrack } from "../lib/db";
import { phaseChrome, TRACK_LABEL, TRACK_PALETTE } from "./phaseChrome";

// A draft (or scheduled) phase straight out, no dates to pick: it goes live
// this week and keeps its length. What happens to the phase running now on
// the same track is said before anything goes out (deployPhaseNow).
// Scheduling for later stays behind the phase's Schedule button.

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
  today,
  running,
  next = null,
  blocked,
  onConfirm,
  onClose,
}: {
  track: PhaseTrack;
  name: string;
  /** How long it runs from this week. */
  weeks: number;
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

  const start = mondayOf(today);
  const full = new Date(start.getTime() + (weeks * 7 - 1) * DAY);
  // A nutrition or lifestyle phase stops short of the next one; a programme
  // keeps its weeks, and the next one takes over when it starts.
  const nextDay = next ? parse(next.start_week) : null;
  const cut = !!nextDay && track !== "training" && full >= nextDay;
  const end = cut && nextDay ? new Date(nextDay.getTime() - DAY) : full;
  const shown = Math.max(1, Math.round((end.getTime() - start.getTime() + DAY) / (7 * DAY)));
  const lastSunday = new Date(start.getTime() - DAY);
  const chrome = phaseChrome(track, "live");
  const palette = TRACK_PALETTE[track];
  const what = track === "training" ? "this programme" : track === "nutrition" ? "these nutrition targets" : "this lifestyle phase";
  const handsOver = !next || !nextDay || nextDay > full ? null : `${next.name} takes over on ${fmt(nextDay)}, as planned.`;
  const makesRoom = !running
    ? null
    : track === "training"
      ? `It replaces ${running.name} as the programme the client trains.`
      : running.start_week < isoOf(start)
        ? `${running.name} ends last week, on ${fmt(lastSunday)}.`
        : `${running.name} only started this week, so it goes back to a draft.`;

  return createPortal(
    <div className="pl-dlg-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pl-dlg pl-move" role="dialog" aria-modal="true" aria-label={`Deploy ${name} now`}>
        <header className="pl-dlg-head">
          <h2>Deploy {name} now</h2>
          <span className="pl-track-tag" style={{ background: palette.tint, color: palette.ink }}>
            {TRACK_LABEL[track]}
          </span>
          <span className="pl-dlg-state" style={{ background: chrome.chipBg, color: chrome.chipInk }}>
            Live
          </span>
        </header>
        <div className="pl-dlg-body">
          <div className="pl-move-rows">
            <div className="pl-move-row">
              <span className="pl-dlg-label">Goes live</span>
              <b className="pl-move-now" style={{ gridColumn: "2 / -1", color: chrome.edge }}>
                Now · from {fmt(start)}
              </b>
            </div>
            <div className="pl-move-row">
              <span className="pl-dlg-label">Runs</span>
              <b style={{ gridColumn: "2 / -1" }}>
                {shown} week{shown === 1 ? "" : "s"}, to {fmt(end)}
              </b>
            </div>
          </div>
          <p className={`pl-move-note${blocked ? " warn" : ""}`}>
            {blocked ?? `The client gets ${what} in their app straight away.${makesRoom ? ` ${makesRoom}` : ""}${handsOver ? ` ${handsOver}` : ""}`}
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
              {busy ? "Deploying…" : "Deploy now"}
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
