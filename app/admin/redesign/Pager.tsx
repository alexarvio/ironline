import Link from "next/link";
import { pageWindow } from "../../lib/pager";

// The one pager under every paged list in the redesign, the Feed's: ‹, the
// page numbers (first, last, and either side of this one), ›, then where
// in the list you are ("1–15 of 65"). Pages are links on a server page
// (href) or buttons in a client one (onPage). Nothing shows for one page.
// No "use client": the Feed renders it on the server, the tabs in the browser.

type Props = {
  page: number;
  pages: number;
  /** The first row shown, counted from 0, and how many are shown. */
  from: number;
  shown: number;
  total: number;
  /** What the rows are, after the count: "days". */
  noun?: string;
  label: string;
  className?: string;
} & ({ href: (page: number) => string; onPage?: never } | { onPage: (page: number) => void; href?: never });

export default function Pager({ page, pages, from, shown, total, noun, label, className, href, onPage }: Props) {
  if (pages <= 1) return null;
  const to = (n: number, content: React.ReactNode, extra: { cls?: string; aria?: string; current?: boolean } = {}) => {
    const cls = `rpg-page${extra.cls ? ` ${extra.cls}` : ""}${extra.current ? " on" : ""}`;
    const current = extra.current ? ("page" as const) : undefined;
    return href ? (
      <Link key={`${n}${extra.aria ?? ""}`} href={href(n)} scroll={false} className={cls} aria-label={extra.aria} aria-current={current}>
        {content}
      </Link>
    ) : (
      <button key={`${n}${extra.aria ?? ""}`} type="button" className={cls} onClick={() => onPage!(n)} aria-label={extra.aria} aria-current={current}>
        {content}
      </button>
    );
  };
  const off = (content: string) => (
    <span className="rpg-page off" aria-hidden="true">
      {content}
    </span>
  );
  return (
    <nav className={`rpg${className ? ` ${className}` : ""}`} aria-label={label}>
      {page > 1 ? to(page - 1, "‹", { aria: "Newer" }) : off("‹")}
      {pageWindow(page, pages).map((n, i) =>
        n === "gap" ? (
          <span key={`gap${i}`} className="rpg-gap" aria-hidden="true">
            …
          </span>
        ) : (
          to(n, n, { current: n === page })
        )
      )}
      {page < pages ? to(page + 1, "›", { aria: "Older" }) : off("›")}
      <span className="rpg-count">
        {from + 1}–{from + shown} of {total}
        {noun ? ` ${noun}` : ""}
      </span>
    </nav>
  );
}
