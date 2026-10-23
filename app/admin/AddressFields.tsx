"use client";

import { useState } from "react";
import type { PostalAddress } from "../lib/address";
import { COUNTRIES, countryOf } from "../lib/countries";
import { InfoRow } from "./InfoRow";
import Picker from "./redesign/Picker";

// A client's address in its parts (23 Oct, Alex: for invoicing), as the coach's own business address in Settings:
// the street and number across the row, the postcode and city side by side, then the country as the floating list
// (never the browser's own), with a state or province beside it where the country has them, or the name typed for a
// country not on the list. Rows of the client card (InfoRow), so Details and New client draw it alike. Controlled;
// `named` also posts it under the profile's keys for a form (all six, always, so the save knows it has the parts).

export type AddressDraft = { address: string; postcode: string; city: string; region: string; country_code: string; country: string };

export function addressDraft(a: PostalAddress): AddressDraft {
  return {
    address: a.address ?? "",
    postcode: a.postcode ?? "",
    city: a.city ?? "",
    region: a.region ?? "",
    country_code: a.country_code ?? "",
    // The name is typed only for a country not on the list; one from it is named by its code.
    country: a.country_code ? "" : (a.country ?? ""),
  };
}

const NONE = "";
/** The list's own value for a country not on it. */
const OTHER = "other";
const OPTIONS = [...COUNTRIES.map((c) => ({ value: c.code, label: c.name })), { value: OTHER, label: "Other" }];

export default function AddressFields({ value, onChange, named = false, samples = false }: { value: AddressDraft; onChange: (v: AddressDraft) => void; named?: boolean; /** Sample words in the empty lines (New client). */ samples?: boolean }) {
  const [other, setOther] = useState(!value.country_code && !!value.country);
  const country = countryOf(value.country_code);
  const set = (k: keyof AddressDraft) => (v: string) => onChange({ ...value, [k]: v });
  const name = (k: keyof AddressDraft) => (named ? k : undefined);
  const chosen = !!value.country_code || other;
  return (
    <>
      <InfoRow label="Address" full>
        <input className="nc-input" name={name("address")} value={value.address} onChange={(e) => set("address")(e.target.value)} placeholder={samples ? "Street and number" : undefined} autoComplete="off" maxLength={160} />
      </InfoRow>
      <InfoRow label={country.postcode}>
        <input className="nc-input" name={name("postcode")} value={value.postcode} onChange={(e) => set("postcode")(e.target.value)} autoComplete="off" maxLength={20} />
      </InfoRow>
      <InfoRow label="City">
        <input className="nc-input" name={name("city")} value={value.city} onChange={(e) => set("city")(e.target.value)} autoComplete="off" maxLength={80} />
      </InfoRow>
      <InfoRow label="Country" as="div">
        <Picker
          value={value.country_code || (other ? OTHER : NONE)}
          onChange={(v) => {
            setOther(v === OTHER);
            onChange({ ...value, country_code: v === OTHER ? "" : v, country: "" });
          }}
          label="Country"
          className={`nc-countrypick${chosen ? "" : " empty"}`}
          menuClassName="nc-countrymenu"
          // The empty choice stays, so a country picked by mistake can be taken back.
          options={[{ value: NONE, label: chosen ? "None" : "Choose" }, ...OPTIONS]}
        />
      </InfoRow>
      {other ? (
        <InfoRow label="Country name">
          <input className="nc-input" value={value.country} onChange={(e) => set("country")(e.target.value)} autoComplete="off" maxLength={60} />
        </InfoRow>
      ) : (
        country.region && (
          <InfoRow label={country.region}>
            <input className="nc-input" value={value.region} onChange={(e) => set("region")(e.target.value)} autoComplete="off" maxLength={60} />
          </InfoRow>
        )
      )}
      {named && (
        <>
          <input type="hidden" name="country_code" value={value.country_code} />
          <input type="hidden" name="country" value={other ? value.country : ""} />
          <input type="hidden" name="region" value={country.region ? value.region : ""} />
        </>
      )}
    </>
  );
}
