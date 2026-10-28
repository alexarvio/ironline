import { getData, persist, type CoachBilling } from "./db";
import { stripeConfigured, type StripeSubscription } from "./stripe";

// What coaches pay NorCoach (28 Oct, Alex): a subscription on the platform's own Stripe account, monthly or yearly,
// money into NorCoach's account (the coaches' own clients pay the coaches through Connect; lib/payments.ts). Settled:
//   - a 14-day trial, the card asked for upfront, one trial a coach;
//   - asked after the owner lets a coach in: the admin waits on /auth/subscribe until they have subscribed;
//   - a payment that fails, or a cancelled plan, leaves a week as it was (a warning in the rail), then read-only: every
//     screen still reads, nothing is changed (actions refuse; chat with clients and billing stay open); nothing is
//     deleted and the clients' app keeps working.
// Who pays: a coach the owner let in after this (approveCoach sets `required`), or one the owner asks on Coaches. The
// owner never; the coaches from before only once asked. Off altogether until the server has the keys and both prices
// (STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY): then everyone has everything.

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
const DAY = 86_400_000;

export type BillingInterval = "month" | "year";

export function billingOn(): boolean {
  return stripeConfigured() && !!priceFor("month") && !!priceFor("year");
}

export function priceFor(interval: BillingInterval): string | null {
  return (interval === "year" ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY)?.trim() || null;
}

const coachRow = (coachId: number) => getData().users.find((u) => u.id === coachId && u.role === "coach");

export function getBilling(coachId: number): CoachBilling {
  return coachRow(coachId)?.coach_settings?.billing ?? {};
}

function setBilling(coachId: number, patch: Partial<CoachBilling>) {
  const user = coachRow(coachId);
  if (!user) return;
  user.coach_settings = { ...(user.coach_settings ?? {}), billing: { ...(user.coach_settings?.billing ?? {}), ...patch } };
  persist();
}

/** Paid up (or in its trial) by Stripe's word. */
const paying = (s: CoachBilling["status"]) => s === "trialing" || s === "active";

/** Has no live subscription: never had one, left one unfinished, or one that ended (cancelled, or unpaid to the end).
 *  The subscribe screen is theirs; a failed payment still running (past_due) is fixed on Stripe's billing page. */
export function canSubscribe(b: CoachBilling): boolean {
  return !!b.required && !paying(b.status) && b.status !== "past_due";
}

/**
 * What the coach may do now:
 *   "full"      everything (free, paying, or billing off)
 *   "subscribe" let in but not subscribed yet: only the subscribe screen
 *   "grace"     unpaid for under a week: everything, with the warning
 *   "readonly"  unpaid for a week or more: read, no changes
 */
export type BillingAccess = { state: "full" | "subscribe" | "grace" | "readonly"; /** grace: read-only from (ISO). */ until?: string };

export function billingAccess(coachId: number, owner: boolean): BillingAccess {
  if (owner || !billingOn()) return { state: "full" };
  const b = getBilling(coachId);
  if (!b.required || paying(b.status)) return { state: "full" };
  // Never subscribed (or a checkout left unfinished).
  if (!b.subscription || b.status === "needed" || b.status === "incomplete" || b.status === "incomplete_expired") return { state: "subscribe" };
  const since = b.lapsed_at ? new Date(b.lapsed_at).getTime() : Date.now();
  const until = since + GRACE_DAYS * DAY;
  return Date.now() < until ? { state: "grace", until: new Date(until).toISOString() } : { state: "readonly" };
}

/** The owner lets a coach in (auth.ts approveCoach), or asks a coach from before on Coaches: from now on they pay. */
export function requireBilling(coachId: number, required: boolean) {
  const b = getBilling(coachId);
  setBilling(coachId, { required, ...(required && !b.status ? { status: "needed" as const } : {}) });
}

