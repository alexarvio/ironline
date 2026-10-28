"use client";

import { useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createInvoiceAction, deleteInvoiceAction, deleteInvoiceTemplateAction, saveInvoiceTemplateAction, setInvoiceRepeatPausedAction, setInvoiceStatusByIdAction, stopInvoiceRepeatAction } from "../../../lib/actions";
import type { InvoiceEvery, InvoiceLine, InvoiceTemplate } from "../../../lib/db";
import type { InvoiceView } from "../../../lib/queries";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { ArrowRightIcon, ChevronDownIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import DatePick from "../DatePick";
import type { DraftInvoices } from "../loaders";
import { dayMonth } from "../../../lib/dayMonth";
import { SepJoin } from "../Sep";
import { ConfirmDialog } from "../training/TrainingDraft";
import { planPerPeriod } from "../../../lib/planText";

// A client's invoices (21 Oct, Alex: built as the track tabs are, root "rd trn rls riv"): Training's header with
// New invoice as a white pill, the figures in one hairline card, what Settings still lacks as a fact and its fix,
// the recurring invoices, and every invoice a row in one hairline card: the number, what for, the dates, the total
// and its state, the state pill itself the menu that changes it. A row opens the invoice as it prints, in a new tab.
// New invoice starts from a template when there is one, and can repeat (21 Oct, Alex). A client on a priced plan that
// nothing bills yet gets the fact and its fix, Start billing (28 Oct, Alex): New invoice filled from the plan, repeating
// on its rhythm, the series it makes tied to the plan (coachPlans.ts), its name on the series' grey line.

type Status = InvoiceView["status"];
const STATUS: { value: Status; label: string; cls: string }[] = [
  { value: "unpaid", label: "Not sent", cls: "" },
  { value: "sent", label: "Sent", cls: "live" },
  { value: "paid", label: "Paid", cls: "good" },
  { value: "due", label: "Overdue", cls: "warn" },
];
const EVERY: { value: InvoiceEvery | null; label: string; long: string }[] = [
  { value: null, label: "Once", long: "" },
  { value: "week", label: "Week", long: "Weekly" },
  { value: "2weeks", label: "2 weeks", long: "Every 2 weeks" },
  { value: "month", label: "Month", long: "Monthly" },
];

export const money = (n: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n || 0);
const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return iso(x);
};
/** When a series comes back after `d` (as the server's nextInvoiceDate): a week or two on, or the anchor day next month. */
const nextOf = (d: string, every: InvoiceEvery, anchor = Number(d.slice(8, 10))) => {
  if (every === "week") return addDays(d, 7);
  if (every === "2weeks") return addDays(d, 14);
  const x = new Date(`${d}T12:00:00`);
  const y = x.getMonth() === 11 ? x.getFullYear() + 1 : x.getFullYear();
  const m = (x.getMonth() + 1) % 12;
  return iso(new Date(y, m, Math.min(anchor, new Date(y, m + 1, 0).getDate()), 12));
};
/** A new series' first day to come after `today` (a first invoice in the past never back-fills; as addInvoiceRepeat). */
const firstNext = (issue: string, every: InvoiceEvery, today: string) => {
  const anchor = Number(issue.slice(8, 10));
  let n = nextOf(issue, every, anchor);
  while (n <= today) n = nextOf(n, every, anchor);
  return n;
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "{month}" and "{year}" as of a day, as the server fills them when it makes the invoice. */
const fill = (text: string, day: string) => {
  const x = new Date(`${day}T12:00:00`);
  return text.replace(/\{month\}/gi, MONTHS[x.getMonth()]).replace(/\{year\}/gi, String(x.getFullYear()));
};
const cents = (n: number) => Math.round(n * 100) / 100;
/**
 * A typed amount, either way of writing it: the last comma or point is the decimals and any other a thousands mark
 * ("1.250,00", "1,250.00"), except one kind of mark with exactly three digits after each, which is thousands
 * ("1,250", "1.250", "1.250.000"; prices never have three decimals). "0,250" stays 0.25. Unreadable: NaN.
 */
const num = (s: string) => {
  const t = s.trim();
  if (!t) return 0;
  const i = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  if (i < 0) return Number(t);
  const mark = t[i];
  const head = t.slice(0, i);
  const tail = t.slice(i + 1);
  if (tail.length === 3 && new RegExp(`^[1-9]\\d{0,2}(\\${mark}\\d{3})*$`).test(head)) return Number(head.split(mark).join("") + tail);
  return Number(`${head.replace(/[.,]/g, "")}.${tail}`);
};
function totals(lines: InvoiceLine[], rate: number, incl: boolean) {
  const sum = cents(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0));
  const r = rate / 100;
  if (incl) {
    const subtotal = cents(sum / (1 + r));
    return { subtotal, vat: cents(sum - subtotal), total: sum };
  }
  const vat = cents(sum * r);
  return { subtotal: sum, vat, total: cents(sum + vat) };
}
const sheetHref = (id: number) => `/admin/redesign/invoices/${id}`;

