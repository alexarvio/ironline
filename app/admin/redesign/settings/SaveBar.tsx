"use client";

// The foot of a form that saves on a button (Settings, Profile; 22 Oct, on the admin rules): it comes in once
// something is changed and follows the page as it scrolls. The count (or what stands in the way) as a short fact,
// Cancel in words, Save the ink pill. White with a hairline, never the navy bar. Styles: .rst-bar in settings.css.
export default function SaveBar({ count, busy, onSave, onCancel, problem, blocked = false }: { count: number; busy: boolean; onSave: () => void; onCancel: () => void; /** Shown in red in place of the count. */ problem?: string | null; /** Save waits until this clears. */ blocked?: boolean }) {
  return (
    <div className="rst-bar" role="region" aria-label="Unsaved changes">
      <span className={`rst-bar-text${problem ? " bad" : ""}`}>{problem || `${count || 1} ${count === 1 || !count ? "change" : "changes"} not saved`}</span>
      <button type="button" className="dlh-cancel" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
      <button type="button" className="dlh-go" onClick={onSave} disabled={busy || blocked}>
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
