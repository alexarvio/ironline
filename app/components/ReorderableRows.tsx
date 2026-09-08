"use client";

import { ReactNode, useRef, useState } from "react";
import { reorderAssignmentsAction } from "../lib/actions";

// The exercise rows of one programme day, reorderable by dragging the grip
// at the left of a row. The cells themselves are rendered on the server and
// handed in per row; this owns only the order.
//
// The drag is pointer-driven rather than HTML5 drag-and-drop, so it looks
// like picking the row up: the grabbed row lifts and follows the pointer,
// and the rows it passes slide out of its way as it goes. On release the
// order is committed locally at once and posted, so the sheet never waits
// on the round trip.
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
  const ids = rows.map((r) => r.id);
  const order = [...chosen.filter((id) => ids.includes(id)), ...ids.filter((id) => !chosen.includes(id))];
  const byId = new Map(rows.map((r) => [r.id, r] as const));

  // Live drag state. `from` is the grabbed row's index in `order`, `to` is
  // where it currently sits, `dy` is how far the pointer has moved.
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; height: number } | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const startY = useRef(0);
  const mids = useRef<number[]>([]);

  const begin = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    // Row midpoints at grab time decide when the grabbed row has passed a
    // neighbour; measured once so layout isn't read on every move.
    const rects = order.map((id) => rowRefs.current.get(id)?.getBoundingClientRect());
    mids.current = rects.map((r) => (r ? r.top + r.height / 2 : 0));
    const height = rects[index]?.height ?? 40;
    setDrag({ from: index, to: index, dy: 0, height });
  };

  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - startY.current;
    const centre = mids.current[drag.from] + dy;
    // The grabbed row lands wherever its centre has crossed to.
    let to = drag.from;
    if (dy < 0) {
      to = mids.current.findIndex((m, i) => i < drag.from && centre < m);
      if (to < 0) to = drag.from;
    } else if (dy > 0) {
      for (let i = order.length - 1; i > drag.from; i--) {
        if (centre > mids.current[i]) {
          to = i;
          break;
        }
      }
    }
    setDrag({ ...drag, dy, to });
  };

  const end = (e: React.PointerEvent) => {
    if (!drag) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (drag.to !== drag.from) {
      const next = [...order];
      const [moved] = next.splice(drag.from, 1);
      next.splice(drag.to, 0, moved);
      setChosen(next);
      void reorderAssignmentsAction(programDayId, next);
    }
    setDrag(null);
  };

  // Where each row sits while a drag is in flight: the grabbed row follows
  // the pointer, the rows between its old and new slots slide one row's
  // height to make room.
  const shiftFor = (index: number): string | undefined => {
    if (!drag) return undefined;
    if (index === drag.from) return `translateY(${drag.dy}px)`;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return `translateY(-${drag.height}px)`;
    if (drag.to < drag.from && index >= drag.to && index < drag.from) return `translateY(${drag.height}px)`;
    return undefined;
  };

  return (
    <tbody className={drag ? "pb-reordering" : undefined}>
      {order.map((id, index) => {
        const row = byId.get(id);
        if (!row) return null;
        const lifted = drag?.from === index;
        return (
          <tr
            key={id}
            ref={(el) => {
              if (el) rowRefs.current.set(id, el);
              else rowRefs.current.delete(id);
            }}
            className={`pb-row${lifted ? " lifted" : ""}`}
            style={{ transform: shiftFor(index) }}
          >
            <td className="pb-grip-cell">
              <span
                className="pb-grip"
                title="Drag to reorder"
                aria-hidden="true"
                onPointerDown={(e) => begin(e, index)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
              >
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
