// A link's arrival, one way everywhere (24 Oct, Alex: "the id on every message… it is good but not sharp yet"): the
// thing a link or a notification points at is opened by the screen it lives on, then brought to the middle of the
// screen and lit briefly (`.landed`, globals.css: a soft ink tint that fades over 2.4s). Client and coach alike.

export const LANDED_MS = 2400;
/** The lit tint's corners on a thing with none of its own (6 Nov, Alex: the gyms pop-up lit a square row, "it goes
 *  against the design… we do use quite a lot of rounded corners"); a card or pill keeps its own. */
const LANDED_RADIUS = "12px";
const rounding = new WeakMap<HTMLElement, { inline: string; timer: number }>();

/** Brings `el` into view and lights it for a moment. Safe to call with null (nothing there to land on). */
export function landOn(el: Element | null | undefined, block: ScrollLogicalPosition = "center"): void {
  if (!el) return;
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: still ? "auto" : "smooth", block });
  el.classList.remove("landed");
  // A reflow between, so landing on the same thing twice lights it again.
  void (el as HTMLElement).offsetWidth;
  el.classList.add("landed");
  // Square corners are rounded while it is lit, then given back as they were.
  const box = el as HTMLElement;
  const was = rounding.get(box);
  if (was) window.clearTimeout(was.timer);
  else if (getComputedStyle(box).borderTopLeftRadius === "0px") {
    rounding.set(box, { inline: box.style.borderRadius, timer: 0 });
    box.style.borderRadius = LANDED_RADIUS;
  }
  const round = rounding.get(box);
  if (round)
    round.timer = window.setTimeout(() => {
      box.style.borderRadius = round.inline;
      rounding.delete(box);
    }, LANDED_MS);
  window.setTimeout(() => el.classList.remove("landed"), LANDED_MS);
}

/** landOn once the screen has drawn what it opened (a fold, a portal): the element is looked up a moment later. */
export function landOnSoon(find: () => Element | null | undefined, block: ScrollLogicalPosition = "center", wait = 120): () => void {
  const t = window.setTimeout(() => landOn(find(), block), wait);
  return () => window.clearTimeout(t);
}
