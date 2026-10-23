"use client";

import { useState, useTransition } from "react";
import { saveMyDetailsAction } from "../lib/actions";
import { addressLine, type PostalAddress } from "../lib/address";
import { COUNTRIES, countryOf } from "../lib/countries";

// Your details on Settings: email, phone, address, shown as rows and edited
// in place. Edit turns the rows into fields; Save posts them all at once.
// The photo lives in the banner above. The address is in its parts (23 Oct,
// for the coach's invoices): read as one line, typed as the street, the
// postcode and city, and the country (a state where the country has them).
type Address = { address: string; postcode: string; city: string; region: string; country_code: string; country: string };
type Fields = { email: string; phone: string } & Address;

const ROWS: { key: "email" | "phone"; label: string; type: string; placeholder: string; autoComplete: string }[] = [
  { key: "email", label: "Email", type: "email", placeholder: "name@example.com", autoComplete: "email" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+31 6 12345678", autoComplete: "tel" },
];
const KEYS: (keyof Fields)[] = ["email", "phone", "address", "postcode", "city", "region", "country_code", "country"];
/** The country list's own value for a country not on it, typed by name. */
const OTHER = "other";

export default function MyDetailsCard({ clientId, email, phone, address }: { clientId: number; email: string | null; phone: string | null; address: PostalAddress }) {
  const saved: Fields = {
    email: email ?? "",
    phone: phone ?? "",
    address: address.address ?? "",
    postcode: address.postcode ?? "",
    city: address.city ?? "",
    region: address.region ?? "",
    country_code: address.country_code ?? "",
    country: address.country_code ? "" : (address.country ?? ""),
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Fields>(saved);
  const [other, setOther] = useState(!saved.country_code && !!saved.country);
  const [pending, startSaving] = useTransition();
  const changed = KEYS.some((k) => draft[k].trim() !== saved[k]);
  const set = (k: keyof Fields) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const country = countryOf(draft.country_code);

  const save = () => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    KEYS.forEach((k) => fd.set(k, draft[k].trim()));
    startSaving(async () => {
      await saveMyDetailsAction(fd);
      setEditing(false);
    });
  };
  const cancel = () => {
    setDraft(saved);
    setOther(!saved.country_code && !!saved.country);
    setEditing(false);
  };
  const shownAddress = addressLine(address);

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
                onChange={(e) => set(r.key)(e.target.value)}
                disabled={pending}
              />
            </label>
          ))}
          <label className="st-details-field">
            <span className="st-details-label">Address</span>
            <input className="st-details-input" autoComplete="street-address" value={draft.address} placeholder="Street and number" onChange={(e) => set("address")(e.target.value)} disabled={pending} maxLength={160} />
          </label>
          <div className="st-details-pair">
            <label className="st-details-field">
              <span className="st-details-label">{country.postcode}</span>
              <input className="st-details-input" autoComplete="postal-code" value={draft.postcode} onChange={(e) => set("postcode")(e.target.value)} disabled={pending} maxLength={20} />
            </label>
            <label className="st-details-field">
              <span className="st-details-label">City</span>
              <input className="st-details-input" autoComplete="address-level2" value={draft.city} onChange={(e) => set("city")(e.target.value)} disabled={pending} maxLength={80} />
            </label>
          </div>
          <div className={country.region || other ? "st-details-pair" : undefined}>
            <label className="st-details-field">
              <span className="st-details-label">Country</span>
              <select
                className={`st-details-input${draft.country_code || other ? "" : " empty"}`}
                value={draft.country_code || (other ? OTHER : "")}
                onChange={(e) => {
                  const v = e.target.value;
                  setOther(v === OTHER);
                  setDraft((d) => ({ ...d, country_code: v === OTHER ? "" : v, country: "" }));
                }}
                disabled={pending}
              >
                {!draft.country_code && !other && <option value="">Choose</option>}
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
                <option value={OTHER}>Other</option>
              </select>
            </label>
            {other ? (
              <label className="st-details-field">
                <span className="st-details-label">Country name</span>
                <input className="st-details-input" autoComplete="country-name" value={draft.country} onChange={(e) => set("country")(e.target.value)} disabled={pending} maxLength={60} />
              </label>
            ) : (
              country.region && (
                <label className="st-details-field">
                  <span className="st-details-label">{country.region}</span>
                  <input className="st-details-input" autoComplete="address-level1" value={draft.region} onChange={(e) => set("region")(e.target.value)} disabled={pending} maxLength={60} />
                </label>
              )
            )}
          </div>
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
          <div className="st-details-row">
            <span className="st-details-label">Address</span>
            <span className={`st-details-value${shownAddress ? "" : " empty"}`}>{shownAddress || "Add"}</span>
          </div>
        </div>
      )}
    </section>
  );
}
