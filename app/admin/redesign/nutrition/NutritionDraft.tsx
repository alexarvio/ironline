"use client";

import Pager from "../Pager";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { addClientPhaseAction, applySupplementChangesAction, deletePhaseAction, deployPhaseNowAction, markSeenAction, saveAndSchedulePhaseOrSayWhyAction, saveCoachNutritionNoteAction, saveNutritionTargetsAction, sendChatMessageAction, unschedulePhaseAction, updateClientPhaseAction } from "../../../lib/actions";
import type { MessageLink } from "../../../lib/messageLinks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { CalendarIcon, CameraIcon, ChatIcon, ChevronDownIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import type { LoggedDay, LoggedDaysView, LoggedMeal, MealComment } from "../../../lib/queries";
import { ConfirmDialog, DeletePhaseDialog, MessageDialog, fmtDate, stateLabel, useClickAway } from "../training/TrainingDraft";
import { Popover, PopoverAnchor, PopoverContent } from "../../../components/ui/popover";
import { SUPPLEMENT_PRESETS, type SupplementGroup, type SupplementPreset } from "../../../lib/supplementPresets";
import { GoalsNotePills, GripIcon } from "../training/TrainingParts";
import { stateTagStyle } from "../../phaseChrome";
import PhaseDatesDialog from "../PhaseDatesDialog";
import { PhaseDialog, phaseForm as planPhaseForm, type DraftPlan } from "../plan/PlanDraft";
import PhaseSwitcher from "../PhaseSwitcher";
import { SortableItem, SortableList } from "../Sortable";
import { useOpenChat } from "../ChatPanel";
import { dayMonth, logDate } from "../../../lib/dayMonth";
import { useHoldWhile, useSaidSaved, useSaveQueue } from "../useSaveQueue";
import { Sep } from "../Sep";
import { Fold } from "../Fold";
import { landOn } from "../../../lib/landOn";

// The Nutrition tab, built as Training and Lifestyle are (21 Oct, Alex): the
// phase's name to click and type, its state tag as its menu, the goals and
// the note to the client as two pills on the right. Under it, each section's
// title and status on the page and its content in one hairline card:
//
// - Daily targets: the kcal as a ring, protein, carbs and fat typed in for
//   training and rest days (or one set for every day), a water goal. Saved a
//   moment after the typing stops; the section's line says so.
// - Supplements: one row an item, added from + Item's dropdown (a preset or
//   the coach's own) and saved at once. A row saves a moment after typing
//   stops. Removing asks.
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
  /** No end (26 Oct): "Ongoing" and the week, no total. */
  openEnded?: boolean;
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
  /** The days logged in the last 30 by the calendar, today counting, newest first: the figures' 7d and 30d. */
  recent: FigureDay[];
};
/** What the figures over the log read of a logged day. */
export type FigureDay = Pick<LoggedDay, "date" | "kcal" | "protein" | "carbs" | "fat" | "proteinTarget">;
/** The figures' window (23 Oct, Alex): the last 7 or 30 days by the calendar, or the phase's days so far. */
type Span = "7d" | "30d" | "phase";

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
const PAGE = 20;
// A typed change waits this long for the next keystroke before it goes.
const QUIET_MS = 800;

