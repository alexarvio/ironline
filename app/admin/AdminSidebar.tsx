import Image from "next/image";
import Link from "next/link";
import { createClientAction } from "../lib/actions";
import { logoutAction } from "../lib/auth-actions";
import { clientAttention, getBranding, listClients } from "../lib/queries";

// The left rail: brand, the coach's two cross-client views, and the client
// list with a way to add another.
//
// Only Feed and Calendar live in the nav. Report templates and Branding were
// cut, and nothing else belongs here — the per-client work happens in the
// tabs, not in navigation.
export default function AdminSidebar({ selectedId }: { selectedId: number | null }) {
  const clients = listClients();
  const branding = getBranding();

  return (
    <>
      <div className="ad-brand">
        <span className="ad-brand-mark">
          {branding.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element -- coach-uploaded file
            <img src={branding.logo_path} alt="" className="ad-brand-logo-img" />
          ) : (
            <Image src="/brand/logo.png" alt="" width={14} height={24} priority />
          )}
        </span>
        <div className="ad-brand-text">
          <div className="ad-brand-name">{branding.coach_name || "Ironline"}</div>
          <div className="ad-brand-sub">Coach workstation</div>
        </div>
      </div>

      <nav className="ad-nav">
        <Link href="/admin?view=feed" className="ad-nav-row">
          <span className="ad-nav-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="ad-nav-label">Feed</span>
        </Link>
        <Link href="/admin?view=calendar" className="ad-nav-row">
          <span className="ad-nav-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="ad-nav-label">Calendar</span>
          {/* Scheduling conflicts the coach hasn't resolved. */}
          <span className="ad-nav-badge">2</span>
        </Link>
        <Link href="/admin?view=branding" className="ad-nav-row">
          <span className="ad-nav-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5S14 15 15.5 15H17a4 4 0 0 0 4-4c0-5-4-8-9-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="7.5" cy="10.5" r="1" fill="currentColor" /><circle cx="11" cy="7" r="1" fill="currentColor" /><circle cx="15.5" cy="8" r="1" fill="currentColor" />
            </svg>
          </span>
          <span className="ad-nav-label">Branding</span>
        </Link>
      </nav>

      <div className="ad-clients-head">
        <span className="ad-microlabel">Clients</span>
        <span className="ad-clients-count">{clients.length}</span>
      </div>

      {/* The add-client row sits at the bottom of this same scroll area, at
          the same 36px as the rows above it, rather than pinned outside. */}
      <div className="ad-clients">
        {clients.length === 0 ? (
          <p className="ad-empty">No clients yet. Add your first one below.</p>
        ) : (
          clients.map((c) => {
            const attention = clientAttention(c.id);
            return (
              <Link
                key={c.id}
                href={`/admin?client=${c.id}`}
                className={`ad-client-row${c.id === selectedId ? " active" : ""}`}
              >
                <span className="ad-client-avatar" aria-hidden="true">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="ad-client-name">{c.name}</span>
                {/* One dot, with the reason in its title — at a glance the
                    useful question is "who needs me", not "how many things". */}
                {attention && <span className="ad-client-dot" title={attention} aria-label={attention} />}
              </Link>
            );
          })
        )}

        {/* One full-width button, no name field: the name is typed on the
            card that opens right after, with the rest of the member info,
            rather than in a second, smaller place here. */}
        <form action={createClientAction} className="ad-new-client">
          <button className="ad-new-client-btn" type="submit">
            <span>New client</span>
            <span className="ad-new-client-plus" aria-hidden="true">
              +
            </span>
          </button>
        </form>
      </div>

      {/* Pinned to the foot of the rail: the one thing the coach needs when
          they hand the laptop to someone else or switch accounts. */}
      <form action={logoutAction} className="ad-signout">
        <button type="submit" className="ad-signout-btn">
          Sign out
        </button>
      </form>
    </>
  );
}
