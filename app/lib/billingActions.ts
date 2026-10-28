"use server";

import { revalidatePath } from "next/cache";
import { requireCoachAccount, requireOwner } from "./auth";
import { applySubscription, billingOn, canSubscribe, getBilling, keepCheckout, markTrialUsed, priceFor, requireBilling, TRIAL_DAYS, type BillingInterval } from "./billing";
import { billingPortal, cancelSubscription, customerSubscriptions, expireCheckout, subscriptionCheckout } from "./stripe";
import { appUrl } from "./passwordReset";

// What coaches pay NorCoach (28 Oct, Alex; lib/billing.ts). These open when nothing else does (requireCoachAccount):
// a coach who has to subscribe, or whose plan lapsed, can always reach Stripe.

/** The subscribe screen's Continue: Stripe's checkout for the plan picked, the trial with it when not had before.
 *  Never a second live subscription: one already on Stripe is taken up instead, and an earlier open checkout closed. */
export async function startSubscriptionAction(interval: BillingInterval): Promise<{ url?: string; error?: string }> {
  const coach = await requireCoachAccount();
  if (!billingOn()) return { error: "Subscriptions are not switched on yet." };
  const price = priceFor(interval === "year" ? "year" : "month");
  const base = appUrl();
  if (!price || !base) return { error: "Subscriptions are not set up on this server." };
  const b = getBilling(coach.id);
  if (!canSubscribe(b)) return { url: `${base}/admin/redesign` };
  try {
    // Stripe's own word on this customer: a live one (from another tab, or a webhook not here yet) is theirs already.
    if (b.customer) {
      const subs = await customerSubscriptions(b.customer);
      const live = subs.find((s) => s.status === "trialing" || s.status === "active" || s.status === "past_due");
      if (live) {
        applySubscription(coach.id, live);
        return { url: `${base}/admin/redesign` };
      }
      if (subs.some((s) => s.trial_end)) markTrialUsed(coach.id);
    }
    if (b.checkout) await expireCheckout(b.checkout).catch(() => {});
    const s = await subscriptionCheckout({
      price,
      coachId: coach.id,
      email: coach.email,
      customer: b.customer,
      trialDays: getBilling(coach.id).trial_used ? 0 : TRIAL_DAYS,
      successUrl: `${base}/auth/subscribe?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/auth/subscribe`,
    });
    keepCheckout(coach.id, s.id);
    return { url: s.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Stripe did not answer. Try again." };
  }
}

/** Settings, Billing (and the rail's warning): Stripe's own page for the card, the plan, receipts and cancelling. */
export async function openBillingPortalAction(): Promise<{ url?: string; error?: string }> {
  const coach = await requireCoachAccount();
  const b = getBilling(coach.id);
  const base = appUrl();
  if (!b.customer) return { error: "No subscription yet." };
  if (!base) return { error: "The app does not know its own address (APP_URL)." };
  try {
    return { url: await billingPortal(b.customer, `${base}/admin/redesign/settings#billing`) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Stripe did not answer. Try again." };
  }
}

/** The owner on Coaches: this coach pays NorCoach from now on, or uses it free. Free ends a live subscription on
 *  Stripe too, so nothing is charged for a plan that says Free. */
export async function setCoachPaysAction(coachId: number, pays: boolean): Promise<{ ok: boolean; error?: string }> {
  await requireOwner();
  const id = Number(coachId);
  const b = getBilling(id);
  if (!pays && b.subscription && (b.status === "trialing" || b.status === "active" || b.status === "past_due")) {
    try {
      await cancelSubscription(b.subscription);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Stripe did not answer. Try again." };
    }
  }
  requireBilling(id, !!pays);
  revalidatePath("/admin/redesign/coaches");
  return { ok: true };
}
