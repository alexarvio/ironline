"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveCoachBusinessAction, saveCoachInvoicingAction } from "../../../lib/actions";
import { changeOwnPasswordAction, logoutAction } from "../../../lib/auth-actions";
import type { CoachBusiness, CoachInvoicing } from "../../../lib/db";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/basics";
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from "../../../components/ui/form";
import { ArrowRightIcon } from "../../../components/icons";
import { COUNTRIES, CURRENCIES, countryCodeFromName, countryOf, currencyName, formatMoney, invoicingFor } from "../../../lib/countries";

// Settings' sections, on the shadcn parts: cards of fields, and a bar at the
// foot that appears once something is changed, with Save and Discard. Each
// form is keyed on what was saved (the page does it), so a save that comes
// back unchanged never throws away what is being typed.

function Field({ label, hint, wide = false, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rst-field${wide ? " wide" : ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && <small className="rst-hint">{hint}</small>}
    </div>
  );
}

function SaveBar({ dirty, busy, onSave, onDiscard, error }: { dirty: boolean; busy: boolean; onSave: () => void; onDiscard: () => void; error?: string }) {
  if (!dirty) return null;
  return (
    <div className="rst-bar" role="region" aria-label="Unsaved changes">
      <span className={error ? "bad" : ""}>{error || "Unsaved changes"}</span>
      <Button variant="ghost" onClick={onDiscard} disabled={busy}>
        Discard
      </Button>
      <Button onClick={onSave} disabled={busy || !!error}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

/** A form's working copy, what it started from, and Save / Discard. */
function useDraft<T extends Record<string, unknown>>(initial: T, save: (v: T) => Promise<unknown>, said: string) {
  const router = useRouter();
  const [v, setV] = useState<T>(initial);
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const set = <K extends keyof T>(k: K, val: T[K]) => setV((o) => ({ ...o, [k]: val }));
  const commit = () =>
    start(async () => {
      try {
        await save(v);
        router.refresh();
        toast.success(said);
      } catch {
        toast.error("Couldn't save", { description: "Check your connection and try again." });
      }
    });
  return { v, set, dirty, busy, commit, discard: () => setV(initial) };
}

// ---- Account & security
export function AccountSettings({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const problem = next && next.length < 8 ? "At least 8 characters." : again && next !== again ? "The two new passwords differ." : "";
  const ok = !!current && next.length >= 8 && next === again;
  const change = () =>
    start(async () => {
      const r = await changeOwnPasswordAction(current, next);
      if (!r.ok) {
        setError(r.error ?? "Couldn't change it.");
        return;
      }
      setError("");
      setCurrent("");
      setNext("");
      setAgain("");
      toast.success("Password changed");
    });
  return (
    <div className="rst-cards">
      <Card>
        <CardHeader>
          <CardTitle>Sign-in</CardTitle>
        </CardHeader>
        <CardContent className="rst-grid">
          <Field label="Email" hint="The address you sign in with." wide>
            <Input value={email} readOnly disabled />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent className="rst-grid">
          <Field label="Current password" wide>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" aria-invalid={!!problem && next.length < 8} />
          </Field>
          <Field label="New password again">
            <Input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" aria-invalid={!!again && next !== again} />
          </Field>
          <div className="rst-row-end wide">
            <span className={`rst-note${problem || error ? " bad" : ""}`}>{problem || error}</span>
            <Button onClick={change} disabled={!ok || busy}>
              {busy ? "Changing…" : "Change password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This device</CardTitle>
          <Button variant="outline" onClick={() => logoutAction()}>
            Sign out
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
}

// ---- Business details: who the invoices are from. The country comes first:
// it names the numbers and the address lines (lib/countries.ts).
const OTHER = "other";

export function BusinessSettings({ initial }: { initial: CoachBusiness }) {
  const d = useDraft<CoachBusiness>({ ...initial, country_code: initial.country_code ?? countryCodeFromName(initial.country) }, saveCoachBusinessAction, "Business details saved");
  const country = countryOf(d.v.country_code);
  const text = (k: keyof CoachBusiness, label: string, opts: { hint?: string; wide?: boolean; placeholder?: string; type?: string } = {}) => (
    <Field label={label} hint={opts.hint} wide={opts.wide}>
      <Input type={opts.type ?? "text"} value={d.v[k] ?? ""} onChange={(e) => d.set(k, e.target.value)} placeholder={opts.placeholder} />
    </Field>
  );
  return (
    <div className="rst-cards">
      <Card>
        <CardHeader>
          <CardTitle>Where you do business</CardTitle>
        </CardHeader>
        <CardContent className="rst-grid">
          <Field label="Country" hint="Names the numbers below, and sets the tax, currency and bank fields your invoices use.">
            <Select value={country.code || OTHER} onValueChange={(v) => d.set("country_code", v === OTHER ? "" : v)}>
              <SelectTrigger aria-label="Country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>Somewhere else</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {!country.code && text("country", "Country name", { placeholder: "Where you are registered" })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
        </CardHeader>
        <CardContent className="rst-grid">
          {text("business_name", "Business name", { placeholder: "Full Potential Coaching" })}
          {text("legal_name", "Legal name", { placeholder: "As registered" })}
          {text("company_number", country.registration ?? "Business registration", { hint: country.registration ? undefined : "If you have one." })}
          {text("vat_number", country.taxId, { hint: country.code === "US" ? "Leave empty if you invoice as yourself." : undefined })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="rst-grid">
          {text("address", "Street and number", { wide: true })}
          {text("city", "City")}
          {country.region && text("region", country.region)}
          {text("postcode", country.postcode)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contact on invoices</CardTitle>
        </CardHeader>
        <CardContent className="rst-grid">
          {text("billing_email", "Billing email", { type: "email", placeholder: "billing@…" })}
          {text("phone", "Phone")}
          {text("website", "Website", { wide: true, placeholder: "https://" })}
        </CardContent>
      </Card>
      <SaveBar dirty={d.dirty} busy={d.busy} onSave={d.commit} onDiscard={d.discard} />
    </div>
  );
}

// ---- Invoicing & payments: how invoices are numbered, priced and paid. The
// country from Business details fills in what is left open.
export function InvoicingSettings({ initial, business }: { initial: CoachInvoicing; business: CoachBusiness }) {
  const eff = invoicingFor(business, initial);
  const country = eff.country;
  const d = useDraft<CoachInvoicing>({ currency: eff.currency, vat_rate: eff.rate, prices_include_vat: eff.pricesIncludeVat, payment_terms_days: eff.termsDays, number_prefix: "", next_number: 1, ...initial }, saveCoachInvoicingAction, "Invoicing saved");
  const num = (k: "vat_rate" | "payment_terms_days" | "next_number", s: string) => d.set(k, s === "" ? undefined : Number(s));
  const text = (k: keyof CoachInvoicing, label: string, opts: { hint?: string; wide?: boolean; placeholder?: string; upper?: boolean; bad?: boolean } = {}) => (
    <Field label={label} hint={opts.hint} wide={opts.wide}>
      <Input value={String(d.v[k] ?? "")} onChange={(e) => d.set(k, (opts.upper ? e.target.value.toUpperCase() : e.target.value) as never)} placeholder={opts.placeholder} aria-invalid={opts.bad} />
    </Field>
  );
  const year = new Date().getFullYear();
  const example = `${(d.v.number_prefix ?? "").replaceAll("{year}", String(year))}${String(d.v.next_number ?? 1).padStart(4, "0")}`;
  const ibanBad = !!d.v.iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(d.v.iban.replace(/\s+/g, "").toUpperCase());
  const tax = country.tax;
  const currencies = CURRENCIES.includes(d.v.currency ?? "") ? CURRENCIES : [d.v.currency ?? "EUR", ...CURRENCIES];
  const where = country.code ? country.name : "your country";
  const rateHint =
    country.code === "US"
      ? "Coaching is usually not taxed in the US; if your state taxes it, put its rate here."
      : country.code
        ? `${country.rate}% is the standard rate in ${country.name}; 0% if you are exempt or below the threshold.`
        : "0% if you don't charge tax.";
  return (
    <div className="rst-cards">
      <Card>
        <CardHeader>
          <CardTitle>Prices and {tax}</CardTitle>
          {country.code && <Badge className="rst-example">{country.name}</Badge>}
        </CardHeader>
        <CardContent className="rst-grid">
          <Field label="Currency">
            <Select value={d.v.currency ?? eff.currency} onValueChange={(v) => d.set("currency", v)}>
              <SelectTrigger aria-label="Currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c} · {currencyName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`${tax} rate`} hint={rateHint}>
            <div className="rst-suffixed">
              <Input type="number" inputMode="decimal" min={0} max={50} step={0.1} value={d.v.vat_rate ?? ""} onChange={(e) => num("vat_rate", e.target.value)} />
              <em>%</em>
            </div>
          </Field>
          <Field label="Prices you type" wide>
            <label className="rst-switch">
              <Switch checked={!!d.v.prices_include_vat} onCheckedChange={(v) => d.set("prices_include_vat", v)} />
              <span>{d.v.prices_include_vat ? `Include ${tax}: ${formatMoney(120, d.v.currency ?? eff.currency, country.code)} is what the client pays` : `Exclude ${tax}: it is added on top`}</span>
            </label>
          </Field>
          <Field label="Payment terms">
            <div className="rst-suffixed">
              <Input type="number" inputMode="numeric" min={0} max={120} value={d.v.payment_terms_days ?? ""} onChange={(e) => num("payment_terms_days", e.target.value)} />
              <em>days</em>
            </div>
          </Field>
          {text("tax_note", `${tax} note on invoices`, { placeholder: country.code === "NL" ? "Vrijgesteld van btw (KOR)" : "VAT exempt, reverse charge…", hint: "Optional; printed under the totals." })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Numbering</CardTitle>
          <Badge className="rst-example">{example}</Badge>
        </CardHeader>
        <CardContent className="rst-grid">
          <Field label="Prefix" hint="{year} becomes the year.">
            <Input value={d.v.number_prefix ?? ""} onChange={(e) => d.set("number_prefix", e.target.value)} placeholder="FP-{year}-" />
          </Field>
          <Field label="Next number">
            <Input type="number" inputMode="numeric" min={1} value={d.v.next_number ?? ""} onChange={(e) => num("next_number", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank transfer</CardTitle>
          {!country.code && (
            <Link href="/admin/redesign/settings/business" className="rst-open">
              Set your country
            </Link>
          )}
        </CardHeader>
        <CardContent className="rst-grid">
          {text("account_holder", "Account holder", { placeholder: business.legal_name || business.business_name || "", wide: country.bank === "other" })}
          {country.bank === "iban" && (
            <>
              {text("iban", "IBAN", { upper: true, placeholder: `${country.code || "NL"}00 BANK 0123 4567 89`, hint: ibanBad ? "That doesn't look like an IBAN." : undefined, bad: ibanBad })}
              {text("bic", "BIC / SWIFT", { upper: true })}
            </>
          )}
          {country.bank === "uk" && (
            <>
              {text("sort_code", "Sort code", { placeholder: "12-34-56" })}
              {text("account_number", "Account number", { placeholder: "12345678" })}
              {text("iban", "IBAN", { upper: true, hint: ibanBad ? "That doesn't look like an IBAN." : "For clients paying from abroad.", bad: ibanBad })}
              {text("bic", "BIC / SWIFT", { upper: true })}
            </>
          )}
          {country.bank === "us" && (
            <>
              {text("routing_number", "Routing number (ABA)", { placeholder: "021000021" })}
              {text("account_number", "Account number")}
            </>
          )}
          {country.bank === "au" && (
            <>
              {text("bsb", "BSB", { placeholder: "062-000" })}
              {text("account_number", "Account number")}
            </>
          )}
          {country.bank === "other" && (
            <Field label="How to pay you" hint={`Your bank details as clients in ${where} would use them.`} wide>
              <Textarea value={d.v.bank_details ?? ""} onChange={(e) => d.set("bank_details", e.target.value)} rows={3} placeholder="Bank, account number, and any code the bank needs" />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Online payments</CardTitle>
          <Badge className="rst-soon">Soon</Badge>
        </CardHeader>
        <CardContent>
          <p className="rst-para">Clients pay an invoice in the app by card, iDEAL, PayPal or whatever works where they are, and it marks itself paid. Through your own Stripe account, connected here.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice footer</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={d.v.footer ?? ""} onChange={(e) => d.set("footer", e.target.value)} placeholder="Thank you for training with us. Questions about this invoice: billing@…" rows={3} />
        </CardContent>
      </Card>

      <SaveBar dirty={d.dirty} busy={d.busy} onSave={d.commit} onDiscard={d.discard} error={ibanBad ? "Check the IBAN before saving." : undefined} />
    </div>
  );
}

// ---- Privacy & legal: the documents clients see, and what happens to their data.
export function PrivacySettings({ company, country, contactEmail, updated }: { company: string; country: string; contactEmail: string; updated: string }) {
  const doc = (label: string, href: string | null, note: string) => (
    <li className="rst-line">
      <span>
        <b>{label}</b>
        <small>{note}</small>
      </span>
      {href ? (
        <Link href={href} target="_blank" className="rst-open">
          Open <ArrowRightIcon />
        </Link>
      ) : (
        <Badge className="rst-soon">Soon</Badge>
      )}
    </li>
  );
  return (
    <div className="rst-cards">
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="rst-lines">
            {doc("Privacy policy", "/privacy", `Updated ${updated} · linked from the app and the App Store`)}
            {doc("Support page", "/support", "Where clients find help")}
            {doc("Terms of service", null, "What clients agree to when they sign up")}
            {doc("Data processing agreement", null, "Between you and the app, for clients' health data")}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who is behind the app</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="rst-lines">
            <li className="rst-line">
              <span>
                <b>{company}</b>
                <small>Registered in {country}</small>
              </span>
            </li>
            <li className="rst-line">
              <span>
                <b>Privacy contact</b>
                <small>{contactEmail || "Not set yet: the policy and support page say so"}</small>
              </span>
              {!contactEmail && <Badge className="rst-warn">Missing</Badge>}
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your clients&rsquo; data</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="rst-lines">
            <li className="rst-line">
              <span>
                <b>Clients delete their own account</b>
                <small>In the app, under Account; their data goes straight away.</small>
              </span>
            </li>
            <li className="rst-line">
              <span>
                <b>Invoices stay</b>
                <small>Up to 7 years, the business record the law asks you to keep, with only the client&rsquo;s name.</small>
              </span>
            </li>
            <li className="rst-line">
              <span>
                <b>Backups</b>
                <small>Nightly; a deleted account is gone from them within 30 days.</small>
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
