import Link from "next/link";
import { createClientAction } from "../lib/actions";
import { getMeetingConflicts, listClients } from "../lib/queries";
import { CalendarIcon, FeedIcon, PaletteIcon, ReportIcon } from "../components/icons";

export default function ClientSidebar({
  selectedId,
  activeView,
}: {
  selectedId: number | null;
  activeView: "feed" | "calendar" | "report-templates" | "branding" | "client";
}) {
  const clients = listClients();
  const conflictCount = getMeetingConflicts().length;

  return (
    <aside className="admin-sidebar">
      <Link
        href="/admin?view=feed"
        className={`feed-nav-btn${activeView === "feed" ? " active" : ""}`}
      >
        <span className="feed-nav-icon">
          <FeedIcon />
        </span>
        Feed
      </Link>

      <Link
        href="/admin?view=calendar"
        className={`feed-nav-btn${activeView === "calendar" ? " active" : ""}`}
      >
        <span className="feed-nav-icon">
          <CalendarIcon />
        </span>
        Calendar
        {conflictCount > 0 && <span className="conflict-badge">{conflictCount}</span>}
      </Link>

      <Link
        href="/admin?view=report-templates"
        className={`feed-nav-btn${activeView === "report-templates" ? " active" : ""}`}
      >
        <span className="feed-nav-icon">
          <ReportIcon />
        </span>
        Report Templates
      </Link>

      <Link
        href="/admin?view=branding"
        className={`feed-nav-btn${activeView === "branding" ? " active" : ""}`}
      >
        <span className="feed-nav-icon">
          <PaletteIcon />
        </span>
        Branding
      </Link>

      <div className="sidebar-heading">Clients ({clients.length})</div>
      <nav className="client-list">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/admin?client=${c.id}`}
            className={`client-list-item${
              activeView === "client" && c.id === selectedId ? " active" : ""
            }`}
          >
            <span className="client-avatar">{c.name.slice(0, 1).toUpperCase()}</span>
            {c.name}
          </Link>
        ))}
        {clients.length === 0 && (
          <div className="empty-note" style={{ padding: "8px 4px" }}>
            No clients yet — add your first one below.
          </div>
        )}
      </nav>

      <form action={createClientAction} className="new-client-form">
        <input name="name" type="text" placeholder="New client name" required />
        <button className="btn secondary" type="submit">
          + New client
        </button>
      </form>
    </aside>
  );
}
