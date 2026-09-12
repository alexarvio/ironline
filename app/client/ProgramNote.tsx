"use client";

import { useState, useTransition } from "react";
import { saveProgramNoteAction } from "../lib/actions";

// The client's note to the coach about the programme as a whole: how it is
// feeling, what is not working, what they want more of. One per programme.
// Tapping anywhere on the box opens it fully, with Save and Cancel showing
// from the first tap; Cancel or Escape closes it and puts the saved text
// back.
export default function ProgramNote({ programId, text }: { programId: number; text: string }) {
  const [draft, setDraft] = useState(text);
  const [open, setOpen] = useState(false);
  const [saving, start] = useTransition();
  const dirty = draft.trim() !== text.trim();
  const cancel = () => {
    setDraft(text);
    setOpen(false);
  };
  const save = () => {
    const next = draft.trim();
    setOpen(false);
    if (!dirty) return;
    const fd = new FormData();
    fd.set("programId", String(programId));
    fd.set("text", next);
    start(() => saveProgramNoteAction(fd));
  };
  return (
    <section className={`ts-prognote${open ? " open" : ""}`} onClick={() => { if (!open) setOpen(true); }}>
      <span className="ts-prognote-label">Note for your coach{saving ? " · saving…" : ""}</span>
      <textarea
        className="ts-prognote-input"
        value={draft}
        rows={open ? 4 : 2}
        onFocus={() => setOpen(true)}
        placeholder="How the programme is feeling, what is too much, what you would like more of…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
        }}
        aria-label="Note for your coach about this programme"
      />
      {open && (
        <div className="ts-prognote-foot">
          <span className="ts-prognote-hint">About the whole programme, not one day.</span>
          <span className="ts-mynote-btns">
            <button type="button" className="ts-mynote-cancel" onClick={cancel}>
              Cancel
            </button>
            <button type="button" className="ts-mynote-save" onClick={save} disabled={saving}>
              Save
            </button>
          </span>
        </div>
      )}
    </section>
  );
}
