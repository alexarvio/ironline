"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountIcon, BusinessIcon, CalendarIcon, ChevronDownIcon, FeedIcon, PhasesIcon, PlusIcon, SearchIcon } from "../../components/icons";
import { SETTINGS, type SettingsKey } from "./settingsNav";
import { logoutAction } from "../../lib/auth-actions";
import NewClientDialog from "../NewClientDialog";
import type { RailData } from "./loaders";

// The left rail, in the redesign's sheet: the brand, the coach's cross-client
// views as icon rows, every client in one scrolling list, and the coach at
// the foot. A click on the coach opens Settings: it grows up from the foot
// and the client list folds away; a click on Clients (or the coach again)
// brings the list back. Only the client list scrolls.

const VIEWS = [
  { key: "feed", label: "Feed", Icon: FeedIcon },
  { key: "calendar", label: "Calendar", Icon: CalendarIcon },
  { key: "phases", label: "Phases", Icon: PhasesIcon },
  { key: "business", label: "Business", Icon: BusinessIcon },
] as const;
// Views already redrawn here open in the redesign; the rest where they always were.
const REDRAWN: Partial<Record<string, string>> = { feed: "/admin/redesign/feed", calendar: "/admin/redesign/calendar", phases: "/admin/redesign/phases", business: "/admin/redesign/business" };


export default function RedesignRail({ rail, clientId, settings }: { rail: RailData; clientId: number; /** The settings page open, if any: the rail opens on Settings. */ settings?: SettingsKey }) {
  const [settingsOpen, setSettingsOpen] = useState(!!settings);
  // The view you are on (Feed, Calendar…) is marked, as the client you are on is.
  const path = usePathname();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "needs">("all");
  const needsYou = rail.clients.filter((c) => c.attention).length;
  const q = query.trim().toLowerCase();
  const shown = rail.clients.filter((c) => (filter === "all" || c.attention) && (!q || c.name.toLowerCase().includes(q)));
  const [adding, setAdding] = useState(false);

  return (
    <aside className="rr" aria-label="Coach rail">
      <div className="rr-brand">
        <span className="rr-mark">
          {/* eslint-disable-next-line @next/next/no-img-element -- the brand mark at its natural ratio */}
          <img src="/brand/logo.png" alt="" />
        </span>
        <span className="rr-brand-text">
          <b>Full Potential</b>
          <small>Coach workstation</small>
        </span>
      </div>

      <nav className="rr-nav" aria-label="Views">
        {/* The cross-client views are not redrawn yet: they open where they always were. */}
        {VIEWS.map(({ key, label, Icon }) => (
          <Link key={key} href={REDRAWN[key] ?? `/admin?view=${key}`} className={`rr-navrow${REDRAWN[key] && path?.startsWith(REDRAWN[key]!) ? " active" : ""}`} aria-current={REDRAWN[key] && path?.startsWith(REDRAWN[key]!) ? "page" : undefined}>
            <Icon />
            <span>{label}</span>
            {key === "feed" && needsYou > 0 && (
              <em className="rr-badge" title={`${needsYou} client${needsYou === 1 ? "" : "s"} need you`}>
                {needsYou}
              </em>
            )}
          </Link>
        ))}
        {rail.isOwner && (
          <Link href="/admin?view=coaches" className="rr-navrow">
            <AccountIcon />
            <span>Coaches</span>
          </Link>
        )}
      </nav>

      <button type="button" className={`rr-clients-head${settingsOpen ? " folded" : ""}`} onClick={() => setSettingsOpen(false)} aria-expanded={!settingsOpen} disabled={!settingsOpen}>
        <span className="rr-label">Clients</span>
        <span className="rr-count">{q || filter === "needs" ? `${shown.length} of ${rail.clients.length}` : rail.clients.length}</span>
        {settingsOpen && <ChevronDownIcon />}
      </button>
      <div className={`rr-clients${settingsOpen ? " folded" : ""}`} aria-hidden={settingsOpen} inert={settingsOpen}>
        <label className="rr-search">
          <SearchIcon />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" aria-label="Search clients" autoComplete="off" />
        </label>
        <div className="rr-filter" role="group" aria-label="Which clients">
          <button type="button" className={filter === "all" ? "on" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All
          </button>
          <button type="button" className={filter === "needs" ? "on" : ""} aria-pressed={filter === "needs"} onClick={() => setFilter("needs")}>
            Needs you <small>{needsYou}</small>
          </button>
        </div>
        <div className="rr-list">
          {shown.length === 0 ? (
            <p className="rr-empty">{rail.clients.length === 0 ? "No clients yet." : "No client matches that."}</p>
          ) : (
            shown.map((c) => {
              const active = c.id === clientId;
              return (
                <Link key={c.id} href={`/admin/redesign/home?client=${c.id}`} className={`rr-row${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
                  <span className={`rr-avatar${c.notSignedIn ? " pending" : ""}`} title={c.notSignedIn ? "Hasn't signed in to the app yet" : undefined}>
                    {c.avatarPath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
                      <img src={c.avatarPath} alt="" />
                    ) : (
                      c.name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="rr-name">{c.name}</span>
                  {/* One dot, the reason in its title: "who needs me", not "how many things". */}
                  {c.attention && <i className="rr-dot" title={c.attention} aria-label={c.attention} />}
                </Link>
              );
            })
          )}
        </div>
        <button type="button" className="rr-new" onClick={() => setAdding(true)}>
          <PlusIcon /> New client
        </button>
      </div>

      <div className={`rr-settings${settingsOpen ? " open" : ""}`} aria-hidden={!settingsOpen} inert={!settingsOpen}>
        <span className="rr-label">Settings</span>
        <nav className="rr-settings-list" aria-label="Settings">
          {SETTINGS.map(({ key, label, href, Icon }) => (
            <Link key={key} href={href} className={`rr-navrow${settings === key ? " active" : ""}`} aria-current={settings === key ? "page" : undefined}>
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <button type="button" className="rr-navrow rr-signout" onClick={() => logoutAction()}>
          <span>Sign out</span>
        </button>
      </div>

      <button type="button" className={`rr-coach${settingsOpen ? " open" : ""}`} onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen} aria-label={settingsOpen ? "Close settings" : "Open settings"}>
        <span className="rr-coach-avatar" aria-hidden="true">
          {rail.coach.photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
            <img src={rail.coach.photoPath} alt="" />
          ) : (
            rail.coach.name.charAt(0).toUpperCase()
          )}
        </span>
        <span className="rr-coach-text">
          <b>{rail.coach.name}</b>
          <small>{rail.isOwner ? "Owner · Coach" : "Coach"}</small>
        </span>
        <span className="rr-coach-chev" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {adding && <NewClientDialog inviteReady={rail.inviteReady} onClose={() => setAdding(false)} />}
    </aside>
  );
}
