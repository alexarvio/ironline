"use client";

import { useState, useTransition } from "react";
import { saveCoachNoteAction } from "../lib/actions";

// The coach's own standing note about a client, on the Home rail. Theirs
// alone — the client never sees it — and edited in place, like the rest of
// the rail: Edit turns the note into a box, Save writes it.
export default function CoachNoteCard({ clientId, text, savedLabel }: { clientId: number; text: string; savedLabel: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, start] = useTransition();

  const save = () => {
    setEditing(false);
    if (draft.trim() === text.trim()) return;
    start(() => saveCoachNoteAction(clientId, draft));
  };

  return (
    <section className="ch-card ch-rail-card">
      <div className="ch-rail-head">
        <span className="ch-label">Coach note</span>
        {!editing && (
          <button type="button" className="ch-edit" onClick={() => setEditing(true)}>
            {text ? "Edit" : "Add"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="ch-note-edit">
          <textarea
            className="ch-note-input"
            value={draft}
            rows={5}
            autoFocus
            maxLength={2000}
            placeholder="What you want to remember about this client."
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(text);
                setEditing(false);
              }
            }}
          />
          <div className="ch-note-foot">
            <button
              type="button"
              className="ch-btn"
              onClick={() => {
                setDraft(text);
                setEditing(false);
              }}
            >
              Cancel
            </button>
            <button type="button" className="ch-btn primary" onClick={save}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="ch-note-body">
          {text ? <p className="ch-note-text">{text}</p> : <p className="ch-note-empty">Nothing yet.</p>}
          {savedLabel && <span className="ch-label ch-note-when">Updated {savedLabel}{saving ? " · saving…" : ""}</span>}
        </div>
      )}
    </section>
  );
}
