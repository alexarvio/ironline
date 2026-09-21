"use client";

import { ReactNode, useRef, useState, useTransition } from "react";
import { reorderSessionsAction } from "../lib/actions";

// The sessions of one week, reorderable by dragging the grip at the left of
// a session's header. Pointer-driven rather than HTML5 drag-and-drop, the
// same as the exercise rows inside a session: the grabbed card lifts and
// follows the pointer, and the cards it passes slide out of its way.
//
// The cards themselves come from the server; this owns only their order,
// which is saved as soon as the card is dropped.
export default function ReorderableSessions({
  clientId,
  week,
  sessions,
}: {
  clientId: number;
  week: number;
  sessions: { id: number; card: ReactNode }[];
}) {
  // The order chosen here, reconciled against what the server has: a session
  // added or deleted elsewhere shows up without an effect.
  const [chosen, setChosen] = useState<number[]>([]);
  const [, start] = useTransition();
  const ids = sessions.map((s) => s.id);
  const order = [...chosen.filter((id) => ids.includes(id)), ...ids.filter((id) => !chosen.includes(id))];
  const byId = new Map(sessions.map((s) => [s.id, s] as const));

  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; height: number } | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const startY = useRef(0);
  const mids = useRef<number[]>([]);

  const begin = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    // Midpoints at grab time decide when the grabbed card has passed a
    // neighbour; measured once, so layout isn't read on every move.
    const rects = order.map((id) => cardRefs.current.get(id)?.getBoundingClientRect());
    mids.current = rects.map((r) => (r ? r.top + r.height / 2 : 0));
    setDrag({ from: index, to: index, dy: 0, height: rects[index]?.height ?? 80 });
  };

  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - startY.current;
    const y = mids.current[drag.from] + dy;
    let to = drag.from;
    while (to > 0 && y < mids.current[to - 1]) to -= 1;
    while (to < mids.current.length - 1 && y > mids.current[to + 1]) to += 1;
    setDrag({ ...drag, dy, to });
  };

  const end = (e: React.PointerEvent) => {
    if (!drag) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    const { from, to } = drag;
    setDrag(null);
    if (from === to) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setChosen(next);
    start(() => reorderSessionsAction(clientId, week, next));
  };

  // Where a card sits while another is being dragged over it.
  const shift = (index: number) => {
    if (!drag || index === drag.from) return 0;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -drag.height;
    if (drag.from > drag.to && index < drag.from && index >= drag.to) return drag.height;
    return 0;
  };

  return (
    <>
      {order.map((id, index) => {
        const session = byId.get(id);
        if (!session) return null;
        const dragging = drag?.from === index;
        const offset = dragging ? drag.dy : shift(index);
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) cardRefs.current.set(id, el);
              else cardRefs.current.delete(id);
            }}
            className={`pb-session-slot${dragging ? " dragging" : ""}`}
            style={offset ? { transform: `translateY(${offset}px)`, transition: dragging ? "none" : undefined } : undefined}
          >
            <button
              type="button"
              className="pb-session-grip"
              aria-label="Drag to reorder this session"
              title="Drag to reorder"
              onPointerDown={(e) => begin(e, index)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onClick={(e) => e.stopPropagation()}
            >
              <span aria-hidden="true">⠿</span>
            </button>
            {session.card}
          </div>
        );
      })}
    </>
  );
}
