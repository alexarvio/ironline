"use client";

import { useState, useTransition } from "react";
import { uploadProgressPhotoAction } from "../lib/actions";
import { ArrowRightIcon, CameraIcon, CheckIcon, ChevronLeftIcon } from "../components/icons";
import { useOpenPhotos } from "./CheckInContext";
import PhotoPeriodHistoryRow, { type HistoryNote } from "./PhotoPeriodHistoryRow";

// Deliberately does not import from ../lib/queries (a "use client" file
// importing queries.ts breaks the dev server); page.tsx builds these props.

type Slot = { id: number; label: string; src: string | null };

export type ProgressPicturesProps = {
  clientId: number;
  /** The sheet open today, with every angle it asks for and the coach's
      note on how to take them. */
  openSheet: { period: string; title: string; openedLabel: string; slots: Slot[]; instructions: string | null } | null;
  /** Earlier sheets, newest first. */
  earlier: { period: string; title: string; photos: { slotId: number; label: string; src: string | null }[]; note: HistoryNote }[];
  /** "June": the month the oldest earlier sheet opened. */
  earlierSince: string | null;
  /** "7 Oct": when the next sheet opens. */
  nextLabel: string | null;
  /** Whether the coach has asked for any angle at all. */
  hasAngles: boolean;
};

// The client's progress pictures: the sheet open now, where each photo
// saves the moment it is added, and every earlier sheet with the coach's
// notes. A pushed layer in AppShell, reached from Home and the Account tab.
export default function ProgressPicturesScreen({ data, onBack }: { data: ProgressPicturesProps; onBack: () => void }) {
  // One earlier sheet open at a time: opening another closes this one.
  const [openPast, setOpenPast] = useState<string | null>(null);

  return (
    <>
      <header className="cn-header pp-app-header">
        <button type="button" className="cn-icon-btn pp-app-back" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <div className="pp-app-kicker">Your progress</div>
          <div className="pp-app-title">Progress pictures</div>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>

      <main className="pp-app-body">
        {data.openSheet ? (
          <OpenSheet clientId={data.clientId} sheet={data.openSheet} />
        ) : (
          !data.hasAngles && <p className="pp-app-empty">Your coach hasn&rsquo;t asked for progress pictures yet.</p>
        )}

        {data.earlier.length > 0 && (
          <section>
            <div className="pp-app-section-head">
              <span className="pp-app-section-title">Earlier sheets</span>
              {data.earlierSince && (
                <span className="pp-app-section-meta">
                  {data.earlier.length} since {data.earlierSince}
                </span>
              )}
            </div>
            <div className="pp-app-history">
              {data.earlier.map((s) => (
                <PhotoPeriodHistoryRow
                  key={s.period}
                  title={s.title}
                  photos={s.photos}
                  note={s.note}
                  open={openPast === s.period}
                  onToggle={() => setOpenPast((p) => (p === s.period ? null : s.period))}
                />
              ))}
            </div>
          </section>
        )}

        {data.hasAngles && (
          <p className="pp-app-foot">
            {data.nextLabel && `Next sheet opens ${data.nextLabel}. `}Only your coach sees these.
          </p>
        )}
      </main>
    </>
  );
}

