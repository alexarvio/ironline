"use client";

import { useState, useTransition } from "react";
import { saveProgramNoteAction } from "../lib/actions";

// The client's note to the coach about the programme as a whole: how it is
// feeling, what is not working, what they want more of. One per programme,
// edited in place, shown to the coach at the top of the Training tab.
export default function ProgramNote({ programId, text }: { programId: number; text: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, start] = useTransition();
  const cancel = () => {
    setDraft(text);
    setEditing(false);
  };
  const save = () => {
    const next = draft.trim();
    setEditing(false);
    if (next === text.trim()) return;
    const fd = new FormData();
    fd.set("programId", String(programId));
    fd.set("text", next);
    start(() => saveProgramNoteAction(fd));
  };
  if (editing) {
    return (
      <div className="ts-mynote ts-prognote editing">
        <span className="ts-mynote-label">Note for your coach</span>
        <textarea
          className="ts-mynote-input"
          value={draft}
          autoFocus
          rows={3}
          placeholder="How the programme is feeling, what is too much, what you would like more of…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
        />
        <div className="ts-mynote-foot">
          <span className="ts-mynote-hint">About the whole programme. Your coach reads it on their side.</span>
          <span className="ts-mynote-btns">
            <button type="button" className="ts-mynote-cancel" onClick={cancel}>
              Cancel
            </button>
            <button type="button" className="ts-mynote-save" onClick={save}>
              Save
            </button>
          </span>
        </div>
      </div>
    );
  }
  return (
    <button type="button" className={`ts-mynote ts-prognote${text ? "" : " empty"}`} onClick={() => setEditing(true)}>
      {text ? (
        <>
          <span className="ts-mynote-label">Note for your coach{saving ? " · saving…" : ""}</span>
          <span className="ts-mynote-text">{text}</span>
        </>
      ) : (
        <span className="ts-mynote-add">+ Add a note for your coach about this programme</span>
      )}
    </button>
  );
}
