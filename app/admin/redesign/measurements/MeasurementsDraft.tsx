"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { addClientPhaseAction, applyMetricChangesAction, deletePhaseAction, deployPhaseNowAction, saveAndSchedulePhaseOrSayWhyAction, sendChatMessageAction, setCheckInDayAction, setMetricSummaryAction, setMonthlyCheckInDayAction, unschedulePhaseAction, updateClientPhaseAction } from "../../../lib/actions";
import type { MessageLink } from "../../../lib/messageLinks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { CalendarIcon, ChartIcon, ChatIcon, ChevronDownIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import type { LoggedMetric, LoggedValues } from "../../../lib/queries";
import { ConfirmDialog, DeletePhaseDialog, MessageDialog, fmtDate, stateLabel, useClickAway } from "../training/TrainingDraft";
import { GoalsNotePills, GripIcon } from "../training/TrainingParts";
import { stateTagStyle } from "../../phaseChrome";
import PhaseDatesDialog from "../PhaseDatesDialog";
import { PhaseDialog, phaseForm as planPhaseForm, type DraftPlan } from "../plan/PlanDraft";
import PhaseSwitcher from "../PhaseSwitcher";
import { useOpenChat } from "../ChatPanel";
import { SortableItem, SortableList } from "../Sortable";
import Picker from "../Picker";
import Pager from "../Pager";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { dayMonth, logDate } from "../../../lib/dayMonth";
import { groupColour } from "../../../lib/categoryColors";
import { defaultSummary, type MetricSummary } from "../../../lib/metricSummary";
import { Sep, SepJoin } from "../Sep";
import { Fold } from "../Fold";
import { useHoldWhile, useSaidSaved } from "../useSaveQueue";
import { landOn } from "../../../lib/landOn";
import { monotoneSegments } from "../../../lib/monotoneCurve";

// The Lifestyle tab, built as Training is (21 Oct, Alex): the phase's name
// to click and type, its state tag as the menu of what can be done with it,
// the goals and the note to the client as two pills on the right. Under it:
//
// - Tracked metrics: one card, a row a metric (its group and the last
//   figure). Daily / Weekly / Monthly on the section's line, each its own
//   list. Adding one is the exercise search's bar (a list that floats, six
//   rows, Create pinned at its foot). Every change saves itself, one after
//   another, and the line says so: Saving…, All changes saved, or Not saved
//   with Retry. Every metric is asked all day (no time of day any more).
// - Check-ins: what the client logged lately, a table, a graph or a feed,
//   for one rhythm at a time.

type State = "live" | "past" | "scheduled" | "draft";
type Cadence = "daily" | "weekly" | "monthly";
export type DraftMetric = { id: number; name: string; unit: string; frequency: Cadence; groupKey: string; groupLabel: string; tint: string; /** Change or average in the check-ins head (21 Oct). */ summary: MetricSummary; last: { value: number; when: string } | null };
export type DraftMeasurements = {
  id: number;
  /** The plan behind the tab (10 Oct): today, this week, every phase and programme, for the New phase dialog the Plan tab has. */
  planCtx: Pick<DraftPlan, "today" | "thisWeek" | "phases" | "programs">;
  /** The coach's goals for the phase, up to three. */
  goals: string[];
  /** The coach's note to the client on this phase (21 Oct), the Note pill. */
  coachNote: string;
  /** The coach has dragged the metrics into an order of their own; else they run group by group. */
  customOrder: boolean;
  phases: { id: number; name: string; weeks: number; state: State }[];
  name: string;
  status: State;
  weeks: number;
  weekIdx: number | null;
  startDate: string | null;
  /** The stored end_week: the last day is six days on. */
  endDate: string | null;
  checkInDay: string | null;
  /** The day of the month the monthly check-in opens; null: none set up yet. */
  monthDay: number | null;
  groups: { key: string; label: string; tint: string }[];
  metrics: DraftMetric[];
  library: { id: string; label: string; group: string; items: { name: string; unit: string; already: boolean }[] }[];
  daily: LoggedValues;
  weekly: LoggedValues;
  dailyLong: LoggedValues;
  weeklyLong: LoggedValues;
  monthly: LoggedValues;
  monthlyLong: LoggedValues;
  notStarted: string | null;
  notes: { id: number; period: string; kind: "daily" | "weekly" | "monthly" | "measurements"; text: string }[];
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
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const n = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 1 }));
// A word unit takes a space ("8 h"); a scale butts up ("4/5"); steps are self-evident.
const tailOf = (unit: string) => {
  const u = unit.trim();
  if (!u || u.toLowerCase() === "steps") return "";
  return u.startsWith("/") ? u : ` ${u}`;
};
const withUnit = (v: number, unit: string) => `${n(v)}${tailOf(unit)}`;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
// Each rhythm in words: the toggle, the card, the stats.
const CAD = {
  daily: { label: "Daily", unit: "days", recent: "in the last 8 days" },
  weekly: { label: "Weekly", unit: "weeks", recent: "in the last 5 weeks" },
  monthly: { label: "Monthly", unit: "months", recent: "in the last 6 months" },
} as const;
const CADENCES = ["daily", "weekly", "monthly"] as const;
/** A check-in in words, for a message's link and a toast: a day as day/month (19/10); a month keeps its label. */
const whenOf = (key: string, label: string) => (/^\d{4}-\d{2}-\d{2}$/.test(key) ? dayMonth(key) : label);
/** A check-in's date, the first thing in its row (21 Oct, Alex: logDate, as every log): the day, or the week's Monday; a month keeps its name. */
const logWhen = (key: string, label: string, cadence: Cadence) => (cadence === "monthly" || !/^\d{4}-\d{2}-\d{2}$/.test(key) ? label : logDate(key));
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

type Dlg =
  | { kind: "message"; label: string; link: MessageLink }
  | { kind: "dates" }
  | { kind: "newPhase" }
  | { kind: "deploy" }
  | { kind: "liveNow" }
  | { kind: "backToDraft" }
  | { kind: "deletePhase" }
  | { kind: "remove"; metric: DraftMetric }
  | null;
type MetricChanges = Parameters<typeof applyMetricChangesAction>[0];

