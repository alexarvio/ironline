"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon, ChevronLeftIcon } from "../components/icons";

type Photo = { slotId: number; label: string; src: string | null };
export type HistoryNote = { shape: string; strengths: string; improvements: string; next_steps: string };

export const NOTE_LABELS: { key: keyof HistoryNote; label: string }[] = [
  { key: "shape", label: "Shape" },
  { key: "strengths", label: "What's strong" },
  { key: "improvements", label: "What to improve" },
  { key: "next_steps", label: "Next steps" },
];

// Read-only view of one earlier photo sheet on the Progress pictures screen.
// Collapsed it is the title and counts; open, the photos (tap one for full
// screen) and whatever the coach wrote about them, empty fields skipped.
// The screen owns which row is open, so only one is at a time.
export default function PhotoPeriodHistoryRow({
  title,
  photos,
  note,
  open,
  onToggle,
  metaExtra,
  footer,
}: {
  title: string;
  photos: Photo[];
  note: HistoryNote;
  open: boolean;
  onToggle: () => void;
  /** A word after the counts, e.g. "sent" for the sheet open now. */
  metaExtra?: string;
  /** Shown at the foot of the open row, e.g. the open sheet's Edit button. */
  footer?: ReactNode;
}) {
  const notes = NOTE_LABELS.filter(({ key }) => note[key].trim());
  const inCount = photos.filter((p) => p.src).length;
  // The photo open full screen, as an index into the sent ones.
  const [viewing, setViewing] = useState<number | null>(null);
  const sent = photos.filter((p): p is Photo & { src: string } => !!p.src);

  return (
    <article className="pp-app-past">
      <button type="button" className="pp-app-past-head" aria-expanded={open} onClick={onToggle}>
        <span className="pp-app-past-text">
          <span className="pp-app-past-title">{title}</span>
          <span className="pp-app-past-meta">
            {inCount} of {photos.length}
            {metaExtra && ` · ${metaExtra}`}
            {notes.length > 0 && " · coach replied"}
          </span>
        </span>
        <span className={`pp-app-past-chevron${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div className="pp-app-past-body">
          <div className="pp-app-past-grid">
            {photos.map((p) => (
              <figure key={p.slotId} className="pp-app-past-cell">
                {p.src ? (
                  // Opens in the app, not as a link: from the home screen a
                  // link to the image has no browser bar and no way back.
                  <button
                    type="button"
                    className="pp-app-past-photo"
                    aria-label={`${p.label}, full size`}
                    onClick={() => setViewing(sent.findIndex((s) => s.slotId === p.slotId))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.src} alt={p.label} />
                  </button>
                ) : (
                  <span className="pp-app-past-photo empty">Not sent</span>
                )}
                <figcaption className="pp-app-past-name">{p.label}</figcaption>
              </figure>
            ))}
          </div>

          {notes.length > 0 && (
            <div className="pp-app-notes">
              <span className="pp-app-notes-label">What your coach said</span>
              {notes.map(({ key, label }) => (
                <div key={key}>
                  <div className="pp-app-note-label">{label}</div>
                  <div className="pp-app-note-text">{note[key]}</div>
                </div>
              ))}
            </div>
          )}
          {footer}
        </div>
      )}

      {viewing != null && sent[viewing] && (
        <PhotoViewer photos={sent} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} title={title} />
      )}
    </article>
  );
}

// Full screen over the app: one photo at a time, arrows (or a swipe) to the
// sheet's other photos, and a close button that is always there.
function PhotoViewer({
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

  return (
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
        <img src={photo.src} alt={photo.label} className="pp-app-viewer-img" />
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
    </div>
  );
}
