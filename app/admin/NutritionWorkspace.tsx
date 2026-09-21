"use client";

import { ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  applySupplementChangesAction,
  deployPhaseNowAction,
  schedulePhaseOnItsDatesAction,
  draftNutritionPhaseAction,
  saveCoachNutritionNoteAction,
  saveNutritionTargetsAction,
} from "../lib/actions";
import type { ClientPhase } from "../lib/db";
import type { LoggedDaysView } from "../lib/queries";
import NutritionLoggedDays from "./NutritionLoggedDays";
import { PhaseDialog } from "./PhaseDialogButton";
import DragList from "../components/DragList";
import DeployNowDialog from "./DeployNowDialog";
import { phaseRange, phaseWeekIndex, phaseWeeks } from "../lib/phases";
import PhaseHeader, { usePhases, type PhaseOption } from "./PhaseHeader";
import { ChevronDownIcon, TrashIcon } from "../components/icons";

// The Nutrition tab: three navy-banded cards. Daily targets per nutrition
// phase with the note beside them, the supplements sheet, and the calories
// the client logged against those targets. All data arrives from the server
// panel; the writes are the existing actions.

type Macros = { protein: number | null; carbs: number | null; fats: number | null };
export type NwPhase = {
  id: number;
  name: string;
  status: "past" | "now" | "next" | "draft";
  training: Macros;
  rest: Macros;
  note: string;
  phase: ClientPhase;
};
export type NwSupplement = { id: number; name: string; quantity: string; timing: string; notes: string };


export type NutritionWorkspaceProps = {
  clientId: number;
  today: string;
  /** No phases: one client-level editor with id 0. */
  phases: NwPhase[];
  /** `?phase=` as the server read it, so a linked phase opens straight away. */
  initialPhaseId: number | null;
  waterL: number | null;
  latestWeightKg: number | null;
  supplements: NwSupplement[];
  /** The days the client logged calories, newest first. */
  /** The days the client logged, per phase on the rail. */
  loggedByPhase: Record<number, LoggedDaysView>;
  liveSince: string | null;
};

const KCAL = { protein: 4, carbs: 4, fats: 9 } as const;
// One palette for the macros across the app — the tokens in globals.css,
// shared with the logged-days table below and the client's food diary.
const MACRO = [
  { key: "protein", label: "Protein", colour: "var(--macro-protein)" },
  { key: "carbs", label: "Carbs", colour: "var(--macro-carbs)" },
  { key: "fats", label: "Fat", colour: "var(--macro-fat)" },
] as const;
const kcalOf = (m: Macros) => (m.protein ?? 0) * KCAL.protein + (m.carbs ?? 0) * KCAL.carbs + (m.fats ?? 0) * KCAL.fats;
const same = (a: Macros, b: Macros) => a.protein === b.protein && a.carbs === b.carbs && a.fats === b.fats;
const n = (v: number) => v.toLocaleString("en-US");
const PHASE_STATE = { draft: "draft", now: "live", next: "scheduled", past: "past" } as const;

