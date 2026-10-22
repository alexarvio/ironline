import { entryColors, type Category } from "../palette";

/**
 * A Calendar entry's colours, drawn as the Plan draws an event (chromeOf in plan/timelineParts.tsx, 22 Oct): its
 * category's ink for the words, a 12% wash of it behind them, its edge at 45%. The wash is mixed onto white, so the hour
 * lines never show through a pill. The colour itself stays the category's (palette.ts, the coach's pick): a client's
 * call with none blue, the coach's own grey. A plain module, so the server page colours the month with it too.
 */
export function entryChrome(cats: Category[], category: string | null | undefined, withClient: boolean) {
  const ink = entryColors(cats, category, withClient).ink;
  const n = parseInt(ink.slice(1, 7), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const wash = rgb.map((c) => Math.round(255 + (c - 255) * 0.12));
  return { ink, tint: `rgb(${wash.join(", ")})`, line: `rgba(${rgb.join(", ")}, 0.45)` };
}

/** A clash's edge and words: the rust of a problem (design rules 8), never the category's colour. */
export const CLASH = { ink: "#b8471f", tint: "#fdf1ec", line: "rgba(184, 71, 31, 0.6)" };
