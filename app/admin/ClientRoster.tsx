"use client";

import Link from "next/link";
import { useState } from "react";
import NewClientDialog from "./NewClientDialog";
import { SearchIcon } from "../components/icons";
import { Badge, ToggleGroup, ToggleGroupItem } from "../components/ui/basics";
import { Dialog, DialogTrigger } from "../components/ui/dialog";

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
export default function ClientRoster({
  clients,
  selectedId,
  inviteReady = false,
}: {
  clients: RosterClient[];
  selectedId: number | null;
  /** Whether the app can send the new client's invite email (see lib/mail.ts). */
  inviteReady?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
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

      {/* A single-choice Toggle Group: arrow keys move between the two, and
          clicking the one already on keeps it on rather than clearing it. */}
      <ToggleGroup
        type="single"
        className="ad-rail-filter"
        aria-label="Which clients"
        value={filter}
        onValueChange={(v) => v && setFilter(v as "all" | "needs")}
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        <ToggleGroupItem value="needs">
          Needs you <Badge className="ad-rail-filter-count">{needsYou}</Badge>
        </ToggleGroupItem>
      </ToggleGroup>

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

      {/* The two-step New client dialog: who they are, then their login.
          Nothing exists until its last button. The dialog's content only
          mounts while open, so a cancelled draft starts empty next time. */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <div className="ad-rail-new">
          <DialogTrigger className="ad-rail-new-btn">
            <span className="ad-rail-new-plus" aria-hidden="true">
              +
            </span>
            New client
          </DialogTrigger>
        </div>
        {adding && <NewClientDialog inviteReady={inviteReady} onClose={() => setAdding(false)} />}
      </Dialog>
    </div>
  );
}
