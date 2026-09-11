"use client";

import { useState, useTransition } from "react";
import { addClientGoalAction, removeClientGoalAction, reorderClientGoalsAction, toggleClientGoalAction, updateClientGoalAction } from "../lib/actions";
import DragList from "../components/DragList";
import type { GoalEditorOptions } from "../lib/queries";
import { fmtDate, fmtNum, metricPace, type GoalTracking } from "../lib/goalView";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";

// The coach's goals for one client: the list, and the editor that adds or
// changes one. A goal can be tied to a check-in figure, an exercise or a
// daily habit; the "Client sees" preview at the foot of the editor is the
// exact row the client gets, from the same function.

export type GoalListItem = { id: number; text: string; done: boolean; tracking: GoalTracking | null; label: string; createdAt?: string | null };

type Kind = "metric" | "exercise" | "habit" | "none";

export default function GoalsPanel({ clientId, goals, options }: { clientId: number; goals: GoalListItem[]; options: GoalEditorOptions }) {
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const current = typeof editing === "number" ? goals.find((g) => g.id === editing) ?? null : null;

  return (
    <div className="ge">
      {goals.length === 0 && editing == null && <p className="ad-panel-empty">None set yet.</p>}
      {goals.length > 0 && (
        <DragList
          className="ad-goal-list"
          onReorder={(ids) => void reorderClientGoalsAction(clientId, ids)}
          items={goals.map((g) => ({
            id: g.id,
            node: (
            <div className={`ad-goal-row${g.done ? " done" : ""}`}>
              {g.tracking == null ? (
                <form action={toggleClientGoalAction} className="ge-done-form">
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="done" value={(!g.done).toString()} />
                  <button type="submit" className={`ge-done${g.done ? " on" : ""}`} aria-label={g.done ? "Mark not done" : "Mark done"}>
                    {g.done ? "✓" : ""}
                  </button>
                </form>
              ) : (
                <span className="ad-goal-bullet" aria-hidden="true" />
              )}
              <span className="ad-goal-main">
                <span className="ad-goal-text">{g.text}</span>
                <span className="ad-goal-kind">{g.label}</span>
              </span>
              <button type="button" className="ad-goal-edit" onClick={() => setEditing(g.id)}>
                Edit
              </button>
              <ConfirmDeleteButton action={removeClientGoalAction} hiddenFields={{ id: g.id }} label={`Delete goal: ${g.text}`} />
            </div>
            ),
          }))}
        />
      )}

      {editing == null ? (
        <button type="button" className="ad-btn-secondary ge-add-btn" onClick={() => setEditing("new")}>
          + Add goal
        </button>
      ) : (
        <GoalEditor
          key={typeof editing === "number" ? editing : "new"}
          clientId={clientId}
          goal={current}
          options={options}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

export function GoalEditor({
  clientId,
  goal,
  options,
  onClose,
  meetingId = null,
  heading,
}: {
  clientId: number;
  goal: GoalListItem | null;
  options: GoalEditorOptions;
  onClose: () => void;
  /** The meeting this goal is being set in, when added from one. */
  meetingId?: number | null;
  /** Shown above the fields when the editor is a dialog. */
  heading?: { title: string; subtitle?: string };
}) {
  const t = goal?.tracking ?? null;
  const [text, setText] = useState(goal?.text ?? "");
  const [kind, setKind] = useState<Kind>(t?.kind ?? "none");
  // Metric
  // Nothing preselected: a new goal starts with the search box empty.
  const [metricKey, setMetricKey] = useState(t?.kind === "metric" ? t.metricKey : "");
  const [op, setOp] = useState<"<=" | ">=">(t?.kind === "metric" ? t.op : "<=");
  const [target, setTarget] = useState(t?.kind === "metric" ? String(t.target) : "");
  const [byMode, setByMode] = useState<"phase" | "custom">(t?.kind === "metric" && t.byDate !== options.phaseEnd ? "custom" : options.phaseEnd ? "phase" : "custom");
  const [byDate, setByDate] = useState(t?.kind === "metric" ? t.byDate : options.phaseEnd ?? "");
  // Exercise
  const [exerciseId, setExerciseId] = useState(t?.kind === "exercise" ? t.exerciseId : 0);
  const [weight, setWeight] = useState(t?.kind === "exercise" ? String(t.weight) : "");
  const [reps, setReps] = useState(t?.kind === "exercise" ? String(t.reps) : "");
  const [maxRpe, setMaxRpe] = useState(t?.kind === "exercise" && t.maxRpe != null ? String(t.maxRpe) : "");
  // Habit
  const [habitId, setHabitId] = useState(t?.kind === "habit" ? t.metricId : 0);
  const [hop, setHop] = useState<"<=" | ">=">(t?.kind === "habit" ? t.op : ">=");
  const [hvalue, setHvalue] = useState(t?.kind === "habit" ? String(t.value) : "");
  const [daysPerWeek, setDaysPerWeek] = useState(t?.kind === "habit" ? String(t.daysPerWeek) : "5");
  const [pending, start] = useTransition();
  // Progress counts from this date and the metric's value on it.
  const [startDate, setStartDate] = useState(goal?.createdAt ?? options.today);

  const num = (s: string) => {
    const n = Number(s.replace(",", "."));
    return s.trim() === "" || !Number.isFinite(n) ? null : n;
  };
  const effectiveBy = byMode === "phase" && options.phaseEnd ? options.phaseEnd : byDate;

  const metric = options.metrics.find((m) => m.key === metricKey) ?? null;
  const exercise = options.exercises.find((e) => e.id === Number(exerciseId)) ?? null;
  const habit = options.habits.find((h) => h.id === Number(habitId)) ?? null;

  // The tracking as it stands, or null while a required figure is missing.
  const tracking: GoalTracking | null = (() => {
    if (kind === "metric") {
      const tg = num(target);
      return metric && tg != null && effectiveBy ? { kind: "metric", metricKey, op, target: tg, byDate: effectiveBy } : null;
    }
    if (kind === "exercise") {
      const w = num(weight);
      const r = num(reps);
      return exercise && w != null && r != null ? { kind: "exercise", exerciseId: exercise.id, weight: w, reps: r, maxRpe: num(maxRpe) } : null;
    }
    if (kind === "habit") {
      const v = num(hvalue);
      const d = num(daysPerWeek);
      return habit && v != null && d != null ? { kind: "habit", metricId: habit.id, op: hop, value: v, daysPerWeek: Math.max(1, Math.min(7, Math.round(d))) } : null;
    }
    return null;
  })();
  const complete = text.trim() !== "" && (kind === "none" || tracking != null);


  // Helper lines under the fields.
  const helper = (() => {
    if (kind === "metric" && !metric) return "Pick a metric to track this goal by.";
    if (kind === "exercise" && !exercise) return "Pick an exercise to track this goal by.";
    if (kind === "habit" && !habit) return options.habits.length ? "Pick a daily check-in field to count." : "Add a daily check-in field first.";
    if (kind === "metric" && metric) {
      const latest = metric.series[metric.series.length - 1];
      if (!latest) return `Nothing logged for ${metric.name} yet.`;
      const tg = num(target);
      const pace = metricPace(metric.series, options.today);
      const paceWeek = pace == null ? null : pace * 7;
      const weeks = effectiveBy ? Math.max(1, Math.round((new Date(`${effectiveBy}T00:00:00`).getTime() - new Date(`${options.today}T00:00:00`).getTime()) / (7 * 86400000))) : null;
      const needs = tg != null && weeks ? (tg - latest.value) / weeks : null;
      const u = metric.unit ? ` ${metric.unit}` : "";
      let verdict = "";
      if (tg != null && effectiveBy && paceWeek != null && weeks) {
        const projected = latest.value + paceWeek * weeks;
        const ok = op === ">=" ? projected >= tg : projected <= tg;
        const later = new Date(`${effectiveBy}T00:00:00`);
        later.setDate(later.getDate() + 7);
        const laterIso = `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, "0")}-${String(later.getDate()).padStart(2, "0")}`;
        verdict = ok ? " → on pace." : ` → behind. Consider ${fmtDate(laterIso)} or ${fmtNum(Math.round(projected * 2) / 2)}${u}.`;
      }
      return (
        `Now ${fmtNum(latest.value)}${u}` +
        (needs != null && tg != null && effectiveBy ? ` · needs ${needs >= 0 ? "+" : ""}${fmtNum(needs)}${u}/week to hit ${fmtNum(tg)} by ${fmtDate(effectiveBy)}.` : ".") +
        (paceWeek != null ? ` Current pace ${paceWeek >= 0 ? "+" : ""}${fmtNum(paceWeek)}${u}/week${verdict}` : " No pace yet.")
      );
    }
    if (kind === "exercise" && exercise) {
      const sets = exercise.sets.filter((s) => s.weight != null && s.reps != null);
      const best = sets.slice().sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
      if (!best) return `No sets logged for ${exercise.name} yet.`;
      const day = new Date(`${best.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      return `Best logged so far: ${fmtNum(best.weight!)} × ${best.reps}${best.rpe != null ? ` @${best.rpe}` : ""} (${day}).`;
    }
    if (kind === "habit") return habit ? `Counts each day ${habit.name} is logged ${hop} the value.` : "Add a daily check-in field first.";
    return "Shown as text only. You mark it done by hand.";
  })();

  const submit = (formData: FormData) =>
    start(async () => {
      if (goal) await updateClientGoalAction(formData);
      else await addClientGoalAction(formData);
      onClose();
    });

  const chip = (k: Kind, label: string, enabled = true) => (
    <button type="button" className={`ge-chip${kind === k ? " active" : ""}`} onClick={() => setKind(k)} disabled={!enabled} title={enabled ? undefined : "Nothing to track yet"}>
      {label}
    </button>
  );

  return (
    <form action={submit} className="ge-editor">
      {heading && (
        <div className="ge-head">
          <h2 className="pb-confirm-title">{heading.title}</h2>
          {heading.subtitle && <div className="ge-head-sub">{heading.subtitle}</div>}
        </div>
      )}
      {goal ? <input type="hidden" name="id" value={goal.id} /> : <input type="hidden" name="clientId" value={clientId} />}
      <input type="hidden" name="start" value={startDate} />
      <input type="hidden" name="tracking" value={kind === "none" ? "" : JSON.stringify(tracking ?? {})} />
      {meetingId != null && <input type="hidden" name="meetingId" value={meetingId} />}

      <label className="ge-field">
        <span>Goal</span>
        <input name="text" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Get to 80 kg without losing bench strength" required maxLength={120} autoFocus />
      </label>

      <div className="ge-field">
        <span>Track with</span>
        <div className="ge-chips">
          {chip("metric", "Metric", options.metrics.length > 0)}
          {chip("exercise", "Exercise", options.exercises.length > 0)}
          {chip("habit", "Habit", options.habits.length > 0)}
          {chip("none", "Nothing")}
        </div>
      </div>

      {kind === "metric" && (
        <div className="ge-grid">
          <label className="ge-field ge-span2">
            <span>Metric</span>
            <SearchPick
              value={metricKey}
              items={options.metrics.map((m) => ({ id: m.key, label: m.name, hint: m.unit }))}
              onPick={setMetricKey}
              placeholder="Search metrics…"
            />
            <small>{options.metrics.length} metrics deployed to this client</small>
          </label>
          <label className="ge-field">
            <span>Reach</span>
            <select value={op} onChange={(e) => setOp(e.target.value as "<=" | ">=")}>
              <option value="<=">≤ at most</option>
              <option value=">=">≥ at least</option>
            </select>
          </label>
          <label className="ge-field">
            <span>Target{metric?.unit ? ` (${metric.unit})` : ""}</span>
            <input type="text" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="75" />
          </label>
          {/* With a phase running, "By" offers its end or a date of your own;
              without one there is nothing to choose, so it is just a date. */}
          {options.phaseEnd ? (
            <>
              <label className="ge-field">
                <span>By</span>
                <select value={byMode} onChange={(e) => setByMode(e.target.value as "phase" | "custom")}>
                  <option value="phase">End of phase · {fmtDate(options.phaseEnd)}</option>
                  <option value="custom">Custom date</option>
                </select>
              </label>
              {byMode === "custom" && (
                <label className="ge-field">
                  <span>Date</span>
                  <input type="date" value={byDate} onChange={(e) => setByDate(e.target.value)} />
                </label>
              )}
            </>
          ) : (
            <label className="ge-field ge-span2">
              <span>By date</span>
              <input type="date" value={byDate} onChange={(e) => setByDate(e.target.value)} />
            </label>
          )}
        </div>
      )}

      {kind === "exercise" && (
        <div className="ge-grid">
          <label className="ge-field ge-span2">
            <span>Exercise</span>
            <SearchPick
              value={String(exerciseId)}
              items={options.exercises.map((e) => ({ id: String(e.id), label: e.name, hint: e.sets.length ? `${e.sets.length} sets logged` : "" }))}
              onPick={(id) => setExerciseId(Number(id))}
              placeholder="Search exercises…"
            />
          </label>
          <label className="ge-field">
            <span>Weight (kg)</span>
            <input type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="100" />
          </label>
          <label className="ge-field">
            <span>Reps</span>
            <input type="text" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="5" />
          </label>
          <label className="ge-field">
            <span>Max RPE (optional)</span>
            <input type="text" inputMode="decimal" value={maxRpe} onChange={(e) => setMaxRpe(e.target.value)} placeholder="8" />
          </label>
        </div>
      )}

      {kind === "habit" && (
        <div className="ge-grid">
          <label className="ge-field ge-span2">
            <span>Check-in field</span>
            <SearchPick
              value={String(habitId)}
              items={options.habits.map((h) => ({ id: String(h.id), label: h.name, hint: "daily" }))}
              onPick={(id) => setHabitId(Number(id))}
              placeholder="Search check-in fields…"
            />
          </label>
          <label className="ge-field">
            <span>Counts if</span>
            <select value={hop} onChange={(e) => setHop(e.target.value as "<=" | ">=")}>
              <option value=">=">≥ at least</option>
              <option value="<=">≤ at most</option>
            </select>
          </label>
          <label className="ge-field">
            <span>Value</span>
            <input type="text" inputMode="decimal" value={hvalue} onChange={(e) => setHvalue(e.target.value)} placeholder="8000" />
          </label>
          <label className="ge-field">
            <span>Days / week</span>
            <input type="text" inputMode="numeric" value={daysPerWeek} onChange={(e) => setDaysPerWeek(e.target.value)} placeholder="5" />
          </label>
        </div>
      )}

      {kind !== "none" && (
        <div className="ge-grid">
          <label className="ge-field">
            <span>Start</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            {kind === "metric" && metric && (() => {
              const at = [...metric.series].filter((p) => p.date >= startDate)[0] ?? metric.series[metric.series.length - 1];
              return at ? <small>value then: {fmtNum(at.value)}{metric.unit ? ` ${metric.unit}` : ""}</small> : null;
            })()}
          </label>
          {kind !== "metric" && <span />}
        </div>
      )}

      <p className="ge-helper">{helper}</p>

      <div className="ge-foot">
        <button type="button" className="ad-btn-secondary" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="ad-btn-primary" disabled={pending || !complete}>
          {pending ? "Saving…" : goal ? "Save goal" : "Add goal"}
        </button>
      </div>
    </form>
  );
}

// A select you can type into: the field shows the current choice; typing
// filters the list underneath; a click or Enter picks. Escape or clicking
// away puts the current choice back.
function SearchPick({
  value,
  items,
  onPick,
  placeholder,
}: {
  value: string;
  items: { id: string; label: string; hint?: string }[];
  onPick: (id: string) => void;
  placeholder: string;
}) {
  const current = items.find((i) => i.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const q = query.trim().toLowerCase();
  const matches = (q ? items.filter((i) => i.label.toLowerCase().includes(q) || (i.hint ?? "").toLowerCase().includes(q)) : items).slice(0, 12);

  const pick = (id: string) => {
    onPick(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="ge-pick">
      <input
        type="text"
        value={open ? query : current ? `${current.label}${current.hint ? ` (${current.hint})` : ""}` : ""}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setCursor(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(0);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(matches.length - 1, c + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(0, c - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (matches[cursor]) pick(matches[cursor].id);
          } else if (e.key === "Escape") {
            setOpen(false);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
      />
      {open && (
        <div className="ge-pick-list" role="listbox">
          {matches.length === 0 && <div className="ge-pick-empty">Nothing matches</div>}
          {matches.map((i, idx) => (
            <button
              key={i.id}
              type="button"
              role="option"
              aria-selected={i.id === value}
              className={`ge-pick-item${idx === cursor ? " cursor" : ""}${i.id === value ? " current" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(i.id)}
            >
              <span>{i.label}</span>
              {i.hint && <small>{i.hint}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
