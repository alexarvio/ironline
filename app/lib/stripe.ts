import crypto from "crypto";

// Online payments through Stripe Connect. Each coach connects their own
// Stripe account (a Standard account: theirs, with their own dashboard,
// fees and payouts; Stripe checks who they are, not us). An invoice the
// coach has sent gets a Pay button for the client, which opens Stripe's
// checkout on the coach's account with whatever payment methods the coach
// has on there (iDEAL, cards, Bancontact, PayPal, Apple Pay…). Stripe then
// tells /api/stripe/webhook, and the invoice marks itself paid.
//
// Off until the platform's keys are set on the server:
//   STRIPE_SECRET_KEY      the platform account's secret key (sk_test_… to try it)
//   STRIPE_WEBHOOK_SECRET  the signing secret of a Connect webhook endpoint at
//                          /api/stripe/webhook, listening for checkout.session.completed,
//                          checkout.session.async_payment_succeeded and account.updated
// No SDK: the handful of calls below go straight to the REST API.

const API = "https://api.stripe.com/v1";

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY?.trim();
}

/** Test keys: say so wherever money would move. */
export function stripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").trim().startsWith("sk_test_");
}

type Params = Record<string, unknown>;

// Stripe takes form encoding with nested keys: metadata[invoice_id]=12, line_items[0][quantity]=1.
function encode(params: Params, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" && item ? out.push(...encode(item as Params, `${key}[${i}]`)) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`)));
    else if (typeof v === "object") out.push(...encode(v as Params, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, params: Params = {}, account?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe isn't set up on this server.");
  const body = encode(params).join("&");
  const res = await fetch(`${API}${path}${method === "GET" && body ? `?${body}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(account ? { "Stripe-Account": account } : {}),
    },
    body: method === "GET" ? undefined : body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `Stripe answered ${res.status}`);
  return json;
}

export type StripeAccountState = { id: string; chargesEnabled: boolean; detailsSubmitted: boolean };

/** A new Standard account for a coach, in their country when we know it. */
export async function createCoachAccount(email: string, country: string | null): Promise<string> {
  const acct = await call<{ id: string }>("POST", "/accounts", { type: "standard", email, ...(country ? { country } : {}) });
  return acct.id;
}

/** Stripe's own onboarding for that account: where the coach goes to finish setting it up. */
export async function onboardingLink(account: string, returnUrl: string, refreshUrl: string): Promise<string> {
  const link = await call<{ url: string }>("POST", "/account_links", { account, return_url: returnUrl, refresh_url: refreshUrl, type: "account_onboarding" });
  return link.url;
}

export async function accountState(account: string): Promise<StripeAccountState> {
  const a = await call<{ id: string; charges_enabled?: boolean; details_submitted?: boolean }>("GET", `/accounts/${encodeURIComponent(account)}`);
  return { id: a.id, chargesEnabled: !!a.charges_enabled, detailsSubmitted: !!a.details_submitted };
}

// Amounts go to Stripe in the currency's smallest unit; a few currencies have none.
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
export function minorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

/** A checkout for one invoice, on the coach's account; answers with the page to send the client to. */
export async function invoiceCheckout(account: string, v: { invoiceId: number; number: string; amount: number; currency: string; seller: string; email?: string; successUrl: string; cancelUrl: string }): Promise<{ id: string; url: string }> {
  const s = await call<{ id: string; url: string }>(
    "POST",
    "/checkout/sessions",
    {
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: v.currency.toLowerCase(), unit_amount: minorUnits(v.amount, v.currency), product_data: { name: `Invoice ${v.number}`, description: v.seller } } }],
      customer_email: v.email,
      client_reference_id: String(v.invoiceId),
      metadata: { invoice_id: String(v.invoiceId), invoice_number: v.number },
      payment_intent_data: { metadata: { invoice_id: String(v.invoiceId), invoice_number: v.number }, description: `Invoice ${v.number}` },
      success_url: v.successUrl,
      cancel_url: v.cancelUrl,
    },
    account,
  );
  return { id: s.id, url: s.url };
}

// ---- What coaches pay NorCoach (28 Oct, Alex; lib/billing.ts): a subscription on the platform's own account, so
// these calls carry no Stripe-Account. The prices live in Stripe (STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY), so a new
// price needs no deploy.

/** A Stripe subscription as the app reads it; current_period_end moved onto its items in newer API versions. */
export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  trial_end?: number | null;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
  items?: { data?: { current_period_end?: number; price?: { recurring?: { interval?: string } } }[] };
};

