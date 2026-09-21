"use client";

import { useRef, useState } from "react";

// Dragging table rows into a new order by the grip at their left, shared by
// a session's exercise rows and its cardio rows so both handle the same.
//
// Pointer-driven rather than HTML5 drag-and-drop, so it looks like picking
// the row up: the grabbed row lifts and follows the pointer, and the rows it
// passes slide out of its way. On release the new order is handed to
// `onDrop` with the id of the row that moved; the caller decides what a
// drop means (queue it on the pending bar, or save it).
export function useRowDrag(order: number[], onDrop: (next: number[], movedId: number) => void, onBegin?: () => void) {
  // `from` is the grabbed row's index in `order`, `to` is where it currently
  // sits, `dy` is how far the pointer has moved.
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; height: number } | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const startY = useRef(0);
  const mids = useRef<number[]>([]);

  const begin = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    onBegin?.();
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
      onDrop(next, moved);
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

  const rowRef = (id: number) => (el: HTMLTableRowElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };

  /** Props for the grip in a row's first cell. */
  const grip = (index: number) => ({
    onPointerDown: (e: React.PointerEvent) => begin(e, index),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  });

  return { dragging: drag != null, liftedIndex: drag?.from ?? null, shiftFor, rowRef, grip };
}
