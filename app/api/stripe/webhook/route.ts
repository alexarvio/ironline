import { NextResponse } from "next/server";
import { verifyWebhook } from "../../../lib/stripe";
import { invoicePaidByStripe, stripeAccountUpdated } from "../../../lib/payments";

// Stripe's side of online payments (lib/stripe.ts): a Connect webhook, so
// events come from the coaches' own accounts with `account` set. Only a
// body signed with STRIPE_WEBHOOK_SECRET is read; no session (the proxy
// lets this path through).
//   checkout.session.completed / .async_payment_succeeded  an invoice was paid
//   account.updated                                         a coach's account can (or no longer can) take payments
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const event = verifyWebhook(body, request.headers.get("stripe-signature"));
  if (!event) return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  const o = event.data.object;

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    // iDEAL and cards are paid at once; bank debits arrive later, as async_payment_succeeded.
    const invoiceId = Number((o.metadata as Record<string, string> | undefined)?.invoice_id);
    if (o.payment_status === "paid" && Number.isInteger(invoiceId)) invoicePaidByStripe(invoiceId, String(o.id), event.account);
  } else if (event.type === "account.updated" && event.account) {
    stripeAccountUpdated(event.account, !!o.charges_enabled);
  }
  return NextResponse.json({ received: true });
}
