// Weights on the live workout (13 Oct). Every weight is stored in kg and
// converted only to show and to take input. Kg shows to the quarter, lbs
// to the half; the coach's plan in lbs is a clean multiple of 5. The step
// a − / + takes follows the unit shown.

export type Unit = "kg" | "lb";
const LB_PER_KG = 2.20462;
const UNIT_PREF_KEY = "ironline.client.weight-unit";

/** A logged or typed figure, as shown: kg to 0.25, lbs to 0.5. */
export const kgToDisplay = (kg: number, unit: Unit) => (unit === "kg" ? Math.round(kg * 4) / 4 : Math.round(kg * LB_PER_KG * 2) / 2);
/** What was shown or typed, back to kg: to the quarter kg. */
export const displayToKg = (v: number, unit: Unit) => (unit === "kg" ? Math.round(v * 4) / 4 : Math.round((v / LB_PER_KG) * 4) / 4);
/** The coach's plan: in lbs a multiple of 5. */
export const planToDisplay = (kg: number, unit: Unit) => (unit === "kg" ? Math.round(kg * 4) / 4 : Math.round((kg * LB_PER_KG) / 5) * 5);
/** 2.5 kg or 5 lbs. */
export const stepFor = (unit: Unit) => (unit === "kg" ? 2.5 : 5);
export const unitLabel = (unit: Unit) => (unit === "kg" ? "kg" : "lbs");
/** "202.5", "100", never "202.50". */
export const fmtWeight = (v: number) => String(Math.round(v * 100) / 100);

/** The client's unit, this phone (the toggle on the sets card sets it for every exercise). */
export function readUnitPref(): Unit | null {
  try {
    const v = localStorage.getItem(UNIT_PREF_KEY);
    return v === "kg" || v === "lb" ? v : null;
  } catch {
    return null;
  }
}
export function writeUnitPref(unit: Unit) {
  try {
    localStorage.setItem(UNIT_PREF_KEY, unit);
  } catch {}
}
