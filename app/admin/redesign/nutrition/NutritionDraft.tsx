"use client";

import Pager from "../Pager";
import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { addClientPhaseAction, applySupplementChangesAction, deletePhaseAction, deployPhaseNowAction, saveAndSchedulePhaseOrSayWhyAction, saveCoachNutritionNoteAction, saveNutritionTargetsAction, sendChatMessageAction, unschedulePhaseAction, updateClientPhaseAction } from "../../../lib/actions";
import type { MessageLink } from "../../../lib/messageLinks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { CalendarIcon, CameraIcon, ChatIcon, ChevronDownIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import type { LoggedDay, LoggedDaysView, LoggedMeal, MealComment } from "../../../lib/queries";
import { ConfirmDialog, DeletePhaseDialog, MessageDialog, fmtDate, stateLabel } from "../training/TrainingDraft";
import { GoalsNotePills, GripIcon } from "../training/TrainingParts";
import { stateTagStyle } from "../../phaseChrome";
import PhaseDatesDialog from "../PhaseDatesDialog";
import { PhaseDialog, phaseForm as planPhaseForm, type DraftPlan } from "../plan/PlanDraft";
import PhaseSwitcher from "../PhaseSwitcher";
import { SortableItem, SortableList } from "../Sortable";
import { useOpenChat } from "../ChatPanel";
import { dayMonth } from "../../../lib/dayMonth";
import { useHoldWhile, useSaveQueue } from "../useSaveQueue";

// The Nutrition tab, built as Training and Lifestyle are (21 Oct, Alex): the
// phase's name to click and type, its state tag as its menu, the goals and
// the note to the client as two pills on the right. Under it, each section's
// title and status on the page and its content in one hairline card:
//
// - Daily targets: the kcal as a ring, protein, carbs and fat typed in for
//   training and rest days (or one set for every day), a water goal. Saved a
//   moment after the typing stops; the section's line says so.
// - Supplements: one row an item. A saved row saves a moment after typing
//   stops; a new one once it has a name and the row is left. Removing asks.
// - What the client logged: four figures, then one row a day, twenty to a
//   page. A day opens into its meals and their foods; a camera on a meal
//   opens the picture, where the coach can leave a comment.

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
  /** The plan behind the tab (10 Oct): today, this week, every phase and programme, for the New phase dialog the Plan tab has. */
  planCtx: Pick<DraftPlan, "today" | "thisWeek" | "phases" | "programs">;
  /** The coach's goals for the phase, up to three. */
  goals: string[];
  phases: { id: number; name: string; weeks: number; state: State }[];
  name: string;
  status: State;
  weeks: number;
  weekIdx: number | null;
  startDate: string | null;
  /** The stored end_week: the last day is six days on. */
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
/** A phase's fields as the actions read them: start and end are the first and last day. */
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
const addDays = (day: string, k: number) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const ON_TARGET = 200;
const PAGE = 20;
// A typed change waits this long for the next keystroke before it goes.
const QUIET_MS = 800;
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
const sameMacros = (a: MacroText, b: MacroText) => a.protein === b.protein && a.carbs === b.carbs && a.fats === b.fats;
const isEmpty = (m: MacroText) => !m.protein && !m.carbs && !m.fats;
const sameSupp = (a: DraftSupplement, b: DraftSupplement) => a.name === b.name && a.quantity === b.quantity && a.timing === b.timing && a.notes === b.notes;

type Targets = {
  same: boolean;
  training: MacroText;
  rest: MacroText;
  water: string;
};
type Dlg =
  | { kind: "photo"; date: string; meal: string }
  | { kind: "message"; label: string; link: MessageLink }
  | { kind: "dates" }
  | { kind: "newPhase" }
  | { kind: "deploy" }
  | { kind: "liveNow" }
  | { kind: "backToDraft" }
  | { kind: "deletePhase" }
  | { kind: "removeSupp"; supp: DraftSupplement }
  | null;

