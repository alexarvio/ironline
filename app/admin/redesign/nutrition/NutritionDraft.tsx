"use client";

import Pager from "../Pager";
import { useEffect, useState, useTransition } from "react";
import type React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { addClientPhaseAction, applySupplementChangesAction, deployPhaseNowAction, saveAndSchedulePhaseAction, saveCoachNutritionNoteAction, saveNutritionTargetsAction, sendChatMessageAction, unschedulePhaseAction, updateClientPhaseAction } from "../../../lib/actions";
import type { MessageLink } from "../../../lib/messageLinks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/basics";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { CalendarIcon, CameraIcon, ChatIcon, ChevronDownIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import type { LoggedDay, LoggedDaysView, LoggedMeal, MealComment } from "../../../lib/queries";
import DatePick from "../DatePick";
import { ConfirmDialog, MessageDialog, fmtDate, stateLabel } from "../training/TrainingDraft";
import PhaseDatesDialog from "../PhaseDatesDialog";
import PhaseGoalsCard from "../PhaseGoalsCard";
import CoachNoteCard from "../CoachNoteCard";
import { SortableItem, SortableList } from "../Sortable";

// The calmer Nutrition tab, as a draft on real data, cut like the Training
// draft: the same header, the same white cards, the same grid rows with the
// headings flush over their figures and no lines between the columns.
//
// - Daily targets: one row a day type (or one row for every day), protein,
//   carbs and fat typed in, the kcal derived. A water goal under them.
// - Supplements: one row an item, "+ Add item" as a dashed pill like a session.
// - What the client logged: four figures, then one row a day, twenty to a
//   page. A day opens into its meals and their foods; a camera on a meal
//   opens the picture, where the coach can leave a comment.
// Nothing here saves: every action ends in a toast.

type State = "live" | "past" | "scheduled" | "draft";
export type Macros = {
  protein: number | null;
  carbs: number | null;
  fats: number | null;
};
export type DraftSupplement = {
  id: number;
  name: string;
  quantity: string;
  timing: string;
  notes: string;
};
export type DraftNutrition = {
  id: number;
  /** The coach's goals for the phase, up to three. */
  goals: string[];
  phases: { id: number; name: string; weeks: number; state: State }[];
  name: string;
  status: State;
  weeks: number;
  weekIdx: number | null;
  startDate: string | null;
  endDate: string | null;
  training: Macros;
  rest: Macros;
  /** The coach's note on the targets: why these numbers, what to watch. */
  note: string;
  waterL: number | null;
  supplements: DraftSupplement[];
  logged: LoggedDaysView;
};

const savedToast = (what: string) => toast.success("Saved", { description: what });
/** A phase's fields as the actions read them. */
// exact: start and end are the first and last day, kept as they are (the
// Dates dialog picks days); otherwise any day of the first and last week.
const phaseForm = (v: { id?: number; clientId?: number; track: string; name: string; start: string; end: string; exact?: boolean }) => {
  const f = new FormData();
  if (v.id != null) f.set("id", String(v.id));
  if (v.clientId != null) f.set("clientId", String(v.clientId));
  f.set("track", v.track);
  f.set("name", v.name);
  f.set("start", v.start);
  f.set("end", v.end);
  if (v.exact) {
    f.set("firstDay", v.start);
    f.set("lastDay", v.end);
  }
  return f;
};
const plusWeeks = (start: string, weeks: number) => {
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + Math.max(0, weeks - 1) * 7);
  return d.toISOString().slice(0, 10);
};
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const ON_TARGET = 200;
const PAGE = 20;
const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

type MacroText = { protein: string; carbs: string; fats: string };
const textOf = (m: Macros): MacroText => ({
  protein: m.protein == null ? "" : String(m.protein),
  carbs: m.carbs == null ? "" : String(m.carbs),
  fats: m.fats == null ? "" : String(m.fats),
});
const num = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(",", ".")) || 0);
const kcalOf = (m: MacroText) => num(m.protein) * 4 + num(m.carbs) * 4 + num(m.fats) * 9;
const sameMacros = (a: MacroText, b: MacroText) => a.protein === b.protein && a.carbs === b.carbs && a.fats === b.fats;
const isEmpty = (m: MacroText) => !m.protein && !m.carbs && !m.fats;

type Targets = {
  same: boolean;
  training: MacroText;
  rest: MacroText;
  water: string;
  note: string;
};
type Dlg = { kind: "photo"; date: string; meal: string } | { kind: "message"; label: string; link: MessageLink } | { kind: "dates" } | { kind: "newPhase" } | { kind: "deploy" } | { kind: "backToDraft" } | null;

