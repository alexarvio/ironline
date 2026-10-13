"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { PhaseTrack } from "../lib/db";
import { resetCardCoverAction, uploadCardCoverAction } from "../lib/actions";
import { coverJpeg } from "../lib/coverJpeg";

// The client's own picture on a Home card (12 Oct). Press and hold a card
// on Home, or the row in Settings, and this sheet comes up: the picture as
// it is, "Choose from your photos" (the camera roll, cut to the card's
// shape in the browser and uploaded), and "Use {coach}'s picture" to go
// back to what the coach set. One picture a track, kept across phases.

export type CardCovers = Partial<Record<PhaseTrack, string>>;
const TRACK_LABEL: Record<PhaseTrack, string> = { lifestyle: "Lifestyle", training: "Training", nutrition: "Nutrition" };

/** A press held still for half a second: `onHold` fires, and the tap that
    would follow is swallowed. A press on a button, a field or a link is
    left to it; a finger that moves (a swipe, a scroll) is not a hold. */
export function useLongPress(onHold: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const held = useRef(false);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);
  useEffect(() => clear, [clear]);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const t = e.target as Element | null;
      if (t?.closest("button, a, input, label, select, textarea, [role=button], [role=radiogroup]")) return;
      clear();
      held.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        held.current = true;
        try {
          navigator.vibrate?.(10);
        } catch {}
        onHold();
      }, 500);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    // A hold's own tap, and the phone's save-image menu, go nowhere.
    onClickCapture: (e: React.MouseEvent) => {
      if (!held.current) return;
      held.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

export default function CardPictureSheet({
  clientId,
  track,
  coachName,
  shown,
  own,
  onSaved,
  onClose,
}: {
  clientId: number;
  track: PhaseTrack;
  coachName: string;
  /** The picture on the card now. */
  shown: string | null;
  /** The client chose this one; null, it is the coach's. */
  own: string | null;
  /** A new picture (an object URL for now) or null, back to the coach's. */
  onSaved: (track: PhaseTrack, url: string | null) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const pick = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    const blob = await coverJpeg(file);
    if (blob) {
      const url = URL.createObjectURL(blob);
      setPreview(url);
      const fd = new FormData();
      fd.set("clientId", String(clientId));
      fd.set("track", track);
      fd.set("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
      await uploadCardCoverAction(fd);
      onSaved(track, url);
      router.refresh();
      onClose();
    }
    setBusy(false);
  };
  const reset = async () => {
    if (busy) return;
    setBusy(true);
    await resetCardCoverAction(clientId, track);
    onSaved(track, null);
    router.refresh();
    setBusy(false);
    onClose();
  };
  const picture = preview ?? shown;
  return createPortal(
    <div className="cv-scrim" onClick={onClose}>
      <div className={`cv-sheet${busy ? " busy" : ""}`} role="dialog" aria-label={`${TRACK_LABEL[track]} card picture`} onClick={(e) => e.stopPropagation()}>
        <span className="cv-grab" aria-hidden="true" />
        <div className="cv-head">
          <span className="cv-thumb" data-track={track}>
            {/* eslint-disable-next-line @next/next/no-img-element -- an upload or a public file */}
            {picture && <img src={picture} alt="" />}
          </span>
          <div className="cv-head-text">
            <h2 className="cv-title">{TRACK_LABEL[track]} card</h2>
            <p className="cv-sub">{own ? "Your photo." : `${coachName}'s picture.`} Shown behind the card on Home.</p>
          </div>
        </div>
        <div className="cv-actions">
          <button type="button" className="cv-btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Saving…" : "Choose from your photos"}
          </button>
          {own && (
            <button type="button" className="cv-btn" disabled={busy} onClick={reset}>
              Use {coachName}&rsquo;s picture
            </button>
          )}
          <button type="button" className="cv-btn plain" onClick={onClose}>
            Cancel
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
    </div>,
    document.body
  );
}

/** Settings · Card pictures: a row a track with the picture as it is and
    Change, which opens the same sheet as a press-and-hold on Home. */
export function CardPicturesRows({ clientId, coachName, rows }: { clientId: number; coachName: string; rows: { track: PhaseTrack; /** The client's own; null, none. */ own: string | null; /** The coach's, behind the card when there is no own. */ coach: string | null }[] }) {
  const [open, setOpen] = useState<PhaseTrack | null>(null);
  // What was just chosen (or cleared), until the page comes back with it.
  const [fresh, setFresh] = useState<Partial<Record<PhaseTrack, string | null>>>({});
  const close = useCallback(() => setOpen(null), []);
  const row = rows.find((r) => r.track === open) ?? null;
  const ownOf = (r: { track: PhaseTrack; own: string | null }) => (r.track in fresh ? (fresh[r.track] ?? null) : r.own);
  const shownOf = (r: { track: PhaseTrack; own: string | null; coach: string | null }) => ownOf(r) ?? r.coach;
  return (
    <>
      {rows.map((r) => {
        const shown = shownOf(r);
        const own = ownOf(r);
        return (
          <button key={r.track} type="button" className="settings-data-row cv-row" onClick={() => setOpen(r.track)}>
            <span className="cv-row-thumb" data-track={r.track}>
              {/* eslint-disable-next-line @next/next/no-img-element -- an upload or a public file */}
              {shown && <img src={shown} alt="" />}
            </span>
            <div className="home-dark-row-body">
              <div className="home-dark-row-title">{TRACK_LABEL[r.track]}</div>
              <div className="home-dark-row-detail">{own ? "Your photo" : `${coachName}'s picture`}</div>
            </div>
            <span className="st-link-go" aria-hidden="true">›</span>
          </button>
        );
      })}
      {row && <CardPictureSheet clientId={clientId} track={row.track} coachName={coachName} shown={shownOf(row)} own={ownOf(row)} onSaved={(t, url) => setFresh((f) => ({ ...f, [t]: url }))} onClose={close} />}
    </>
  );
}
