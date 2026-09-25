import Link from "next/link";
import { notFound } from "next/navigation";
import { coachForClient } from "../../../../lib/auth";
import { clientIdForInvoice } from "../../../../lib/tenancy";
import { getInvoiceView } from "../../../../lib/queries";
import InvoiceSheet from "../../../../components/InvoiceSheet";
import InvoicePrintButton from "../../../../components/InvoicePrintButton";
import { countryCodeFromName, countryOf, hasBankDetails } from "../../../../lib/countries";

// One invoice as it prints, for the coach: the sheet (components/InvoiceSheet)
// with a bar above it. While it is "Not sent" it reads Settings live and
// says what Settings still lacks; once sent, the details frozen onto it.
// Opened from the client's Invoices tab.
//   /admin/redesign/invoices/12
export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId) || !(await coachForClient(clientIdForInvoice(invoiceId)))) notFound();
  const v = getInvoiceView(invoiceId);
  if (!v) notFound();
  const f = v.from;
  const missing = [!f.business_name && "business name", !(f.address && f.city) && "address", !hasBankDetails(f, countryOf(f.country_code || countryCodeFromName(f.country))) && "bank details"].filter(Boolean) as string[];

  return (
    <main className="ivp">
      <div className="ivp-bar">
        <Link href={`/admin/redesign/invoices?client=${v.clientId}`} className="ivp-btn">
          ‹ Invoices
        </Link>
        <span className="ivp-state">{v.frozen ? "Sent: the details below are fixed" : "Not sent: your details come from Settings as they are now, and the client can't see it yet"}</span>
        <InvoicePrintButton />
      </div>
      {missing.length > 0 && !v.frozen && (
        <p className="ivp-missing">
          Missing from Settings: {missing.join(", ")}. <Link href="/admin/redesign/settings/business">Business details</Link> · <Link href="/admin/redesign/settings/invoicing">Invoicing</Link>
        </p>
      )}
      <InvoiceSheet v={v} />
    </main>
  );
}
