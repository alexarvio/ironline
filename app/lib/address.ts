import { countryCodeFromName, countryOf } from "./countries";

// A postal address in parts (23 Oct, Alex: the client's, for invoicing), as the coach's own business address is kept:
// the street and number, the postcode, the city, a state or province where the country has them, and the country. One
// helper writes it as lines or one line, and one cleans what a form posts. A plain module: the server and the screens
// both read it.

export type PostalAddress = {
  /** The street and number (on older rows, everything as one string). */
  address?: string | null;
  postcode?: string | null;
  city?: string | null;
  /** State or province, where the country has them (countries.ts `region`). */
  region?: string | null;
  /** ISO code ("NL", "US"); empty is none, or Other with `country` typed. */
  country_code?: string | null;
  /** The country's name: from the list, or typed for one not on it. */
  country?: string | null;
};

const t = (v: unknown) => String(v ?? "").trim();

/** The lines as an envelope reads them, empty parts left out: the street; the postcode and city ("1011 AB Amsterdam";
    where the country has states, "Austin, TX 78701"); the country. */
export function addressLines(a: PostalAddress): string[] {
  const country = countryOf(t(a.country_code) || countryCodeFromName(a.country));
  const place = country.region
    ? [[t(a.city), t(a.region)].filter(Boolean).join(", "), t(a.postcode)].filter(Boolean).join(" ")
    : [t(a.postcode), t(a.city)].filter(Boolean).join(" ");
  return [t(a.address), place, country.code ? country.name : t(a.country)].filter(Boolean);
}

/** The same on one line: "Hoofdstraat 1, 1011 AB Amsterdam, Netherlands". */
export const addressLine = (a: PostalAddress): string => addressLines(a).join(", ");

export type CleanAddress = { address: string | null; postcode: string | null; city: string | null; region: string | null; country_code: string | null; country: string | null };

/** What a form posted, clipped as Business details are: a country from the list by its code (its name with it), a
    typed name only for one not on it, a state only where the country has them. */
export function cleanAddress(raw: PostalAddress): CleanAddress {
  const clip = (v: unknown, max: number) => t(v).slice(0, max) || null;
  const country = countryOf(t(raw.country_code).slice(0, 2).toUpperCase());
  return {
    address: clip(raw.address, 160),
    postcode: clip(raw.postcode, 20),
    city: clip(raw.city, 80),
    region: country.region ? clip(raw.region, 60) : null,
    country_code: country.code || null,
    country: country.code ? country.name : clip(raw.country, 60),
  };
}

/** The keys a form posts for an address, as the profile stores them. */
export const ADDRESS_KEYS = ["address", "postcode", "city", "region", "country_code", "country"] as const;
