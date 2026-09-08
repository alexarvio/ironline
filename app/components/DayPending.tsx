"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { applyDayChangesAction, type DayChangesPayload, type DayFieldKey } from "../lib/actions";
import { TrashIcon } from "./icons";

// Pending changes for one programme day.
//
// Every edit inside a day card (a set count, a reorder, a removed or added
// exercise, the session label, the rest toggle) lands here instead of being
// saved on its own. The bar at the foot of the card says what is queued and
// applies it all in one go, to this week or to every remaining week too.
// Nothing reaches the store until Apply; Discard puts the day back.

export type FieldKey = DayFieldKey;
export type PendingAssignment = {
  id: number;
  exerciseId: number;
  exerciseName: string;
  fields: Record<FieldKey, string>;
  custom: Record<number, string>;
};
export type NewExercise = { tempId: number; exerciseId: number; exerciseName: string; fields: Record<FieldKey, string> };
export type DayColumn = { id: number; kind: "builtin" | "custom"; key: string; label: string };

type Draft = {
  fields: Record<number, Partial<Record<FieldKey, string>>>;
  custom: Record<number, Record<number, string>>;
  removed: number[];
  added: NewExercise[];
  order: number[] | null;
  label: string | null;
  rest: boolean | null;
};

const EMPTY: Draft = { fields: {}, custom: {}, removed: [], added: [], order: null, label: null, rest: null };

export const FIELD_LABEL: Record<FieldKey, string> = {
  sets: "sets",
  reps: "reps",
  targetWeight: "weight",
  rpe: "RPE",
  tempo: "tempo",
  notes: "note",
};

type Status = "idle" | "applying" | "failed";

type Ctx = {
  dayId: number;
  dayName: string;
  weekLabel: string;
  remainingCount: number;
  remainingLabel: string;
  columns: DayColumn[];
  assignments: PendingAssignment[];
  draft: Draft;
  count: number;
  entries: string[];
  status: Status;
  error: string | null;
  notice: string | null;
  alsoRemaining: boolean;
  setAlsoRemaining: (v: boolean) => void;
  fieldValue: (id: number, key: FieldKey) => string;
  customValue: (id: number, columnId: number) => string;
  labelValue: string;
  restValue: boolean;
  hasExercises: boolean;
  order: number[];
  isRemoved: (id: number) => boolean;
  setField: (id: number, key: FieldKey, value: string) => void;
  setCustom: (id: number, columnId: number, value: string) => void;
  remove: (id: number) => void;
  restore: (id: number) => void;
  add: (ex: Omit<NewExercise, "tempId">) => void;
  unadd: (tempId: number) => void;
  setAddedField: (tempId: number, key: FieldKey, value: string) => void;
  setOrder: (ids: number[]) => void;
  setLabel: (v: string) => void;
  setRest: (v: boolean) => void;
  apply: () => void;
  discard: () => void;
};

const PendingContext = createContext<Ctx | null>(null);

export function usePendingDay() {
  return useContext(PendingContext);
}

const REMEMBER_KEY = "pb-apply-remaining";

function show(v: string) {
  return v === "" ? "–" : v;
}