/** The coach a Stripe customer or subscription belongs to: by the metadata we gave it, else the customer we kept. */
export function coachForBilling(metadata: Record<string, string> | undefined, customer: string | null | undefined): number | null {
  const id = Number(metadata?.coach_id);
  if (Number.isInteger(id) && coachRow(id)) return id;
  if (!customer) return null;
  return getData().users.find((u) => u.role === "coach" && u.coach_settings?.billing?.customer === customer)?.id ?? null;
}

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

/** Stripe's word on a coach's subscription (the webhook, or the way back from checkout): kept as it says. */
export function applySubscription(coachId: number, sub: StripeSubscription) {
  const was = getBilling(coachId);
  const status = (["trialing", "active", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "paused"] as const).find((s) => s === sub.status) ?? "incomplete";
  const item = sub.items?.data?.[0];
  const interval = item?.price?.recurring?.interval === "year" ? "year" : "month";
  // An older subscription's word arriving after a newer one's is left out.
  if (was.subscription && was.subscription !== sub.id && paying(was.status) && !paying(status)) return;
  const lapsed = paying(status) ? null : paying(was.status) || !was.lapsed_at ? new Date().toISOString() : was.lapsed_at;
  setBilling(coachId, {
    required: was.required ?? true,
    status,
    customer: sub.customer,
    subscription: sub.id,
    interval,
    trial_end: iso(sub.trial_end),
    period_end: iso(item?.current_period_end ?? sub.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    lapsed_at: lapsed,
    trial_used: was.trial_used || status === "trialing" || !!sub.trial_end,
  });
}

/** The checkout a coach was last sent to, so a new one closes it (no two subscriptions from two tabs). */
export function keepCheckout(coachId: number, id: string | null) {
  setBilling(coachId, { checkout: id });
}

/** Stripe has had this customer in a trial before: one trial a coach. */
export function markTrialUsed(coachId: number) {
  if (!getBilling(coachId).trial_used) setBilling(coachId, { trial_used: true });
}

/** The way back from checkout: the customer kept even before the subscription's word comes. */
export function keepCustomer(coachId: number, customer: string | null) {
  if (customer && getBilling(coachId).customer !== customer) setBilling(coachId, { customer });
}

/** The Settings section and the Coaches page: the plan in a few words. */
export type BillingView = {
  on: boolean;
  required: boolean;
  status: CoachBilling["status"] | "free";
  interval: BillingInterval | null;
  trialEnd: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
  access: BillingAccess;
  /** No live subscription: Subscribe, not only Manage billing (a cancelled plan can't be brought back on Stripe's page). */
  canSubscribe: boolean;
  /** The state as its pill (a trn-state tone): Trial ink, Active green, Payment failed rust, Read-only red, the rest grey. */
  pill: { word: string; tone: "" | "live" | "good" | "warn" | "bad" };
};

const PILL: Record<string, BillingView["pill"]> = {
  trialing: { word: "Trial", tone: "live" },
  active: { word: "Active", tone: "good" },
  past_due: { word: "Payment failed", tone: "warn" },
  unpaid: { word: "Payment failed", tone: "warn" },
  paused: { word: "Paused", tone: "" },
  canceled: { word: "Cancelled", tone: "" },
  free: { word: "Free", tone: "" },
};

export function billingView(coachId: number, owner: boolean): BillingView {
  const b = getBilling(coachId);
  const status = !b.required || owner ? "free" : (b.status ?? "needed");
  const access = billingAccess(coachId, owner);
  return {
    on: billingOn(),
    required: !!b.required,
    pill: access.state === "readonly" ? { word: "Read-only", tone: "bad" } : (PILL[status] ?? { word: "Not started", tone: "" }),
    status,
    interval: b.interval ?? null,
    trialEnd: b.trial_end ?? null,
    periodEnd: b.period_end ?? null,
    cancelAtPeriodEnd: !!b.cancel_at_period_end,
    hasCustomer: !!b.customer,
    canSubscribe: !owner && canSubscribe(b),
    access,
  };
}
