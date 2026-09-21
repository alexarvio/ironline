"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { renameProgramAction, scheduleProgramDeployAction } from "../lib/actions";
import { phaseChrome, TRACK_PALETTE } from "./phaseChrome";

// A draft programme's name and when it goes out, in one dialog.
//
// A programme has no dates of its own until it is deployed or scheduled —
// they come from the moment it goes live and from how many weeks are on the
// rail — so "Edit dates" for a draft is this: call it something, and say
// when the client gets it. Naming is here rather than inline in the header
// because the header's name is the phase switcher now, and a button cannot
// also be a text field. Once a programme has been sent it has a phase on the
// Plan tab, and that phase's dialog is what edits it from then on.
export default function ProgramDatesDialog({
  programId,
  name: savedName,
  onClose,
}: {
  programId: number;
  name: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(savedName);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [busy, run] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    nameRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const named = name.trim().length > 0;
  const go = (mode: "save" | "schedule") =>
    run(async () => {
      if (name.trim() !== savedName.trim()) {
        const fd = new FormData();
        fd.set("programId", String(programId));
        fd.set("name", name);
        await renameProgramAction(fd);
      }
      if (mode === "schedule") {
        const fd = new FormData();
        fd.set("programId", String(programId));
        fd.set("date", date);
        fd.set("time", time);
        await scheduleProgramDeployAction(fd);
      }
      onClose();
    });

  // The phase dialog's chrome: a draft programme, so the draft chip.
  const chrome = phaseChrome("training", "draft");
  const palette = TRACK_PALETTE.training;
  return createPortal(
    <div className="pl-dlg-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pl-dlg" role="dialog" aria-modal="true" aria-label="This programme">
        <header className="pl-dlg-head">
          <h2>This programme</h2>
          <span className="pl-track-tag" style={{ background: palette.tint, color: palette.ink }}>
            Training
          </span>
          <span className="pl-dlg-state" style={{ background: chrome.chipBg, color: chrome.chipInk }}>
            Draft
          </span>
        </header>

        <div className="pl-dlg-body">
          <label className="pl-dlg-field">
            <span className="pl-dlg-label">Name</span>
            <input
              ref={nameRef}
              className="pl-dlg-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bulk, Cut, Hypertrophy…"
              maxLength={40}
            />
          </label>

          <div className="pl-dlg-pair">
            <label className="pl-dlg-field">
              <span className="pl-dlg-label">Goes live on</span>
              <input className="pl-dlg-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="pl-dlg-field">
              <span className="pl-dlg-label">At</span>
              <input className="pl-dlg-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>

          <p className="pl-move-note">Its length is however many weeks are on the rail. What you pick here is when it reaches the client.</p>
        </div>

        <footer className="pl-dlg-foot">
          <button type="button" className="pl-text-btn" onClick={() => go("save")} disabled={busy}>
            Save the name
          </button>
          <div className="pl-dlg-actions">
            <button type="button" className="pl-dlg-cancel" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="pl-dlg-save"
              onClick={() => go("schedule")}
              disabled={busy || !named || !date || !time}
              title={named ? undefined : "Name it first"}
            >
              Schedule it
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
