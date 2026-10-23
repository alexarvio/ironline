"use client";

import { useEffect } from "react";

// One signal for the coach's screens reading again on their own (23 Oct, Alex: RefreshOnReturn): while anything holds
// it (a save on its way or failed, words waiting to go, a pending bar, Settings' Save bar), the page is not read again
// under the coach. A skipped read runs once the last hold lets go.

let holds = 0;
const free = new Set<() => void>();

/** Holds the page from reading again by itself; the function handed back lets go (once). */
export function holdRefresh(): () => void {
  holds += 1;
  let gone = false;
  return () => {
    if (gone) return;
    gone = true;
    holds -= 1;
    if (holds === 0) free.forEach((f) => f());
  };
}

/** Whether something on the page holds it now. */
export const refreshHeld = () => holds > 0;

/** Called each time the last hold lets go; returns its own unsubscribe. */
export function onRefreshFree(f: () => void): () => void {
  free.add(f);
  return () => {
    free.delete(f);
  };
}

/** Holds while `on`. */
export function useHoldRefresh(on: boolean) {
  useEffect(() => (on ? holdRefresh() : undefined), [on]);
}
