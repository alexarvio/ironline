import { ReactNode } from "react";

// Three columns: the client list, the working area, and everything else true
// about the client.
//
// The shell itself never scrolls — `overflow:hidden` on the outer box and
// each column owning its own scroll. A coach deep in week 6 of a programme
// should not lose the client list or the snapshot by scrolling the page.
export default function AdminShell({
  sidebar,
  panel,
  children,
}: {
  sidebar: ReactNode;
  panel?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ad-shell">
      <aside className="ad-sidebar">{sidebar}</aside>
      <main className="ad-main">{children}</main>
      {panel && <aside className="ad-panel-col">{panel}</aside>}
    </div>
  );
}
