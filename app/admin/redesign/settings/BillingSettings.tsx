"use client";

import { useState, useTransition } from "react";
import { openBillingPortalAction } from "../../../lib/billingActions";
import type { BillingView } from "../../../lib/billing";
import { dayMonth } from "../../../lib/dayMonth";
import { Section } from "./SettingsForms";

// Settings, Billing (28 Oct, Alex; lib/billing.ts): what the coach pays NorCoach. One card: NorCoach with Monthly or
// Yearly after it and the state as its pill (Trial ink, Active green, Payment failed rust, Read-only red, Cancelled and
// Free grey), the date that matters under it (the trial's end, the next charge, the plan's end, read-only from);
// Manage billing, a white pill, opens Stripe's own page for the card, the plan, receipts and cancelling.

export default function BillingSettings({ view }: { view: BillingView }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const manage = () =>
    start(async () => {
      const r = await openBillingPortalAction();
      if (r.url) window.location.href = r.url;
      else setError(r.error ?? "Stripe did not answer. Try again.");
    });
  const pill = view.pill;
  // The one date that matters now.
  const when =
    view.access.state === "grace" && view.access.until
      ? `Read-only from ${dayMonth(view.access.until)}`
      : view.status === "trialing" && view.trialEnd
        ? `Trial ends ${dayMonth(view.trialEnd)}`
        : view.status === "active" && view.periodEnd
          ? `${view.cancelAtPeriodEnd ? "Ends" : "Renews"} ${dayMonth(view.periodEnd)}`
          : null;
  return (
    <Section
      title="NorCoach"
      actions={
        <>
          {/* No live plan (never, or one that ended): Subscribe; Stripe's page can't start a new one. */}
          {view.canSubscribe && (
            <a className="trn-pill rst-pill" href="/auth/subscribe">
              Subscribe
            </a>
          )}
          {view.hasCustomer && (
            <button type="button" className="trn-pill rst-pill" onClick={manage} disabled={busy}>
              {busy ? "Opening Stripe…" : "Manage billing"}
            </button>
          )}
        </>
      }
    >
      <div className="rls-card rst-card">
        <div className="rst-rows">
          <div className="rst-row">
            <span className="rst-row-main">
              <b>{view.status === "free" ? "NorCoach" : view.interval === "year" ? "Yearly" : "Monthly"}</b>
              {when && <small>{when}</small>}
            </span>
            <span className={`trn-state${pill.tone ? ` ${pill.tone}` : ""}`}>{pill.word}</span>
          </div>
        </div>
      </div>
      {error && <small className="rst-err">{error}</small>}
    </Section>
  );
}
