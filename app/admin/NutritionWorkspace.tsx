"use client";

import { useState, useTransition } from "react";
import {
  addSupplementRowAction,
  removeSupplementRowAction,
  saveCoachNutritionNoteAction,
  saveNutritionTargetsAction,
  updateSupplementRowAction,
} from "../lib/actions";
import type { ClientPhase } from "../lib/db";
import { PhaseDialog } from "./PhaseDialogButton";

// The Nutrition tab: three navy-banded cards. Daily targets per nutrition
// phase with the note beside them, the supplements sheet, and the calories
// the client logged against those targets. All data arrives from the server
// panel; the writes are the existing actions.

type Macros = { protein: number | null; carbs: number | null; fats: number | null };
export type NwPhase = {
  id: number;
  name: string;
  status: "past" | "now" | "next";
  startLabel: string;
  range: string;
  training: Macros;
  rest: Macros;
  note: string;
  phase: ClientPhase;
};
export type NwSupplement = { id: number; name: string; quantity: string; timing: string; notes: string };
export type NwLogDay = { date: string; kcal: number | null; isTraining: boolean; target: number | null; note: string | null };

export type NutritionWorkspaceProps = {
  clientId: number;
  clientName: string;
  today: string;
  /** No phases: one client-level editor with id 0. */
  phases: NwPhase[];
  waterL: number | null;
  latestWeightKg: number | null;
  supplements: NwSupplement[];
  /** The last 30 days, today first, one entry per day, missed days included. */
  logs: NwLogDay[];
  liveSince: string | null;
};

const KCAL = { protein: 4, carbs: 4, fats: 9 } as const;
const MACRO = [
  { key: "protein", label: "Protein", colour: "#2f5d8f" },
  { key: "carbs", label: "Carbs", colour: "#3f6e46" },
  { key: "fats", label: "Fat", colour: "#9a5a33" },
] as const;
const kcalOf = (m: Macros) => (m.protein ?? 0) * KCAL.protein + (m.carbs ?? 0) * KCAL.carbs + (m.fats ?? 0) * KCAL.fats;
const same = (a: Macros, b: Macros) => a.protein === b.protein && a.carbs === b.carbs && a.fats === b.fats;
const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", opts);
const n = (v: number) => v.toLocaleString("en-US");

export default function NutritionWorkspace(p: NutritionWorkspaceProps) {
  const initial = p.phases.find((x) => x.status === "now") ?? p.phases.find((x) => x.status === "next") ?? p.phases[0];
  const [phaseId, setPhaseId] = useState<number>(initial?.id ?? 0);
  const phase = p.phases.find((x) => x.id === phaseId) ?? initial;
  const [editPhase, setEditPhase] = useState(false);

  return (
    <div className="pl nw">
      {phase && <TargetsCard key={phase.id} p={p} phase={phase} onPickPhase={setPhaseId} onEditPhase={() => setEditPhase(true)} />}
      <SupplementsCard p={p} />
      <CaloriesCard p={p} />
      {editPhase && phase && phase.id !== 0 && (
        <PhaseDialog clientId={p.clientId} phase={phase.phase} today={p.today} onClose={() => setEditPhase(false)} />
      )}
    </div>
  );
}

// ---- 1 · Daily targets ---------------------------------------------------

