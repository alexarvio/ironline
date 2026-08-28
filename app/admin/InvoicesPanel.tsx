import { addInvoiceAction } from "../lib/actions";
import { listInvoices } from "../lib/queries";
import InvoiceStatusSelect from "./InvoiceStatusSelect";

const STATUS_OPTIONS = ["unpaid", "sent", "paid", "due"] as const;

export default function InvoicesPanel({ clientId }: { clientId: number }) {
  const invoices = listInvoices(clientId);

  return (
    <div>
      <div className="nutrition-table-wrap builder-card">
        <h3 className="builder-pill-heading">Add an invoice</h3>
        <form action={addInvoiceAction} className="add-invoice-form add-metric-form">
          <input type="hidden" name="clientId" value={clientId} />
          <input name="description" type="text" placeholder="Description (e.g. October coaching)" required />
          <input name="amount" type="number" step="0.01" placeholder="Amount" required />
          <select name="status" defaultValue="unpaid">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            Add invoice
          </button>
        </form>
      </div>

      {invoices.length === 0 ? (
        <p className="empty-note">No invoices for this client yet.</p>
      ) : (
        <div className="invoice-list">
          {invoices.map((inv) => (
            <div key={inv.id} className="invoice-row">
              <div>
                <div className="invoice-desc">{inv.description}</div>
                <div className="exercise-meta">{inv.created_at.slice(0, 10)}</div>
              </div>
              <div className="invoice-amount">${inv.amount.toFixed(2)}</div>
              <InvoiceStatusSelect invoiceId={inv.id} status={inv.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
