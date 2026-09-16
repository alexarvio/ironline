"use client";

import { useRef, useState, useTransition } from "react";
import { saveProgramNoteAction } from "../lib/actions";
import { ArrowRightIcon, ChatIcon } from "../components/icons";

// The client's note to the coach about the programme as a whole: how it is
// feeling, what is not working, what they want more of. One per programme.
// It is the footer row of the Days trained card: one line to type into and a
// send button. What was sent shows as a bubble under the row; tapping it puts
// the text back in the line to change it. Escape puts the line back.
export default function ProgramNote({ programId, text, coachName }: { programId: number; text: string; coachName: string }) {
  const [draft, setDraft] = useState("");
  // True while the saved note is back in the line being changed.
  const [changingSaved, setChangingSaved] = useState(false);
  const [saving, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const next = draft.trim();
  const canSend = next !== "" && next !== text.trim() && !saving;

  const cancel = () => {
    setDraft("");
    setChangingSaved(false);
    inputRef.current?.blur();
  };
  const send = () => {
    if (!canSend) return;
    const fd = new FormData();
    fd.set("programId", String(programId));
    fd.set("text", next);
    start(async () => {
      await saveProgramNoteAction(fd);
      setDraft("");
      setChangingSaved(false);
    });
  };

  return (
    <div className="tr-note">
      <form
        className="tr-note-row"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <span className="tr-note-icon" aria-hidden="true">
          <ChatIcon />
        </span>
        <input
          ref={inputRef}
          className="tr-note-input"
          type="text"
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          placeholder={`Tell ${coachName} how the programme feels`}
          aria-label={`Note for ${coachName} about this programme`}
        />
        <button type="submit" className={`tr-send${canSend ? " ready" : ""}`} disabled={!canSend} aria-label="Send">
          <ArrowRightIcon />
        </button>
      </form>
      {text.trim() && !changingSaved && (
        <div className="tr-note-bubble-wrap">
          <button
            type="button"
            className="tr-note-bubble"
            onClick={() => {
              setDraft(text);
              setChangingSaved(true);
              inputRef.current?.focus();
            }}
            aria-label="Change your note"
          >
            {saving ? "Saving…" : text}
          </button>
        </div>
      )}
    </div>
  );
}