function TargetsCard({ p, phase, onPickPhase, onEditPhase }: { p: NutritionWorkspaceProps; phase: NwPhase; onPickPhase: (id: number) => void; onEditPhase: () => void }) {
  const [day, setDay] = useState<"training" | "rest">("training");
  const [values, setValues] = useState({ training: phase.training, rest: phase.rest });
  const [linked, setLinked] = useState(() => same(phase.training, phase.rest));
  const [water, setWater] = useState(p.waterL != null ? String(p.waterL) : "");
  const [saving, startSave] = useTransition();
  const [note, setNote] = useState(phase.note);
  const [noteSaving, startNote] = useTransition();
  const [noteSavedAt, setNoteSavedAt] = useState<number | null>(null);

  const current = values[day];
  const kcal = kcalOf(current);
  const largest = Math.max(current.protein ?? 0, current.carbs ?? 0, current.fats ?? 0, 1);
  const set = (key: keyof Macros, raw: string) => {
    const v = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    setValues((old) => {
      const next = { ...old[day], [key]: Number.isFinite(v as number) ? v : null };
      return linked ? { training: next, rest: next } : { ...old, [day]: next };
    });
  };
  const dirty = !same(values.training, phase.training) || !same(values.rest, phase.rest) || water !== (p.waterL != null ? String(p.waterL) : "");
  const live = phase.status === "now" || phase.id === 0;
  const formId = `nt-targets-${phase.id}`;
  const noteFormId = `nt-note-${phase.id}`;

  const summary = [
    `${n(kcalOf(values.training))} kcal training`,
    `${n(kcalOf(values.rest))} kcal rest`,
    water ? `${water} L water` : null,
  ].filter(Boolean);

  return (
    <section className="pl-card">
      <div className="pl-band">
        <div className="pl-band-left">
          <div className="pl-eyebrow">Daily targets</div>
          <div className="pl-summary-line">
            {summary.join(" · ")}
            <span className="pl-summary-tail">
              {live
                ? ` · live for ${p.clientName.split(" ")[0]}${p.liveSince ? ` since ${fmtDate(p.liveSince, { day: "numeric", month: "short" })}` : ""}`
                : phase.status === "next"
                ? ` · ${phase.name} starts ${phase.startLabel} · not live yet`
                : ` · ${phase.name} has ended`}
            </span>
          </div>
        </div>
        <div className="pl-band-right">
          {p.phases.length > 1 && (
            <div className="pl-switch" role="tablist">
              {p.phases.map((ph) => (
                <button key={ph.id} type="button" className={`pl-switch-opt${ph.id === phase.id ? " active" : ""}`} onClick={() => onPickPhase(ph.id)} title={ph.range}>
                  {ph.status === "next" ? `${ph.name} · ${ph.startLabel}` : ph.name}
                </button>
              ))}
            </div>
          )}
          {phase.id !== 0 && (
            <button type="button" className="pl-switch-opt nw-edit-phase" onClick={onEditPhase}>
              Edit dates
            </button>
          )}
          <button type="submit" form={formId} className="pl-primary" disabled={saving}>
            {saving ? "Saving…" : "Save targets"}
          </button>
        </div>
      </div>

      <div className="nw-targets">
        <form
          id={formId}
          className="nw-editor"
          action={(fd) =>
            startSave(async () => {
              await saveNutritionTargetsAction(fd);
            })
          }
        >
          <input type="hidden" name="clientId" value={p.clientId} />
          {phase.id !== 0 && <input type="hidden" name="phaseId" value={phase.id} />}
          {(["training", "rest"] as const).map((d) =>
            (["protein", "carbs", "fats"] as const).map((m) => (
              <input key={`${d}_${m}`} type="hidden" name={`${d === "training" ? "t" : "r"}_${m}`} value={values[d][m] ?? ""} />
            ))
          )}
          <input type="hidden" name="water" value={water} />

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
                  <div className="nw-macro-bar">
                    <span style={{ width: `${Math.min(100, (value / largest) * 100)}%`, background: m.colour }} />
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
          {dirty && !saving && <div className="nw-unsaved">Unsaved changes — Save targets is at the top of the card</div>}
        </form>

        <form
          id={noteFormId}
          className="nw-note"
          action={(fd) =>
            startNote(async () => {
              await saveCoachNutritionNoteAction(fd);
              setNoteSavedAt(Date.now());
            })
          }
        >
          <input type="hidden" name="clientId" value={p.clientId} />
          {phase.id !== 0 && <input type="hidden" name="phaseId" value={phase.id} />}
          <div className="nw-note-head">
            <span className="nw-label">Note on the targets</span>
            <span className="nw-hint">Client reads this under the kcal figure</span>
          </div>
          <textarea name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why these numbers: what to keep steady, what to push, what to watch." />
          <div className="nw-note-foot">
            <span className="nw-hint">{noteSaving ? "Saving…" : noteSavedAt ? "Saved just now" : note === phase.note ? "Saved" : "Unsaved"}</span>
            <button type="submit" className="ad-btn-secondary" disabled={noteSaving || note === phase.note}>
              Save note
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

// ---- 2 · Supplements -----------------------------------------------------

const TIMING_TONE = (t: string) => {
  const s = t.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("post") || s.includes("after")) return { bg: "#e6e4fa", fg: "#3a3390" };
  if (s.includes("breakfast") || s.includes("morning")) return { bg: "#fff3dc", fg: "#8a5a12" };
  if (s.includes("bed") || s.includes("night") || s.includes("evening")) return { bg: "#eef0f3", fg: "#5b6474" };
  return { bg: "#dff3ea", fg: "#0f5c46" };
};

function SupplementsCard({ p }: { p: NutritionWorkspaceProps }) {
  const addId = `nw-add-supp-${p.clientId}`;
  return (
    <section className="pl-card">
      <div className="pl-band">
        <div className="pl-band-left">
          <div className="pl-eyebrow">Supplements</div>
          <div className="pl-summary-line">
            {p.supplements.length} item{p.supplements.length === 1 ? "" : "s"}
            <span className="pl-summary-tail"> · shown as a reference list on the client&rsquo;s app, no tick boxes</span>
          </div>
        </div>
        <div className="pl-band-right">
          <button type="submit" form={addId} className="pl-primary">
            + Add item
          </button>
        </div>
      </div>

      <div className="nw-table">
        <div className="nw-thead nw-supp-cols">
          <span>Item</span>
          <span>Quantity</span>
          <span>Timing</span>
          <span>Notes</span>
          <span />
        </div>
        {p.supplements.length === 0 && <div className="pl-empty-row">Nothing set yet. Add the first item below.</div>}
        {p.supplements.map((row) => (
          <div key={row.id} className="nw-tr nw-supp-cols">
            <Cell clientId={p.clientId} rowId={row.id} field="name" value={row.name} placeholder="Name" className="nw-cell-item" />
            <Cell clientId={p.clientId} rowId={row.id} field="quantity" value={row.quantity} placeholder="e.g. 5g" className="nw-cell-qty" />
            <TimingCell clientId={p.clientId} rowId={row.id} value={row.timing} />
            <Cell clientId={p.clientId} rowId={row.id} field="notes" value={row.notes} placeholder="Optional" className="nw-cell-notes" />
            <form action={removeSupplementRowAction} className="nw-remove">
              <input type="hidden" name="clientId" value={p.clientId} />
              <input type="hidden" name="rowId" value={row.id} />
              <button type="submit" aria-label={`Remove ${row.name || "supplement"}`}>
                ×
              </button>
            </form>
          </div>
        ))}
        <div className="nw-tfoot nw-supp-foot">
          <form action={addSupplementRowAction} id={addId}>
            <input type="hidden" name="clientId" value={p.clientId} />
            <input name="name" type="text" placeholder="Add an item, e.g. Magnesium" className="nw-add-input" aria-label="New supplement" />
          </form>
          <span className="nw-hint">Quantity and timing can be filled in after</span>
          <button type="submit" form={addId} className="ad-btn-primary nw-add-btn">
            Add
          </button>
        </div>
      </div>
    </section>
  );
}

function Cell({ clientId, rowId, field, value, placeholder, className }: { clientId: number; rowId: number; field: "name" | "quantity" | "notes"; value: string; placeholder?: string; className?: string }) {
  return (
    <form action={updateSupplementRowAction} className={className}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="rowId" value={rowId} />
      <input type="hidden" name="field" value={field} />
      <input
        name="value"
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        aria-label={field}
        className="nw-cell-input"
        onBlur={(e) => {
          if (e.currentTarget.value !== value) e.currentTarget.form?.requestSubmit();
        }}
      />
    </form>
  );
}

function TimingCell({ clientId, rowId, value }: { clientId: number; rowId: number; value: string }) {
  const [editing, setEditing] = useState(false);
  const tone = TIMING_TONE(value);
  if (!editing) {
    return (
      <button type="button" className="nw-timing-btn" onClick={() => setEditing(true)} title="Click to change">
        {tone ? (
          <span className="nw-timing-pill" style={{ background: tone.bg, color: tone.fg }}>
            {value}
          </span>
        ) : (
          <span className="nw-timing-empty">Set timing</span>
        )}
      </button>
    );
  }
  return (
    <form action={updateSupplementRowAction} onSubmit={() => setTimeout(() => setEditing(false), 0)}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="rowId" value={rowId} />
      <input type="hidden" name="field" value="timing" />
      <input
        name="value"
        type="text"
        defaultValue={value}
        placeholder="Post-workout, with breakfast, before bed…"
        aria-label="timing"
        className="nw-cell-input editing"
        autoFocus
        onBlur={(e) => {
          if (e.currentTarget.value !== value) e.currentTarget.form?.requestSubmit();
          else setEditing(false);
        }}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
      />
    </form>
  );
}

// ---- 3 · Calories logged -------------------------------------------------

function CaloriesCard({ p }: { p: NutritionWorkspaceProps }) {
  const [win, setWin] = useState<7 | 30>(7);
  const days = p.logs.slice(0, win);
  const logged = days.filter((d) => d.kcal != null);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + (d.kcal ?? 0), 0) / logged.length) : null;
  const withTarget = logged.filter((d) => d.target != null);
  const avgDiff = withTarget.length ? Math.round(withTarget.reduce((s, d) => s + ((d.kcal ?? 0) - (d.target ?? 0)), 0) / withTarget.length) : null;
  const tone = (d: NwLogDay) => (d.kcal == null || d.target == null ? "none" : Math.abs(d.kcal - d.target) <= 150 ? "green" : "orange");
  const vs = (d: NwLogDay) => {
    if (d.kcal == null) return "—";
    if (d.target == null) return "no target";
    const diff = d.kcal - d.target;
    if (Math.abs(diff) <= 0) return "on target";
    return `${n(Math.abs(diff))} kcal ${diff > 0 ? "over" : "under"}`;
  };
  const cap = 3000;
  const strip = [...days].reverse();

  return (
    <section className="pl-card">
      <div className="pl-band">
        <div className="pl-band-left">
          <div className="pl-eyebrow">Calories logged</div>
          <div className="pl-summary-line">
            {logged.length} of last {win} days
            <span className="pl-summary-tail">
              {avg != null ? ` · avg ${n(avg)} kcal` : ""}
              {avgDiff != null ? ` · ${n(Math.abs(avgDiff))} kcal ${avgDiff >= 0 ? "over" : "under"} target on average` : ""}
            </span>
          </div>
        </div>
        <div className="pl-band-right">
          <div className="pl-switch" role="tablist">
            {([7, 30] as const).map((w) => (
              <button key={w} type="button" className={`pl-switch-opt${win === w ? " active" : ""}`} onClick={() => setWin(w)}>
                {w} days
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="nw-strip">
        {strip.map((d) => (
          <div key={d.date} className="nw-strip-day" title={d.kcal != null ? `${n(d.kcal)} kcal` : "not logged"}>
            <span className={`nw-strip-bar ${tone(d)}`} style={{ height: d.kcal != null ? `${Math.max(6, Math.min(100, (d.kcal / cap) * 100))}%` : "4px" }} />
            <span className="nw-strip-label">{fmtDate(d.date, { weekday: "short" })}</span>
          </div>
        ))}
      </div>

      <div className="nw-table">
        <div className="nw-thead nw-cal-cols">
          <span>Date</span>
          <span>Logged</span>
          <span>Day</span>
          <span>vs target</span>
          <span>Client note</span>
        </div>
        {days.map((d) => (
          <div key={d.date} className={`nw-tr nw-cal-cols${d.kcal == null ? " missed" : ""}`}>
            <span className="nw-cal-date">{fmtDate(d.date, { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className="nw-cal-kcal">{d.kcal != null ? `${n(d.kcal)} kcal` : "not logged"}</span>
            <span>
              <span className={`nw-daypill ${d.isTraining ? "training" : "rest"}`}>{d.isTraining ? "Training" : "Rest"}</span>
            </span>
            <span className={`nw-cal-vs ${tone(d)}`}>{vs(d)}</span>
            <span className="nw-cal-note">{d.note ?? "—"}</span>
          </div>
        ))}
        <div className="nw-tfoot">Logged by the client under their targets. Missed days show as a gap — nothing is filled in for them.</div>
      </div>
    </section>
  );
}
