// What Apply to the rest and a session's Apply to remaining weeks would change, in the shape the server reads it
// (applyPreviewData.ts) and the confirm shows it (ApplyChanges.tsx). Plain data and plain functions, so the page's read
// (which offers the button only while a later week would change, 23 Oct, Alex) and the pop-up count alike.

/** One figure that changes: what it is, what it was, what it becomes. A weight is kg as stored (the screen rounds it in the coach's unit). */
export type ApplyFig = { label: string; from: string | null; to: string | null; kg?: boolean; gym?: string; words?: boolean };
export type ApplyItem = { name: string; cardio?: boolean; change: "added" | "removed" | "changed"; figs: ApplyFig[] };
export type ApplySession = {
  /** Its name once applied. */
  name: string;
  /** The name it had, when the copy renames it. */
  was: string | null;
  /** A session the copy makes (the later week had fewer), with what it brings. */
  added: { exercises: number; cardio: number } | null;
  reorder: boolean;
  /** A session's copy replaces a logged session too: what of the client's goes. */
  goes: { sets: number; cardio: number } | null;
  items: ApplyItem[];
};
export type ApplyWeek = { index: number; sessions: ApplySession[] };
export type ApplyPreview = { weeks: ApplyWeek[] };

const LB = 2.20462;
const half = (x: number) => Math.round(x * 2) / 2;

/**
 * The weights in the coach's unit, as the Training tab rounds them (kgOf: the stored kg turned, then to the half), and
 * a weight that reads the same either side dropped, with a row or session it leaves with nothing to say.
 */
export function inUnit(s: ApplySession, lbs: boolean): ApplySession | null {
  const shown = (v: string | null) => (v == null ? null : String(half(lbs ? Number(v) * LB : Number(v))));
  const items = s.items
    .map((it) => (it.change !== "changed" ? it : { ...it, figs: it.figs.flatMap((f) => (!f.kg ? [f] : shown(f.from) === shown(f.to) ? [] : [{ ...f, from: shown(f.from), to: shown(f.to) }])) }))
    .filter((it) => it.change !== "changed" || it.figs.length > 0);
  return items.length || s.was || s.reorder || s.goes || s.added ? { ...s, items } : null;
}

/** The weeks (screen index) the confirm lists something under, read in the coach's unit: the weeks the apply would change. */
export const changedWeeks = (p: ApplyPreview, lbs: boolean) => p.weeks.filter((w) => w.sessions.some((s) => inUnit(s, lbs) != null)).map((w) => w.index);
