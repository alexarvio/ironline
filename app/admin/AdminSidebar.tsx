import Link from "next/link";
import { createClientAction } from "../lib/actions";
import { clientsNeedingAttention, getBranding, getMeetingConflicts, listClients } from "../lib/queries";
import { CalendarIcon, FeedIcon, PaletteIcon, ReportIcon } from "../components/icons";

export type AdminView = "feed" | "calendar" | "report-templates" | "branding" | "client";

const NAV: { id: AdminView; label: string; href: string; icon: React.ReactNode }[] = [
  { id: "feed", label: "Feed", href: "/admin?view=feed", icon: <FeedIcon /> },
  { id: "calendar", label: "Calendar", href: "/admin?view=calendar", icon: <CalendarIcon /> },
  { id: "report-templates", label: "Report templates", href: "/admin?view=report-templates", icon: <ReportIcon /> },
  { id: "branding", label: "Branding", href: "/admin?view=branding", icon: <PaletteIcon /> },
];

// Initials for the brand mark. Two letters from the coach's name where
// there are two words, otherwise the first two characters — and "IL" when
// no name is set yet, rather than a blank square.
function initialsFor(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "IL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function AdminSidebar({
  selectedId,
  activeView,
}: {
  selectedId: number | null;
  activeView: AdminView;
}) {
  const clients = listClients();
  const conflictCount = getMeetingConflicts().length;
  const branding = getBranding();
  const needsAttention = clientsNeedingAttention();

  return (
    <>
      <div className="ad-brand">
        {branding.logo_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logo_path} alt="" className="ad-brand-logo" />
        ) : (
          <span className="ad-brand-mark">{initialsFor(branding.coach_name)}</span>
        )}
        <div className="ad-brand-text">
          <div className="ad-brand-name">{branding.coach_name || "Ironline"}</div>
          <div className="ad-brand-sub">Coach workstation</div>
        </div>
      </div>

      <nav className="ad-nav">
        {NAV.map((n) => (
          <Link key={n.id} href={n.href} className={`ad-nav-row${activeView === n.id ? " active" : ""}`}>
            <span className="ad-nav-icon" aria-hidden="true">
              {n.icon}
            </span>
            <span className="ad-nav-label">{n.label}</span>
            {n.id === "calendar" && conflictCount > 0 && <span className="ad-nav-badge">{conflictCount}</span>}
          </Link>
        ))}
      </nav>

      <div className="ad-clients-head">
        <span className="ad-microlabel">Clients</span>
        <span className="ad-clients-count">{clients.length}</span>
      </div>

      <div className="ad-clients">
        {clients.length === 0 ? (
          <p className="ad-empty">No clients yet — add your first one below.</p>
        ) : (
          clients.map((c) => {
            const active = activeView === "client" && c.id === selectedId;
            return (
              <Link key={c.id} href={`/admin?client=${c.id}`} className={`ad-client-row${active ? " active" : ""}`}>
                <span className="ad-client-avatar" aria-hidden="true">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="ad-client-name">{c.name}</span>
                {needsAttention.has(c.id) && (
                  <span className="ad-client-dot" title="Something is due" aria-label="Something is due" />
                )}
              </Link>
            );
          })
        )}
      </div>

      <form action={createClientAction} className="ad-new-client">
        <input name="name" type="text" placeholder="New client" required className="ad-input" />
        <button className="ad-icon-btn" type="submit" aria-label="Add client">
          +
        </button>
      </form>

      <Link href="/client" className="ad-client-app-link">
        View client app →
      </Link>
    </>
  );
}
