"use client";

import { useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";

// The client's gyms (15 Oct), in the shared pop-up language: a card a gym
// with its letter tile in the gym's colour, HOME on the home gym, how many
// sessions in the last eight weeks and when the last was, a usage bar, Make
// home and Remove (an inline confirm; the weights logged there stay). A
// field to add one. Everything saves at once; Done just closes.

const PIN = "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z";

export type GymCard = { id: number; name: string; home: boolean; color: string; rgb: string; sessions8w: number; lastSessionAt: string | null };

const when = (iso: string, today: string) => {
  const d = new Date(iso);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const diff = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${day}T00:00:00`).getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** Shares that add up to exactly 100: rounded, the largest fixed up. */
function shares(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map((c) => Math.round((c / total) * 100));
  const drift = 100 - raw.reduce((a, b) => a + b, 0);
  if (drift) {
    const i = counts.indexOf(Math.max(...counts));
    raw[i] += drift;
  }
  return raw;
}

export default function ClientGymsDialog({
  firstName,
  gyms: initial,
  today,
  onAdd,
  onHome,
  onRemove,
  onClose,
}: {
  firstName: string;
  gyms: GymCard[];
  today: string;
  onAdd: (name: string) => Promise<GymCard | null>;
  onHome: (id: number) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  onClose: () => void;
}) {
  const [gyms, setGyms] = useState<GymCard[]>(initial);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const clean = name.trim();
  const duplicate = !!clean && gyms.some((g) => g.name.trim().toLowerCase() === clean.toLowerCase());
  const canAdd = !!clean && !duplicate;

  // Home first, then the most used, then A to Z.
  const sorted = [...gyms].sort((a, b) => Number(b.home) - Number(a.home) || b.sessions8w - a.sessions8w || a.name.localeCompare(b.name));
  const pct = shares(sorted.map((g) => g.sessions8w));
  const nextHomeAfter = (id: number) => sorted.find((g) => g.id !== id) ?? null;

  const fail = (what: string, revert: GymCard[]) => {
    setGyms(revert);
    setError(what);
  };
  const add = async () => {
    if (!canAdd) return;
    const before = gyms;
    const temp: GymCard = { id: -Date.now(), name: clean, home: gyms.length === 0, color: "#2f5d8f", rgb: "47,93,143", sessions8w: 0, lastSessionAt: null };
    setGyms([...gyms, temp]);
    setName("");
    setError(null);
    input.current?.focus();
    try {
      const made = await onAdd(clean);
      if (!made) throw new Error("no gym");
      setGyms((l) => l.map((g) => (g.id === temp.id ? made : g)));
    } catch {
      fail(`${clean} didn’t save. Try again.`, before);
    }
  };
  const makeHome = async (id: number) => {
    const before = gyms;
    setGyms(gyms.map((g) => ({ ...g, home: g.id === id })));
    setError(null);
    try {
      await onHome(id);
    } catch {
      fail("That didn’t save. Try again.", before);
    }
  };
  const remove = async (id: number) => {
    const before = gyms;
    const gone = gyms.find((g) => g.id === id);
    const next = gone?.home ? nextHomeAfter(id) : null;
    setConfirm(null);
    setGyms(gyms.filter((g) => g.id !== id).map((g) => (next && g.id === next.id ? { ...g, home: true } : g)));
    setError(null);
    try {
      await onRemove(id);
    } catch {
      fail(`${gone?.name ?? "The gym"} didn’t go. Try again.`, before);
    }
  };

  return (
    <DialogContent className="cgy" aria-describedby={undefined} aria-label={`${firstName}’s gyms`} onOpenAutoFocus={(ev) => ev.preventDefault()} onKeyDown={(ev) => ev.key === "Escape" && confirm != null && (ev.stopPropagation(), setConfirm(null))}>
      <span className="cgy-glow" aria-hidden="true" />
      <span className="cgy-wash" aria-hidden="true" />
      <div className="cgy-body" onClick={(ev) => !(ev.target as HTMLElement).closest(".cgy-confirm, .cgy-remove") && setConfirm(null)}>
        <header className="cgy-head">
          <span className="cgy-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d={PIN} />
            </svg>
          </span>
          <div className="cgy-head-text">
            <DialogTitle className="cgy-title">{firstName}’s gyms</DialogTitle>
            <DialogDescription className="cgy-sub">
              Each gym keeps its own weights. {firstName} picks the gym when a session starts.
            </DialogDescription>
          </div>
          <button type="button" className="cgy-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="cgy-list">
          {sorted.length === 0 && <p className="cgy-empty">No gyms yet. {firstName} adds one the first time a session starts, or add it here.</p>}
          {sorted.map((g, i) => {
            const next = g.home ? nextHomeAfter(g.id) : null;
            return (
              <div key={g.id} role="group" aria-label={`${g.name}${g.home ? ", home" : ""}. ${g.sessions8w} sessions, ${pct[i]}% of sessions.`} className={`cgy-card${g.home ? " home" : ""}`} style={{ "--c": g.color, "--rgb": g.rgb } as React.CSSProperties}>
                <div className="cgy-top">
                  <span className="cgy-tile" aria-hidden="true">
                    {g.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="cgy-text">
                    <span className="cgy-name-row">
                      <b>{g.name}</b>
                      {g.home && (
                        <span className="cgy-home">
                          <svg viewBox="0 0 24 24" width={9} height={9} fill="currentColor" aria-hidden="true">
                            <path d="M12 3l9 8h-3v10h-5v-6h-2v6H6V11H3z" />
                          </svg>
                          Home
                        </span>
                      )}
                    </span>
                    <small>{g.sessions8w ? `${g.sessions8w} session${g.sessions8w === 1 ? "" : "s"} in the last 8 weeks${g.lastSessionAt ? ` · last ${when(g.lastSessionAt, today)}` : ""}` : "Added · no sessions yet"}</small>
                  </span>
                  <span className="cgy-actions">
                    {!g.home && (
                      <button type="button" className="cgy-makehome" onClick={() => void makeHome(g.id)} aria-label={`Make ${g.name} the home gym`}>
                        Make home
                      </button>
                    )}
                    <button type="button" className="cgy-remove" onClick={() => setConfirm(confirm === g.id ? null : g.id)} aria-label={`Remove ${g.name}`}>
                      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  </span>
                </div>
                <div className="cgy-usage">
                  <span className="cgy-bar" aria-hidden="true">
                    <i style={{ width: `${pct[i]}%` }} />
                  </span>
                  <span className="cgy-pct">{g.sessions8w ? `${pct[i]}% of sessions` : "—"}</span>
                </div>
                {confirm === g.id && (
                  <div className="cgy-confirm" aria-live="assertive">
                    <span>
                      Remove {g.name}? Its weights stay in {firstName}’s history.{next ? ` ${next.name} becomes home.` : ""}
                    </span>
                    <button type="button" className="cgy-keep" onClick={() => setConfirm(null)}>
                      Keep
                    </button>
                    <button type="button" className="cgy-danger" onClick={() => void remove(g.id)}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="cgy-add">
          <label className={`cgy-field${clean ? (duplicate ? " dup" : " filled") : ""}`}>
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <input
              ref={input}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="Add a gym"
              maxLength={40}
              aria-label="Add a gym"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
            />
          </label>
          <button type="button" className="cgy-addbtn" disabled={!canAdd} onClick={() => void add()}>
            Add
          </button>
        </div>
        {duplicate && <p className="cgy-error">{firstName} already has a gym called {clean}.</p>}
        {error && <p className="cgy-error">{error}</p>}
      </div>

      <footer className="cgy-foot">
        <span className="cgy-note">Plan weights show the home gym’s figure.</span>
        <button type="button" className="cgy-done" onClick={onClose}>
          Done
        </button>
      </footer>
    </DialogContent>
  );
}
