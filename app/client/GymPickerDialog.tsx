"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clientAddGymAction } from "../lib/actions";
import { GYM_COLORS, GYM_COLOR_KEYS, GYM_KINDS, gymColor, initials, nextFreeColor, type GymColorKey, type GymKind } from "../lib/gymColors";

// Which gym the session is at (13 Oct, "Gym rows"): a centred pop-up over
// the dimmed session overview, the first step of starting a workout.
// Every logged set is stored against a gym (machines and loads differ), so
// last time's numbers, targets and charts follow the pick. Rows carry a
// coloured initials badge, how many sessions and when the last was; the
// last used gym is first and preselected. "Add a gym" turns the same card
// into a form (name, colour, type) and comes back with the new gym picked.
// The workout header's chip reopens it to switch gym mid-session.

/** A gym as the picker and the workout know it. */
export type GymOption = {
  id: number;
  name: string;
  color: GymColorKey;
  kind: GymKind;
  /** Sessions trained there. */
  sessions: number;
  /** The last session there (ISO), or when it was last picked; null, never. */
  lastUsedAt: string | null;
  /** The gym new sessions start on: the one picked most recently. */
  lastUsed: boolean;
};

/** Just the count (13 Oct): "11 sessions", "1 session", "0 sessions". */
const meta = (g: GymOption) => `${g.sessions} session${g.sessions === 1 ? "" : "s"}`;
/** Last used first, then the most trained at, then the newest. */
const order = (a: GymOption, b: GymOption) => Number(b.lastUsed) - Number(a.lastUsed) || b.sessions - a.sessions || b.id - a.id;

