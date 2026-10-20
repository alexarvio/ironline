"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { PhaseTrack } from "../lib/db";
import { discardCardPicturesAction, resetCardCoverAction, saveCardPicturesAction, stageCardPictureAction } from "../lib/actions";
import { coverJpeg } from "../lib/coverJpeg";

// The client's own picture on a Home card (12 Oct). Press and hold a card
// on Home, or the row in Settings, and this sheet comes up: the picture as
// it is, "Choose from your photos" (the camera roll, cut to the card's
// shape in the browser and uploaded), and "Use {coach}'s picture" to go
// back to what the coach set. Up to six a track (14 Oct), taking turns on
// the card and behind the track's banner; kept across phases.

export type CardCovers = Partial<Record<PhaseTrack, string[]>>;
const MAX_PICTURES = 6;
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
  own,
  coach,
  onSaved,
  onClose,
}: {
  clientId: number;
  track: PhaseTrack;
  coachName: string;
  /** The client's own pictures, in order; none, the coach's shows. */
  own: string[];
  /** The coach's picture, behind the card when there is no own. */
  coach: string | null;
  /** The client's own pictures as they are now; empty, back to the coach's. */
  onSaved: (track: PhaseTrack, pictures: string[]) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  // The grid as it is in the sheet (21 Oct, Alex): a new picture shows at once from the phone,
  // goes up in the background, and the card changes only on Done. Closing without Done keeps the card as it was.
  type Item = { key: string; preview: string; path: string | null; failed?: boolean };
  const [items, setItems] = useState<Item[]>(() => own.map((p) => ({ key: p, preview: p, path: p })));
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  const uploads = useRef(new Map<string, Promise<string | null>>());
  /** Put up in this sitting: thrown away if they don't end up on the card. */
  const staged = useRef<string[]>([]);
  const previews = useRef<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const discard = () => {
    if (staged.current.length) void discardCardPicturesAction(clientId, track, staged.current);
    staged.current = [];
  };
  const close = () => {
    if (saving) return;
    discard();
    onClose();
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // Several at once from the camera roll, all cut and sent together (they went one after another and felt slow).
  const pick = (files: FileList | null) => {
    if (!files?.length) return;
    const room = Math.max(0, MAX_PICTURES - itemsRef.current.length);
    const fresh = Array.from(files)
      .slice(0, room)
      .map((file, i) => {
        const preview = URL.createObjectURL(file);
        previews.current.push(preview);
        return { file, item: { key: `new-${files.length}-${i}-${preview}`, preview, path: null } as Item };
      });
    if (fileRef.current) fileRef.current.value = "";
    setItems((prev) => [...prev, ...fresh.map((f) => f.item)]);
    for (const { file, item } of fresh) {
      const job = (async () => {
        const blob = await coverJpeg(file);
        if (!blob) return null;
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("track", track);
        fd.set("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
        return stageCardPictureAction(fd).catch(() => null);
      })();
      uploads.current.set(item.key, job);
      void job.then((saved) => {
        if (saved) staged.current.push(saved);
        setItems((prev) => prev.map((x) => (x.key === item.key ? { ...x, path: saved, failed: !saved } : x)));
      });
    }
  };
  const remove = (key: string) => setItems((prev) => prev.filter((x) => x.key !== key));
  const changed = items.length !== own.length || items.some((x, i) => x.path !== own[i]);
  const uploading = items.some((x) => !x.path && !x.failed);
  const done = async () => {
    if (saving) return;
    if (!changed) return onClose();
    setSaving(true);
    await Promise.all(uploads.current.values());
    // What the grid holds once everything is up, in its order.
    const paths = itemsRef.current.map((x) => x.path).filter((p): p is string => !!p);
    await saveCardPicturesAction(clientId, track, paths);
    const unused = staged.current.filter((p) => !paths.includes(p));
    staged.current = [];
    if (unused.length) void discardCardPicturesAction(clientId, track, unused);
    onSaved(track, paths);
    router.refresh();
    onClose();
  };
  const reset = async () => {
    if (saving) return;
    setSaving(true);
    discard();
    await resetCardCoverAction(clientId, track);
    onSaved(track, []);
    router.refresh();
    onClose();
  };
  const full = items.length >= MAX_PICTURES;
  return createPortal(
    <div className="cv-scrim" onClick={close}>
      <div className={`cv-sheet${saving ? " busy" : ""}`} role="dialog" aria-label={`${TRACK_LABEL[track]} card pictures`} onClick={(e) => e.stopPropagation()}>
        <span className="cv-grab" aria-hidden="true" />
        <div className="cv-head">
          <div className="cv-head-text">
            <h2 className="cv-title">
              {TRACK_LABEL[track]} card <span className="cv-count">{items.length}/{MAX_PICTURES}</span>
            </h2>
            <p className="cv-sub">
              {items.length === 0
                ? `${coachName}'s picture shows. Yours go on the card on Home and behind the ${TRACK_LABEL[track]} screen; several take turns.`
                : "On the card on Home and behind the screen, taking turns."}
            </p>
          </div>
        </div>
        <div className="cv-grid">
          {items.map((x) => (
            <span key={x.key} className={`cv-cell${!x.path && !x.failed ? " up" : ""}${x.failed ? " failed" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- an upload, or the photo itself while it goes up */}
              <img src={x.preview} alt="" />
              <button type="button" disabled={saving} onClick={() => remove(x.key)} aria-label="Remove this picture">
                ×
              </button>
            </span>
          ))}
          {!full && (
            <button type="button" className="cv-cell cv-add" disabled={saving} onClick={() => fileRef.current?.click()} aria-label="Add pictures from your photos">
              <span className="cv-add-plus" aria-hidden="true">+</span>
              <span className="cv-add-text">Add</span>
            </button>
          )}
        </div>
        {/* Done first, as the thing to do (21 Oct, Alex); going back to the coach's picture the quiet option under it. */}
        <div className="cv-actions">
          <button type="button" className="cv-btn primary" disabled={saving} onClick={done}>
            {saving ? (uploading ? "Uploading…" : "Saving…") : "Done"}
          </button>
          {(items.length > 0 || own.length > 0) && (
            <button type="button" className="cv-btn plain" disabled={saving} onClick={reset}>
              Use {coachName}&rsquo;s picture
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
      </div>
    </div>,
    document.body
  );
}

/** Settings · Card pictures: a row a track with the picture as it is and
    Change, which opens the same sheet as a press-and-hold on Home. */
export function CardPicturesRows({ clientId, coachName, rows }: { clientId: number; coachName: string; rows: { track: PhaseTrack; /** The client's own, in order; none, the coach's shows. */ own: string[]; /** The coach's, behind the card when there is no own. */ coach: string | null }[] }) {
  const [open, setOpen] = useState<PhaseTrack | null>(null);
  // What was just chosen (or cleared), until the page comes back with it.
  const [fresh, setFresh] = useState<Partial<Record<PhaseTrack, string[]>>>({});
  const close = useCallback(() => setOpen(null), []);
  const row = rows.find((r) => r.track === open) ?? null;
  const ownOf = (r: { track: PhaseTrack; own: string[] }) => fresh[r.track] ?? r.own;
  const shownOf = (r: { track: PhaseTrack; own: string[]; coach: string | null }) => ownOf(r)[0] ?? r.coach;
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
              <div className="home-dark-row-detail">{own.length > 1 ? `${own.length} of your photos, taking turns` : own.length === 1 ? "Your photo" : `${coachName}'s picture`}</div>
            </div>
            <span className="st-link-go" aria-hidden="true">›</span>
          </button>
        );
      })}
      {row && <CardPictureSheet clientId={clientId} track={row.track} coachName={coachName} own={ownOf(row)} coach={row.coach} onSaved={(t, pictures) => setFresh((f) => ({ ...f, [t]: pictures }))} onClose={close} />}
    </>
  );
}