// Week maths for the new-phase defaults; phases run Monday to Monday.
const mondayOf = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addWeeks = (monday: string, weeks: number) => {
  const d = new Date(`${monday}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function NutritionWorkspace(p: NutritionWorkspaceProps) {
  // The switcher only ever lists real phases. With none of them the client
  // still has a plan (the id-0 editor below), and the band says so.
  const real = p.phases.filter((x) => x.id !== 0);
  const options: PhaseOption[] = real.map((x) => ({
    id: x.id,
    name: x.name,
    status: PHASE_STATE[x.status],
    start: x.phase.start_week,
    dates: phaseRange(x.phase.start_week, x.phase.end_week),
    weeks: phaseWeeks(x.phase.start_week, x.phase.end_week),
    week: x.status === "now" ? phaseWeekIndex(x.phase.start_week, x.phase.end_week, p.today) : null,
  }));
  const { current, select } = usePhases(options, { initialId: p.initialPhaseId });
  const phase = p.phases.find((x) => x.id === current?.id) ?? p.phases.find((x) => x.id === 0) ?? p.phases[0];
  const [editPhase, setEditPhase] = useState(false);
  const [newPhase, setNewPhase] = useState(false);

  // A phase that arrives from the server (just added here or on Plan) is
  // selected, so the coach lands straight on its targets.
  const ids = real.map((x) => x.id).join(",");
  const [seenIds, setSeenIds] = useState(ids);
  if (ids !== seenIds) {
    const before = new Set(seenIds.split(",").map(Number));
    const fresh = real.find((x) => !before.has(x.id));
    setSeenIds(ids);
    if (fresh) select(fresh.id);
  }

  // A new phase starts the week after the last one ends, else this week.
  const lastEnd = real.reduce<string | null>((max, x) => (!max || x.phase.end_week > max ? x.phase.end_week : max), null);
  const thisWeek = mondayOf(p.today);
  const newStart = lastEnd && addWeeks(lastEnd, 1) > thisWeek ? addWeeks(lastEnd, 1) : thisWeek;
  const others = real.map((x) => ({ id: x.id, track: x.phase.track, name: x.name, start_week: x.phase.start_week, end_week: x.phase.end_week }));

  return (
    <div className="pl nw">
      {phase && (
        <TargetsCard
          key={phase.id}
          p={p}
          phase={phase}
          options={options}
          onPickPhase={select}
          onEditPhase={() => setEditPhase(true)}
          onNewPhase={() => setNewPhase(true)}
          rest={
            <>
              <SupplementsBlock p={p} />
              <Block id="logged" title="Logged days" hint={loggedHint(p.loggedByPhase[phase.id])}>
                <NutritionLoggedDays view={p.loggedByPhase[phase.id] ?? { days: [], windowDays: 0, avgKcal: null, avgProtein: null, onTarget: 0, judged: 0 }} />
              </Block>
            </>
          }
        />
      )}
      {editPhase && phase && phase.id !== 0 && (
        <PhaseDialog clientId={p.clientId} phase={phase.phase} today={p.today} others={others} onClose={() => setEditPhase(false)} />
      )}
      {newPhase && (
        <PhaseDialog
          clientId={p.clientId}
          today={p.today}
          defaultTrack="nutrition"
          defaultStart={newStart}
          defaultEnd={addWeeks(newStart, 3)}
          others={others}
          onClose={() => setNewPhase(false)}
        />
      )}
    </div>
  );
}

// ---- 1 · Daily targets ---------------------------------------------------

function TargetsCard({
  p,
  phase,
  options,
  onPickPhase,
  onEditPhase,
  onNewPhase,
  rest,
}: {
  p: NutritionWorkspaceProps;
  phase: NwPhase;
  /** The real phases, for the switcher. Empty while the client has none. */
  options: PhaseOption[];
  onPickPhase: (id: number) => void;
  onEditPhase: () => void;
  onNewPhase: () => void;
  /** The phase's other blocks, inside its card. */
  rest?: ReactNode;
}) {
  const [day, setDay] = useState<"training" | "rest">("training");
  const [values, setValues] = useState({ training: phase.training, rest: phase.rest });
  const [linked, setLinked] = useState(() => same(phase.training, phase.rest));
  const [water, setWater] = useState(p.waterL != null ? String(p.waterL) : "");
  const [saving, startSave] = useTransition();
  const [note, setNote] = useState(phase.note);

  const current = values[day];
  const kcal = kcalOf(current);
  const set = (key: keyof Macros, raw: string) => {
    const v = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    setValues((old) => {
      const next = { ...old[day], [key]: Number.isFinite(v as number) ? v : null };
      return linked ? { training: next, rest: next } : { ...old, [day]: next };
    });
  };
  // Everything on this card queues on the bar at the foot, the same way
  // every other table in the admin saves: macros, water and the note land
  // together on Apply, or go together on Discard.
  const savedWater = p.waterL != null ? String(p.waterL) : "";
  const trainingDirty = !same(values.training, phase.training);
  const restDirty = !same(values.rest, phase.rest);
  const waterDirty = water !== savedWater;
  const noteDirty = note.trim() !== phase.note.trim();
  const changes = [
    trainingDirty ? `Training day ${n(kcalOf(values.training))} kcal` : null,
    restDirty ? `Rest day ${n(kcalOf(values.rest))} kcal` : null,
    waterDirty ? (water ? `Water ${water} L` : "Water cleared") : null,
    noteDirty ? "Note changed" : null,
  ].filter((x): x is string => !!x);
  const discard = () => {
    setValues({ training: phase.training, rest: phase.rest });
    setLinked(same(phase.training, phase.rest));
    setWater(savedWater);
    setNote(phase.note);
  };
  const apply = () =>
    startSave(async () => {
      if (trainingDirty || restDirty || waterDirty) {
        const fd = new FormData();
        fd.set("clientId", String(p.clientId));
        if (phase.id !== 0) fd.set("phaseId", String(phase.id));
        for (const d of ["training", "rest"] as const)
          for (const m of ["protein", "carbs", "fats"] as const) fd.set(`${d === "training" ? "t" : "r"}_${m}`, values[d][m] == null ? "" : String(values[d][m]));
        fd.set("water", water);
        await saveNutritionTargetsAction(fd);
      }
      if (noteDirty) {
        const fd = new FormData();
        fd.set("clientId", String(p.clientId));
        if (phase.id !== 0) fd.set("phaseId", String(phase.id));
        fd.set("note", note);
        await saveCoachNutritionNoteAction(fd);
      }
    });
  const hasPhases = phase.id !== 0;
  // Deploying a draft schedules it when it starts in a later week, and puts
  // it live when its start week has come.
  const [publishing, startPublish] = useTransition();
  // Schedule it / Make it live: out on its dates, or live this week, from
  // one confirm.
  const [deploying, setDeploying] = useState(false);
  const startsLater = phase.phase.start_week > mondayOf(p.today);
  const scheduleIt = phase.status === "draft" && startsLater;
  const runningNow = p.phases.find((x) => x.id !== phase.id && x.id !== 0 && x.status === "now") ?? null;
  const nextSet = p.phases.filter((x) => x.id !== phase.id && x.status === "next").sort((a, b) => a.phase.start_week.localeCompare(b.phase.start_week))[0] ?? null;
  const backToDraft = () => startPublish(() => draftNutritionPhaseAction(phase.id));
  const blocked =
    changes.length > 0 ? "Apply or discard the changes first" : kcalOf(values.training) === 0 ? "Set the macros first" : undefined;

  const summary = [
    `${n(kcalOf(values.training))} kcal training`,
    `${n(kcalOf(values.rest))} kcal rest`,
    water ? `${water} L water` : null,
  ].filter(Boolean);

  return (
    <>
      {deploying && (
        <DeployNowDialog
          track="nutrition"
          name={phase.name}
          weeks={phaseWeeks(phase.phase.start_week, phase.phase.end_week)}
          today={p.today}
          running={runningNow ? { name: runningNow.name, start_week: runningNow.phase.start_week } : null}
          next={nextSet ? { name: nextSet.name, start_week: nextSet.phase.start_week } : null}
          startsOn={scheduleIt ? phase.phase.start_week : null}
          blocked={blocked}
          onConfirm={() => (scheduleIt ? schedulePhaseOnItsDatesAction(phase.id) : deployPhaseNowAction(phase.id))}
          onClose={() => setDeploying(false)}
        />
      )}

      {/* The phase, whole: which one it is, its targets, its supplements and
          what the client actually ate, in one card under one name. */}
      <section className="pl-card ph-card nw-phase-card">
      <PhaseHeader
        kind="nutrition"
        phases={options}
        currentId={hasPhases ? phase.id : null}
        onSelect={onPickPhase}
        onNew={onNewPhase}
        secondary={
          phase.status === "next" ? (
            <button type="button" className="ph-minor" onClick={backToDraft} disabled={publishing}>
              Back to draft
            </button>
          ) : undefined
        }
        primary={
          phase.status === "draft" ? (
            <button type="button" className="ph-primary" onClick={() => setDeploying(true)} disabled={publishing || !!blocked} title={blocked}>
              {startsLater ? "Schedule it" : "Make it live"}
            </button>
          ) : phase.status === "next" ? (
            <button type="button" className="ph-primary" onClick={() => setDeploying(true)} disabled={publishing}>
              Make it live now
            </button>
          ) : undefined
        }
        editDates={
          hasPhases && (
            <button type="button" className="nw-edit-phase" onClick={onEditPhase}>
              Edit dates
            </button>
          )
        }
        emptyAction={
          <button type="button" className="ph-primary" onClick={onNewPhase}>
            Create the first phase
          </button>
        }
      />

      <Block id="targets" title="Daily targets" hint={summary.join(" · ")}>
      <div className="nw-targets">
        <div className="nw-editor">
          <div className="nw-editor-top">
            <div className="nw-daytoggle" role="group" aria-label="Day type">
              {(["training", "rest"] as const).map((d) => (
                <button key={d} type="button" className={`nw-daybtn${day === d ? " on" : ""}`} onClick={() => setDay(d)} aria-pressed={day === d}>
                  {d === "training" ? "Training day" : "Rest day"}
                </button>
              ))}
            </div>
            <label className="nw-linked">
              <input
                type="checkbox"
                checked={linked}
                onChange={(e) => {
                  const on = e.target.checked;
                  setLinked(on);
                  if (on) setValues((v) => ({ training: { ...v[day] }, rest: { ...v[day] } }));
                }}
              />
              <span>Same macros on both</span>
            </label>
            <span className="nw-hint">Calories are derived from the macros</span>
          </div>

          <div className="nw-kcal">
            <div className="nw-kcal-figure">
              <span className="nw-label">Calories</span>
              <span className="nw-kcal-value">
                {n(kcal)} <small>kcal</small>
              </span>
            </div>
            <div className="nw-share" aria-hidden="true">
              {MACRO.map((m) => {
                const share = kcal > 0 ? ((current[m.key] ?? 0) * KCAL[m.key]) / kcal : 0;
                return <span key={m.key} style={{ width: `${share * 100}%`, background: m.colour }} />;
              })}
            </div>
          </div>

          <div className="nw-macros">
            {MACRO.map((m) => {
              const value = current[m.key] ?? 0;
              const pct = kcal > 0 ? Math.round(((value * KCAL[m.key]) / kcal) * 100) : 0;
              const perKg = p.latestWeightKg ? (value / p.latestWeightKg).toFixed(1) : null;
              return (
                <div key={m.key} className="nw-macro">
                  <div className="nw-macro-head">
                    <span className="nw-macro-label" style={{ color: m.colour }}>
                      {m.label}
                    </span>
                    <span className="nw-macro-pct">{pct}% kcal</span>
                  </div>
                  <div className="nw-macro-input">
                    <input type="text" inputMode="decimal" value={current[m.key] ?? ""} onChange={(e) => set(m.key, e.target.value)} aria-label={`${m.label} grams`} />
                    <span>g</span>
                  </div>
                  {/* The share of the day's calories — the same figure as the
                      label above it. It used to be grams against the heaviest
                      macro, which meant carbs sat at 100% whatever the split
                      (they are almost always the heaviest by weight) while the
                      line above said 43%. Two scales on one row, and the label
                      invites you to read the bar as that percentage. */}
                  <div className="nw-macro-bar">
                    <span style={{ width: `${pct}%`, background: m.colour }} />
                  </div>
                  {perKg && <span className="nw-macro-perkg">{perKg} g / kg</span>}
                </div>
              );
            })}
          </div>

          <div className="nw-water">
            <span className="nw-water-label">Water goal</span>
            <input type="text" inputMode="decimal" value={water} onChange={(e) => setWater(e.target.value.replace(",", "."))} aria-label="Water goal in litres" className="nw-water-input" />
            <span className="nw-water-unit">L a day</span>
            <span className="nw-hint">Shown as a goal on the client&rsquo;s Nutrition tab — not tracked</span>
          </div>
        </div>

        <div className="nw-note">
          <div className="nw-note-head">
            <span className="nw-label">Note on the targets</span>
            <span className="nw-hint">Client reads this under the kcal figure</span>
          </div>
          <textarea name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why these numbers: what to keep steady, what to push, what to watch." />
        </div>
      </div>

      </Block>

      {rest}

      {changes.length > 0 && (
        <div className="pb-pending pl-pending" role="status" aria-live="polite">
          <span className="pb-pending-count">
            {changes.length} change{changes.length === 1 ? "" : "s"}
          </span>
          <span className="pb-pending-summary">
            {hasPhases && <b>{phase.name}: </b>}
            {changes.join(" · ")}
          </span>
          <div className="pb-pending-right">
            <span className="pb-pending-status">{saving ? "Saving…" : "Unsaved"}</span>
            <button type="button" className="pb-pending-ghost" onClick={discard} disabled={saving}>
              Discard
            </button>
            <button type="button" className="pb-pending-apply" onClick={apply} disabled={saving}>
              {saving ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>
      )}
      </section>
    </>
  );
}

// ---- 2 · Supplements -----------------------------------------------------

// The supplements, as a block of the phase: its Add sits on the strip.
function SupplementsBlock({ p }: { p: NutritionWorkspaceProps }) {
  // "+ Add item" lives with the list, not on the strip. On the strip it sat
  // beside a folded block, offering to add a row to something not on screen —
  // and it was filled navy, which says "this writes", when adding a row only
  // stages one for the bar at the foot.
  return (
    <Block id="supplements" title="Supplements" hint={`${p.supplements.length} ${p.supplements.length === 1 ? "item" : "items"}`}>
      <SupplementsCard p={p} bare />
    </Block>
  );
}

function SupplementsCard({ p, bare = false }: { p: NutritionWorkspaceProps; bare?: boolean }) {
  // The sheet is edited as a draft. Nothing lands until Apply on the bar at
  // the foot, the same way every other table in the admin saves: the coach
  // can add three items and fix a quantity, see "4 changes", and land them
  // together or throw them away.
  type Row = NwSupplement & { isNew?: boolean; removed?: boolean };
  const fromProps = (): Row[] => p.supplements.map((r) => ({ ...r }));
  const [rows, setRows] = useState<Row[]>(fromProps);
  const [seed, setSeed] = useState(JSON.stringify(p.supplements));
  // Fresh data from the server (after Apply) replaces the draft.
  const incoming = JSON.stringify(p.supplements);
  if (incoming !== seed) {
    setSeed(incoming);
    setRows(fromProps());
  }
  const [applying, startApply] = useTransition();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  // A dragged order queues on the bar too; bumping dragKey remounts the
  // list so Discard puts the rows back where they were.
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  const [dragKey, setDragKey] = useState(0);
  const nextTemp = useRef(-1);
  const focusId = useRef<number | null>(null);
  const nameRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  useEffect(() => {
    if (focusId.current == null) return;
    nameRefs.current.get(focusId.current)?.focus();
    focusId.current = null;
  });

  const saved = new Map(p.supplements.map((r) => [r.id, r]));
  const edit = (id: number, field: keyof NwSupplement, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const addRow = () => {
    const id = nextTemp.current--;
    focusId.current = id;
    setRows((rs) => [...rs, { id, name: "", quantity: "", timing: "", notes: "", isNew: true }]);
  };
  const removeRow = (id: number) => {
    setConfirmId(null);
    setRows((rs) => (rs.find((r) => r.id === id)?.isNew ? rs.filter((r) => r.id !== id) : rs.map((r) => (r.id === id ? { ...r, removed: true } : r))));
  };

  const same = (a: NwSupplement, b: NwSupplement) =>
    a.name.trim() === b.name.trim() && a.quantity.trim() === b.quantity.trim() && a.timing.trim() === b.timing.trim() && a.notes.trim() === b.notes.trim();
  const added = rows.filter((r) => r.isNew && r.name.trim());
  const removed = rows.filter((r) => r.removed);
  const updated = rows.filter((r) => !r.isNew && !r.removed && saved.has(r.id) && !same(r, saved.get(r.id)!));
  const changeCount = added.length + removed.length + updated.length + (pendingOrder ? 1 : 0);
  const summary = [
    ...(pendingOrder ? ["Order changed"] : []),
    ...added.map((r) => `${r.name.trim()} added`),
    ...updated.map((r) => `${r.name.trim() || "Item"} changed`),
    ...removed.map((r) => `${r.name || "Item"} removed`),
  ].join(" · ");
  const discard = () => {
    setRows(fromProps());
    setPendingOrder(null);
    setDragKey((k) => k + 1);
  };
  const apply = () =>
    startApply(async () => {
      await applySupplementChangesAction(p.clientId, {
        added: added.map(({ name, quantity, timing, notes }) => ({ name, quantity, timing, notes })),
        updated: updated.map(({ id, name, quantity, timing, notes }) => ({ id, name, quantity, timing, notes })),
        removedIds: removed.map((r) => r.id),
        order: pendingOrder?.filter((id) => id > 0) ?? undefined,
      });
      setPendingOrder(null);
      setDragKey((k) => k + 1);
    });

  const visible = rows.filter((r) => !r.removed);
  const confirming = confirmId != null ? rows.find((r) => r.id === confirmId) ?? null : null;

  return (
    <section className={bare ? "nw-bare" : "pl-card"}>
      {bare ? null : (
        <div className="pl-band">
          <div className="pl-band-left">
            <div className="pl-eyebrow">Supplements</div>
          </div>
          <div className="pl-band-right">
            <button type="button" className="pl-primary" onClick={addRow}>
              + Add item
            </button>
          </div>
        </div>
      )}

      <div className="nw-table">
        <div className="nw-thead nw-supp-cols">
          <span>Item</span>
          <span>Quantity</span>
          <span>Timing</span>
          <span>Notes</span>
          <span />
        </div>
        {visible.length === 0 && <div className="pl-empty-row">Nothing set yet. Use + Add item.</div>}
        <DragList
          key={dragKey}
          className="nw-draglist"
          onReorder={(ids) => setPendingOrder(ids)}
          items={visible.map((row) => {
          const dirty = row.isNew || (saved.has(row.id) && !same(row, saved.get(row.id)!));
          return {
            id: row.id,
            node: (
            <div className={`nw-tr nw-supp-cols${dirty ? " is-queued" : ""}`}>
              <span className="nw-cell-item">
                <input
                  ref={(el) => {
                    if (el) nameRefs.current.set(row.id, el);
                    else nameRefs.current.delete(row.id);
                  }}
                  className="nw-cell-input"
                  type="text"
                  value={row.name}
                  placeholder="Name"
                  aria-label="name"
                  onChange={(e) => edit(row.id, "name", e.target.value)}
                />
              </span>
              <span className="nw-cell-qty">
                <input className="nw-cell-input" type="text" value={row.quantity} placeholder="e.g. 5g" aria-label="quantity" onChange={(e) => edit(row.id, "quantity", e.target.value)} />
              </span>
              <span>
                <input className="nw-cell-input" type="text" value={row.timing} placeholder="Set timing" aria-label="timing" onChange={(e) => edit(row.id, "timing", e.target.value)} />
              </span>
              <span className="nw-cell-notes">
                <input className="nw-cell-input" type="text" value={row.notes} placeholder="Optional" aria-label="notes" onChange={(e) => edit(row.id, "notes", e.target.value)} />
              </span>
              <span className="nw-remove">
                <button type="button" className="nw-remove-btn" onClick={() => setConfirmId(row.id)} aria-label={`Remove ${row.name || "item"}`} title="Remove">
                  <TrashIcon />
                </button>
              </span>
            </div>
            ),
          };
        })}
        />
        {/* At the foot of the list it is about, not on the folded strip
            above it. Not filled: it stages a row, the bar at the foot writes. */}
        <button type="button" className="nw-add-row" onClick={addRow}>
          + Add item
        </button>
      </div>

      {changeCount > 0 && (
        <div className="pb-pending pl-pending" role="status" aria-live="polite">
          <span className="pb-pending-count">
            {changeCount} change{changeCount === 1 ? "" : "s"}
          </span>
          <span className="pb-pending-summary">{summary}</span>
          <div className="pb-pending-right">
            <span className="pb-pending-status">{applying ? "Saving…" : "Unsaved"}</span>
            <button type="button" className="pb-pending-ghost" onClick={discard} disabled={applying}>
              Discard
            </button>
            <button type="button" className="pb-pending-apply" onClick={apply} disabled={applying}>
              {applying ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>
      )}

      {confirming &&
        createPortal(
          <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setConfirmId(null)}>
            <div className="pb-modal pb-modal-sm" role="dialog" aria-modal="true" aria-label="Remove this item">
              <h2 className="pb-confirm-title">Remove {confirming.name.trim() || "this item"}?</h2>
              <p className="pb-confirm-body">It comes off the client&rsquo;s list when you Apply. Until then you can still Discard.</p>
              <div className="pb-modal-foot">
                <button type="button" className="ad-btn-secondary" onClick={() => setConfirmId(null)}>
                  Keep it
                </button>
                <button type="button" className="pb-confirm-delete" onClick={() => removeRow(confirming.id)}>
                  Remove
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}

// One block of the phase section: a strip that says what is inside, and a
// chevron that folds it away. Which blocks a coach keeps folded is theirs,
// so it is remembered for them rather than for the client they are looking at.
function Block({ id, title, hint, actions, children }: { id: string; title: string; hint: string; actions?: ReactNode; children: ReactNode }) {
  const key = `ironline.nutrition.block.${id}`;
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(key) === "0") setOpen(false);
    } catch {}
  }, [key]);
  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(key, v ? "0" : "1");
      } catch {}
      return !v;
    });
  };
  return (
    <section className="nl-block">
      {/* The strip is the disclosure; anything the block can do sits on it,
          outside that button so it is its own target. */}
      <div className="nl-block-strip">
        <button type="button" className="nl-block-head" onClick={toggle} aria-expanded={open}>
          <span className="nw-label">{title}</span>
          <span className="nl-block-hint">{hint}</span>
        </button>
        {actions && <span className="nl-block-actions">{actions}</span>}
        <button type="button" className={`nl-block-chev${open ? " open" : ""}`} onClick={toggle} aria-label={open ? `Fold ${title}` : `Open ${title}`}>
          <ChevronDownIcon />
        </button>
      </div>
      {open && <div className="nl-block-body">{children}</div>}
    </section>
  );
}

const loggedHint = (view: LoggedDaysView | undefined) =>
  !view || view.days.length === 0 ? "Nothing logged yet" : `${view.days.length} of ${view.windowDays} days logged`;

// ---- 3 · Calories logged -------------------------------------------------

