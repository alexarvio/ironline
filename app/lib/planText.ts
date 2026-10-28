import type { InvoiceEvery } from "./db";

// How a coaching plan reads wherever it shows (28 Oct, Alex): Settings' Plans, the Details picker, the Invoices tab.
// A plain module, safe on the screen and the server.

/** A plan as the screens get it. */
export type PlanChoice = { id: string; name: string; price: number | null; every: InvoiceEvery | null };

export const PLAN_EVERY: { value: InvoiceEvery; label: string; per: string }[] = [
  { value: "week", label: "Week", per: "week" },
  { value: "2weeks", label: "2 weeks", per: "2 weeks" },
  { value: "month", label: "Month", per: "month" },
];

/** "€150", "€89.50": whole sums without their cents. */
export function planMoney(n: number, currency: string): string {
  const whole = Math.round(n * 100) % 100 === 0;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(n);
}

/** Its price and rhythm as two facts ("€150", "month"), each left out when not set; parted by Sep where shown. */
export function planFacts(p: Pick<PlanChoice, "price" | "every">, currency: string): string[] {
  return [p.price != null ? planMoney(p.price, currency) : null, PLAN_EVERY.find((e) => e.value === p.every)?.per ?? null].filter((x): x is string => !!x);
}

/** "€150 a month", "€15 a week", "€90 every 2 weeks". */
export function planPerPeriod(p: Pick<PlanChoice, "price" | "every">, currency: string): string {
  if (p.price == null || !p.every) return "";
  return `${planMoney(p.price, currency)} ${p.every === "2weeks" ? "every 2 weeks" : `a ${p.every}`}`;
}
