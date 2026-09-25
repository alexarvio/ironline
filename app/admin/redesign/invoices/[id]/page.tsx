import Link from "next/link";
import { notFound } from "next/navigation";
import { coachForClient } from "../../../../lib/auth";
import { clientIdForInvoice } from "../../../../lib/tenancy";
import { getInvoiceView } from "../../../../lib/queries";
import PrintButton from "./PrintButton";
import "./invoice-print.css";

// One invoice as it prints: an A4 sheet with who it is from (Business
// details), who it is for, the lines with VAT, and how to pay (the bank from
// Invoicing). While it is "Not sent" it reads Settings live; once sent, the
// details frozen onto it. Coach only; opened from the client's Invoices tab.
//   /admin/redesign/invoices/12
export const dynamic = "force-dynamic";

const money = (n: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n || 0);
const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const spacedIban = (s?: string) => (s ?? "").replace(/(.{4})/g, "$1 ").trim();

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId) || !(await coachForClient(clientIdForInvoice(invoiceId)))) notFound();
  const v = getInvoiceView(invoiceId);
  if (!v) notFound();
  const f = v.from;
  const seller = f.business_name || f.legal_name || "Your business name";
  const place = [f.postcode, f.city].filter(Boolean).join(" ");
  const missing = [!f.business_name && "business name", !(f.address && f.city) && "address", !f.iban && "IBAN"].filter(Boolean) as string[];

  return (
    <main className="ivp">
      <div className="ivp-bar">
        <Link href={`/admin/redesign/invoices?client=${v.clientId}`} className="ivp-btn">
          ‹ Invoices
        </Link>
        <span className="ivp-state">{v.frozen ? "Sent: the details below are fixed" : "Not sent: your details come from Settings as they are now"}</span>
        <PrintButton />
      </div>
      {missing.length > 0 && !v.frozen && (
        <p className="ivp-missing">
          Missing from Settings: {missing.join(", ")}. <Link href="/admin/redesign/settings/business">Business details</Link> · <Link href="/admin/redesign/settings/invoicing">Invoicing</Link>
        </p>
      )}

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
          <small>How to pay</small>
          {f.iban ? (
            <p>
              Please transfer <b>{money(v.total, v.currency)}</b>
              {v.dueDate ? ` by ${longDate(v.dueDate)}` : ""} to <b>{spacedIban(f.iban)}</b>
              {f.bic ? ` (BIC ${f.bic})` : ""} in the name of {f.account_holder || f.legal_name || seller}, quoting <b>{v.number}</b>.
            </p>
          ) : (
            <p className="ivp-small">Bank details to be added in Settings → Invoicing.</p>
          )}
        </section>

        <footer className="ivp-foot">
          {f.footer && <p>{f.footer}</p>}
          <p>{[f.company_number && `KvK ${f.company_number}`, f.vat_number && `VAT ${f.vat_number}`].filter(Boolean).join(" · ")}</p>
        </footer>
      </article>
    </main>
  );
}
