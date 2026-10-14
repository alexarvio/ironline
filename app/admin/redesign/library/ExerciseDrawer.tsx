"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";

// The exercise editor's drawer (14 Oct): a panel sliding in from the right
// over a light scrim, the card grid still readable behind it. The editor
// inside is keyed on the exercise, so switching (prev, next, another card)
// crossfades the content without the panel sliding again. A click on the
// scrim closes it, unless a card sits under the pointer: then that card
// opens instead.

export const DRAWER_WIDTH = 600;

export default function ExerciseDrawer({
  open,
  colour,
  children,
  onClose,
  onCardUnder,
}: {
  open: boolean;
  /** The edited exercise's group colour: the glow. */
  colour: { color: string; rgb: string };
  children: React.ReactNode;
  onClose: () => void;
  /** A click on the scrim landed on a card: its exercise id. */
  onCardUnder: (id: number) => void;
}) {
  // Mounted while open, and for the closing slide after.
  const wasOpen = useRef(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const was = wasOpen.current;
    wasOpen.current = open;
    if (open || !was) return;
    const t1 = setTimeout(() => setClosing(true), 0);
    const t2 = setTimeout(() => setClosing(false), 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open]);
  const shown = open || closing;
  if (!shown) return null;
  return createPortal(
    <>
      <div
        className={`exd-scrim${closing ? " closing" : ""}`}
        role="presentation"
        onClick={(e) => {
          const card = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el instanceof HTMLElement && el.dataset.exerciseId) as HTMLElement | undefined;
          if (card?.dataset.exerciseId) onCardUnder(Number(card.dataset.exerciseId));
          else onClose();
        }}
      />
      <aside className={`exd${closing ? " closing" : ""}`} style={{ "--g": colour.color, "--g-rgb": colour.rgb } as React.CSSProperties} role="dialog" aria-modal="false" aria-labelledby="exd-title">
        <span className="exm-glow" aria-hidden="true" />
        {children}
      </aside>
    </>,
    document.body
  );
}
