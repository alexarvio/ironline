// A fold near the top of a screen opens without laying the page out every frame (27 Oct, Alex: "still quite laggy";
// docs/DESIGN-RULES.md §7): the fold takes its room at once, and everything under it slides from where it was by a
// transform alone, on the phone's graphics chip. Call it with the fold's height from before the change, right after the
// change is drawn (flushSync). Everything after `el` moves, at every level up to `root` (not `root`'s own neighbours),
// leaving fixed things (the tab bar) where they are.
export function slideBelow(el: HTMLElement, before: number, root?: HTMLElement | null) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const shift = before - el.getBoundingClientRect().height;
  if (!shift) return;
  const below: HTMLElement[] = [];
  for (let at: HTMLElement | null = el; at && at !== root && at !== document.body; at = at.parentElement) {
    for (let n = at.nextElementSibling; n; n = n.nextElementSibling) {
      if (n instanceof HTMLElement && getComputedStyle(n).position !== "fixed") below.push(n);
    }
    if (!root) break;
  }
  for (const n of below) {
    n.style.transition = "none";
    // translate, not transform: a card that has a transform of its own keeps it.
    n.style.translate = `0 ${shift}px`;
    n.style.willChange = "translate";
  }
  // Read once so the start is drawn, then let go: it eases back to its own place (no frame callback to wait on).
  void el.offsetHeight;
  for (const n of below) {
    n.style.transition = "translate 0.34s cubic-bezier(0.22, 1, 0.36, 1)";
    n.style.translate = "";
  }
  setTimeout(() => {
    for (const n of below) {
      n.style.transition = "";
      n.style.willChange = "";
    }
  }, 400);
}
