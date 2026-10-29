"use client";

import { useEffect } from "react";

// ---- Every capsule's pill slides (28 Oct, Alex: "whenever we have a toggle across norcoach the toggle works like
// this one"). A capsule is a row of options with one picked: the picked one's pill eases to the next one picked instead
// of jumping. One place for the whole app, admin, client and the coach's phone: the capsules are listed by their class
// here, and a new one joins by its class or by `data-slide` on its row.
//
// How it works: the row gets `data-pill`, its picked option `data-pill-on`, and the pill is the row's ::before, placed
// by --pill-x/-y/-w/-h (globals.css, "Sliding pills"). The option's own ink is made transparent while the pill is drawn,
// so before this runs (or with it off) every capsule still reads as it always did. A row with no option picked, or more
// than one, keeps its own look and nothing slides.

/** The capsules, by their row. The options are the row's direct children. */
export const SLIDE_ROWS = [
  "[data-slide]",
  // The admin's capsule (rule 5): KG/LBS, the time windows, the phase switcher, Table | Graph… Not Home's Muscle balance
  // windows (.rh-spans): several can be on, each outlined in its own colour, so one on alone is no pill either.
  ".rd-btn-group:not(.rh-spans)",
  // The workout's KG / LBS.
  ".lw-unit",
  // The subscribe screen's Monthly | Yearly (28 Oct).
  ".au-plan-cap",
  // The client app: the check-in's Progress range, the check-in's and Shape update's views over their photo, Add an
  // event's Date range | One day | Repeats, Compare's view, and every chat's Media and files (the coach's phone and the
  // laptop too). Not the rows of separate white chips (the metric chips, Compare's angles, the Events filter, the gym's
  // Type, the food diary's modes): the pill would pass behind the white chips and show only in the gaps.
  ".pg-range",
  ".ci-views",
  ".evs-seg",
  ".pc-cmp-view",
  ".cmg-tabs",
  // The coach's phone: the calendar entry's Timed | All day and Length, the review's speed.
  ".cph-seg",
  ".cph-rate",
  // The admin's other capsules: the client tabs, Training's KG | LBS and Columns, the pop-ups' (.npd, .dlh, the demo
  // video's, a variation's Apply to), the phase switcher's states and the review's speed.
  ".rd-nav",
  ".trn-unit",
  ".rd-coltabs",
  ".npd-seg",
  ".dlh-seg",
  ".dmvh-seg",
  ".vrp-seg",
  ".rd-switch-states",
  ".mrv-rate",
  // Details' and New client's Gender (29 Oct, Alex: it jumped). Only the hairline capsule: the old admin's are chips.
  ".nc-hl .nc-pills",
  ".cc-hl .nc-pills",
].join(", ");

/** What marks the picked option, whichever way the row says it. */
const PICKED = ':scope > [aria-checked="true"], :scope > [aria-selected="true"], :scope > [aria-pressed="true"], :scope > [aria-current="page"], :scope > .on, :scope > .active, :scope > .is-on';

function place(row: HTMLElement) {
  const picked = Array.from(row.querySelectorAll<HTMLElement>(PICKED));
  const on = picked.length === 1 ? picked[0] : null;
  const was = row.querySelector<HTMLElement>(":scope > [data-pill-on]");
  if (!on || on.offsetWidth === 0) {
    // Nothing to slide (none or several picked, or the row not drawn yet): its own look.
    if (was) was.removeAttribute("data-pill-on");
    row.removeAttribute("data-pill");
    return;
  }
  if (getComputedStyle(row).position === "static") row.style.position = "relative";
  // To the fraction of a pixel (halves of a 1fr 1fr row are often 165.5px), in the row's own pixels: `k` undoes a
  // transform or CSS zoom above it (the Phases screen's 86%), and a row that scrolls counts its scroll.
  const r = row.getBoundingClientRect();
  const o = on.getBoundingClientRect();
  const k = r.width / row.offsetWidth || 1;
  row.style.setProperty("--pill-x", `${(o.left - r.left) / k - row.clientLeft + row.scrollLeft}px`);
  row.style.setProperty("--pill-y", `${(o.top - r.top) / k - row.clientTop + row.scrollTop}px`);
  row.style.setProperty("--pill-w", `${o.width / k}px`);
  row.style.setProperty("--pill-h", `${o.height / k}px`);
  if (was !== on) {
    was?.removeAttribute("data-pill-on");
    on.setAttribute("data-pill-on", "");
  }
  // Drawn where it is the first time; from then on it eases.
  if (!row.hasAttribute("data-pill")) {
    row.setAttribute("data-pill", "");
    requestAnimationFrame(() => requestAnimationFrame(() => row.hasAttribute("data-pill") && row.setAttribute("data-pill", "slide")));
  }
}

export default function SlidePills() {
  useEffect(() => {
    const rows = new Set<HTMLElement>();
    const sizes = new ResizeObserver((entries) => {
      for (const e of entries) {
        const row = (e.target as HTMLElement).closest<HTMLElement>(SLIDE_ROWS);
        if (row) place(row);
      }
    });
    const track = (row: HTMLElement) => {
      if (!rows.has(row)) {
        rows.add(row);
        sizes.observe(row);
      }
      place(row);
    };
    const scan = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches(SLIDE_ROWS)) track(root);
      root.querySelectorAll<HTMLElement>(SLIDE_ROWS).forEach(track);
    };
    scan(document);
    // In the same breath as React's change, before the frame is painted, so the pill never shows a frame behind.
    const changes = new MutationObserver((list) => {
      const touched = new Set<HTMLElement>();
      for (const m of list) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => n instanceof HTMLElement && scan(n));
          m.removedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement)) return;
            for (const row of rows) if (n === row || n.contains(row)) (rows.delete(row), sizes.unobserve(row));
          });
        }
        const row = m.target instanceof HTMLElement ? m.target.closest<HTMLElement>(SLIDE_ROWS) : null;
        if (row && rows.has(row)) touched.add(row);
      }
      touched.forEach(place);
    });
    changes.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "aria-checked", "aria-selected", "aria-pressed", "aria-current"] });
    // Archivo landing changes every option's width.
    document.fonts?.ready.then(() => rows.forEach(place));
    return () => {
      changes.disconnect();
      sizes.disconnect();
    };
  }, []);
  return null;
}
