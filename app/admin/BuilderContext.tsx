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

// Kg or lbs for the weights the coach reads in the builder, switched in the
// toolbar. Weights are stored and typed in kg; lbs only changes what is
// shown: what the client logged, the over/under figures, and a converted
// line under each weight goal. Same reach problem as Expand all, so the
// figures are small client pieces reading this context.
export type BuilderWeightUnit = "kg" | "lb";
const UnitContext = createContext<BuilderWeightUnit>("kg");
export const WeightUnitProvider = UnitContext.Provider;

const KG_PER_LB = 0.45359237;
const trim = (n: number, dp: number) => String(Math.round(n * 10 ** dp) / 10 ** dp);
// Lbs are whole numbers, always rounded up, tidied to two decimals first so
// float noise (136.0036) does not tip a round figure over to the next pound.
const lbs = (kg: number) => String(Math.ceil(Math.round((kg / KG_PER_LB) * 100) / 100));

/** A weight held in kg, shown in the builder's unit. */
export function BuilderWeight({ kg }: { kg: number }) {
  const unit = useContext(UnitContext);
  return <>{unit === "kg" ? trim(kg, 2) : lbs(kg)}</>;
}

/** "kg" or "lbs", to sit after a BuilderWeight. */
export function BuilderUnit() {
  return <>{useContext(UnitContext) === "kg" ? "kg" : "lbs"}</>;
}

/** Under a weight goal box, in lbs mode only: the goal converted. */
export function WeightGoalHint({ kg }: { kg: number | null | undefined }) {
  const unit = useContext(UnitContext);
  if (unit !== "lb" || kg == null) return null;
  return <span className="pb-weight-hint">{lbs(kg)} lbs</span>;
}
