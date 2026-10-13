// Weights on the live workout (13 Oct). Every weight is stored in kg and
// converted only to show and to take input. Kg shows to the quarter, lbs
// to the half; the coach's plan in lbs is a clean multiple of 5. A tap on
// − / + moves 0.5 kg or 1 lb.

export type Unit = "kg" | "lb";
const LB_PER_KG = 2.20462;

/** A logged or typed figure, as shown: kg to 0.25, lbs to 0.5. */
export const kgToDisplay = (kg: number, unit: Unit) => (unit === "kg" ? Math.round(kg * 4) / 4 : Math.round(kg * LB_PER_KG * 2) / 2);
/** What was shown or typed, back to kg: to the quarter kg. */
export const displayToKg = (v: number, unit: Unit) => (unit === "kg" ? Math.round(v * 4) / 4 : Math.round((v / LB_PER_KG) * 4) / 4);
/** The coach's plan: in lbs a multiple of 5. */
export const planToDisplay = (kg: number, unit: Unit) => (unit === "kg" ? Math.round(kg * 4) / 4 : Math.round((kg * LB_PER_KG) / 5) * 5);
/** One tap on − / +: 0.5 kg or 1 lb (13 Oct, Alex: anything bigger is typed). */
export const stepFor = (unit: Unit) => (unit === "kg" ? 0.5 : 1);
export const unitLabel = (unit: Unit) => (unit === "kg" ? "kg" : "lbs");
/** "202.5", "100", never "202.50". */
export const fmtWeight = (v: number) => String(Math.round(v * 100) / 100);
