"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TrashIcon } from "./icons";

// A trash icon that asks before it deletes.
//
// The confirm is a dialog in a portal, not an expansion in place. It used to
// swap the icon for a "Delete? Yes / Cancel" strip inline, which in a table
// cell sized for one 22px icon blew the column open and pushed everything
// beside it off the grid — worst in the exercise table, where the row is the
// thing you're trying to read while deciding.
//
// `action` is a Server Action passed down from the page; `hiddenFields` become
// the hidden inputs it submits (e.g. { id: row.id }).
export default function ConfirmDeleteButton({
  action,
  hiddenFields,
  label,
  description,
}: {
  action: (formData: FormData) => void;
  hiddenFields: Record<string, string | number>;
  /** What's being deleted — used as the dialog's question and the icon's
      accessible name, so "Delete goal: sleep 7h" reads correctly in both. */
  label: string;
  /** Optional extra line, for anything that takes more with it than itself. */
  description?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        type="button"
        className="row-icon-btn row-icon-danger"
        aria-label={label}
        onClick={() => setConfirming(true)}
      >
        <TrashIcon />
      </button>

      {confirming && mounted &&
        createPortal(
          <ConfirmDialog
            action={action}
            hiddenFields={hiddenFields}
            label={label}
            description={description}
            onClose={() => setConfirming(false)}
          />,
          document.body
        )}
    </>
  );
}

function ConfirmDialog({
  action,
  hiddenFields,
  label,
  description,
  onClose,
}: {
  action: (formData: FormData) => void;
  hiddenFields: Record<string, string | number>;
  label: string;
  description?: string;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus starts on Cancel rather than on the destructive
  // button — a stray Enter should not delete anything.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    cancelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="pb-modal-scrim"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label={label}>
        <h2 className="pb-confirm-title">{label}?</h2>
        {description && <p className="pb-confirm-body">{description}</p>}
        <p className="pb-confirm-body">This can&rsquo;t be undone.</p>

        <div className="pb-modal-foot">
          <button type="button" className="ad-btn-secondary" onClick={onClose} ref={cancelRef}>
            Cancel
          </button>
          <form action={action}>
            {Object.entries(hiddenFields).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <button type="submit" className="pb-confirm-delete">
              Delete
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
