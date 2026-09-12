"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { applyGoalDoneChangesAction, removeClientGoalAction, reorderClientGoalsAction } from "../lib/actions";
import type { GoalEditorOptions, PlanGoalRow } from "../lib/queries";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import DragList from "../components/DragList";
import { GoalEditor } from "./GoalsPanel";

// The goals card on the Plan tab: every goal as a table row with its live
// standing, progress and where it was set. One list per client; the
// Meetings tab and the client's Home read the same goals, in the order
// the coach drags them into here.

const KIND_PILL: Record<PlanGoalRow["kind"], { label: string; bg: string; fg: string }> = {
  metric: { label: "Metric", bg: "#dff3ea", fg: "#0f5c46" },
  exercise: { label: "Exercise", bg: "#e6e4fa", fg: "#3a3390" },
  habit: { label: "Habit", bg: "#efede6", fg: "#4a4a45" },
  none: { label: "—", bg: "#eef0f3", fg: "#8b93a1" },
};

const fmtShort = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short" });

export default function PlanGoalsCard({
  clientId,
  clientName,
  currentPhaseName,
  goals,
  nextReview,
  options,
}: {
  clientId: number;
  clientName: string;
  currentPhaseName: string | null;
  goals: PlanGoalRow[];
  nextReview: { id: number; date: string; topic: string } | null;
  options: GoalEditorOptions;
}) {
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  // Done-ticks queue here and land together from the bar at the foot of
  // the card, the same way edits queue on a programme day.
  const [pendingDone, setPendingDone] = useState<Record<number, boolean>>({});
  // A dragged order waits on the same bar as the done-ticks: nothing about
  // this table saves on its own. Bumping dragKey remounts DragList, which
  // owns the order it is showing, so Discard really does put it back.
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  const [dragKey, setDragKey] = useState(0);
  const [applying, startApply] = useTransition();
  const doneOf = (g: PlanGoalRow) => pendingDone[g.id] ?? g.done;
  const toggleDone = (g: PlanGoalRow) =>
    setPendingDone((p) => {
      const next = { ...p };
      const want = !doneOf(g);
      if (want === g.done) delete next[g.id];
      else next[g.id] = want;
      return next;
    });
  const pendingList = Object.entries(pendingDone).map(([id, done]) => ({ id: Number(id), done }));
  const changeCount = pendingList.length + (pendingOrder ? 1 : 0);
  const discardPending = () => {
    setPendingDone({});
    setPendingOrder(null);
    setDragKey((k) => k + 1);
  };
  const applyPending = () =>
    startApply(async () => {
      if (pendingOrder) await reorderClientGoalsAction(clientId, pendingOrder);
      if (pendingList.length > 0) await applyGoalDoneChangesAction(pendingList);
      setPendingDone({});
      setPendingOrder(null);
      setDragKey((k) => k + 1);
    });
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const open = goals.filter((g) => !g.done).length;
  const done = goals.length - open;
  const visible = goals.filter((g) => (filter === "all" ? true : pendingDone[g.id] != null ? true : filter === "done" ? g.done : !g.done));
  // While an order is queued the table shows it, so the coach sees what
  // Apply will save.
  const rows = pendingOrder
    ? [...visible].sort((a, b) => {
        const ia = pendingOrder.indexOf(a.id);
        const ib = pendingOrder.indexOf(b.id);
        return (ia < 0 ? Number.MAX_SAFE_INTEGER : ia) - (ib < 0 ? Number.MAX_SAFE_INTEGER : ib);
      })
    : visible;
  const current = typeof editing === "number" ? goals.find((g) => g.id === editing) ?? null : null;

  return (
    <section className="pl-card">
      <div className="pl-band">
        <div className="pl-band-left">
          <div className="pl-eyebrow">Goals</div>
        </div>
        <div className="pl-band-right">
          <div className="pl-switch" role="tablist">
            {(["open", "done", "all"] as const).map((f) => (
              <button key={f} type="button" className={`pl-switch-opt${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                {f === "open" ? "Open" : f === "done" ? "Done" : "All"}
              </button>
            ))}
          </div>
          <button type="button" className="pl-primary" onClick={() => setEditing("new")}>
            + Add goal
          </button>
        </div>
      </div>

      <div className="pl-table">
        <div className="pl-thead">
          <span />
          <span>Goal</span>
          <span>Tracks</span>
          <span>Live</span>
          <span>Progress</span>
          <span>Set in</span>
          <span>By</span>
          <span />
        </div>
        {rows.length === 0 && <div className="pl-empty-row">{filter === "done" ? "Nothing closed yet." : "No goals yet. Add the first one."}</div>}
        <DragList
          key={dragKey}
          className="pl-draglist"
          onReorder={(ids) => setPendingOrder(ids)}
          items={rows.map((g) => {
          const isDone = doneOf(g);
          const queued = pendingDone[g.id] != null;
          const dotClass = isDone ? "done" : g.kind === "none" ? "hollow" : g.tone === "orange" ? "orange" : "green";
          const pill = KIND_PILL[g.kind];
          return {
            id: g.id,
            node: (
            <div className={`pl-tr${isDone ? " is-done" : ""}${queued ? " is-queued" : ""}`}>
              <span className="pl-td-dot">
                {g.kind === "none" ? (
                  <label className="pl-check" title={isDone ? "Mark not done" : "Mark done"}>
                    <input type="checkbox" checked={isDone} onChange={() => toggleDone(g)} aria-label={isDone ? "Mark not done" : "Mark done"} />
                    <span className="pl-check-box" aria-hidden="true">{isDone ? "✓" : ""}</span>
                  </label>
                ) : (
                  <span className={`pl-dot ${dotClass}`} />
                )}
              </span>
              <span className="pl-td-goal">
                <span className="pl-goal-text">{g.text}</span>
                <span className="pl-goal-rule">{g.rule}</span>
              </span>
              <span>
                <span className="pl-kind" style={{ background: pill.bg, color: pill.fg }}>
                  {pill.label}
                </span>
              </span>
              <span className={`pl-live ${dotClass}`}>{g.live || (g.done ? "done" : "")}</span>
              <span className="pl-td-progress">
                <span className="pl-progress">
                  <span className={`pl-progress-fill ${dotClass}`} style={{ width: `${Math.max(0, Math.min(100, g.pct))}%` }} />
                </span>
                <span className="pl-pct">{Math.max(0, Math.min(100, g.pct))}%</span>
              </span>
              <span className="pl-td-setin">
                {g.setIn ? (
                  <a href={`/admin?client=${clientId}&tab=meetings`} className="pl-link">
                    {g.setIn.topic}
                  </a>
                ) : (
                  <span className="pl-dash">—</span>
                )}
                {g.setDate && <span className="pl-goal-rule">{fmtShort(g.setDate)}</span>}
              </span>
              <span className="pl-td-by">{g.by ?? "—"}</span>
              <span className="pl-td-tools">
                <button type="button" className="pl-link-btn" onClick={() => setEditing(g.id)}>
                  Edit
                </button>
                <ConfirmDeleteButton action={removeClientGoalAction} hiddenFields={{ id: g.id }} label={`Delete goal: ${g.text}`} />
              </span>
            </div>
            ),
          };
        })}
        />
        <div className="pl-tfoot">Drag a row by its grip to change the order the client sees, then Apply. Linked goals update themselves from check-ins and logged sets. Text-only goals are closed by hand — tick the box.</div>
      </div>

      {changeCount > 0 && (
        <div className="pb-pending pl-pending" role="status" aria-live="polite">
          <span className="pb-pending-count">
            {changeCount} change{changeCount === 1 ? "" : "s"}
          </span>
          <span className="pb-pending-summary">
            {[
              ...(pendingOrder ? ["Order changed"] : []),
              ...pendingList.map((c) => `${goals.find((g) => g.id === c.id)?.text ?? "Goal"} ${c.done ? "marked done" : "reopened"}`),
            ].join(" · ")}
          </span>
          <div className="pb-pending-right">
            <span className="pb-pending-status">{applying ? "Saving…" : "Unsaved"}</span>
            <button type="button" className="pb-pending-ghost" onClick={discardPending} disabled={applying}>
              Discard
            </button>
            <button type="button" className="pb-pending-apply" onClick={applyPending} disabled={applying}>
              {applying ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>
      )}

      {editing != null &&
        createPortal(
          <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
            <div className="pb-modal pl-goal-modal" role="dialog" aria-modal="true" aria-label={current ? "Edit goal" : "New goal"}>
              <GoalEditor
                key={typeof editing === "number" ? editing : "new"}
                clientId={clientId}
                goal={current ? { id: current.id, text: current.text, done: current.done, tracking: current.tracking, label: current.rule, createdAt: current.setDate } : null}
                options={options}
                onClose={() => setEditing(null)}
                heading={{ title: current ? "Edit goal" : "New goal", subtitle: `${clientName}${currentPhaseName ? ` · ${currentPhaseName}` : ""}` }}
              />
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
