import { getData, persist, type CoachPlan, type InvoiceEvery, type InvoiceLine, type InvoiceRepeat } from "./db";
import { localDateStr, nextInvoiceDate } from "./queries";

// The plans a coach offers, and which one a client is on (23 Oct, Alex: picked on the client's Details; 28 Oct, Alex:
// made in Settings, Plans, and billed from). A plan is a name, a price in the coach's currency and how often it bills.
// Plans live on the coach's own settings (users.coach_settings.plans), a client's pick on their profile
// (client_profiles.coaching_plan_id). Billing a client on a plan is a recurring invoice series tied to it
// (InvoiceRepeat.plan_id), started by the coach from the Invoices tab (Start billing). The series keeps the plan's
// lines as they were when it started: a new price is for new clients only. Putting the client on another plan moves
// the series to it from its next day; on none, or a plan with no price, it stops.

const coachRow = (coachId: number) => getData().users.find((u) => u.id === coachId && u.role === "coach");
const EVERY: InvoiceEvery[] = ["week", "2weeks", "month"];
const cleanName = (name: unknown) => String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
const cleanPrice = (price: unknown) => (price == null || price === "" || !Number.isFinite(Number(price)) || Number(price) < 0 ? null : Math.round(Number(price) * 100) / 100);
const cleanEvery = (every: unknown) => (EVERY.includes(every as InvoiceEvery) ? (every as InvoiceEvery) : null);

export type PlanFields = { name: string; price?: number | null; every?: InvoiceEvery | null };

/** The coach's plans, oldest first; archived ones only when asked for (a client still on one shows it). */
export function listCoachPlans(coachId: number, withArchived = false): CoachPlan[] {
  const plans = coachRow(coachId)?.coach_settings?.plans ?? [];
  return withArchived ? plans : plans.filter((p) => !p.archived);
}

/** How many of the coach's clients are on each plan, by its id. */
export function planClientCounts(coachId: number): Map<string, number> {
  const data = getData();
  const mine = new Set(data.clients.filter((c) => c.coach_id === coachId).map((c) => c.id));
  const counts = new Map<string, number>();
  for (const p of data.client_profiles) if (p.coaching_plan_id && mine.has(p.client_id)) counts.set(p.coaching_plan_id, (counts.get(p.coaching_plan_id) ?? 0) + 1);
  return counts;
}

/** A new plan; the same name again (any case) gives back the one there is, brought back if archived, its price and
    rhythm taken when given. */
export function addCoachPlan(coachId: number, v: PlanFields): CoachPlan | null {
  const user = coachRow(coachId);
  const name = cleanName(v.name);
  if (!user || !name) return null;
  const price = cleanPrice(v.price);
  const every = cleanEvery(v.every);
  const plans = user.coach_settings?.plans ?? [];
  const same = plans.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (same) {
    same.archived = false;
    if (price != null) same.price = price;
    if (every) same.every = every;
    persist();
    return same;
  }
  const plan: CoachPlan = { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, created_at: new Date().toISOString(), ...(price != null ? { price } : {}), ...(every ? { every } : {}) };
  user.coach_settings = { ...(user.coach_settings ?? {}), plans: [...plans, plan] };
  persist();
  return plan;
}

/** A plan's name, price and rhythm changed. Clients already billed keep what they pay (their series has its own lines).
    A name another plan has is refused. */
export function updateCoachPlan(coachId: number, id: string, v: PlanFields): CoachPlan | null {
  const plans = coachRow(coachId)?.coach_settings?.plans ?? [];
  const plan = plans.find((p) => p.id === id);
  const name = cleanName(v.name);
  if (!plan || !name || plans.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) return null;
  plan.name = name;
  plan.price = cleanPrice(v.price);
  plan.every = cleanEvery(v.every);
  persist();
  return plan;
}

/** Archived, a plan leaves the picker; the clients on it stay on it and are still billed. */
export function setCoachPlanArchived(coachId: number, id: string, archived: boolean): boolean {
  const plan = coachRow(coachId)?.coach_settings?.plans?.find((p) => p.id === id);
  if (!plan) return false;
  plan.archived = archived || undefined;
  persist();
  return true;
}

