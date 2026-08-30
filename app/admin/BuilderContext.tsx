"use client";

import { createContext, useContext } from "react";

// "Expand all" / "Collapse all" in the builder toolbar has to reach every
// day card at once, but the cards are server-rendered inside the week
// content the shell receives as an opaque ReactNode — so it can't hand them
// a prop. Instead the shell publishes a signal: a counter that changes on
// every toolbar press, plus the state to move to. Each AdminDayCard watches
// the counter and snaps to `open` when it ticks, and is free to be toggled
// individually in between.
export type ExpandSignal = { signal: number; open: boolean };

const ExpandContext = createContext<ExpandSignal | null>(null);

export const ExpandProvider = ExpandContext.Provider;

export function useExpandSignal() {
  return useContext(ExpandContext);
}
