"use client";

import Link from "next/link";
import { useState } from "react";
import { createClientAction } from "../lib/actions";
import { SearchIcon } from "../components/icons";

export type RosterClient = {
  id: number;
  name: string;
  avatarPath: string | null;
  /** Why the client needs the coach, or null. */
  attention: string | null;
  /** Hasn't signed in to the app themselves yet. */
  notSignedIn: boolean;
};

// The rail's client list: search by name, All or Needs you, the rows, and
// New client pinned at the foot. The list is the only part of the rail that
// scrolls, and it shares its left and right edges with the search field,
// the filter and the button, so nothing in the column is out of line.
export default function ClientRoster({ clients, selectedId }: { clients: RosterClient[]; selectedId: number | null }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "needs">("all");

  const needsYou = clients.filter((c) => c.attention).length;
  const q = query.trim().toLowerCase();
  const shown = clients.filter((c) => (filter === "all" || c.attention) && (!q || c.name.toLowerCase().includes(q)));
  const narrowed = q !== "" || filter === "needs";

  return (
    <div className="ad-rail-clients">
      <div className="ad-rail-clients-head">
        <span className="ad-rail-label">Clients</span>
        <span className="ad-rail-count">{narrowed ? `${shown.length} of ${clients.length}` : clients.length}</span>
      </div>

      <label className="ad-rail-search">
        <SearchIcon />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients"
          aria-label="Search clients"
          autoComplete="off"
        />
      </label>

      <div className="ad-rail-filter" role="group" aria-label="Which clients">
        <button type="button" className={filter === "all" ? "on" : undefined} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          All
        </button>
        <button type="button" className={filter === "needs" ? "on" : undefined} aria-pressed={filter === "needs"} onClick={() => setFilter("needs")}>
          Needs you <span className="ad-rail-filter-count">{needsYou}</span>
        </button>
      </div>

      <div className="ad-rail-list">
        {clients.length === 0 ? (
          <p className="ad-rail-empty">No clients yet. Add your first one below.</p>
        ) : shown.length === 0 ? (
          <p className="ad-rail-empty">No client matches that.</p>
        ) : (
          shown.map((c) => {
            const active = c.id === selectedId;
            return (
              <Link key={c.id} href={`/admin?client=${c.id}`} className={`ad-rail-row${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
                <span
                  className={`ad-rail-avatar${c.notSignedIn ? " pending" : ""}`}
                  title={c.notSignedIn ? "Hasn't signed in to the app yet" : undefined}
                >
                  {c.avatarPath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
                    <img src={c.avatarPath} alt="" className="ad-avatar-img" />
                  ) : (
                    c.name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="ad-rail-name">{c.name}</span>
                {/* One dot, with the reason in its title: the useful question
                    at a glance is "who needs me", not "how many things". */}
                {c.attention && <span className="ad-rail-dot" title={c.attention} aria-label={c.attention} />}
              </Link>
            );
          })
        )}
      </div>

      {/* No name field: the name is typed on the card that opens right after,
          with the rest of the member info. */}
      <form action={createClientAction} className="ad-rail-new">
        <button type="submit" className="ad-rail-new-btn">
          <span className="ad-rail-new-plus" aria-hidden="true">
            +
          </span>
          New client
        </button>
      </form>
    </div>
  );
}