/** Deletes a plan no client is on; one with clients is archived instead, never deleted. */
export function deleteCoachPlan(coachId: number, id: string): boolean {
  const user = coachRow(coachId);
  const plans = user?.coach_settings?.plans ?? [];
  if (!user || !plans.some((p) => p.id === id) || (planClientCounts(coachId).get(id) ?? 0) > 0) return false;
  user.coach_settings = { ...(user.coach_settings ?? {}), plans: plans.filter((p) => p.id !== id) };
  persist();
  return true;
}

/** What an invoice from the plan says: its name (with the month on a monthly one), one of it at its price. */
export function planLines(plan: CoachPlan): InvoiceLine[] {
  return [{ description: plan.every === "month" ? `${plan.name}, {month}` : plan.name, quantity: 1, unit_price: plan.price ?? 0 }];
}

/** A plan that can bill: it has a price and a rhythm. */
export const plansBill = (plan: CoachPlan | null | undefined): plan is CoachPlan & { price: number; every: InvoiceEvery } => !!plan && plan.price != null && plan.price > 0 && !!plan.every;

/** The plan a client is on, or null. */
export function clientPlanId(clientId: number): string | null {
  return getData().client_profiles.find((p) => p.client_id === clientId)?.coaching_plan_id ?? null;
}

/** The series billing a client for a plan, if any. */
export function clientPlanSeries(clientId: number): InvoiceRepeat | null {
  return getData().clients.find((c) => c.id === clientId)?.invoice_repeats?.find((r) => r.plan_id) ?? null;
}

/**
 * Put a client on one of their coach's plans, or on none (null). A plan that isn't the coach's is refused. A series
 * billing them for a plan moves with them: to the new plan from its next day (no gap, no double bill, no part-period
 * sums), keeping whether it sends and whether it is paused; on none, or a plan that can't bill, it stops.
 */
export function setClientPlan(coachId: number, clientId: number, planId: string | null): boolean {
  const data = getData();
  const plans = listCoachPlans(coachId, true);
  const plan = planId == null ? null : plans.find((p) => p.id === planId);
  if (planId != null && !plan) return false;
  const profile = data.client_profiles.find((p) => p.client_id === clientId);
  if (!profile) return false;
  if ((profile.coaching_plan_id ?? null) === planId) return true;
  profile.coaching_plan_id = planId;
  const client = data.clients.find((c) => c.id === clientId);
  const series = clientPlanSeries(clientId);
  if (client && series) {
    const rest = (client.invoice_repeats ?? []).filter((r) => r !== series);
    if (plansBill(plan)) {
      const anchor = plan.every === "month" && series.every === "month" ? series.anchor_day : Number(series.next.slice(8, 10));
      const moved: InvoiceRepeat = { id: series.id, every: plan.every, next: series.next, anchor_day: anchor, lines: planLines(plan), send: series.send, created_at: new Date().toISOString(), plan_id: plan.id, ...(series.paused ? { paused: true } : {}), ...(series.note ? { note: series.note } : {}) };
      client.invoice_repeats = [...rest, moved];
    } else client.invoice_repeats = rest;
  }
  persist();
  return true;
}

/** Where billing a client stands for the Invoices tab: the plan, whether a series bills it, and whether one could start
    (only with no series at all: one made by hand before plans already bills them). */
export function clientPlanBilling(coachId: number, clientId: number) {
  const planId = clientPlanId(clientId);
  const plan = planId ? listCoachPlans(coachId, true).find((p) => p.id === planId) ?? null : null;
  const repeats = getData().clients.find((c) => c.id === clientId)?.invoice_repeats ?? [];
  const canStart = plansBill(plan) && repeats.length === 0;
  return { plan: plan ? { id: plan.id, name: plan.name, price: plan.price ?? null, every: plan.every ?? null, lines: planLines(plan) } : null, canStart };
}

/** The day a moved series next bills, for the picker to say: the series' own next day, or none. */
export function clientPlanNext(clientId: number): string | null {
  const s = clientPlanSeries(clientId);
  if (!s) return null;
  // A paused one carries on from its next day still to come once resumed (setInvoiceRepeatPaused).
  if (!s.paused) return s.next;
  let next = s.next;
  const today = localDateStr();
  while (next < today) next = nextInvoiceDate(next, s.every, s.anchor_day);
  return next;
}
