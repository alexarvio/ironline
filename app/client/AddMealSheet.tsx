"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CopyIcon } from "../components/icons";
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
export function DeleteMealDialog({ name, onCancel, onDelete }: { name: string; onCancel: () => void; onDelete: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return createPortal(
    <div className="gpk-overlay" onClick={onCancel}>
      <div className="gpk-card" role="alertdialog" aria-modal="true" aria-labelledby="ams-delete-title" onClick={(e) => e.stopPropagation()}>
        <div className="gpk-content">
          <h2 id="ams-delete-title" className="gpk-title sm ams-delete-title">
            Delete {name}?
          </h2>
          <div className="ams-ask">
            <button type="button" className="ams-cancel" onClick={onCancel} autoFocus>
              Cancel
            </button>
            <button type="button" className="ams-delete" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Add a meal (10 Nov, Alex): New meal or Copy a meal, in the gym picker's voice; Copy a meal shows every saved meal as the
// card it is in the diary, its picture and figures, and a tap puts it on the day as a card of its own.
export default function AddMealSheet({
  saved,
  busy,
  picture,
  onNew,
  onCopy,
  failed = false,
  onClose,
}: {
  failed?: boolean;
  saved: SavedMealCard[];
  busy: boolean;
  /** The sized copy of a saved meal's picture. */
  picture: (path: string) => string;
  onNew: () => void;
  onCopy: (id: number) => void;
  onClose: () => void;
}) {
  const [picking, setPicking] = useState(false);
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
            {picking && (
              <button type="button" className="gpk-round" onClick={() => setPicking(false)} aria-label="Back">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m14.5 6-6 6 6 6" />
                </svg>
                <RingEdge size={32} />
              </button>
            )}
            <h2 id="ams-title" className="gpk-title sm ads-title">
              {picking ? "Copy a meal" : "Add a meal"}
            </h2>
            <button type="button" className="gpk-round" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
              <RingEdge size={32} />
            </button>
          </div>
          {picking ? (
            saved.length === 0 ? null : (
              <>
                <SavedMealCards saved={saved} busy={busy} picture={picture} onCopy={onCopy} />
                {failed && (
                  <p className="fdi-photo-failed" role="alert">
                    Not added. Try again
                  </p>
                )}
              </>
            )
          ) : (
            <div className="gpk-rows">
              <button type="button" className="gpk-addrow" disabled={busy} onClick={onNew}>
                <span className="gpk-addrow-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                New meal
              </button>
              <button type="button" className="gpk-addrow" disabled={busy} onClick={() => setPicking(true)}>
                <span className="gpk-addrow-ico" aria-hidden="true">
                  <CopyIcon />
                </span>
                Copy a meal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
