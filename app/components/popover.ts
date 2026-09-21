// Where a popup goes, for every menu in the coach admin that hangs off a
// trigger.
//
// Three ways these break, and all three have bitten us:
//
//   1. An absolutely-positioned menu is clipped by an ancestor that scrolls.
//      `.ad-main` sets overflow-y: auto, and CSS will not let one axis
//      scroll while the other stays visible — overflow-x computes to auto
//      too — so the whole working column clips anything reaching past its
//      edge. The Client gyms menu lost its left half to this.
//   2. A fixed menu is not clipped, but nothing stops it running off the
//      bottom of the window either, and there is no scrolling back to it.
//      The exercise picker sits on the LAST row of a day's table, so it was
//      usually opening into the few inches left below the fold.
//   3. Flipping above the trigger by subtracting the MAXIMUM height. A menu
//      is only as tall as its contents — a search box and one group is about
//      200px — so subtracting a 420px cap put a short list 200px above where
//      it belonged, and it read as jumping to the top of the screen.
//
// So: position fixed (beats 1), measured and clamped against the viewport
// (beats 2), and when it opens upward it is the popup's BOTTOM edge that is
// pinned just above the trigger (beats 3). Anchoring the bottom means the
// height does not need to be known in advance — whatever the list turns out
// to be, it grows away from the trigger, not toward it.

export type Placement = {
  /** Set when the popup opens downward. */
  top?: number;
  /** Set instead when it opens upward, so its height need not be known. */
  bottom?: number;
  left: number;
  maxHeight: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export function placePopover(
  trigger: HTMLElement | null,
  {
    width,
    maxHeight = 420,
    /** Which edge of the popup lines up with the same edge of the trigger. */
    align = "left",
    gap = 4,
    margin = 12,
    /** Never squeeze below this; it scrolls inside instead. */
    minHeight = 160,
  }: { width: number; maxHeight?: number; align?: "left" | "right"; gap?: number; margin?: number; minHeight?: number }
): Placement | null {
  if (!trigger) return null;
  const r = trigger.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - margin;
  const above = r.top - margin;
  // Downward unless there is honestly more room up there. Ties go down,
  // which is where a dropdown is expected to be.
  const down = below >= Math.min(maxHeight, above);
  const room = Math.max(0, down ? below : above);
  const height = Math.min(maxHeight, Math.max(minHeight, room), Math.max(0, window.innerHeight - margin * 2));
  const left = clamp(align === "right" ? r.right - width : r.left, margin, window.innerWidth - width - margin);

  if (down) return { top: clamp(r.bottom + gap, margin, window.innerHeight - height - margin), left, maxHeight: height };

  // Upward: pin the bottom edge just over the trigger. The clamp keeps the
  // top edge on screen even when the cap is taller than the room above.
  const bottom = clamp(window.innerHeight - r.top + gap, margin, window.innerHeight - height - margin);
  return { bottom, left, maxHeight: height };
}
