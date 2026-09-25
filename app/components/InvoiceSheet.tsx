import type { InvoiceView } from "../lib/queries";
import "./invoice-sheet.css";

// One invoice as an A4 sheet: who it is from (the coach's Business details),
// who it is for, the lines with VAT, and how to pay (the bank from
// Invoicing). The coach's page and the client's draw the same sheet.

const money = (n: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n || 0);
const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const spacedIban = (s?: string) => (s ?? "").replace(/(.{4})/g, "$1 ").trim();

export default function InvoiceSheet({ v }: { v: InvoiceView }) {
  const f = v.from;
  const seller = f.business_name || f.legal_name || "Your business name";
  const place = [f.postcode, f.city].filter(Boolean).join(" ");
  return (
    <article className="ivp-sheet">
      <header className="ivp-head">
        <div className="ivp-from">
          <b className="ivp-seller">{seller}</b>
          {f.legal_name && f.legal_name !== f.business_name && <span>{f.legal_name}</span>}
          {f.address && <span>{f.address}</span>}
          {place && <span>{place}</span>}
          {f.country && <span>{f.country}</span>}
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
            <dd>{longDate(v.issueDate)}</dd>
            {v.dueDate && (
              <>
                <dt>Due</dt>
                <dd>{longDate(v.dueDate)}</dd>
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
              <td className="n">{money(l.unit_price, v.currency)}</td>
              <td className="n">{money(l.quantity * l.unit_price, v.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ivp-totals">
        <dt>Subtotal{v.pricesIncludeVat ? " (excl. VAT)" : ""}</dt>
        <dd>{money(v.subtotal, v.currency)}</dd>
        <dt>VAT {v.vatRate}%</dt>
        <dd>{money(v.vat, v.currency)}</dd>
        <dt className="grand">Total</dt>
        <dd className="grand">{money(v.total, v.currency)}</dd>
      </dl>
      {v.vatRate === 0 && <p className="ivp-small">No VAT charged.</p>}

      {v.note && <p className="ivp-note">{v.note}</p>}

      <section className="ivp-pay">
        <small>{v.status === "paid" ? "Paid" : "How to pay"}</small>
        {v.status === "paid" ? (
          <p>This invoice has been paid. Thank you.</p>
        ) : f.iban ? (
          <p>
            Please transfer <b>{money(v.total, v.currency)}</b>
            {v.dueDate ? ` by ${longDate(v.dueDate)}` : ""} to <b>{spacedIban(f.iban)}</b>
            {f.bic ? ` (BIC ${f.bic})` : ""} in the name of {f.account_holder || f.legal_name || seller}, quoting <b>{v.number}</b>.
          </p>
        ) : (
          <p className="ivp-small">Bank details to follow.</p>
        )}
      </section>

      <footer className="ivp-foot">
        {f.footer && <p>{f.footer}</p>}
        <p>{[f.company_number && `KvK ${f.company_number}`, f.vat_number && `VAT ${f.vat_number}`].filter(Boolean).join(" · ")}</p>
      </footer>
    </article>
  );
}
