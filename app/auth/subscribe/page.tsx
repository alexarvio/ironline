import { redirect } from "next/navigation";
import { isOwner, requireCoachAccount } from "../../lib/auth";
import { applySubscription, billingAccess, billingOn, canSubscribe, getBilling, keepCheckout, keepCustomer, priceFor, TRIAL_DAYS } from "../../lib/billing";
import { readCheckout, readPrice } from "../../lib/stripe";
import SubscribeScreen from "./SubscribeScreen";

// A coach the owner let in, before the admin opens (28 Oct, Alex; lib/billing.ts): pick monthly or yearly, then
// Stripe's checkout, the trial and the card with it. Stripe sends them back here with the checkout's id; it is read
// at once (the webhook may come later), and on they go. Anyone with nothing to pay goes straight in.
export const dynamic = "force-dynamic";

export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const coach = await requireCoachAccount();
  const { session_id } = await searchParams;
  if (session_id && billingOn()) {
    try {
      const done = await readCheckout(session_id);
      if (done.metadata?.coach_id === String(coach.id)) {
        keepCustomer(coach.id, done.customer);
        keepCheckout(coach.id, null);
        if (done.subscription) applySubscription(coach.id, done.subscription);
      }
    } catch {
      // Stripe unreachable: the webhook brings it.
    }
  }
  // Theirs while there is no live plan: never had one, or one that ended (a cancelled plan comes back here, not on
  // Stripe's page, which can't start a new one).
  if (isOwner(coach) || !billingOn() || (billingAccess(coach.id, false).state !== "subscribe" && !canSubscribe(getBilling(coach.id)))) redirect("/admin/redesign");

  const [month, year] = await Promise.all([readPrice(priceFor("month") ?? ""), readPrice(priceFor("year") ?? "")]);
  const trial = getBilling(coach.id).trial_used ? 0 : TRIAL_DAYS;
  return <SubscribeScreen month={month} year={year} trialDays={trial} />;
}
