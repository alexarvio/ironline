"use client";

import { useState } from "react";
import { ChevronDownIcon } from "../components/icons";

type Photo = { slotId: number; label: string; src: string | null };
type Note = { shape: string; strengths: string; improvements: string; next_steps: string };

const NOTE_LABELS: { key: keyof Note; label: string }[] = [
  { key: "shape", label: "Shape" },
  { key: "strengths", label: "What's strong" },
  { key: "improvements", label: "What to improve" },
  { key: "next_steps", label: "Next steps" },
];

// Read-only mirror of the coach's PhotoPeriodRow — the client can look back
// at past check-ins and see the coach's written feedback, but can't edit it.
export default function PhotoPeriodHistoryRow({
  title,
  subtitle,
  photos,
  note,
}: {
  title: string;
  subtitle: string;
  photos: Photo[];
  note: Note;
}) {
  const [open, setOpen] = useState(false);
  const hasNote = NOTE_LABELS.some(({ key }) => note[key].trim());

  return (
    <div className="photo-period-row">
      <button type="button" className="photo-period-header" onClick={() => setOpen((o) => !o)}>
        <span className="photo-period-heading">
          <span className="photo-period-title">{title}</span>
          <span className="photo-period-subtitle">{subtitle}</span>
        </span>
        <span className={`photo-period-chevron${open ? " open" : ""}`}>
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div className="photo-period-body">
          <div className="photo-slot-grid">
            {photos.map((p) => (
              <div key={p.slotId} className="photo-thumb-card">
                {p.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.src} alt={p.label} className="photo-thumb-img" />
                ) : (
                  <div className="photo-thumb-empty">Not uploaded</div>
                )}
                <div className="photo-thumb-label">{p.label}</div>
              </div>
            ))}
          </div>

          {hasNote && (
            <div className="photo-note-readonly">
              {NOTE_LABELS.filter(({ key }) => note[key].trim()).map(({ key, label }) => (
                <div key={key} className="photo-note-readonly-field">
                  <div className="photo-note-readonly-label">{label}</div>
                  <div className="photo-note-readonly-text">{note[key]}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