export default function InvoicesDraft({ clientId, firstName, clientName, plan }: { clientId: number; firstName: string; clientName: string; plan: DraftInvoices }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  // New invoice opened by Start billing: filled from the client's plan.
  const [fromPlan, setFromPlan] = useState(false);
  const bill = plan.billing.canStart ? plan.billing.plan : null;
  const [removing, setRemoving] = useState<InvoiceView | null>(null);
  const [stopping, setStopping] = useState<DraftInvoices["repeats"][number] | null>(null);
  const act = (fn: () => Promise<unknown>, said: string) =>
    start(async () => {
      await fn();
      router.refresh();
      toast.success(said);
    });

  const cur = plan.defaults.currency;
  // Owed: what has reached the client and is not paid (a draft they can't see isn't owed yet).
  const owed = plan.invoices.filter((i) => i.status === "sent" || i.status === "due");
  const outstanding = owed.reduce((s, i) => s + i.total, 0);
  const paid = plan.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  // The number's column fits the longest number ("FP-2026-0001"); head and rows share it.
  const numCol = Math.max(64, ...plan.invoices.map((i) => Math.ceil(i.number.length * 9.5)));
  const grid = { gridTemplateColumns: `${numCol}px minmax(0, 1fr) 80px 80px 96px 112px 32px`, columnGap: 16 } as const;
  const repGrid = { gridTemplateColumns: `112px minmax(0, 1fr) 80px 96px 112px 32px`, columnGap: 16 } as const;
  // The whole row opens the invoice; what sits in it (the number's own link, the state menu, ⋯) does its own thing,
  // and a click inside a menu (portaled, but its events still come up through the row) never does.
  const openRow = (e: MouseEvent, id: number) => {
    if (!(e.currentTarget as Element).contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest("a, button, [role=menuitem]")) return;
    window.open(sheetHref(id), "_blank", "noopener");
  };

  return (
    <div className="rd trn rls riv">
      {/* ---- Header: Training's. No fact line, so no room kept for one. */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <span className="trn-eyebrow">Invoices</span>
          <div className="trn-name-row">
            <h1 className="trn-name">{firstName}&rsquo;s invoices</h1>
          </div>
        </div>
        <div className="trn-head-actions">
          <button type="button" className="trn-pill" onClick={() => (setFromPlan(false), setAdding(true))}>
            <PlusIcon /> New invoice
          </button>
        </div>
      </header>

      {/* ---- A real problem: the fact and its fix (design rules 1). */}
      {plan.missing.length > 0 && (
        <section className="riv-fix" aria-label="Missing from Settings">
          <span>Missing from Settings: {plan.missing.join(", ").replace(/, ([^,]*)$/, " and $1")}</span>
          <Link className="trn-pill" href={plan.missing.includes("bank details") && plan.missing.length === 1 ? "/admin/redesign/settings#invoicing" : "/admin/redesign/settings#business"}>
            Add them
          </Link>
        </section>
      )}

      {/* ---- On a plan nothing bills yet (28 Oct, Alex): the fact and its fix. */}
      {bill && (
        <section className="riv-fix" aria-label="Plan not billed">
          <span>
            On {bill.name}, {planPerPeriod(bill, cur)}, not billed.
          </span>
          <button type="button" className="trn-pill" onClick={() => (setFromPlan(true), setAdding(true))}>
            Start billing
          </button>
        </section>
      )}

      {/* ---- The figures, in one hairline card (as Home's); only once there is an invoice or a series (22 Oct, Alex: a new client has nothing). */}
      {(plan.invoices.length > 0 || plan.repeats.length > 0) && (
        <section className="rls-card rls-figs" aria-label="At a glance">
          <div className="rls-fig">
            <span className="rls-fig-label">Outstanding</span>
            <b className={outstanding > 0 ? "warn" : ""}>{money(outstanding, cur)}</b>
            <small>
              {owed.length} invoice{owed.length === 1 ? "" : "s"}
            </small>
          </div>
          <div className="rls-fig">
            <span className="rls-fig-label">Paid</span>
            <b>{money(paid, cur)}</b>
            <small>All time</small>
          </div>
          <div className="rls-fig">
            <span className="rls-fig-label">Next number</span>
            <b>{plan.defaults.nextNumber}</b>
            <small>
              <SepJoin parts={[`${plan.defaults.taxLabel} ${plan.defaults.vatRate}%`, `${plan.defaults.termsDays} days to pay`]} />
            </small>
          </div>
        </section>
      )}

      {/* ---- Recurring (21 Oct, Alex): each series makes the same invoice on its day, sent to the client or kept as a draft. */}
      {plan.repeats.length > 0 && (
        <section className="rls-section">
          <div className="trn-weekhead">
            <div>
              <h2>Recurring</h2>
            </div>
          </div>
          <div className="rls-card riv-card">
            <div className="rls-cols riv-cols" style={repGrid} aria-hidden="true">
              <span>Every</span>
              <span>What for</span>
              <span>Next</span>
              <span className="riv-right">Total</span>
              <span>Status</span>
              <span />
            </div>
            {plan.repeats.map((r) => (
              <div key={r.id} className="rls-row riv-row riv-rep">
                <div className="rls-row-main" style={repGrid}>
                  <span className="riv-every">{EVERY.find((e) => e.value === r.every)?.long}</span>
                  <span className="riv-what">
                    <span className="riv-what-main">{fill(r.lines[0]?.description ?? "Invoice", r.next)}</span>
                    <small>
                      <SepJoin parts={[r.plan, r.lines.length > 1 ? `+ ${r.lines.length - 1} more` : null, r.send ? `Sent to ${firstName}` : "Drafts"]} />
                    </small>
                  </span>
                  <span className="riv-date">{r.paused ? "–" : dayMonth(r.next)}</span>
                  <span className="riv-total">{money(r.total, r.currency)}</span>
                  <span>
                    <span className={`trn-state riv-pill${r.paused ? "" : " live"}`}>{r.paused ? "Paused" : "Active"}</span>
                  </span>
                  <span className="rls-more" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className="trn-row-more" aria-label="More for this recurring invoice">
                        <MoreIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="pb-menu">
                        <DropdownMenuItem onSelect={() => act(() => setInvoiceRepeatPausedAction(clientId, r.id, !r.paused), r.paused ? "Resumed" : "Paused")}>{r.paused ? "Resume" : "Pause"}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setStopping(r)}>
                          <TrashIcon /> Stop
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Every invoice, newest first. */}
      <section className="rls-section">
        <div className="trn-weekhead">
          <div>
            <h2>All invoices</h2>
          </div>
        </div>
        <div className="rls-card riv-card">
          {plan.invoices.length === 0 ? (
            <p className="rls-none">None yet</p>
          ) : (
            <>
              <div className="rls-cols riv-cols" style={grid} aria-hidden="true">
                <span>Number</span>
                <span>What for</span>
                <span>Issued</span>
                <span>Due</span>
                <span className="riv-right">Total</span>
                <span>Status</span>
                <span />
              </div>
              {plan.invoices.map((inv) => {
                // Overdue is what a sent invoice is once its day has gone; one stored as Overdue stays it.
                const pastDue = !!inv.dueDate && inv.dueDate < plan.today;
                const late = (inv.status === "sent" || inv.status === "due") && pastDue;
                const shown: Status = inv.status === "sent" && pastDue ? "due" : inv.status;
                const st = STATUS.find((s) => s.value === shown) ?? STATUS[0];
                const label = shown === "paid" && inv.paidVia === "stripe" ? "Paid online" : st.label;
                // Late, Sent would change nothing the coach can see: not offered.
                const choices = STATUS.filter((s) => !(s.value === "sent" && late));
                return (
                  <div key={inv.id} className="rls-row riv-row">
                    <div className="rls-row-main" style={grid} onClick={(e) => openRow(e, inv.id)}>
                      <a className="rd-row-hit riv-number" href={sheetHref(inv.id)} target="_blank" rel="noopener noreferrer" title={`Open ${inv.number}`}>
                        {inv.number}
                      </a>
                      <span className="riv-what">
                        <span className="riv-what-main">{inv.lines[0]?.description || "Invoice"}</span>
                        {inv.lines.length > 1 && <small>+ {inv.lines.length - 1} more</small>}
                      </span>
                      <span className="riv-date">{dayMonth(inv.issueDate)}</span>
                      <span className={`riv-date${late ? " late" : ""}`}>{inv.dueDate ? dayMonth(inv.dueDate) : "–"}</span>
                      <span className="riv-total">{money(inv.total, inv.currency)}</span>
                      <span onClick={(e) => e.stopPropagation()}>
                        {/* The state is the menu that changes it (design rules 5). */}
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={`trn-state riv-state ${st.cls}`} aria-label={`${inv.number}: ${label}, change`}>
                            {label}
                            <ChevronDownIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="pb-menu">
                            {choices.map((s) => (
                              <DropdownMenuItem key={s.value} className={s.value === shown ? "on" : ""} onSelect={() => s.value !== shown && act(() => setInvoiceStatusByIdAction(inv.id, s.value), `${inv.number}: ${s.label}`)}>
                                {s.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                      <span className="rls-more" onClick={(e) => e.stopPropagation()}>
                        {/* Never sent: it can still go (asked first). Once it has reached the client it stays: it is their record. */}
                        {inv.status === "unpaid" && !inv.frozen && (
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger className="trn-row-more" aria-label={`More for ${inv.number}`}>
                              <MoreIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="pb-menu">
                              <DropdownMenuItem onSelect={() => window.open(sheetHref(inv.id), "_blank", "noopener")}>
                                <ArrowRightIcon /> Open
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(inv)}>
                                <TrashIcon /> Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && (
          <NewInvoiceDialog
            clientName={clientName}
            firstName={firstName}
            plan={plan}
            from={fromPlan && bill ? { lines: bill.lines, every: bill.every } : null}
            onCreate={(v) => {
              setAdding(false);
              start(async () => {
                const id = await createInvoiceAction(clientId, { ...v, planId: fromPlan && bill ? bill.id : null });
                router.refresh();
                const every = EVERY.find((e) => e.value === v.repeat);
                if (id) toast.success(`${plan.defaults.nextNumber} created`, { description: v.repeat ? `${every?.long}, next ${dayMonth(firstNext(v.issueDate, v.repeat, plan.today))}` : undefined, action: { label: "Open", onClick: () => window.open(sheetHref(id), "_blank", "noopener") } });
                else toast.error("Couldn't create it");
              });
            }}
          />
        )}
      </Dialog>

      <Dialog open={removing != null} onOpenChange={(o) => !o && setRemoving(null)}>
        {removing && (
          <ConfirmDialog
            title={`Remove ${removing.number}?`}
            description="This permanently deletes the invoice. It can't be undone."
            confirm="Remove"
            danger
            onConfirm={() => {
              const inv = removing;
              setRemoving(null);
              act(() => deleteInvoiceAction(inv.id), `${inv.number} removed`);
            }}
          />
        )}
      </Dialog>

      <Dialog open={stopping != null} onOpenChange={(o) => !o && setStopping(null)}>
        {stopping && (
          <ConfirmDialog
            title="Stop this recurring invoice?"
            description="No more invoices come from it. The ones it made stay."
            confirm="Stop"
            danger
            onConfirm={() => {
              const r = stopping;
              setStopping(null);
              act(() => stopInvoiceRepeatAction(clientId, r.id), "Stopped");
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

// ---- A new invoice: the .dlh card (design rules 4). A template to start from, the day, its lines on clean lines
// with the sums under them, a note, whether it repeats and whether it has gone to the client.
type Draft = { description: string; quantity: string; unit_price: string };
const blankLine = (): Draft => ({ description: "", quantity: "1", unit_price: "" });
const draftOf = (l: InvoiceLine): Draft => ({ description: l.description, quantity: String(l.quantity), unit_price: String(l.unit_price) });
type NewInvoice = { issueDate: string; lines: InvoiceLine[]; note: string; sent: boolean; repeat: InvoiceEvery | null; template: string | null };

/** `from`: the client's plan, for Start billing (28 Oct): its line, repeating on its rhythm. */
function NewInvoiceDialog({ clientName, firstName, plan, from, onCreate }: { clientName: string; firstName: string; plan: DraftInvoices; from: { lines: InvoiceLine[]; every: InvoiceEvery | null } | null; onCreate: (v: NewInvoice) => void }) {
  const d = plan.defaults;
  const [issue, setIssue] = useState(plan.today);
  const [lines, setLines] = useState<Draft[]>(from ? from.lines.map(draftOf) : [blankLine()]);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [repeat, setRepeat] = useState<InvoiceEvery | null>(from?.every ?? null);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(plan.templates);
  const [tpl, setTpl] = useState<string | null>(null);
  const clean = lines.map((l) => ({ description: l.description.trim(), quantity: num(l.quantity), unit_price: num(l.unit_price) }));
  const bad = (l: (typeof clean)[number]) => !Number.isFinite(l.quantity) || !Number.isFinite(l.unit_price);
  const good = clean.filter((l) => l.description && l.quantity > 0 && !bad(l));
  // A line started but not whole (a price and no words, an amount that won't read): nothing is made until it is.
  const unfinished = clean.some((l, i) => (l.description || lines[i].unit_price.trim()) && !(l.description && l.quantity > 0 && !bad(l)));
  const t = totals(good, d.vatRate, d.pricesIncludeVat);
  const ready = good.length > 0 && !unfinished && !!issue;
  const setLine = (i: number, k: keyof Draft, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  // Figures only: digits, commas and points.
  const figure = (v: string) => v.replace(/[^\d.,]/g, "");
  const create = () => ready && onCreate({ issueDate: issue, lines: good, note: note.trim(), sent, repeat, template: tpl });
  const useTemplate = (x: InvoiceTemplate) => {
    setLines(x.lines.length ? x.lines.map(draftOf) : [blankLine()]);
    setNote(x.note ?? "");
    setTpl(x.name);
  };

  return (
    <DialogContent className="dlh riv-new">
      <div className="dlh-head">
        <DialogTitle className="dlh-title">New invoice</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <div className="riv-sub">
        <DialogDescription className="dlh-what">
          <SepJoin parts={[d.nextNumber, clientName]} />
        </DialogDescription>
        <TemplatePicker templates={templates} current={tpl} lines={good} note={note.trim()} onUse={useTemplate} onSaved={(list, name) => (setTemplates(list), setTpl(name))} onDeleted={(list) => setTemplates(list)} />
      </div>

      <div className="riv-dates">
        <div className="riv-field">
          <span className="dlh-label">Issued</span>
          <DatePick value={issue} onChange={setIssue} label="Issued" className="riv-daypick" />
        </div>
        <div className="riv-field">
          <span className="dlh-label">Due</span>
          <span className="riv-static">
            <SepJoin parts={[issue ? dayMonth(addDays(issue, d.termsDays)) : "–", <small key="in">in {d.termsDays} days</small>]} />
          </span>
        </div>
      </div>

      <div className="riv-field">
        <span className="dlh-label">
          <SepJoin parts={["Lines", <small key="vat">Prices {d.pricesIncludeVat ? "include" : "exclude"} {d.taxLabel.toLowerCase()}</small>]} />
        </span>
        <div className="riv-lines">
          <div className="riv-line head" aria-hidden="true">
            <span>Description</span>
            <span>Qty</span>
            <span>Price</span>
            <span>Amount</span>
            <span />
          </div>
          {lines.map((l, i) => {
            const c = clean[i];
            return (
              <div key={i} className="riv-line">
                {/* Every reason Create waits shows on its line: words missing beside a price, a quantity of nothing, a figure that won't read. */}
                <input className={`riv-in${!c.description && l.unit_price.trim() ? " bad" : ""}`} value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} placeholder={i === 0 ? "Coaching, {month}" : "Another line"} maxLength={200} autoFocus={i === 0} aria-label="Description" />
                <input className={`riv-in num${!Number.isFinite(c.quantity) || (c.description && c.quantity <= 0) ? " bad" : ""}`} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, "quantity", figure(e.target.value))} aria-label="Quantity" />
                <input className={`riv-in num${Number.isFinite(c.unit_price) ? "" : " bad"}`} inputMode="decimal" value={l.unit_price} onChange={(e) => setLine(i, "unit_price", figure(e.target.value))} placeholder="0.00" aria-label="Price" />
                <span className="riv-amount">{bad(c) ? "–" : money(cents(c.quantity * c.unit_price), d.currency)}</span>
                <button type="button" className="riv-x" onClick={() => setLines((ls) => (ls.length === 1 ? [blankLine()] : ls.filter((_, j) => j !== i)))} aria-label="Remove this line" title="Remove">
                  ✕
                </button>
              </div>
            );
          })}
          <button type="button" className="riv-addline" onClick={() => setLines((ls) => [...ls, blankLine()])}>
            <PlusIcon /> Line
          </button>
          <dl className="riv-totals">
            <dt>Subtotal</dt>
            <dd>{money(t.subtotal, d.currency)}</dd>
            <dt>
              {d.taxLabel} {d.vatRate}%
            </dt>
            <dd>{money(t.vat, d.currency)}</dd>
            <dt className="grand">Total</dt>
            <dd className="grand">{money(t.total, d.currency)}</dd>
          </dl>
        </div>
      </div>

      <label className="riv-field">
        <span className="dlh-label">Note</span>
        <textarea className="dlh-line riv-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Thank you" maxLength={600} />
      </label>

      <div className="riv-twin">
        <div className="riv-field">
          <span className="dlh-label">
            <SepJoin parts={["Repeat", repeat && issue ? <small key="next">next {dayMonth(firstNext(issue, repeat, plan.today))}</small> : null]} />
          </span>
          <div className="rd-btn-group riv-cap" role="radiogroup" aria-label="Repeat">
            {EVERY.map((e) => (
              <button key={e.label} type="button" role="radio" aria-checked={repeat === e.value} className={repeat === e.value ? "on" : ""} onClick={() => setRepeat(e.value)}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <div className="riv-field">
          {/* With Repeat, the same goes for every one it makes: Sent goes to the client by itself, Not sent waits for you. */}
          <span className="dlh-label">{repeat ? `Each one` : "Status"}</span>
          <div className="rd-btn-group riv-cap" role="radiogroup" aria-label="Status">
            {[false, true].map((v) => (
              <button key={String(v)} type="button" role="radio" aria-checked={sent === v} className={sent === v ? "on" : ""} onClick={() => setSent(v)}>
                {v ? (repeat ? `Sent to ${firstName}` : "Sent") : repeat ? "Draft" : "Not sent"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dlh-foot">
        <DialogClose className="dlh-cancel">Cancel</DialogClose>
        <button type="button" className="dlh-go" disabled={!ready} onClick={create}>
          Create
        </button>
      </div>
    </DialogContent>
  );
}

// ---- Templates (21 Oct, Alex): the coach's saved invoices, a floating list (design rules 6): a pick fills the lines
// and the note; "Save as template" at its foot names what is typed now (the same name replaces one), ✕ removes one
// (asked first, in place).
function TemplatePicker({
  templates,
  current,
  lines,
  note,
  onUse,
  onSaved,
  onDeleted,
}: {
  templates: InvoiceTemplate[];
  current: string | null;
  lines: InvoiceLine[];
  note: string;
  onUse: (t: InvoiceTemplate) => void;
  onSaved: (list: InvoiceTemplate[], name: string) => void;
  onDeleted: (list: InvoiceTemplate[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      const n = name.trim();
      const r = await saveInvoiceTemplateAction({ name: n, lines, note });
      if (!r.ok) {
        toast.error("Couldn't save it");
        return;
      }
      onSaved(r.list, n);
      setNaming(false);
      setOpen(false);
      toast.success(`Saved as ${n}`);
    });
  const remove = (t: InvoiceTemplate) =>
    start(async () => {
      const list = await deleteInvoiceTemplateAction(t.id);
      onDeleted(list);
      setAsking(null);
    });
  return (
    // Modal: inside the New invoice dialog, the list takes the top scroll lock, so the wheel and a finger scroll it.
    <Popover
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setNaming(false);
          setAsking(null);
        }
      }}
    >
      <PopoverTrigger className="riv-tpl-btn" aria-label={`Template${current ? `: ${current}` : ""}`}>
        <span>{current ?? "Template"}</span>
        <ChevronDownIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="pb-menu riv-tpl-pop">
        {naming ? (
          <div className="riv-tpl-new">
            <span className="dlh-label">Save as template</span>
            <input className="dlh-line" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && lines.length > 0 && !busy && save()} placeholder="Monthly coaching" maxLength={60} autoFocus aria-label="Template name" />
            <div className="riv-tpl-foot">
              <button type="button" className="dlh-cancel" onClick={() => setNaming(false)}>
                Cancel
              </button>
              <button type="button" className="dlh-go" disabled={!name.trim() || lines.length === 0 || busy} onClick={save}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="riv-tpl-list">
              {templates.length === 0 ? (
                <p className="riv-tpl-none">None yet</p>
              ) : (
                templates.map((t) =>
                  asking === t.id ? (
                    <div key={t.id} className="riv-tpl-row ask">
                      <span>Remove {t.name}?</span>
                      <button type="button" className="riv-tpl-act" onClick={() => setAsking(null)}>
                        Cancel
                      </button>
                      <button type="button" className="riv-tpl-act danger" disabled={busy} onClick={() => remove(t)}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div key={t.id} className={`riv-tpl-row${t.name === current ? " on" : ""}`}>
                      <button
                        type="button"
                        className="riv-tpl-pick"
                        onClick={() => {
                          onUse(t);
                          setOpen(false);
                        }}
                      >
                        <b>{t.name}</b>
                        <small>
                          <SepJoin parts={[t.lines[0]?.description, t.lines.length > 1 ? `+ ${t.lines.length - 1} more` : null]} />
                        </small>
                      </button>
                      <button type="button" className="riv-tpl-x" onClick={() => setAsking(t.id)} aria-label={`Remove ${t.name}`} title="Remove">
                        ✕
                      </button>
                    </div>
                  )
                )
              )}
            </div>
            {/* Pinned at the foot, outside the list's scroll (design rules 6). */}
            <button
              type="button"
              className="riv-tpl-save"
              disabled={lines.length === 0}
              onClick={() => {
                setName(current ?? "");
                setNaming(true);
              }}
            >
              <PlusIcon /> Save as template
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
