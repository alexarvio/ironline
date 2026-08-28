"use client";

import { useState } from "react";
import { savePhotoPeriodNoteAction } from "../lib/actions";
import { ChevronDownIcon } from "../components/icons";

type Photo = { slotId: number; label: string; src: string | null };
type Note = { shape: string; strengths: string; improvements: string; next_steps: string };

// One period's worth of photos, collapsed by default into a single full-width
// row — a title ("Week 3"), a quick summary ("4/4 photos uploaded"), and a
// chevron. Opening it reveals every photo for that period plus a form for
// the coach's written feedback, which the client also sees (read-only) on
// their own progress history.
export default function PhotoPeriodRow({
  clientId,
  period,
  title,
  subtitle,
  photos,
  note,
}: {
  clientId: number;
  period: string;
  title: string;
  subtitle: string;
  photos: Photo[];
  note: Note;
}) {
  const [open, setOpen] = useState(false);

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

          <form action={savePhotoPeriodNoteAction} className="photo-note-form">
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="period" value={period} />
            <p className="empty-note" style={{ marginBottom: 10 }}>
              Your notes here also show up for the client on this check-in in their app.
            </p>
            <label className="photo-note-field">
              Shape
              <textarea name="shape" defaultValue={note.shape} rows={2} placeholder="How they're looking overall" />
            </label>
            <label className="photo-note-field">
              What&rsquo;s strong
              <textarea name="strengths" defaultValue={note.strengths} rows={2} placeholder="What's going well" />
            </label>
            <label className="photo-note-field">
              What we can improve
              <textarea
                name="improvements"
                defaultValue={note.improvements}
                rows={2}
                placeholder="Areas to keep working on"
              />
            </label>
            <label className="photo-note-field">
              Next steps
              <textarea name="next_steps" defaultValue={note.next_steps} rows={2} placeholder="What to focus on next" />
            </label>
            <button className="btn" type="submit">
              Save notes
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