/** A coach's checkout for NorCoach: the price, a trial when they have not had one, the card asked for upfront. */
export async function subscriptionCheckout(v: { price: string; coachId: number; email: string; customer?: string; trialDays: number; successUrl: string; cancelUrl: string }): Promise<{ id: string; url: string }> {
  const meta = { coach_id: String(v.coachId) };
  const s = await call<{ id: string; url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    line_items: [{ price: v.price, quantity: 1 }],
    ...(v.customer ? { customer: v.customer } : { customer_email: v.email }),
    client_reference_id: String(v.coachId),
    metadata: meta,
    subscription_data: { metadata: meta, ...(v.trialDays > 0 ? { trial_period_days: v.trialDays } : {}) },
    payment_method_collection: "always",
    allow_promotion_codes: true,
    success_url: v.successUrl,
    cancel_url: v.cancelUrl,
  });
  return { id: s.id, url: s.url };
}

/** A finished checkout, with its subscription: read on the way back, so the coach is in before the webhook lands. */
export async function readCheckout(id: string): Promise<{ customer: string | null; metadata?: Record<string, string>; subscription: StripeSubscription | null }> {
  const s = await call<{ customer?: string | null; metadata?: Record<string, string>; subscription?: StripeSubscription | string | null }>("GET", `/checkout/sessions/${encodeURIComponent(id)}`, { expand: ["subscription"] });
  return { customer: s.customer ?? null, metadata: s.metadata, subscription: s.subscription && typeof s.subscription === "object" ? s.subscription : null };
}

/** A subscription as Stripe has it now: the webhook applies this, never the event's copy, which can arrive late. */
export async function readSubscription(id: string): Promise<StripeSubscription> {
  return call<StripeSubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`);
}

/** The customer's subscriptions, any state: one already live is never doubled, and one trial a customer. */
export async function customerSubscriptions(customer: string): Promise<StripeSubscription[]> {
  const r = await call<{ data: StripeSubscription[] }>("GET", "/subscriptions", { customer, status: "all", limit: 20 });
  return r.data ?? [];
}

/** Ends a subscription now (the owner made the coach free). */
export async function cancelSubscription(id: string): Promise<void> {
  await call("DELETE", `/subscriptions/${encodeURIComponent(id)}`);
}

/** Closes a checkout left open, so an earlier tab can't start a second subscription. */
export async function expireCheckout(id: string): Promise<void> {
  await call("POST", `/checkout/sessions/${encodeURIComponent(id)}/expire`);
}

/** Stripe's own billing page for the coach: card, plan, receipts, cancel. */
export async function billingPortal(customer: string, returnUrl: string): Promise<string> {
  const p = await call<{ url: string }>("POST", "/billing_portal/sessions", { customer, return_url: returnUrl });
  return p.url;
}

/** A price as the subscribe screen shows it; kept ten minutes. */
const priceCache = new Map<string, { at: number; v: { amount: number; currency: string; interval: string } }>();
export async function readPrice(id: string): Promise<{ amount: number; currency: string; interval: string } | null> {
  const hit = priceCache.get(id);
  if (hit && Date.now() - hit.at < 600_000) return hit.v;
  try {
    const p = await call<{ unit_amount?: number | null; currency: string; recurring?: { interval?: string } | null }>("GET", `/prices/${encodeURIComponent(id)}`);
    const v = { amount: ZERO_DECIMAL.has(p.currency.toUpperCase()) ? (p.unit_amount ?? 0) : (p.unit_amount ?? 0) / 100, currency: p.currency.toUpperCase(), interval: p.recurring?.interval ?? "month" };
    priceCache.set(id, { at: Date.now(), v });
    return v;
  } catch {
    return null;
  }
}

export type StripeEvent = { id: string; type: string; account?: string; data: { object: Record<string, unknown> } };

/** The event, if the Stripe-Signature header proves Stripe sent this body in the last five minutes; else null. Two
 *  endpoints can point here, each with its own secret (28 Oct): the coaches' accounts (STRIPE_WEBHOOK_SECRET) and the
 *  platform's own, for subscriptions (STRIPE_BILLING_WEBHOOK_SECRET). */
export function verifyWebhook(body: string, header: string | null): StripeEvent | null {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_BILLING_WEBHOOK_SECRET].map((s) => s?.trim()).filter((s): s is string => !!s);
  if (!secrets.length || !header) return null;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return null;
  const given = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  const ok = secrets.some((secret) => {
    const expected = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    return given.some((g) => g.length === expected.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(expected)));
  });
  if (!ok) return null;
  try {
    return JSON.parse(body) as StripeEvent;
  } catch {
    return null;
  }
}
