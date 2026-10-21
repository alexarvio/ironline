// The Business board's data (businessBoard.ts has the shape and what each part means): one read of the store for the
// coach's Business screen, and the note of when the coach looked, so "Since 18/10" counts from the visit before this one.
// Never throws: a coach with no clients, no invoices and no series gets zeros, nulls and empty lists.

import type { BillingRow, BusinessBoard, EndingRow, MoneyMonth, MonthInvoice, OwedRow, RosterMonth, SeriesEvery, SeriesRow } from "./businessBoard";
import { getData, persist, type Data, type PhaseTrack } from "./db";
import { getCoachSettings, invoiceRepeatViews, localDateStr, nextInvoiceDate } from "./queries";
import { invoicingFor } from "./countries";
import { phaseLastDay } from "./phases";
import { endingSoon, type OverviewPhase } from "../admin/redesign/phases/timeline";

type ClientRow = Data["clients"][number];
type InvoiceRow = Data["invoices"][number];
type UserRow = Data["users"][number];
type ProfileRow = Data["client_profiles"][number];
type ProgramRow = Data["training_programs"][number];
type RepeatView = ReturnType<typeof invoiceRepeatViews>[number];

/** Two looks closer than this are one visit. */
const VISIT_GAP_MS = 30 * 60000;
/** Within a visit, the look's time moves on at most once a minute, so a page re-read after every save doesn't write the store each time. */
const LOOK_STEP_MS = 60000;
/** Months of history the money and roster read (this one included), and months ahead money reads. */
const MONTHS_BACK = 12;
const MONTHS_AHEAD = 2;
/** What a series comes to a month, by how often it comes round. */
const PER_MONTH: Record<SeriesEvery, number> = { week: 52 / 12, "2weeks": 26 / 12, month: 1 };
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---- Dates ----------------------------------------------------------------------

