"use client";

import { useState, useTransition } from "react";
import { saveMyDetailsAction } from "../lib/actions";

// Your details on Settings: email, phone, address, shown as rows and edited
// in place. Edit turns the rows into fields; Save posts them all at once.
// The photo lives in the banner above. Invoicing details are a later card.
type Fields = { email: string; phone: string; address: string };

const ROWS: { key: keyof Fields; label: string; type: string; placeholder: string; autoComplete: string }[] = [
  { key: "email", label: "Email", type: "email", placeholder: "name@example.com", autoComplete: "email" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+31 6 12345678", autoComplete: "tel" },
  { key: "address", label: "Address", type: "text", placeholder: "Street, city", autoComplete: "street-address" },
];

export default function MyDetailsCard({ clientId, email, phone, address }: { clientId: number; email: string | null; phone: string | null; address: string | null }) {
  const saved: Fields = { email: email ?? "", phone: phone ?? "", address: address ?? "" };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Fields>(saved);
  const [pending, startSaving] = useTransition();
  const changed = ROWS.some((r) => draft[r.key].trim() !== saved[r.key]);

  const save = () => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    ROWS.forEach((r) => fd.set(r.key, draft[r.key].trim()));
    startSaving(async () => {
      await saveMyDetailsAction(fd);
      setEditing(false);
    });
  };
  const cancel = () => {
    setDraft(saved);
    setEditing(false);
  };

  return (
    <section className="home-dark-section st-details">
      <div className="home-dark-section-head">
        <span className="home-dark-section-title">Your details</span>
        {!editing && (
          <button type="button" className="st-details-edit" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="st-details-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (changed && !pending) save();
          }}
        >
          {ROWS.map((r) => (
            <label key={r.key} className="st-details-field">
              <span className="st-details-label">{r.label}</span>
              <input
                id={`st-details-${r.key}`}
                className="st-details-input"
                type={r.type}
                inputMode={r.type === "tel" ? "tel" : r.type === "email" ? "email" : "text"}
                autoComplete={r.autoComplete}
                value={draft[r.key]}
                placeholder={r.placeholder}
                onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))}
                disabled={pending}
              />
            </label>
          ))}
          <div className="st-details-actions">
            <button type="button" className="st-details-cancel" onClick={cancel} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="st-details-save" disabled={!changed || pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <div className="home-dark-rows">
          {ROWS.map((r) => (
            <div key={r.key} className="st-details-row">
              <span className="st-details-label">{r.label}</span>
              <span className={`st-details-value${saved[r.key] ? "" : " empty"}`}>{saved[r.key] || "Add"}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
