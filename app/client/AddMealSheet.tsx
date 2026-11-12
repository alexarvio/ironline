"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BookmarkIcon, CopyIcon } from "../components/icons";
import RingEdge from "../components/RingEdge";
import "./gyms.css";

export type SavedMealCard = { id: number; name: string; kcal: number; protein: number; carbs: number; fat: number; picture: string | null; thumb: string | null };

/** Every saved meal as the card it is in the diary, a tap using it. Copy a meal's and the Saved meals screen's. */
export function SavedMealCards({ saved, busy, picture, onCopy }: { saved: SavedMealCard[]; busy: boolean; picture: (path: string) => string; onCopy: (id: number) => void }) {
  return (
    <div className="ams-cards">
      {saved.map((s) => (
        <button key={s.id} type="button" className={`fdc-card ams-card${s.picture ? "" : " bare"}`} disabled={busy} onClick={() => onCopy(s.id)}>
          <span className="fdc-bg" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- the client’s own upload */}
            {s.picture && <img src={picture(s.picture)} alt="" draggable={false} decoding="async" style={s.thumb ? { backgroundImage: `url(${s.thumb})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />}
          </span>
          <span className="fdc-name">
            <span className="fdc-title">{s.name}</span>
          </span>
          <span className="fdc-figs">
            <b>{s.kcal.toLocaleString("en-GB")} kcal</b>
            <span>P {s.protein}</span>
            <span>C {s.carbs}</span>
            <span>F {s.fat}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Deleting a meal, from a ⋯ on its card (10 Nov, Alex: "a pop up asking for confirmation"): the day's and a saved meal's. */
export function DeleteMealDialog({ name, text, onCancel, onDelete }: { name: string; /** One plain sentence on what goes with it and what stays (11 Nov, Alex: A of docs/boards/popup-anatomy-mockup.html); none when nothing needs saying. */ text?: string | null; onCancel: () => void; onDelete: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return createPortal(
    <div className="gpk-overlay" onClick={onCancel}>
      <div className="gpk-card" role="alertdialog" aria-modal="true" aria-labelledby="ams-delete-title" aria-describedby={text ? "ams-delete-text" : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="gpk-content">
          <h2 id="ams-delete-title" className="gpk-title sm ams-delete-title">
            Delete {name}?
          </h2>
          {text && (
            <p id="ams-delete-text" className="ams-text">
              {text}
            </p>
          )}
          <div className="ams-ask">
            <button type="button" className="ams-cancel" onClick={onCancel} autoFocus>
              Cancel
            </button>
            <button type="button" className="ams-danger" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Copy a meal from a meal's own search (11 Nov, Alex: "the copy a meal needs to be a bit cleaner… pop up with saved
 * meals"): Add a meal's Copy a meal on its own, every saved meal as its card, a tap putting its foods into that meal. */
export function CopyMealDialog({
  saved,
  busy,
  picture,
  onCopy,
  failed = false,
  onClose,
}: {
  saved: SavedMealCard[];
  busy: boolean;
  picture: (path: string) => string;
  onCopy: (id: number) => void;
  failed?: boolean;
  onClose: () => void;
}) {
  // While a copy is on its way the pop-up stays, so its answer (and a failure) is seen.
  const close = () => {
    if (!busy) onClose();
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  // The pop-up takes the focus from the search box behind it: typing and Escape no longer reach it, and a phone's keyboard goes.
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    card.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return createPortal(
    <div className="gpk-overlay" onClick={close}>
      <div ref={card} tabIndex={-1} className="gpk-card" role="dialog" aria-modal="true" aria-labelledby="ams-copy-title" onClick={(e) => e.stopPropagation()} style={{ outline: "none" }}>
        <div className="gpk-content">
          <div className="gpk-head center">
            <h2 id="ams-copy-title" className="gpk-title sm ads-title">
              Copy a meal
            </h2>
            <button type="button" className="gpk-round" onClick={close} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
              <RingEdge size={32} />
            </button>
          </div>
          <SavedMealCards saved={saved} busy={busy} picture={picture} onCopy={onCopy} />
          {failed && (
            <p className="fdi-photo-failed" role="alert">
              Not added. Try again
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Add a meal (10 Nov, Alex), in the gym picker's voice. Since 12 Nov (Alex: A of docs/boards/saved-other-ways-mockup.html,
// "four pills together… I don't like it") it is also the one way to what is saved: New meal; Copy a meal, the Saved
// meals screen (every saved meal as its card, Use, Create a meal); Use a saved day, the Saved days screen. Each with its
// count, grey; none, no count.
export default function AddMealSheet({
  busy,
  meals,
  days,
  onNew,
  onMeals,
  onDays,
  onClose,
}: {
  busy: boolean;
  /** How many saved meals and saved days there are. */
  meals: number;
  days: number;
  onNew: () => void;
  onMeals: () => void;
  onDays: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="gpk-overlay" onClick={onClose}>
      <div className="gpk-card" role="dialog" aria-modal="true" aria-labelledby="ams-title" onClick={(e) => e.stopPropagation()}>
        <div className="gpk-content">
          <div className="gpk-head center">
            <h2 id="ams-title" className="gpk-title sm ads-title">
              Add a meal
            </h2>
            <button type="button" className="gpk-round" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
              <RingEdge size={32} />
            </button>
          </div>
          <div className="gpk-rows">
            <button type="button" className="gpk-addrow" disabled={busy} onClick={onNew}>
              <span className="gpk-addrow-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              New meal
            </button>
            <button type="button" className="gpk-addrow" disabled={busy} onClick={onMeals}>
              <span className="gpk-addrow-ico" aria-hidden="true">
                <CopyIcon />
              </span>
              Copy a meal
              {meals > 0 && <span className="ams-count">{meals}</span>}
            </button>
            <button type="button" className="gpk-addrow" disabled={busy} onClick={onDays}>
              <span className="gpk-addrow-ico" aria-hidden="true">
                <BookmarkIcon />
              </span>
              Use a saved day
              {days > 0 && <span className="ams-count">{days}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
