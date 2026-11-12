"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clientAddGymAction, uploadGymLogoAction } from "../lib/actions";
import { newOnceKey } from "../lib/onceKey";
import { coverJpeg } from "../lib/coverJpeg";
import { pic } from "../lib/pic";
import { GYM_COLORS, GYM_COLOR_KEYS, GYM_KINDS, gymColor, initials, nextFreeColor, type GymColorKey, type GymKind } from "../lib/gymColors";
import RingEdge from "../components/RingEdge";
import "./gyms.css";

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
  /** The client's picture on the badge instead of the initials (17 Oct); null, the initials. */
  logo?: string | null;
  /** Trained at once (6 Nov, Alex): listed only on the session it was picked for. */
  once?: boolean;
};

// A gym's picture, square and small (17 Oct): tap the badge to add or change it.
export const shrink = (file: File) => coverJpeg(file, 320, 320);
export async function sendLogo(gymId: number, blob: Blob): Promise<string | null> {
  const fd = new FormData();
  fd.set("gymId", String(gymId));
  fd.set("file", new File([blob], "gym.jpg", { type: "image/jpeg" }));
  return uploadGymLogoAction(fd);
}

/** The badge's face: the picture when there is one, else the initials. */
export function BadgeFace({ name, logo }: { name: string; logo?: string | null }) {
  return logo ? <img className="gpk-badge-img" src={pic(logo, 480)} alt="" draggable={false} /> : <>{initials(name)}</>;
}

/** The little camera in the badge's corner that says it can take a picture. */
export const CameraDot = () => (
  <span className="gpk-badge-cam" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H8l1.5-2.5h5L16 7h3.5A1.5 1.5 0 0 1 21 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
    <RingEdge size={20} />
  </span>
);

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
  // A gym trained at once only on the session it was picked for (6 Nov, Alex: "just going to be this one time").
  const [list, setList] = useState<GymOption[]>(() => gyms.filter((g) => !g.once || g.id === gymId).sort(order));
  const [selected, setSelected] = useState<number | null>(() => (list.find((g) => g.id === gymId) ?? list.find((g) => g.lastUsed) ?? list[0])?.id ?? null);
  const chosen = list.find((g) => g.id === selected) ?? null;
  // No gyms yet: straight into the form, with no way back to an empty list.
  const [adding, setAdding] = useState(list.length === 0);
  // Just this once (6 Nov, Alex: a day pass on holiday): the same form with the name and picture alone, and the pick
  // goes straight to the session; the gym stays out of the list after it.
  const [once, setOnce] = useState(false);
  const firstGym = list.length === 0;
  // Leaving: the card shrinks away over .18s, then the caller hears.
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 180);
  };
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

  const added = (gym: GymOption) => {
    if (once) {
      try {
        navigator.vibrate?.(10);
      } catch {}
      onPick(gym);
      return;
    }
    setList((l) => [...l.filter((g) => g.id !== gym.id), gym]);
    setSelected(gym.id);
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

  // The form sets its own colour over this while it is open.
  const tint = gymColor(chosen?.color);
  const currentName = list.find((g) => g.id === gymId)?.name ?? null;
  const title = mode === "switch" ? "Switch gym" : "Where are you training?";
  const openForm = (asOnce: boolean) => {
    setOnce(asOnce);
    setAdding(true);
  };
  return createPortal(
    <div className={`gpk-overlay${closing ? " closing" : ""}`} onClick={close}>
      <div ref={card} className={`gpk-card${closing ? " closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="gpk-title" style={{ "--g": tint.hex, "--g-rgb": tint.rgb } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <span className="gpk-glow" aria-hidden="true" />
        <span className="gpk-wash" aria-hidden="true" />
        {adding ? (
          <AddGymForm
            existing={list}
            once={once}
            title={once ? "One-time gym" : firstGym ? "Where do you train?" : "Add a gym"}
            addLabel={once ? (mode === "switch" ? "Switch here" : "Start here") : "Add & select"}
            busyLabel={once ? "Starting…" : "Adding…"}
            send={(name, color, kind, onceKey) => clientAddGymAction(dayId, name, color, kind, once, onceKey)}
            sentKey={dayId}
            onBack={firstGym ? undefined : () => setAdding(false)}
            onAdded={added}
          />
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
                <RingEdge size={32} />
              </button>
            </div>
            <div className="gpk-rows" role="radiogroup" aria-label="Your gyms">
              {list.map((g, i) => {
                const c = GYM_COLORS[g.color];
                const on = g.id === selected;
                return (
                  <div key={g.id} className="gpk-row-wrap">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${g.name}, ${meta(g)}`}
                    tabIndex={on ? 0 : -1}
                    className={`gpk-row${on ? " on" : ""}`}
                    style={on ? { background: `rgba(${c.rgb},.07)`, boxShadow: `inset 0 0 0 2px ${c.hex}` } : undefined}
                    onClick={() => setSelected(g.id)}
                    onKeyDown={(e) => onRowKey(e, i)}
                  >
                    <span className="gpk-badge" style={{ background: c.hex }} aria-hidden="true">
                      <BadgeFace name={g.name} logo={g.logo} />
                    </span>
                    <span className="gpk-row-text">
                      <span className="gpk-row-name">{g.name}</span>
                      <span className="gpk-row-meta">{meta(g)}</span>
                    </span>
                    <span className={`gpk-radio${on ? " on" : ""}`} style={on ? { background: c.hex } : undefined} aria-hidden="true">
                      {on ? (
                        <svg viewBox="0 0 24 24">
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                      ) : (
                        <RingEdge size={24} stroke={1.5} />
                      )}
                    </span>
                  </button>
                  </div>
                );
              })}
              {/* The two ways to add, side by side (9 Nov, Alex: "sharing 50 50 the space"). Somewhere else today (6 Nov, Alex):
                  named, trained at, and never in this list again. */}
              <div className="gpk-addpair">
              <button type="button" className="gpk-addrow" onClick={() => openForm(true)}>
                <span className="gpk-addrow-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
                    <circle cx="12" cy="10" r="2.3" />
                  </svg>
                </span>
                One-time gym
              </button>
              <button type="button" className="gpk-addrow" onClick={() => openForm(false)}>
                <span className="gpk-addrow-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                Add a gym
              </button>
              </div>
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

