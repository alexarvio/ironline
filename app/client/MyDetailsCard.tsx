"use client";

import { useState, useTransition } from "react";
import { saveMyDetailsAction } from "../lib/actions";
import type { PostalAddress } from "../lib/address";
import { COUNTRIES, countryOf } from "../lib/countries";
import { DEFAULT_DIAL, DIAL_CODES } from "../lib/phone";
import SettingsFold from "./SettingsFold";

// Your details on Settings: one row until pressed, then the fields themselves
// (10 Nov, Alex: no rows to read and no Edit first); Save posts them all at once.
// The photo lives in the banner above. The address is in its parts (23 Oct,
// for the coach's invoices): read as one line, typed as the street, the
// postcode and city, and the country (a state where the country has them).
// The phone as the coach's Details keeps it (6 Nov, Alex): the dial code
// picked beside the number, shown joined; one record for both.
type Address = { address: string; postcode: string; city: string; region: string; country_code: string; country: string };
type Fields = { email: string; phone: string; phone_code: string } & Address;

const KEYS: (keyof Fields)[] = ["email", "phone", "phone_code", "address", "postcode", "city", "region", "country_code", "country"];
/** The country list's own value for a country not on it, typed by name. */
const OTHER = "other";

export default function MyDetailsCard({ clientId, email, phone, phoneCode, address }: { clientId: number; email: string | null; phone: string | null; phoneCode: string | null; address: PostalAddress }) {
  // A number kept from before the split has no code: it stays as typed, the code left unpicked (as the coach's Details).
  const legacy = !phoneCode && !!phone;
  const saved: Fields = {
    email: email ?? "",
    phone: phone ?? "",
    phone_code: phoneCode || (legacy ? "" : DEFAULT_DIAL),
    address: address.address ?? "",
    postcode: address.postcode ?? "",
    city: address.city ?? "",
    region: address.region ?? "",
    country_code: address.country_code ?? "",
    country: address.country_code ? "" : (address.country ?? ""),
  };
  const [draft, setDraft] = useState<Fields>(saved);
  const [other, setOther] = useState(!saved.country_code && !!saved.country);
  // What was saved changed (the server splits a typed dial code off the number, the coach edits it): the boxes follow.
  const savedKey = KEYS.map((k) => saved[k]).join("\u0001");
  const [seenKey, setSeenKey] = useState(savedKey);
  if (seenKey !== savedKey) {
    setSeenKey(savedKey);
    setDraft(saved);
    setOther(!saved.country_code && !!saved.country);
  }
  const [pending, startSaving] = useTransition();
  const changed = KEYS.some((k) => draft[k].trim() !== saved[k]);
  const set = (k: keyof Fields) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const country = countryOf(draft.country_code);

  const save = (close: () => void) => {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    KEYS.forEach((k) => fd.set(k, draft[k].trim()));
    startSaving(async () => {
      await saveMyDetailsAction(fd);
      close();
    });
  };
  const cancel = (close: () => void) => {
    setDraft(saved);
    setOther(!saved.country_code && !!saved.country);
    close();
  };

  return (
    <SettingsFold title="Your details">
      {(close) => (
        <form
          className="st-details-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (changed && !pending) save(close);
          }}
        >
          <label className="st-details-field">
            <span className="st-details-label">Email</span>
            <input id="st-details-email" className="st-details-input" type="email" inputMode="email" autoComplete="email" value={draft.email} placeholder="name@example.com" onChange={(e) => set("email")(e.target.value)} disabled={pending} />
          </label>
          <div className="st-details-field">
            <span className="st-details-label" id="st-details-phone-label">
              Phone
            </span>
            <span className="st-details-phone" role="group" aria-labelledby="st-details-phone-label">
              <select className={`st-details-input st-details-dial${draft.phone_code ? "" : " empty"}`} value={draft.phone_code} onChange={(e) => set("phone_code")(e.target.value)} disabled={pending} aria-label="Country dial code">
                {!draft.phone_code && <option value="">Code</option>}
                {DIAL_CODES.map(([iso, c]) => (
                  <option key={iso} value={c}>
                    {iso} {c}
                  </option>
                ))}
              </select>
              <input id="st-details-phone" className="st-details-input" type="tel" inputMode="tel" autoComplete="tel-national" value={draft.phone} placeholder="6 12345678" onChange={(e) => set("phone")(e.target.value)} disabled={pending} aria-label="Phone number" />
            </span>
          </div>
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
            <button type="button" className="st-details-cancel" onClick={() => cancel(close)} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="st-details-save" disabled={!changed || pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </SettingsFold>
  );
}
