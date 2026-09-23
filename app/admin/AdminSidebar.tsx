import Link from "next/link";
import { logoutAction } from "../lib/auth-actions";
import { getUserForClient } from "../lib/auth";
import { clientAttention, getActivityFeed, getCoachProfile, listClients } from "../lib/queries";
import { AccountIcon, BusinessIcon, CalendarIcon, FeedIcon, PhasesIcon } from "../components/icons";
import ClientRoster, { type RosterClient } from "./ClientRoster";
import { mailConfigured } from "../lib/mail";
import CoachFooter from "./CoachFooter";

// The left rail: brand, the coach's cross-client views, the client roster
// (the only part that scrolls) and the coach at the foot.
//
// Only Feed and Calendar live in the nav (plus Coaches for the owner). The
// per-client work happens in the tabs, not in navigation. Feed carries the
// count of clients needing attention, the same number as the roster's
// "Needs you" filter, so it is visible before the coach looks at the list.
export default function AdminSidebar({
  coachId,
  coachEmail,
  selectedId,
  view,
  isOwner = false,
}: {
  coachId: number;
  coachEmail: string;
  selectedId: number | null;
  /** The cross-client view open in the working area, if any. */
  view: string | null;
  isOwner?: boolean;
}) {
  // One walk of the store for every client on the rail.
  const feed = getActivityFeed(coachId);
  const clients: RosterClient[] = listClients(coachId).map((c) => {
    const user = getUserForClient(c.id);
    return {
      id: c.id,
      name: c.name,
      avatarPath: c.avatar_path ?? null,
      attention: clientAttention(c.id, feed),
      // No login yet, or a temporary password never replaced: they have not
      // signed in to the app themselves.
      notSignedIn: !user || user.must_change_password,
    };
  });
  const needsYou = clients.filter((c) => c.attention).length;

  return (
    <>
      <div className="ad-rail-brand">
        <span className="ad-rail-mark">
          {/* eslint-disable-next-line @next/next/no-img-element -- the brand mark at its natural ratio */}
          <img src="/brand/logo.png" alt="" />
        </span>
        <div className="ad-rail-brand-text">
          <div className="ad-rail-brand-name">Full Potential</div>
          <div className="ad-rail-brand-sub">Coach workstation</div>
        </div>
      </div>

      <nav className="ad-rail-nav">
        <Link href="/admin?view=feed" className={`ad-rail-nav-row${view === "feed" ? " active" : ""}`}>
          <FeedIcon />
          <span className="ad-rail-nav-label">Feed</span>
          {needsYou > 0 && (
            <span className="ad-rail-badge" title={`${needsYou} client${needsYou === 1 ? "" : "s"} need you`}>
              {needsYou}
            </span>
          )}
        </Link>
        <Link href="/admin?view=calendar" className={`ad-rail-nav-row${view === "calendar" ? " active" : ""}`}>
          <CalendarIcon />
          <span className="ad-rail-nav-label">Calendar</span>
        </Link>
        <Link href="/admin?view=phases" className={`ad-rail-nav-row${view === "phases" ? " active" : ""}`}>
          <PhasesIcon />
          <span className="ad-rail-nav-label">Phases</span>
        </Link>
        <Link href="/admin?view=business" className={`ad-rail-nav-row${view === "business" ? " active" : ""}`}>
          <BusinessIcon />
          <span className="ad-rail-nav-label">Business</span>
        </Link>
        {/* The house style, rendered from the real classes — somewhere to
            look when "is this the right blue" comes up, instead of hunting
            for a screen that already does it. */}
        <Link href="/admin?view=style" className={`ad-rail-nav-row${view === "style" ? " active" : ""}`}>
          <BusinessIcon />
          <span className="ad-rail-nav-label">Style</span>
        </Link>
        {/* The owner's account management; no other coach sees this link. */}
        {isOwner && (
          <Link href="/admin?view=coaches" className={`ad-rail-nav-row${view === "coaches" ? " active" : ""}`}>
            <AccountIcon />
            <span className="ad-rail-nav-label">Coaches</span>
          </Link>
        )}
      </nav>

      <ClientRoster clients={clients} selectedId={selectedId} inviteReady={mailConfigured()} />

      <CoachFooter name={getCoachProfile(coachId)?.display_name?.trim() || nameFromEmail(coachEmail)} photoPath={getCoachProfile(coachId)?.avatar_path ?? null}>
        <Link href="/admin/profile" role="menuitem" className="ad-rail-menu-link">
          Your profile
        </Link>
        {/* The redesign drafts, read-only, for looking at the new feel. Goes when a draft becomes the tab. */}
        <Link href={selectedId ? `/admin/redesign?client=${selectedId}` : "/admin/redesign"} role="menuitem" className="ad-rail-menu-link">
          Redesign preview
        </Link>
        <form action={logoutAction}>
          <button type="submit" role="menuitem">
            Sign out
          </button>
        </form>
      </CoachFooter>
    </>
  );
}

// A coach account has an email but no name; "finlay.smith@…" reads as
// "Finlay Smith".
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._-]+/).filter(Boolean);
  return words.length ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "Coach";
}
