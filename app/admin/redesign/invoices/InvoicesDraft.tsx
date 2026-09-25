"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createInvoiceAction, deleteInvoiceAction, setInvoiceStatusByIdAction } from "../../../lib/actions";
import type { InvoiceLine } from "../../../lib/db";
import type { InvoiceView } from "../../../lib/queries";
import { Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/basics";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Switch } from "../../../components/ui/form";
import { ArrowRightIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import DatePick from "../DatePick";
import Picker from "../Picker";
import type { DraftInvoices } from "../loaders";

// A client's invoices: every one with its number, dates, total and where it
// stands, and a new one made from Settings (numbering, VAT, payment terms).
// Each opens as the page that prints, with the coach's business and bank on it.

type Status = InvoiceView["status"];
const STATUS: { value: Status; label: string }[] = [
  { value: "unpaid", label: "Not sent" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "due", label: "Overdue" },
];

export const money = (n: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n || 0);
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const cents = (n: number) => Math.round(n * 100) / 100;
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

export default function InvoicesDraft({ clientId, firstName, clientName, plan }: { clientId: number; firstName: string; clientName: string; plan: DraftInvoices }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const act = (fn: () => Promise<unknown>, said: string) =>
    start(async () => {
      await fn();
      router.refresh();
      toast.success(said);
    });

  const cur = plan.defaults.currency;
  const open = plan.invoices.filter((i) => i.status !== "paid");
  const outstanding = open.reduce((s, i) => s + i.total, 0);
  const paid = plan.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);

  return (
    <div className="rd riv">
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Invoices</span>
          <h1 className="rd-title">{firstName}&rsquo;s invoices</h1>
        </div>
        <div className="rd-head-actions">
          <button type="button" className="rd-btn primary" onClick={() => setAdding(true)}>
            <PlusIcon /> New invoice
          </button>
        </div>
      </header>

      {plan.missing.length > 0 && (
        <p className="riv-missing">
          Your invoices still need your {plan.missing.join(", ").replace(/, ([^,]*)$/, " and $1")}.{" "}
          <Link href={plan.missing.includes("bank details") && plan.missing.length === 1 ? "/admin/redesign/settings/invoicing" : "/admin/redesign/settings/business"}>Add them in Settings</Link>
        </p>
      )}

      <div className="riv-stats">
        <Card>
          <CardContent className="riv-stat">
            <small>Outstanding</small>
            <b className={outstanding > 0 ? "warn" : ""}>{money(outstanding, cur)}</b>
            <span>
              {open.length} invoice{open.length === 1 ? "" : "s"}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="riv-stat">
            <small>Paid</small>
            <b>{money(paid, cur)}</b>
            <span>all time</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="riv-stat">
            <small>Next number</small>
            <b>{plan.defaults.nextNumber}</b>
            <span>
              {plan.defaults.taxLabel} {plan.defaults.vatRate}% · {plan.defaults.termsDays} days to pay
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        {plan.invoices.length === 0 ? (
          <CardContent className="riv-empty">No invoices for {firstName} yet.</CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>What for</TableHead>
                <TableHead className="riv-num">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.invoices.map((inv) => {
                const late = inv.status === "sent" && !!inv.dueDate && inv.dueDate < plan.today;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="riv-number">
                      {inv.number}
                      {inv.paidVia === "stripe" && <small className="riv-online">paid online</small>}
                    </TableCell>
                    <TableCell>{shortDate(inv.issueDate)}</TableCell>
                    <TableCell className={late ? "riv-late" : ""}>{inv.dueDate ? shortDate(inv.dueDate) : "–"}</TableCell>
                    <TableCell className="riv-what">
                      {inv.lines[0]?.description}
                      {inv.lines.length > 1 && <small> + {inv.lines.length - 1} more</small>}
                    </TableCell>
                    <TableCell className="riv-num">{money(inv.total, inv.currency)}</TableCell>
                    <TableCell>
                      <Picker value={inv.status} options={STATUS} label="Status" className={`riv-status s-${late ? "due" : inv.status}`} onChange={(v) => act(() => setInvoiceStatusByIdAction(inv.id, v), `${inv.number} · ${STATUS.find((s) => s.value === v)?.label}`)} />
                    </TableCell>
                    <TableCell className="riv-actions">
                      <Link href={`/admin/redesign/invoices/${inv.id}`} target="_blank" className="riv-open">
                        Open <ArrowRightIcon />
                      </Link>
                      {inv.status === "unpaid" && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${inv.number}`}>
                            <MoreIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="pb-menu">
                            <DropdownMenuItem variant="destructive" onSelect={() => act(() => deleteInvoiceAction(inv.id), `${inv.number} removed`)}>
                              <TrashIcon /> Remove (not sent yet)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && (
          <NewInvoiceDialog
            clientName={clientName}
            plan={plan}
            onCreate={(v) => {
              setAdding(false);
              start(async () => {
                const id = await createInvoiceAction(clientId, v);
                router.refresh();
                if (id) toast.success(`${plan.defaults.nextNumber} created`, { action: { label: "Open", onClick: () => window.open(`/admin/redesign/invoices/${id}`, "_blank") } });
                else toast.error("Couldn't create it");
              });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

// ---- A new invoice, in the New client dialog's layout.
function NewInvoiceDialog({ clientName, plan, onCreate }: { clientName: string; plan: DraftInvoices; onCreate: (v: { issueDate: string; lines: InvoiceLine[]; note: string; sent: boolean }) => void }) {
  const d = plan.defaults;
  const [issue, setIssue] = useState(plan.today);
  const [lines, setLines] = useState<{ description: string; quantity: string; unit_price: string }[]>([{ description: "", quantity: "1", unit_price: "" }]);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const clean = lines.map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0 }));
  const good = clean.filter((l) => l.description && l.quantity > 0);
  const t = totals(good, d.vatRate, d.pricesIncludeVat);
  const missing = [good.length === 0 && "a line with what it is for", !issue && "the day"].filter(Boolean) as string[];
  const setLine = (i: number, k: "description" | "quantity" | "unit_price", v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const create = () => missing.length === 0 && onCreate({ issueDate: issue, lines: good, note: note.trim(), sent });

  return (
    <DialogContent className="ncd riv-dlg" aria-describedby={undefined}>
      <header className="ncd-head">
        <div>
          <DialogTitle className="ncd-title">New invoice</DialogTitle>
          <DialogDescription className="ncd-sub">
            {d.nextNumber} · for {clientName}
          </DialogDescription>
        </div>
        <DialogClose className="cc-dialog-x" aria-label="Close">
          ×
        </DialogClose>
      </header>

      <div className="ncd-body">
        <div className="nc-grid">
          <div className="nc-row">
            <span className="nc-label">Issued</span>
            <span className="nc-control">
              <DatePick value={issue} onChange={setIssue} label="Issued" className="ncd-flat" />
            </span>
          </div>
          <div className="nc-row">
            <span className="nc-label">
              Due <span className="ncd-aside">{d.termsDays} days, from Settings</span>
            </span>
            <span className="nc-control nc-static">{issue ? shortDate(addDays(issue, d.termsDays)) : "–"}</span>
          </div>

          <div className="nc-row full riv-lines">
            <span className="nc-label">
              What for <span className="ncd-aside">prices {d.pricesIncludeVat ? "include" : "exclude"} {d.taxLabel}</span>
            </span>
            <div className="riv-line head" aria-hidden="true">
              <span>Description</span>
              <span>Qty</span>
              <span>Price</span>
              <span>Amount</span>
              <span />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="riv-line">
                <input className="nc-input" value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} placeholder={i === 0 ? "Coaching, October" : "Another line"} maxLength={200} autoFocus={i === 0} aria-label="Description" />
                <input className="nc-input" type="number" inputMode="decimal" min={0} step="any" value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} aria-label="Quantity" />
                <input className="nc-input" type="number" inputMode="decimal" min={0} step="0.01" value={l.unit_price} onChange={(e) => setLine(i, "unit_price", e.target.value)} placeholder="0.00" aria-label="Price" />
                <span className="riv-line-amt">{money(cents((Number(l.quantity) || 0) * (Number(l.unit_price) || 0)), d.currency)}</span>
                <button type="button" className="rd-btn ghost sm" onClick={() => setLines((ls) => (ls.length === 1 ? [{ description: "", quantity: "1", unit_price: "" }] : ls.filter((_, j) => j !== i)))} aria-label="Remove this line">
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="riv-addline" onClick={() => setLines((ls) => [...ls, { description: "", quantity: "1", unit_price: "" }])}>
              <PlusIcon /> Add a line
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

          <label className="nc-row full">
            <span className="nc-label">
              Note <span className="ncd-aside">printed under the lines</span>
            </span>
            <span className="nc-control">
              <textarea className="nc-input ncd-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={600} />
            </span>
          </label>

          <label className="nc-row full">
            <span className="nc-label">Sent to {clientName.split(" ")[0]}</span>
            <span className="nc-control ncd-switch">
              <Switch checked={sent} onCheckedChange={setSent} aria-label="Already sent" />
              <span>{sent ? "Yes: it is marked Sent, and your details on it are fixed" : "Not yet: it stays Not sent until you mark it"}</span>
            </span>
          </label>
        </div>
      </div>

      <footer className="ncd-foot">
        <span className={`ncd-status${missing.length ? " bad" : ""}`}>{missing.length ? `Still needed: ${missing.join(", ")}` : `Total ${money(t.total, d.currency)}`}</span>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={missing.length > 0} onClick={create}>
          Create invoice
        </button>
      </footer>
    </DialogContent>
  );
}
