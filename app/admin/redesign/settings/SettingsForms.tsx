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

// ---- Business details: who the invoices are from.
export function BusinessSettings({ initial }: { initial: CoachBusiness }) {
  const d = useDraft<CoachBusiness>(initial, saveCoachBusinessAction, "Business details saved");
  const text = (k: keyof CoachBusiness, label: string, opts: { hint?: string; wide?: boolean; placeholder?: string; type?: string } = {}) => (
    <Field label={label} hint={opts.hint} wide={opts.wide}>
      <Input type={opts.type ?? "text"} value={d.v[k] ?? ""} onChange={(e) => d.set(k, e.target.value)} placeholder={opts.placeholder} />
    </Field>
  );
  return (
    <div className="rst-cards">
      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
        </CardHeader>
        <CardContent className="rst-grid">
          {text("business_name", "Business name", { placeholder: "Full Potential Coaching" })}
          {text("legal_name", "Legal name", { placeholder: "As registered" })}
          {text("company_number", "Chamber of Commerce (KvK) number", { placeholder: "12345678" })}
          {text("vat_number", "VAT number", { placeholder: "NL000000000B01" })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="rst-grid">
          {text("address", "Street and number", { wide: true })}
          {text("postcode", "Postcode")}
          {text("city", "City")}
          {text("country", "Country", { placeholder: "Netherlands" })}
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

// ---- Invoicing & payments: how invoices are numbered, priced and paid.
const CURRENCIES = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "US dollar ($)" },
  { value: "GBP", label: "Pound sterling (£)" },
] as const;

export function InvoicingSettings({ initial, business }: { initial: CoachInvoicing; business: CoachBusiness }) {
  const d = useDraft<CoachInvoicing>({ currency: "EUR", vat_rate: 21, prices_include_vat: true, payment_terms_days: 14, number_prefix: "", next_number: 1, ...initial }, saveCoachInvoicingAction, "Invoicing saved");
  const num = (k: "vat_rate" | "payment_terms_days" | "next_number", s: string) => d.set(k, s === "" ? undefined : Number(s));
  const year = new Date().getFullYear();
  const example = `${(d.v.number_prefix ?? "").replace("{year}", String(year))}${String(d.v.next_number ?? 1).padStart(4, "0")}`;
  const ibanBad = !!d.v.iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(d.v.iban.replace(/\s+/g, "").toUpperCase());
  return (
    <div className="rst-cards">
      <Card>
        <CardHeader>
          <CardTitle>Prices and VAT</CardTitle>
        </CardHeader>
        <CardContent className="rst-grid">
          <Field label="Currency">
            <Select value={d.v.currency ?? "EUR"} onValueChange={(v) => d.set("currency", v as CoachInvoicing["currency"])}>
              <SelectTrigger aria-label="Currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="VAT rate" hint="21% is the standard Dutch rate; 0% if you are exempt (KOR).">
            <div className="rst-suffixed">
              <Input type="number" inputMode="decimal" min={0} max={50} step={0.5} value={d.v.vat_rate ?? ""} onChange={(e) => num("vat_rate", e.target.value)} />
              <em>%</em>
            </div>
          </Field>
          <Field label="Prices you type" wide>
            <label className="rst-switch">
              <Switch checked={!!d.v.prices_include_vat} onCheckedChange={(v) => d.set("prices_include_vat", v)} />
              <span>{d.v.prices_include_vat ? "Include VAT: €120 is €120 on the invoice" : "Exclude VAT: it is added on top"}</span>
            </label>
          </Field>
          <Field label="Payment terms">
            <div className="rst-suffixed">
              <Input type="number" inputMode="numeric" min={0} max={120} value={d.v.payment_terms_days ?? ""} onChange={(e) => num("payment_terms_days", e.target.value)} />
              <em>days</em>
            </div>
          </Field>
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
        </CardHeader>
        <CardContent className="rst-grid">
          <Field label="Account holder">
            <Input value={d.v.account_holder ?? ""} onChange={(e) => d.set("account_holder", e.target.value)} placeholder={business.legal_name || business.business_name || ""} />
          </Field>
          <Field label="IBAN" hint={ibanBad ? "That doesn't look like an IBAN." : undefined}>
            <Input value={d.v.iban ?? ""} onChange={(e) => d.set("iban", e.target.value.toUpperCase())} placeholder="NL00 BANK 0123 4567 89" aria-invalid={ibanBad} />
          </Field>
          <Field label="BIC">
            <Input value={d.v.bic ?? ""} onChange={(e) => d.set("bic", e.target.value.toUpperCase())} placeholder="INGBNL2A" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Card and iDEAL payments</CardTitle>
          <Badge className="rst-soon">Soon</Badge>
        </CardHeader>
        <CardContent>
          <p className="rst-para">Clients pay an invoice from a link, by card or iDEAL, and it marks itself paid. Through Stripe or Mollie, connected here.</p>
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
