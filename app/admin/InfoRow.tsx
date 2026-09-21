"use client";

import type { ReactNode } from "react";

// The client card's field row, shared by the Member info editor and the New
// client dialog so editing a client and making one feel like the same
// object: the label over the value, a hairline under it, and the input IS
// the value — borderless, the hairline its only chrome. Change the row here
// and both change.

export function InfoRow({
  label,
  aside,
  full = false,
  bad = false,
  as: Tag = "label",
  children,
}: {
  label: string;
  /** Beside the label, in link blue: the age next to Birthdate. */
  aside?: ReactNode;
  /** Spans both columns of the grid (Email). */
  full?: boolean;
  /** The hairline turns red: an email already in use. */
  bad?: boolean;
  /** "div" where the row holds more than one control (pills, dial code + number). */
  as?: "label" | "div";
  children: ReactNode;
}) {
  return (
    <Tag className={`nc-row${full ? " full" : ""}${bad ? " bad" : ""}`}>
      <span className="nc-label">
        {label}
        {aside ? <span className="nc-aside">{aside}</span> : null}
      </span>
      <span className="nc-control">{children}</span>
    </Tag>
  );
}

/** A number with its unit after it: "182 cm". */
export function Suffixed({ unit, children }: { unit: string; children: ReactNode }) {
  return (
    <span className="nc-suffixed">
      {children}
      <em>{unit}</em>
    </span>
  );
}

/**
 * Whole years from a birthdate, by month and day rather than year minus year
 * (someone born in December is not a year older in January). Blank for an
 * empty or impossible date. Never stored: worked out wherever it is shown.
 */
export function ageFrom(birthdate: string, today: Date = new Date()): number | null {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(birthdate || "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getFullYear() - y;
  const month = today.getMonth() + 1;
  if (month < mo || (month === mo && today.getDate() < d)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

// Dial codes in the order this business meets them, not alphabetically.
export const DIAL_CODES: [iso: string, code: string][] = [
  ["NL", "+31"],
  ["BE", "+32"],
  ["UK", "+44"],
  ["DE", "+49"],
  ["FR", "+33"],
  ["ES", "+34"],
  ["IT", "+39"],
  ["PT", "+351"],
  ["IE", "+353"],
  ["CH", "+41"],
  ["AT", "+43"],
  ["DK", "+45"],
  ["SE", "+46"],
  ["NO", "+47"],
  ["PL", "+48"],
  ["US", "+1"],
  ["AU", "+61"],
  ["NZ", "+64"],
  ["ZA", "+27"],
  ["AE", "+971"],
];
export const DEFAULT_DIAL = "+31";

/**
 * Dial code and number as one field. The two are stored apart and only
 * joined for show. `legacy`: a phone typed before the split, kept exactly as
 * typed with no code picked, rather than a country guessed out of it.
 */
export function PhoneInput({
  code,
  number,
  onCode,
  onNumber,
  codeName,
  numberName,
  legacy = false,
}: {
  code: string;
  number: string;
  onCode: (v: string) => void;
  onNumber: (v: string) => void;
  codeName?: string;
  numberName?: string;
  legacy?: boolean;
}) {
  return (
    <span className="nc-phone">
      <select className="nc-dial" name={codeName} value={code} onChange={(e) => onCode(e.target.value)} aria-label="Country dial code">
        {legacy && <option value="">—</option>}
        {DIAL_CODES.map(([iso, c]) => (
          <option key={iso} value={c}>
            {iso} {c}
          </option>
        ))}
      </select>
      <input className="nc-input" name={numberName} type="tel" inputMode="tel" value={number} onChange={(e) => onNumber(e.target.value)} placeholder="6 12345678" aria-label="Phone number" autoComplete="off" />
    </span>
  );
}

const GENDERS = ["Male", "Female", "Other"];

/** Male · Female · Other as pills; clicking the picked one clears it. */
export function GenderPills({ value, onChange, name }: { value: string; onChange: (v: string) => void; name?: string }) {
  return (
    <span className="nc-pills" role="radiogroup" aria-label="Gender">
      {name && <input type="hidden" name={name} value={value} />}
      {GENDERS.map((g) => (
        <button key={g} type="button" role="radio" aria-checked={value === g} className={`pl-chip${value === g ? " on" : ""}`} onClick={() => onChange(value === g ? "" : g)}>
          {g}
        </button>
      ))}
    </span>
  );
}
