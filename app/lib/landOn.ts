// A link's arrival, one way everywhere (24 Oct, Alex: "the id on every message… it is good but not sharp yet"): the
// thing a link or a notification points at is opened by the screen it lives on, then brought to the middle of the
// screen and lit briefly (`.landed`, globals.css: a soft ink tint that fades over 2.4s). Client and coach alike.

export const LANDED_MS = 2400;

/** Brings `el` into view and lights it for a moment. Safe to call with null (nothing there to land on). */
export function landOn(el: Element | null | undefined, block: ScrollLogicalPosition = "center"): void {
  if (!el) return;
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: still ? "auto" : "smooth", block });
  el.classList.remove("landed");
  // A reflow between, so landing on the same thing twice lights it again.
  void (el as HTMLElement).offsetWidth;
  el.classList.add("landed");
  window.setTimeout(() => el.classList.remove("landed"), LANDED_MS);
}

/** landOn once the screen has drawn what it opened (a fold, a portal): the element is looked up a moment later. */
export function landOnSoon(find: () => Element | null | undefined, block: ScrollLogicalPosition = "center", wait = 120): () => void {
  const t = window.setTimeout(() => landOn(find(), block), wait);
  return () => window.clearTimeout(t);
}