export default function MeasurementsDraft({ clientId, firstName, plan }: { clientId: number; firstName: string; plan: DraftMeasurements }) {
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
  const lastDay = plan.endDate ? addDays(plan.endDate, 6) : null;
  const today = plan.planCtx.today;
  const startHasCome = !!plan.startDate && plan.startDate <= today;

  // ---- What the client is asked for: changed on screen at once, saved behind it (21 Oct, Alex: as Training).
  const [rows, setRows] = useState(plan.metrics);
  const [checkInDay, setCheckInDay] = useState(plan.checkInDay ?? "Monday");
  const [monthDay, setMonthDay] = useState(plan.monthDay);
  // The rhythm on screen: the section's Daily / Weekly / Monthly.
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [adding, setAdding] = useState(false);
  // A row just added has a negative id of its own until its save gives it the real one.
  const tempIds = useRef(0);
  // A drag puts the list in the coach's own order from then on (the server's too).
  const [dragged, setDragged] = useState(false);
  const customOrder = plan.customOrder || dragged;
  // One save at a time, in the order they were made. A failed one stays first in line for Retry.
  const jobs = useRef<(() => Promise<boolean>)[]>([]);
  const running = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const saidSaved = useSaidSaved(saving);
  const run = async () => {
    if (running.current) return;
    running.current = true;
    setSaving(true);
    setFailed(false);
    let ok = true;
    while (ok && jobs.current.length > 0) {
      try {
        ok = await jobs.current[0]();
      } catch {
        ok = false;
      }
      if (ok) jobs.current.shift();
    }
    running.current = false;
    setSaving(false);
    if (!ok) {
      setFailed(true);
      toast.error("Not saved");
    }
    router.refresh();
  };
  const save = (job: () => Promise<boolean>) => {
    jobs.current.push(job);
    void run();
  };
  const saveMetrics = (changes: Partial<Omit<MetricChanges, "clientId" | "phaseId">>) => save(() => applyMetricChangesAction({ clientId, phaseId, adds: [], removes: [], cadence: [], order: null, ...changes }));
  // Leaving while a change is still on its way: the browser asks first (and the page doesn't read itself again meanwhile).
  useHoldWhile(saving || failed);
  // What is saved comes back with the page's re-read and replaces the screen's
  // copy, by content (a re-read with the same values changes nothing), never
  // while a change is on its way. After a failed save the screen shows what is
  // saved (as Training does); the change waits in line for Retry.
  const planKey = JSON.stringify([plan.id, plan.metrics, plan.checkInDay, plan.monthDay]);
  const [seenPlan, setSeenPlan] = useState(planKey);
  if (seenPlan !== planKey && !saving) {
    setSeenPlan(planKey);
    setRows(plan.metrics);
    setCheckInDay(plan.checkInDay ?? "Monday");
    setMonthDay(plan.monthDay);
  }
  const inLibrary = (name: string) => plan.library.some((p) => p.items.some((i) => i.name.toLowerCase() === name.toLowerCase()));
  const addMetric = (name: string, unit: string, groupKey: string) => {
    if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) return;
    const g = plan.groups.find((x) => x.key === groupKey) ?? plan.groups.find((x) => x.key === "other") ?? { key: groupKey, label: "Other", tint: "#dfe6ef" };
    // There at once, faded until the save gives it its number, and where the
    // saved list will have it (no jump when it comes back): last of all once
    // the coach has their own order, else last in its group, groups in order.
    const rank = (k: string) => {
      const i = plan.groups.findIndex((x) => x.key === k);
      return i < 0 ? plan.groups.length : i;
    };
    tempIds.current += 1;
    const made: DraftMetric = { id: -tempIds.current, name, unit, frequency: cadence, groupKey: g.key, groupLabel: g.label, tint: g.tint, summary: defaultSummary(name, unit), last: null };
    setRows((prev) => {
      if (customOrder) return [...prev, made];
      const at = prev.findIndex((r) => rank(r.groupKey) > rank(g.key));
      return at < 0 ? [...prev, made] : [...prev.slice(0, at), made, ...prev.slice(at)];
    });
    saveMetrics({ adds: [{ name, unit, group: g.key, cadence, source: inLibrary(name) ? "library" : "custom" }] });
  };
  const moveTo = (m: DraftMetric, c: Cadence) => {
    setRows((prev) => prev.map((r) => (r.id === m.id ? { ...r, frequency: c } : r)));
    saveMetrics({ cadence: [{ id: m.id, value: c }] });
  };
  // Change or average in the check-ins table's head: on screen at once, saved behind it.
  const setSummary = (m: DraftMetric, s: MetricSummary) => {
    setRows((prev) => prev.map((r) => (r.id === m.id ? { ...r, summary: s } : r)));
    save(() => setMetricSummaryAction(m.id, s));
  };
  const removeMetric = (m: DraftMetric) => {
    setRows((prev) => prev.filter((r) => r.id !== m.id));
    saveMetrics({ removes: [m.id] });
  };
  // The rows of the rhythm on screen; a drag reorders them among themselves.
  const shown = rows.filter((r) => r.frequency === cadence);
  // No drag on an ended phase, nor while a row just added is still saving (its place would be lost).
  const canDrag = plan.status !== "past" && !rows.some((r) => r.id < 0);
  const moveShown = (ids: (number | string)[]) => {
    if (!canDrag) return;
    const queue = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is DraftMetric => !!r);
    const next = rows.map((r) => (r.frequency === cadence ? queue.shift() ?? r : r));
    setRows(next);
    setDragged(true);
    saveMetrics({ order: next.filter((r) => r.id > 0).map((r) => r.id) });
  };
  const setWeeklyDay = (d: string) => {
    setCheckInDay(d);
    const f = new FormData();
    f.set("clientId", String(clientId));
    f.set("check_in_day", d);
    if (phaseId) f.set("phaseId", String(phaseId));
    save(async () => {
      await setCheckInDayAction(f);
      return true;
    });
  };
  const setMonthlyDay = (d: number) => {
    setMonthDay(d);
    save(async () => {
      await setMonthlyCheckInDayAction(clientId, phaseId, d);
      return true;
    });
  };
  const countOf = (c: Cadence) => rows.filter((r) => r.frequency === c).length;
  // Daily / Weekly / Monthly, on the metrics and on the check-ins, each switching only its own section.
  const rhythmToggle = (value: Cadence, set: (c: Cadence) => void, counts: boolean) => (
    <div className="rd-btn-group" role="group" aria-label="Rhythm">
      {CADENCES.map((c) => (
        <button key={c} type="button" className={value === c ? "on" : ""} aria-pressed={value === c} onClick={() => set(c)}>
          {CAD[c].label}
          {counts && countOf(c) > 0 && <small className="rm-cad-count">{countOf(c)}</small>}
        </button>
      ))}
    </div>
  );

  // ---- The phase's name: click it to type (as Training's); Enter or a click away saves, Esc leaves it.
  const [renaming, setRenaming] = useState<string | null>(null);
  // The new name stays up from the moment Enter is pressed (21 Oct, Alex: it went back to the old one until the save came back).
  const [named, setNamed] = useState<{ id: number; from: string; to: string } | null>(null);
  const shownName = named && named.id === plan.id && plan.name === named.from ? named.to : plan.name;
  const commitRename = () => {
    const v = renaming?.trim() ?? "";
    setRenaming(null);
    if (!v || v === shownName || !phaseId || !plan.startDate || !lastDay) return;
    setNamed({ id: plan.id, from: plan.name, to: v });
    act(() => updateClientPhaseAction(phaseForm({ id: phaseId, track: "lifestyle", name: v, start: plan.startDate!, end: lastDay, exact: true })), `Renamed to ${v}`);
  };

  // ---- Check-ins: which way, and which rhythm (its own, apart from the metrics').
  const [show, setShow] = useState<"table" | "graph">("table");
  const [logCadence, setLogCadence] = useState<Cadence>("daily");
  const view = plan[logCadence];
  const longOf = (c: Cadence) => (c === "daily" ? plan.dailyLong : c === "weekly" ? plan.weeklyLong : plan.monthlyLong);
  const long = longOf(logCadence);
  // The Table is the log (24 Oct, Alex: no Feed, no Last 8 | All): everything since the client's first entry, else the
  // recent window when that is longer; the Graph has its own switch.
  const logOf = (c: Cadence) => (longOf(c).periods.length >= plan[c].periods.length ? longOf(c) : plan[c]);
  const logShown = logOf(logCadence);
  // Twenty rows a page, the Pager under the card turning them, as every log (6 Oct).
  const PAGE = 20;
  const [logPage, setLogPage] = useState(1);
  const logPages = Math.max(1, Math.ceil(logShown.periods.length / PAGE));
  const logPageNow = Math.min(logPage, logPages);
  const logPaged = { ...logShown, periods: logShown.periods.slice((logPageNow - 1) * PAGE, logPageNow * PAGE) };
  // One height through the rhythms, the range and the pages (21 Oct, Alex: switching one made the screen jump): room for
  // the most rows any rhythm and range can show, a page at most; a rhythm with nothing asked (None yet) keeps it too.
  const logRows = Math.min(PAGE, Math.max(0, ...CADENCES.map((c) => (plan[c].metrics.length ? Math.max(plan[c].periods.length, longOf(c).periods.length) : 0))));
  const logSteady = !plan.notStarted && show !== "graph" && logRows > 0;
  // The table's sideways scrollbar, once the metrics outrun the card: Windows draws it in the layout, so its height joins
  // the head's or the pager would move by it on a short page. Measured as it comes and goes (the observer's first call too).
  const logCard = useRef<HTMLDivElement>(null);
  const [logBar, setLogBar] = useState(0);
  useEffect(() => {
    const el = logCard.current?.querySelector<HTMLElement>(".rm-scroll");
    if (!el) return;
    const ro = new ResizeObserver(() => setLogBar(Math.max(0, el.offsetHeight - el.clientHeight)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [show, logCadence, view.metrics.length, plan.notStarted]);
  // Arriving from a link in a message (#checkin-weekly, #checkin-weekly-2026-10-12; 21 Oct: it opened at the top):
  // that rhythm, the page holding that check-in, its row in view. On a later link that changes only the #part too.
  useEffect(() => {
    let frame = 0;
    const arrive = () => {
      const m = /^#checkin-(daily|weekly|monthly)(?:-(\d{4}-\d{2}-\d{2}))?$/.exec(window.location.hash);
      if (!m) return;
      const c = m[1] as Cadence;
      const period = m[2] ?? null;
      if (!plan[c].metrics.length) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setLogCadence(c);
        if (!period) return;
        const idx = logOf(c).periods.findIndex((p) => p.key === period);
        if (idx < 0) return;
        setLogPage(Math.floor(idx / PAGE) + 1);
        setShow("table");
        // Brought to the middle and lit (24 Oct, Alex: a link lands on its thing).
        setTimeout(() => landOn(document.querySelector(`[data-checkin="${c}-${period}"]`)), 120);
      });
    };
    arrive();
    window.addEventListener("hashchange", arrive);
    return () => {
      window.removeEventListener("hashchange", arrive);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on arrival and on a new #part only
  }, []);
  // The client's note on a check-in sits by its date (a bubble); Reply there is a message linked to that check-in.
  const replyTo = (period: string) => message({ label: `${CAD[logCadence].label} check-in · ${whenOf(period, logShown.periods.find((p) => p.key === period)?.label ?? period)}`, link: { kind: "checkin", section: logCadence, period } });

  const [dlg, setDlg] = useState<Dlg>(null);
  // Messaging about a check-in, a metric or a note slides the chat in from
  // the right (ChatPanel, 2 Oct), the message pointing at it; outside the
  // shell, the message dialog as before.
  const openChat = useOpenChat();
  const message = (v: { label: string; link: MessageLink }) => (openChat ? openChat({ area: "Lifestyle", label: v.label, link: v.link }) : setDlg({ kind: "message", ...v }));
  const close = () => setDlg(null);
  const grid = { gridTemplateColumns: "20px minmax(200px, 1.4fr) 128px minmax(160px, 1fr) 32px", columnGap: 20 } as const;
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

  return (
    <div className={`rd trn rls${plan.status === "past" ? " rd-past" : ""}`}>
      {plan.status === "past" && (
        <div className="rd-past-note" role="note">
          <b>Ended.</b> This phase is here to look back on; nothing in it can be changed.
        </div>
      )}
      {/* ---- Header (21 Oct, as Training's): the name to click and type, the ▾ to switch phase, the state tag as its menu;
          the weeks and dates under it; on the right the goals and note pills and the menu. */}
      {/* No fact line, no room kept for one; no phase, the track's name is the title and the eyebrow goes (22 Oct, Alex). */}
      <header className={`trn-head${plan.startDate ? "" : " bare"}`}>
        <div className="trn-head-main">
          {phaseId != null && <span className="trn-eyebrow">Lifestyle</span>}
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
                    "Lifestyle"
                  )}
                  {/* Real phases only: with none, nothing is live (22 Oct, Alex: the client-level sheet showed as a live phase). */}
                  <PhaseSwitcher name="" currentId={plan.id} items={plan.phases.filter((p) => p.id > 0)} hrefFor={(id) => `/admin/redesign/measurements?client=${clientId}&phase=${id}`} label="Switch phase" newLabel="New phase" onNew={() => setDlg({ kind: "newPhase" })} />
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
            {/* Every change saves itself (21 Oct); the status beside the title and its tag (Alex), as on Training and Nutrition. */}
            {phaseId != null &&
              (failed ? (
                <span className="trn-allsaved failed" role="alert">
                  Not saved<Sep />
                  <button type="button" onClick={() => void run()}>
                    Retry
                  </button>
                </span>
              ) : (
                // Nothing until something is saved (22 Oct, Alex).
                saidSaved && (
                  <span className={`trn-allsaved${saving ? " saving" : ""}`} role="status">
                    {saving ? "Saving…" : "All changes saved"}
                  </span>
                )
              ))}
          </div>
          {plan.startDate && (
            // The facts parted by a thin upright line, not a dot (21 Oct, Alex), as the metrics' line under it.
            <span className="trn-meta">
              <span>
                {plan.weeks} {plan.weeks === 1 ? "week" : "weeks"}
              </span>
              {plan.weekIdx != null && (
                <span className="trn-meta-part">
                  week {plan.weekIdx} of {plan.weeks}
                </span>
              )}
              {/* The dates last (21 Oct, Alex). */}
              <span className="trn-meta-part">
                {fmtDate(plan.startDate)}
                {lastDay && ` – ${fmtDate(lastDay)}`}
              </span>
            </span>
          )}
        </div>
        <div className="trn-head-actions">
          {/* The goals and the note to the client as pills (21 Oct, as Training's), one pop-over under them. */}
          {phaseId != null && <GoalsNotePills firstName={firstName} phaseId={phaseId} goals={plan.goals} note={plan.coachNote} area="lifestyle" />}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="trn-more" aria-label="More for the phase">
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={() => message({ label: "Lifestyle", link: { kind: "checkin", section: logCadence } })}>
                <ChatIcon /> Message about lifestyle
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

      {/* ---- Tracked metrics: what the client is asked for, one rhythm at a time. */}
      <section className="rls-section">
        <div className="trn-weekhead">
          <div>
            <h2>Tracked metrics</h2>
            <span>
              {shown.length} {CAD[cadence].label.toLowerCase()} {shown.length === 1 ? "metric" : "metrics"}
            </span>
          </div>
          <div className="trn-weekhead-actions">
            {/* The day this rhythm's check-in opens, beside the rhythm it belongs to. */}
            {cadence === "weekly" && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="trn-btn" aria-label="Which day the weekly check-in opens">
                  <CalendarIcon /> Opens {checkInDay}
                  <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="pb-menu">
                  {DAYS.map((d) => (
                    <DropdownMenuItem key={d} onSelect={() => setWeeklyDay(d)}>
                      {d}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {cadence === "monthly" && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="trn-btn" aria-label="Which day of the month the monthly check-in opens">
                  <CalendarIcon /> Opens on the {ordinal(monthDay ?? 1)}
                  <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="pb-menu rm-monthdays">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <DropdownMenuItem key={d} onSelect={() => setMonthlyDay(d)}>
                      {ordinal(d)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {rhythmToggle(cadence, setCadence, true)}
          </div>
        </div>
        <div className="rls-card">
          {!phaseId ? (
            <div className="rls-empty">
              <span>No phase yet</span>
              <button type="button" className="trn-btn primary" onClick={() => setDlg({ kind: "newPhase" })}>
                New phase
              </button>
            </div>
          ) : (
            <>
              {shown.length > 0 && (
                <div className="rls-cols" aria-hidden="true" style={grid}>
                  <span />
                  <span>Metric</span>
                  <span>Group</span>
                  <span>Last</span>
                  <span />
                </div>
              )}
              <SortableList ids={shown.map((m) => m.id)} label="metric" onMove={moveShown}>
                {shown.map((m) => {
                  // Just added: there, faded and still, until the save gives it its number.
                  const incoming = m.id < 0;
                  return (
                    <SortableItem key={m.id} id={m.id} className={`rls-row${incoming ? " trn-incoming" : ""}`}>
                      {(grip) => (
                        <div className="rls-row-main" style={grid}>
                          <span className="rd-grip trn-grip" {...(canDrag ? grip : {})}>
                            <GripIcon />
                          </span>
                          <span className="rls-name">
                            <b>{m.name}</b>
                            {m.unit && <small>{m.unit}</small>}
                          </span>
                          <span className="rls-group" style={{ background: m.tint, color: groupColour(m.groupKey).hex }}>
                            {m.groupLabel}
                          </span>
                          {m.last ? (
                            <span className="rls-last">
                              {withUnit(m.last.value, m.unit)}
                              <small>{m.last.when}</small>
                            </span>
                          ) : (
                            <span className="rls-last none">None yet</span>
                          )}
                          <span className="rls-more">
                            {!incoming && (
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger className="trn-row-more" aria-label={`More for ${m.name}`}>
                                  <MoreIcon />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="pb-menu">
                                  <DropdownMenuItem onSelect={() => message({ label: m.name, link: { kind: "checkin", section: m.frequency } })}>
                                    <ChatIcon /> Message about {m.name}
                                  </DropdownMenuItem>
                                  {/* To another rhythm: it leaves this list for that one. */}
                                  {CADENCES.filter((c) => c !== m.frequency).map((c) => (
                                    <DropdownMenuItem key={c} onSelect={() => moveTo(m, c)}>
                                      <CalendarIcon /> Ask {c} instead
                                    </DropdownMenuItem>
                                  ))}
                                  {/* What sums it up in the check-ins table's head (21 Oct, Alex). */}
                                  <DropdownMenuItem onSelect={() => setSummary(m, m.summary === "change" ? "average" : "change")}>
                                    <ChartIcon /> {m.summary === "change" ? "Show the average" : "Show the change"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "remove", metric: m })}>
                                    <TrashIcon /> Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </span>
                        </div>
                      )}
                    </SortableItem>
                  );
                })}
              </SortableList>
              {/* + Metric opens a dropdown with the search at its top (21 Oct, Alex): the card never stretches while adding. */}
              {adding ? (
                <AddMetricRow library={plan.library} groups={plan.groups} have={rows.map((r) => r.name.toLowerCase())} onAdd={addMetric} onClose={() => setAdding(false)} />
              ) : (
                <button type="button" className="rls-add" onClick={() => setAdding(true)}>
                  <PlusIcon /> Metric
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* ---- Check-ins: what the client logged lately, three ways. Still to be looked through on an ended phase (rd-keep). */}
      <section className="rls-section rd-keep">
        <div className="trn-weekhead">
          <div>
            <h2>Check-ins</h2>
          </div>
          <div className="trn-weekhead-actions">
            <div className="rd-btn-group" role="group" aria-label="Show as">
              {(["table", "graph"] as const).map((s) => (
                <button key={s} type="button" className={show === s ? "on" : ""} aria-pressed={show === s} onClick={() => setShow(s)}>
                  {s === "table" ? "Table" : "Graph"}
                </button>
              ))}
            </div>
            {rhythmToggle(logCadence, setLogCadence, false)}
          </div>
        </div>
        {/* As tall as its fullest page (.rd-steady): a row is 42px with its hairline, under a 45.75px head; the card's edge,
            padding and the rows' own 12px under them make up the rest. The Graph keeps its own height. */}
        <div
          ref={logCard}
          className={`rls-card rls-log${logSteady ? " rd-steady" : ""}`}
          style={logSteady ? ({ "--log-rows": logRows, "--log-row": "42px", "--log-head": `${73.75 + logBar}px` } as React.CSSProperties) : undefined}
        >
          {/* Not started or nothing asked: two words, the header already says the state and the dates. */}
          {plan.notStarted ? (
            <p className="rls-none">None yet</p>
          ) : view.metrics.length === 0 ? (
            <p className="rls-none">None yet</p>
          ) : show === "table" ? (
            <CheckinTable view={logPaged} whole={logShown} cadence={logCadence} summaryOf={(m) => rows.find((r) => r.id === m.id)?.summary ?? m.summary} onReply={replyTo} />
          ) : (
            <Graphs key={logCadence} view={long.periods.length ? long : view} cadence={logCadence} shortCount={logCadence === "daily" ? 7 : logCadence === "weekly" ? 5 : 6} />
          )}
        </div>
        {/* The pager floats under the card, not in it (21 Oct, Alex). */}
        {!plan.notStarted && view.metrics.length > 0 && show !== "graph" && (
          <Pager page={logPageNow} pages={logPages} from={(logPageNow - 1) * PAGE} shown={logPaged.periods.length} total={logShown.periods.length} noun={CAD[logCadence].unit} label="Check-in pages" onPage={setLogPage} />
        )}
      </section>

      {/* ---- Dialogs. One open at a time. */}
      <Dialog open={dlg != null} onOpenChange={(o) => !o && close()}>
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
        {dlg?.kind === "remove" && (
          <RemoveMetricDialog
            metric={dlg.metric}
            firstName={firstName}
            onRemove={() => {
              const m = dlg.metric;
              close();
              removeMetric(m);
            }}
            onClose={close}
          />
        )}
        {dlg?.kind === "dates" && (
          <PhaseDatesDialog
            track="lifestyle"
            title="Dates"
            name={plan.name}
            start={plan.startDate}
            end={plan.endDate}
            firstName={firstName}
            what="these metrics"
            confirm="Save"
            onConfirm={(v) => {
              close();
              if (phaseId) act(() => updateClientPhaseAction(phaseForm({ id: phaseId, track: "lifestyle", name: v.name || plan.name, start: v.start, end: v.end, exact: true })), `${v.name || plan.name}: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
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
            track="lifestyle"
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
            track="lifestyle"
            title={`Schedule ${plan.name}`}
            start={plan.startDate}
            end={plan.endDate}
            firstName={firstName}
            what="these metrics"
            confirm="Schedule it"
            onConfirm={(v) => {
              close();
              if (!phaseId) return;
              // Scheduled, or why not (21 Oct: an empty draft said "scheduled" and stayed a draft).
              startTransition(async () => {
                const why = await saveAndSchedulePhaseOrSayWhyAction(phaseForm({ id: phaseId, track: "lifestyle", name: plan.name, start: v.start, end: v.end, exact: true }));
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
            description={`${firstName}'s check-in asks for these metrics from today.`}
            confirm="Make it live"
            onConfirm={() => {
              close();
              goLive();
            }}
          />
        )}
        {/* Now, whatever its dates say (21 Oct, as Training): it starts today. */}
        {dlg?.kind === "liveNow" && (
          <ConfirmDialog
            title={`Make ${plan.name} live now?`}
            description={`It starts today; ${firstName}'s check-in asks for these metrics from now.`}
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
        {/* Deleting the phase from here too (21 Oct, as Training). What the client logged stays: it is theirs, not the phase's. */}
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
                router.push(`${window.location.pathname}?client=${clientId}&tab=measurements`, { scroll: false });
              });
            }}
            onClose={close}
          />
        )}
      </Dialog>
    </div>
  );
}

/** Taking a metric off the check-in, in the delete pop-up's style (21 Oct). Its
 *  logged values go with it, so when there are any a tick has to be checked first. */
function RemoveMetricDialog({ metric: m, firstName, onRemove, onClose }: { metric: DraftMetric; firstName: string; onRemove: () => void; onClose: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const logged = m.last != null;
  return (
    <DialogContent
      className="dlh"
      role="alertdialog"
      onOpenAutoFocus={(ev) => {
        ev.preventDefault();
        setTimeout(() => cancel.current?.focus(), 60);
      }}
    >
      <div className="dlh-head">
        <DialogTitle className="dlh-title">Remove {m.name}?</DialogTitle>
        <button type="button" className="dlh-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <DialogDescription className="dlh-what">{logged ? "This permanently deletes what was logged for it. It can’t be undone." : `It comes off ${firstName}’s check-in.`}</DialogDescription>
      {logged && (
        <button type="button" role="checkbox" aria-checked={agreed} className="dlh-ack" onClick={() => setAgreed((x) => !x)}>
          <span className={`dlh-box${agreed ? " on" : ""}`} aria-hidden="true">
            {agreed ? "✓" : ""}
          </span>
          Delete {firstName}&rsquo;s logged {m.name} too
        </button>
      )}
      <div className="dlh-foot">
        <button ref={cancel} type="button" className="dlh-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="dlh-delete" disabled={logged && !agreed} onClick={onRemove}>
          Remove
        </button>
      </div>
    </DialogContent>
  );
}

/** Adding a metric, as an exercise is added on Training (21 Oct, Alex): one
 *  search bar. Type for matches; the chevron opens the groups, a group its
 *  metrics. The list floats over the page, six rows then it scrolls, Create
 *  pinned at its foot. A pick becomes a row and the bar stays for the next. */
function AddMetricRow({ library, groups, have, onAdd, onClose }: { library: DraftMeasurements["library"]; groups: DraftMeasurements["groups"]; have: string[]; onAdd: (name: string, unit: string, group: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState(false);
  const [pack, setPack] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [creating, setCreating] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useClickAway(wrap, onClose);
  useEffect(() => {
    box.current?.focus();
  }, []);
  const needle = q.trim().toLowerCase();
  type Item = { name: string; unit: string; group: string; pack: string; taken: boolean };
  const itemOf = (p: DraftMeasurements["library"][number], i: DraftMeasurements["library"][number]["items"][number]): Item => ({ name: i.name, unit: i.unit, group: p.group, pack: p.label, taken: i.already || have.includes(i.name.toLowerCase()) });
  // What the list shows: matches while typing; else the picked group's metrics; else, with the chevron open, the groups.
  const matches: Item[] = needle ? library.flatMap((p) => p.items.filter((i) => i.name.toLowerCase().includes(needle)).map((i) => itemOf(p, i))) : [];
  const packNow = pack ? library.find((p) => p.id === pack) : undefined;
  const inPack: Item[] = !needle && packNow ? packNow.items.map((i) => itemOf(packNow, i)) : [];
  const list = needle ? matches : inPack;
  const showPacks = !needle && browse && !pack;
  const exact = needle && matches.some((m) => m.name.toLowerCase() === needle);
  const pick = (m: Item) => {
    if (m.taken) return;
    onAdd(m.name, m.unit, m.group);
    setQ("");
    setCursor(0);
    setPack(null);
    setBrowse(false);
    box.current?.focus();
  };
  // Creating one floats in the same panel (21 Oct, Alex): the card never stretches for it.
  const open = creating || showPacks || (!!pack && !needle) || !!needle;
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pop.current?.querySelector(".rd-addrow-item.on")?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);
  // The category's word in its colour (21 Oct, Alex), as the group pill on the rows; a unit stays grey.
  const row = (m: Item, i: number, hint: "group" | "unit") => (
    <button key={`${m.pack}-${m.name}`} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}${m.taken ? " taken" : ""}`} disabled={m.taken} onMouseEnter={() => setCursor(i)} onClick={() => pick(m)}>
      {m.name}
      <small style={!m.taken && hint === "group" ? { color: groupColour(m.group).hex } : undefined}>{m.taken ? "On the list" : hint === "group" ? m.pack : m.unit}</small>
    </button>
  );
  return (
    // A dropdown under + Metric, the search bar at its top (21 Oct, Alex): the metrics card never changes while adding.
    <div ref={wrap} className="rd-addrow rls-addrow">
      <Popover open onOpenChange={() => {}}>
        <PopoverAnchor asChild>
          <button type="button" className="rls-add on" onClick={onClose} aria-expanded="true">
            <PlusIcon /> Metric
          </button>
        </PopoverAnchor>
        <PopoverContent
          ref={pop}
          className="rd-addpop rls-findpop"
          align="start"
          sideOffset={6}
          // Straight into the search: the bar is in the panel, which mounts after the row does.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            box.current?.focus();
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          // + Metric is outside the panel; a click on it closes the search itself.
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
              placeholder={packNow ? `${packNow.label} · type to narrow` : "Search metrics"}
              aria-label="Search metrics"
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
            <CreateMetric
              groups={groups}
              initial={q.trim()}
              taken={(name) => have.includes(name.toLowerCase())}
              onCreate={(name, unit, group) => {
                setCreating(false);
                onAdd(name, unit, group);
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
                {library.map((p) => (
                  <button key={p.id} type="button" role="option" aria-selected={false} className="rd-addrow-item" onClick={() => setPack(p.id)}>
                    {p.label}
                    <small>{p.items.length}</small>
                  </button>
                ))}
              </div>
              <button type="button" className="rd-addrow-item create" onClick={() => setCreating(true)}>
                <PlusIcon /> Create your own metric
              </button>
            </>
          )}
          {!creating && packNow && !needle && (
            <>
              <button type="button" className="rd-addrow-back" onClick={() => setPack(null)}>
                ‹ All groups
              </button>
              <div className="rd-addpop-scroll" role="listbox" aria-label={packNow.label}>
                {list.map((m, i) => row(m, i, "unit"))}
              </div>
            </>
          )}
          {!creating && needle && (
            <>
              {list.length > 0 && (
                <div className="rd-addpop-scroll" role="listbox" aria-label="Metrics">
                  {list.map((m, i) => row(m, i, "group"))}
                </div>
              )}
              {!exact && (
                <button type="button" className={`rd-addrow-item create${list.length === 0 ? " on solo" : ""}`} onClick={() => setCreating(true)}>
                  <PlusIcon /> Create &ldquo;{q.trim()}&rdquo; as your own metric
                </button>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** A metric of your own, in the search's floating panel (21 Oct, Alex): its name, unit and group on clean lines; Cancel and Add. */
function CreateMetric({ groups, initial, taken, onCreate, onCancel }: { groups: DraftMeasurements["groups"]; initial: string; taken: (name: string) => boolean; onCreate: (name: string, unit: string, group: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial);
  const [unit, setUnit] = useState("");
  const [group, setGroup] = useState(groups.find((g) => g.key === "other")?.key ?? groups[0]?.key ?? "other");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  const dup = taken(name.trim());
  const ok = name.trim().length > 0 && !dup;
  return (
    <div className="rd-addpop-create" onKeyDown={(e) => (e.key === "Escape" ? onCancel() : e.key === "Enter" && ok ? onCreate(name.trim(), unit.trim(), group) : null)}>
      <span className="rd-addpop-label">New metric</span>
      {/* The name on a line of its own (21 Oct, Alex: it was squeezed by the unit and group beside it). */}
      <div className="rd-addpop-row">
        <input ref={first} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={60} aria-label="Metric" />
      </div>
      <div className="rd-addpop-row fill">
        <input className="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" maxLength={12} aria-label="Unit" />
        <Picker value={group} onChange={setGroup} label="Group" options={groups.map((g) => ({ value: g.key, label: g.label }))} />
      </div>
      {dup && <p className="rd-addpop-warn">{name.trim()} is already on the list.</p>}
      <div className="rd-addpop-foot">
        <button type="button" className="rd-addpop-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="rd-addpop-go" disabled={!ok} onClick={() => onCreate(name.trim(), unit.trim(), group)}>
          Add
        </button>
      </div>
    </div>
  );
}

// One grid for the whole table: the head, every row and the Change line are
// cells of the same container, so a column cannot drift off its heading.
/** The note the client left on a check-in: a bubble by the date; a click opens it, with Reply (a message linked to that check-in). */
function NoteBubble({ text, onReply }: { text: string; onReply: () => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rm-notebtn" onClick={(e) => e.stopPropagation()} aria-label="Note from the client" title="Note from the client">
          <ChatIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="rm-notepop w-80" onClick={(e) => e.stopPropagation()}>
        <p>{text}</p>
        <div className="rm-notepop-foot">
          {/* The one action, a small ink pill (21 Oct: was navy). */}
          <button type="button" className="rm-reply" onClick={onReply}>
            Reply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CheckinTable({ view, whole, cadence, summaryOf, onReply }: { view: LoggedValues; /** Every period in the range shown, all pages: what each head sums up. */ whole: LoggedValues; cadence: Cadence; summaryOf: (m: LoggedMetric) => MetricSummary; onReply: (period: string) => void }) {
  const valueFor = (m: number, p: string) => view.values[`${m}:${p}`] ?? null;
  // Each column sums itself up in its head (21 Oct, Alex; rules §8: a summary lives in the column head, never a row
  // of data): its change from the first day shown to the last (weight), or its average (sleep, resting HR).
  const summary = (m: LoggedMetric) => {
    const seen = whole.periods.map((p) => whole.values[`${m.id}:${p.key}`]).filter((v): v is number => v != null);
    if (summaryOf(m) === "average") {
      if (seen.length === 0) return null;
      const avg = seen.reduce((a, b) => a + b, 0) / seen.length;
      // Whole numbers once it is in the hundreds (steps), a decimal below (7.4 h).
      return { label: "Avg", text: n(Math.abs(avg) >= 100 ? Math.round(avg) : Math.round(avg * 10) / 10), tone: "" };
    }
    if (seen.length < 2) return null;
    const [newest, oldest] = [seen[0], seen[seen.length - 1]];
    const delta = Math.round((newest - oldest) * 10) / 10;
    const pct = oldest === 0 ? null : Math.round((delta / Math.abs(oldest)) * 100);
    const tone = m.goodDirection === "none" || delta === 0 ? "" : (m.goodDirection === "down") === delta < 0 ? " up" : " down";
    return { label: "Change", text: `${delta > 0 ? "+" : ""}${n(delta)}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}`, tone };
  };
  return (
    <div className="rm-scroll">
      <div className="rm-table" style={{ gridTemplateColumns: `150px repeat(${view.metrics.length}, minmax(96px, 1fr))` }}>
        <span className="rm-th" style={{ paddingLeft: 10 }}>
          Date
        </span>
        {view.metrics.map((m) => {
          const s = summary(m);
          return (
            <span key={m.id} className="rm-th">
              <span className="rm-th-top">
                <span className="rm-th-name">{m.name}</span>
                {s && (
                  <span className={`rm-th-sum${s.tone}`}>
                    {s.label} <b>{s.text}</b>
                  </span>
                )}
              </span>
              <em style={{ color: m.colour }}>
                {m.categoryLabel}
                {m.unit ? (
                  <>
                    <Sep />
                    {m.unit}
                  </>
                ) : null}
              </em>
            </span>
          );
        })}
        {view.periods.map((p, i) => (
          <div key={p.key} className="contents">
            <span className={`rm-td date${i === 0 ? " now" : ""}`} data-checkin={`${cadence}-${p.key}`}>
              <span className="rd-logdate">{logWhen(p.key, p.label, cadence)}</span>
              {view.notes[p.key] && <NoteBubble text={view.notes[p.key]} onReply={() => onReply(p.key)} />}
            </span>
            {view.metrics.map((m) => {
              const v = valueFor(m.id, p.key);
              return (
                <span key={m.id} className={`rm-td${i === 0 ? " now" : ""}${v == null ? " none" : ""}`}>
                  {v == null ? "—" : n(v)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// The Graph (24 Oct, Alex: mockup A, docs/boards/lifestyle-graph-mockup.html). On the left every metric as a row in its
// group's colour: the group, its name and latest, its own small line and its change over the range, the list scrolling
// on its own when there are many (seven metrics never stretch the card). On the right the one picked, as Home's Weight
// chart: the latest big in light numerals with its change, the facts under it, the line in the group's colour with no
// dots, a missed stretch dashed, the coach's target dashed, the latest point ringed, the values on the right and the
// dates under it; hovering reads a period. One at a time because kilos and steps cannot share an axis.
type GraphRange = "short" | "mid" | "long";

/** A metric's readings over the periods shown, oldest first, and what they say. */
function seriesOf(m: LoggedMetric, periods: { key: string; label: string }[], valueFor: (m: number, p: string) => number | null) {
  const points = periods.map((p) => ({ label: p.label, value: valueFor(m.id, p.key) }));
  const seen = points.map((p, i) => ({ ...p, i })).filter((p): p is { label: string; value: number; i: number } => p.value != null);
  const first = seen[0] ?? null;
  const last = seen[seen.length - 1] ?? null;
  const delta = first && last && seen.length > 1 ? Math.round((last.value - first.value) * 10) / 10 : null;
  // Green toward good, red away: the metric's own way, else toward its target; grey with neither.
  let tone: "good" | "warn" | "" = "";
  if (delta != null && delta !== 0 && first && last) {
    if (m.goodDirection !== "none") tone = (m.goodDirection === "down") === delta < 0 ? "good" : "warn";
    else if (m.target != null) tone = Math.abs(last.value - m.target) < Math.abs(first.value - m.target) ? "good" : "warn";
  }
  return { points, seen, first, last, delta, tone };
}

const rangeWords = (r: GraphRange, shortCount: number, midCount: number, cadence: Cadence) =>
  r === "short" ? `${shortCount} ${CAD[cadence].unit}` : r === "mid" ? `${midCount} ${CAD[cadence].unit}` : "This phase";

function Graphs({ view, cadence, shortCount }: { view: LoggedValues; cadence: Cadence; shortCount: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  // 7 days, 30 days, or the whole phase (12 weeks / 6 months in the middle for the other cadences).
  const [range, setRange] = useState<GraphRange>("mid");
  const midCount = cadence === "daily" ? 30 : cadence === "weekly" ? 12 : 6;
  const valueFor = (m: number, p: string) => view.values[`${m}:${p}`] ?? null;
  const metric = view.metrics.find((m) => m.id === picked) ?? view.metrics[0];
  const hasLong = view.periods.length > shortCount;
  const hasMid = view.periods.length > midCount;
  const shownRange: GraphRange = range === "mid" && !hasMid ? "long" : range === "long" && !hasLong ? "short" : range;
  const periods = [...(shownRange === "short" ? view.periods.slice(0, shortCount) : shownRange === "mid" ? view.periods.slice(0, midCount) : view.periods)].reverse();
  return (
    <div className="rm-graphs">
      <nav className="rm-graph-list" aria-label="Metric on the graph">
        {view.metrics.map((m) => {
          const s = seriesOf(m, periods, valueFor);
          const tail = tailOf(m.unit);
          return (
            <button key={m.id} type="button" className={`rm-graph-pick${m.id === metric.id ? " on" : ""}`} aria-pressed={m.id === metric.id} onClick={() => setPicked(m.id)}>
              <span className="rm-graph-cat" style={{ color: m.colour }}>
                {m.categoryLabel}
              </span>
              <span className="rm-graph-pick-row">
                <b>{m.name}</b>
                <em>{s.last ? withUnit(s.last.value, m.unit) : "—"}</em>
              </span>
              <Spark points={s.points} colour={m.colour} />
              <span className={`rm-graph-pick-delta${s.tone ? ` ${s.tone}` : ""}`}>
                {s.delta == null ? (s.last ? "One reading" : "Nothing logged") : s.delta === 0 ? "No change" : `${s.delta > 0 ? "+" : "−"}${n(Math.abs(s.delta))}${tail}`}
              </span>
            </button>
          );
        })}
      </nav>
      <MetricGraph
        key={metric.id}
        metric={metric}
        series={seriesOf(metric, periods, valueFor)}
        rangeSwitch={
          hasLong ? (
            <div className="rd-btn-group" role="group" aria-label="Range">
              {(hasMid ? (["short", "mid", "long"] as const) : (["short", "long"] as const)).map((r) => (
                <button key={r} type="button" className={shownRange === r ? "on" : ""} onClick={() => setRange(r)} aria-pressed={shownRange === r}>
                  {rangeWords(r, shortCount, midCount, cadence)}
                </button>
              ))}
            </div>
          ) : null
        }
      />
    </div>
  );
}

/** The line through a metric's readings, drawn as Home's Weight chart (24 Oct, Alex: loose strokes "look drawn with a pen
    whose ink is about to run out"): one joined path, straight between readings with the corners rounded off, and dashed
    over a stretch where readings were missed, the line still joining them. A run goes on while the style does. */
function LinePaths({ pts, colour, className }: { pts: { x: number; y: number; missed: boolean }[]; colour: string; className: string }) {
  if (pts.length < 2) return null;
  const last = pts.length - 1;
  // Smooth through every reading, never past one (25 Oct, Alex: option B; monotoneCurve, as Home's Weight card).
  const segs = monotoneSegments(pts);
  const line = { solid: "", dashed: "" };
  for (let i = 1; i <= last; i++) {
    const style = pts[i].missed ? "dashed" : "solid";
    const goesOn = i > 1 && pts[i - 1].missed === pts[i].missed;
    line[style] += `${goesOn ? "" : `M${pts[i - 1].x.toFixed(2)} ${pts[i - 1].y.toFixed(2)} `}${segs[i - 1]} `;
  }
  return (
    <>
      {line.solid && <path className={className} d={line.solid} stroke={colour} vectorEffect="non-scaling-stroke" />}
      {line.dashed && <path className={`${className} gap`} d={line.dashed} stroke={colour} vectorEffect="non-scaling-stroke" />}
    </>
  );
}

/** A metric's small line in the list: its colour, no dots, a gap dashed. */
function Spark({ points, colour }: { points: { value: number | null }[]; colour: string }) {
  const seen = points.map((p, i) => ({ v: p.value, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (seen.length < 2) return null;
  const lo = Math.min(...seen.map((p) => p.v));
  const hi = Math.max(...seen.map((p) => p.v));
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo || 1)) * 22;
  return (
    <svg className="rm-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <LinePaths pts={seen.map((p, k) => ({ x: x(p.i), y: y(p.v), missed: k > 0 && p.i - seen[k - 1].i > 1 }))} colour={colour} className="rm-spark-line" />
    </svg>
  );
}

const W = 900;
const H = 260;
const PAD = { l: 4, r: 4, t: 14, b: 10 };

// 1 / 2 / 5 steps, so the axis reads 86 / 87 / 88 rather than 86.3 / 87.1.
function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi <= lo) return [lo];
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  const step = (r > 5 ? 10 : r > 2 ? 5 : r > 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1000; v += step) out.push(Math.round(v * 1000) / 1000 + 0);
  return out;
}

function MetricGraph({ metric: m, series, rangeSwitch = null }: { metric: LoggedMetric; series: ReturnType<typeof seriesOf>; rangeSwitch?: React.ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const { points, seen, first, last, delta, tone } = series;
  const unit = m.unit.trim();
  const tail = tailOf(unit);
  if (!first || !last) {
    return (
      <section className="rm-graph">
        <header className="rm-graph-head">
          <span className="rm-graph-cat" style={{ color: m.colour }}>
            {m.categoryLabel}
          </span>
          {rangeSwitch}
        </header>
        <p className="rm-graph-empty">Nothing logged for {m.name} in this range.</p>
      </section>
    );
  }
  const avg = Math.round((seen.reduce((t, p) => t + p.value, 0) / seen.length) * 10) / 10;
  // A rating out of N sits on its own full scale; everything else gets some of its range as breathing room, and the target in view.
  const scale = /^\/\s*(\d+)$/.exec(unit);
  const vals = seen.map((p) => p.value).concat(m.target != null ? [m.target] : []);
  const lo0 = Math.min(...vals);
  const hi0 = Math.max(...vals);
  const pad = hi0 - lo0 > 0 ? (hi0 - lo0) * 0.15 : Math.max(Math.abs(hi0) * 0.02, 0.5);
  const [lo, hi] = scale ? [0, Number(scale[1])] : [lo0 - pad, hi0 + pad];
  const x = (i: number) => PAD.l + (points.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (points.length - 1));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const ticks = niceTicks(lo, hi, 3);
  // The first, middle and last period under it, as Home's Weight chart.
  const dateAt = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const shown = hover != null ? seen.find((p) => p.i === hover) ?? null : null;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <section className="rm-graph">
      <header className="rm-graph-head">
        <span className="rm-graph-cat" style={{ color: m.colour }}>
          {m.categoryLabel}
        </span>
        {rangeSwitch}
      </header>
      <div className="rm-graph-figure">
        <span className="rm-graph-now">
          {n(last.value)}
          {tail && <small>{tail.trim()}</small>}
        </span>
        {delta != null && (
          <span className={`rm-graph-delta${tone ? ` ${tone}` : ""}`}>
            {delta === 0 ? "No change" : `${delta > 0 ? "+" : "−"}${n(Math.abs(delta))}${tail}`}
          </span>
        )}
      </div>
      <div className="rm-graph-facts">
        {/* The value, its change and the average alone (24 Oct, Alex: the list already says which metric). */}
        Average {n(avg)}
        {tail}
      </div>
      <div className="rm-graph-plot">
        <svg
          className="rm-graph-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${m.name}: ${seen.length} readings, latest ${n(last.value)}${tail}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const at = ((e.clientX - box.left) / box.width) * W;
            let best = seen[0];
            for (const p of seen) if (Math.abs(x(p.i) - at) < Math.abs(x(best.i) - at)) best = p;
            setHover(best.i);
          }}
        >
          {ticks.map((t) => (
            <line key={t} className="rm-graph-base" x1={0} x2={W} y1={y(t)} y2={y(t)} vectorEffect="non-scaling-stroke" />
          ))}
          {m.target != null && <line className="rm-graph-goal" x1={0} x2={W} y1={y(m.target)} y2={y(m.target)} stroke={m.colour} vectorEffect="non-scaling-stroke" />}
          {/* Straight between readings in the group's colour; over a missed stretch dashed, the line still joining them. */}
          <LinePaths pts={seen.map((p, k) => ({ x: x(p.i), y: y(p.value), missed: k > 0 && p.i - seen[k - 1].i > 1 }))} colour={m.colour} className="rm-graph-line" />
          {shown && <line className="rm-graph-cross" x1={x(shown.i)} x2={x(shown.i)} y1={0} y2={H} vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="rm-graph-yaxis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ top: pct(y(t), H) }}>
              {n(t)}
            </span>
          ))}
          {m.target != null && (
            <span className="goal" style={{ top: pct(y(m.target), H), color: m.colour }}>
              Goal
            </span>
          )}
        </div>
        <div className="rm-graph-dots" aria-hidden="true">
          {/* No dots (as Home's Weight): the latest ringed in the colour, the period read ringed in ink. */}
          <i className="last" style={{ left: pct(x(last.i), W), top: pct(y(last.value), H), borderColor: m.colour }} />
          {shown && <i className="on" style={{ left: pct(x(shown.i), W), top: pct(y(shown.value), H) }} />}
        </div>
        {shown && (
          <span className={`rm-graph-pill${y(shown.value) < H * 0.3 ? " below" : ""}`} style={{ left: pct(x(shown.i), W), top: pct(y(shown.value), H) }}>
            <SepJoin parts={[`${n(shown.value)}${tail}`, shown.label]} />
          </span>
        )}
      </div>
      <div className="rm-graph-axis" aria-hidden="true">
        {dateAt.map((i, k) => (
          <span key={i} className={k === 0 ? "first" : k === dateAt.length - 1 ? "last" : ""} style={{ left: pct(x(i), W) }}>
            {points[i].label}
          </span>
        ))}
      </div>
    </section>
  );
}

