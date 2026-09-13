"use client";

import { useState, useTransition } from "react";
import { setPhotoInstructionsAction } from "../lib/actions";

// The coach's note on how to take the pictures: light, distance, pose. It
// shows at the foot of the open sheet in the client's app. Saves on blur.
export default function PhotoInstructionsInput({ clientId, firstName, value }: { clientId: number; firstName: string; value: string }) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  const save = () => {
    const next = text.trim();
    if (next === value.trim()) return;
    startSaving(async () => {
      await setPhotoInstructionsAction(clientId, next);
      setSaved(true);
    });
  };

  return (
    <label className="pp-instructions">
      <span className="pp-label-row">
        <span className="pp-label">How to take them</span>
        <span className="pp-label-right">{saving ? "Saving…" : saved ? "Saved" : `Shows on ${firstName}’s sheet`}</span>
      </span>
      <textarea
        className="pp-instructions-box"
        rows={3}
        maxLength={600}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        onBlur={save}
        placeholder="e.g. Morning, before breakfast. Same spot and light each time, phone at chest height, relaxed stance."
      />
    </label>
  );
}
