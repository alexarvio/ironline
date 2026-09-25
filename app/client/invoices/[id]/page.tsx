import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClient } from "../../../lib/auth";
import { getInvoiceView, listClientInvoices } from "../../../lib/queries";
import InvoiceSheet from "../../../components/InvoiceSheet";
import InvoicePrintButton from "../../../components/InvoicePrintButton";

// One of the client's invoices, the sheet the coach sees, to read, print or
// save as PDF. Only their own, and only once the coach has sent it.
// Opened from the Invoices screen in the menu.
//   /client/invoices/12
export const dynamic = "force-dynamic";

export default async function ClientInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { clientId } = await requireClient();
  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId) || !listClientInvoices(clientId).some((i) => i.id === invoiceId)) notFound();
  const v = getInvoiceView(invoiceId);
  if (!v) notFound();
  return (
    <main className="ivp">
      <div className="ivp-bar">
        <Link href="/client" className="ivp-btn">
          ‹ Back
        </Link>
        <span className="ivp-state" />
        <InvoicePrintButton />
      </div>
      <InvoiceSheet v={v} />
    </main>
  );
}