// The open sheet. A slot opens a small sheet offering the camera or the
// library; the chosen photo uploads straight away, shown over its own
// preview until the server has it. There is no submit button.
function OpenSheet({ clientId, sheet }: { clientId: number; sheet: NonNullable<ProgressPicturesProps["openSheet"]> }) {
  // slot id → local preview of the photo on its way up
  const [uploading, setUploading] = useState<Record<number, string>>({});
  const [picking, setPicking] = useState<Slot | null>(null);
  const [failed, setFailed] = useState(false);
  const [, startUpload] = useTransition();

  const upload = (slot: Slot, file: File) => {
    const preview = URL.createObjectURL(file);
    setPicking(null);
    setFailed(false);
    setUploading((u) => ({ ...u, [slot.id]: preview }));
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("slotId", String(slot.id));
    fd.set("file", file);
    startUpload(async () => {
      try {
        await uploadProgressPhotoAction(fd);
      } catch {
        // On a weak connection the upload can drop; say so rather than
        // leaving the slot looking as if nothing was tried.
        setFailed(true);
      } finally {
        setUploading((u) => {
          const next = { ...u };
          delete next[slot.id];
          return next;
        });
        URL.revokeObjectURL(preview);
      }
    });
  };

  const inCount = sheet.slots.filter((s) => s.src).length;

  return (
    <section className="pp-app-open">
      <div className="pp-app-open-head">
        <div className="pp-app-open-top">
          <div>
            <div className="pp-app-open-eyebrow">Open now</div>
            <div className="pp-app-open-title">{sheet.title}</div>
          </div>
          <span className="pp-app-open-count">
            {inCount} of {sheet.slots.length}
          </span>
        </div>
        <div className="pp-app-bar" aria-hidden="true">
          {sheet.slots.map((s) => (
            <span key={s.id} className={`pp-app-bar-seg${uploading[s.id] ? " pending" : s.src ? " in" : ""}`} />
          ))}
        </div>
        <p className="pp-app-open-meta" role={failed ? "alert" : undefined}>
          {failed
            ? "That photo didn’t upload. Check your connection and try again."
            : `Opened ${sheet.openedLabel} · each photo saves as you add it`}
        </p>
      </div>

      <div className="pp-app-slots">
        {sheet.slots.map((s) => {
          const preview = uploading[s.id];
          return (
            <button
              key={s.id}
              type="button"
              className="pp-app-slot"
              disabled={!!preview}
              onClick={() => setPicking(s)}
              aria-label={`${s.label}: ${preview ? "uploading" : s.src ? "added, tap to replace" : "add photo"}`}
            >
              {preview ? (
                <span className="pp-app-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" />
                  <span className="pp-app-uploading">
                    <span className="pp-app-uploading-label">Uploading</span>
                    <span className="pp-app-uploading-bar" />
                  </span>
                </span>
              ) : s.src ? (
                <span className="pp-app-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.src} alt="" />
                  <span className="pp-app-tick" aria-hidden="true">
                    <CheckIcon />
                  </span>
                </span>
              ) : (
                <span className="pp-app-frame empty">
                  <span className="pp-app-add">
                    <CameraIcon />
                    <span className="pp-app-add-label">Add photo</span>
                  </span>
                </span>
              )}
              <span className="pp-app-slot-name">{s.label}</span>
            </button>
          );
        })}
      </div>

      {sheet.instructions && (
        <div className="pp-app-coach">
          <span className="pp-app-coach-label">From your coach</span>
          <p className="pp-app-coach-text">{sheet.instructions}</p>
        </div>
      )}

      {picking && (
        <div className="pp-app-sheet-scrim" role="presentation" onClick={() => setPicking(null)}>
          <div className="pp-app-sheet" role="dialog" aria-modal="true" aria-label={`Add ${picking.label}`} onClick={(e) => e.stopPropagation()}>
            <div className="pp-app-sheet-head">
              <span className="pp-app-sheet-title">{picking.label}</span>
              <span className="pp-app-sheet-sub">Only your coach sees this.</span>
            </div>
            {[
              { label: "Take a photo", capture: true },
              { label: "Choose from library", capture: false },
            ].map((o) => (
              <label key={o.label} className="pp-app-sheet-option">
                {o.label}
                <input
                  type="file"
                  accept="image/*"
                  capture={o.capture ? "environment" : undefined}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(picking, file);
                  }}
                />
              </label>
            ))}
            <button type="button" className="pp-app-sheet-cancel" onClick={() => setPicking(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// The Progress pictures row under the Account tab.
export function ProgressPicturesRow() {
  const openPhotos = useOpenPhotos();
  return (
    <button type="button" className="pp-app-account-btn" onClick={() => openPhotos?.()}>
      <span className="settings-data-row">
        <span className="home-dark-row-title">Progress pictures</span>
        <ArrowRightIcon />
      </span>
    </button>
  );
}