const DAY_MS = 86400000;
const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ZONELESS = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
const parseDay = (iso: string) => new Date(`${iso}T00:00:00`);
const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY_MS);
const monthOf = (day: string) => day.slice(0, 7);
function addMonths(ym: string, n: number): string {
  const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** A month's last day. */
function monthEnd(ym: string): string {
  const last = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}
/** "Oct", or "Oct 2025" when not this year. */
function monthLabel(ym: string, thisYear: string): string {
  const name = MONTH_SHORT[+ym.slice(5, 7) - 1] ?? ym;
  return ym.slice(0, 4) === thisYear ? name : `${name} ${ym.slice(0, 4)}`;
}
/** A stamp as epoch ms. A stamp with no zone ("2026-10-21 14:05:00") is UTC: invoices write theirs from toISOString.
    A plain day is its local midnight. NaN when unreadable. */
function utcMs(at: string | null | undefined): number {
  if (!at) return NaN;
  if (PLAIN_DAY.test(at)) return parseDay(at).getTime();
  if (ZONELESS.test(at)) return Date.parse(`${at.replace(" ", "T")}Z`);
  return Date.parse(at);
}
/** The local day a stamp falls on; null when unreadable. */
function stampDay(at: string | null | undefined): string | null {
  if (!at) return null;
  if (PLAIN_DAY.test(at)) return at;
  const ms = utcMs(at);
  return Number.isFinite(ms) ? localDateStr(new Date(ms)) : null;
}
/** A typed day as yyyy-mm-dd, or null. */
const dayOrNull = (v: string | null | undefined) => (v && PLAIN_DAY.test(v.slice(0, 10)) ? v.slice(0, 10) : null);

const r2 = (n: number) => Math.round(n * 100) / 100 || 0;
const amountOf = (i: InvoiceRow) => r2(Number(i.amount) || 0);

// ---- When a client started --------------------------------------------------------

type Start = { day: string; /** The moment, when the start is a stamp (a login, a deploy); null for a typed day. */ ms: number | null };

/** With the coach since: the coaching start date on their card; else the day their login was made; else when their
    first programme went live (the Business page's rule from before, 21 Oct). Null when none of them is there. */
function startFrom(profile: ProfileRow | undefined, user: UserRow | undefined, programs: ProgramRow[]): Start | null {
  const typed = dayOrNull(profile?.coaching_start_date);
  if (typed) return { day: typed, ms: null };
  const login = stampDay(user?.created_at);
  if (login && user) return { day: login, ms: utcMs(user.created_at) };
  let first: Start | null = null;
  for (const p of programs) {
    const day = stampDay(p.deployed_at);
    if (day && (!first || day < first.day)) first = { day, ms: utcMs(p.deployed_at) };
  }
  return first;
}

/** A client's start day (startFrom), for the departure row eraseClient writes before their rows go. Never throws. */
export function clientStartDay(clientId: number): string | null {
  try {
    const data = getData();
    return (
      startFrom(
        data.client_profiles.find((p) => p.client_id === clientId),
        data.users.find((u) => u.role === "client" && u.client_id === clientId),
        data.training_programs.filter((p) => p.client_id === clientId)
      )?.day ?? null
    );
  } catch (e) {
    console.error("[businessBoard] clientStartDay:", e);
    return null;
  }
}

// ---- One read of the store --------------------------------------------------------

/** Someone on the roster at some point: now (gone null) or one who left. */
type Member = {
  clientId: number | null;
  name: string;
  /** Their start; null when unknown (counted as there before anything the board shows). */
  start: string | null;
  /** The moment of the start, when known. */
  startMs: number | null;
  /** The day they left; null while on the roster. */
  gone: string | null;
};

type Ctx = {
  coachId: number;
  today: string;
  thisMonth: string;
  thisYear: string;
  coach: UserRow | undefined;
  currency: string;
  /** The coach's clients, by name. */
  clients: ClientRow[];
  /** Every invoice of the coach's, any currency. */
  allInvoices: InvoiceRow[];
  /** Those in the coach's currency: the ones every sum reads. */
  invoices: InvoiceRow[];
  /** A client's series as the Invoices tab has them, with each one's anchor day (for stepping it forward). */
  series: Map<number, (RepeatView & { anchorDay: number })[]>;
  members: Member[];
};

/** The name an invoice is for: its client's, else the one it kept when they left. */
const invoiceClient = (i: InvoiceRow, byId: Map<number, ClientRow>) => byId.get(i.client_id)?.name ?? i.client_name ?? i.to?.name ?? "Client";

function context(coachId: number, today: string): Ctx {
  const data = getData();
  const coach = data.users.find((u) => u.id === coachId && u.role === "coach");
  const settings = getCoachSettings(coachId);
  const currency = invoicingFor(settings.business ?? {}, settings.invoicing ?? {}).currency;
  const clients = data.clients.filter((c) => c.coach_id === coachId).sort((a, b) => a.name.localeCompare(b.name));
  const ids = new Set(clients.map((c) => c.id));

  const allInvoices = data.invoices.filter((i) => i.coach_id === coachId || ids.has(i.client_id));
  // An invoice from before invoices carried a currency was in euros (the print view reads it so, queries.ts).
  const invoices = allInvoices.filter((i) => (i.currency || "EUR") === currency);

  const series = new Map<number, (RepeatView & { anchorDay: number })[]>();
  for (const c of clients) {
    if (!c.invoice_repeats?.length) continue;
    const anchors = new Map(c.invoice_repeats.map((r) => [r.id, r.anchor_day] as const));
    series.set(
      c.id,
      invoiceRepeatViews(c.id).map((v) => ({ ...v, anchorDay: Number(anchors.get(v.id)) || Number(v.next.slice(8, 10)) || 1 }))
    );
  }

  // Who has been on the roster: the clients now, and those who left (a departure row; an older self-delete only has
  // its account_deletions line, so it counts with no start known).
  const profiles = new Map(data.client_profiles.filter((p) => ids.has(p.client_id)).map((p) => [p.client_id, p] as const));
  const logins = new Map(data.users.filter((u) => u.role === "client" && u.client_id != null && ids.has(u.client_id)).map((u) => [u.client_id as number, u] as const));
  const programs = new Map<number, ProgramRow[]>();
  for (const p of data.training_programs) {
    if (!ids.has(p.client_id)) continue;
    const list = programs.get(p.client_id);
    if (list) list.push(p);
    else programs.set(p.client_id, [p]);
  }
  const members: Member[] = clients.map((c) => {
    const s = startFrom(profiles.get(c.id), logins.get(c.id), programs.get(c.id) ?? []);
    return { clientId: c.id, name: c.name ?? "Client", start: s?.day ?? null, startMs: s?.ms != null && Number.isFinite(s.ms) ? s.ms : null, gone: null };
  });
  const departed = new Set<number>();
  for (const d of data.client_departures ?? []) {
    if (d.coach_id !== coachId) continue;
    const gone = stampDay(d.at);
    if (!gone) continue;
    departed.add(d.client_id);
    members.push({ clientId: null, name: d.name || "Client", start: dayOrNull(d.start), startMs: null, gone });
  }
  for (const d of data.account_deletions ?? []) {
    if (d.coach_id !== coachId || departed.has(d.client_id)) continue;
    const gone = stampDay(d.at);
    if (!gone) continue;
    members.push({ clientId: null, name: d.name || "Client", start: null, startMs: null, gone });
  }

  return { coachId, today, thisMonth: monthOf(today), thisYear: today.slice(0, 4), coach, currency, clients, allInvoices, invoices, series, members };
}

/** A part that fails reads as empty, never the whole board. */
function safe<T>(part: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (e) {
    console.error(`[businessBoard] ${part}:`, e);
    return fallback;
  }
}

// ---- The board ------------------------------------------------------------------------

export function getBusinessBoard(coachId: number): BusinessBoard {
  const today = localDateStr();
  const empty = emptyBoard(today);
  let ctx: Ctx;
  try {
    ctx = context(coachId, today);
  } catch (e) {
    console.error("[businessBoard] read:", e);
    return empty;
  }
  const roster = safe("roster", () => rosterOf(ctx), empty.roster);
  const current = roster.months.find((m) => m.current);
  return {
    today,
    currency: ctx.currency,
    since: safe("since", () => sinceOf(ctx), null),
    clients: {
      count: ctx.clients.length,
      joinedThisMonth: current?.joined.length ?? 0,
      leftThisMonth: current?.left.length ?? 0,
    },
    monthly: safe("monthly", () => monthlyOf(ctx), empty.monthly),
    owed: safe("owed", () => owedOf(ctx), empty.owed),
    money: safe("money", () => moneyOf(ctx), empty.money),
    roster,
    ending: safe("ending", () => endingOf(ctx), []),
    billing: safe("billing", () => billingOf(ctx), []),
  };
}

function emptyBoard(today: string): BusinessBoard {
  const thisMonth = monthOf(today);
  const thisYear = today.slice(0, 4);
  return {
    today,
    currency: "EUR",
    since: null,
    clients: { count: 0, joinedThisMonth: 0, leftThisMonth: 0 },
    monthly: { total: 0, onSeries: 0, perClient: null, series: [] },
    owed: { total: 0, invoices: 0, overdue: 0, rows: [] },
    money: Array.from({ length: MONTHS_BACK + MONTHS_AHEAD }, (_, i) => {
      const month = addMonths(thisMonth, i - (MONTHS_BACK - 1));
      return { month, label: monthLabel(month, thisYear), paid: 0, open: 0, toCome: 0, current: month === thisMonth, future: month > thisMonth, invoices: [] };
    }),
    roster: {
      months: Array.from({ length: MONTHS_BACK }, (_, i) => {
        const month = addMonths(thisMonth, i - (MONTHS_BACK - 1));
        return { month, label: monthLabel(month, thisYear), count: 0, joined: [], left: [], current: month === thisMonth };
      }),
      avgStayDays: null,
      longestDays: null,
    },
    ending: [],
    billing: [],
  };
}

// ---- Invoices: their state and the day they count on ---------------------------------------

type State = "paid" | "overdue" | "sent" | "draft";
/** Overdue is what a sent invoice is once its due day has gone (as the Invoices tab shows it); one stored as Overdue stays it. */
function stateOf(i: InvoiceRow, today: string): State {
  if (i.status === "paid") return "paid";
  if (i.status === "unpaid") return "draft";
  if (i.status === "due") return "overdue";
  const due = dayOrNull(i.due_date);
  return due && due < today ? "overdue" : "sent";
}
/** Its issue day, else the day it was made. */
const issueDay = (i: InvoiceRow) => dayOrNull(i.issue_date) ?? stampDay(i.created_at);
/** A paid invoice counts on the day it was paid, else its issue day, else the day it was made. */
const paidDay = (i: InvoiceRow) => stampDay(i.paid_at) ?? issueDay(i);

// ---- Since the coach last looked ------------------------------------------------------------

function sinceOf(ctx: Ctx): BusinessBoard["since"] {
  const prev = ctx.coach?.business_looked?.prev;
  if (prev == null || !Number.isFinite(prev)) return null;
  const from = localDateStr(new Date(prev));

  // Paid since: by when it was paid; an invoice marked paid before paid_at existed, by its last change.
  let paid = 0;
  for (const i of ctx.invoices) {
    if (i.status !== "paid") continue;
    const at = utcMs(i.paid_at ?? i.updated_at);
    if (Number.isFinite(at) && at > prev) paid += amountOf(i);
  }

  // Sent since: out of Not sent, and issued after the look's day or made after the look. Not by its last change: a
  // status set again (an old one marked Overdue, or Paid back to Sent) isn't a new invoice sent.
  let sent = 0;
  for (const i of ctx.allInvoices) {
    const st = stateOf(i, ctx.today);
    if (st === "draft") continue;
    const issued = issueDay(i);
    const made = utcMs(i.created_at);
    if ((issued && issued > from && issued <= ctx.today) || (Number.isFinite(made) && made > prev)) sent++;
  }

  // New clients: on the roster, started since (by the moment when the start is one, else by the day).
  let newClients = 0;
  for (const m of ctx.members) {
    if (m.gone || !m.start || m.start > ctx.today) continue;
    if (m.startMs != null ? m.startMs > prev : m.start > from) newClients++;
  }

  paid = r2(paid);
  if (!paid && !sent && !newClients) return null;
  return { from, paid, sent, newClients };
}

// ---- A month: the series ------------------------------------------------------------------------

function monthlyOf(ctx: Ctx): BusinessBoard["monthly"] {
  const rows: SeriesRow[] = [];
  const clientName = new Map(ctx.clients.map((c) => [c.id, c.name ?? "Client"] as const));
  for (const [clientId, list] of ctx.series) {
    for (const v of list) {
      // The series' own id is a string (InvoiceRepeat.id); seriesId is the row's place in this list, numbered below.
      rows.push({ seriesId: 0, clientId, client: clientName.get(clientId) ?? "Client", every: v.every, next: v.next, total: r2(v.total), perMonth: r2(v.total * (PER_MONTH[v.every] ?? 1)), paused: v.paused });
    }
  }
  rows.sort((a, b) => Number(a.paused) - Number(b.paused) || b.perMonth - a.perMonth || a.client.localeCompare(b.client) || (a.next < b.next ? -1 : a.next > b.next ? 1 : 0));
  rows.forEach((r, i) => (r.seriesId = i + 1));
  const active = rows.filter((r) => !r.paused);
  const total = r2(active.reduce((t, r) => t + r.perMonth, 0));
  const onSeries = new Set(active.map((r) => r.clientId)).size;
  return { total, onSeries, perClient: onSeries ? Math.round(total / onSeries) : null, series: rows };
}

// ---- Owed ---------------------------------------------------------------------------------------

function owedOf(ctx: Ctx): BusinessBoard["owed"] {
  const byId = new Map(ctx.clients.map((c) => [c.id, c] as const));
  const rows: OwedRow[] = [];
  for (const i of ctx.invoices) {
    const st = stateOf(i, ctx.today);
    if (st === "paid") continue;
    const due = dayOrNull(i.due_date);
    rows.push({
      invoiceId: i.id,
      clientId: byId.has(i.client_id) ? i.client_id : null,
      client: invoiceClient(i, byId),
      number: i.number ?? null,
      issued: issueDay(i),
      due,
      amount: amountOf(i),
      state: st,
      daysLate: st === "overdue" && due ? Math.max(0, daysBetween(due, ctx.today)) : null,
    });
  }
  const rank: Record<OwedRow["state"], number> = { overdue: 0, sent: 1, draft: 2 };
  // A missing due day sorts after every real one.
  const dueKey = (r: OwedRow) => r.due ?? "9999-12-31";
  rows.sort(
    (a, b) =>
      rank[a.state] - rank[b.state] ||
      (a.state === "overdue" ? (b.daysLate ?? -1) - (a.daysLate ?? -1) : 0) ||
      (dueKey(a) < dueKey(b) ? -1 : dueKey(a) > dueKey(b) ? 1 : 0) ||
      a.invoiceId - b.invoiceId
  );
  const counted = rows.filter((r) => r.state !== "draft");
  return {
    total: r2(counted.reduce((t, r) => t + r.amount, 0)),
    invoices: counted.length,
    overdue: counted.filter((r) => r.state === "overdue").length,
    rows,
  };
}

// ---- Money by month -------------------------------------------------------------------------------

function moneyOf(ctx: Ctx): MoneyMonth[] {
  const first = addMonths(ctx.thisMonth, -(MONTHS_BACK - 1));
  const last = addMonths(ctx.thisMonth, MONTHS_AHEAD);
  const months: MoneyMonth[] = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) {
    months.push({ month: m, label: monthLabel(m, ctx.thisYear), paid: 0, open: 0, toCome: 0, current: m === ctx.thisMonth, future: m > ctx.thisMonth, invoices: [] });
  }
  const byMonth = new Map(months.map((m) => [m.month, m] as const));
  const byId = new Map(ctx.clients.map((c) => [c.id, c] as const));

  // Paid in the month it was paid; open (sent or overdue, not paid) in the month it was issued. Drafts aren't money yet.
  for (const i of ctx.invoices) {
    const st = stateOf(i, ctx.today);
    if (st === "draft") continue;
    const day = st === "paid" ? paidDay(i) : issueDay(i);
    if (!day) continue;
    const month = byMonth.get(monthOf(day));
    if (!month) continue;
    const amount = amountOf(i);
    const row: MonthInvoice = { invoiceId: i.id, clientId: byId.has(i.client_id) ? i.client_id : null, client: invoiceClient(i, byId), number: i.number ?? null, date: day, amount, state: st === "paid" ? "paid" : "open" };
    month.invoices.push(row);
    if (st === "paid") month.paid += amount;
    else month.open += amount;
  }

  // To come: each active series stepped forward from its next day, this month from today on and the months ahead whole.
  const end = monthEnd(last);
  for (const list of ctx.series.values()) {
    for (const v of list) {
      if (v.paused || !PLAIN_DAY.test(v.next)) continue;
      let d = v.next;
      for (let guard = 0; d <= end && guard < 400; guard++) {
        if (d >= ctx.today) {
          const month = byMonth.get(monthOf(d));
          if (month) month.toCome += v.total;
        }
        const next = nextInvoiceDate(d, v.every, v.anchorDay);
        if (!(next > d)) break;
        d = next;
      }
    }
  }

  for (const m of months) {
    m.paid = r2(m.paid);
    m.open = r2(m.open);
    m.toCome = r2(m.toCome);
    m.invoices.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.invoiceId - b.invoiceId));
  }
  return months;
}

