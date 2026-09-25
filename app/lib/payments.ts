import { accountState, stripeConfigured, stripeTestMode } from "./stripe";
import { getCoachPayments, logCoachActivity, markInvoicePaidOnline, setCoachPayments } from "./queries";
import { sendPushInBackground } from "./push";
import { getData } from "./db";

// Online payments as the app sees them: whether they are on at all (the
// platform's keys), where a coach's Stripe account stands, and what happens
// when Stripe says an invoice was paid. The Stripe calls themselves are in
// lib/stripe.ts; this is the part that knows about coaches and invoices.

/** "off": no keys on the server. "none": the coach hasn't started. "pending": started, Stripe still needs things. "active": clients can pay. */
export type PaymentsState = { status: "off" | "none" | "pending" | "active"; testMode: boolean };

export function paymentsState(coachId: number): PaymentsState {
  if (!stripeConfigured()) return { status: "off", testMode: false };
  const p = getCoachPayments(coachId);
  return { status: !p.stripe_account_id ? "none" : p.stripe_status === "active" ? "active" : "pending", testMode: stripeTestMode() };
}

/** Asks Stripe where the coach's account stands (after onboarding, or while it is pending). */
export async function refreshCoachStripe(coachId: number): Promise<PaymentsState> {
  const p = getCoachPayments(coachId);
  if (stripeConfigured() && p.stripe_account_id) {
    try {
      const a = await accountState(p.stripe_account_id);
      const status = a.chargesEnabled ? "active" : "pending";
      if (status !== p.stripe_status) setCoachPayments(coachId, { stripe_status: status });
    } catch {
      // Stripe unreachable: keep what we knew.
    }
  }
  return paymentsState(coachId);
}

export function canPayOnline(coachId: number | null): boolean {
  return coachId != null && paymentsState(coachId).status === "active";
}

/** Stripe told us (webhook) that a checkout for an invoice went through. */
export function invoicePaidByStripe(invoiceId: number, sessionId: string, account: string | undefined) {
  const inv = markInvoicePaidOnline(invoiceId, sessionId, account);
  if (!inv) return;
  const name = inv.number ?? "your invoice";
  logCoachActivity(inv.client_id, `Received your payment for ${name}`, { kind: "general", actionTab: "invoices", actionLabel: "See your invoices", dedupeKey: `invoice-paid-online:${invoiceId}` });
  // The coach hears on their devices, when they have notifications on.
  const coachId = inv.coach_id;
  const client = getData().clients.find((c) => c.id === inv.client_id);
  if (coachId != null) sendPushInBackground(coachId, { title: "Invoice paid", body: `${client?.name ?? "A client"} paid ${name}`, url: `/admin/redesign/invoices?client=${inv.client_id}`, tag: `invoice-paid:${invoiceId}` });
}

/** Stripe told us an account changed (account.updated): keep its status current. */
export function stripeAccountUpdated(account: string, chargesEnabled: boolean) {
  const coach = getData().users.find((u) => u.role === "coach" && u.coach_settings?.payments?.stripe_account_id === account);
  if (!coach) return;
  const status = chargesEnabled ? "active" : "pending";
  if (coach.coach_settings?.payments?.stripe_status !== status) setCoachPayments(coach.id, { stripe_status: status });
}
