"use client";

import { ReactNode, useRef, useState } from "react";

// A vertical list whose rows can be dragged into a new order by a grip on
// the left, the same feel as the exercise rows in the programme builder:
// the grabbed row lifts and follows the pointer, the rows it passes slide
// out of its way, and the new order is reported on release. The rows
// themselves are handed in; this owns only the order while a drag is in
// flight and the order the coach last chose.
export default function DragList({
  items,
  onReorder,
  className,
}: {
  items: { id: number; node: ReactNode }[];
  /** Called once per drop with the full new order of ids. */
  onReorder: (ids: number[]) => void;
  className?: string;
}) {
  const [chosen, setChosen] = useState<number[]>([]);
  const ids = items.map((i) => i.id);
  const order = [...chosen.filter((id) => ids.includes(id)), ...ids.filter((id) => !chosen.includes(id))];
  const byId = new Map(items.map((i) => [i.id, i] as const));

  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; height: number } | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const startY = useRef(0);
  const mids = useRef<number[]>([]);

  const begin = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    const rects = order.map((id) => rowRefs.current.get(id)?.getBoundingClientRect());
    mids.current = rects.map((r) => (r ? r.top + r.height / 2 : 0));
    setDrag({ from: index, to: index, dy: 0, height: rects[index]?.height ?? 40 });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - startY.current;
    const centre = mids.current[drag.from] + dy;
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
      onReorder(next);
    }
    setDrag(null);
  };
  const shiftFor = (index: number): string | undefined => {
    if (!drag) return undefined;
    if (index === drag.from) return `translateY(${drag.dy}px)`;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return `translateY(-${drag.height}px)`;
    if (drag.to < drag.from && index >= drag.to && index < drag.from) return `translateY(${drag.height}px)`;
    return undefined;
  };

  return (
    <div className={`dl${drag ? " dl-dragging" : ""}${className ? ` ${className}` : ""}`}>
      {order.map((id, index) => {
        const item = byId.get(id);
        if (!item) return null;
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) rowRefs.current.set(id, el);
              else rowRefs.current.delete(id);
            }}
            className={`dl-row${drag?.from === index ? " lifted" : ""}`}
            style={{ transform: shiftFor(index) }}
          >
            {items.length > 1 && (
              <span
                className="dl-grip"
                title="Drag to reorder"
                aria-hidden="true"
                onPointerDown={(e) => begin(e, index)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
              >
                ⋮⋮
              </span>
            )}
            <div className="dl-body">{item.node}</div>
          </div>
        );
      })}
    </div>
  );
}