/** A section's status, as Training's week line: Saving…, ✓ All changes saved, or Not saved · Retry. */
function SaveStatus({ busy, failed, onRetry, solo = false }: { busy: boolean; failed: boolean; onRetry: () => void; solo?: boolean }) {
  return failed ? (
    <span className={`trn-allsaved failed${solo ? " solo" : ""}`} role="alert">
      Not saved ·{" "}
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </span>
  ) : (
    <span className={`trn-allsaved${busy ? " saving" : ""}${solo ? " solo" : ""}`} role="status">
      {busy ? "Saving…" : "All changes saved"}
    </span>
  );
}

export default function NutritionDraft({ clientId, firstName, plan }: { clientId: number; firstName: string; plan: DraftNutrition }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // A header action goes to the server, then the page re-reads; what is on screen follows.
  const act = (fn: () => Promise<unknown>, said?: string) =>
    startTransition(async () => {
      await fn();
      router.refresh();
      if (said) savedToast(said);
    });
  const phaseId = plan.id > 0 ? plan.id : null;
  const today = plan.planCtx.today;
  const startHasCome = !!plan.startDate && plan.startDate <= today;
  const lastDay = plan.endDate ? addDays(plan.endDate, 6) : null;

  // ---- Targets: typed in place, saved a moment after the typing stops (21 Oct, Alex: no Apply bar).
  const initial: Targets = {
    same: sameMacros(textOf(plan.training), textOf(plan.rest)) || isEmpty(textOf(plan.rest)),
    training: textOf(plan.training),
    rest: textOf(plan.rest),
    water: plan.waterL == null ? "" : String(plan.waterL),
  };
  const [t, setT] = useState(initial);
  const targetsQ = useSaveQueue(() => router.refresh());
  const [targetsWaiting, setTargetsWaiting] = useState(false);
  const targetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tNow = useRef(t);
  useEffect(() => {
    tNow.current = t;
  });
  const sendTargets = () => {
    targetTimer.current = null;
    setTargetsWaiting(false);
    const x = tNow.current;
    const rest = x.same ? x.training : x.rest;
    const f = new FormData();
    f.set("clientId", String(clientId));
    f.set("t_protein", x.training.protein);
    f.set("t_carbs", x.training.carbs);
    f.set("t_fats", x.training.fats);
    f.set("r_protein", rest.protein);
    f.set("r_carbs", rest.carbs);
    f.set("r_fats", rest.fats);
    f.set("water", x.water);
    if (phaseId) f.set("phaseId", String(phaseId));
    targetsQ.save(async () => {
      await saveNutritionTargetsAction(f);
      return true;
    });
  };
  const editTargets = (change: (x: Targets) => Targets) => {
    setT(change);
    setTargetsWaiting(true);
    if (targetTimer.current) clearTimeout(targetTimer.current);
    targetTimer.current = setTimeout(sendTargets, QUIET_MS);
  };
  // What is saved comes back with the page's re-read and replaces the screen's copy, by content,
  // never while a change waits, saves or failed (that would undo it on screen).
  const planKey = JSON.stringify([plan.id, initial]);
  const [seenPlan, setSeenPlan] = useState(planKey);
  if (seenPlan !== planKey && !targetsWaiting && !targetsQ.saving && !targetsQ.failed) {
    setSeenPlan(planKey);
    setT(initial);
  }
  // Which day type the ring and the row show; with the tick on, one set for every day.
  const [day, setDay] = useState<"training" | "rest">("training");
  const shown = t.same ? "training" : day;

  // ---- Supplements: a saved row saves a moment after typing stops; a new one once it has a name and the row is left.
  const [supps, setSupps] = useState(plan.supplements);
  // As last sent: what the next change is told apart from.
  const [suppSent, setSuppSent] = useState(plan.supplements);
  const suppQ = useSaveQueue(() => router.refresh());
  const [suppWaiting, setSuppWaiting] = useState(false);
  const suppTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppsNow = useRef(supps);
  const sentNow = useRef(suppSent);
  useEffect(() => {
    suppsNow.current = supps;
    sentNow.current = suppSent;
  });
  const tempIds = useRef(0);
  // A new row once sent: there, faded and still, until the re-read gives it its number.
  const incoming = (s: DraftSupplement) => s.id < 0 && suppSent.some((x) => x.id === s.id);
  // Something typed that hasn't gone yet (an empty new row doesn't count).
  const unsent = supps.some((s) => {
    const was = suppSent.find((x) => x.id === s.id);
    return was ? !sameSupp(was, s) : s.id > 0 || !!s.name.trim();
  });
  const suppsKey = JSON.stringify(plan.supplements);
  const [seenSupps, setSeenSupps] = useState(suppsKey);
  if (seenSupps !== suppsKey && !suppWaiting && !suppQ.saving && !suppQ.failed && !unsent) {
    setSeenSupps(suppsKey);
    setSuppSent(plan.supplements);
    // An empty row just added stays for its name.
    setSupps([...plan.supplements, ...supps.filter((s) => s.id < 0 && !s.name.trim())]);
  }
  const sendSupps = (changes: { added?: DraftSupplement[]; updated?: DraftSupplement[]; removedIds?: number[]; order?: number[] }) => {
    const payload = {
      added: (changes.added ?? []).map(({ name, quantity, timing, notes }) => ({ name, quantity, timing, notes })),
      updated: (changes.updated ?? []).map(({ id, name, quantity, timing, notes }) => ({ id, name, quantity, timing, notes })),
      removedIds: changes.removedIds ?? [],
      order: changes.order,
    };
    suppQ.save(async () => {
      await applySupplementChangesAction(clientId, payload);
      return true;
    });
  };
  // The saved rows' edits, a moment after the typing stops.
  const sendSuppEdits = () => {
    suppTimer.current = null;
    setSuppWaiting(false);
    const sent = new Map(sentNow.current.map((s) => [s.id, s]));
    const updated = suppsNow.current.filter((s) => s.id > 0 && sent.has(s.id) && !sameSupp(sent.get(s.id)!, s));
    if (!updated.length) return;
    setSuppSent((prev) => prev.map((s) => updated.find((u) => u.id === s.id) ?? s));
    sendSupps({ updated });
  };
  const editSupp = (id: number, f: Partial<DraftSupplement>) => {
    setSupps((prev) => prev.map((s) => (s.id === id ? { ...s, ...f } : s)));
    if (id < 0) return;
    setSuppWaiting(true);
    if (suppTimer.current) clearTimeout(suppTimer.current);
    suppTimer.current = setTimeout(sendSuppEdits, QUIET_MS);
  };
  // A new row goes once it has a name and the coach leaves it.
  const leaveNewRow = (id: number) => {
    const s = suppsNow.current.find((x) => x.id === id);
    if (!s || !s.name.trim() || sentNow.current.some((x) => x.id === id)) return;
    setSuppSent((prev) => [...prev, s]);
    sendSupps({ added: [s] });
  };
  const addRow = () => {
    tempIds.current += 1;
    setSupps((prev) => [...prev, { id: -tempIds.current, name: "", quantity: "", timing: "", notes: "" }]);
  };
  const removeSupp = (s: DraftSupplement) => {
    setSupps((prev) => prev.filter((x) => x.id !== s.id));
    if (s.id < 0) return;
    setSuppSent((prev) => prev.filter((x) => x.id !== s.id));
    sendSupps({ removedIds: [s.id] });
  };
  // A drop sets the new order, saved at once; not while a new row waits for its number.
  const canDrag = plan.status !== "past" && !supps.some((s) => s.id < 0 && s.name.trim());
  const moveSupps = (ids: (number | string)[]) => {
    if (!canDrag) return;
    const next = ids.map((id) => supps.find((x) => x.id === id)).filter((s): s is DraftSupplement => !!s);
    setSupps(next);
    setSuppSent((prev) => next.map((s) => prev.find((x) => x.id === s.id)).filter((s): s is DraftSupplement => !!s));
    sendSupps({ order: next.filter((s) => s.id > 0).map((s) => s.id) });
  };
  // Leaving the page or the tab with something typed: it goes now.
  useEffect(
    () => () => {
      if (targetTimer.current) {
        clearTimeout(targetTimer.current);
        sendTargets();
      }
      if (suppTimer.current) {
        clearTimeout(suppTimer.current);
        sendSuppEdits();
      }
    },
    // Unmount only; the refs hold what is current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useHoldWhile(targetsWaiting || targetsQ.saving || targetsQ.failed || suppWaiting || suppQ.saving || suppQ.failed);

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
  // Messaging slides the chat in from the right (ChatPanel, 2 Oct).
  const openChat = useOpenChat();
  const message = (v: { label: string; link: MessageLink }) => (openChat ? openChat({ area: "Nutrition", label: v.label, link: v.link }) : setDlg({ kind: "message", ...v }));
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

  // ---- The phase's name: click it to type (as Training's); the new one shows at once.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [named, setNamed] = useState<{ id: number; from: string; to: string } | null>(null);
  const shownName = named && named.id === plan.id && plan.name === named.from ? named.to : plan.name;
  const commitRename = () => {
    const v = renaming?.trim() ?? "";
    setRenaming(null);
    if (!v || v === shownName || !phaseId || !plan.startDate || !lastDay) return;
    setNamed({ id: plan.id, from: plan.name, to: v });
    act(() => updateClientPhaseAction(phaseForm({ id: phaseId, track: "nutrition", name: v, start: plan.startDate!, end: lastDay, exact: true })), `Renamed to ${v}`);
  };
  const goLive = () => {
    if (!phaseId) return;
    // Live, or why not (5 Oct: a blocked one used to say "is live" anyway).
    startTransition(async () => {
      const why = await deployPhaseNowAction(phaseId);
      router.refresh();
      if (why) toast.error(`${plan.name} isn't live yet`, { description: why });
      else savedToast(`${plan.name} is live`);
    });
  };

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
  const named_ = supps.filter((s) => s.name.trim()).length;

  return (
    <div className={`rd trn rls rnt${plan.status === "past" ? " rd-past" : ""}`}>
      {plan.status === "past" && (
        <div className="rd-past-note" role="note">
          <b>Ended.</b> This phase is here to look back on; nothing in it can be changed.
        </div>
      )}
      {/* ---- Header (21 Oct, as Training's and Lifestyle's): the name to click and type, the ▾ to switch phase,
          the state tag as its menu; the facts under it; on the right the goals and note pills and the menu. */}
      <header className="trn-head">
        <div className="trn-head-main">
          <span className="trn-eyebrow">Nutrition</span>
          <div className="trn-name-row">
            <h1 className="trn-name">
              {renaming != null ? (
                <input
                  className="trn-name-input"
                  value={renaming}
                  autoFocus
                  maxLength={60}
                  size={Math.max(8, renaming.length + 1)}
                  onChange={(e) => setRenaming(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={commitRename}
                  aria-label="Phase name"
                />
              ) : (
                <>
                  {phaseId ? (
                    <button type="button" className="trn-name-btn" onClick={() => setRenaming(shownName)} title="Rename">
                      {shownName}
                    </button>
                  ) : (
                    plan.name
                  )}
                  <PhaseSwitcher name="" currentId={plan.id} items={plan.phases} hrefFor={(id) => `/admin/redesign/nutrition?client=${clientId}&phase=${id}`} label="Switch phase" newLabel="New phase" onNew={() => setDlg({ kind: "newPhase" })} />
                </>
              )}
            </h1>
            {phaseId != null &&
              (plan.status === "draft" || plan.status === "scheduled" ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className={`trn-status trn-status-btn ${plan.status}`} style={stateTagStyle(plan.status)} aria-label={`${stateLabel(plan.status)}: change`}>
                    {stateLabel(plan.status)}
                    <ChevronDownIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="pb-menu">
                    {plan.status === "draft" ? (
                      startHasCome ? (
                        <DropdownMenuItem onSelect={() => setDlg({ kind: "deploy" })}>Make it live</DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onSelect={() => setDlg({ kind: "deploy" })}>Schedule it</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDlg({ kind: "liveNow" })}>Make it live now</DropdownMenuItem>
                        </>
                      )
                    ) : (
                      <>
                        <DropdownMenuItem onSelect={() => setDlg({ kind: "liveNow" })}>Make it live now</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDlg({ kind: "backToDraft" })}>Back to draft</DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className={`trn-status ${plan.status}`} style={stateTagStyle(plan.status)}>
                  {plan.status === "past" ? "Ended" : stateLabel(plan.status)}
                </span>
              ))}
            {/* One status for the whole tab, beside the title and its tag (21 Oct, Alex): the targets' saves and the supplements'. */}
            {phaseId != null && (
              <SaveStatus
                busy={targetsWaiting || targetsQ.saving || suppWaiting || suppQ.saving}
                failed={targetsQ.failed || suppQ.failed}
                onRetry={() => {
                  if (targetsQ.failed) targetsQ.retry();
                  if (suppQ.failed) suppQ.retry();
                }}
                solo
              />
            )}
          </div>
          {plan.startDate && (
            // The facts parted by a short upright line, the dates last (21 Oct, as Lifestyle).
            <span className="trn-meta">
              <span>
                {plan.weeks} {plan.weeks === 1 ? "week" : "weeks"}
              </span>
              {plan.weekIdx != null && (
                <span className="trn-meta-part">
                  week {plan.weekIdx} of {plan.weeks}
                </span>
              )}
              <span className="trn-meta-part">
                {fmtDate(plan.startDate)}
                {lastDay && ` – ${fmtDate(lastDay)}`}
              </span>
            </span>
          )}
        </div>
        <div className="trn-head-actions">
          {/* The goals and the note to the client as pills (21 Oct), one pop-over; the note is the targets' note the client reads on Nutrition. */}
          {phaseId != null && (
            <GoalsNotePills
              firstName={firstName}
              phaseId={phaseId}
              goals={plan.goals}
              note={plan.note}
              area="nutrition"
              saveNote={async (text) => {
                const f = new FormData();
                f.set("clientId", String(clientId));
                f.set("note", text);
                f.set("phaseId", String(phaseId));
                await saveCoachNutritionNoteAction(f);
              }}
            />
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="trn-more" aria-label="More for the phase">
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={() => message({ label: plan.name, link: { kind: "nutrition" } })}>
                <ChatIcon /> Message about nutrition
              </DropdownMenuItem>
              {phaseId != null && (
                <DropdownMenuItem onSelect={() => setDlg({ kind: "dates" })}>
                  <CalendarIcon /> Edit dates
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDlg({ kind: "newPhase" })}>
                <PlusIcon /> New phase
              </DropdownMenuItem>
              {phaseId != null && (
                <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "deletePhase" })}>
                  <TrashIcon /> Delete phase
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ---- Daily targets: the kcal as a ring on the left, split by the macros typed in on the right. */}
      <section className="rls-section">
        <div className="trn-weekhead">
          <div>
            <h2>Daily targets</h2>
          </div>
          <div className="trn-weekhead-actions">
            {/* Kept in its place when hidden, so the tick beside it never moves. */}
            <div className="rd-btn-group" role="group" aria-label="Day type shown" style={{ visibility: t.same ? "hidden" : "visible" }}>
              {(["training", "rest"] as const).map((d) => (
                <button key={d} type="button" className={shown === d ? "on" : ""} aria-pressed={shown === d} onClick={() => setDay(d)} tabIndex={t.same ? -1 : 0}>
                  {d === "training" ? "Training" : "Rest"}
                </button>
              ))}
            </div>
            <label className="rd-tick rnt-same">
              <input
                type="checkbox"
                checked={t.same}
                onChange={(e) =>
                  editTargets((x) => ({
                    ...x,
                    same: e.target.checked,
                    rest: e.target.checked ? x.rest : isEmpty(x.rest) ? x.training : x.rest,
                  }))
                }
              />
              Same on training and rest days
            </label>
          </div>
        </div>
        <div className="rls-card">
          <div className="rn-targets">
            <div className="rn-rings">
              <Ring label={t.same ? "Every day" : shown === "training" ? "Training days" : "Rest days"} m={t[shown]} />
            </div>
            <div className="rn-tside">
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
                  </span>
                  {(["protein", "carbs", "fats"] as const).map((f) => (
                    <Box
                      key={`${shown}-${f}`}
                      value={t[shown][f]}
                      onChange={(v) =>
                        editTargets((x) => ({
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
                  </span>
                  <Box value={t.water} onChange={(v) => editTargets((x) => ({ ...x, water: v }))} label="Water goal" unit="L" placeholder="—" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Supplements: a reference list, one row an item. */}
      <section className="rls-section">
        <div className="trn-weekhead">
          <div>
            <h2>Supplements</h2>
            <span>
              {named_} {named_ === 1 ? "item" : "items"}
            </span>
          </div>
        </div>
        <div className="rls-card">
          {supps.length > 0 && (
            <div className="rls-cols" aria-hidden="true" style={sGrid}>
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
              <SortableItem key={s.id} id={s.id} className={`rls-row${incoming(s) ? " trn-incoming" : ""}`}>
                {(suppGrip) => (
                  <div
                    className="rls-row-main rn-wide"
                    style={sGrid}
                    onBlur={(e) => {
                      if (s.id < 0 && !e.currentTarget.contains(e.relatedTarget as Node | null)) leaveNewRow(s.id);
                    }}
                  >
                    <span className="rd-grip trn-grip" {...(canDrag && s.id > 0 ? suppGrip : {})}>
                      <GripIcon />
                    </span>
                    <Box value={s.name} onChange={(v) => editSupp(s.id, { name: v })} label="Item" placeholder="Creatine" strong autoFocus={!s.name} />
                    <Box value={s.quantity} onChange={(v) => editSupp(s.id, { quantity: v })} label="Quantity" placeholder="5 g" />
                    <Box value={s.timing} onChange={(v) => editSupp(s.id, { timing: v })} label="Timing" placeholder="With breakfast" />
                    <Box value={s.notes} onChange={(v) => editSupp(s.id, { notes: v })} label="Notes" placeholder="—" quiet />
                    <span className="rls-more">
                      {!incoming(s) && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className="trn-row-more" aria-label={`More for ${s.name || "item"}`}>
                            <MoreIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="pb-menu">
                            <DropdownMenuItem variant="destructive" onSelect={() => (s.id < 0 && !s.name.trim() ? removeSupp(s) : setDlg({ kind: "removeSupp", supp: s }))}>
                              <TrashIcon /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </span>
                  </div>
                )}
              </SortableItem>
            ))}
          </SortableList>
          <button type="button" className="rls-add" onClick={addRow}>
            <PlusIcon /> Item
          </button>
        </div>
      </section>

      {/* ---- What the client logged: figures, then one row a day. Still to be looked through on an ended phase (rd-keep). */}
      <section className="rls-section rd-keep">
        <div className="trn-weekhead">
          <div>
            <h2>{firstName}&rsquo;s logs</h2>
          </div>
        </div>
        <div className="rls-card rls-log">
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
                  onMessage={() => message({ label: `Food diary · ${dayMonth(d.date)}`, link: { kind: "food", date: d.date } })}
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
        </div>
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
        {dlg?.kind === "removeSupp" && (
          <ConfirmDialog
            title={`Remove ${dlg.supp.name || "this item"}?`}
            description={`It comes off ${firstName}'s supplements.`}
            confirm="Remove"
            danger
            onConfirm={() => {
              const s = dlg.supp;
              close();
              removeSupp(s);
            }}
          />
        )}
        {dlg?.kind === "dates" && (
          <PhaseDatesDialog
            title="Dates"
            name={plan.name}
            start={plan.startDate}
            end={plan.endDate}
            firstName={firstName}
            what="these targets"
            confirm="Save"
            onConfirm={(v) => {
              close();
              if (phaseId) act(() => updateClientPhaseAction(phaseForm({ id: phaseId, track: "nutrition", name: v.name || plan.name, start: v.start, end: v.end, exact: true })), `${v.name || plan.name}: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
            }}
          />
        )}
        {/* The Plan tab's New phase dialog, here too (10 Oct), on this track. */}
        {dlg?.kind === "newPhase" && (
          <PhaseDialog
            clientId={clientId}
            firstName={firstName}
            today={plan.planCtx.today}
            thisWeek={plan.planCtx.thisWeek}
            phase={null}
            track="nutrition"
            lockTrack
            others={plan.planCtx.phases}
            programs={plan.planCtx.programs}
            onSave={(v) => {
              close();
              act(() => addClientPhaseAction(planPhaseForm({ clientId, ...v })), `${v.name} drafted: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
            }}
            onSend={() => {}}
          />
        )}
        {dlg?.kind === "deploy" && !startHasCome && (
          <PhaseDatesDialog
            title={`Schedule ${plan.name}`}
            start={plan.startDate}
            end={plan.endDate}
            firstName={firstName}
            what="these targets"
            confirm="Schedule it"
            onConfirm={(v) => {
              close();
              if (!phaseId) return;
              // Scheduled, or why not (an empty draft said "scheduled" and stayed a draft).
              startTransition(async () => {
                const why = await saveAndSchedulePhaseOrSayWhyAction(phaseForm({ id: phaseId, track: "nutrition", name: plan.name, start: v.start, end: v.end, exact: true }));
                router.refresh();
                if (why) toast.error(`${plan.name} isn't scheduled yet`, { description: why });
                else savedToast(`${plan.name} scheduled: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
              });
            }}
          />
        )}
        {dlg?.kind === "deploy" && startHasCome && (
          <ConfirmDialog
            title={`Make ${plan.name} live?`}
            description={`${firstName} sees these targets and supplements from today.`}
            confirm="Make it live"
            onConfirm={() => {
              close();
              goLive();
            }}
          />
        )}
        {/* Now, whatever its dates say (21 Oct, as Training): it starts this week. */}
        {dlg?.kind === "liveNow" && (
          <ConfirmDialog
            title={`Make ${plan.name} live now?`}
            description={`It starts this week; ${firstName} sees these targets from today.`}
            confirm="Make it live"
            onConfirm={() => {
              close();
              goLive();
            }}
          />
        )}
        {dlg?.kind === "backToDraft" && (
          <ConfirmDialog
            title="Back to draft?"
            description={`${plan.name} comes off ${firstName}'s schedule.`}
            confirm="Back to draft"
            onConfirm={() => {
              close();
              if (phaseId) act(() => unschedulePhaseAction(phaseId), `${plan.name} is a draft again`);
            }}
          />
        )}
        {/* Deleting the phase from here too (21 Oct, as Training). What the client logged stays. */}
        {dlg?.kind === "deletePhase" && phaseId != null && (
          <DeletePhaseDialog
            name={plan.name}
            logged={0}
            firstName={firstName}
            onDelete={() => {
              close();
              startTransition(async () => {
                await deletePhaseAction(phaseId);
                savedToast(`${plan.name} deleted`);
                router.push(`${window.location.pathname}?client=${clientId}&tab=nutrition`, { scroll: false });
              });
            }}
            onClose={close}
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
        {/* The row's one action: a message about this day (on hover), not a menu. */}
        <span className="rd-row-more" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="rd-btn ghost sm" onClick={onMessage} aria-label={`Message about ${fmtDay(day.date)}`} title="Message about this day">
            <ChatIcon />
          </button>
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
          {meal.label} · {dayMonth(date)}
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
        <DialogClose className="rd-btn">Close</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!text.trim()} onClick={send}>
          Send
        </button>
      </DialogFooter>
    </DialogContent>
  );
}


