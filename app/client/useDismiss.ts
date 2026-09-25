"use client";

import { useEffect, useRef } from "react";

// Closes an open ⋯ menu on a tap anywhere outside it, or when anything
// scrolls. The see-through scrim behind the workout menus only covers part
// of the page and scrolls away with it, so a tap elsewhere used to leave the
// menu open. The menu itself (.wo-menu) and its own ⋯ button (aria-expanded,
// which toggles it) are left alone.
export function useDismiss(open: boolean, close: () => void) {
  // The latest close, so callers can pass a plain arrow function.
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest(".wo-menu, [aria-expanded]")) return;
      closeRef.current();
    };
    const onScroll = () => closeRef.current();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);
}