// ---- Clients by month --------------------------------------------------------------------------------

function rosterOf(ctx: Ctx): BusinessBoard["roster"] {
  const first = addMonths(ctx.thisMonth, -(MONTHS_BACK - 1));
  const months: RosterMonth[] = [];
  for (let m = first; m <= ctx.thisMonth; m = addMonths(m, 1)) {
    months.push({ month: m, label: monthLabel(m, ctx.thisYear), count: 0, joined: [], left: [], current: m === ctx.thisMonth });
  }
  const byMonth = new Map(months.map((m) => [m.month, m] as const));

  for (const p of ctx.members) {
    // On the roster now, they are on it today whatever their card says (a start still to come counts as today).
    const start = p.start && !p.gone && p.start > ctx.today ? ctx.today : p.start;
    if (start && (!p.gone || start <= p.gone)) byMonth.get(monthOf(start))?.joined.push({ clientId: p.clientId, name: p.name, date: start });
    if (p.gone) byMonth.get(monthOf(p.gone))?.left.push({ clientId: null, name: p.name, date: p.gone });
    // At each month's end (today for this one): started by then, not gone by then. No start known: there all along.
    for (const m of months) {
      const at = m.current ? ctx.today : monthEnd(m.month);
      if ((start == null || start <= at) && (p.gone == null || p.gone > at)) m.count++;
    }
  }
  for (const m of months) {
    m.joined.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name)));
    m.left.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name)));
  }

  // How long clients stay: those on the roster up to today, those who left up to their leaving. A start still to come,
  // or none known, says nothing.
  const stays: number[] = [];
  for (const p of ctx.members) {
    if (!p.start || p.start > ctx.today) continue;
    const until = p.gone ?? ctx.today;
    if (p.start > until) continue;
    stays.push(daysBetween(p.start, until));
  }
  return {
    months,
    avgStayDays: stays.length ? Math.round(stays.reduce((t, n) => t + n, 0) / stays.length) : null,
    longestDays: stays.length ? Math.max(...stays) : null,
  };
}

