"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { applyGoalDoneChangesAction, removeClientGoalAction, reorderClientGoalsAction } from "../lib/actions";
import type { GoalEditorOptions, PlanGoalRow } from "../lib/queries";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import DragList from "../components/DragList";
import { GoalEditor } from "./GoalsPanel";

// The goals card on the Plan tab: every goal as a table row with its live
// standing and where it was set. One list per client; the Meetings tab and
// the client's Home read the same goals, in the order the coach drags them
// into here.

// What a goal tracks. A kind, not a status, so it is always grey.
const KIND_LABEL: Record<PlanGoalRow["kind"], string> = {
  metric: "Metric",
  exercise: "Exercise",
  habit: "Habit",
  none: "Text",
};

const dayMonth = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function PlanGoalsCard({
  clientId,
  clientName,
  currentPhaseName,
  goals,
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
      <div className="pl-card-head">
        <div className="pl-card-titles">
          <span className="pl-eyebrow">Goals</span>
          <span className="pl-helper">Set in meetings · linked goals update themselves</span>
        </div>
        <div className="pl-card-tools">
          <div className="pl-seg" role="radiogroup" aria-label="Which goals to show">
            {(["open", "done", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                className={`pl-seg-btn${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "open" ? "Open" : f === "done" ? "Done" : "All"}
              </button>
            ))}
          </div>
          <button type="button" className="pl-btn navy" onClick={() => setEditing("new")}>
            Add goal
          </button>
        </div>
      </div>

      <div className="pl-goals-scroll">
        <div className="pl-goals">
          <div className="pl-goals-head">
            <span />
            <span>Goal</span>
            <span>Tracks</span>
            <span>Live</span>
            <span>Set in</span>
            <span>By</span>
            <span />
          </div>
          {rows.length === 0 && (
            <div className="pl-goals-empty">{filter === "done" ? "Nothing closed yet." : "No goals yet. Add the first one."}</div>
          )}
          <DragList
            key={dragKey}
            className="pl-draglist"
            onReorder={(ids) => setPendingOrder(ids)}
            items={rows.map((g) => {
              const isDone = doneOf(g);
              const queued = pendingDone[g.id] != null;
              const textOnly = g.kind === "none";
              return {
                id: g.id,
                node: (
                  <div className={`pl-goal-row${isDone ? " is-done" : ""}${queued ? " is-queued" : ""}`}>
                    <span className="pl-goal-status">
                      {textOnly ? (
                        <label className="pl-check" title={isDone ? "Mark not done" : "Mark done"}>
                          <input type="checkbox" checked={isDone} onChange={() => toggleDone(g)} aria-label={isDone ? "Mark not done" : "Mark done"} />
                          <span className="pl-check-box" aria-hidden="true">
                            {isDone ? "✓" : ""}
                          </span>
                        </label>
                      ) : (
                        <span
                          className={`pl-mark ${isDone ? "done" : g.tone === "green" ? "on" : "off"}`}
                          title={isDone ? "Done" : g.tone === "green" ? "On track" : "Not on track yet"}
                        />
                      )}
                    </span>
                    <span className="pl-goal-main">
                      <span className="pl-goal-name">{g.text}</span>
                      <span className="pl-goal-rule">{textOnly ? "Text only · closed by hand" : g.rule}</span>
                    </span>
                    <span>
                      <span className="pl-kind">{KIND_LABEL[g.kind]}</span>
                    </span>
                    <span className={`pl-live ${textOnly ? "none" : g.tone}`}>{textOnly ? "—" : g.live || "—"}</span>
                    <span className="pl-setin">
                      {g.setIn ? (
                        <>
                          <a href={`/admin?client=${clientId}&tab=meetings`} className="pl-setin-link">
                            {g.setIn.topic}
                          </a>
                          <span className="pl-setin-date">{dayMonth(g.setIn.date)}</span>
                        </>
                      ) : (
                        <>
                          <span className="pl-dash">—</span>
                          {g.setDate && <span className="pl-setin-date">Set {dayMonth(g.setDate)}</span>}
                        </>
                      )}
                    </span>
                    <span className="pl-by">{g.by ?? "—"}</span>
                    <span className="pl-goal-actions">
                      <button type="button" className="pl-text-btn" onClick={() => setEditing(g.id)}>
                        Edit
                      </button>
                      <ConfirmDeleteButton
                        action={removeClientGoalAction}
                        hiddenFields={{ id: g.id }}
                        label={`Remove goal: ${g.text}`}
                        text="Remove"
                        textClassName="pl-text-btn danger"
                      />
                    </span>
                  </div>
                ),
              };
            })}
          />
          <p className="pl-goals-foot">
            Drag a row by its grip to change the order the client sees, then Apply. Linked goals update themselves from
            check-ins and logged sets. Text-only goals are closed by hand — tick the box.
          </p>
        </div>
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
