"use client";

import { useEffect, useRef, useState } from "react";
import { useOpenPhotos } from "./CheckInContext";

// Home's progress-pictures card, at the top of Today's tasks: a small sibling
// of the phase cards (a photo, a dark scrim, glass chips and a frosted panel)
// while the sheet is due, and "Completed" for the rest of the day the last
// angle went in. The whole card is the button: it opens the pictures screen
// (the capture flow while due, the sent set once done).
//
// The photo is a stock one, never the client's own pictures: the card is
// seen at a glance, and those are private.
export type ProgressPics = {
  uploaded: number;
  /** Angles on the coach's sheet. */
  total: number;
  status: "due" | "completed";
  coverUrl: string | null;
} | null;

export const PROGRESS_PICS_COVER = "/home/progress-pics.jpg";

export default function ProgressPicsCard({ pics }: { pics: NonNullable<ProgressPics> }) {
  const openPhotos = useOpenPhotos();
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A photo that failed before React was listening: onError never comes.
  useEffect(() => {
    const el = img.current;
    if (!el?.complete || el.naturalWidth > 0) return;
    const t = setTimeout(() => setFailed(true), 0);
    return () => clearTimeout(t);
  }, []);
  const done = pics.status === "completed";
  const cover = pics.coverUrl ?? PROGRESS_PICS_COVER;
  return (
    <button
      type="button"
      className={`hm-pp${done ? " done" : ""}`}
      onClick={() => openPhotos?.()}
      aria-label={done ? "Progress pictures completed. View." : `Progress pictures, ${pics.uploaded} of ${pics.total} uploaded, due today. Start.`}
    >
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element -- a public stock photo
        <img ref={img} className="hm-pp-img" src={cover} alt="" draggable={false} onError={() => setFailed(true)} />
      )}
      <span className="hm-pp-scrim" aria-hidden="true" />
      <span className="hm-pp-top" aria-hidden="true">
        <span className="hm-pp-chip">
          <svg viewBox="0 0 24 24">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          Progress pics
        </span>
        {/* Keyed on the state, so the switch to Completed cross-fades. */}
        <span key={pics.status} className={`hm-pp-status${done ? " done" : ""}`}>
          {!done && <span className="hm-pp-dot" />}
          {done ? "Completed" : `${pics.uploaded} of ${pics.total}`}
        </span>
      </span>
      <span className="hm-pp-panel" aria-hidden="true">
        <span className="hm-pp-title">Progress pictures</span>
        <span key={pics.status} className="hm-pp-btn">
          {done ? "View" : "Start"}
        </span>
      </span>
    </button>
  );
}
