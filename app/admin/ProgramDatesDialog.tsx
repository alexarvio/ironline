"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { deployProgramAction, renameProgramAction, scheduleProgramDeployAction } from "../lib/actions";

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
  const go = (mode: "save" | "schedule" | "deploy") =>
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
      if (mode === "deploy") {
        const fd = new FormData();
        fd.set("programId", String(programId));
        await deployProgramAction(fd);
      }
      onClose();
    });

  return createPortal(
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal pb-modal-sm pl-dialog" role="dialog" aria-modal="true" aria-label="This programme">
        <div className="pl-dialog-head">
          <h2 className="pb-confirm-title">This programme</h2>
        </div>

        <div className="cd-form">
          <label className="plan-schedule-field">
            <span>Name</span>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bulk, Cut, Hypertrophy…"
              maxLength={40}
            />
          </label>

          <p className="pl-hint">
            Its length is however many weeks are on the rail. What you pick here is when it reaches the client.
          </p>

          <div className="cd-form-row">
            <label className="plan-schedule-field">
              <span>Goes live on</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="plan-schedule-field">
              <span>At</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>

          <div className="pb-modal-foot">
            <button type="button" className="ad-btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="ad-btn-secondary" onClick={() => go("save")} disabled={busy}>
              Save the name
            </button>
            <button
              type="button"
              className="ad-btn-secondary"
              onClick={() => go("deploy")}
              disabled={busy || !named}
              title={named ? undefined : "Name it first"}
            >
              Deploy now
            </button>
            <button
              type="button"
              className="ad-btn-primary"
              onClick={() => go("schedule")}
              disabled={busy || !named || !date || !time}
              title={named ? undefined : "Name it first"}
            >
              Schedule it
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
