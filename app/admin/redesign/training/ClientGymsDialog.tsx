"use client";

import "./client-gyms.css";
import { useRef, useState } from "react";
import type React from "react";
import { DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { dayMonth } from "../../../lib/dayMonth";
import { SepJoin } from "../Sep";

// The client's gyms (15 Oct), in the admin hairline style since 20 Oct (Alex:
// no explanations, facts only). A hairline row a gym: its initial, Home as
// quiet small caps, how many sessions in the last eight weeks and when the
// last was, a thin ink usage bar, Make home and a bin (an inline confirm; the
// weights logged there stay). A clean line to add one. Everything saves at
// once; Done just closes. Prefix cgh- (client-gyms.css).

export type GymCard = { id: number; name: string; home: boolean; color: string; rgb: string; sessions8w: number; lastSessionAt: string | null; /** The picture the client gave it in their app. */ logo?: string | null };

const when = (iso: string, today: string) => {
  const d = new Date(iso);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const diff = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${day}T00:00:00`).getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return dayMonth(d);
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
    <DialogContent className="cgh" aria-describedby={undefined} aria-label={`${firstName}’s gyms`} onOpenAutoFocus={(ev) => ev.preventDefault()} onKeyDown={(ev) => ev.key === "Escape" && confirm != null && (ev.stopPropagation(), setConfirm(null))}>
      <div className="cgh-body" onClick={(ev) => !(ev.target as HTMLElement).closest(".cgh-confirm, .cgh-remove") && setConfirm(null)}>
        <div className="cgh-head">
          <DialogTitle className="cgh-title">{firstName}’s gyms</DialogTitle>
          <button type="button" className="cgh-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="cgh-empty">No gyms yet</p>
        ) : (
          <div className="cgh-list">
            {sorted.map((g, i) => {
              const next = g.home ? nextHomeAfter(g.id) : null;
              const asking = confirm === g.id;
              return (
                <div key={g.id} role="group" aria-label={`${g.name}${g.home ? ", home" : ""}. ${g.sessions8w} sessions, ${pct[i]}% of sessions.`} className={`cgh-row${asking ? " asking" : ""}`}>
                  {/* The picture the client gave it in their app (20 Oct, Alex); else its initial on its own colour, as the client's picker shows it. */}
                  {g.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- an upload under /uploads, sized by CSS
                    <img className="cgh-initial cgh-logo" src={g.logo} alt="" aria-hidden="true" />
                  ) : (
                    <span className="cgh-initial" aria-hidden="true" style={g.rgb ? ({ background: `rgba(${g.rgb}, 0.14)`, color: g.color } as React.CSSProperties) : undefined}>
                      {g.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="cgh-text">
                    <span className="cgh-name-row">
                      <b>{g.name}</b>
                      {g.home && <span className="cgh-home">Home</span>}
                    </span>
                    <small>{g.sessions8w ? <SepJoin parts={[`${g.sessions8w} session${g.sessions8w === 1 ? "" : "s"} in the last 8 weeks`, g.lastSessionAt && `last ${when(g.lastSessionAt, today)}`]} /> : "No sessions yet"}</small>
                  </span>
                  <span className="cgh-actions">
                    {!g.home && (
                      <button type="button" className="cgh-makehome" onClick={() => void makeHome(g.id)} aria-label={`Make ${g.name} the home gym`}>
                        Make home
                      </button>
                    )}
                    <button type="button" className={`cgh-remove${asking ? " on" : ""}`} onClick={() => setConfirm(asking ? null : g.id)} aria-label={`Remove ${g.name}`} aria-expanded={asking}>
                      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  </span>
                  <span className="cgh-usage">
                    <span className="cgh-bar" aria-hidden="true">
                      <i style={{ width: `${pct[i]}%` }} />
                    </span>
                    <span className="cgh-pct">{g.sessions8w ? `${pct[i]}%` : "—"}</span>
                  </span>
                  {asking && (
                    <span className="cgh-confirm" aria-live="assertive">
                      <span className="cgh-confirm-text">
                        Remove {g.name}?{next ? ` ${next.name} becomes home.` : ""}
                      </span>
                      <button type="button" className="cgh-keep" onClick={() => setConfirm(null)}>
                        Keep
                      </button>
                      <button type="button" className="cgh-danger" onClick={() => void remove(g.id)}>
                        Remove
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className={`cgh-add${clean ? (duplicate ? " dup" : " filled") : ""}`}>
          <input
            ref={input}
            className="cgh-input"
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
          <button type="button" className="cgh-addbtn" disabled={!canAdd} onClick={() => void add()}>
            Add
          </button>
        </div>
        {duplicate && <p className="cgh-error">{firstName} already has a gym called {clean}.</p>}
        {error && <p className="cgh-error">{error}</p>}
      </div>

      <div className="cgh-foot">
        <button type="button" className="cgh-done" onClick={onClose}>
          Done
        </button>
      </div>
    </DialogContent>
  );
}
