import { ReactNode } from "react";

// Every admin page sits in this: a fixed sidebar, a fluid main column and an
// optional 296px context panel. The shell owns the page's only height —
// nothing scrolls the document, each column scrolls itself — so the sidebar
// and the client's context stay put while a long program or table scrolls
// underneath them.
export default function AdminShell({
  sidebar,
  children,
  rail,
}: {
  sidebar: ReactNode;
  children: ReactNode;
  // Client context. Views with no client selected (Feed, Calendar, Report
  // templates, Branding) pass nothing and the shell collapses to two columns.
  rail?: ReactNode;
}) {
  return (
    <div className={`ad-shell${rail ? "" : " no-rail"}`}>
      <aside className="ad-sidebar">{sidebar}</aside>
      <main className="ad-main">{children}</main>
      {rail && <aside className="ad-rail">{rail}</aside>}
    </div>
  );
}
