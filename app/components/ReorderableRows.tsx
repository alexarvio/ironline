"use client";

import { ReactNode, useState } from "react";
import { applyDayOrderToLaterWeeksAction, reorderAssignmentsAction } from "../lib/actions";
import { FieldKey, usePendingDay } from "./DayPending";
import { useRowDrag } from "./useRowDrag";

// The exercise rows of one programme day, reorderable by dragging the grip
// at the left of a row. The cells themselves are rendered on the server and
// handed in per row; this owns only the order.
//
// The drag itself is useRowDrag, shared with the session's cardio rows.
//
// Inside a day card (pending-changes provider present) a drop only queues
// the new order on the bar; rows the coach has removed are hidden and
// exercises they have added appear at the foot, all until Apply. Without a
// provider the old behaviour stands: commit at once and offer the order to
// the later weeks.
export default function ReorderableRows({
  programDayId,
  rows,
  footer,
  remainingWeeks,
  columnCount,
}: {
  programDayId: number;
  rows: { id: number; cells: ReactNode }[];
  /** The add-exercise row, kept at the bottom and not draggable. */
  footer: ReactNode;
  /** Later weeks of the programme the new order could be pushed onto. */
  remainingWeeks: number;
  /** Cells per row, so the offer row can span the table. */
  columnCount: number;
}) {
  const pending = usePendingDay();
  // The last order the coach chose here; reconciled against the rows the
  // server currently has, so an exercise added or removed elsewhere shows up
  // without an effect: kept rows stay in the chosen order, new ones go last.
  const [chosen, setChosen] = useState<number[]>([]);
  const ids = rows.map((r) => r.id);
  const order = pending
    ? pending.order.filter((id) => ids.includes(id))
    : [...chosen.filter((id) => ids.includes(id)), ...ids.filter((id) => !chosen.includes(id))];
  const byId = new Map(rows.map((r) => [r.id, r] as const));

  // After a drop, offer the same order to the later weeks; "applied" once
  // taken up, cleared by the next drag.
  const [offer, setOffer] = useState<"none" | "offer" | "applying" | "applied">("none");
  const { dragging, liftedIndex, shiftFor, rowRef, grip } = useRowDrag(
    order,
    (next, moved) => {
      if (pending) {
        pending.setOrder(next, moved);
      } else {
        setChosen(next);
        void reorderAssignmentsAction(programDayId, next);
        if (remainingWeeks > 0) setOffer("offer");
      }
    },
    () => setOffer("none")
  );

  return (
    <tbody className={dragging ? "pb-reordering" : undefined}>
      {order.map((id, index) => {
        const row = byId.get(id);
        if (!row) return null;
        const lifted = liftedIndex === index;
        return (
          <tr key={id} ref={rowRef(id)} className={`pb-row${lifted ? " lifted" : ""}`} style={{ transform: shiftFor(index) }}>
            <td className="pb-grip-cell">
              <span className="pb-grip" title="Drag to reorder" aria-hidden="true" {...grip(index)}>
                ⋮⋮
              </span>
            </td>
            {row.cells}
          </tr>
        );
      })}
      {/* Exercises added on the bar: a full row like any other, with its
          targets editable in place, until Apply makes it real. The bar is
          what says it is not saved yet; the row itself does not nag. */}
      {pending?.draft.added.map((n) => {
        const field = (key: FieldKey, props: { type?: "text" | "number"; step?: string; min?: number; placeholder?: string }) => (
          <input {...props} value={n.fields[key]} onChange={(e) => pending.setAddedField(n.tempId, key, e.target.value)} />
        );
        return (
          <tr key={`new-${n.tempId}`} className="pb-row pb-row-new">
            <td className="pb-grip-cell" aria-hidden="true"></td>
            <td className="exercise-name-cell">
              <div className="pb-exercise-title">
                <span className="pb-row-new-name">{n.exerciseName}</span>
              </div>
            </td>
            {pending.columns.map((col) => {
              if (col.kind === "custom") return <td key={col.id}></td>;
              switch (col.key) {
                case "sets":
                  return <td key={col.id}>{field("sets", { type: "number", min: 1 })}</td>;
                case "reps":
                  return <td key={col.id}>{field("reps", { type: "text" })}</td>;
                case "weight_goal":
                  return <td key={col.id}>{field("targetWeight", { type: "number", step: "0.5" })}</td>;
                case "rpe":
                  return <td key={col.id}>{field("rpe", { type: "number", step: "0.5" })}</td>;
                case "tempo":
                  return <td key={col.id}>{field("tempo", { type: "text" })}</td>;
                case "rest":
                  return <td key={col.id}>{field("rest", { type: "text" })}</td>;
                case "distance":
                  return <td key={col.id}>{field("distance", { type: "text" })}</td>;
                case "time":
                  return <td key={col.id}>{field("time", { type: "text" })}</td>;
                case "notes":
                  return <td key={col.id}>{field("notes", { type: "text", placeholder: "Add a note" })}</td>;
                default:
                  return <td key={col.id}>–</td>;
              }
            })}
            <td className="logged-col">
              <div className="pb-cell-end">
                <div className="pb-cell-main" />
                <button type="button" className="row-icon-btn" aria-label={`Undo adding ${n.exerciseName}`} title="Undo" onClick={() => pending.unadd(n.tempId)}>
                  ×
                </button>
              </div>
            </td>
          </tr>
        );
      })}
      {offer !== "none" && (
        <tr className="pb-order-offer-row">
          <td colSpan={columnCount + 1}>
            <div className="pb-order-offer">
              {offer === "applied" ? (
                <span>Order applied to the {remainingWeeks} remaining week{remainingWeeks === 1 ? "" : "s"}.</span>
              ) : (
                <>
                  <span>Order saved for this week.</span>
                  <button
                    type="button"
                    className="pb-toolbar-btn"
                    disabled={offer === "applying"}
                    onClick={async () => {
                      setOffer("applying");
                      await applyDayOrderToLaterWeeksAction(programDayId);
                      setOffer("applied");
                    }}
                  >
                    {offer === "applying" ? "Applying…" : `Also apply to the ${remainingWeeks} remaining week${remainingWeeks === 1 ? "" : "s"}`}
                  </button>
                  <button type="button" className="pb-order-offer-dismiss" onClick={() => setOffer("none")} aria-label="Dismiss">
                    ×
                  </button>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
      {footer}
    </tbody>
  );
}
