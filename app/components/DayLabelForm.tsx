"use client";

import { useEffect, useRef, useState } from "react";
import { setLabelAction } from "../lib/actions";
import { usePendingDay } from "./DayPending";

// The session's name, and the one place it is edited. Unnamed, it reads as
// its place in the week ("Session 1"); named, the name takes that place
// rather than sitting in a box beside it. A click turns the title into a
// field; Enter or clicking away saves, Escape puts it back.
export default function DayLabelForm({
  programDayId,
  defaultLabel,
  placeholder,
  fallback,
}: {
  programDayId: number;
  defaultLabel: string;
  placeholder: string;
  /** What the session is called while it has no name of its own. */
  fallback?: string;
}) {
  const pending = usePendingDay();
  const value = pending ? pending.labelValue : defaultLabel;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const save = () => {
    const next = draft.trim();
    if (next !== value.trim()) {
      // A day with a pending-changes bar saves with the rest of its edits;
      // anywhere else the name saves on its own, as it did when this was a
      // plain field. Submitted before the form goes, so the action is sent.
      if (pending) pending.setLabel(next);
      else formRef.current?.requestSubmit();
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className={`day-name-btn${value.trim() ? "" : " unnamed"}${pending && value !== defaultLabel ? " pb-changed" : ""}`}
        title="Rename this session"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(value);
          setEditing(true);
        }}
      >
        {value.trim() || fallback || placeholder}
      </button>
    );
  }
  return (
    <form
      ref={formRef}
      action={setLabelAction}
      className="inline-row"
      onSubmit={() => setEditing(false)}
      onClick={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="programDayId" value={programDayId} />
      <input
        ref={inputRef}
        className="day-label-input"
        name="label"
        value={draft}
        placeholder={placeholder}
        aria-label="Session name"
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    </form>
  );
}
