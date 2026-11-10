/** How many sets a row asks of the client this session (10 Nov, Alex): the coach's less those the client took off with
    `− Remove a set`. Never fewer than one. The coach's own `sets` is untouched, so next week still shows their count. */
export function setsDue(a: { sets: number; sets_removed?: number | null }): number {
  const removed = a.sets_removed ?? 0;
  return removed > 0 ? Math.max(1, a.sets - removed) : a.sets;
}
