"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addPackageAction, removePackageAction, updatePackageAction } from "../lib/actions";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";

export type PackageRow = { id: number; name: string; price: string; includes: string };

// The coach's packages as editable rows: name, price and what is included,
// each field saving when you leave it. "+ Add package" asks for a name in a
// dialog; the rest is filled in on the row.
export default function PackagesEditor({ packages }: { packages: PackageRow[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="pk">
      {packages.length === 0 ? (
        <p className="br-note">No packages yet. Add the ones you offer, with a price and what each includes.</p>
      ) : (
        <div className="pk-list">
          {packages.map((k) => (
            <div key={k.id} className="pk-row">
              <div className="pk-top">
                <Cell id={k.id} field="name" value={k.name} className="pk-name" placeholder="Package name" />
                <Cell id={k.id} field="price" value={k.price} className="pk-price" placeholder="e.g. €150 / month" />
                <span className="pk-delete">
                  <ConfirmDeleteButton
                    action={removePackageAction}
                    hiddenFields={{ id: k.id }}
                    label={`Delete the ${k.name} package`}
                    description="Clients on it keep everything else; they just no longer show a package."
                  />
                </span>
              </div>
              <Cell id={k.id} field="includes" value={k.includes} className="pk-includes" placeholder="What's included, one item per line" multiline />
            </div>
          ))}
        </div>
      )}
      <button type="button" className="pk-add" onClick={() => setAdding(true)}>
        + Add package
      </button>
      {adding && <AddDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function Cell({
  id,
  field,
  value,
  className,
  placeholder,
  multiline,
}: {
  id: number;
  field: "name" | "price" | "includes";
  value: string;
  className: string;
  placeholder: string;
  multiline?: boolean;
}) {
  const submitIfChanged = (el: HTMLInputElement | HTMLTextAreaElement) => {
    if (el.value !== value) el.form?.requestSubmit();
  };
  return (
    <form action={updatePackageAction} className={`pk-cell ${className}`}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      {multiline ? (
        <textarea name="value" defaultValue={value} placeholder={placeholder} rows={3} onBlur={(e) => submitIfChanged(e.currentTarget)} />
      ) : (
        <input name="value" defaultValue={value} placeholder={placeholder} onBlur={(e) => submitIfChanged(e.currentTarget)} />
      )}
    </form>
  );
}

function AddDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label="Add a package">
        <h2 className="pb-confirm-title">Add a package</h2>
        <p className="pb-confirm-body">Give it a name now; price and what it includes go on the row afterwards.</p>
        <form action={addPackageAction} className="cd-form" onSubmit={() => setTimeout(onClose, 0)}>
          <label className="plan-schedule-field">
            <span>Name</span>
            <input ref={ref} name="name" type="text" placeholder="e.g. Training + nutrition" required maxLength={60} />
          </label>
          <div className="pb-modal-foot">
            <button type="button" className="ad-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ad-btn-primary">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