type MacroText = { protein: string; carbs: string; fats: string };
const textOf = (m: Macros): MacroText => ({
  protein: m.protein == null ? "" : String(m.protein),
  carbs: m.carbs == null ? "" : String(m.carbs),
  fats: m.fats == null ? "" : String(m.fats),
});
const num = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(",", ".")) || 0);
const sameMacros = (a: MacroText, b: MacroText) => a.protein === b.protein && a.carbs === b.carbs && a.fats === b.fats;
const isEmpty = (m: MacroText) => !m.protein && !m.carbs && !m.fats;
// Alike as saved: the server trims, so a space just typed ("Take with ") isn't a change, and the screen keeps it.
const sameSupp = (a: DraftSupplement, b: DraftSupplement) => a.name.trim() === b.name.trim() && a.quantity.trim() === b.quantity.trim() && a.timing.trim() === b.timing.trim() && a.notes.trim() === b.notes.trim();
// Two figures alike once read as numbers ("2." saved as 2, "2,5" as 2.5): the screen keeps what was typed.
const sameFigure = (a: string, b: string) => a.trim() === b.trim() || (a.trim() !== "" && b.trim() !== "" && Number(a.replace(",", ".")) === Number(b.replace(",", ".")));
const sameFigures = (a: Targets, b: Targets) => {
  const aRest = a.same ? a.training : a.rest;
  const bRest = b.same ? b.training : b.rest;
  return sameFigure(a.water, b.water) && (["protein", "carbs", "fats"] as const).every((k) => sameFigure(a.training[k], b.training[k]) && sameFigure(aRest[k], bRest[k]));
};

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
  // Nothing until something is saved (22 Oct, Alex).
  const said = useSaidSaved(busy);
  if (!failed && !said) return null;
  return failed ? (
    <span className={`trn-allsaved failed${solo ? " solo" : ""}`} role="alert">
      Not saved<Sep />
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

export default function NutritionDraft({
  clientId,
  firstName,
  plan,
  dueFood,
}: {
  clientId: number;
  firstName: string;
  plan: DraftNutrition;
  /** The dot trail (dots.ts): days (yyyy-mm-dd) with a note of theirs still to read → those notes' feed ids. */
  dueFood?: Record<string, string[]>;
}) {
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
  // The re-read after a save, until it lands: a copy on screen from before the save mustn't be taken for it.
  const [refreshing, startRefresh] = useTransition();
  const reRead = () => startRefresh(() => router.refresh());
  const targetsQ = useSaveQueue(reRead);
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
  // never while a change waits, saves, failed or its re-read is on its way (that would undo it on screen).
  const planKey = JSON.stringify([plan.id, initial]);
  const [seenPlan, setSeenPlan] = useState(planKey);
  if (seenPlan !== planKey && !targetsWaiting && !targetsQ.saving && !targetsQ.failed && !refreshing) {
    setSeenPlan(planKey);
    if (!sameFigures(t, initial)) setT(initial);
  }
  // Which day type the ring and the row show; with the tick on, one set for every day.
  const [day, setDay] = useState<"training" | "rest">("training");
  const shown = t.same ? "training" : day;

  // ---- Supplements: a saved row saves a moment after typing stops; a new one, from + Item's dropdown, at once.
  const [supps, setSupps] = useState(plan.supplements);
  // As last sent: what the next change is told apart from.
  const [suppSent, setSuppSent] = useState(plan.supplements);
  const suppQ = useSaveQueue(reRead);
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
  // Something typed that hasn't gone yet (an empty new row doesn't count, nor a saved row whose name is cleared: that isn't sent).
  const unsent = supps.some((s) => {
    const was = suppSent.find((x) => x.id === s.id);
    return was ? !sameSupp(was, s) && !!s.name.trim() : s.id > 0 || !!s.name.trim();
  });
  const suppsKey = JSON.stringify(plan.supplements);
  const [seenSupps, setSeenSupps] = useState(suppsKey);
  if (seenSupps !== suppsKey && !suppWaiting && !suppQ.saving && !suppQ.failed && !unsent && !refreshing) {
    setSeenSupps(suppsKey);
    setSuppSent(plan.supplements);
    // A row that says the same as saved keeps what was typed; an empty row just added stays for its name.
    setSupps([
      ...plan.supplements.map((p) => {
        const s = supps.find((x) => x.id === p.id);
        return s && sameSupp(s, p) ? s : p;
      }),
      ...supps.filter((s) => s.id < 0 && !s.name.trim()),
    ]);
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
    // A row with its name cleared waits: a nameless row isn't saved (the name comes back when the row is left).
    const updated = suppsNow.current.filter((s) => s.id > 0 && s.name.trim() && sent.has(s.id) && !sameSupp(sent.get(s.id)!, s));
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
  // Leaving a row: a new one goes once it has a name; a saved one left nameless gets its name back.
  const leaveRow = (id: number) => {
    const s = suppsNow.current.find((x) => x.id === id);
    if (!s) return;
    if (id > 0) {
      const was = sentNow.current.find((x) => x.id === id);
      if (!s.name.trim() && was) editSupp(id, { name: was.name });
      return;
    }
    if (!s.name.trim() || sentNow.current.some((x) => x.id === id)) return;
    setSuppSent((prev) => [...prev, s]);
    sendSupps({ added: [s] });
  };
  // A pick from + Item's dropdown (21 Oct, Alex): a preset with its dose and time, or one of the coach's own. Saved at once,
  // faded at the foot of the list until the re-read gives it its number.
  const [adding, setAdding] = useState(false);
  const addSupp = (x: { name: string; quantity: string; timing: string }) => {
    tempIds.current += 1;
    const s: DraftSupplement = { id: -tempIds.current, name: x.name, quantity: x.quantity, timing: x.timing, notes: "" };
    setSupps((prev) => [...prev, s]);
    setSuppSent((prev) => [...prev, s]);
    sendSupps({ added: [s] });
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
      // A new row with a name, not left yet.
      const fresh = suppsNow.current.filter((s) => s.id < 0 && s.name.trim() && !sentNow.current.some((x) => x.id === s.id));
      if (fresh.length) sendSupps({ added: fresh });
    },
    // Unmount only; the refs hold what is current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useHoldWhile(targetsWaiting || targetsQ.saving || targetsQ.failed || suppWaiting || suppQ.saving || suppQ.failed || unsent);

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
  // And on a later link that changes only the #part (21 Oct: a second day from the chat did nothing).
  // Never on a re-read (an autosave, the coach coming back): the log stays where they left it.
  const daysNow = useRef(view.days);
  useEffect(() => {
    daysNow.current = view.days;
  });
  useEffect(() => {
    let frame = 0;
    const arrive = () => {
      const m = /^#day-(\d{4}-\d{2}-\d{2})(?:-meal-(.+))?$/.exec(window.location.hash);
      if (!m) return;
      const date = m[1];
      const meal = m[2] ? decodeURIComponent(m[2]) : null;
      const idx = daysNow.current.findIndex((d) => d.date === date);
      if (idx < 0) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setPage(Math.floor(idx / PAGE) + 1);
        setOpen(date);
        // On the meal when the link names one, else the day: brought to the middle and lit (24 Oct, Alex: a link lands on its thing).
        setTimeout(() => landOn((meal && document.getElementById(`meal-${date}-${meal}`)) || document.getElementById(`day-${date}`)), 120);
      });
    };
    arrive();
    window.addEventListener("hashchange", arrive);
    return () => {
      window.removeEventListener("hashchange", arrive);
      cancelAnimationFrame(frame);
    };
  }, []);
  // Comments left here, under the meal they were left on.
  const [said, setSaid] = useState<Record<string, MealComment[]>>({});
  const commentsOn = (d: string, m: LoggedMeal) => [...m.comments, ...(said[`${d}|${m.id}`] ?? [])];

  const [dlg, setDlg] = useState<Dlg>(null);
  // Messaging slides the chat in from the right (ChatPanel, 2 Oct).
  const openChat = useOpenChat();
  const message = (v: { label: string; link: MessageLink }) => (openChat ? openChat({ area: "Nutrition", label: v.label, link: v.link }) : setDlg({ kind: "message", ...v }));
  const close = () => setDlg(null);
  const photoOf = dlg?.kind === "photo" ? (view.days.find((d) => d.date === dlg.date)?.meals.find((m) => m.id === dlg.meal) ?? null) : null;

  // The figures' window, 7d | 30d | Phase on the section's line (23 Oct, Alex); the rows under them stay the phase's.
  // Phase only once a nutrition phase has days to count, and then it opens on it; else 30d.
  const phaseSpan = phaseId != null && startHasCome;
  const [span, setSpan] = useState<Span | null>(null);
  const spanOn: Span = span === "phase" && !phaseSpan ? "30d" : (span ?? (phaseSpan ? "phase" : "30d"));
  const spans: Span[] = phaseSpan ? ["7d", "30d", "phase"] : ["7d", "30d"];
  // The days logged in it, each average over them as the server works it out (a day's rounded figures, today counting).
  const inSpan: FigureDay[] = spanOn === "phase" ? view.days : spanOn === "7d" ? plan.recent.filter((d) => d.date >= addDays(today, -6)) : plan.recent;
  const avgOf = (k: "kcal" | "protein" | "carbs" | "fat") => (inSpan.length ? Math.round(inSpan.reduce((s, d) => s + d[k], 0) / inSpan.length) : null);
  const avg = { kcal: avgOf("kcal"), protein: avgOf("protein"), carbs: avgOf("carbs"), fat: avgOf("fat") };
  const proteinTarget = inSpan.find((d) => d.proteinTarget != null)?.proteinTarget ?? null;
  const stats = [
    {
      label: "Days logged",
      value: String(inSpan.length),
      unit: "",
      // A count, in ink however few (23 Oct, Alex: a red 0 read as an error).
    },
    {
      label: "Average intake",
      value: avg.kcal != null ? n(avg.kcal) : "–",
      unit: "kcal",
    },
    // The three macros' averages, not On target (21 Oct, Alex).
    {
      label: "Average protein",
      value: avg.protein != null ? String(avg.protein) : "–",
      unit: "g a day",
      warn: proteinTarget != null && avg.protein != null && avg.protein < proteinTarget - 20,
    },
    {
      label: "Average carbs",
      value: avg.carbs != null ? String(avg.carbs) : "–",
      unit: "g a day",
    },
    {
      label: "Average fat",
      value: avg.fat != null ? String(avg.fat) : "–",
      unit: "g a day",
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
  // No Vs target column (21 Oct, Alex); the day's kind as one-width pills. The date column holds the date, its chevron
  // and the note's chat icon (21 Oct, Alex), as Lifestyle's check-ins.
  const lGrid = {
    gridTemplateColumns: "150px 84px 84px minmax(200px, 1fr) 32px",
  } as const;
  const mGrid = {
    // No leading column (21 Oct): the meals start under the day's date.
    gridTemplateColumns: "minmax(160px, 1fr) 84px 72px 72px 72px 32px",
  } as const;

  return (
    <div className={`rd trn rls rnt${plan.status === "past" ? " rd-past" : ""}`}>
      {plan.status === "past" && (
        <div className="rd-past-note" role="note">
          <b>Ended.</b> This phase is here to look back on; nothing in it can be changed.
        </div>
      )}
      {/* ---- Header (21 Oct, as Training's and Lifestyle's): the name to click and type, the ▾ to switch phase,
          the state tag as its menu; the facts under it; on the right the goals and note pills and the menu. */}
      {/* No fact line, no room kept for one; no phase, the track's name is the title and the eyebrow goes (22 Oct, Alex). */}
      <header className={`trn-head${plan.startDate ? "" : " bare"}`}>
        <div className="trn-head-main">
          {phaseId != null && <span className="trn-eyebrow">Nutrition</span>}
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
                    "Nutrition"
                  )}
                  {/* Real phases only: with none, nothing is live (22 Oct, Alex: the client-level targets showed as a live phase). */}
                  <PhaseSwitcher name="" currentId={plan.id} items={plan.phases.filter((p) => p.id > 0)} hrefFor={(id) => `/admin/redesign/nutrition?client=${clientId}&phase=${id}`} label="Switch phase" newLabel="New phase" onNew={() => setDlg({ kind: "newPhase" })} />
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
            <SaveStatus
              busy={targetsWaiting || targetsQ.saving || suppWaiting || suppQ.saving}
              failed={targetsQ.failed || suppQ.failed}
              onRetry={() => {
                if (targetsQ.failed) targetsQ.retry();
                if (suppQ.failed) suppQ.retry();
              }}
              solo
            />
          </div>
          {plan.startDate && (
            // The facts parted by a short upright line, the dates last (21 Oct, as Lifestyle).
            <span className="trn-meta">
              <span>{plan.openEnded ? "Ongoing" : `${plan.weeks} ${plan.weeks === 1 ? "week" : "weeks"}`}</span>
              {plan.weekIdx != null && (
                <span className="trn-meta-part">
                  week {plan.weekIdx}
                  {plan.openEnded ? null : ` of ${plan.weeks}`}
                </span>
              )}
              <span className="trn-meta-part">
                {plan.openEnded ? `from ${fmtDate(plan.startDate)}` : fmtDate(plan.startDate)}
                {lastDay && !plan.openEnded && ` – ${fmtDate(lastDay)}`}
              </span>
            </span>
          )}
        </div>
        <div className="trn-head-actions">
          {/* The goals and the note to the client as pills (21 Oct), one pop-over; the note is the targets' note the client reads on Nutrition. */}
          {/* Without a phase (the client's own sheet), the note alone: goals belong to a phase. */}
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
              if (phaseId != null) f.set("phaseId", String(phaseId));
              await saveCoachNutritionNoteAction(f);
            }}
          />
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="trn-more" aria-label="More for the phase">
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={() => message({ label: phaseId != null ? plan.name : "Nutrition", link: { kind: "nutrition" } })}>
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
                      const to = e.relatedTarget as HTMLElement | null;
                      // Into the row's own ⋯ menu isn't leaving it.
                      if (e.currentTarget.contains(to) || to?.closest('[role="menu"]')) return;
                      leaveRow(s.id);
                    }}
                  >
                    <span className="rd-grip trn-grip" {...(canDrag && s.id > 0 ? suppGrip : {})}>
                      <GripIcon />
                    </span>
                    {/* A new row on its way is still until it has its number: an edit then would be lost. */}
                    <Box value={s.name} onChange={(v) => editSupp(s.id, { name: v })} label="Item" placeholder="Creatine" strong autoFocus={!s.name} readOnly={incoming(s)} />
                    <Box value={s.quantity} onChange={(v) => editSupp(s.id, { quantity: v })} label="Quantity" placeholder="5 g" readOnly={incoming(s)} />
                    <Box value={s.timing} onChange={(v) => editSupp(s.id, { timing: v })} label="Timing" placeholder="With breakfast" readOnly={incoming(s)} />
                    <Box value={s.notes} onChange={(v) => editSupp(s.id, { notes: v })} label="Notes" placeholder="—" quiet readOnly={incoming(s)} />
                    <span className="rls-more">
                      {!incoming(s) && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className="trn-row-more" aria-label={`More for ${s.name || "item"}`}>
                            <MoreIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="pb-menu">
                            {/* A row not saved yet just goes; a saved one asks first. */}
                            <DropdownMenuItem variant="destructive" onSelect={() => (s.id < 0 ? removeSupp(s) : setDlg({ kind: "removeSupp", supp: s }))}>
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
          {/* + Item opens a dropdown with the search at its top, as + Metric (21 Oct, Alex): presets by group, or your own. */}
          {adding ? (
            <AddSuppRow have={supps.map((s) => s.name.trim().toLowerCase())} onAdd={addSupp} onClose={() => setAdding(false)} />
          ) : (
            <button type="button" className="rls-add" onClick={() => setAdding(true)}>
              <PlusIcon /> Item
            </button>
          )}
        </div>
      </section>

      {/* ---- What the client logged: figures, then one row a day. Still to be looked through on an ended phase (rd-keep). */}
      <section className="rls-section rd-keep">
        <div className="trn-weekhead">
          <div>
            <h2>{firstName}&rsquo;s logs</h2>
          </div>
          {/* The figures' window on the title's line (23 Oct, Alex); the rows and the pager stay as they are. */}
          <div className="trn-weekhead-actions">
            <div className="rd-btn-group" role="group" aria-label="Figures over">
              {spans.map((s) => (
                <button key={s} type="button" className={spanOn === s ? "on" : ""} aria-pressed={spanOn === s} onClick={() => setSpan(s)}>
                  {s === "phase" ? "Phase" : s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rls-card rls-log">
          <div className="rn-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <small>{s.label}</small>
                {/* The unit beside the figure, no line under it (21 Oct, Alex): 3 · 2,956 kcal · 178 g a day. */}
                <b className={s.warn ? "warn" : ""}>
                  {s.value}
                  {s.unit && s.value !== "–" && <em>{s.unit}</em>}
                </b>
              </div>
            ))}
          </div>
          {/* With more than a page, the rows keep a full page's height (21 Oct, Alex: the last page made the screen jump;
              .rd-steady): a day's row is 49px with its hairline, under 29.75px of column heads and over 6px of room. */}
          {view.days.length > 0 && (
            <div className={`rd-rows${pages > 1 ? " rd-steady" : ""}`} style={pages > 1 ? ({ "--log-rows": PAGE, "--log-row": "49px", "--log-head": "35.75px" } as React.CSSProperties) : undefined}>
              <div className="rd-cols" aria-hidden="true" style={lGrid}>
                <span>Date</span>
                <span>Logged</span>
                <span className="rnt-daycol">Day</span>
                <span>
                  Protein<Sep />
                  carbs<Sep />
                  fat
                </span>
                <span />
              </div>
              {days.map((d) => (
                <DayRow
                  key={d.date}
                  day={d}
                  open={open === d.date}
                  due={!!dueFood?.[d.date]?.length}
                  grid={lGrid}
                  mealGrid={mGrid}
                  commentsOn={commentsOn}
                  onToggle={() => {
                    // Opening a day with their note on it is reading it: the dot goes, and the rail's number with it.
                    const ids = open === d.date ? null : dueFood?.[d.date];
                    setOpen((x) => (x === d.date ? null : d.date));
                    if (ids?.length) startTransition(async () => {
                      await markSeenAction(clientId, { ids });
                      router.refresh();
                    });
                  }}
                  onShot={(meal) => setDlg({ kind: "photo", date: d.date, meal })}
                  onMessage={() => message({ label: `Food diary · ${dayMonth(d.date)}`, link: { kind: "food", date: d.date } })}
                />
              ))}
            </div>
          )}
        </div>
        {/* The pager floats under the card, not in it (21 Oct, Alex). */}
        {view.days.length > 0 && (
          <Pager
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
            track="nutrition"
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
            track="nutrition"
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
type Preset = SupplementPreset & { group: string; taken: boolean };

/** + Item's dropdown (21 Oct, Alex), as Lifestyle's + Metric: the search at its top, the chevron to browse the groups, and Create your own. */
function AddSuppRow({ have, onAdd, onClose }: { have: string[]; onAdd: (x: SupplementPreset) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState(false);
  const [pack, setPack] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [creating, setCreating] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useClickAway(wrap, onClose);
  const needle = q.trim().toLowerCase();
  const itemOf = (g: SupplementGroup, i: SupplementPreset): Preset => ({ ...i, group: g.label, taken: have.includes(i.name.toLowerCase()) });
  const matches: Preset[] = needle ? SUPPLEMENT_PRESETS.flatMap((g) => g.items.filter((i) => i.name.toLowerCase().includes(needle)).map((i) => itemOf(g, i))) : [];
  const packNow = pack ? SUPPLEMENT_PRESETS.find((g) => g.id === pack) : undefined;
  const list = needle ? matches : packNow ? packNow.items.map((i) => itemOf(packNow, i)) : [];
  const showPacks = !needle && browse && !pack;
  const exact = needle && (matches.some((m) => m.name.toLowerCase() === needle) || have.includes(needle));
  const open = creating || showPacks || (!!pack && !needle) || !!needle;
  useEffect(() => {
    pop.current?.querySelector(".rd-addrow-item.on")?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);
  const pick = (m: Preset) => {
    if (m.taken) return;
    onAdd({ name: m.name, quantity: m.quantity, timing: m.timing });
    setQ("");
    setCursor(0);
    setPack(null);
    setBrowse(false);
    box.current?.focus();
  };
  const row = (m: Preset, i: number, hint: "group" | "dose") => (
    <button key={`${m.group}-${m.name}`} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}${m.taken ? " taken" : ""}`} disabled={m.taken} onMouseEnter={() => setCursor(i)} onClick={() => pick(m)}>
      {m.name}
      <small>{m.taken ? "On the list" : hint === "group" ? m.group : m.quantity}</small>
    </button>
  );
  return (
    <div ref={wrap} className="rd-addrow rls-addrow">
      <Popover open onOpenChange={() => {}}>
        <PopoverAnchor asChild>
          <button type="button" className="rls-add on" onClick={onClose} aria-expanded="true">
            <PlusIcon /> Item
          </button>
        </PopoverAnchor>
        <PopoverContent
          ref={pop}
          className="rd-addpop rls-findpop"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            box.current?.focus();
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (wrap.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <div className={`rd-addrow-bar${open ? " open" : ""}`}>
            <input
              ref={box}
              className="rd-addrow-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCursor(0);
                setPack(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (pack) setPack(null);
                  else if (browse) setBrowse(false);
                  else onClose();
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (!needle && !browse) setBrowse(true);
                  setCursor((c) => Math.min(c + 1, Math.max(0, list.length - 1)));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                }
                if (e.key === "Enter") {
                  if (list[cursor] && !list[cursor].taken) pick(list[cursor]);
                  else if (needle && !exact) setCreating(true);
                }
              }}
              placeholder={packNow ? `${packNow.label} · type to narrow` : "Search supplements"}
              aria-label="Search supplements"
            />
            <button
              type="button"
              className={`rd-addrow-chev${browse ? " open" : ""}`}
              onClick={() => {
                setBrowse((o) => !o);
                setPack(null);
                box.current?.focus();
              }}
              aria-label={browse ? "Hide groups" : "Browse by group"}
              aria-expanded={browse}
            >
              <ChevronDownIcon />
            </button>
            <button type="button" className="rd-addrow-x" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          {creating && (
            <CreateSupp
              initial={q.trim()}
              taken={(name) => have.includes(name.toLowerCase())}
              onCreate={(x) => {
                setCreating(false);
                onAdd(x);
                setQ("");
                setBrowse(false);
                box.current?.focus();
              }}
              onCancel={() => {
                setCreating(false);
                box.current?.focus();
              }}
            />
          )}
          {!creating && showPacks && (
            <>
              <div className="rd-addpop-scroll" role="listbox" aria-label="Groups">
                {SUPPLEMENT_PRESETS.map((g) => (
                  <button key={g.id} type="button" role="option" aria-selected={false} className="rd-addrow-item" onClick={() => setPack(g.id)}>
                    {g.label}
                    <small>{g.items.length}</small>
                  </button>
                ))}
              </div>
              <button type="button" className="rd-addrow-item create" onClick={() => setCreating(true)}>
                <PlusIcon /> Create your own
              </button>
            </>
          )}
          {!creating && packNow && !needle && (
            <>
              <button type="button" className="rd-addrow-back" onClick={() => setPack(null)}>
                ‹ All groups
              </button>
              <div className="rd-addpop-scroll" role="listbox" aria-label={packNow.label}>
                {list.map((m, i) => row(m, i, "dose"))}
              </div>
            </>
          )}
          {!creating && needle && (
            <>
              {list.length > 0 && (
                <div className="rd-addpop-scroll" role="listbox" aria-label="Supplements">
                  {list.map((m, i) => row(m, i, "group"))}
                </div>
              )}
              {!exact && (
                <button type="button" className={`rd-addrow-item create${list.length === 0 ? " on solo" : ""}`} onClick={() => setCreating(true)}>
                  <PlusIcon /> Create &ldquo;{q.trim()}&rdquo; as your own
                </button>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** A supplement of the coach's own, in the dropdown's panel: its name on a line, quantity and timing beside each other; Cancel and Add. */
function CreateSupp({ initial, taken, onCreate, onCancel }: { initial: string; taken: (name: string) => boolean; onCreate: (x: SupplementPreset) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial);
  const [quantity, setQuantity] = useState("");
  const [timing, setTiming] = useState("");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  const dup = taken(name.trim());
  const ok = name.trim().length > 0 && !dup;
  const go = () => onCreate({ name: name.trim(), quantity: quantity.trim(), timing: timing.trim() });
  return (
    <div className="rd-addpop-create" onKeyDown={(e) => (e.key === "Escape" ? onCancel() : e.key === "Enter" && ok ? go() : null)}>
      <span className="rd-addpop-label">New supplement</span>
      <div className="rd-addpop-row">
        <input ref={first} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={60} aria-label="Supplement" />
      </div>
      <div className="rd-addpop-row fill">
        <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" maxLength={30} aria-label="Quantity" />
        <input value={timing} onChange={(e) => setTiming(e.target.value)} placeholder="Timing" maxLength={40} aria-label="Timing" />
      </div>
      {dup && <p className="rd-addpop-warn">{name.trim()} is already on the list.</p>}
      <div className="rd-addpop-foot">
        <button type="button" className="rd-addpop-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="rd-addpop-go" disabled={!ok} onClick={go}>
          Add
        </button>
      </div>
    </div>
  );
}

function Box({ value, onChange, label, placeholder, unit, strong, quiet, autoFocus, readOnly }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; unit?: string; strong?: boolean; quiet?: boolean; autoFocus?: boolean; readOnly?: boolean }) {
  return (
    <span className={`rd-cell rn-box${unit ? " unit" : ""}${strong ? " strong" : ""}${quiet ? " quiet" : ""}`}>
      <input className="rd-cell-box" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "—"} aria-label={label} autoFocus={autoFocus} readOnly={readOnly} />
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


function DayRow({ day, open, due, grid, mealGrid, commentsOn, onToggle, onShot, onMessage }: { day: LoggedDay; open: boolean; due: boolean; grid: React.CSSProperties; mealGrid: React.CSSProperties; commentsOn: (d: string, m: LoggedMeal) => MealComment[]; onToggle: () => void; onShot: (meal: string) => void; onMessage: () => void }) {
  return (
    <div id={`day-${day.date}`} className={`rd-row rn-day${open ? " open" : ""}`}>
      {/* The row opens on a click anywhere; for the keyboard the date is the button (no controls nested in a button). */}
      <div className="rd-row-main" style={grid} onClick={onToggle}>
        <span className="rd-ex">
          <span className="rd-ex-name">
            <button type="button" className="rd-row-hit" aria-expanded={open}>
              <span className="rd-logdate">{logDate(day.date)}</span>
              <Fold open={open} />
              {due && <span className="sr-only">, needs you</span>}
            </button>
            {/* A note from the client: the chat icon in the row, the words once it is opened (21 Oct, Alex). */}
            {day.note && (
              <span className="rd-notemark" title="A note from the client" aria-label="A note from the client">
                <ChatIcon />
              </span>
            )}
            {/* The dot trail's last step (dots.ts, 22 Oct, Alex): their note on this day still to read; opening the day reads it. */}
            {due && <i className="rd-due" role="img" aria-label="needs you" />}
          </span>
        </span>
        <span className="rd-num">{n(day.kcal)}</span>
        <span className={`rd-pill rnt-daypill${day.isTraining ? "" : " quiet"}`}>{day.isTraining ? "Training" : "Rest"}</span>
        <span className="rn-macros" title={`${day.protein} g protein · ${day.carbs} g carbs · ${day.fat} g fat`}>
          <Split p={day.protein * 4} c={day.carbs * 4} f={day.fat * 9} />
        </span>
        {/* The row's one action: a message about this day (on hover), not a menu. */}
        <span className="rd-row-more" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="rd-btn ghost sm" onClick={onMessage} aria-label={`Message about ${logDate(day.date)}`} title="Message about this day">
            <ChatIcon />
          </button>
        </span>
      </div>

      {open && (
        <div className="rn-meals">
          {/* The client's note on the day, inside the opened row (21 Oct, Alex): in the row it made that row taller than
              the rest, and the log keeps one height. */}
          {day.note && <p className="rn-daynote">{day.note}</p>}
          <div className="rd-cols rn-mcols" aria-hidden="true" style={mealGrid}>
            <span>Meal</span>
            <span>Kcal</span>
            <span className="p">Protein</span>
            <span className="c">Carbs</span>
            <span className="f">Fat</span>
            <span />
          </div>
          {day.meals.map((m) => (
            <div key={m.id} id={`meal-${day.date}-${m.id}`} className="rn-meal">
              <div className="rn-meal-head" style={mealGrid}>
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
                  <b>
                    You<Sep />
                    {c.when}
                  </b>
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

/** The client's picture of one meal, and the coach's word under it. The .dlh card (22 Oct, Alex: it was the old
 *  pop-up): the meal and the day, the macros as the one fact line, the photo large, what you said on it before, and a
 *  comment that sends (design rules 4: no line until something is typed; then the line, Cancel and Send). */
function PhotoDialog({ firstName, date, meal, comments, onSend }: { firstName: string; date: string; meal: LoggedMeal; comments: MealComment[]; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const typed = !!text.trim();
  const line = useRef<HTMLTextAreaElement>(null);
  // The line grows with the words, up to 160px (the border under it counted), and scrolls only past that.
  useLayoutEffect(() => {
    const el = line.current;
    if (!el) return;
    el.style.height = "auto";
    const want = el.scrollHeight + 1;
    el.style.height = `${Math.min(160, want)}px`;
    el.style.overflowY = want > 160 ? "auto" : "hidden";
  }, [text]);
  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    // The comment line takes the focus here, not by autoFocus, so the pop-up still knows the photo it was opened from and
    // gives the focus back to it on closing; and the card opens at its top, not scrolled to the line.
    <DialogContent
      className="dlh rn-shotdlg"
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        line.current?.focus({ preventScroll: true });
      }}
    >
      <div className="dlh-head">
        <DialogTitle className="dlh-title">
          {meal.label}
          <Sep />
          {dayMonth(date)}
        </DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <DialogDescription className="dlh-what">
        {n(meal.kcal)} kcal
        <Sep />
        {meal.protein} g protein
        <Sep />
        {meal.carbs} g carbs
        <Sep />
        {meal.fat} g fat
      </DialogDescription>
      {/* A stage of its own height, so the card doesn't move as the picture comes in; the picture in its own shape. */}
      <div className="rn-shotstage">
        {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
        <img className="rn-shotimg" src={meal.photo ?? ""} alt={`${meal.label} on ${logDate(date)}`} />
      </div>
      {comments.length > 0 && (
        <ul className="rn-shotsaid" aria-label="Your comments">
          {comments.map((c) => (
            <li key={c.id}>
              <span className="rn-shotwhen">{c.when}</span>
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={line}
        rows={1}
        className={`dlh-line rn-shotline${typed ? " typed" : ""}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Add a comment for ${firstName}`}
        aria-label={`Comment for ${firstName} on ${meal.label.toLowerCase()}`}
        onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && send()}
      />
      {/* Cancel and Send once something is typed; their room is kept, so the card doesn't move as they come. */}
      <div className="dlh-foot rn-shotfoot">
        {typed && (
          <>
            <DialogClose className="dlh-cancel">Cancel</DialogClose>
            <button type="button" className="dlh-go" onClick={send}>
              Send
            </button>
          </>
        )}
      </div>
    </DialogContent>
  );
}


