"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { PhaseTrack } from "../lib/db";
import { discardCardPicturesAction, resetCardCoverAction, saveCardPicturesAction, stageCardPictureAction } from "../lib/actions";
import { coverJpeg } from "../lib/coverJpeg";
import { pic } from "../lib/pic";

// The client's own picture on a Home card (12 Oct). Press and hold a card
// on Home and this sheet comes up: the picture as it is, "Choose from your
// photos" (the camera roll, cut to the card's shape in the browser and
// uploaded), and "Use {coach}'s picture" to go back to what the coach set
// ("Use the default" when the coach chose none, 22 Oct). Up to six a track
// (14 Oct), taking turns on the card and behind the track's banner; kept
// across phases. Settings (23 Oct, Alex) lists the tracks by name instead,
// each folding open in place on its photos, every change saved at once.

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

/** A photo picked: shown at once from the phone while it goes up; the job
    comes back with its staged path, or null when it failed. */
type Upload = { key: string; preview: string; job: Promise<string | null> };

/** The uploads the sheet and Settings share: several at once from the camera
    roll, each cut to the card's shape in the browser and staged; what was put
    up and never kept is thrown away. */
function useCardUploads(clientId: number, track: PhaseTrack) {
  /** Put up in this sitting and not on the card (yet). */
  const staged = useRef<string[]>([]);
  const previews = useRef<string[]>([]);
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  // All cut and sent together (they went one after another and felt slow).
  const send = useCallback(
    (files: File[]): Upload[] =>
      files.map((file, i) => {
        const preview = URL.createObjectURL(file);
        previews.current.push(preview);
        const job = (async () => {
          const blob = await coverJpeg(file);
          if (!blob) return null;
          const fd = new FormData();
          fd.set("clientId", String(clientId));
          fd.set("track", track);
          fd.set("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
          return stageCardPictureAction(fd).catch(() => null);
        })();
        void job.then((saved) => {
          if (saved) staged.current.push(saved);
        });
        return { key: `new-${files.length}-${i}-${preview}`, preview, job };
      }),
    [clientId, track]
  );
  /** These made it onto the card: nothing to throw away. */
  const kept = useCallback((paths: string[]) => {
    staged.current = staged.current.filter((p) => !paths.includes(p));
  }, []);
  /** These (else everything staged) are not kept: their files go. */
  const discard = useCallback(
    (paths?: string[]) => {
      const gone = paths ?? staged.current;
      staged.current = staged.current.filter((p) => !gone.includes(p));
      if (gone.length) void discardCardPicturesAction(clientId, track, gone);
    },
    [clientId, track]
  );
  return { send, kept, discard };
}

export default function CardPictureSheet({
  clientId,
  track,
  coachName,
  own,
  coachChose,
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
  /** The coach chose that picture (22 Oct); else it is the default, not "{coach}'s picture". */
  coachChose: boolean;
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
  /** Where each new one landed, as it lands (the grid's state may not have caught up when Done reads it). */
  const landed = useRef(new Map<string, string | null>());
  const { send, kept, discard } = useCardUploads(clientId, track);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
  const pick = (files: FileList | null) => {
    if (!files?.length) return;
    const room = Math.max(0, MAX_PICTURES - itemsRef.current.length);
    const fresh = send(Array.from(files).slice(0, room));
    if (fileRef.current) fileRef.current.value = "";
    setItems((prev) => [...prev, ...fresh.map((u): Item => ({ key: u.key, preview: u.preview, path: null }))]);
    for (const u of fresh) {
      uploads.current.set(u.key, u.job);
      void u.job.then((saved) => {
        landed.current.set(u.key, saved);
        setItems((prev) => prev.map((x) => (x.key === u.key ? { ...x, path: saved, failed: !saved } : x)));
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
    const paths = itemsRef.current.map((x) => x.path ?? landed.current.get(x.key) ?? null).filter((p): p is string => !!p);
    await saveCardPicturesAction(clientId, track, paths);
    kept(paths);
    discard();
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
            {items.length === 0 && <p className="cv-sub">{`${coachChose ? `${coachName}'s picture` : "The default picture"} shows.`}</p>}
          </div>
        </div>
        <div className="cv-grid">
          {items.map((x) => (
            <span key={x.key} className={`cv-cell${!x.path && !x.failed ? " up" : ""}${x.failed ? " failed" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- an upload, or the photo itself while it goes up */}
              <img src={pic(x.preview, 480)} alt="" />
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
              {coachChose ? <>Use {coachName}&rsquo;s picture</> : "Use the default"}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
      </div>
    </div>,
    document.body
  );
}

type Row = {
  track: PhaseTrack;
  /** The client's own, in order; none, the coach's shows. */
  own: string[];
  /** The coach's, behind the card when there is no own. */
  coach: string | null;
  /** The coach chose it (22 Oct); else it is the default picture. */
  coachChose: boolean;
};

/** Settings · Card pictures (23 Oct, Alex): a row a track, its name alone
    with a chevron; a tap folds it open in place on its photos, one track at
    a time. Add, remove and going back to the coach's picture all save at once. */
export function CardPicturesRows({ clientId, coachName, rows }: { clientId: number; coachName: string; rows: Row[] }) {
  const [open, setOpen] = useState<PhaseTrack | null>(null);
  // What was just saved (or cleared), until the page comes back with it.
  const [fresh, setFresh] = useState<Partial<Record<PhaseTrack, string[]>>>({});
  const onSaved = useCallback((t: PhaseTrack, pictures: string[]) => setFresh((f) => ({ ...f, [t]: pictures })), []);
  return (
    <>
      {rows.map((r) => (
        <CardPictureFold
          key={r.track}
          clientId={clientId}
          coachName={coachName}
          row={r}
          own={fresh[r.track] ?? r.own}
          open={open === r.track}
          onToggle={() => setOpen((o) => (o === r.track ? null : r.track))}
          onSaved={onSaved}
        />
      ))}
    </>
  );
}

/** A photo on its way up, after the ones already on the card. */
type Pending = { key: string; preview: string; path?: string | null; failed?: boolean };

function CardPictureFold({
  clientId,
  coachName,
  row,
  own,
  open,
  onToggle,
  onSaved,
}: {
  clientId: number;
  coachName: string;
  row: Row;
  own: string[];
  open: boolean;
  onToggle: () => void;
  onSaved: (track: PhaseTrack, pictures: string[]) => void;
}) {
  const { track, coach, coachChose } = row;
  const router = useRouter();
  const { send, kept, discard } = useCardUploads(clientId, track);
  const [pending, setPending] = useState<Pending[]>([]);
  /** A photo just put up keeps showing from the phone, not fetched again. */
  const [shownAs, setShownAs] = useState<Record<string, string>>({});
  /** The photo whose × was tapped: Remove over it until it is tapped, or a tap elsewhere keeps it. */
  const [asking, setAsking] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // The card's list as last saved, for what lands later; set the moment a change is saved.
  const ownRef = useRef(own);
  useEffect(() => {
    ownRef.current = own;
  }, [own]);
  /** Going back to the coach's picture leaves the photos still going up out. */
  const gen = useRef(0);
  /** Saves go one after another, so they land in the order they were made. */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  /** Each go of picked photos lands after the go before it, so the card keeps the order they were picked in. */
  const lastBatch = useRef<Promise<unknown>>(Promise.resolve());
  const commit =(next: string[], save: () => Promise<unknown>) => {
    ownRef.current = next;
    onSaved(track, next);
    chain.current = chain.current
      .then(save)
      .catch(() => {})
      .then(() => router.refresh());
  };
  useEffect(() => {
    if (!asking) return;
    const off = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest(".cv-fold-x, .cv-fold-remove")) return;
      setAsking(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAsking(null);
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", off);
      document.removeEventListener("keydown", esc);
    };
  }, [asking]);

  const going = pending.filter((x) => !x.failed).length;
  const pick = (files: FileList | null) => {
    const room = Math.max(0, MAX_PICTURES - own.length - going);
    const list = files ? Array.from(files).slice(0, room) : [];
    if (fileRef.current) fileRef.current.value = "";
    if (!list.length) return;
    const ups = send(list);
    const at = gen.current;
    setPending((prev) => [...prev, ...ups.map((u): Pending => ({ key: u.key, preview: u.preview }))]);
    for (const u of ups) void u.job.then((path) => setPending((prev) => prev.map((x) => (x.key === u.key ? { ...x, path, failed: !path } : x))));
    // Once every photo picked in this go is up, the card's list is saved with them after it, in order.
    const turn = lastBatch.current.then(() => Promise.all(ups.map((u) => u.job)));
    lastBatch.current = turn.catch(() => {});
    void turn.then((paths) => {
      const up = paths.filter((p): p is string => !!p);
      if (at !== gen.current) return discard(up);
      const keys = new Set(ups.map((u) => u.key));
      const failed = new Set(ups.filter((_, i) => !paths[i]).map((u) => u.key));
      if (up.length) {
        const next = [...ownRef.current, ...up].slice(0, MAX_PICTURES);
        const over = up.filter((p) => !next.includes(p));
        kept(up);
        if (over.length) discard(over);
        setShownAs((s) => {
          const m = { ...s };
          ups.forEach((u, i) => {
            const p = paths[i];
            if (p) m[p] = u.preview;
          });
          return m;
        });
        commit(next, () => saveCardPicturesAction(clientId, track, next));
      }
      // The ones up are on the card now; one that failed shows so a moment, then goes.
      setPending((prev) => prev.filter((x) => !keys.has(x.key) || failed.has(x.key)));
      if (failed.size) setTimeout(() => setPending((prev) => prev.filter((x) => !failed.has(x.key))), 2000);
    });
  };
  const remove = (p: string) => {
    setAsking(null);
    const next = ownRef.current.filter((x) => x !== p);
    commit(next, () => saveCardPicturesAction(clientId, track, next));
  };
  const reset = () => {
    gen.current += 1;
    setAsking(null);
    setPending([]);
    commit([], () => resetCardCoverAction(clientId, track));
  };

  const full = own.length + going >= MAX_PICTURES;
  // None of their own: the picture the card shows instead, as the one photo.
  const standIn = !own.length && !pending.length;
  const bodyId = `cv-fold-${track}`;
  return (
    <div className="cv-fold">
      <button type="button" className="settings-data-row cv-fold-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className="home-dark-row-title">{TRACK_LABEL[track]}</span>
        <span className={`cv-fold-chev${open ? " open" : ""}`} aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <div id={bodyId} className={`cv-fold-wrap${open ? " open" : ""}`} inert={!open}>
        <div className="cv-fold-clip">
          <div className="cv-fold-body">
            <div className="cv-fold-grid">
              {standIn && coach && (
                <span className="cv-fold-pic stand">
                  {/* eslint-disable-next-line @next/next/no-img-element -- an upload or a public file */}
                  <img src={pic(coach, 480)} alt="" />
                </span>
              )}
              {own.map((p) => (
                <span key={p} className={`cv-fold-pic${asking === p ? " asking" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- an upload, or the photo itself just put up */}
                  <img src={shownAs[p] ?? pic(p, 480)} alt="" />
                  {asking === p && (
                    <button type="button" className="cv-fold-remove" onClick={() => remove(p)}>
                      Remove
                    </button>
                  )}
                  <button type="button" className="cv-fold-x" onClick={() => setAsking((a) => (a === p ? null : p))} aria-label={asking === p ? "Keep this picture" : "Remove this picture"}>
                    <span aria-hidden="true">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </span>
                  </button>
                </span>
              ))}
              {pending.map((x) => (
                <span key={x.key} className={`cv-fold-pic${!x.path && !x.failed ? " up" : ""}${x.failed ? " failed" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the photo itself while it goes up */}
                  <img src={x.preview} alt="" />
                </span>
              ))}
              {!full && (
                <button type="button" className="cv-fold-add" onClick={() => fileRef.current?.click()} aria-label="Add pictures from your photos">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <span>Add</span>
                </button>
              )}
            </div>
            {standIn ? (
              <p className="cv-fold-words">{coachChose ? `${coachName}'s picture` : "Default picture"}</p>
            ) : own.length > 0 ? (
              <button type="button" className="cv-fold-reset" onClick={reset}>
                {coachChose ? <>Use {coachName}&rsquo;s picture</> : "Use the default"}
              </button>
            ) : null}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
          </div>
        </div>
      </div>
    </div>
  );
}
