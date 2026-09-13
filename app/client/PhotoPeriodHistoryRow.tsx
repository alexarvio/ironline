"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon } from "../components/icons";

type Photo = { slotId: number; label: string; src: string | null };
export type HistoryNote = { shape: string; strengths: string; improvements: string; next_steps: string };

export const NOTE_LABELS: { key: keyof HistoryNote; label: string }[] = [
  { key: "shape", label: "Shape" },
  { key: "strengths", label: "What's strong" },
  { key: "improvements", label: "What to improve" },
  { key: "next_steps", label: "Next steps" },
];

// Read-only view of one earlier photo sheet on the Progress pictures screen.
// Collapsed it is a strip of thumbnails, the title and counts; open, the
// photos and whatever the coach wrote about them, empty fields skipped.
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

  return (
    <article className="pp-app-past">
      <button type="button" className="pp-app-past-head" aria-expanded={open} onClick={onToggle}>
        <span className="pp-app-past-thumbs" aria-hidden="true">
          {photos.slice(0, 4).map((p) =>
            p.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.slotId} src={p.src} alt="" className="pp-app-past-thumb" />
            ) : (
              <span key={p.slotId} className="pp-app-past-thumb empty" />
            )
          )}
        </span>
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
                  <a href={p.src} target="_blank" rel="noopener noreferrer" className="pp-app-past-photo" aria-label={`${p.label}, full size`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.src} alt={p.label} />
                  </a>
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
    </article>
  );
}
