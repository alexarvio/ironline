import { ReactNode } from "react";

// Two columns: the client list, and whatever you're working on. Each scrolls
// itself so the document never does.
export default function AdminShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="ad-shell">
      <aside className="ad-sidebar">{sidebar}</aside>
      <main className="ad-main">{children}</main>
    </div>
  );
}
