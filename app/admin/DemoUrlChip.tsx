"use client";

import { useState } from "react";
import { setDemoUrlAction } from "../lib/actions";

// The demo video for one prescribed exercise. Collapsed to a chip so it
// costs no width in an already-dense grid: "Add demo" when empty, a filled
// "▶ Demo" once set. Clicking reveals the URL field beneath the name.
//
// This is per prescription rather than per exercise in the library, so the
// same lift can carry a different cue in a different block — the library's
// own video stays the fallback when this is empty.
export default function DemoUrlChip({
  assignmentId,
  exerciseName,
  url,
}: {
  assignmentId: number;
  exerciseName: string;
  url: string | null;
}) {
  const [open, setOpen] = useState(false);
  const has = !!url;

  return (
    <>
      <button
        type="button"
        className={`pb-demo-chip${has ? " set" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={has ? `Video the client sees: ${url}` : `Attach a demo video for ${exerciseName}`}
      >
        {has ? "▶ Demo" : "Add demo"}
      </button>

      {open && (
        <form action={setDemoUrlAction} className="pb-demo-form">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input
            name="demoUrl"
            type="text"
            defaultValue={url ?? ""}
            placeholder="Paste a video link — the client sees it in the app"
            aria-label={`Demo video link for ${exerciseName}`}
            className="pb-demo-input"
            // Saves on blur like every other field in the builder, so there's
            // no separate save step to remember mid-build.
            onBlur={(e) => e.currentTarget.form?.requestSubmit()}
          />
        </form>
      )}
    </>
  );
}
