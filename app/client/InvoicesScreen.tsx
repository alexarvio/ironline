"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";

// The client's invoices from their coach: the ones still to pay first, then
// the paid ones. A row opens the invoice itself, to read, print or save as
// PDF. Pushed over the tabs from the menu, or from the notification that one
// has arrived. Plain props, built in page.tsx.

export type ClientInvoiceRow = {
  id: number;
  number: string;
  dayNumber: string;
  monthCap: string;
  /** What it is for: the first line, "+ 1 more" when there are more. */
  what: string;
  total: string;
  state: "pay" | "late" | "paid";
  /** "Due 9 Oct", "Overdue since 9 Oct", "Paid". */
  stateLabel: string;
};
export type InvoicesProps = { invoices: ClientInvoiceRow[] };

export default function InvoicesScreen({ invoices, onBack }: InvoicesProps & { onBack: () => void }) {
  const open = invoices.filter((i) => i.state !== "paid");
  const paid = invoices.filter((i) => i.state === "paid");
  const list = (rows: ClientInvoiceRow[]) => (
    <ul className="mts-list">
      {rows.map((i) => (
        <li key={i.id}>
          <Link href={`/client/invoices/${i.id}`} className="mts-row inv-row">
            <span className="mts-leaf" aria-hidden="true">
              <b>{i.dayNumber}</b>
              <small>{i.monthCap}</small>
            </span>
            <span className="mts-row-text">
              <span className="mts-row-title">{i.what}</span>
              <span className="mts-row-sub">
                {i.number} · <span className={`inv-state ${i.state}`}>{i.stateLabel}</span>
              </span>
            </span>
            <span className="inv-total">{i.total}</span>
            <span className="inv-chev" aria-hidden="true">
              <ChevronRightIcon />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <header className="cn-header">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">Invoices</h1>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>
      <main className="cn-body">
        <div className="mts-scroll">
          <section className="mts-section" aria-label="To pay">
            <div className="mts-head">To pay</div>
            {open.length > 0 ? list(open) : <p className="mts-empty">Nothing to pay right now.</p>}
          </section>
          {paid.length > 0 && (
            <section className="mts-section" aria-label="Paid">
              <div className="mts-head">Paid</div>
              {list(paid)}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
