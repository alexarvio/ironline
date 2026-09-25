import type { CoachBusiness, CoachInvoicing } from "./db";

// Where a coach does business, and what that means for their invoices: the
// name of the tax and of the two numbers a business carries, the usual tax
// rate and currency (only defaults: the coach can change them), how clients
// pay by bank, and how the address and money are written. A plain module:
// Settings, the invoice sheet and invoice creation all read it.
//
// Tax rates are each country's standard rate as of 2026; a coach's services
// can be exempt or reduced, so the rate stays theirs to set.

/** How a client pays by bank transfer there. */
export type BankKind = "iban" | "uk" | "us" | "au" | "other";

export type Country = {
  code: string;
  name: string;
  currency: string;
  /** "VAT", "Sales tax", "GST". */
  tax: string;
  /** The standard rate, in percent. */
  rate: number;
  /** The business's registration number ("KvK number", "Company number"); null where there is no usual one. */
  registration: string | null;
  /** The tax number ("VAT number", "EIN", "ABN"). */
  taxId: string;
  bank: BankKind;
  postcode: string;
  /** The line for a state or province, where addresses have one. */
  region?: string;
};

const EU = (code: string, name: string, rate: number, registration: string | null = "Company registration number", currency = "EUR"): Country => ({ code, name, currency, tax: "VAT", rate, registration, taxId: "VAT number", bank: "iban", postcode: "Postcode" });

export const COUNTRIES: Country[] = [
  EU("AT", "Austria", 20, "Firmenbuch number"),
  EU("BE", "Belgium", 21, "Enterprise number"),
  EU("BG", "Bulgaria", 20, "UIC", "EUR"),
  EU("HR", "Croatia", 25),
  EU("CY", "Cyprus", 19),
  EU("CZ", "Czechia", 21, "IČO", "CZK"),
  EU("DK", "Denmark", 25, "CVR number", "DKK"),
  EU("EE", "Estonia", 24, "Registry code"),
  EU("FI", "Finland", 25.5, "Business ID (Y-tunnus)"),
  EU("FR", "France", 20, "SIRET"),
  EU("DE", "Germany", 19, "Handelsregister number"),
  EU("GR", "Greece", 24, "GEMI number"),
  EU("HU", "Hungary", 27, "Company registration number", "HUF"),
  EU("IE", "Ireland", 23, "CRO number"),
  EU("IT", "Italy", 22, "Codice fiscale"),
  EU("LV", "Latvia", 21),
  EU("LT", "Lithuania", 21),
  EU("LU", "Luxembourg", 17, "RCS number"),
  EU("MT", "Malta", 18),
  EU("NL", "Netherlands", 21, "KvK number"),
  EU("PL", "Poland", 23, "KRS / REGON", "PLN"),
  EU("PT", "Portugal", 23, "NIPC"),
  EU("RO", "Romania", 21, "CUI", "RON"),
  EU("SK", "Slovakia", 23, "IČO"),
  EU("SI", "Slovenia", 22),
  EU("ES", "Spain", 21, "NIF"),
  EU("SE", "Sweden", 25, "Organisation number", "SEK"),
  { code: "NO", name: "Norway", currency: "NOK", tax: "VAT", rate: 25, registration: "Organisation number", taxId: "MVA number", bank: "iban", postcode: "Postcode" },
  { code: "CH", name: "Switzerland", currency: "CHF", tax: "VAT", rate: 8.1, registration: "UID", taxId: "VAT number (MWST)", bank: "iban", postcode: "Postcode" },
  { code: "GB", name: "United Kingdom", currency: "GBP", tax: "VAT", rate: 20, registration: "Company number", taxId: "VAT number", bank: "uk", postcode: "Postcode" },
  { code: "US", name: "United States", currency: "USD", tax: "Sales tax", rate: 0, registration: null, taxId: "EIN", bank: "us", postcode: "ZIP code", region: "State" },
  { code: "CA", name: "Canada", currency: "CAD", tax: "GST/HST", rate: 5, registration: "Business number (BN)", taxId: "GST/HST number", bank: "other", postcode: "Postal code", region: "Province" },
  { code: "AU", name: "Australia", currency: "AUD", tax: "GST", rate: 10, registration: "ACN", taxId: "ABN", bank: "au", postcode: "Postcode", region: "State" },
  { code: "NZ", name: "New Zealand", currency: "NZD", tax: "GST", rate: 15, registration: "NZBN", taxId: "GST number", bank: "other", postcode: "Postcode" },
];

/** Anywhere else: plain words, no rate assumed, bank details as free text. */
export const OTHER_COUNTRY: Country = { code: "", name: "Other", currency: "EUR", tax: "Tax", rate: 0, registration: "Company registration number", taxId: "Tax number", bank: "other", postcode: "Postcode" };

export function countryOf(code: string | null | undefined): Country {
  return COUNTRIES.find((c) => c.code === code) ?? OTHER_COUNTRY;
}

/** A country from what was typed before the list existed ("Netherlands", "nl"). */
export function countryCodeFromName(name: string | null | undefined): string {
  const n = String(name ?? "").trim().toLowerCase();
  if (!n) return "";
  return COUNTRIES.find((c) => c.name.toLowerCase() === n || c.code.toLowerCase() === n)?.code ?? (["uk", "england", "great britain"].includes(n) ? "GB" : ["usa", "united states of america", "america"].includes(n) ? "US" : "");
}

/** The currencies Settings offers: every country's, then the rest people ask for. */
export const CURRENCIES: string[] = [...new Set(["EUR", "USD", "GBP", ...COUNTRIES.map((c) => c.currency), "JPY", "SGD", "AED", "ZAR", "BRL", "MXN", "INR", "THB"])];

export function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** How money and dates are written on the invoice: English words, the country's way with numbers. */
export function localeOf(code: string | null | undefined): string {
  const c = countryOf(code);
  if (!c.code) return "en-GB";
  try {
    return Intl.getCanonicalLocales(`en-${c.code}`)[0];
  } catch {
    return "en-GB";
  }
}

export function formatMoney(n: number, currency: string, countryCode?: string | null): string {
  try {
    return new Intl.NumberFormat(localeOf(countryCode), { style: "currency", currency }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(2)}`;
  }
}

export function formatLongDate(iso: string, countryCode?: string | null): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(countryOf(countryCode).code === "US" ? "en-US" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** What a new invoice gets from Settings, the country filling in whatever the coach left open. */
export function invoicingFor(b: CoachBusiness, i: CoachInvoicing) {
  const country = countryOf(b.country_code || countryCodeFromName(b.country));
  return {
    country,
    currency: i.currency || country.currency,
    rate: i.vat_rate ?? country.rate,
    taxLabel: country.tax,
    // Prices in Europe are usually quoted with VAT in; in the US tax goes on top.
    pricesIncludeVat: i.prices_include_vat ?? country.code !== "US",
    termsDays: i.payment_terms_days ?? (country.code === "US" ? 30 : 14),
  };
}

/** Whether the invoice can say how to pay by bank, the way the country does it. */
export function hasBankDetails(p: Partial<CoachInvoicing>, country: Country): boolean {
  switch (country.bank) {
    case "iban":
      return !!p.iban;
    case "uk":
      return !!p.iban || !!(p.sort_code && p.account_number);
    case "us":
      return !!(p.routing_number && p.account_number);
    case "au":
      return !!(p.bsb && p.account_number);
    default:
      return !!(p.bank_details || p.iban);
  }
}
