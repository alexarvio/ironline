"use client";

import { useEffect, useRef } from "react";

// The chat panel closes on a click on empty space (24 Oct, Alex: "if I click away from it on an empty space, collapse
// it; if I click somewhere that has a function, keep it open"). Something with a function is anything that answers a
// click: a link, a button, a field, a menu or pop-up, or whatever shows the hand cursor (a row that opens, a tab).
// A click inside the panel or on its tabs, a drag that selected text, and any button but the main one leave it be.

const DOES_SOMETHING =
  "a, button, input, textarea, select, label, summary, video, audio, [role=button], [role=tab], [role=link], [role=menuitem], [role=menuitemradio], [role=option], [role=checkbox], [role=switch], [role=slider], [role=dialog], [role=alertdialog], [role=menu], [role=listbox], [contenteditable=''], [contenteditable='true'], [data-radix-popper-content-wrapper], .rd-chatpanel, .rd-chattab";

function hasFunction(target: Element): boolean {
  if (target.closest(DOES_SOMETHING)) return true;
  // Rows and cards that open on a click show the hand cursor; empty space shows the arrow.
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).cursor === "pointer") return true;
  }
  return false;
}

export function useCloseOnEmptyClick(open: boolean, close: () => void) {
  const shut = useRef(close);
  useEffect(() => {
    shut.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => {
      if (e.button !== 0 || e.defaultPrevented) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target || !document.contains(target)) return;
      // A drag that selected words is not a click away.
      if ((window.getSelection()?.toString() ?? "").trim()) return;
      if (hasFunction(target)) return;
      shut.current();
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [open]);
}
