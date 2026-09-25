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

export type StripeEvent = { id: string; type: string; account?: string; data: { object: Record<string, unknown> } };

/** The event, if the Stripe-Signature header proves Stripe sent this body in the last five minutes; else null. */
export function verifyWebhook(body: string, header: string | null): StripeEvent | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !header) return null;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return null;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const given = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  const ok = given.some((g) => g.length === expected.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(expected)));
  if (!ok) return null;
  try {
    return JSON.parse(body) as StripeEvent;
  } catch {
    return null;
  }
}
