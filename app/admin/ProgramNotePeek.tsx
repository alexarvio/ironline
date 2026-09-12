"use client";

import { useEffect, useState } from "react";

// The client's note about the programme, folded into a card on the week
// row. A dot on the card says there is text the coach has not opened yet;
// opening it marks that version seen (per browser, keyed by when the note
// was last written), so an edited note lights the dot again.
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
        {note && <span className={`pb-note-peek-chev${open ? " up" : ""}`} aria-hidden="true">⌄</span>}
      </button>
      {open && note && <p className="pb-note-peek-body">{note.text}</p>}
    </div>
  );
}