/** What an add answers: the gym, or why not. */
export type AddedGym = Awaited<ReturnType<typeof clientAddGymAction>>;

/**
 * The Add a gym form (13 Oct), one for the picker and Settings · Gyms (12 Nov, Alex): the picture, the name, the colour and
 * the type (the name and picture alone for a one-time gym). The picture waits, shown from memory, until the gym exists.
 * Whose gyms they are is the caller's: `send` adds it, `onAdded` hears the gym.
 */
export function AddGymForm({
  existing,
  once = false,
  title,
  addLabel,
  busyLabel = "Adding…",
  send,
  sentKey,
  onBack,
  onClose,
  onAdded,
}: {
  /** The gyms a name may not repeat (a one-time gym's name may come again as one). */
  existing: { name: string; color?: string | null; once?: boolean }[];
  once?: boolean;
  title: string;
  addLabel: string;
  busyLabel?: string;
  send: (name: string, color: GymColorKey, kind: GymKind, onceKey: string) => Promise<AddedGym>;
  /** Where the add goes (the session's day, the client): part of what makes a retry the same add. */
  sentKey: number;
  /** The round back arrow on the left. */
  onBack?: () => void;
  /** The round ✕ on the right. */
  onClose?: () => void;
  onAdded: (gym: GymOption) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<GymColorKey>(() => nextFreeColor(existing));
  const [kind, setKind] = useState<GymKind>("gym");
  const [busy, setBusy] = useState(false);
  // A second tap while the add is out is nothing; the add that didn't go keeps its key for Try again (6 Nov).
  const addOut = useRef(false);
  const lastAdd = useRef<{ key: string; sent: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (words: string) => {
    setToast(words);
    setTimeout(() => setToast(null), 3000);
  };
  const clean = name.trim().replace(/\s+/g, " ");
  const duplicate = clean.length >= 2 && existing.some((g) => g.name.toLowerCase() === clean.toLowerCase() && !(once && g.once));
  const valid = clean.length >= 2 && !duplicate && !busy;
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const [newLogo, setNewLogo] = useState<{ blob: Blob; url: string } | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  useEffect(() => () => void (newLogo && URL.revokeObjectURL(newLogo.url)), [newLogo]);
  const onPicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoBusy(true);
    const blob = await shrink(file);
    setLogoBusy(false);
    if (!blob) return say("Couldn't read that picture.");
    setNewLogo({ blob, url: URL.createObjectURL(blob) });
  };

  const add = async () => {
    if (!valid || addOut.current) return;
    addOut.current = true;
    setBusy(true);
    const k: GymKind = once ? "gym" : kind;
    // Its one-time key, made as Add is tapped (6 Nov): sent again once the signal is back, or tried again unchanged after
    // it didn't go, it adds one gym.
    const sent = JSON.stringify([sentKey, clean, color, k, once]);
    const onceKey = lastAdd.current?.sent === sent ? lastAdd.current.key : newOnceKey();
    lastAdd.current = { key: onceKey, sent };
    let r: AddedGym | null;
    try {
      r = await send(clean, color, k, onceKey);
    } catch {
      r = null;
    }
    addOut.current = false;
    if (!r || "error" in r) {
      setBusy(false);
      return say(r?.error ?? "Couldn't add the gym. Try again.");
    }
    lastAdd.current = null;
    const logo = newLogo ? await sendLogo(r.id, newLogo.blob) : null;
    setBusy(false);
    onAdded({ id: r.id, name: r.name, color: r.color, kind: r.kind, sessions: 0, lastUsedAt: null, lastUsed: false, logo, once });
  };

  const tint = GYM_COLORS[color];
  return (
    <div className="gpk-content gpk-add" style={{ "--g": tint.hex, "--g-rgb": tint.rgb } as React.CSSProperties}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onPicture(e)} />
      <div className="gpk-head center">
        {onBack && (
          <button type="button" className="gpk-round" onClick={onBack} aria-label="Back to your gyms">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14.5 6-6 6 6 6" />
            </svg>
            <RingEdge size={32} />
          </button>
        )}
        <h2 id="gpk-title" className={`gpk-title sm${onClose ? " ads-title" : ""}`}>
          {title}
        </h2>
        {onClose && (
          <button type="button" className="gpk-round" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            <RingEdge size={32} />
          </button>
        )}
      </div>
      <div className="gpk-name-row">
        <button type="button" className={`gpk-badge big gpk-badge-btn${logoBusy ? " busy" : ""}`} style={{ background: tint.hex }} onClick={() => fileRef.current?.click()} aria-label={newLogo ? "Change the gym's picture" : "Add a picture of the gym"}>
          <BadgeFace name={name} logo={newLogo?.url} />
          <CameraDot />
        </button>
        <label className="gpk-field">
          <span className="gpk-label">Gym name</span>
          <span className={`gpk-input-box${clean.length >= 2 && !duplicate ? " valid" : ""}`}>
            <input
              ref={nameRef}
              className="gpk-input"
              value={name}
              maxLength={32}
              placeholder={once ? "e.g. Day pass, Koh Samui" : "e.g. PureGym Leeds"}
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
      {!once && (
        <>
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
              {GYM_KINDS.map((g) => (
                <button key={g.key} type="button" role="radio" aria-checked={g.key === kind} className={`gpk-seg-btn${g.key === kind ? " on" : ""}`} onClick={() => setKind(g.key)}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <p className="gpk-info">Weights you log here are kept separate from your other gyms.</p>
        </>
      )}
      <button type="button" className="gpk-primary" disabled={!valid} onClick={() => void add()}>
        {busy ? busyLabel : addLabel}
      </button>
      {toast && (
        <div className="gpk-toast" role="alert">
          {toast}
        </div>
      )}
    </div>
  );
}
