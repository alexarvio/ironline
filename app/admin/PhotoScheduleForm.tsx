"use client";

import { useEffect, useState, useTransition } from "react";
import { savePhotoScheduleAction } from "../lib/actions";
import PhotoCadenceSelect, { type PhotoCadence } from "./PhotoCadenceSelect";

type Schedule = { startDate: string; cadence: PhotoCadence; instructions: string };

// When sheets arrive, and how to take them. Nothing here reaches the client
// until the coach presses Save: the line beside the button says whether what
// is on screen is live or still a draft, and Discard puts back what is live.
export default function PhotoScheduleForm({
  clientId,
  firstName,
  startDate,
  cadence,
  instructions,
}: {
  clientId: number;
  firstName: string;
  startDate: string;
  cadence: PhotoCadence;
  instructions: string;
}) {
  const live: Schedule = { startDate, cadence, instructions };
  const [draft, setDraft] = useState<Schedule>(live);
  const [justSaved, setJustSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  const dirty =
    draft.startDate !== live.startDate || draft.cadence !== live.cadence || draft.instructions.trim() !== live.instructions.trim();

  // Leaving the page with an unsaved schedule asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (patch: Partial<Schedule>) => {
    setJustSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const save = () =>
    startSaving(async () => {
      await savePhotoScheduleAction(clientId, { ...draft, instructions: draft.instructions.trim() });
      setJustSaved(true);
    });

  return (
    <div>
      <span className="pp-label pp-label-block">When sheets arrive</span>
      <div className="pp-schedule">
        <span className="pp-schedule-word">First one on</span>
        <input
          type="date"
          className="pp-input pp-date"
          value={draft.startDate}
          aria-label="Day the first sheet opens"
          onChange={(e) => update({ startDate: e.target.value })}
        />
        <span className="pp-schedule-word">then every</span>
        <PhotoCadenceSelect value={draft.cadence} onChange={(c) => update({ cadence: c })} />
      </div>

      <label className="pp-instructions">
        <span className="pp-label-row">
          <span className="pp-label">How to take them</span>
          <span className="pp-label-right">Shows on {firstName}&rsquo;s sheet</span>
        </span>
        <textarea
          className="pp-instructions-box"
          rows={3}
          maxLength={600}
          value={draft.instructions}
          onChange={(e) => update({ instructions: e.target.value })}
          placeholder="e.g. Morning, before breakfast. Same spot and light each time, phone at chest height, relaxed stance."
        />
      </label>

      <div className={`pp-save-row${dirty ? " dirty" : ""}`}>
        <span className="pp-save-status" role="status" aria-live="polite">
          {saving
            ? "Saving…"
            : dirty
            ? `Not saved yet · ${firstName} still sees the current schedule`
            : justSaved
            ? `Saved · live on ${firstName}’s app`
            : `Live on ${firstName}’s app`}
        </span>
        {dirty && (
          <button type="button" className="pp-btn ghost sm" onClick={() => setDraft(live)} disabled={saving}>
            Discard
          </button>
        )}
        <button type="button" className="pp-btn navy sm" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
