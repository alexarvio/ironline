"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { addClientPhaseAction, applyMetricChangesAction, deployPhaseNowAction, saveAndSchedulePhaseAction, sendChatMessageAction, setCheckInDayAction, unschedulePhaseAction, updateClientPhaseAction } from "../../../lib/actions";
import type { MessageLink } from "../../../lib/messageLinks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { CalendarIcon, ChatIcon, ChevronDownIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import type { LoggedMetric, LoggedValues } from "../../../lib/queries";
import { ConfirmDialog, MessageDialog, fmtDate, stateLabel, useClickAway } from "../training/TrainingDraft";
import PhaseDatesDialog from "../PhaseDatesDialog";
import PhaseGoalsCard from "../PhaseGoalsCard";
import { SortableItem, SortableList } from "../Sortable";
import Picker from "../Picker";
import DatePick from "../DatePick";

// The calmer Measurements tab, as a draft on real data, in the Training
// draft's sheet. Two things: what the client is asked to log, and what they
// logged.
//
// - Tracked metrics: one row a metric, its group, Daily / Weekly, and the
//   last figure. Adding, removing and switching cadence queue on the card's
//   bar until Apply. "+ Add metric" opens the library in place.
// - Check-ins: the same lookups three ways. A table (one column a metric, a
//   Change line at the foot), a graph (one metric at a time, 7 or 30 days),
//   and a feed (one row a period, a gap says Missed).
// - Notes from the client, newest first, each with a reply.
// Nothing here saves: every action ends in a toast.

type State = "live" | "past" | "scheduled" | "draft";
type Cadence = "daily" | "weekly";
export type DraftMetric = { id: number; name: string; unit: string; frequency: Cadence; groupKey: string; groupLabel: string; tint: string; last: { value: number; when: string } | null };
export type DraftMeasurements = {
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
  checkInDay: string | null;
  groups: { key: string; label: string; tint: string }[];
  metrics: DraftMetric[];
  library: { id: string; label: string; group: string; items: { name: string; unit: string; already: boolean }[] }[];
  daily: LoggedValues;
  weekly: LoggedValues;
  dailyLong: LoggedValues;
  weeklyLong: LoggedValues;
  notStarted: string | null;
  notes: { id: number; period: string; kind: "daily" | "weekly" | "measurements"; text: string }[];
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
const n = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 1 }));
// A word unit takes a space ("8 h"); a scale butts up ("4/5"); steps are self-evident.
const tailOf = (unit: string) => {
  const u = unit.trim();
  if (!u || u.toLowerCase() === "steps") return "";
  return u.startsWith("/") ? u : ` ${u}`;
};
const withUnit = (v: number, unit: string) => `${n(v)}${tailOf(unit)}`;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const KIND_LABEL = { daily: "Daily check-in", weekly: "Weekly check-in", measurements: "Measurements" } as const;

type Dlg = { kind: "message"; label: string; link: MessageLink } | { kind: "dates" } | { kind: "newPhase" } | { kind: "deploy" } | { kind: "backToDraft" } | null;

