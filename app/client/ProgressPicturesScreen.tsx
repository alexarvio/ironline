"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

const NO_NOTE: HistoryNote = { shape: "", strengths: "", improvements: "", next_steps: "" };

// The client's progress pictures: the sheet open now, filled in and sent
// with Save like a check-in, and a feed of every earlier sheet below, all
// folded until opened. A pushed layer in AppShell, from Home and Account.
export default function ProgressPicturesScreen({ data, onBack }: { data: ProgressPicturesProps; onBack: () => void }) {
  // One earlier sheet open at a time: opening another closes this one.
  const [openPast, setOpenPast] = useState<string | null>(null);
  // Photos picked but not sent yet; leaving would lose them, so Back asks.
  const [unsent, setUnsent] = useState(false);
  const back = () => {
    if (unsent && !window.confirm("Your new pictures aren’t sent yet. Leave without sending them?")) return;
    onBack();
  };

  return (
    <>
      <header className="cn-header pp-app-header">
        <button type="button" className="cn-icon-btn pp-app-back" onClick={back} aria-label="Back">
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
          <OpenSheet clientId={data.clientId} sheet={data.openSheet} onUnsentChange={setUnsent} />
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

type Staged = { file: File; preview: string };

// The open sheet, like a check-in: pick a photo for each angle (it waits on
// the phone, outlined), press Save to send them, and the sheet folds into a
// row like the earlier ones, with Edit inside to reopen it. Save sends one
// photo at a time so a weak connection fails on one photo, not all of them.
function OpenSheet({
  clientId,
  sheet,
  onUnsentChange,
}: {
  clientId: number;
  sheet: NonNullable<ProgressPicturesProps["openSheet"]>;
  onUnsentChange: (unsent: boolean) => void;
}) {
  const [staged, setStaged] = useState<Record<number, Staged>>({});
  // Picked photos that have already gone up during the current Save.
  const [sent, setSent] = useState<number[]>([]);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [picking, setPicking] = useState<Slot | null>(null);
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  // Whether the folded "sent" row is opened up.
  const [sentOpen, setSentOpen] = useState(false);
  const [saving, startSaving] = useTransition();

  // Every preview made on this visit, released when the screen closes.
  const previews = useRef<string[]>([]);
  useEffect(() => {
    const made = previews.current;
    return () => made.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const stagedCount = Object.keys(staged).length;
  useEffect(() => {
    onUnsentChange(stagedCount > 0);
  }, [stagedCount, onUnsentChange]);

  const total = sheet.slots.length;
  const inCount = sheet.slots.filter((s) => s.src).length;
  // Folded once something has been sent and nothing new is waiting.
  const collapsed = inCount > 0 && stagedCount === 0 && !editing && !saving;

  const pick = (slot: Slot, file: File) => {
    const preview = URL.createObjectURL(file);
    previews.current.push(preview);
    setPicking(null);
    setFailed(false);
    setJustSaved(false);
    setStaged((s) => ({ ...s, [slot.id]: { file, preview } }));
  };

  const save = () => {
    const queue = sheet.slots.filter((s) => staged[s.id]).map((s) => ({ slot: s, item: staged[s.id] }));
    if (queue.length === 0) return;
    setFailed(false);
    startSaving(async () => {
      const done: number[] = [];
      for (const { slot, item } of queue) {
        setUploadingId(slot.id);
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("slotId", String(slot.id));
        fd.set("file", item.file);
        try {
          await uploadProgressPhotoAction(fd);
          done.push(slot.id);
          setSent([...done]);
        } catch {
          // Stop at the first failure; what did not go up stays ready.
          setFailed(true);
          break;
        }
      }
      // Land together with the refreshed sheet, so a sent slot never
      // flashes empty between its preview and the saved photo.
      startSaving(() => {
        setUploadingId(null);
        setSent([]);
        setStaged((s) => {
          const next = { ...s };
          done.forEach((id) => delete next[id]);
          return next;
        });
        if (done.length === queue.length) {
          setEditing(false);
          setJustSaved(true);
          setSentOpen(false);
        }
      });
    });
  };

  const cancel = () => {
    setStaged({});
    setFailed(false);
    setEditing(false);
  };

  // Sent: the open sheet folds into a row like the earlier sheets below it,
  // closed by default, with Edit inside to change a photo.
  if (collapsed) {
    return (
      <section>
        <PhotoPeriodHistoryRow
          title={sheet.title}
          photos={sheet.slots.map((s) => ({ slotId: s.id, label: s.label, src: s.src }))}
          note={NO_NOTE}
          open={sentOpen}
          onToggle={() => setSentOpen((o) => !o)}
          metaExtra={justSaved ? "just sent" : "sent"}
          footer={
            <button
              type="button"
              className="pp-app-edit-photos"
              onClick={() => {
                setEditing(true);
                setJustSaved(false);
                setSentOpen(false);
              }}
            >
              Edit photos
            </button>
          }
        />
      </section>
    );
  }

  return (
    <section className="pp-app-open">
      <div className="pp-app-open-head">
        <div className="pp-app-open-top">
          <div>
            <div className="pp-app-open-eyebrow">Open now</div>
            <div className="pp-app-open-title">{sheet.title}</div>
          </div>
          <span className="pp-app-open-count">
            {inCount} of {total}
          </span>
        </div>
        <div className="pp-app-bar" aria-hidden="true">
          {sheet.slots.map((s) => {
            const waiting = !!staged[s.id] && !sent.includes(s.id);
            return <span key={s.id} className={`pp-app-bar-seg${waiting ? " pending" : s.src || sent.includes(s.id) ? " in" : ""}`} />;
          })}
        </div>
        <p className="pp-app-open-meta" role={failed ? "alert" : undefined}>
          {failed
            ? "A photo didn’t send. Check your connection and press Save again."
            : `Opened ${sheet.openedLabel} · add a photo for each angle, then Save`}
        </p>
      </div>

      <div className="pp-app-slots">
        {sheet.slots.map((s) => {
          const item = staged[s.id];
          const uploading = uploadingId === s.id;
          const src = item?.preview ?? s.src;
          const ticked = item ? sent.includes(s.id) : !!s.src;
          const ready = !!item && !ticked && !uploading;
          return (
            <button
              key={s.id}
              type="button"
              className="pp-app-slot"
              disabled={saving}
              onClick={() => setPicking(s)}
              aria-label={`${s.label}: ${uploading ? "sending" : ready ? "ready to send, tap to change" : ticked ? "sent, tap to replace" : "add photo"}`}
            >
              {src ? (
                <span className={`pp-app-frame${ready ? " ready" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" />
                  {uploading && (
                    <span className="pp-app-uploading">
                      <span className="pp-app-uploading-label">Uploading</span>
                      <span className="pp-app-uploading-bar" />
                    </span>
                  )}
                  {ticked && !uploading && (
                    <span className="pp-app-tick" aria-hidden="true">
                      <CheckIcon />
                    </span>
                  )}
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

      <div className="pp-app-save">
        <span className="pp-app-save-text">
          {saving
            ? "Sending…"
            : stagedCount > 0
            ? `${stagedCount} ${stagedCount === 1 ? "photo" : "photos"} ready to send`
            : `${inCount} of ${total} with your coach`}
        </span>
        <span className="pp-app-save-actions">
          {stagedCount > 0 && inCount > 0 && !saving && (
            <button type="button" className="pp-app-save-cancel" onClick={cancel}>
              Cancel
            </button>
          )}
          {stagedCount === 0 && editing && !saving ? (
            <button type="button" className="pp-app-save-btn secondary" onClick={() => setEditing(false)}>
              Done
            </button>
          ) : (
            <button type="button" className="pp-app-save-btn" onClick={save} disabled={stagedCount === 0 || saving}>
              {saving ? "Sending…" : "Save"}
            </button>
          )}
        </span>
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
                    if (file) pick(picking, file);
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