export default function GymPickerDialog({
  gyms,
  gymId,
  mode,
  dayId,
  onPick,
  onClose,
}: {
  gyms: GymOption[];
  /** The gym on the session now (switch) or last time (start). */
  gymId: number | null;
  /** "start": the pick starts the session. "switch": the session is going. */
  mode: "start" | "switch";
  /** The session's day: whose gyms these are is read from it. */
  dayId: number;
  onPick: (gym: GymOption) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<GymOption[]>(() => [...gyms].sort(order));
  const [selected, setSelected] = useState<number | null>(() => (list.find((g) => g.id === gymId) ?? list.find((g) => g.lastUsed) ?? list[0])?.id ?? null);
  const chosen = list.find((g) => g.id === selected) ?? null;
  // No gyms yet: straight into the form, with no way back to an empty list.
  const [adding, setAdding] = useState(list.length === 0);
  const firstGym = list.length === 0;
  // Leaving: the card shrinks away over .18s, then the caller hears.
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 180);
  };
  // The form.
  const [name, setName] = useState("");
  const [color, setColor] = useState<GymColorKey>(() => nextFreeColor(gyms));
  const [kind, setKind] = useState<GymKind>("gym");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clean = name.trim().replace(/\s+/g, " ");
  const duplicate = clean.length >= 2 && list.some((g) => g.name.toLowerCase() === clean.toLowerCase());
  const valid = clean.length >= 2 && !duplicate && !busy;
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) setTimeout(() => nameRef.current?.focus(), 60);
  }, [adding]);

  // Focus: the card takes it, Escape closes, and the Start button has it back after.
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = card.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"], input, button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !card.current) return;
      const items = Array.from(card.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'));
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (i <= 0 || i === -1)) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && i === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  const add = async () => {
    if (!valid) return;
    setBusy(true);
    const r = await clientAddGymAction(dayId, clean, color, kind);
    setBusy(false);
    if (!r || "error" in r) {
      setToast(r?.error ?? "Couldn't add the gym. Try again.");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const gym: GymOption = { id: r.id, name: r.name, color: r.color, kind: r.kind, sessions: 0, lastUsedAt: null, lastUsed: false };
    setList((l) => [...l.filter((g) => g.id !== gym.id), gym]);
    setSelected(gym.id);
    setName("");
    setColor(nextFreeColor([...list, gym]));
    setKind("gym");
    setAdding(false);
  };
  const go = () => {
    if (!chosen) return;
    try {
      navigator.vibrate?.(10);
    } catch {}
    onPick(chosen);
  };
  // Arrow keys move the pick along the rows.
  const onRowKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = list[(i + step + list.length) % list.length];
    setSelected(next.id);
    (card.current?.querySelectorAll<HTMLElement>('[role="radio"]')[(i + step + list.length) % list.length])?.focus();
  };

  const tint = adding ? GYM_COLORS[color] : gymColor(chosen?.color);
  const currentName = list.find((g) => g.id === gymId)?.name ?? null;
  const title = adding ? (firstGym ? "Where do you train?" : "Add a gym") : mode === "switch" ? "Switch gym" : "Where are you training?";
  return createPortal(
    <div className={`gpk-overlay${closing ? " closing" : ""}`} onClick={close}>
      <div ref={card} className={`gpk-card${closing ? " closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="gpk-title" style={{ "--g": tint.hex, "--g-rgb": tint.rgb } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <span className="gpk-glow" aria-hidden="true" />
        <span className="gpk-wash" aria-hidden="true" />
        {adding ? (
          <div className="gpk-content gpk-add">
            <div className="gpk-head center">
              {!firstGym && (
                <button type="button" className="gpk-round" onClick={() => setAdding(false)} aria-label="Back to your gyms">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m14.5 6-6 6 6 6" />
                  </svg>
                </button>
              )}
              <h2 id="gpk-title" className="gpk-title sm">
                {title}
              </h2>
            </div>
            <div className="gpk-name-row">
              <span className="gpk-badge big" style={{ background: GYM_COLORS[color].hex, boxShadow: `0 12px 20px -10px rgba(${GYM_COLORS[color].rgb},.9), inset 0 1px 0 rgba(255,255,255,.25)` }} aria-hidden="true">
                {initials(name)}
              </span>
              <label className="gpk-field">
                <span className="gpk-label">Gym name</span>
                <span className={`gpk-input-box${clean.length >= 2 && !duplicate ? " valid" : ""}`}>
                  <input
                    ref={nameRef}
                    className="gpk-input"
                    value={name}
                    maxLength={32}
                    placeholder="e.g. PureGym Leeds"
                    autoCapitalize="words"
                    autoComplete="off"
                    enterKeyHint="done"
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void add())}
                  />
                </span>
                {duplicate && <span className="gpk-error">You already have a gym called {clean}</span>}
              </label>
            </div>
            <div className="gpk-group">
              <span className="gpk-label">Colour</span>
              <div className="gpk-swatches" role="radiogroup" aria-label="Colour">
                {GYM_COLOR_KEYS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={GYM_COLORS[c].label} className={`gpk-swatch${c === color ? " on" : ""}`} style={{ background: GYM_COLORS[c].hex, ...(c === color ? { boxShadow: `0 0 0 3px #fff, 0 0 0 5px ${GYM_COLORS[c].hex}` } : {}) }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <div className="gpk-group">
              <span className="gpk-label">Type</span>
              <div className="gpk-seg" role="radiogroup" aria-label="Type">
                {GYM_KINDS.map((k) => (
                  <button key={k.key} type="button" role="radio" aria-checked={k.key === kind} className={`gpk-seg-btn${k.key === kind ? " on" : ""}`} onClick={() => setKind(k.key)}>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="gpk-info">Weights you log here are kept separate from your other gyms.</p>
            <button type="button" className="gpk-primary" disabled={!valid} onClick={() => void add()}>
              {busy ? "Adding…" : "Add & select"}
            </button>
            {toast && (
              <div className="gpk-toast" role="alert">
                {toast}
              </div>
            )}
          </div>
        ) : (
          <div className="gpk-content">
            <div className="gpk-head">
              <div className="gpk-head-text">
                <h2 id="gpk-title" className="gpk-title">
                  {title}
                </h2>
                <p className="gpk-sub">{mode === "switch" ? `Sets you've already logged stay at ${currentName ?? "the gym you picked"}.` : "Weights and history are saved per gym."}</p>
              </div>
              <button type="button" className="gpk-round" onClick={close} aria-label="Close">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="gpk-rows" role="radiogroup" aria-label="Your gyms">
              {list.map((g, i) => {
                const c = GYM_COLORS[g.color];
                const on = g.id === selected;
                return (
                  <button key={g.id} type="button" role="radio" aria-checked={on} aria-label={`${g.name}, ${meta(g)}`} tabIndex={on ? 0 : -1} className={`gpk-row${on ? " on" : ""}`} style={on ? { background: `rgba(${c.rgb},.07)`, boxShadow: `inset 0 0 0 2px ${c.hex}` } : undefined} onClick={() => setSelected(g.id)} onKeyDown={(e) => onRowKey(e, i)}>
                    <span className="gpk-badge" style={{ background: c.hex, boxShadow: `0 8px 14px -8px rgba(${c.rgb},.9), inset 0 1px 0 rgba(255,255,255,.25)` }} aria-hidden="true">
                      {initials(g.name)}
                    </span>
                    <span className="gpk-row-text">
                      <span className="gpk-row-name">{g.name}</span>
                      <span className="gpk-row-meta">{meta(g)}</span>
                    </span>
                    <span className={`gpk-radio${on ? " on" : ""}`} style={on ? { background: c.hex } : undefined} aria-hidden="true">
                      {on && (
                        <svg viewBox="0 0 24 24">
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
              <button type="button" className="gpk-addrow" onClick={() => setAdding(true)}>
                <span className="gpk-addrow-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                Add a gym
              </button>
            </div>
            <button type="button" className="gpk-primary gpk-start" disabled={!chosen} onClick={go}>
              <span className="gpk-dot" aria-hidden="true" />
              <span className="gpk-start-label">{mode === "switch" ? `Switch to ${chosen?.name ?? "…"}` : `Start at ${chosen?.name ?? "…"}`}</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