export default function MeasurementsDraft({ clientId, firstName, plan }: { clientId: number; firstName: string; plan: DraftMeasurements }) {
  // ---- Tracked metrics: a working list against the saved one.
  const [saved, setSaved] = useState(plan.metrics);
  const [rows, setRows] = useState(plan.metrics);
  const [adding, setAdding] = useState(false);
  const [checkInDay, setCheckInDay] = useState(plan.checkInDay ?? "Monday");
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
  const planKey = JSON.stringify([plan.id, plan.metrics, plan.checkInDay]);
  const [seenPlan, setSeenPlan] = useState(planKey);
  if (seenPlan !== planKey) {
    setSeenPlan(planKey);
    setSaved(plan.metrics);
    setRows(plan.metrics);
    setCheckInDay(plan.checkInDay ?? "Monday");
  }
  const phaseId = plan.id > 0 ? plan.id : null;
  const inLibrary = (name: string) => plan.library.some((p) => p.items.some((i) => i.name.toLowerCase() === name.toLowerCase()));
  // The saved metrics' order on screen differs from how they were saved: a drag.
  const kept = rows.filter((r) => saved.some((m) => m.id === r.id)).map((r) => r.id);
  const reordered = kept.some((id, i) => id !== saved.filter((m) => kept.includes(m.id))[i]?.id);
  const changes = (() => {
    const before = new Map(saved.map((m) => [m.id, m]));
    let c = saved.filter((m) => !rows.some((r) => r.id === m.id)).length;
    for (const r of rows) {
      const b = before.get(r.id);
      if (!b) c += 1;
      else if (b.frequency !== r.frequency) c += 1;
    }
    if (reordered) c += 1;
    return c;
  })();
  const isNew = (id: number) => !saved.some((m) => m.id === id);
  const addMetric = (name: string, unit: string, groupKey: string) => {
    if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) return;
    const g = plan.groups.find((x) => x.key === groupKey) ?? plan.groups.find((x) => x.key === "other") ?? { key: groupKey, label: "Other", tint: "#dfe6ef" };
    setRows((prev) => [...prev, { id: -(Date.now() + prev.length), name, unit, frequency: "daily", groupKey: g.key, groupLabel: g.label, tint: g.tint, last: null }]);
  };
  const dailyCount = rows.filter((r) => r.frequency === "daily").length;

  // ---- Check-ins: which way, and which rhythm.
  const [show, setShow] = useState<"table" | "graph" | "feed">("table");
  const [cadence, setCadence] = useState<Cadence>("daily");
  const view = cadence === "daily" ? plan.daily : plan.weekly;
  const long = cadence === "daily" ? plan.dailyLong : plan.weeklyLong;
  const done = (v: LoggedValues) => (v.metrics.length === 0 ? 0 : v.periods.filter((p) => v.metrics.some((m) => v.values[`${m.id}:${p.key}`] != null)).length);
  const asked = (v: LoggedValues) => (v.metrics.length === 0 ? 0 : v.periods.length);
  const stats = [
    { label: "Daily check-ins", value: asked(plan.daily) ? `${done(plan.daily)} of ${asked(plan.daily)}` : "–", unit: "in the last 8 days", warn: asked(plan.daily) > 0 && done(plan.daily) < asked(plan.daily) * 0.6 },
    { label: "Weekly check-ins", value: asked(plan.weekly) ? `${done(plan.weekly)} of ${asked(plan.weekly)}` : "–", unit: "in the last 5 weeks", warn: asked(plan.weekly) > 0 && done(plan.weekly) < asked(plan.weekly) * 0.6 },
    { label: "Metrics tracked", value: String(rows.length), unit: `${dailyCount} daily · ${rows.length - dailyCount} weekly` },
    { label: "Notes", value: String(plan.notes.length), unit: plan.notes.length === 1 ? "from the client" : "from the client, newest first" },
  ];

  const [dlg, setDlg] = useState<Dlg>(null);
  const close = () => setDlg(null);
  const today = new Date().toISOString().slice(0, 10);
  const startHasCome = !!plan.startDate && plan.startDate <= today;
  const mGrid = { gridTemplateColumns: "20px minmax(200px, 1.4fr) 150px 150px minmax(160px, 1fr) 32px", columnGap: 24 } as const;
  // No grip column here: the date starts where the title does.
  const nGrid = { gridTemplateColumns: "130px 150px minmax(240px, 1fr) 32px", columnGap: 24 } as const;

  return (
    <div className="rd">
      {/* ---- Header: the phase, where it is, its actions. */}
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Measurements</span>
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
                      <Link href={`/admin/redesign/measurements?client=${clientId}&phase=${p.id}`} className={p.id === plan.id ? "on" : ""}>
                        <span className="rd-switch-name">{p.name}</span>
                        <span className={`rd-status ${p.state}`}>{stateLabel(p.state)}</span>
                        <small>{p.weeks} wk</small>
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
              <DropdownMenuItem onSelect={() => setDlg({ kind: "message", label: "Check-ins", link: { kind: "checkin", section: cadence } })}>
                <ChatIcon /> Message about check-ins
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

      {/* ---- Tracked metrics: what the client is asked for. */}
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>Tracked metrics</h2>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="rd-btn rm-checkinday" aria-label="Which day the weekly check-in opens">
              <CalendarIcon /> Weekly check-in opens <b>{checkInDay}</b>
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              {DAYS.map((d) => (
                <DropdownMenuItem
                  key={d}
                  onSelect={() => {
                    setCheckInDay(d);
                    const f = new FormData();
                    f.set("clientId", String(clientId));
                    f.set("check_in_day", d);
                    act(() => setCheckInDayAction(f), `Weekly check-in opens on ${d}`);
                  }}
                >
                  {d}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="rd-rows">
          {rows.length > 0 && (
            <div className="rd-cols" aria-hidden="true" style={mGrid}>
              <span />
              <span>Metric</span>
              <span>Group</span>
              <span>Logged</span>
              <span>Last</span>
              <span />
            </div>
          )}
          <SortableList ids={rows.map((m) => m.id)} label="metric" onMove={(ids) => setRows((prev) => ids.map((id) => prev.find((r) => r.id === id)!).filter(Boolean))}>
          {rows.map((m) => {
            const was = saved.find((s) => s.id === m.id);
            return (
              <SortableItem key={m.id} id={m.id} className={`rd-row${isNew(m.id) ? " new" : ""}`}>
                {(metricGrip) => (
                <div className="rd-row-main static" style={mGrid}>
                  <span className="rd-grip" {...metricGrip}>
                    ⋮⋮
                  </span>
                  <span className="rd-ex">
                    <span className="rd-ex-name">
                      {m.name}
                      {m.unit && <small style={{ marginLeft: 6 }}>{m.unit}</small>}
                    </span>
                    {isNew(m.id) && <small>New · not applied yet</small>}
                  </span>
                  <span>
                    <span className="rm-group" style={{ background: m.tint }}>
                      {m.groupLabel}
                    </span>
                  </span>
                  <span className="rm-cadence" role="group" aria-label={`How often ${m.name} is logged`}>
                    {(["daily", "weekly"] as const).map((o) => (
                      <button key={o} type="button" className={`${m.frequency === o ? "on" : ""}${m.frequency === o && was && was.frequency !== o ? " changed" : ""}`} aria-pressed={m.frequency === o} onClick={() => setRows((prev) => prev.map((r) => (r.id === m.id ? { ...r, frequency: o } : r)))}>
                        {o === "daily" ? "Daily" : "Weekly"}
                      </button>
                    ))}
                  </span>
                  {m.last ? (
                    <span className="rm-last">
                      {withUnit(m.last.value, m.unit)}
                      <small>{m.last.when}</small>
                    </span>
                  ) : (
                    <span className="rm-last none">Nothing logged yet</span>
                  )}
                  <span className="rd-row-more">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${m.name}`}>
                        <MoreIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="pb-menu">
                        <DropdownMenuItem onSelect={() => setDlg({ kind: "message", label: m.name, link: { kind: "checkin", section: m.frequency } })}>
                          <ChatIcon /> Message about {m.name}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setRows((prev) => prev.filter((r) => r.id !== m.id))}>
                          <TrashIcon /> {isNew(m.id) ? "Don't add it" : "Stop asking for it"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
                )}
              </SortableItem>
            );
          })}
          </SortableList>
          {adding ? (
            <AddMetricRow library={plan.library} groups={plan.groups} have={rows.map((r) => r.name.toLowerCase())} onAdd={addMetric} onClose={() => setAdding(false)} />
          ) : (
            <button type="button" className="rd-session add rm-additem" onClick={() => setAdding(true)}>
              + Add metric
            </button>
          )}
          {changes > 0 && (
            <div className="rd-pending">
              <span className="rd-pending-count">{changes}</span>
              <span className="rd-pending-text">
                {changes === 1 ? "change" : "changes"} to what {firstName} is asked for · their check-in asks for this once applied
              </span>
              <button type="button" className="rd-pending-ghost" onClick={() => setRows(saved)}>
                Discard
              </button>
              <button
                type="button"
                className="rd-pending-apply"
                onClick={() => {
                  const before = new Map(saved.map((m) => [m.id, m]));
                  const input = {
                    clientId,
                    phaseId,
                    adds: rows.filter((r) => isNew(r.id)).map((r) => ({ name: r.name, unit: r.unit, group: r.groupKey, cadence: r.frequency, source: (inLibrary(r.name) ? "library" : "custom") as "library" | "custom" })),
                    removes: saved.filter((m) => !rows.some((r) => r.id === m.id)).map((m) => m.id),
                    cadence: rows.filter((r) => !isNew(r.id) && before.get(r.id)?.frequency !== r.frequency).map((r) => ({ id: r.id, value: r.frequency })),
                    order: reordered ? kept : null,
                  };
                  setSaved(rows);
                  act(() => applyMetricChangesAction(input), `Tracked metrics: ${rows.length} ${rows.length === 1 ? "metric" : "metrics"}`);
                }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ---- Check-ins: what the client logged, three ways. */}
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>{firstName}&rsquo;s check-ins</h2>
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
        <div className="rm-controls">
          <div className="rm-controls-left">
            <div className="rd-btn-group" role="group" aria-label="Show as">
              {(["table", "graph", "feed"] as const).map((s) => (
                <button key={s} type="button" className={show === s ? "on" : ""} aria-pressed={show === s} onClick={() => setShow(s)}>
                  {s === "table" ? "Table" : s === "graph" ? "Graph" : "Feed"}
                </button>
              ))}
            </div>
          </div>
          <div className="rm-controls-right">
            <div className="rd-btn-group" role="group" aria-label="Rhythm">
              {(["daily", "weekly"] as const).map((c) => (
                <button key={c} type="button" className={cadence === c ? "on" : ""} aria-pressed={cadence === c} onClick={() => setCadence(c)}>
                  {c === "daily" ? "Daily" : "Weekly"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {plan.notStarted ? (
          <p className="rd-full">{plan.notStarted}</p>
        ) : view.metrics.length === 0 ? (
          <p className="rd-full">No {cadence} metrics in this phase. Add one above.</p>
        ) : show === "table" ? (
          <CheckinTable view={view} />
        ) : show === "graph" ? (
          <Graphs key={cadence} view={long.periods.length ? long : view} cadence={cadence} shortCount={cadence === "daily" ? 7 : 5} />
        ) : (
          <CheckinFeed view={view} cadence={cadence} onMessage={(label) => setDlg({ kind: "message", label, link: { kind: "checkin", section: cadence } })} />
        )}
      </section>

      {/* ---- Notes from the client, newest first. */}
      {plan.notes.length > 0 && (
        <section className="rd-session open rn-card">
          <div className="rn-card-head">
            <h2>Notes from {firstName}</h2>
          </div>
          <div className="rd-rows">
            <div className="rd-cols" aria-hidden="true" style={nGrid}>
              <span>Date</span>
              <span>Check-in</span>
              <span>Note</span>
              <span />
            </div>
            {plan.notes.map((note) => (
              <div key={note.id} className="rd-row">
                <div className="rd-row-main static" style={nGrid}>
                  <span className="rd-ex">
                    <span className="rd-ex-name">{fmtDay(note.period)}</span>
                  </span>
                  <span>
                    <span className={`rd-pill${note.kind === "daily" ? " quiet" : ""}`}>{KIND_LABEL[note.kind]}</span>
                  </span>
                  <span className="rm-note-text">{note.text}</span>
                  <span className="rd-row-more">
                    <button type="button" className="rd-btn ghost sm" title="Reply" aria-label={`Reply to ${firstName}'s note of ${fmtDay(note.period)}`} onClick={() => setDlg({ kind: "message", label: `${KIND_LABEL[note.kind]} · ${fmtDay(note.period)}`, link: { kind: "checkin", section: note.kind === "weekly" ? "weekly" : "daily" } })}>
                      <ChatIcon />
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
        {dlg?.kind === "dates" && (
          <PhaseDatesDialog
            byDay
            title="Dates"
            name={plan.name}
            start={plan.startDate}
            end={plan.endDate}
            firstName={firstName}
            what="these metrics"
            confirm="Save dates"
            onConfirm={(v) => {
              close();
              if (phaseId) act(() => updateClientPhaseAction(phaseForm({ id: phaseId, track: "lifestyle", name: v.name || plan.name, start: v.start, end: v.end, exact: true })), `${v.name || plan.name}: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
            }}
          />
        )}
        {dlg?.kind === "newPhase" && (
          <NewPhaseDialog
            onCreate={(v) => {
              close();
              const start = v.start || today;
              act(() => addClientPhaseAction(phaseForm({ clientId, track: "lifestyle", name: v.name || "New phase", start, end: plusWeeks(start, v.weeks) })), `${v.name || "New phase"} drafted: ${v.weeks} weeks from ${fmtDate(start)}`);
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
            what="these metrics"
            confirm="Schedule it"
            onConfirm={(v) => {
              close();
              if (phaseId) act(() => saveAndSchedulePhaseAction(phaseForm({ id: phaseId, track: "lifestyle", name: plan.name, start: v.start, end: v.end, exact: true })), `${plan.name} scheduled: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
            }}
          />
        )}
        {dlg?.kind === "deploy" && startHasCome && (
          <ConfirmDialog
            title={`Make ${plan.name} live?`}
            description={`${firstName}'s check-in asks for these metrics from now.`}
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

/** The library behind the search bar, as on a session: type to match, or the
 *  chevron for the groups, a group for its metrics; and your own metric, put
 *  in whichever group fits. */
function AddMetricRow({ library, groups, have, onAdd, onClose }: { library: DraftMeasurements["library"]; groups: DraftMeasurements["groups"]; have: string[]; onAdd: (name: string, unit: string, group: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  // The bar alone first; the chevron opens the groups. "Create your own metric" stays in reach underneath.
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
  // What the list shows: matches while typing; else the picked group's
  // metrics; else, with the chevron open, the groups.
  const matches: Item[] = needle ? library.flatMap((p) => p.items.filter((i) => i.name.toLowerCase().includes(needle)).map((i) => itemOf(p, i))).slice(0, 8) : [];
  const inPack: Item[] = !needle && pack ? (library.find((p) => p.id === pack)?.items ?? []).map((i) => itemOf(library.find((p) => p.id === pack)!, i)) : [];
  const list = needle ? matches : inPack;
  const showPacks = !needle && browse && !pack;
  const exact = needle && !matches.some((m) => m.name.toLowerCase() === needle);
  const pick = (m: Item) => {
    if (m.taken) return;
    onAdd(m.name, m.unit, m.group);
    setQ("");
    setCursor(0);
    setPack(null);
    setBrowse(false);
    box.current?.focus();
  };
  return (
    <div ref={wrap} className="rd-addrow">
      <div className={`rd-addrow-bar${browse || needle ? " open" : ""}`}>
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
              if (list[cursor]) pick(list[cursor]);
              else if (exact) setCreating(true);
            }
          }}
          placeholder={pack ? `${library.find((p) => p.id === pack)?.label ?? ""} · type to narrow` : "Search metrics"}
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
      {!creating && !browse && !needle && !pack && (
        <div className="rd-addrow-list">
          <button type="button" className="rd-addrow-item create" onClick={() => setCreating(true)}>
            <PlusIcon /> Create your own metric
          </button>
        </div>
      )}
      {!creating && showPacks && (
        <div className="rd-addrow-list" role="listbox" aria-label="Groups">
          {library.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={false} className="rd-addrow-item" onClick={() => setPack(p.id)}>
              {p.label}
              <small>{p.items.length}</small>
            </button>
          ))}
          <button type="button" className="rd-addrow-item create" onClick={() => setCreating(true)}>
            <PlusIcon /> Create your own metric
          </button>
        </div>
      )}
      {!creating && pack && !needle && (
        <div className="rd-addrow-list" role="listbox" aria-label={library.find((p) => p.id === pack)?.label}>
          <button type="button" className="rd-addrow-back" onClick={() => setPack(null)}>
            ‹ All groups
          </button>
          {list.map((m, i) => (
            <button key={m.name} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}${m.taken ? " taken" : ""}`} disabled={m.taken} onMouseEnter={() => setCursor(i)} onClick={() => pick(m)}>
              {m.name}
              <small>{m.taken ? "on the list" : m.unit}</small>
            </button>
          ))}
        </div>
      )}
      {!creating && needle && (
        <div className="rd-addrow-list" role="listbox">
          {list.map((m, i) => (
            <button key={`${m.pack}-${m.name}`} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}${m.taken ? " taken" : ""}`} disabled={m.taken} onMouseEnter={() => setCursor(i)} onClick={() => pick(m)}>
              {m.name}
              <small>{m.taken ? "on the list" : `${m.pack}${m.unit ? ` · ${m.unit}` : ""}`}</small>
            </button>
          ))}
          {exact && (
            <button type="button" className={`rd-addrow-item create${list.length === 0 ? " on" : ""}`} onClick={() => setCreating(true)}>
              <PlusIcon /> Create &ldquo;{q.trim()}&rdquo; as your own metric
            </button>
          )}
        </div>
      )}
      <p className="rd-addrow-hint">Everything is added daily; switch it to weekly on its row. Nothing reaches the check-in until Apply.</p>
    </div>
  );
}

/** A metric of your own: its name, unit and the group it sits under. */
function CreateMetric({ groups, initial, taken, onCreate, onCancel }: { groups: DraftMeasurements["groups"]; initial: string; taken: (name: string) => boolean; onCreate: (name: string, unit: string, group: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial);
  const [unit, setUnit] = useState("");
  const [group, setGroup] = useState(groups.find((g) => g.key === "other")?.key ?? groups[0]?.key ?? "other");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  const ok = name.trim().length > 0 && !taken(name.trim());
  return (
    <div className="rd-create" onKeyDown={(e) => (e.key === "Escape" ? onCancel() : e.key === "Enter" && ok ? onCreate(name.trim(), unit.trim(), group) : null)}>
      <span className="rd-eyebrow">Create your own metric</span>
      <div className="rd-create-row">
        <input ref={first} className="rd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Metric name" maxLength={60} />
        <input className="rd-input rm-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit · kg, h, /10" maxLength={12} aria-label="Unit" />
        <Picker value={group} onChange={setGroup} label="Group" options={groups.map((g) => ({ value: g.key, label: g.label }))} />
        <button type="button" className="rd-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="rd-btn primary" disabled={!ok} onClick={() => onCreate(name.trim(), unit.trim(), group)}>
          Add to the list
        </button>
      </div>
      <p className="rd-addrow-hint">{taken(name.trim()) ? `${name.trim()} is already on the list.` : `Sits under ${groups.find((g) => g.key === group)?.label ?? "Other"} on ${"the client's"} check-in.`}</p>
    </div>
  );
}

// One grid for the whole table: the head, every row and the Change line are
// cells of the same container, so a column cannot drift off its heading.
function CheckinTable({ view }: { view: LoggedValues }) {
  const valueFor = (m: number, p: string) => view.values[`${m}:${p}`] ?? null;
  const change = (m: LoggedMetric) => {
    const seen = view.periods.map((p) => valueFor(m.id, p.key)).filter((v): v is number => v != null);
    if (seen.length < 2) return null;
    const [newest, oldest] = [seen[0], seen[seen.length - 1]];
    const delta = Math.round((newest - oldest) * 10) / 10;
    const pct = oldest === 0 ? null : Math.round((delta / Math.abs(oldest)) * 100);
    const tone = m.goodDirection === "none" || delta === 0 ? "" : (m.goodDirection === "down") === delta < 0 ? " up" : " down";
    return { text: `${delta > 0 ? "+" : ""}${n(delta)}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}`, tone };
  };
  return (
    <div className="rm-scroll">
      <div className="rm-table" style={{ gridTemplateColumns: `150px repeat(${view.metrics.length}, minmax(96px, 1fr))` }}>
        <span className="rm-th" style={{ paddingLeft: 10 }}>
          Date
        </span>
        {view.metrics.map((m) => (
          <span key={m.id} className="rm-th">
            {m.name}
            <em style={{ color: m.colour }}>
              {m.categoryLabel}
              {m.unit ? ` · ${m.unit}` : ""}
            </em>
          </span>
        ))}
        {view.periods.map((p, i) => (
          <div key={p.key} className="contents">
            <span className={`rm-td date${i === 0 ? " now" : ""}`}>{p.label}</span>
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
        <span className="rm-td date change">Change</span>
        {view.metrics.map((m) => {
          const c = change(m);
          return (
            <span key={m.id} className={`rm-td change${c ? c.tone : " none"}`}>
              {c ? c.text : "—"}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// One row a period the client was asked for, whether or not anything came:
// a gap is data, and it says Missed rather than being left out.
function CheckinFeed({ view, cadence, onMessage }: { view: LoggedValues; cadence: Cadence; onMessage: (label: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const valueFor = (m: number, p: string) => view.values[`${m}:${p}`] ?? null;
  const grid = { gridTemplateColumns: "20px 150px 100px minmax(240px, 1fr) 120px 32px", columnGap: 24 } as const;
  return (
    <div className="rd-rows">
      <div className="rd-cols" aria-hidden="true" style={grid}>
        <span />
        <span>Date</span>
        <span>Check-in</span>
        <span>Logged</span>
        <span>State</span>
        <span />
      </div>
      {view.periods.map((p) => {
        const filled = view.metrics.map((m) => ({ m, v: valueFor(m.id, p.key) })).filter((x): x is { m: LoggedMetric; v: number } => x.v != null);
        const missing = view.metrics.length - filled.length;
        const isOpen = open === p.key;
        const state = filled.length === 0 ? { text: "Missed", cls: "down" } : missing === 0 ? { text: "Complete", cls: "up" } : { text: `${missing} missing`, cls: "" };
        const note = view.notes[p.key];
        const label = `${cadence === "daily" ? "Daily" : "Weekly"} check-in · ${p.label}`;
        return (
          <div key={p.key} className={`rd-row rn-day${isOpen ? " open" : ""}`}>
            <div className="rd-row-main" style={grid} onClick={() => setOpen((x) => (x === p.key ? null : p.key))} role="button" tabIndex={0} aria-expanded={isOpen} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen((x) => (x === p.key ? null : p.key)))}>
              <span className={`rd-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                <ChevronDownIcon />
              </span>
              <span className="rd-ex">
                <span className="rd-ex-name">{p.label}</span>
              </span>
              <span>
                <span className={`rd-pill${cadence === "daily" ? " quiet" : ""}`}>{cadence === "daily" ? "Daily" : "Weekly"}</span>
              </span>
              <span className="rm-summary">
                {filled
                  .slice(0, 4)
                  .map((x) => `${x.m.name} ${withUnit(x.v, x.m.unit)}`)
                  .join(" · ") || "Nothing submitted"}
                {filled.length > 4 ? ` · +${filled.length - 4}` : ""}
              </span>
              <span>
                <span className={`rd-set rn-vs ${state.cls}`}>{state.text}</span>
              </span>
              <span className="rd-row-more" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${p.label}`}>
                    <MoreIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="pb-menu">
                    <DropdownMenuItem onSelect={() => onMessage(label)}>
                      <ChatIcon /> Message about this check-in
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </div>
            {isOpen && (
              <div className="rm-tiles">
                {filled.map((x) => (
                  <div key={x.m.id} className="rm-tile">
                    <small>{x.m.name}</small>
                    <b>
                      {n(x.v)}
                      {tailOf(x.m.unit) && <em>{tailOf(x.m.unit).trim()}</em>}
                    </b>
                  </div>
                ))}
                {note && (
                  <div className="rm-tile note">
                    <small>Note</small>
                    <p>{note}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// One chart, one metric at a time, picked from the list beside it. One at a
// time because weight in kilos and steps in thousands cannot share an axis.
// Oldest on the left; a skipped period is a gap in the line.
function Graphs({ view, cadence, shortCount }: { view: LoggedValues; cadence: Cadence; shortCount: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [range, setRange] = useState<"short" | "long">("short");
  const valueFor = (m: number, p: string) => view.values[`${m}:${p}`] ?? null;
  const metric = view.metrics.find((m) => m.id === picked) ?? view.metrics[0];
  const hasLong = view.periods.length > shortCount;
  const periods = [...(range === "short" ? view.periods.slice(0, shortCount) : view.periods)].reverse();
  const latest = (m: LoggedMetric) => {
    for (const p of view.periods) {
      const v = valueFor(m.id, p.key);
      if (v != null) return v;
    }
    return null;
  };
  const cats: { label: string; colour: string; metrics: LoggedMetric[] }[] = [];
  for (const m of view.metrics) {
    let c = cats.find((x) => x.label === m.categoryLabel);
    if (!c) cats.push((c = { label: m.categoryLabel, colour: m.colour, metrics: [] }));
    c.metrics.push(m);
  }
  return (
    <div className="rm-graphs">
      <nav className="rm-graph-list" aria-label="Metric on the graph">
        {cats.map((c) => (
          <div key={c.label}>
            <div className="rm-graph-cat">
              <i style={{ background: c.colour }} aria-hidden="true" />
              {c.label}
            </div>
            {c.metrics.map((m) => {
              const v = latest(m);
              return (
                <button key={m.id} type="button" className={`rm-graph-pick${m.id === metric.id ? " on" : ""}`} aria-pressed={m.id === metric.id} onClick={() => setPicked(m.id)}>
                  <span>{m.name}</span>
                  <em>{v == null ? "—" : withUnit(v, m.unit)}</em>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <MetricGraph
        key={metric.id}
        metric={metric}
        points={periods.map((p) => ({ label: p.label, value: valueFor(metric.id, p.key) }))}
        rangeSwitch={
          hasLong ? (
            <div className="rd-btn-group" role="group" aria-label="Range">
              {(["short", "long"] as const).map((r) => (
                <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => setRange(r)} aria-pressed={range === r}>
                  {r === "short" ? shortCount : view.periods.length} {cadence === "daily" ? "days" : "weeks"}
                </button>
              ))}
            </div>
          ) : null
        }
      />
    </div>
  );
}

const W = 900;
const H = 240;
const PAD = { l: 8, r: 8, t: 14, b: 10 };

// 1 / 2 / 5 steps, so the axis reads 86 / 87 / 88 rather than 86.3 / 87.1.
function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi <= lo) return [lo];
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  const step = (r > 5 ? 10 : r > 2 ? 5 : r > 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1000; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

function MetricGraph({ metric: m, points, rangeSwitch = null }: { metric: LoggedMetric; points: { label: string; value: number | null }[]; rangeSwitch?: React.ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const seen = points.map((p, i) => ({ ...p, i })).filter((p): p is { label: string; value: number; i: number } => p.value != null);
  const unit = m.unit.trim();
  const tail = tailOf(unit);
  const head = (
    <header className="rm-graph-head">
      <i style={{ background: m.colour }} aria-hidden="true" />
      <b>{m.name}</b>
      <span>{m.categoryLabel}</span>
      {rangeSwitch}
    </header>
  );
  if (seen.length === 0) {
    return (
      <section className="rm-graph">
        {head}
        <p className="rm-graph-empty">Nothing logged for {m.name} in this range.</p>
      </section>
    );
  }
  const first = seen[0];
  const last = seen[seen.length - 1];
  const delta = Math.round((last.value - first.value) * 10) / 10;
  const tone = seen.length < 2 || m.goodDirection === "none" || delta === 0 ? "" : (m.goodDirection === "down") === delta < 0 ? " good" : " warn";
  const avg = Math.round((seen.reduce((t, p) => t + p.value, 0) / seen.length) * 10) / 10;
  // A rating out of N sits on its own full scale; everything else gets some
  // of its range as breathing room.
  const scale = /^\/\s*(\d+)$/.exec(unit);
  const lo0 = Math.min(...seen.map((p) => p.value));
  const hi0 = Math.max(...seen.map((p) => p.value));
  const pad = hi0 - lo0 > 0 ? (hi0 - lo0) * 0.15 : Math.max(Math.abs(hi0) * 0.02, 0.5);
  const [lo, hi] = scale ? [0, Number(scale[1])] : [lo0 - pad, hi0 + pad];
  const x = (i: number) => PAD.l + (points.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (points.length - 1));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const ticks = niceTicks(lo, hi);
  const dateCount = points.length <= 10 ? points.length : 6;
  const dateAt = [...new Set(Array.from({ length: dateCount }, (_, k) => (dateCount === 1 ? 0 : Math.round((k * (points.length - 1)) / (dateCount - 1)))))];
  // Runs of consecutive logged periods: each is one stroke, so a gap stays a gap.
  const runs: { i: number; value: number }[][] = [];
  for (const p of seen) {
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1].i === p.i - 1) run.push(p);
    else runs.push([p]);
  }
  const shown = hover != null ? seen.find((p) => p.i === hover) ?? null : null;
  const allDots = seen.length <= 31;
  return (
    <section className="rm-graph">
      {head}
      <div className="rm-graph-figure">
        <span className="rm-graph-now">
          {n((shown ?? last).value)}
          {tail && <small>{tail.trim()}</small>}
        </span>
        <span className="rm-graph-when">{shown ? shown.label : `Latest · ${last.label}`}</span>
        <span className="rm-graph-stats">
          <span className={`rm-graph-delta${tone}`}>{seen.length < 2 ? "One reading" : `${delta > 0 ? "+" : ""}${n(delta)}${tail} since ${first.label}`}</span>
          <span>
            Average {n(avg)}
            {tail} · {seen.length} of {points.length} logged
          </span>
        </span>
      </div>
      <div className="rm-graph-frame">
        <div className="rm-graph-yaxis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ top: `${(y(t) / H) * 100}%` }}>
              {n(t)}
            </span>
          ))}
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
            {runs.map((run, r) => (run.length === 1 ? null : <polyline key={r} className="rm-graph-line" points={run.map((p) => `${x(p.i)},${y(p.value)}`).join(" ")} vectorEffect="non-scaling-stroke" />))}
            {shown && <line className="rm-graph-cross" x1={x(shown.i)} x2={x(shown.i)} y1={0} y2={H} vectorEffect="non-scaling-stroke" />}
          </svg>
          <div className="rm-graph-dots" aria-hidden="true">
            {seen
              .filter((p) => allDots || p.i === last.i || p.i === hover || runs.some((run) => run.length === 1 && run[0].i === p.i))
              .map((p) => (
                <i key={p.i} className={p.i === hover ? "on" : p.i === last.i ? "last" : ""} style={{ left: `${(x(p.i) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` }} />
              ))}
          </div>
        </div>
      </div>
      <div className="rm-graph-axis" aria-hidden="true">
        {dateAt.map((i) => (
          <span key={i} style={{ left: `${(x(i) / W) * 100}%` }}>
            {points[i].label}
          </span>
        ))}
      </div>
    </section>
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
        <DialogTitle>New lifestyle phase</DialogTitle>
        <DialogDescription>A draft: only you see it until it is scheduled. It lands on the Plan tab&rsquo;s lifestyle lane.</DialogDescription>
      </DialogHeader>
      <label className="rd-field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sleep focus" maxLength={60} autoFocus />
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
