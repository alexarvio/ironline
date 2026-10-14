"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import RailTour from "./RailTour";
import { AccountIcon, BusinessIcon, CalendarIcon, ChevronDownIcon, DumbbellIcon, FeedIcon, PhasesIcon, PlusIcon, SearchIcon } from "../../components/icons";
import { SETTINGS, type SettingsKey } from "./settingsNav";
import { logoutAction } from "../../lib/auth-actions";
import { dismissHomeActionAction } from "../../lib/actions";
import { ATTENTION, type AttentionReason } from "../../lib/attentionReasons";
import NewClientDialog from "../NewClientDialog";
import type { RailData } from "./loaders";

// The left rail (14 Oct, "Needs you first"): the brand, the coach's
// cross-client views, then every client in one scrolling list in two
// sections. NEEDS YOU comes first, each client with one line saying why,
// in that reason's colour, the most pressing reason first and the one
// waiting longest before the rest; ALL GOOD follows, A to Z. The coach at
// the foot opens Settings, which grows up from there as before.

const VIEWS = [
  { key: "feed", label: "Feed", Icon: FeedIcon },
  { key: "calendar", label: "Calendar", Icon: CalendarIcon },
  { key: "phases", label: "Phases", Icon: PhasesIcon },
  { key: "business", label: "Business", Icon: BusinessIcon },
  // Exercises, their demos and default cues, and cardio movements (5 Oct).
  { key: "library", label: "Library", Icon: DumbbellIcon },
] as const;
// Views already redrawn here open in the redesign; the rest where they always were.
const REDRAWN: Partial<Record<string, string>> = { feed: "/admin/redesign/feed", calendar: "/admin/redesign/calendar", phases: "/admin/redesign/phases", business: "/admin/redesign/business", library: "/admin/redesign/library" };
const SEGMENT_KEY = "norcoach:rail-segment";

/** Diacritics off, lowercased: "Jose" finds José. */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function ReasonIcon({ type, size = 8 }: { type: AttentionReason["type"]; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ATTENTION[type].icon} />
    </svg>
  );
}

