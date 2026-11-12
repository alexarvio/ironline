"use client";

import { useCallback, useEffect, useRef } from "react";

// Holding a chat message opens its menu, in every chat (docs/DESIGN-RULES.md §9: "on a phone, holding the message
// too"). The coach's phone had it on its own (ChatThread); the client's chat had none, so it is one hook for both.
// A hold of HOLD_MS without moving opens it, with a finger or a pen; never with a mouse (pressing and pausing before
// selecting words is no hold). A move past a few pixels, a scroll, lifting the finger or the browser taking the touch
// for a pan lets it go. A right click opens it at once on a computer, except on a link, a picture, a video or words
// selected in the bubble, where the browser's own menu is wanted (Save image as, Copy). The click a finished hold
// leaves behind is swallowed, so a hold on a photo never opens the photo as well; a plain tap does what it did.
// Only what is really inside the bubble counts: a full-screen photo or video drawn from it through a portal (its
// events still pass through the bubble in React's tree) is left to the browser.

export const HOLD_MS = 450;
const SLOP_PX = 8;
/** How long after the finger lifts the click it leaves behind is still the hold's. */
const RELEASE_MS = 400;

/** Where a mouse's right click keeps the browser's own menu. */
const NATIVE_MENU = "a[href], img, video, audio";

/** Whether the event happened inside the bound element on the page, not in a portal drawn from it. */
const inside = (e: React.SyntheticEvent<HTMLElement>) => e.currentTarget.contains(e.target as Node);

export function useHoldPress({ ms = HOLD_MS, ignore }: { ms?: number; /** Presses starting inside this (the menu itself) never start a hold. */ ignore?: string } = {}) {
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  /** True from a hold's opening until the click it leaves behind, or a moment after the finger lifts. */
  const held = useRef(false);
  /** The kind of pointer pressed now ("touch", "pen", "mouse"), null once it is up. */
  const down = useRef<string | null>(null);
  const releaseTimer = useRef<number | null>(null);

  // Takes off the scroll listener a press added.
  const scrollOff = useRef<(() => void) | null>(null);
  const cancel = useCallback(() => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
    scrollOff.current?.();
    scrollOff.current = null;
  }, []);
  const clearRelease = useCallback(() => {
    if (releaseTimer.current != null) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
  }, []);
  // The finger is up: the hold's click comes now or never, so held never outlives it (a keyboard's Enter later is its own).
  const release = useCallback(() => {
    cancel();
    down.current = null;
    if (!held.current) return;
    clearRelease();
    releaseTimer.current = window.setTimeout(() => {
      releaseTimer.current = null;
      held.current = false;
    }, RELEASE_MS);
  }, [cancel, clearRelease]);
  useEffect(
    () => () => {
      cancel();
      clearRelease();
    },
    [cancel, clearRelease],
  );

  const ignored = (e: React.SyntheticEvent<HTMLElement>) => !!ignore && !!(e.target as Element | null)?.closest?.(ignore);

  const bind = (onHold: (el: HTMLElement) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (!inside(e)) return;
      clearRelease();
      held.current = false;
      down.current = e.pointerType || "mouse";
      if (e.button !== 0 || e.pointerType === "mouse") return;
      if (ignored(e)) return;
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
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      if (!inside(e) || ignored(e)) return;
      const finger = down.current != null && down.current !== "mouse";
      if (!finger) {
        // A right click on a link, a picture or a video, or on words selected in the bubble: the browser's own menu.
        if ((e.target as Element | null)?.closest?.(NATIVE_MENU)) return;
        const sel = window.getSelection?.();
        if (sel && !sel.isCollapsed && sel.anchorNode && e.currentTarget.contains(sel.anchorNode)) return;
      }
      e.preventDefault();
      // A phone's own long press arrives here too, after the timer has opened it: nothing more to do.
      if (held.current) return;
      cancel();
      // Only a finger still down leaves a click behind to swallow; a right click leaves none.
      if (finger) held.current = true;
      onHold(e.currentTarget);
    },
    // The tap a finished hold leaves behind does nothing: no photo opening, no link followed.
    onClickCapture: (e: React.MouseEvent<HTMLElement>) => {
      if (!held.current || !inside(e)) return;
      // A click from the keyboard (Enter, Space) is never a hold's.
      if (e.detail === 0) {
        held.current = false;
        clearRelease();
        return;
      }
      // Wherever it lands, the menu just opened under the finger too: a real tap on the menu comes with its own
      // pointerdown first, which has let held go.
      held.current = false;
      clearRelease();
      e.preventDefault();
      e.stopPropagation();
    },
  });

  return { bind, held };
}
