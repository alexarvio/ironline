"use client";

import { useRef } from "react";
import { sendChatMessageAction } from "../lib/actions";

// The design calls this "shows on their training day". There's no per-day
// coach note in this data model — the one channel that actually reaches the
// client is the chat thread, which also surfaces on their home screen under
// "Coach notes". So this sends a real message rather than writing somewhere
// nobody reads, and says so.
export default function CoachNoteForm({ clientId }: { clientId: number }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await sendChatMessageAction(formData);
        formRef.current?.reset();
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sender" value="coach" />
      <textarea
        name="text"
        className="pb-note-input"
        placeholder="Shows in their chat and on their home screen…"
        rows={3}
      />
      <button type="submit" className="pb-note-btn">
        Send note
      </button>
    </form>
  );
}
