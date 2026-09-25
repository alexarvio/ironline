"use client";

import { useState, useTransition } from "react";
import { payInvoiceAction } from "../../../lib/actions";

// Pay an invoice online: off to Stripe's checkout on the coach's account,
// back to this page once paid (or cancelled).
export default function PayButton({ invoiceId, label }: { invoiceId: number; label: string }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="ivp-pay-wrap">
      <button
        type="button"
        className="ivp-btn primary ivp-pay-btn"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await payInvoiceAction(invoiceId);
            if (r.url) window.location.href = r.url;
            else setError(r.error ?? "That didn't work. Try again.");
          })
        }
      >
        {busy ? "Opening…" : label}
      </button>
      {error && <small className="ivp-pay-error">{error}</small>}
    </span>
  );
}