export default function RedesignRail({ rail, clientId, settings }: { rail: RailData; clientId: number; /** The settings page open, if any: the rail opens on Settings. */ settings?: SettingsKey }) {
  // This browser's timezone, for the server: meetings read in it (lib/viewZone.ts).
  // New or changed (a trip): the page is drawn again in it.
  const router = useRouter();
  useEffect(() => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!zone) return;
      const had = document.cookie.split("; ").find((c) => c.startsWith("ironline_tz="))?.slice("ironline_tz=".length);
      if (had === encodeURIComponent(zone)) return;
      document.cookie = `ironline_tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    } catch {}
  }, [router]);
  const [settingsOpen, setSettingsOpen] = useState(!!settings);
  // The view you are on (Feed, Calendar…) is marked, as the client you are on is.
  const path = usePathname();
  // "Take a tour" from the welcome steps.
  const touring = useSearchParams().get("tour") === "1";
  const [query, setQuery] = useState("");
  const [filter, setFilterState] = useState<"all" | "needs">("all");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SEGMENT_KEY);
      if (saved === "needs") {
        const t = setTimeout(() => setFilterState("needs"), 0);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);
  const setFilter = (f: "all" | "needs") => {
    setFilterState(f);
    try {
      window.localStorage.setItem(SEGMENT_KEY, f);
    } catch {}
  };
  // "/" anywhere in the admin focuses the search; Esc clears it.
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && !!t.closest("input, textarea, select, [contenteditable=true]");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const q = fold(query.trim());
  const matches = (name: string) => !q || fold(name).includes(q);
  // A to Z, always (14 Oct, Alex); the reason line and the toggle do the rest.
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const needs = rail.clients.filter((c) => c.reasons.length > 0 && matches(c.name)).sort(byName);
  const good = rail.clients.filter((c) => c.reasons.length === 0 && matches(c.name)).sort(byName);
  const needsYou = rail.clients.filter((c) => c.reasons.length > 0).length;
  const [adding, setAdding] = useState(false);
  // The client just clicked is marked at once, before the page arrives (a
  // switch is a round trip to the server), then the real one takes over.
  const [pending, setPending] = useState<{ id: number; from: string } | null>(null);
  const here = `${clientId}:${path}`;
  const pendingId = pending && pending.from === here ? pending.id : null;
  const markedId = pendingId ?? clientId;
  const setPendingId = (id: number) => setPending({ id, from: here });
  // Mark handled: the reasons the coach can clear go, with five seconds to take it back.
  const handled = (c: RailData["clients"][number]) => {
    const clearable = c.reasons.filter((r) => r.clearable);
    if (clearable.length === 0) return;
    void Promise.all(clearable.map((r) => dismissHomeActionAction(c.id, r.actionId))).then(() => router.refresh());
    toast(`${c.name.split(" ")[0]} marked handled`, { duration: 5000, description: clearable.map((r) => r.text).join(" · ") });
  };

  const row = (c: RailData["clients"][number]) => {
    const active = c.id === markedId;
    const top = c.reasons[0] ?? null;
    const more = c.reasons.length - 1;
    const all = c.reasons.map((r) => `${ATTENTION[r.type].label}: ${r.text}`).join("\n");
    return (
      <li key={c.id}>
        <Link
          href={`/admin/redesign/home?client=${c.id}`}
          className={`rr-row${active ? " active" : ""}${pendingId === c.id ? " loading" : ""}${top ? " needs" : ""}`}
          style={top ? ({ "--c": ATTENTION[top.type].color, "--rgb": ATTENTION[top.type].rgb } as React.CSSProperties) : undefined}
          aria-current={active ? "page" : undefined}
          aria-label={top ? `${c.name}. Needs you: ${c.reasons.map((r) => r.text).join(", ")}` : `${c.name}. All good`}
          title={more > 0 ? all : undefined}
          onClick={() => setPendingId(c.id)}
        >
          <span className={`rr-avatar${c.notSignedIn ? " pending" : ""}`} title={c.notSignedIn ? "Hasn't signed in to the app yet" : undefined}>
            {c.avatarPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
              <img src={c.avatarPath} alt="" />
            ) : (
              c.name.slice(0, 1).toUpperCase()
            )}
            {top && (
              <i className="rr-reason-badge" aria-hidden="true">
                <ReasonIcon type={top.type} />
              </i>
            )}
          </span>
          <span className="rr-text">
            <span className="rr-name">{c.name}</span>
            {top && <span className="rr-reason">{top.text}</span>}
          </span>
          {top && c.reasons.some((r) => r.clearable) && (
            <span
              role="button"
              tabIndex={0}
              className="rr-handled"
              aria-label={`Mark ${c.name} handled`}
              title="Mark handled"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handled(c);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  handled(c);
                }
              }}
            >
              ✓
            </span>
          )}
          {more > 0 && <span className="rr-more">+{more}</span>}
        </Link>
      </li>
    );
  };

  return (
    <aside className="rr" aria-label="Coach rail">
      <span className="rr-glow" aria-hidden="true" />
      <Link href="/admin/redesign/feed" className="rr-brand">
        <span className="rr-mark">
          {/* eslint-disable-next-line @next/next/no-img-element -- the brand mark at its natural ratio */}
          <img src="/brand/logo.png" alt="" />
        </span>
        <span className="rr-brand-text">
          <b>Full Potential</b>
          <small>Coach workstation</small>
        </span>
      </Link>

      <nav className="rr-nav" aria-label="Main">
        {VIEWS.map(({ key, label, Icon }) => {
          const href = REDRAWN[key] ?? `/admin?view=${key}`;
          const active = !!REDRAWN[key] && !!path?.startsWith(REDRAWN[key]!);
          return (
            <Link key={key} href={href} className={`rr-navrow${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
              <Icon />
              <span>{label}</span>
              {key === "feed" && needsYou > 0 && (
                <em className="rr-badge" title={`${needsYou} client${needsYou === 1 ? "" : "s"} need you`}>
                  {needsYou > 99 ? "99+" : needsYou}
                </em>
              )}
            </Link>
          );
        })}
        {rail.isOwner && (
          <Link href="/admin?view=coaches" className="rr-navrow">
            <AccountIcon />
            <span>Coaches</span>
          </Link>
        )}
      </nav>

      <button type="button" className={`rr-clients-head${settingsOpen ? " folded" : ""}`} onClick={() => setSettingsOpen(false)} aria-expanded={!settingsOpen} disabled={!settingsOpen}>
        <span className="rr-label">Clients</span>
        <span className="rr-count">{rail.clients.length}</span>
        {settingsOpen && <ChevronDownIcon />}
      </button>
      <div className={`rr-clients${settingsOpen ? " folded" : ""}`} aria-hidden={settingsOpen} inert={settingsOpen}>
        <label className="rr-search">
          <SearchIcon />
          <input
            ref={search}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            placeholder="Search clients"
            aria-label="Search clients"
            autoComplete="off"
          />
        </label>
        <div className="rr-filter" role="group" aria-label="Which clients">
          <button type="button" className={filter === "all" ? "on" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All
          </button>
          <button type="button" className={filter === "needs" ? "on" : ""} aria-pressed={filter === "needs"} onClick={() => setFilter("needs")}>
            Needs you {needsYou > 0 && <small>{needsYou}</small>}
          </button>
        </div>
        <div className="rr-list-wrap">
          <div className="rr-list">
            {rail.clients.length === 0 ? (
              <p className="rr-empty">No clients yet.</p>
            ) : needs.length === 0 && good.length === 0 ? (
              <p className="rr-empty">No client matches that.</p>
            ) : (
              // One list (14 Oct, Alex): the toggle above already says which; those needing the coach come first, the rest A to Z.
              <>
                {needs.length === 0 && !q && filter === "needs" && <p className="rr-nobody">✓ Nobody needs you right now</p>}
                <ul className="rr-rows">{(filter === "all" ? [...needs, ...good].sort(byName) : needs).map(row)}</ul>
              </>
            )}
          </div>
          <span className="rr-list-fade" aria-hidden="true" />
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
          <small>{rail.isOwner ? "Owner · Coach" : "Coach"} · online</small>
        </span>
        <span className="rr-coach-chev" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {touring && <RailTour />}
      {adding && <NewClientDialog inviteReady={rail.inviteReady} clerk={rail.clerk} onClose={() => setAdding(false)} />}
    </aside>
  );
}
