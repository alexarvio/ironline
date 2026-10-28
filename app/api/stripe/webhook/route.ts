import { NextResponse } from "next/server";
import { readSubscription, verifyWebhook, type StripeSubscription } from "../../../lib/stripe";
import { invoicePaidByStripe, stripeAccountUpdated } from "../../../lib/payments";
import { applySubscription, coachForBilling, keepCustomer } from "../../../lib/billing";

// Stripe's side of payments (lib/stripe.ts). Two endpoints can point here, each with its own signing secret:
//   the coaches' accounts (Connect, STRIPE_WEBHOOK_SECRET), events with `account` set:
//     checkout.session.completed / .async_payment_succeeded  an invoice was paid
//     account.updated                                         a coach's account can (or no longer can) take payments
//   the platform's own (STRIPE_BILLING_WEBHOOK_SECRET, 28 Oct), what coaches pay NorCoach (lib/billing.ts):
//     checkout.session.completed (mode subscription)          a coach subscribed
//     customer.subscription.created / .updated / .deleted     its state: trial, paid, failed, cancelled
// Only a signed body is read; no session (the proxy lets this path through).
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const event = verifyWebhook(body, request.headers.get("stripe-signature"));
  if (!event) return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  const o = event.data.object;

  if (!event.account && event.type === "checkout.session.completed" && o.mode === "subscription") {
    const coachId = coachForBilling(o.metadata as Record<string, string> | undefined, o.customer as string | null);
    if (coachId != null) keepCustomer(coachId, (o.customer as string | null) ?? null);
  } else if (!event.account && event.type.startsWith("customer.subscription.")) {
    // Stripe's state now, not the event's copy: events come out of order and retried for days (28 Oct, review).
    const sent = o as unknown as StripeSubscription;
    const coachId = coachForBilling(sent.metadata, sent.customer);
    if (coachId != null) applySubscription(coachId, await readSubscription(sent.id).catch(() => sent));
  } else if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    // iDEAL and cards are paid at once; bank debits arrive later, as async_payment_succeeded.
    const invoiceId = Number((o.metadata as Record<string, string> | undefined)?.invoice_id);
    if (o.payment_status === "paid" && Number.isInteger(invoiceId)) invoicePaidByStripe(invoiceId, String(o.id), event.account);
  } else if (event.type === "account.updated" && event.account) {
    stripeAccountUpdated(event.account, !!o.charges_enabled);
  }
  return NextResponse.json({ received: true });
}
