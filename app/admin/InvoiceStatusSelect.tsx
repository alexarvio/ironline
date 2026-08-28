"use client";

import { setInvoiceStatusAction } from "../lib/actions";

const STATUS_OPTIONS = ["unpaid", "sent", "paid", "due"] as const;

export default function InvoiceStatusSelect({
  invoiceId,
  status,
}: {
  invoiceId: number;
  status: (typeof STATUS_OPTIONS)[number];
}) {
  return (
    <form action={setInvoiceStatusAction} className="invoice-status-form">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <select
        name="status"
        defaultValue={status}
        className={`status-select status-${status}`}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </form>
  );
}
