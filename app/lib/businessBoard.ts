// The coach's Business board (21 Oct, Alex: built from the Business mockup): the business in numbers, nothing about
// the clients' bodies. What changed since the coach last looked, three figures (clients, a month, owed), money by
// month, clients by month, who owes, and the two lists to act on (plans ending, not billed automatically).
// One read: getBusinessBoard (businessBoardData.ts). Every sum is in the coach's own currency; an invoice in another
// currency is left out of the sums. Dates are yyyy-mm-dd; months yyyy-mm.

import type { PhaseTrack } from "./db";

/** How a repeating invoice comes round. */
export type SeriesEvery = "week" | "2weeks" | "month";

/** A repeating invoice series, as a month's worth: week × 52/12, 2 weeks × 26/12, month × 1. */
export type SeriesRow = {
  seriesId: number;
  clientId: number;
  client: string;
  every: SeriesEvery;
  /** The next invoice's day. */
  next: string;
  /** Each invoice's total. */
  total: number;
  /** What it comes to a month. */
  perMonth: number;
  paused: boolean;
};

/** One invoice under a month's bar. */
export type MonthInvoice = {
  invoiceId: number;
  clientId: number | null;
  client: string;
  number: string | null;
  /** The day it counts on: paid ones by paid_at (else issue date), open ones by issue date (else created). */
  date: string;
  amount: number;
  state: "paid" | "open";
};

/** A month of money. Paid: invoices paid that month. Open: billed that month (sent or overdue) and not paid. To come:
    for the current month the rest of it, and for the months ahead all of it, from the active series stepped forward
    (paused series left out). */
export type MoneyMonth = {
  month: string;
  /** "Oct", or "Oct 2025" when not this year. */
  label: string;
  paid: number;
  open: number;
  toCome: number;
  current: boolean;
  future: boolean;
  invoices: MonthInvoice[];
};

/** A month of the roster: clients on it at the month's end (at today for the current month), who joined, who left. */
export type RosterMonth = {
  month: string;
  label: string;
  count: number;
  joined: { clientId: number | null; name: string; date: string }[];
  left: { clientId: number | null; name: string; date: string }[];
  current: boolean;
};

/** Owed: an invoice the client has (sent or overdue) and hasn't paid; a draft (not sent) comes last and isn't counted. */
export type OwedRow = {
  invoiceId: number;
  clientId: number | null;
  client: string;
  number: string | null;
  issued: string | null;
  due: string | null;
  amount: number;
  state: "overdue" | "sent" | "draft";
  /** Days past its due date (overdue only). */
  daysLate: number | null;
};

/** A phase ending within 14 days with nothing after it on its track (phases/timeline.ts endingSoon). */
export type EndingRow = {
  clientId: number;
  client: string;
  avatarPath: string | null;
  track: PhaseTrack;
  phaseId: number;
  phaseName: string;
  /** Its last day. */
  ends: string;
  /** What the client brings in a month (their active series), null when they have none. */
  perMonth: number | null;
};

/** A client whose money doesn't come in by itself: their series is paused, or they have none. */
export type BillingRow = {
  clientId: number;
  client: string;
  avatarPath: string | null;
  reason: "paused" | "none";
  /** Their latest invoice's issue day (else created), null when never billed. */
  lastInvoice: string | null;
  /** A paused series' month's worth; null with none. */
  perMonth: number | null;
};

export type BusinessBoard = {
  today: string;
  /** The coach's currency (invoicing settings), the one every sum is in: "EUR". */
  currency: string;
  /** What happened since the coach's previous visit to Business (business_looked.prev, 30 minutes apart is a new
      visit): paid in that time (by paid_at), invoices sent (left Not sent; by issue date), new clients (start date).
      Null on a first visit or when nothing happened. */
  since: { from: string; paid: number; sent: number; newClients: number } | null;
  clients: {
    /** On the roster now. */
    count: number;
    joinedThisMonth: number;
    leftThisMonth: number;
  };
  monthly: {
    /** The active series' month's worth together. */
    total: number;
    /** Clients with at least one active series. */
    onSeries: number;
    /** total ÷ onSeries, rounded; null with none. */
    perClient: number | null;
    /** Every series, active first (by perMonth, most first), paused last. */
    series: SeriesRow[];
  };
  owed: {
    /** Sent and overdue, not drafts. */
    total: number;
    invoices: number;
    overdue: number;
    /** Overdue (most days late first), then sent (soonest due first), then drafts. */
    rows: OwedRow[];
  };
  /** The last 12 months (oldest first, this month last) and the 2 ahead: 14 entries. The screen shows 6 or 12 back. */
  money: MoneyMonth[];
  roster: {
    /** The last 12 months, oldest first, this month last. */
    months: RosterMonth[];
    /** How long clients stay, in days: those on the roster count up to today, those who left up to their leaving. */
    avgStayDays: number | null;
    longestDays: number | null;
  };
  /** Soonest ending first. */
  ending: EndingRow[];
  /** Paused first, then none; by name. */
  billing: BillingRow[];
};

export { getBusinessBoard, noteBusinessLooked } from "./businessBoardData";
