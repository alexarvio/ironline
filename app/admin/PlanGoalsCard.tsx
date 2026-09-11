"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { removeClientGoalAction, toggleClientGoalAction } from "../lib/actions";
import type { GoalEditorOptions, PlanGoalRow } from "../lib/queries";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import { GoalEditor } from "./GoalsPanel";

// The goals card on the Plan tab: every goal as a table row with its live
// standing, progress and where it was set. One list per client; the
// Meetings tab and the client's Home read the same goals.

const KIND_PILL: Record<PlanGoalRow["kind"], { label: string; bg: string; fg: string }> = {
  metric: { label: "Metric", bg: "#dff3ea", fg: "#0f5c46" },
  exercise: { label: "Exercise", bg: "#e6e4fa", fg: "#3a3390" },
  habit: { label: "Habit", bg: "#efede6", fg: "#4a4a45" },
  none: { label: "—", bg: "#eef0f3", fg: "#8b93a1" },
};

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
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
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const open = goals.filter((g) => !g.done).length;
  const done = goals.length - open;
  const rows = goals.filter((g) => (filter === "all" ? true : filter === "done" ? g.done : !g.done));
  const current = typeof editing === "number" ? goals.find((g) => g.id === editing) ?? null : null;

  return (
    <section className="pl-card">
      <div className="pl-band">
        <div className="pl-band-left">
          <div className="pl-eyebrow">Goals</div>
          <div className="pl-summary-line">
            {open} open · {done} done
            <span className="pl-summary-tail">
              {nextReview ? (
                <>
                  {" "}
                  · next review {fmtDay(nextReview.date)} with the {nextReview.topic}
                </>
              ) : (
                <>
                  {" "}
                  · no review booked —{" "}
                  <a href={`/admin?client=${clientId}&tab=meetings`} className="pl-band-link">
                    schedule a meeting
                  </a>
                </>
              )}
            </span>
          </div>
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
        {rows.map((g) => {
          const dotClass = g.done ? "done" : g.kind === "none" ? "hollow" : g.tone === "orange" ? "orange" : "green";
          const pill = KIND_PILL[g.kind];
          return (
            <div key={g.id} className={`pl-tr${g.done ? " is-done" : ""}`}>
              <span className="pl-td-dot">
                {g.kind === "none" ? (
                  <form action={toggleClientGoalAction}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="done" value={(!g.done).toString()} />
                    <button type="submit" className={`pl-dot ${dotClass} clickable`} aria-label={g.done ? "Mark not done" : "Mark done"} title={g.done ? "Mark not done" : "Mark done"} />
                  </form>
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
          );
        })}
        <div className="pl-tfoot">Linked goals update themselves from check-ins and logged sets. Text-only goals are closed by hand — tick the dot.</div>
      </div>

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
