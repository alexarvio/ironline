import type { ReactNode } from "react";
import type { InvoiceView } from "../lib/queries";
import { countryCodeFromName, countryOf, formatLongDate, formatMoney } from "../lib/countries";
import "./invoice-sheet.css";

// One invoice as an A4 sheet: who it is from (the coach's Business details),
// who it is for, the lines with tax, and how to pay (the bank from
// Invoicing). The coach's country names things (VAT or Sales tax, KvK or
// Company number, IBAN or routing number) and writes the money and dates.
// The coach's page and the client's draw the same sheet.

const spaced = (s?: string) => (s ?? "").replace(/(.{4})/g, "$1 ").trim();

export default function InvoiceSheet({ v }: { v: InvoiceView }) {
  const f = v.from;
  const country = countryOf(f.country_code || countryCodeFromName(f.country));
  const cc = country.code;
  const money = (n: number) => formatMoney(n, v.currency, cc);
  const date = (d: string) => formatLongDate(d, cc);
  const seller = f.business_name || f.legal_name || "Your business name";
  // "Amsterdam" under "1011 AB"; in the US and Canada, "Austin, TX 78701".
  const place = country.region ? [[f.city, f.region].filter(Boolean).join(", "), f.postcode].filter(Boolean).join(" ") : [f.postcode, f.city].filter(Boolean).join(" ");
  const holder = f.account_holder || f.legal_name || seller;

  const bankLines: ReactNode[] = [];
  if (country.bank === "us" && f.routing_number) bankLines.push(<>Routing number <b>{f.routing_number}</b>, account <b>{f.account_number}</b></>);
  else if (country.bank === "au" && f.bsb) bankLines.push(<>BSB <b>{f.bsb}</b>, account <b>{f.account_number}</b></>);
  else if (country.bank === "uk" && f.sort_code) bankLines.push(<>Sort code <b>{f.sort_code}</b>, account <b>{f.account_number}</b></>);
  if (f.iban) bankLines.push(<>IBAN <b>{spaced(f.iban)}</b>{f.bic ? ` · BIC ${f.bic}` : ""}</>);
  if (f.bank_details && bankLines.length === 0) bankLines.push(<span className="ivp-pre">{f.bank_details}</span>);

  return (
    <article className="ivp-sheet">
      <header className="ivp-head">
        <div className="ivp-from">
          <b className="ivp-seller">{seller}</b>
          {f.legal_name && f.legal_name !== f.business_name && <span>{f.legal_name}</span>}
          {f.address && <span>{f.address}</span>}
          {place && <span>{place}</span>}
          {(f.country || (cc && country.name)) && <span>{cc ? country.name : f.country}</span>}
          {f.billing_email && <span>{f.billing_email}</span>}
          {f.phone && <span>{f.phone}</span>}
          {f.website && <span>{f.website}</span>}
        </div>
        <div className="ivp-title">
          <h1>Invoice</h1>
          <dl>
            <dt>Number</dt>
            <dd>{v.number}</dd>
            <dt>Date</dt>
            <dd>{date(v.issueDate)}</dd>
            {v.dueDate && (
              <>
                <dt>Due</dt>
                <dd>{date(v.dueDate)}</dd>
              </>
            )}
          </dl>
        </div>
      </header>

      <section className="ivp-to">
        <small>Billed to</small>
        <b>{v.to.name}</b>
        {v.to.address && <span>{v.to.address}</span>}
        {v.to.email && <span>{v.to.email}</span>}
      </section>

      <table className="ivp-lines">
        <thead>
          <tr>
            <th>Description</th>
            <th className="n">Qty</th>
            <th className="n">Price</th>
            <th className="n">Amount</th>
          </tr>
        </thead>
        <tbody>
          {v.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.description}</td>
              <td className="n">{l.quantity}</td>
              <td className="n">{money(l.unit_price)}</td>
              <td className="n">{money(l.quantity * l.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ivp-totals">
        {v.vatRate > 0 || v.vat > 0 ? (
          <>
            <dt>Subtotal{v.pricesIncludeVat ? ` (excl. ${v.taxLabel})` : ""}</dt>
            <dd>{money(v.subtotal)}</dd>
            <dt>
              {v.taxLabel} {v.vatRate}%
            </dt>
            <dd>{money(v.vat)}</dd>
          </>
        ) : null}
        <dt className="grand">Total</dt>
        <dd className="grand">{money(v.total)}</dd>
      </dl>
      {(f.tax_note || v.vatRate === 0) && <p className="ivp-small">{f.tax_note || `No ${v.taxLabel.toLowerCase()} charged.`}</p>}

      {v.note && <p className="ivp-note">{v.note}</p>}

      <section className="ivp-pay">
        <small>{v.status === "paid" ? "Paid" : "How to pay"}</small>
        {v.status === "paid" ? (
          <p>This invoice has been paid. Thank you.</p>
        ) : bankLines.length > 0 ? (
          <>
            <p>
              Please transfer <b>{money(v.total)}</b>
              {v.dueDate ? ` by ${date(v.dueDate)}` : ""} to {holder}, quoting <b>{v.number}</b>.
            </p>
            {bankLines.map((l, i) => (
              <p key={i} className="ivp-bank">
                {l}
              </p>
            ))}
          </>
        ) : (
          <p className="ivp-small">Bank details to follow.</p>
        )}
      </section>

      <footer className="ivp-foot">
        {f.footer && <p>{f.footer}</p>}
        <p>{[f.company_number && `${country.registration ?? "Registration"} ${f.company_number}`, f.vat_number && `${country.taxId} ${f.vat_number}`].filter(Boolean).join(" · ")}</p>
      </footer>
    </article>
  );
}
