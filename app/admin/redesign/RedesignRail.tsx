"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { AccountIcon, BusinessIcon, CalendarIcon, FeedIcon, GearIcon, PhasesIcon, PlusIcon, SearchIcon } from "../../components/icons";
import { logoutAction } from "../../lib/auth-actions";
import type { RailData } from "./loaders";

// The left rail, in the redesign's sheet: the brand, the coach's cross-client
// views as icon rows, every client in one scrolling list, and the coach at
// the foot with their account menu. Only the client list scrolls.

const VIEWS = [
  { key: "feed", label: "Feed", Icon: FeedIcon },
  { key: "calendar", label: "Calendar", Icon: CalendarIcon },
  { key: "phases", label: "Phases", Icon: PhasesIcon },
  { key: "business", label: "Business", Icon: BusinessIcon },
] as const;

export default function RedesignRail({ rail, clientId, tab }: { rail: RailData; clientId: number; tab: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "needs">("all");
  const needsYou = rail.clients.filter((c) => c.attention).length;
  const q = query.trim().toLowerCase();
  const shown = rail.clients.filter((c) => (filter === "all" || c.attention) && (!q || c.name.toLowerCase().includes(q)));
  const notYet = (what: string) => toast(what, { description: "Not drafted yet: the current one is still where it was." });

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
        {VIEWS.map(({ key, label, Icon }) => (
          <button key={key} type="button" className="rr-navrow" onClick={() => notYet(label)}>
            <Icon />
            <span>{label}</span>
            {key === "feed" && needsYou > 0 && (
              <em className="rr-badge" title={`${needsYou} client${needsYou === 1 ? "" : "s"} need you`}>
                {needsYou}
              </em>
            )}
          </button>
        ))}
        {rail.isOwner && (
          <button type="button" className="rr-navrow" onClick={() => notYet("Coaches")}>
            <AccountIcon />
            <span>Coaches</span>
          </button>
        )}
      </nav>

      <div className="rr-clients">
        <div className="rr-clients-head">
          <span className="rr-label">Clients</span>
          <span className="rr-count">{q || filter === "needs" ? `${shown.length} of ${rail.clients.length}` : rail.clients.length}</span>
        </div>
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
                <Link key={c.id} href={`/admin/redesign/${tab}?client=${c.id}`} className={`rr-row${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
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
        <button type="button" className="rr-new" onClick={() => notYet("New client")}>
          <PlusIcon /> New client
        </button>
      </div>

      <div className="rr-coach">
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
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger className="rd-btn ghost" aria-label="Account">
            <GearIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="pb-menu">
            <DropdownMenuItem asChild>
              <Link href="/admin/profile">
                <AccountIcon /> Your profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => notYet("Settings")}>
              <GearIcon /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logoutAction()}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
