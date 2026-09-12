"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// The client's note about the programme, as a card on the week row the
// same height as the week pills. Tapping it opens the note in a dialog,
// so the row keeps its shape. A dot on the card says there is text the
// coach has not opened yet; opening marks that version seen (per browser,
// keyed by when the note was last written), so an edited note lights the
// dot again.
export default function ProgramNotePeek({
  programId,
  note,
}: {
  programId: number;
  note: { text: string; updatedAt: string; from: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const key = `ironline.pnote.${programId}`;
  useEffect(() => {
    try {
      setSeenAt(window.localStorage.getItem(key));
    } catch {
      setSeenAt(null);
    }
  }, [key]);
  const unseen = !!note && seenAt !== note.updatedAt;
  const toggle = () => {
    if (!note) return;
    setOpen((o) => !o);
    try {
      window.localStorage.setItem(key, note.updatedAt);
    } catch {
      // A browser that blocks storage just shows the dot every time.
    }
    setSeenAt(note.updatedAt);
  };
  const when = note
    ? new Date(note.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  return (
    <div className={`pb-note-peek${open ? " open" : ""}${note ? "" : " empty"}`}>
      <button type="button" className="pb-note-peek-head" onClick={toggle} aria-expanded={open} disabled={!note}>
        <span className="pb-note-peek-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {unseen && <span className="pb-note-peek-dot" />}
        </span>
        <span className="pb-note-peek-text">
          <span className="pb-note-peek-label">{note ? `Note from ${note.from}` : "No note from the client"}</span>
          <span className="pb-note-peek-sub">{note ? (unseen ? `New · ${when}` : `About this programme · ${when}`) : "About this programme"}</span>
        </span>
        {note && <span className="pb-note-peek-chev" aria-hidden="true">›</span>}
      </button>
      {open &&
        note &&
        createPortal(
          <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label={`Note from ${note.from}`}>
              <h2 className="pb-confirm-title">Note from {note.from}</h2>
              <p className="pb-confirm-body pb-note-modal-meta">About this programme · written {when}</p>
              <p className="pb-note-modal-text">{note.text}</p>
              <div className="pb-modal-foot">
                <button type="button" className="ad-btn-primary" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
