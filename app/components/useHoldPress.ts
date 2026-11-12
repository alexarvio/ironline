"use client";

import { useCallback, useEffect, useRef } from "react";

// Holding a chat message opens its menu, in every chat (docs/DESIGN-RULES.md §9: "on a phone, holding the message
// too"). The coach's phone had it on its own (ChatThread); the client's chat had none, so it is one hook for both.
// A hold of HOLD_MS without moving opens it; a move past a few pixels, a scroll, lifting the finger or the browser
// taking the touch for a pan lets it go. A right click opens it at once on a computer. The click a finished hold
// leaves behind is swallowed, so a hold on a photo never opens the photo as well; a plain tap does what it did.

export const HOLD_MS = 450;
const SLOP_PX = 8;

export function useHoldPress({ ms = HOLD_MS, ignore }: { ms?: number; /** Presses starting inside this (the menu itself) never start a hold. */ ignore?: string } = {}) {
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  /** True from a hold's opening until the next press: what a tap on the bubble's parts checks. */
  const held = useRef(false);

  // Takes off the scroll listener a press added.
  const scrollOff = useRef<(() => void) | null>(null);
  const cancel = useCallback(() => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
    scrollOff.current?.();
    scrollOff.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  const bind = (onHold: (el: HTMLElement) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      held.current = false;
      if (e.button !== 0) return;
      if (ignore && (e.target as Element | null)?.closest?.(ignore)) return;
      cancel();
      const el = e.currentTarget;
      const timer = window.setTimeout(() => {
        cancel();
        held.current = true;
        try {
          navigator.vibrate?.(8);
        } catch {}
        onHold(el);
      }, ms);
      hold.current = { timer, x: e.clientX, y: e.clientY };
      // Any scroll while the finger is down (the thread, or the page) is a scroll, never a hold.
      const onScroll = () => cancel();
      window.addEventListener("scroll", onScroll, { capture: true, passive: true });
      scrollOff.current = () => window.removeEventListener("scroll", onScroll, true);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const h = hold.current;
      if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      if (ignore && (e.target as Element | null)?.closest?.(ignore)) return;
      e.preventDefault();
      // A phone's own long press arrives here too, after the timer has opened it: nothing more to do.
      if (held.current) return;
      cancel();
      held.current = true;
      onHold(e.currentTarget);
    },
    // The tap a finished hold leaves behind does nothing: no photo opening, no link followed.
    onClickCapture: (e: React.MouseEvent<HTMLElement>) => {
      if (!held.current) return;
      if (ignore && (e.target as Element | null)?.closest?.(ignore)) return;
      held.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  });

  return { bind, held };
}
