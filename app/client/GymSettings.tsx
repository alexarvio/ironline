"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import RingEdge from "../components/RingEdge";
import { Bars } from "./Bars";
import SettingsFold from "./SettingsFold";
import { BadgeFace, CameraDot, sendLogo, shrink } from "./GymPickerDialog";
import { clientRemoveGymAction, clientRestoreGymAction, clientUpdateGymAction } from "../lib/actions";
import { GYM_COLORS, GYM_COLOR_KEYS, GYM_KINDS, gymColor, type GymColorKey, type GymKind } from "../lib/gymColors";
import { dayWords, monthWords } from "../lib/clientDates";
import type { GymDashboard } from "../lib/queries";
import "./gyms.css";

// Gyms in Settings (9 Nov, Alex: B of docs/boards/gym-settings-mockup.html; the picker only picks or adds now, after a
// long press there deleted a main gym): a row a gym, opening its own page: what was trained there, its picture, Edit and
// Delete. A deleted gym stays listed while it holds sessions, with Bring back.

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const hours = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h < 10 && m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
};
/** Home, Once or Deleted, then more. */
const state = (g: GymDashboard) => (g.deleted ? "Deleted" : g.once ? "Once" : g.home ? "Home" : null);

export default function GymSettings({ gyms }: { gyms: GymDashboard[] }) {
  const router = useRouter();
  const [list, setList] = useState(gyms);
  const sig = JSON.stringify(gyms);
  useEffect(() => {
    setList(gyms);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- by content: a re-read with the same figures changes nothing
  }, [sig]);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notBack, setNotBack] = useState<number | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const patch = (id: number, p: Partial<GymDashboard>) => setList((l) => l.map((g) => (g.id === id ? { ...g, ...p } : g)));
  const bringBack = async (id: number) => {
    if (busy != null) return;
    setBusy(id);
    setNotBack(null);
    let ok = false;
    try {
      ok = await clientRestoreGymAction(id);
    } catch {
      ok = false;
    }
    setBusy(null);
    if (!ok) {
      setNotBack(id);
      return;
    }
    patch(id, { deleted: false });
    router.refresh();
  };
  const shown = list.find((g) => g.id === open) ?? null;
  // Over Settings, as Settings is over the app: the next layer in the same grid.
  const host = shown ? anchor.current?.closest(".app-layer")?.parentElement : null;
  // Settings is out of reach behind the page, as the app is behind Settings.
  const covered = !!shown;
  useEffect(() => {
    const layer = anchor.current?.closest<HTMLElement>(".app-layer");
    if (!layer || !covered) return;
    layer.inert = true;
    return () => {
      layer.inert = false;
    };
  }, [covered]);
  return (
    <SettingsFold title="Gyms">
      <span ref={anchor} hidden />
      {list.length === 0 ? (
        <p className="home-dark-empty">None yet</p>
      ) : (
        <div className="gy-list">
          {list.map((g) => (
            <div key={g.id} className={`gy-row${g.deleted ? " gone" : ""}`}>
              <button type="button" className="gy-row-open" onClick={() => setOpen(g.id)}>
                <span className="gy-badge" style={{ background: gymColor(g.color ?? undefined).hex }} aria-hidden="true">
                  <BadgeFace name={g.name} logo={g.logo} />
                </span>
                <span className="gy-row-text">
                  <span className="gy-row-name">{g.name}</span>
                  <span className="gy-row-fact">
                    <Bars parts={[state(g), plural(g.sessions, "session")]} />
                  </span>
                </span>
                {!g.deleted && <ChevronRightIcon />}
              </button>
              {g.deleted && (
                <button type="button" className="gy-word" disabled={busy === g.id} onClick={() => void bringBack(g.id)}>
                  {notBack === g.id ? "Try again" : "Bring back"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {shown && host && createPortal(<GymPage key={shown.id} gym={shown} busy={busy === shown.id} failed={notBack === shown.id} onBack={() => setOpen(null)} onBringBack={() => void bringBack(shown.id)} onChange={(p) => patch(shown.id, p)} />, host)}
    </SettingsFold>
  );
}

function GymPage({ gym, busy, failed, onBack, onBringBack, onChange }: { gym: GymDashboard; busy: boolean; failed: boolean; onBack: () => void; onBringBack: () => void; onChange: (p: Partial<GymDashboard>) => void }) {
  const router = useRouter();
  const tint = gymColor(gym.color ?? undefined);
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notDeleted, setNotDeleted] = useState(false);
  // The picture: a plain button on a hidden field, so the phone's own picker opens in one tap (4 Nov, Alex).
  const fileRef = useRef<HTMLInputElement>(null);
  const [picBusy, setPicBusy] = useState(false);
  const [picFailed, setPicFailed] = useState(false);
  const onPicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPicBusy(true);
    setPicFailed(false);
    let logo: string | null = null;
    try {
      const blob = await shrink(file);
      logo = blob ? await sendLogo(gym.id, blob) : null;
    } catch {
      logo = null;
    }
    setPicBusy(false);
    if (!logo) {
      setPicFailed(true);
      return;
    }
    onChange({ logo });
    router.refresh();
  };
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setNotDeleted(false);
    let ok = false;
    try {
      ok = await clientRemoveGymAction(gym.id);
    } catch {
      ok = false;
    }
    setDeleting(false);
    if (!ok) {
      setNotDeleted(true);
      return;
    }
    setAsking(false);
    onChange({ deleted: true, home: false });
    onBack();
    router.refresh();
  };
  const max = Math.max(1, ...gym.months.map((m) => m.sessions));
  return (
    <div className="app-layer app-layer-push cn-screen gy-screen" style={{ "--g": tint.hex, "--g-rgb": tint.rgb } as React.CSSProperties}>
      <header className="cn-header">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">Gym</h1>
        </div>
        {/* Edit and Delete in the ⋯ (9 Nov, Alex), Delete asking in the menu itself as a chat message's does. */}
        {gym.deleted ? (
          <span className="cn-icon-spacer" aria-hidden="true" />
        ) : (
          <div className="gy-more">
            <button type="button" className="cn-icon-btn" onClick={() => (setMenuOpen((o) => !o), setAsking(false))} aria-label="More" aria-expanded={menuOpen}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="19" cy="12" r="1.7" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <span className="gy-menu-back" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div className="gy-menu" role="menu">
                  {asking ? (
                    <>
                      <span className="gy-menu-q">Delete {gym.name}?</span>
                      <span className="gy-foot-btns">
                        <button type="button" className="gy-word" disabled={deleting} onClick={() => setAsking(false)}>
                          Cancel
                        </button>
                        <button type="button" className="gy-word red" disabled={deleting} onClick={() => void remove()}>
                          Delete
                        </button>
                      </span>
                    </>
                  ) : (
                    <>
                      <button type="button" role="menuitem" className="gy-menu-row" onClick={() => (setMenuOpen(false), setEditing(true))}>
                        Edit
                      </button>
                      <button type="button" role="menuitem" className="gy-menu-row red" onClick={() => setAsking(true)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </header>
      <main className="gy-body">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onPicture(e)} />
        <div className="gy-hero">
          <button type="button" className={`gy-badge gy-hero-badge${picBusy ? " busy" : ""}`} style={{ background: tint.hex }} disabled={gym.deleted || picBusy} onClick={() => fileRef.current?.click()} aria-label={gym.logo ? `Change ${gym.name}'s picture` : `Add a picture of ${gym.name}`}>
            <BadgeFace name={gym.name} logo={gym.logo} />
            {!gym.deleted && <CameraDot />}
          </button>
          <div className="gy-hero-name">{gym.name}</div>
          {(state(gym) || gym.since) && (
            <div className="gy-hero-fact">
              <Bars parts={[state(gym), gym.since && `Since ${dayWords(gym.since)}`]} />
            </div>
          )}
          {picFailed && <div className="gy-hero-error">Picture not added. Try again</div>}
        </div>
        <div className="gy-big">
          <div>
            <strong>{gym.sessions}</strong>
            <span>Sessions</span>
          </div>
          <div>
            <strong>{gym.sets}</strong>
            <span>Sets</span>
          </div>
          <div>
            <strong>{hours(gym.minutes)}</strong>
            <span>Time</span>
          </div>
        </div>
        {gym.months.length > 0 && (
          <>
            <span className="gy-sec">Sessions by month</span>
            <div className="gy-months" aria-hidden="true">
              {gym.months.map((m) => (
                <i key={m.month} className={m.sessions ? undefined : "none"} style={{ height: `${Math.round((m.sessions / max) * 100)}%` }} />
              ))}
            </div>
            <div className="gy-mlab">
              {gym.months.map((m) => (
                <span key={m.month} aria-label={`${monthWords(`${m.month}-01`)}: ${plural(m.sessions, "session")}`}>
                  {monthWords(`${m.month}-01`, { short: true, year: false })}
                </span>
              ))}
            </div>
          </>
        )}
        {gym.top.length > 0 && (
          <>
            <span className="gy-sec">Most trained</span>
            {gym.top.map((e) => (
              <div key={e.name} className="gy-ex">
                <span>{e.name}</span>
                <span>{plural(e.sets, "set")}</span>
              </div>
            ))}
          </>
        )}
        {(failed || notDeleted) && <div className="gy-hero-error gy-foot-error">{failed ? "Not brought back. Try again" : "Not deleted. Try again"}</div>}
        {gym.deleted && (
          <div className="gy-foot">
            <button type="button" className="gy-word" disabled={busy} onClick={onBringBack}>
              Bring back
            </button>
          </div>
        )}
      </main>
      {editing && <EditGym gym={gym} onClose={() => setEditing(false)} onSaved={onChange} />}
    </div>
  );
}

/** The gym's name, colour and type, in the picker's own form (a once-only gym has its name alone, as it was added). */
function EditGym({ gym, onClose, onSaved }: { gym: GymDashboard; onClose: () => void; onSaved: (p: Partial<GymDashboard>) => void }) {
  const router = useRouter();
  const [name, setName] = useState(gym.name);
  const [color, setColor] = useState<GymColorKey>(() => (gym.color && gym.color in GYM_COLORS ? (gym.color as GymColorKey) : "navy"));
  const [kind, setKind] = useState<GymKind>(gym.kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = name.trim().replace(/\s+/g, " ");
  const valid = clean.length >= 2 && !busy;
  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    let why: string | null;
    try {
      why = await clientUpdateGymAction(gym.id, clean, color, kind);
    } catch {
      why = "Couldn't save the gym. Try again.";
    }
    setBusy(false);
    if (why) {
      setError(why);
      return;
    }
    onSaved({ name: clean, color, kind });
    onClose();
    router.refresh();
  };
  const tint = GYM_COLORS[color];
  return createPortal(
    <div className="gpk-overlay" onClick={onClose}>
      <div className="gpk-card" role="dialog" aria-modal="true" aria-labelledby="gy-edit-title" style={{ "--g": tint.hex, "--g-rgb": tint.rgb } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <div className="gpk-content gpk-add">
          <div className="gpk-head center">
            <h2 id="gy-edit-title" className="gpk-title sm ads-title">
              Edit gym
            </h2>
            <button type="button" className="gpk-round" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
              <RingEdge size={32} />
            </button>
          </div>
          <label className="gpk-field">
            <span className="gpk-label">Gym name</span>
            <span className={`gpk-input-box${clean.length >= 2 ? " valid" : ""}`}>
              <input className="gpk-input" value={name} maxLength={32} autoCapitalize="words" autoComplete="off" enterKeyHint="done" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void save())} />
            </span>
            {error && <span className="gpk-error">{error}</span>}
          </label>
          {!gym.once && (
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
                  {GYM_KINDS.map((k) => (
                    <button key={k.key} type="button" role="radio" aria-checked={k.key === kind} className={`gpk-seg-btn${k.key === kind ? " on" : ""}`} onClick={() => setKind(k.key)}>
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <button type="button" className="gpk-primary" disabled={!valid} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
