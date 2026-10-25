"use client";

import type React from "react";
import { useOpenPhotos } from "../CheckInContext";
import type { ProgressPics } from "../ProgressPicsCard";
import { Bars } from "../Bars";

// Home's progress pictures row as a hairline pill (16 Oct): a thin ring with
// one segment per photo the coach asks for, filling in rust as they upload,
// solid green with a tick once the set is done; the count in a small label,
// the title on one line, and Start / Continue / View on the right. The whole
// pill is the tap; it opens the pictures flow.

const CAMERA = "M4 8h4l2-3h4l2 3h4v11H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";
const TICK = "M5 12.5l4.5 4.5L19 7.5";
const RUST = "#b8471f";
const RUST_FAINT = "rgba(184,71,31,0.28)";
const GREEN = "#2f7a3f";

/** The ring: n segments with a 6° gap between them, the first k filled. */
function ringOf(n: number, k: number, done: boolean): string {
  if (done || n <= 0) return GREEN;
  const gap = 6;
  const seg = (360 - gap * n) / n;
  const stops: string[] = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    const c = i < k ? RUST : RUST_FAINT;
    stops.push(`${c} ${at}deg ${at + seg}deg`, `transparent ${at + seg}deg ${at + seg + gap}deg`);
    at += seg + gap;
  }
  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}

export default function ProgressPicsPill({ pics }: { pics: NonNullable<ProgressPics> }) {
  const openPhotos = useOpenPhotos();
  const done = pics.status === "completed";
  const n = Math.max(1, pics.total);
  const k = Math.min(n, pics.uploaded);
  const state: "due" | "progress" | "done" = done ? "done" : k > 0 ? "progress" : "due";
  const label = state === "done" ? "Completed" : <Bars parts={state === "progress" ? ["In progress", `${k} of ${n}`] : ["Due today", `0 of ${n}`]} />;
  const button = state === "done" ? "View" : state === "progress" ? "Continue" : "Start";
  const spoken = state === "done" ? "Shape update, completed. View." : state === "progress" ? `Shape update, in progress, ${k} of ${n}. Continue.` : `Shape update, due today, 0 of ${n}. Start.`;
  return (
    <button type="button" className={`ppp ${state}`} onClick={() => openPhotos?.()} aria-label={spoken}>
      <span className="ppp-ring" aria-hidden="true" style={{ background: ringOf(n, k, done) } as React.CSSProperties}>
        <span className="ppp-disc" />
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d={done ? TICK : CAMERA} />
        </svg>
      </span>
      <span className="ppp-text">
        <span className="ppp-label-row">
          <span className="ppp-label">{label}</span>
          {state === "due" && <i className="ppp-dot" aria-hidden="true" />}
        </span>
        <span className="ppp-title">Shape update</span>
      </span>
      <span className="ppp-btn" aria-hidden="true">
        {button}
      </span>
    </button>
  );
}
