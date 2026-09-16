"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveProgramNoteAction } from "../lib/actions";
import { ChatIcon } from "../components/icons";

// The client's note to the coach about the programme as a whole: how it is
// feeling, what is not working, what they want more of. One per programme,
// standing until changed; not a chat. It is the footer of the Days trained
// card in three states:
//   - nothing yet: one row, "Tell Finlay how the programme feels", tap to write;
//   - writing: a box that grows with the text, Cancel and Send under it;
//   - sent: the note in full under a "Your note to Finlay · 12 Sep" line,
//     with Edit. Saving it empty removes it.
export default function ProgramNote({
  programId,
  note,
  coachName,
}: {
  programId: number;
  note: { text: string; dateLabel: string } | null;
  coachName: string;
}) {
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, start] = useTransition();
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const saved = note?.text.trim() ?? "";
  const next = draft.trim();
  const changed = next !== saved;

  // The box grows with the text, from three lines up.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
  }, [draft, writing]);

  const open = () => {
    setDraft(saved);
    setWriting(true);
    setTimeout(() => boxRef.current?.focus(), 0);
  };
  const cancel = () => {
    setWriting(false);
    setDraft("");
  };
  const send = () => {
    if (!changed || saving) return;
    const fd = new FormData();
    fd.set("programId", String(programId));
    fd.set("text", next);
    start(async () => {
      await saveProgramNoteAction(fd);
      setWriting(false);
      setDraft("");
    });
  };

  if (writing) {
    return (
      <form
        className="tr-note tr-note-writing"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <span className="tr-note-label">{saved ? `Your note to ${coachName}` : `A note to ${coachName}`}</span>
        <textarea
          ref={boxRef}
          className="tr-note-box"
          value={draft}
          maxLength={1000}
          rows={3}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          placeholder="How the programme feels, what is not working, what you want more of"
          aria-label={`Note for ${coachName} about this programme`}
        />
        <div className="tr-note-actions">
          <button type="button" className="tr-note-btn" onClick={cancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="tr-note-btn primary" disabled={!changed || saving}>
            {saving ? "Sending…" : saved ? (next ? "Save" : "Remove") : "Send"}
          </button>
        </div>
      </form>
    );
  }

  if (!saved) {
    return (
      <div className="tr-note">
        <button type="button" className="tr-note-prompt" onClick={open}>
          <span className="tr-note-icon" aria-hidden="true">
            <ChatIcon />
          </span>
          <span className="tr-note-prompt-text">Tell {coachName} how the programme feels</span>
          <span className="tr-note-prompt-go">Write</span>
        </button>
      </div>
    );
  }

  return (
    <div className="tr-note tr-note-saved">
      <div className="tr-note-head">
        <span className="tr-note-label">
          Your note to {coachName}
          {note?.dateLabel ? ` · ${note.dateLabel}` : ""}
        </span>
        <button type="button" className="tr-note-edit" onClick={open}>
          Edit
        </button>
      </div>
      <p className="tr-note-text">{saved}</p>
    </div>
  );
}
