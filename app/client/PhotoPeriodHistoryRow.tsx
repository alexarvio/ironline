"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import PhotoDeck from "./PhotoDeck";
import { Bars } from "./Bars";
import { ChevronDownIcon, ChevronLeftIcon } from "../components/icons";

type Photo = { slotId: number; label: string; src: string | null };

// Read-only view of one earlier photo sheet on the Progress pictures screen.
// Collapsed it is the title and counts; open, a row per photo (tap one for
// full screen). The coach's comments on a sheet come in the chat, linked to it (21 Oct).
// The screen owns which row is open, so only one is at a time.
export default function PhotoPeriodHistoryRow({
  title,
  photos,
  open,
  onToggle,
  metaExtra,
  footer,
  done = false,
}: {
  title: string;
  photos: Photo[];
  open: boolean;
  onToggle: () => void;
  /** A word after the counts, e.g. "sent" for the sheet open now. */
  metaExtra?: string;
  /** Shown at the foot of the open row, e.g. the open sheet's Edit button. */
  footer?: ReactNode;
  /** Every angle of the sheet open now is in (17 Oct, Alex): a green ring with a tick, and the count in green. */
  done?: boolean;
}) {
  const inCount = photos.filter((p) => p.src).length;
  // The photo open full screen, as an index into the sent ones.
  const [viewing, setViewing] = useState<number | null>(null);
  const sent = photos.filter((p): p is Photo & { src: string } => !!p.src);
  // Opening a sheet waited on its photos (17 Oct, Alex): they are fetched quietly once the screen
  // has settled, one after another, so a tap on the row finds them in the cache.
  const srcKey = sent.map((p) => p.src).join("|");
  useEffect(() => {
    if (!srcKey) return;
    let cancelled = false;
    const queue = srcKey.split("|");
    const next = () => {
      if (cancelled) return;
      const src = queue.shift();
      if (!src) return;
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = () => next();
      img.src = src;
    };
    const t = setTimeout(next, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [srcKey]);
  // The body mounts the first time the row opens and then stays, so closing can ease shut (17 Oct).
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  return (
    <article className="pp-app-past">
      <button type="button" className={`pp-app-past-head${done ? " done" : ""}`} aria-expanded={open} onClick={onToggle}>
        {done && (
          <span className="pp-app-past-tick" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
        )}
        <span className="pp-app-past-text">
          <span className="pp-app-past-title">{title}</span>
          <span className="pp-app-past-meta">
            <Bars parts={[done ? <b key="d" className="pp-app-past-done">All {photos.length} sent</b> : `${inCount} of ${photos.length}`, !done && metaExtra]} />
          </span>
        </span>
        <span className={`pp-app-past-chevron${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>

      <div className={`pp-app-past-fold${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="pp-app-past-clip">
      {mounted && (
        <div className="pp-app-past-body">
          {/* The angles as a swipe of big cards (17 Oct, Alex), the empty ones too; a photo opens full screen in the app (a link to the image from the home screen has no way back). */}
          <PhotoDeck
            onTap={(i) => setViewing(sent.findIndex((s) => s.slotId === photos[i].slotId))}
            items={photos.map((p) => ({ key: p.slotId, label: p.label, src: p.src ?? null, state: p.src ? null : "Not sent", tone: p.src ? null : ("muted" as const), action: p.src ? "View" : null }))}
          />

          {footer}
        </div>
      )}
        </div>
      </div>

      {viewing != null && sent[viewing] && (
        <PhotoViewer photos={sent} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} title={title} />
      )}
    </article>
  );
}

// Full screen over the app: one photo at a time, arrows (or a swipe) to the
// sheet's other photos, and a close button that is always there.
export function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
  title,
}: {
  photos: { slotId: number; label: string; src: string }[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  title: string;
}) {
  const startX = useRef<number | null>(null);
  const photo = photos[index];
  const go = (step: number) => {
    const next = index + step;
    if (next >= 0 && next < photos.length) onIndex(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // On the page itself, not inside the screen (17 Oct): inside, the pushed screen's header drew over the bar, a second back arrow and its title on "2 of 2".
  return createPortal(
    <div
      className="pp-app-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${title}, ${photo.label}`}
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (startX.current == null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="pp-app-viewer-bar">
        <button type="button" className="pp-app-viewer-close" onClick={onClose} aria-label="Close">
          <ChevronLeftIcon />
          <span>Back</span>
        </button>
        <span className="pp-app-viewer-title">
          {photo.label}
          {photos.length > 1 && (
            <span className="pp-app-viewer-count">
              {index + 1} of {photos.length}
            </span>
          )}
        </span>
        <span className="pp-app-viewer-spacer" aria-hidden="true" />
      </div>
      <div className="pp-app-viewer-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.src} alt={photo.label} className="pp-app-viewer-img" decoding="async" />
      </div>
      {photos.length > 1 && (
        <div className="pp-app-viewer-nav">
          <button type="button" className="pp-app-viewer-step" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous photo">
            <ChevronLeftIcon />
          </button>
          <button type="button" className="pp-app-viewer-step next" onClick={() => go(1)} disabled={index === photos.length - 1} aria-label="Next photo">
            <ChevronLeftIcon />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
