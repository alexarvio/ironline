"use client";

import { useState } from "react";
import { TrashIcon } from "./icons";

// Drop-in replacement for the old plain-text "remove" link: a trash icon
// that expands into a "Delete? Yes / Cancel" confirm before actually
// submitting, instead of deleting on the very first click. `action` is a
// Server Action passed down from the page; `hiddenFields` become the
// hidden inputs that form submits (e.g. { id: row.id }).
export default function ConfirmDeleteButton({
  action,
  hiddenFields,
  label,
}: {
  action: (formData: FormData) => void;
  hiddenFields: Record<string, string | number>;
  label: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="row-confirm-delete">
        <span>Delete?</span>
        <form action={action}>
          {Object.entries(hiddenFields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button type="submit" className="row-confirm-yes">
            Yes
          </button>
        </form>
        <button type="button" className="row-confirm-no" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button type="button" className="row-icon-btn row-icon-danger" aria-label={label} onClick={() => setConfirming(true)}>
      <TrashIcon />
    </button>
  );
}