export function DayPendingProvider({
  dayId,
  dayName,
  weekLabel,
  remainingCount,
  remainingLabel,
  columns,
  assignments,
  label,
  isRest,
  children,
}: {
  dayId: number;
  dayName: string;
  weekLabel: string;
  remainingCount: number;
  remainingLabel: string;
  columns: DayColumn[];
  assignments: PendingAssignment[];
  label: string;
  isRest: boolean;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [alsoRemaining, setAlsoRemainingState] = useState(false);
  const [remembered, setRemembered] = useState(false);
  // The last choice for "also apply" is the default next time, per session.
  if (!remembered) {
    setRemembered(true);
    try {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(REMEMBER_KEY) === "1") setAlsoRemainingState(true);
    } catch {
      /* storage blocked: default stays off */
    }
  }
  const setAlsoRemaining = (v: boolean) => {
    setAlsoRemainingState(v);
    try {
      window.sessionStorage.setItem(REMEMBER_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const byId = useMemo(() => new Map(assignments.map((a) => [a.id, a] as const)), [assignments]);
  const tempSeq = useRef(-1);

  const fieldValue = (id: number, key: FieldKey) => draft.fields[id]?.[key] ?? byId.get(id)?.fields[key] ?? "";
  const customValue = (id: number, columnId: number) => draft.custom[id]?.[columnId] ?? byId.get(id)?.custom[columnId] ?? "";
  const labelValue = draft.label ?? label;
  const restValue = draft.rest ?? isRest;
  const isRemoved = (id: number) => draft.removed.includes(id);
  const baseOrder = useMemo(() => assignments.map((a) => a.id), [assignments]);
  const order = (draft.order ?? baseOrder).filter((id) => !draft.removed.includes(id) && byId.has(id));
  const hasExercises = order.length > 0 || draft.added.length > 0;

  // Edits that land back on the saved value fall out of the draft again, so
  // typing 9 then 10 on a field that was 10 counts as no change.
  const setField = (id: number, key: FieldKey, value: string) =>
    setDraft((d) => {
      const saved = byId.get(id)?.fields[key] ?? "";
      const next = { ...(d.fields[id] ?? {}) };
      if (value === saved) delete next[key];
      else next[key] = value;
      const fields = { ...d.fields };
      if (Object.keys(next).length === 0) delete fields[id];
      else fields[id] = next;
      return { ...d, fields };
    });
  const setCustom = (id: number, columnId: number, value: string) =>
    setDraft((d) => {
      const saved = byId.get(id)?.custom[columnId] ?? "";
      const next = { ...(d.custom[id] ?? {}) };
      if (value === saved) delete next[columnId];
      else next[columnId] = value;
      const custom = { ...d.custom };
      if (Object.keys(next).length === 0) delete custom[id];
      else custom[id] = next;
      return { ...d, custom };
    });
  const remove = (id: number) => setDraft((d) => (d.removed.includes(id) ? d : { ...d, removed: [...d.removed, id] }));
  const restore = (id: number) => setDraft((d) => ({ ...d, removed: d.removed.filter((x) => x !== id) }));
  const add = (ex: Omit<NewExercise, "tempId">) =>
    setDraft((d) => ({ ...d, added: [...d.added, { ...ex, tempId: tempSeq.current-- }] }));
  const unadd = (tempId: number) => setDraft((d) => ({ ...d, added: d.added.filter((a) => a.tempId !== tempId) }));
  const setAddedField = (tempId: number, key: FieldKey, value: string) =>
    setDraft((d) => ({ ...d, added: d.added.map((a) => (a.tempId === tempId ? { ...a, fields: { ...a.fields, [key]: value } } : a)) }));
  const setOrder = (ids: number[]) =>
    setDraft((d) => {
      const same = ids.length === baseOrder.length && ids.every((id, i) => id === baseOrder[i]);
      return { ...d, order: same ? null : ids };
    });
  const setLabel = (v: string) => setDraft((d) => ({ ...d, label: v === label ? null : v }));
  const setRest = (v: boolean) => setDraft((d) => ({ ...d, rest: v === isRest ? null : v }));

  // One line per exercise, whatever was touched on it; then structure.
  const entries = useMemo(() => {
    const out: string[] = [];
    for (const a of assignments) {
      if (draft.removed.includes(a.id)) {
        out.push(`${a.exerciseName} removed`);
        continue;
      }
      const parts: string[] = [];
      const f = draft.fields[a.id] ?? {};
      (Object.keys(f) as FieldKey[]).forEach((k) => {
        parts.push(k === "notes" ? "note changed" : `${FIELD_LABEL[k]} ${show(a.fields[k])} → ${show(f[k] ?? "")}`);
      });
      const c = draft.custom[a.id] ?? {};
      Object.keys(c).forEach((colId) => {
        const col = columns.find((x) => x.id === Number(colId));
        parts.push(`${col?.label ?? "value"} ${show(a.custom[Number(colId)] ?? "")} → ${show(c[Number(colId)])}`);
      });
      if (parts.length) out.push(`${a.exerciseName}: ${parts.join(", ")}`);
    }
    draft.added.forEach((n) => out.push(`${n.exerciseName} added`));
    if (draft.order) {
      // One entry for the reorder, named after the row that travelled
      // furthest: dragging one row displaces its neighbours too, and
      // listing each of those would triple-count a single drag.
      const kept = baseOrder.filter((id) => !draft.removed.includes(id));
      let best: { id: number; to: number; dist: number } | null = null;
      draft.order.forEach((id, i) => {
        const dist = Math.abs(kept.indexOf(id) - i);
        if (dist > 0 && (!best || dist > best.dist)) best = { id, to: i, dist };
      });
      const moved = best as { id: number; to: number; dist: number } | null;
      const a = moved ? byId.get(moved.id) : undefined;
      if (moved && a) out.push(`${a.exerciseName} moved to #${moved.to + 1}`);
    }
    if (draft.label != null) out.push(draft.label ? `Session renamed to "${draft.label}"` : "Session label cleared");
    if (draft.rest != null) out.push(`${dayName} → ${draft.rest ? "Rest day" : "Workout"}`);
    return out;
  }, [draft, assignments, columns, dayName, baseOrder, byId]);
  const count = entries.length;

  const discard = useCallback(() => {
    setDraft(EMPTY);
    setStatus("idle");
    setError(null);
  }, []);

  const apply = useCallback(async () => {
    if (count === 0 || status === "applying") return;
    setStatus("applying");
    setError(null);
    const payload: DayChangesPayload = {
      programDayId: dayId,
      alsoRemaining: alsoRemaining && remainingCount > 0,
      label: draft.label,
      rest: draft.rest,
      fields: Object.fromEntries(Object.entries(draft.fields).map(([id, f]) => [id, f])),
      custom: Object.fromEntries(Object.entries(draft.custom).map(([id, c]) => [id, Object.fromEntries(Object.entries(c))])),
      removed: draft.removed,
      added: draft.added.map((n) => ({ exerciseId: n.exerciseId, fields: n.fields })),
      order: draft.order ? order : null,
    };
    const result = await applyDayChangesAction(payload);
    if (!result.ok) {
      setStatus("failed");
      setError(result.error);
      return;
    }
    setDraft(EMPTY);
    setStatus("idle");
    setNotice(result.skipped.length ? `Applied · skipped ${result.skipped.map((w) => `${w} (logged)`).join(", ")}` : null);
  }, [count, status, dayId, alsoRemaining, remainingCount, draft, order]);

  // Cmd/Ctrl+S applies, Esc discards (asking first past three changes).
  useEffect(() => {
    if (count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void apply();
      } else if (e.key === "Escape") {
        if (count > 3 && !window.confirm(`Discard ${count} changes to ${dayName}?`)) return;
        discard();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count, apply, discard, dayName]);

  // The "applied, skipped …" note lingers a few seconds after the bar goes.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const value: Ctx = {
    dayId,
    dayName,
    weekLabel,
    remainingCount,
    remainingLabel,
    columns,
    assignments,
    draft,
    count,
    entries,
    status,
    error,
    notice,
    alsoRemaining,
    setAlsoRemaining,
    fieldValue,
    customValue,
    labelValue,
    restValue,
    hasExercises,
    order,
    isRemoved,
    setField,
    setCustom,
    remove,
    restore,
    add,
    unadd,
    setAddedField,
    setOrder,
    setLabel,
    setRest,
    apply,
    discard,
  };

  return <PendingContext.Provider value={value}>{children}</PendingContext.Provider>;
}

// The bar itself: count, what's changing, and the controls.
export function PendingChangesBar() {
  const p = usePendingDay();
  const [expanded, setExpanded] = useState(false);
  // The pill re-mounts (and so re-runs its pulse) whenever a change is
  // added: the key climbs with the count and holds when it falls.
  const [seen, setSeen] = useState({ count: 0, key: 0 });
  const count = p?.count ?? 0;
  if (count !== seen.count) setSeen({ count, key: count > seen.count ? seen.key + 1 : seen.key });
  if (!p) return null;

  if (p.count === 0) {
    return p.notice ? <div className="pb-pending-notice">{p.notice}</div> : null;
  }

  const shown = expanded ? p.entries : p.entries.slice(0, 2);
  const more = p.entries.length - shown.length;
  const failed = p.status === "failed";

  return (
    <div className={`pb-pending${failed ? " failed" : ""}`} role="status" aria-live="polite">
      <span key={seen.key} className="pb-pending-count pulse">
        {p.count} change{p.count === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        className={`pb-pending-summary${expanded ? " expanded" : ""}`}
        onClick={() => setExpanded((e) => !e)}
        title={expanded ? "Collapse" : "Show every change"}
      >
        {expanded ? (
          <span className="pb-pending-list">
            {p.entries.map((e, i) => (
              <span key={i}>{e}</span>
            ))}
          </span>
        ) : (
          <>
            {shown.join(" · ")}
            {more > 0 && <span className="pb-pending-more"> +{more} more</span>}
          </>
        )}
      </button>
      <div className="pb-pending-right">
        {failed ? (
          <span className="pb-pending-status">Couldn&rsquo;t save{p.error ? ` · ${p.error}` : ""}</span>
        ) : (
          <span className="pb-pending-status">
            {p.status === "applying" ? "Saving…" : "Unsaved"} · {p.weekLabel}
          </span>
        )}
        <button type="button" className="pb-pending-ghost" onClick={p.discard} disabled={p.status === "applying"}>
          Discard
        </button>
        {p.remainingCount > 0 && (
          <label className="pb-pending-also">
            <input type="checkbox" checked={p.alsoRemaining} onChange={(e) => p.setAlsoRemaining(e.target.checked)} />
            <span>Also apply to {p.remainingLabel}</span>
          </label>
        )}
        <button type="button" className="pb-pending-apply" onClick={p.apply} disabled={p.status === "applying"}>
          {failed ? "Retry" : p.status === "applying" ? "Applying…" : "Apply"}
        </button>
      </div>
    </div>
  );
}

// Trash on an exercise row: queues the removal rather than deleting.
export function PendingRemoveButton({ assignmentId, exerciseName }: { assignmentId: number; exerciseName: string }) {
  const p = usePendingDay();
  if (!p) return null;
  return (
    <button
      type="button"
      className="row-icon-btn row-icon-danger"
      aria-label={`Remove ${exerciseName}`}
      title="Remove (applies with the other changes)"
      onClick={() => p.remove(assignmentId)}
    >
      <TrashIcon />
    </button>
  );
}
