// First and last always, and the page either side of where you are. Enough
// to know how long the list is and to jump to either end of it, without a
// row of thirty numbers.
//
// Here rather than in either feed because both use it and one of them is a
// server component: a plain function exported from a "use client" module
// cannot be called during a server render.
export function pageWindow(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "gap")[] = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pages - 1, page + 1);
  if (lo > 2) out.push("gap");
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < pages - 1) out.push("gap");
  out.push(pages);
  return out;
}
