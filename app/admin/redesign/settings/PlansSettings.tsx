"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addPlanAction, deletePlanAction, setPlanArchivedAction, updatePlanAction } from "../../../lib/planActions";
import type { InvoiceEvery } from "../../../lib/db";
import { PLAN_EVERY, planFacts, type PlanChoice } from "../../../lib/planText";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog } from "../../../components/ui/dialog";
import { MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { SepJoin } from "../Sep";
import { ConfirmDialog } from "../training/TrainingDraft";
import { Section } from "./SettingsForms";

// Settings, Plans (28 Oct, Alex: mockup A, docs/boards/coaching-plans-mockup.html): the plans the coach offers, a row
// each in one hairline card: the name semi-bold, its price and rhythm, how many clients are on it grey. A click on a
// row types it in place (the name, the price, how often as the capsule; Cancel in words and an ink Save); + Plan adds a
// row the same way at the card's foot. Each change saved at once, as the logo is, not on the page's bar. ⋯ on hover:
// Archive (out of the Details picker; the clients on it stay on it and are still billed) or Restore, and Delete for a
// plan no client is on (asked first). A new price is for new clients: those billed keep theirs (coachPlans.ts).

export type PlanRow = PlanChoice & { archived: boolean; clients: number };
type Draft = { name: string; price: string; every: InvoiceEvery };

const priceOf = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
const priceBad = (s: string) => {
  const n = priceOf(s);
  return n != null && !(Number.isFinite(n) && n >= 0);
};

export default function PlansSettings({ plans, currency, vatFact }: { plans: PlanRow[]; currency: string; vatFact: string | null }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  // The row being typed in: a plan's id, or "new" for the one being added.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", price: "", every: "month" });
  const [deleting, setDeleting] = useState<PlanRow | null>(null);
  const sorted = [...plans.filter((p) => !p.archived), ...plans.filter((p) => p.archived)];

  const open = (p: PlanRow | null) => {
    setDraft(p ? { name: p.name, price: p.price != null ? String(p.price) : "", every: p.every ?? "month" } : { name: "", price: "", every: "month" });
    setEditing(p ? p.id : "new");
  };
  const run = (fn: () => Promise<unknown>, said: string | ((r: unknown) => string | null)) =>
    start(async () => {
      const r = await fn();
      const words = typeof said === "string" ? said : said(r);
      router.refresh();
      if (words) toast.success(words);
      else toast.error("Not saved. Try again.");
    });
  const save = () => {
    const name = draft.name.trim();
    if (!name || priceBad(draft.price)) return;
    const v = { name, price: priceOf(draft.price), every: draft.every };
    const id = editing;
    setEditing(null);
    if (id === "new") run(() => addPlanAction(v), (r) => (r ? `${name} added` : null));
    else if (id) run(() => updatePlanAction(id, v), (r) => (r ? "Saved" : null));
  };

  const form = (key: string) => (
    <form
      key={key}
      className="rst-plan-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
    >
      <label className="rst-field">
        <span className="dlh-label">Name</span>
        <input className="dlh-line" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} placeholder="Online coaching" />
      </label>
      <label className="rst-field rst-plan-price">
        <span className="dlh-label">Price</span>
        <input className={`dlh-line${priceBad(draft.price) ? " bad" : ""}`} inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.,]/g, "") })} placeholder={currency} />
      </label>
      <div className="rd-btn-group rst-plan-every" role="radiogroup" aria-label="How often">
        {PLAN_EVERY.map((e) => (
          <button key={e.value} type="button" role="radio" aria-checked={draft.every === e.value} className={draft.every === e.value ? "on" : ""} onClick={() => setDraft({ ...draft, every: e.value })}>
            {e.label}
          </button>
        ))}
      </div>
      <span className="rst-plan-foot">
        <button type="button" className="dlh-cancel" onClick={() => setEditing(null)}>
          Cancel
        </button>
        <button type="submit" className="dlh-go" disabled={!draft.name.trim() || priceBad(draft.price) || busy}>
          {key === "new" ? "Add" : "Save"}
        </button>
      </span>
    </form>
  );

  return (
    <Section
      title="Your plans"
      fact={vatFact}
      actions={
        <button type="button" className="trn-pill rst-pill" onClick={() => open(null)} disabled={editing === "new"}>
          <PlusIcon /> Plan
        </button>
      }
    >
      <div className="rls-card rst-card rst-plans">
        {sorted.length === 0 && editing !== "new" && <p className="rls-none">None yet</p>}
        {sorted.map((p) =>
          editing === p.id ? (
            form(p.id)
          ) : (
            <div key={p.id} className={`rst-plan${p.archived ? " archived" : ""}`} onClick={(e) => !(e.target as HTMLElement).closest("button, [role=menuitem]") && open(p)}>
              <b>{p.name}</b>
              <span className="rst-plan-facts">{planFacts(p, currency).length ? <SepJoin parts={planFacts(p, currency)} /> : <span className="faint">No price</span>}</span>
              <span className="rst-plan-n">{p.archived ? "Archived" : p.clients === 0 ? "None" : `${p.clients} client${p.clients === 1 ? "" : "s"}`}</span>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="trn-row-more" aria-label={`More for ${p.name}`}>
                  <MoreIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="pb-menu">
                  <DropdownMenuItem onSelect={() => run(() => setPlanArchivedAction(p.id, !p.archived), (r) => (r ? (p.archived ? `${p.name} restored` : `${p.name} archived`) : null))}>{p.archived ? "Restore" : "Archive"}</DropdownMenuItem>
                  {p.clients === 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
                        <TrashIcon /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        )}
        {editing === "new" && form("new")}
      </div>
      <Dialog open={deleting != null} onOpenChange={(o) => !o && setDeleting(null)}>
        {deleting && (
          <ConfirmDialog
            title={`Delete ${deleting.name}?`}
            description="This permanently deletes the plan. It can't be undone."
            confirm="Delete"
            danger
            onConfirm={() => {
              const p = deleting;
              setDeleting(null);
              run(() => deletePlanAction(p.id), (r) => (r ? `${p.name} deleted` : null));
            }}
          />
        )}
      </Dialog>
    </Section>
  );
}
