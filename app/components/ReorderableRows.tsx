"use client";

import { ReactNode, useState } from "react";
import { reorderAssignmentsAction } from "../lib/actions";

// The exercise rows of one programme day, reorderable by dragging the grip
// at the left of a row. The cells themselves are rendered on the server and
// handed in per row; this owns only the order. A drop reorders locally at
// once and posts the new order, so the sheet never waits on the round trip.
export default function ReorderableRows({
  programDayId,
  rows,
  footer,
}: {
  programDayId: number;
  rows: { id: number; cells: ReactNode }[];
  /** The add-exercise row, kept at the bottom and not draggable. */
  footer: ReactNode;
}) {
  // The last order the coach chose here; reconciled against the rows the
  // server currently has, so an exercise added or removed elsewhere shows up
  // without an effect: kept rows stay in the chosen order, new ones go last.
  const [chosen, setChosen] = useState<number[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const ids = rows.map((r) => r.id);
  const order = [...chosen.filter((id) => ids.includes(id)), ...ids.filter((id) => !chosen.includes(id))];
  const byId = new Map(rows.map((r) => [r.id, r] as const));

  const drop = (targetId: number) => {
    if (dragging == null || dragging === targetId) return;
    // Take the dragged row's place at the target's position: below it when
    // moving down, above it when moving up.
    const from = order.indexOf(dragging);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, dragging);
    setChosen(next);
    void reorderAssignmentsAction(programDayId, next);
  };

  return (
    <tbody>
      {order.map((id) => {
        const row = byId.get(id);
        if (!row) return null;
        return (
          <tr
            key={id}
            className={`pb-row${dragging === id ? " dragging" : ""}${over === id && dragging !== id ? " drop-target" : ""}`}
            draggable
            onDragStart={(e) => {
              setDragging(id);
              e.dataTransfer.effectAllowed = "move";
              // Firefox needs data set for a drag to start at all.
              e.dataTransfer.setData("text/plain", String(id));
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              if (dragging == null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== id) setOver(id);
            }}
            onDragLeave={() => {
              if (over === id) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(id);
              setDragging(null);
              setOver(null);
            }}
          >
            <td className="pb-grip-cell">
              <span className="pb-grip" title="Drag to reorder" aria-hidden="true">
                ⋮⋮
              </span>
            </td>
            {row.cells}
          </tr>
        );
      })}
      {footer}
    </tbody>
  );
}
