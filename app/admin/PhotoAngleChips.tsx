"use client";

import { useRef, useState, useTransition } from "react";
import { reorderPhotoSlotsAction } from "../lib/actions";
import PhotoSlotRow from "./PhotoSlotRow";

type Slot = { id: number; label: string; paused: boolean };

// The angle chips in the order the sheet asks for them. Dragging a chip over
// another slides it into that place, and the new order is saved on drop.
export default function PhotoAngleChips({ clientId, slots }: { clientId: number; slots: Slot[] }) {
  const ids = slots.map((s) => s.id);
  const [order, setOrder] = useState<number[]>(ids);
  const [dragId, setDragId] = useState<number | null>(null);
  const dragging = useRef<number | null>(null);
  const [, startSaving] = useTransition();

  // Angles added or removed since the last drag join or leave the local order.
  const shown = [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))];
  const byId = new Map(slots.map((s) => [s.id, s] as const));

  const over = (targetId: number) => {
    const moving = dragging.current;
    if (moving == null || moving === targetId) return;
    const next = shown.filter((id) => id !== moving);
    next.splice(shown.indexOf(targetId), 0, moving);
    if (next.join() !== shown.join()) setOrder(next);
  };

  const finish = () => {
    if (dragging.current == null) return;
    dragging.current = null;
    setDragId(null);
    if (shown.join() !== ids.join()) {
      const final = shown;
      startSaving(async () => {
        await reorderPhotoSlotsAction(clientId, final);
      });
    }
  };

  return (
    <>
      {shown.map((id) => {
        const slot = byId.get(id);
        if (!slot) return null;
        return (
          <PhotoSlotRow
            key={id}
            slot={slot}
            dragging={dragId === id}
            dragProps={{
              draggable: slots.length > 1,
              onDragStart: (e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(id));
                dragging.current = id;
                setDragId(id);
              },
              onDragOver: (e) => {
                if (dragging.current == null) return;
                e.preventDefault();
                over(id);
              },
              onDrop: (e) => {
                e.preventDefault();
                finish();
              },
              onDragEnd: finish,
            }}
          />
        );
      })}
    </>
  );
}