// ---- Plans ending -----------------------------------------------------------------------------------

/** What a client brings in a month: their active series together; null with none. */
function activePerMonth(ctx: Ctx, clientId: number): number | null {
  const active = (ctx.series.get(clientId) ?? []).filter((v) => !v.paused);
  return active.length ? r2(active.reduce((t, v) => t + v.total * (PER_MONTH[v.every] ?? 1), 0)) : null;
}

function endingOf(ctx: Ctx): EndingRow[] {
  const data = getData();
  const ids = new Set(ctx.clients.map((c) => c.id));
  const programs = new Map(data.training_programs.filter((p) => ids.has(p.client_id)).map((p) => [p.id, p] as const));
  const phasesBy = new Map<number, OverviewPhase[]>();
  for (const p of data.client_phases) {
    if (!ids.has(p.client_id)) continue;
    const program = p.program_id != null ? programs.get(p.program_id) : undefined;
    // A draft as the Phases overview reads it (phases/load.ts): the phase's own flag, or its programme still a draft.
    const programDraft = !!program && program.status !== "deployed" && !program.scheduled_at;
    const row: OverviewPhase = {
      id: p.id,
      track: p.track,
      name: p.name,
      start: p.start_week,
      end: phaseLastDay(p.end_week),
      endWeek: p.end_week,
      draft: !!p.draft || programDraft,
      objectives: p.objectives ?? [],
      programId: program?.id ?? null,
      gap: null,
    };
    const list = phasesBy.get(p.client_id);
    if (list) list.push(row);
    else phasesBy.set(p.client_id, [row]);
  }

  const rows: EndingRow[] = [];
  for (const c of ctx.clients) {
    const phases = phasesBy.get(c.id) ?? [];
    for (const p of phases) {
      if (!endingSoon(p, phases, ctx.today)) continue;
      rows.push({ clientId: c.id, client: c.name ?? "Client", avatarPath: c.avatar_path ?? null, track: p.track, phaseId: p.id, phaseName: p.name, ends: p.end, perMonth: activePerMonth(ctx, c.id) });
    }
  }
  const trackRank: Record<PhaseTrack, number> = { lifestyle: 0, training: 1, nutrition: 2 };
  return rows.sort((a, b) => (a.ends < b.ends ? -1 : a.ends > b.ends ? 1 : 0) || a.client.localeCompare(b.client) || trackRank[a.track] - trackRank[b.track]);
}