export default function NutritionDraft({ clientId, firstName, plan }: { clientId: number; firstName: string; plan: DraftNutrition }) {
  // ---- Targets: typed into in place, queued on the card's bar until Apply.
  const initial: Targets = {
    same: sameMacros(textOf(plan.training), textOf(plan.rest)) || isEmpty(textOf(plan.rest)),
    training: textOf(plan.training),
    rest: textOf(plan.rest),
    water: plan.waterL == null ? "" : String(plan.waterL),
    note: plan.note,
  };
  const [saved, setSaved] = useState(initial);
  const [t, setT] = useState(initial);
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Every save goes to the server, then the page re-reads; what is on screen follows.
  const act = (fn: () => Promise<unknown>, said?: string) =>
    startTransition(async () => {
      await fn();
      router.refresh();
      if (said) savedToast(said);
    });
  // Reset only when what is saved actually changed: every re-read of the
  // page (a save on another card) hands in new objects with the same values,
  // and resetting on those wiped edits not yet applied.
  const planKey = JSON.stringify([plan.id, initial]);
  const [seenPlan, setSeenPlan] = useState(planKey);
  if (seenPlan !== planKey) {
    setSeenPlan(planKey);
    setSaved(initial);
    setT(initial);
  }
  const phaseId = plan.id > 0 ? plan.id : null;
  const targetChanges = (t.same !== saved.same ? 1 : 0) + (sameMacros(t.training, saved.training) ? 0 : 1) + (!t.same && !sameMacros(t.rest, saved.rest) ? 1 : 0) + (t.water !== saved.water ? 1 : 0);
  const trainingKcal = kcalOf(t.training);
  const restKcal = t.same ? trainingKcal : kcalOf(t.rest);

  // ---- Supplements: a working copy against the saved list.
  const [suppSaved, setSuppSaved] = useState(plan.supplements);
  const [supps, setSupps] = useState(plan.supplements);
  const suppsKey = JSON.stringify(plan.supplements);
  const [seenSupps, setSeenSupps] = useState(suppsKey);
  if (seenSupps !== suppsKey) {
    setSeenSupps(suppsKey);
    setSuppSaved(plan.supplements);
    setSupps(plan.supplements);
  }
  const suppChanges = (() => {
    const before = new Map(suppSaved.map((s) => [s.id, s]));
    let c = suppSaved.filter((s) => !supps.some((x) => x.id === s.id)).length;
    for (const s of supps) {
      const b = before.get(s.id);
      // A fresh row counts once something is typed into it, not the moment it appears.
      if (!b) c += s.name.trim() || s.quantity.trim() || s.timing.trim() || s.notes.trim() ? 1 : 0;
      else if (b.name !== s.name || b.quantity !== s.quantity || b.timing !== s.timing || b.notes !== s.notes) c += 1;
    }
    // The order, judged on the rows that are saved: a fresh empty row at the foot is not a reorder.
    if (c === 0 && supps.filter((s) => before.has(s.id)).some((s, i) => suppSaved[i]?.id !== s.id)) c = 1;
    return c;
  })();
  const editSupp = (id: number, f: Partial<DraftSupplement>) => setSupps((prev) => prev.map((s) => (s.id === id ? { ...s, ...f } : s)));
  // A drop sets the new order; it is saved with the rest on Apply.
  const moveSupps = (ids: (number | string)[]) => setSupps((prev) => ids.map((id) => prev.find((x) => x.id === id)!).filter(Boolean));

  // ---- The log: one day open at a time, twenty days a page.
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const view = plan.logged;
  const pages = Math.max(1, Math.ceil(view.days.length / PAGE));
  const at = Math.min(page, pages);
  const from = (at - 1) * PAGE;
  const days = view.days.slice(from, from + PAGE);
  // Arriving from a link in a message (#day-YYYY-MM-DD): that day's page,
  // the day unfolded and in view. After the first paint, so the server's
  // closed rows match.
  useEffect(() => {
    const m = /^#day-(\d{4}-\d{2}-\d{2})$/.exec(window.location.hash);
    if (!m) return;
    const date = m[1];
    const idx = view.days.findIndex((d) => d.date === date);
    if (idx < 0) return;
    const frame = requestAnimationFrame(() => {
      setPage(Math.floor(idx / PAGE) + 1);
      setOpen(date);
      setTimeout(() => document.getElementById(`day-${date}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    });
    return () => cancelAnimationFrame(frame);
  }, [view.days]);
  // Comments left here, under the meal they were left on.
  const [said, setSaid] = useState<Record<string, MealComment[]>>({});
  const commentsOn = (d: string, m: LoggedMeal) => [...m.comments, ...(said[`${d}|${m.id}`] ?? [])];

  const [dlg, setDlg] = useState<Dlg>(null);
  const close = () => setDlg(null);
  const photoOf = dlg?.kind === "photo" ? (view.days.find((d) => d.date === dlg.date)?.meals.find((m) => m.id === dlg.meal) ?? null) : null;

  const proteinTarget = view.days.find((d) => d.proteinTarget != null)?.proteinTarget ?? null;
  const stats = [
    {
      label: "Days logged",
      value: String(view.days.length),
      unit: view.windowDays ? `of ${view.windowDays} in this phase` : "in this phase",
      warn: view.windowDays > 0 && view.days.length < view.windowDays * 0.6,
    },
    {
      label: "Average intake",
      value: view.avgKcal != null ? n(view.avgKcal) : "–",
      unit: "kcal a day",
    },
    {
      label: "On target",
      value: view.judged ? `${view.onTarget} of ${view.judged}` : "–",
      unit: `within ±${ON_TARGET} kcal`,
      warn: view.judged > 0 && view.onTarget < view.judged / 2,
    },
    {
      label: "Average protein",
      value: view.avgProtein != null ? String(view.avgProtein) : "–",
      unit: proteinTarget ? `g a day · target ${proteinTarget}` : "g a day",
      warn: proteinTarget != null && view.avgProtein != null && view.avgProtein < proteinTarget - 20,
    },
  ];

  const today = new Date().toISOString().slice(0, 10);
  const startHasCome = !!plan.startDate && plan.startDate <= today;
  // Which day type the ring and the row show; with the tick on, only training is kept.
  const [day, setDay] = useState<"training" | "rest">("training");
  const shown = t.same ? "training" : day;
  const tGrid = {
    gridTemplateColumns: "minmax(150px, 1fr) 92px 92px 92px",
  } as const;
  const sGrid = {
    gridTemplateColumns: "20px minmax(160px, 1.3fr) 120px 140px minmax(160px, 1.6fr) 32px",
  } as const;
  const lGrid = {
    gridTemplateColumns: "20px 120px 84px 96px 150px minmax(200px, 1fr) 32px",
  } as const;
  const mGrid = {
    gridTemplateColumns: "20px minmax(160px, 1fr) 84px 72px 72px 72px 32px",
  } as const;

  return (
    <div className="rd">
      {/* ---- Header: the phase, where it is, its actions. */}
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Nutrition</span>
          <h1 className="rd-title">
            {plan.phases.length > 1 ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="rd-switch" aria-label="Switch phase">
                  {plan.name}
                  <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="pb-menu rd-switch-menu">
                  {plan.phases.map((p) => (
                    <DropdownMenuItem key={p.id} asChild>
                      <Link href={`/admin/redesign/nutrition?client=${clientId}&phase=${p.id}`} scroll={false} className={p.id === plan.id ? "on" : ""}>
                        <span className="rd-switch-name">{p.name}</span>
                        <span className={`rd-status ${p.state}`}>{stateLabel(p.state)}</span>
                        <small>
                          {p.weeks} {p.weeks === 1 ? "week" : "weeks"}
                        </small>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDlg({ kind: "newPhase" })}>
                    <PlusIcon /> New phase
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              plan.name
            )}
            {plan.weeks > 0 && <span className="rd-title-weeks">({plan.weeks} weeks)</span>}
            <span className={`rd-status ${plan.status}`}>{stateLabel(plan.status)}</span>
          </h1>
          {plan.startDate && (
            <span className="rd-sub">
              {fmtDate(plan.startDate)}
              {plan.endDate && ` – ${fmtDate(plan.endDate)}`}
              {plan.weekIdx != null && ` · week ${plan.weekIdx} of ${plan.weeks}`}
            </span>
          )}
        </div>
        <div className="rd-head-actions">
          {plan.status === "draft" && (
            <button type="button" className="rd-btn primary" onClick={() => setDlg({ kind: "deploy" })}>
              {startHasCome ? "Make it live" : "Schedule it"}
            </button>
          )}
          {plan.status === "scheduled" && (
            <>
              <button type="button" className="rd-btn" onClick={() => setDlg({ kind: "backToDraft" })}>
                Back to draft
              </button>
              <button type="button" className="rd-btn primary" onClick={() => setDlg({ kind: "deploy" })}>
                Make it live now
              </button>
            </>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="rd-btn ghost" aria-label="More for the phase">
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={() => setDlg({ kind: "message", label: plan.name, link: { kind: "nutrition" } })}>
                <ChatIcon /> Message about nutrition
              </DropdownMenuItem>
              {plan.id !== 0 && (
                <DropdownMenuItem onSelect={() => setDlg({ kind: "dates" })}>
                  <CalendarIcon /> Edit dates
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDlg({ kind: "newPhase" })}>
                <PlusIcon /> New phase
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ---- The coach's goals for this phase, shown on the client's Home. */}
      <PhaseGoalsCard phaseId={phaseId} phaseName={plan.name} firstName={firstName} goals={plan.goals} />
      <CoachNoteCard
        firstName={firstName}
        note={saved.note}
        what="nutrition"
        save={async (text) => {
          const f = new FormData();
          f.set("clientId", String(clientId));
          f.set("note", text);
          if (phaseId) f.set("phaseId", String(phaseId));
          await saveCoachNutritionNoteAction(f);
          setSaved((x) => ({ ...x, note: text }));
          setT((x) => ({ ...x, note: text }));
        }}
      />

      {/* ---- Daily targets: the kcal as a ring on the left, split by the
           macros typed in on the right. */}
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>Daily targets</h2>
        </div>
        <div className="rd-rows">
          <div className="rn-targets">
            <div className="rn-rings">
              <Ring label={t.same ? "Every day" : shown === "training" ? "Training days" : "Rest days"} m={t[shown]} />
            </div>
            <div className="rn-tside">
              <div className="rn-daypick">
                {!t.same && (
                  <ToggleGroup type="single" value={shown} onValueChange={(v) => v && setDay(v as "training" | "rest")} aria-label="Day type shown">
                    <ToggleGroupItem value="training">Training</ToggleGroupItem>
                    <ToggleGroupItem value="rest">Rest</ToggleGroupItem>
                  </ToggleGroup>
                )}
                <label className="rd-tick">
                  <input
                    type="checkbox"
                    checked={t.same}
                    onChange={(e) =>
                      setT((x) => ({
                        ...x,
                        same: e.target.checked,
                        rest: e.target.checked ? x.rest : isEmpty(x.rest) ? x.training : x.rest,
                      }))
                    }
                  />
                  Same on training and rest days
                </label>
              </div>
              <div className="rd-cols" aria-hidden="true" style={tGrid}>
                <span>Day</span>
                <span className="p">Protein</span>
                <span className="c">Carbs</span>
                <span className="f">Fat</span>
              </div>
              <div className="rd-row">
                <div className="rd-row-main static" style={tGrid}>
                  <span className="rd-ex">
                    <span className="rd-ex-name">{t.same ? "Every day" : shown === "training" ? "Training days" : "Rest days"}</span>
                    <small>{t.same ? "training and rest alike" : shown === "training" ? `the days ${firstName} trains` : "the days off"}</small>
                  </span>
                  {(["protein", "carbs", "fats"] as const).map((f) => (
                    <Box
                      key={`${shown}-${f}`}
                      value={t[shown][f]}
                      onChange={(v) =>
                        setT((x) => ({
                          ...x,
                          [shown]: { ...x[shown], [f]: v },
                        }))
                      }
                      label={`${f} on ${shown} days`}
                      unit="g"
                    />
                  ))}
                </div>
              </div>
              <div className="rd-row">
                <div className="rd-row-main static" style={tGrid}>
                  <span className="rd-ex">
                    <span className="rd-ex-name">Water</span>
                    <small>a goal, not a tracker</small>
                  </span>
                  <Box value={t.water} onChange={(v) => setT((x) => ({ ...x, water: v }))} label="Water goal" unit="L" placeholder="—" />
                  <span className="rd-num quiet rn-span2">{t.water ? "litres a day" : "no goal set"}</span>
                </div>
              </div>
            </div>
          </div>
          {targetChanges > 0 && (
            <Bar
              count={targetChanges}
              text={`${targetChanges === 1 ? "change" : "changes"} to the targets · ${firstName} sees ${n(trainingKcal)}${t.same ? "" : ` / ${n(restKcal)}`} kcal`}
              onDiscard={() => setT(saved)}
              onApply={() => {
                const next = { ...t, rest: t.same ? t.training : t.rest };
                setSaved(next);
                setT(next);
                const f = new FormData();
                f.set("clientId", String(clientId));
                f.set("t_protein", next.training.protein);
                f.set("t_carbs", next.training.carbs);
                f.set("t_fats", next.training.fats);
                f.set("r_protein", next.rest.protein);
                f.set("r_carbs", next.rest.carbs);
                f.set("r_fats", next.rest.fats);
                f.set("water", next.water);
                if (phaseId) f.set("phaseId", String(phaseId));
                act(() => saveNutritionTargetsAction(f), `Targets: ${n(trainingKcal)}${t.same ? "" : ` / ${n(restKcal)}`} kcal`);
              }}
            />
          )}
        </div>
      </section>

      {/* ---- Supplements: a reference list, one row an item. */}
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>Supplements</h2>
        </div>
        <div className="rd-rows">
          {supps.length > 0 && (
            <div className="rd-cols" aria-hidden="true" style={sGrid}>
              <span />
              <span>Item</span>
              <span>Quantity</span>
              <span>Timing</span>
              <span>Notes</span>
              <span />
            </div>
          )}
          <SortableList ids={supps.map((s) => s.id)} label="supplement" onMove={moveSupps}>
          {supps.map((s) => (
            <SortableItem key={s.id} id={s.id} className={`rd-row${suppSaved.some((x) => x.id === s.id) ? "" : " new"}`}>
              {(suppGrip) => (
              <div className="rd-row-main static rn-wide" style={sGrid}>
                <span className="rd-grip" {...suppGrip}>
                  ⋮⋮
                </span>
                <Box value={s.name} onChange={(v) => editSupp(s.id, { name: v })} label="Item" placeholder="Creatine" strong autoFocus={!s.name} />
                <Box value={s.quantity} onChange={(v) => editSupp(s.id, { quantity: v })} label="Quantity" placeholder="5 g" />
                <Box value={s.timing} onChange={(v) => editSupp(s.id, { timing: v })} label="Timing" placeholder="With breakfast" />
                <Box value={s.notes} onChange={(v) => editSupp(s.id, { notes: v })} label="Notes" placeholder="—" quiet />
                <span className="rd-row-more">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${s.name || "item"}`}>
                      <MoreIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="pb-menu">
                      <DropdownMenuItem variant="destructive" onSelect={() => setSupps((prev) => prev.filter((x) => x.id !== s.id))}>
                        <TrashIcon /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </div>
              )}
            </SortableItem>
          ))}
          </SortableList>
          <button
            type="button"
            className="rd-session add rn-additem"
            onClick={() =>
              setSupps((prev) => [
                ...prev,
                {
                  id: -Date.now(),
                  name: "",
                  quantity: "",
                  timing: "",
                  notes: "",
                },
              ])
            }
          >
            + Add item
          </button>
          {suppChanges > 0 && (
            <Bar
              count={suppChanges}
              text={`${suppChanges === 1 ? "change" : "changes"} to the supplements · ${firstName} sees the list as it is here`}
              onDiscard={() => setSupps(suppSaved)}
              onApply={() => {
                const kept = supps.filter((s) => s.name.trim());
                setSuppSaved(kept);
                setSupps(kept);
                const before = new Map(suppSaved.map((s) => [s.id, s]));
                const changes = {
                  added: kept.filter((s) => s.id < 0).map(({ name, quantity, timing, notes }) => ({ name, quantity, timing, notes })),
                  updated: kept
                    .filter((s) => s.id > 0)
                    .filter((s) => {
                      const b = before.get(s.id);
                      return !b || b.name !== s.name || b.quantity !== s.quantity || b.timing !== s.timing || b.notes !== s.notes;
                    })
                    .map(({ id, name, quantity, timing, notes }) => ({ id, name, quantity, timing, notes })),
                  removedIds: suppSaved.filter((s) => !kept.some((k) => k.id === s.id)).map((s) => s.id),
                  order: kept.filter((s) => s.id > 0).map((s) => s.id),
                };
                act(() => applySupplementChangesAction(clientId, changes), `Supplements: ${kept.length} ${kept.length === 1 ? "item" : "items"}`);
              }}
            />
          )}
        </div>
      </section>

      {/* ---- What the client logged: figures, then one row a day. */}
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>{firstName}&rsquo;s logs</h2>
        </div>
        <div className="rn-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <small>{s.label}</small>
              <b className={s.warn ? "warn" : ""}>{s.value}</b>
              <span>{s.unit}</span>
            </div>
          ))}
        </div>
        {view.days.length > 0 && (
          <div className="rd-rows">
            <div className="rd-cols" aria-hidden="true" style={lGrid}>
              <span />
              <span>Date</span>
              <span>Logged</span>
              <span>Day</span>
              <span>Vs target</span>
              <span>Protein · carbs · fat</span>
              <span />
            </div>
            {days.map((d) => (
              <DayRow
                key={d.date}
                day={d}
                open={open === d.date}
                grid={lGrid}
                mealGrid={mGrid}
                commentsOn={commentsOn}
                onToggle={() => setOpen((x) => (x === d.date ? null : d.date))}
                onShot={(meal) => setDlg({ kind: "photo", date: d.date, meal })}
                onMessage={() =>
                  setDlg({
                    kind: "message",
                    label: `Food diary · ${fmtDay(d.date)}`,
                    link: { kind: "food", date: d.date },
                  })
                }
              />
            ))}
            <Pager
              className="rn-foot"
              page={at}
              pages={pages}
              from={from}
              shown={days.length}
              total={view.days.length}
              noun="days"
              label="Logged day pages"
              onPage={(p) => {
                setPage(p);
                setOpen(null);
              }}
            />
          </div>
        )}
      </section>

      {/* ---- Dialogs. One open at a time. */}
      <Dialog open={dlg != null} onOpenChange={(o) => !o && close()}>
        {dlg?.kind === "photo" && photoOf?.photo && (
          <PhotoDialog
            firstName={firstName}
            date={dlg.date}
            meal={photoOf}
            comments={commentsOn(dlg.date, photoOf)}
            onSend={(text) => {
              setSaid((prev) => ({
                ...prev,
                [`${dlg.date}|${photoOf.id}`]: [...(prev[`${dlg.date}|${photoOf.id}`] ?? []), { id: -Date.now(), text, when: fmtDate(today) }],
              }));
              const f = new FormData();
              f.set("clientId", String(clientId));
              f.set("text", text);
              f.set("link", JSON.stringify({ kind: "food", date: dlg.date, meal: photoOf.id }));
              act(() => sendChatMessageAction(f));
              toast.success("Comment sent", { description: `${firstName} gets a notification and sees it under ${photoOf.label.toLowerCase()}.` });
              close();
            }}
          />
        )}
        {dlg?.kind === "message" && (
          <MessageDialog
            firstName={firstName}
            label={dlg.label}
            onSend={(text) => {
              const { label, link } = dlg;
              close();
              const f = new FormData();
              f.set("clientId", String(clientId));
              f.set("text", text);
              f.set("link", JSON.stringify(link));
              act(() => sendChatMessageAction(f));
              toast.success("Sent", { description: `${firstName} gets it on Home, linked to ${label}.` });
            }}
          />
        )}
        {dlg?.kind === "dates" && (
          <PhaseDatesDialog
            byDay
            title="Dates"
            name={plan.name}
            start={plan.startDate}
            end={plan.endDate}
            firstName={firstName}
            what="these targets"
            confirm="Save dates"
            onConfirm={(v) => {
              close();
              if (phaseId) act(() => updateClientPhaseAction(phaseForm({ id: phaseId, track: "nutrition", name: v.name || plan.name, start: v.start, end: v.end, exact: true })), `${v.name || plan.name}: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
            }}
          />
        )}
        {dlg?.kind === "newPhase" && (
          <NewPhaseDialog
            onCreate={(v) => {
              close();
              const start = v.start || today;
              act(() => addClientPhaseAction(phaseForm({ clientId, track: "nutrition", name: v.name || "New phase", start, end: plusWeeks(start, v.weeks) })), `${v.name || "New phase"} drafted: ${v.weeks} weeks from ${fmtDate(start)}`);
            }}
          />
        )}
        {dlg?.kind === "deploy" && !startHasCome && (
          <PhaseDatesDialog
            byDay
            title={`Schedule ${plan.name}`}
            start={plan.startDate}
            end={plan.endDate}
            firstName={firstName}
            what="these targets"
            confirm="Schedule it"
            onConfirm={(v) => {
              close();
              if (phaseId) act(() => saveAndSchedulePhaseAction(phaseForm({ id: phaseId, track: "nutrition", name: plan.name, start: v.start, end: v.end, exact: true })), `${plan.name} scheduled: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
            }}
          />
        )}
        {dlg?.kind === "deploy" && startHasCome && (
          <ConfirmDialog
            title={`Make ${plan.name} live?`}
            description={`${firstName} sees these targets and supplements from now.`}
            confirm="Make it live"
            onConfirm={() => {
              close();
              if (phaseId) act(() => deployPhaseNowAction(phaseId), `${plan.name} is live`);
            }}
          />
        )}
        {dlg?.kind === "backToDraft" && (
          <ConfirmDialog
            title="Back to draft?"
            description={`${plan.name} comes off ${firstName}'s schedule; only you see it until it is scheduled again.`}
            confirm="Back to draft"
            onConfirm={() => {
              close();
              if (phaseId) act(() => unschedulePhaseAction(phaseId), `${plan.name} is a draft again`);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

/** One editable figure: reads as a figure, types like a box. */
function Box({ value, onChange, label, placeholder, unit, strong, quiet, autoFocus }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; unit?: string; strong?: boolean; quiet?: boolean; autoFocus?: boolean }) {
  return (
    <span className={`rd-cell rn-box${unit ? " unit" : ""}${strong ? " strong" : ""}${quiet ? " quiet" : ""}`}>
      <input className="rd-cell-box" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "—"} aria-label={label} autoFocus={autoFocus} />
      {unit && value !== "" && <em aria-hidden="true">{unit}</em>}
    </span>
  );
}

/** The day's kcal as a ring, split into protein, carbs and fat by the kcal
 *  each brings; the arcs follow the figures as they are typed. */
function Ring({ label, m }: { label: string; m: MacroText }) {
  const p = num(m.protein) * 4;
  const c = num(m.carbs) * 4;
  const f = num(m.fats) * 9;
  const kcal = p + c + f;
  const R = 52;
  const C = 2 * Math.PI * R;
  const total = kcal || 1;
  const arcs = [
    { key: "p", v: p },
    { key: "c", v: c },
    { key: "f", v: f },
  ];
  let at = 0;
  const pct = (v: number) => (kcal ? `${Math.round((v / kcal) * 100)}%` : "—");
  return (
    <div className="rn-ring">
      <div className="rn-ring-dial">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="rn-ring-track" cx="60" cy="60" r={R} />
          {arcs.map((a) => {
            const len = (a.v / total) * C;
            const el = (
              <circle
                key={a.key}
                className={`rn-ring-arc ${a.key}`}
                cx="60"
                cy="60"
                r={R}
                style={{
                  strokeDasharray: `${len} ${C - len}`,
                  strokeDashoffset: -at,
                }}
              />
            );
            at += len;
            return el;
          })}
        </svg>
        <span className="rn-ring-kcal">
          <b>{kcal ? n(kcal) : "—"}</b>
          <small>kcal</small>
        </span>
      </div>
      <span className="rn-ring-label">{label}</span>
      <span className="rn-ring-legend" aria-label={`Protein ${pct(p)}, carbs ${pct(c)}, fat ${pct(f)}`}>
        <i className="p" />
        {pct(p)}
        <i className="c" />
        {pct(c)}
        <i className="f" />
        {pct(f)}
      </span>
    </div>
  );
}

/** The macro split as one line: protein, carbs, fat, by the kcal each brings. */
function Split({ p, c, f }: { p: number; c: number; f: number }) {
  const total = p + c + f || 1;
  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`;
  return (
    <span className="rn-split" aria-hidden="true">
      <i className="p" style={{ width: pct(p) }} />
      <i className="c" style={{ width: pct(c) }} />
      <i className="f" style={{ width: pct(f) }} />
    </span>
  );
}

/** A card's own pending bar, at its foot. */
function Bar({ count, text, onDiscard, onApply }: { count: number; text: string; onDiscard: () => void; onApply: () => void }) {
  return (
    <div className="rd-pending">
      <span className="rd-pending-count">{count}</span>
      <span className="rd-pending-text">{text}</span>
      <button type="button" className="rd-pending-ghost" onClick={onDiscard}>
        Discard
      </button>
      <button type="button" className="rd-pending-apply" onClick={onApply}>
        Apply
      </button>
    </div>
  );
}

function DayRow({ day, open, grid, mealGrid, commentsOn, onToggle, onShot, onMessage }: { day: LoggedDay; open: boolean; grid: React.CSSProperties; mealGrid: React.CSSProperties; commentsOn: (d: string, m: LoggedMeal) => MealComment[]; onToggle: () => void; onShot: (meal: string) => void; onMessage: () => void }) {
  const diff = day.target != null ? day.kcal - day.target : null;
  const onTarget = diff != null && Math.abs(diff) <= ON_TARGET;
  return (
    <div id={`day-${day.date}`} className={`rd-row rn-day${open ? " open" : ""}`}>
      <div className="rd-row-main" style={grid} onClick={onToggle} role="button" tabIndex={0} aria-expanded={open} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle())}>
        <span className={`rd-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
        <span className="rd-ex">
          <span className="rd-ex-name">{fmtDay(day.date)}</span>
          {day.note && <small title={day.note}>{day.note}</small>}
        </span>
        <span className="rd-num">{n(day.kcal)}</span>
        <span>
          <span className={`rd-pill${day.isTraining ? "" : " quiet"}`}>{day.isTraining ? "Training" : "Rest"}</span>
        </span>
        <span>
          <span className={`rd-set rn-vs${diff == null ? "" : onTarget ? " up" : " down"}`}>{diff == null ? "No target" : onTarget ? "On target" : `${diff > 0 ? "+" : "−"}${n(Math.abs(diff))} kcal`}</span>
        </span>
        <span className="rn-macros" title={`${day.protein} g protein · ${day.carbs} g carbs · ${day.fat} g fat`}>
          <Split p={day.protein * 4} c={day.carbs * 4} f={day.fat * 9} />
        </span>
        <span className="rd-row-more" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${fmtDay(day.date)}`}>
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={onMessage}>
                <ChatIcon /> Message about this day
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      {open && (
        <div className="rn-meals">
          <div className="rd-cols rn-mcols" aria-hidden="true" style={mealGrid}>
            <span />
            <span>Meal</span>
            <span>Kcal</span>
            <span className="p">Protein</span>
            <span className="c">Carbs</span>
            <span className="f">Fat</span>
            <span />
          </div>
          {day.meals.map((m) => (
            <div key={m.id} className="rn-meal">
              <div className="rn-meal-head" style={mealGrid}>
                <span />
                <span className="rn-meal-name">{m.label}</span>
                <span className="rd-num">{n(m.kcal)}</span>
                <span className="rd-num">{m.protein} g</span>
                <span className="rd-num">{m.carbs} g</span>
                <span className="rd-num">{m.fat} g</span>
                {/* The camera only where there is a picture: an empty cell
                    otherwise, so every row's figures stay in one column. */}
                {m.photo ? (
                  <button type="button" className={`rd-btn ghost sm rn-shot${commentsOn(day.date, m).length ? " said" : ""}`} onClick={() => onShot(m.id)} title={`${m.label}, photographed`} aria-label={`See the picture of ${m.label}`}>
                    <CameraIcon />
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>
              {m.foods.map((food, i) => (
                <div key={i} className="rn-food" style={mealGrid}>
                  <span />
                  <span className="rn-food-name">
                    {food.name}
                    <small>{food.quantity}</small>
                  </span>
                  <span>{n(food.kcal)}</span>
                  <span>{food.protein}</span>
                  <span>{food.carbs}</span>
                  <span>{food.fat}</span>
                  <span aria-hidden="true" />
                </div>
              ))}
              {commentsOn(day.date, m).map((c) => (
                <p key={c.id} className="rn-said">
                  <b>You · {c.when}</b>
                  {c.text}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The client's picture of one meal, and the coach's word under it. */
function PhotoDialog({ firstName, date, meal, comments, onSend }: { firstName: string; date: string; meal: LoggedMeal; comments: MealComment[]; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <DialogContent className="rd-dlg rn-shotdlg">
      <DialogHeader>
        <DialogTitle>
          {meal.label} · {fmtDay(date)}
        </DialogTitle>
        <DialogDescription>
          {n(meal.kcal)} kcal · {meal.protein} g protein · {meal.carbs} g carbs · {meal.fat} g fat
        </DialogDescription>
      </DialogHeader>
      {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
      <img className="rn-shotimg" src={meal.photo ?? ""} alt={`${meal.label} on ${fmtDay(date)}`} />
      {comments.length > 0 && (
        <div className="rn-saidlist">
          {comments.map((c) => (
            <p key={c.id} className="rn-said">
              <b>You · {c.when}</b>
              {c.text}
            </p>
          ))}
        </div>
      )}
      <label className="rd-field">
        <span>Comment</span>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={`On ${firstName}'s ${meal.label.toLowerCase()}…`} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && send()} />
      </label>
      <DialogFooter>
        <span className="rd-dlg-hint grow">{firstName} gets a notification and sees it under this meal. Ctrl + Enter sends.</span>
        <DialogClose className="rd-btn">Close</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!text.trim()} onClick={send}>
          Send
        </button>
      </DialogFooter>
    </DialogContent>
  );
}


function NewPhaseDialog({ onCreate }: { onCreate: (v: { name: string; weeks: number; start: string }) => void }) {
  const [name, setName] = useState("");
  // Typed, not picked: any whole number of weeks from 1 to 52.
  const [weeksText, setWeeksText] = useState("4");
  const weeks = Math.round(Number(weeksText));
  const weeksOk = Number.isFinite(weeks) && weeks >= 1 && weeks <= 52;
  const [start, setStart] = useState("");
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>New nutrition phase</DialogTitle>
        <DialogDescription>A draft: only you see it until it is scheduled. It lands on the Plan tab&rsquo;s nutrition lane.</DialogDescription>
      </DialogHeader>
      <label className="rd-field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cut A" maxLength={60} autoFocus />
      </label>
      <div className="rd-field-row">
        <label className="rd-field rd-field-weeks">
          <span>Length</span>
          <span className="rd-weeks-field">
            <input type="number" inputMode="numeric" min={1} max={52} step={1} value={weeksText} onChange={(e) => setWeeksText(e.target.value)} aria-label="Length in weeks" />
            <small>{weeksOk && weeks === 1 ? "week" : "weeks"}</small>
          </span>
        </label>
        <label className="rd-field">
          <span>Starts</span>
          <DatePick value={start} onChange={setStart} label="Starts" placeholder="Pick the start" />
        </label>
      </div>
      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!weeksOk} onClick={() => onCreate({ name: name.trim(), weeks, start })}>
          Create draft
        </button>
      </DialogFooter>
    </DialogContent>
  );
}
