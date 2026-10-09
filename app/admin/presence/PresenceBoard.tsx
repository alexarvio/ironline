"use client";

import { useEffect, useState } from "react";
import type { PresenceRow } from "../../lib/presence";

// The dashboard (9 Oct): who is in the app, polled every ten seconds. Green
// within two minutes, amber within ten, grey after. Left open beside the
// work, it says when a push would land on someone.

const ACTIVE_S = 120;
const RECENT_S = 600;

const ago = (s: number) => (s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`);

export default function PresenceBoard() {
  const [rows, setRows] = useState<PresenceRow[] | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/presence", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { now: number; rows: PresenceRow[] };
        if (!alive) return;
        setRows(j.rows);
        setAt(j.now);
        setError(false);
      } catch {
        if (alive) setError(true);
      }
    };
    void load();
    const i = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);
  const active = (rows ?? []).filter((r) => r.secondsAgo <= ACTIVE_S);
  const clientsActive = active.filter((r) => r.role === "client");
  const coachesActive = active.filter((r) => r.role === "coach");
  const quiet = rows != null && active.length === 0;
  return (
    <div className="pr">
      <div className={`pr-verdict${quiet ? " quiet" : " busy"}`}>
        <b>{rows == null ? "Looking…" : quiet ? "Quiet. Nobody in the last two minutes." : `${active.length} in the app now`}</b>
        {rows != null && !quiet && (
          <small>
            {clientsActive.length} client{clientsActive.length === 1 ? "" : "s"} · {coachesActive.length} coach{coachesActive.length === 1 ? "" : "es"}
          </small>
        )}
        {at != null && <small>checked {new Date(at).toLocaleTimeString()} · every 10 s</small>}
        {error && <small className="pr-err">The check failed; still trying.</small>}
      </div>
      <ul className="pr-list">
        {(rows ?? []).map((r) => {
          const tone = r.secondsAgo <= ACTIVE_S ? "on" : r.secondsAgo <= RECENT_S ? "recent" : "off";
          return (
            <li key={r.key} className={`pr-row ${tone}`}>
              <span className="pr-dot" aria-hidden="true" />
              <span className="pr-name">{r.name}</span>
              <span className="pr-role">{r.role === "coach" ? "coach" : "client"}</span>
              <span className="pr-where">{r.where ?? ""}</span>
              <span className="pr-ago">{ago(r.secondsAgo)}</span>
            </li>
          );
        })}
        {rows != null && rows.length === 0 && <li className="pr-empty">Nobody since the server last started.</li>}
      </ul>
      <p className="pr-note">A deploy restarts the server for about a minute. Push when the clients are grey; a coach row that is you can be ignored.</p>
    </div>
  );
}