// ---- Not billed automatically ---------------------------------------------------------------------------

function billingOf(ctx: Ctx): BillingRow[] {
  // Their latest invoice's day (issue, else made), any currency: when they were last billed.
  const lastBy = new Map<number, string>();
  for (const i of ctx.allInvoices) {
    const day = issueDay(i);
    if (!day) continue;
    const had = lastBy.get(i.client_id);
    if (!had || day > had) lastBy.set(i.client_id, day);
  }
  const rows: BillingRow[] = [];
  for (const c of ctx.clients) {
    const list = ctx.series.get(c.id) ?? [];
    if (list.some((v) => !v.paused)) continue;
    const paused = list.filter((v) => v.paused);
    rows.push({
      clientId: c.id,
      client: c.name ?? "Client",
      avatarPath: c.avatar_path ?? null,
      reason: paused.length ? "paused" : "none",
      lastInvoice: lastBy.get(c.id) ?? null,
      perMonth: paused.length ? r2(paused.reduce((t, v) => t + v.total * (PER_MONTH[v.every] ?? 1), 0)) : null,
    });
  }
  return rows.sort((a, b) => Number(a.reason === "none") - Number(b.reason === "none") || a.client.localeCompare(b.client));
}

// ---- The coach's look -------------------------------------------------------------------------------

/**
 * The coach has Business on screen: a look more than 30 minutes after the last starts a new visit, and the visit before
 * becomes what "Since" counts from. Call before getBusinessBoard: a new visit moves the last look into prev first, so
 * the board counts from the previous visit on its first render too (and on every re-read in it).
 */
export function noteBusinessLooked(coachId: number): void {
  try {
    const coach = getData().users.find((u) => u.id === coachId && u.role === "coach");
    if (!coach) return;
    const now = Date.now();
    const had = coach.business_looked;
    if (!had || !Number.isFinite(had.at) || now - had.at > VISIT_GAP_MS) {
      coach.business_looked = { at: now, prev: had && Number.isFinite(had.at) ? had.at : null };
      persist();
    } else if (now - had.at >= LOOK_STEP_MS) {
      coach.business_looked = { at: now, prev: had.prev ?? null };
      persist();
    }
  } catch (e) {
    console.error("[businessBoard] noteBusinessLooked:", e);
  }
}
