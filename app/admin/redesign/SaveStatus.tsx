"use client";

import { Sep } from "./Sep";
import { useSaidSaved } from "./useSaveQueue";

/** A tab's one save status, Training's (3 Nov, Alex: one status on every tab that saves itself): Saving… grey,
 *  ✓ All changes saved green, a failure `Not saved | Retry` in red, Retry re-running it. Nothing until the first
 *  save starts on this screen (22 Oct, Alex). Styles: `.trn-allsaved` in training/trn.css. */
export function SaveStatus({ busy, failed, onRetry, className = "" }: { busy: boolean; failed: boolean; onRetry: () => void; className?: string }) {
  const said = useSaidSaved(busy);
  const extra = className ? ` ${className}` : "";
  if (failed)
    return (
      <span className={`trn-allsaved failed${extra}`} role="alert">
        Not saved<Sep />
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </span>
    );
  if (!said) return null;
  return (
    <span className={`trn-allsaved${busy ? " saving" : ""}${extra}`} role="status">
      {busy ? "Saving…" : "All changes saved"}
    </span>
  );
}
