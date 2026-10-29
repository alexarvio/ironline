"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { removeProgressPhotoAction, uploadProgressPhotoAction } from "../lib/actions";
import { fitJpeg } from "../lib/coverJpeg";
import { ArrowRightIcon, ChevronLeftIcon } from "../components/icons";
import { useOpenPhotos } from "./CheckInContext";
import CoachSays from "./CoachSays";
import FitTitle from "./FitTitle";
import ProgressCompare from "./ProgressCompare";
import PhotoDeck from "./PhotoDeck";
import PhotoPeriodHistoryRow from "./PhotoPeriodHistoryRow";
import { landOnSoon } from "../lib/landOn";

// Deliberately does not import from ../lib/queries (a "use client" file
// importing queries.ts breaks the dev server); page.tsx builds these props.

type Slot = { id: number; label: string; src: string | null; /** The coach's word on how to take it (21 Oct). */ hint?: string | null };

export type ProgressPicturesProps = {
  clientId: number;
  /** The sheet open today, with every angle it asks for and the coach's
      note on how to take them. */
  openSheet: { period: string; title: string; openedLabel: string; slots: Slot[]; instructions: string | null } | null;
  /** Earlier sheets, newest first. */
  earlier: { period: string; title: string; photos: { slotId: number; label: string; src: string | null }[] }[];
  /** "June": the month the oldest earlier sheet opened. */
  earlierSince: string | null;
  /** "7 Oct": when the next sheet opens. */
  nextLabel: string | null;
  /** Whether the coach has asked for any angle at all. */
  hasAngles: boolean;
};


// The client's progress pictures: the sheet open now, filled in and sent
// with Save like a check-in, and a feed of every earlier sheet below, all
// folded until opened. A pushed layer in AppShell, from Home and Account.
export default function ProgressPicturesScreen({
  data,
  initialPeriod = null,
  onBack,
}: {
  data: ProgressPicturesProps;
  /** A coach message linked this sheet: open it, and bring it into view. */
  initialPeriod?: string | null;
  onBack: () => void;
}) {
  // One earlier sheet open at a time: opening another closes this one.
  const linkedIndex = initialPeriod ? data.earlier.findIndex((s) => s.period === initialPeriod) : -1;
  const [openPast, setOpenPast] = useState<string | null>(linkedIndex >= 0 ? initialPeriod : null);
  const history = useRef<HTMLDivElement>(null);
  // The sheet open now, when the link is to it: it is at the top already, so it is only lit (24 Oct, Alex).
  const openRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!initialPeriod || data.openSheet?.period !== initialPeriod) return;
    return landOnSoon(() => openRef.current, "start", 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival from a link.
  }, []);
  useEffect(() => {
    if (linkedIndex < 0) return;
    // Brought into view and lit (24 Oct, Alex: a link lands on its thing).
    return landOnSoon(() => history.current?.children[linkedIndex], "start", 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival from a link.
  }, []);
  // Photos picked but not sent yet; leaving would lose them, so Back asks.
  const [unsent, setUnsent] = useState(false);
  const back = () => {
    if (unsent && !window.confirm("Your new pictures aren’t sent yet. Leave without sending them?")) return;
    onBack();
  };

  const open = data.openSheet;
  // The sheet (and the ones before it), or two sheets side by side.
  const [view, setView] = useState<"sheet" | "compare">("sheet");
  // The top row (back, the title) stays put as the page scrolls: over the
  // photo at rest, on a frosted bar once the banner has gone by (the check-in's).
  const [stuck, setStuck] = useState(false);
  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    const y = e.currentTarget.scrollTop;
    // Frosted as soon as the banner's words reach the bar (17 Oct, Alex): at 72px they slid
    // under the clear bar first, the two titles and the back arrow on top of each other.
    setStuck((s) => (s ? y > 4 : y > 8));
  };
  return (
    <>
      <main className="pp-app-body pp-one ci-one" onScroll={onScroll}>
        <div className={`ci-bar pp-bar${stuck ? " stuck" : ""}`}>
          <button type="button" className="ci-back" onClick={back} aria-label="Back">
            <ChevronLeftIcon />
          </button>
          <h1 className="ci-title">Shape update</h1>
          <span aria-hidden="true" />
        </div>
        {/* The photo banner, the check-in's: the same size, the sheet open
            now as its title, and two pills that switch the screen between
            Entries and Compare (24 Oct, Alex: as the check-in's Entries). */}
        <header className="tr-banner ci-banner pp-banner">
          <div className="tr-kicker">{open ? "Open now" : "Shape update"}</div>
          <FitTitle className="tr-name">{open ? open.title : "No sheet open"}</FitTitle>
          <div className="tr-weeks ci-views" role="tablist" aria-label="Shape update">
            <button type="button" role="tab" aria-selected={view === "sheet"} className={`tr-wk${view === "sheet" ? " on" : ""}`} onClick={() => setView("sheet")}>
              Entries
            </button>
            <button type="button" role="tab" aria-selected={view === "compare"} className={`tr-wk${view === "compare" ? " on" : ""}`} onClick={() => setView("compare")}>
              Compare
            </button>
          </div>
        </header>

        {view === "compare" ? (
          <ProgressCompare
            sheets={[
              ...(open ? [{ period: open.period, title: open.title, cells: open.slots.map((x) => ({ slotId: x.id, label: x.label, src: x.src })) }] : []),
              ...data.earlier.map((e) => ({ period: e.period, title: e.title, cells: e.photos })),
            ]}
          />
        ) : data.openSheet ? (
          <div ref={openRef}>
            <OpenSheet clientId={data.clientId} sheet={data.openSheet} onUnsentChange={setUnsent} />
          </div>
        ) : (
          !data.hasAngles && <p className="pp-app-empty">Your coach hasn&rsquo;t asked for a shape update yet.</p>
        )}

        {view === "sheet" && data.earlier.length > 0 && (
          <section>
            <div className="pp-app-section-head">
              <span className="pp-app-section-title">Earlier sheets</span>
              {data.earlierSince && (
                <span className="pp-app-section-meta">
                  {data.earlier.length} since {data.earlierSince}
                </span>
              )}
            </div>
            <div className="pp-app-history" ref={history}>
              {data.earlier.map((s) => (
                <PhotoPeriodHistoryRow
                  key={s.period}
                  title={s.title}
                  photos={s.photos}
                  open={openPast === s.period}
                  onToggle={() => setOpenPast((p) => (p === s.period ? null : s.period))}
                />
              ))}
            </div>
          </section>
        )}

        {view === "sheet" && data.hasAngles && (
          <p className="pp-app-foot">
            {data.nextLabel && `Next sheet opens ${data.nextLabel}. `}Only your coach sees these.
          </p>
        )}
      </main>
    </>
  );
}

type Staged = { file: File; preview: string };

// The open sheet, like a check-in, as a section that comes open while it is
// to do: a row per angle with Add on the right (camera or library), Save to
// send them, and once all are in it folds like the earlier ones, with Edit
// inside to reopen it. Save sends one
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
  // The sheet still to do comes open; its head folds it.
  const [open, setOpen] = useState(true);
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
  // Folded once every angle is in and nothing new is waiting.
  const collapsed = inCount === total && stagedCount === 0 && !editing && !saving;

  const removePhoto = (slot: Slot) => {
    setPicking(null);
    setFailed(false);
    if (staged[slot.id]) {
      setStaged((s) => {
        const next = { ...s };
        delete next[slot.id];
        return next;
      });
      return;
    }
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("slotId", String(slot.id));
    fd.set("period", sheet.period);
    startSaving(async () => {
      await removeProgressPhotoAction(fd);
    });
  };
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
        // The sheet on screen: the server refuses it if that sheet has closed meanwhile (21 Oct).
        fd.set("period", sheet.period);
        // Shrunk on the phone first (17 Oct): 1600px on the long edge, a few hundred KB instead of the camera's MBs.
        const small = await fitJpeg(item.file);
        fd.set("file", small ? new File([small], "photo.jpg", { type: "image/jpeg" }) : item.file);
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
          open={sentOpen}
          onToggle={() => setSentOpen((o) => !o)}
          metaExtra={justSaved ? "just sent" : "sent"}
          done
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
    <article className="pp-todo">
      <button type="button" className="pp-todo-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="pp-todo-titles">
          <span className="pp-todo-title">{sheet.title}</span>
          <span className="pp-todo-sub">
            {total} {total === 1 ? "photo" : "photos"}
          </span>
        </span>
        {!editing && <span className="pp-todo-pill">To do</span>}
        <span className={`tr-chev${open ? " up" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="pp-todo-body">
          {failed && (
            <p className="pp-app-fail" role="alert">
              A photo didn&rsquo;t send. Check your connection and press Save again.
            </p>
          )}

          {/* How to take them, first (17 Oct, Alex): the coach's general instructions sit above the cards, read before the camera comes out. */}
          {sheet.instructions && (
            <div className="pp-todo-coach first">
              <CoachSays label="How to take them">{sheet.instructions}</CoachSays>
            </div>
          )}

          {/* The angles the coach asks for as a swipe of big cards (17 Oct, Alex); an empty one is a card too, a tap adds or changes its photo. */}
          <PhotoDeck
            disabled={saving}
            onTap={(i) => setPicking(sheet.slots[i])}
            items={sheet.slots.map((s) => {
              const item = staged[s.id];
              const uploading = uploadingId === s.id;
              const src = item?.preview ?? s.src;
              const ticked = item ? sent.includes(s.id) : !!s.src;
              const ready = !!item && !ticked && !uploading;
              return {
                key: s.id,
                label: s.label,
                src: src ?? null,
                // Sent (17 Oct, Alex): locked, it is Finlay's now; no Change on the card. "Edit photos" on the sent sheet reopens it.
                state: uploading ? "Sending…" : ready ? "Ready" : null, // no "Sent" chip (17 Oct, Alex): a sent card shows its tick, or Change while editing
                tone: ready ? ("ready" as const) : ticked && !uploading ? ("sent" as const) : null,
                // Editing (17 Oct, Alex: a sent photo could not be swapped or taken off): every card opens again.
                locked: ticked && !uploading && !editing,
                action: ticked && !uploading && !editing ? null : src ? "Change" : "Add photo",
              };
            })}
          />

          {(stagedCount > 0 || editing || saving) && (
            <div className="pp-todo-save">
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
                <button type="button" className="pp-app-save-btn" onClick={save} disabled={saving}>
                  {saving ? "Sending…" : stagedCount === 1 ? "Send 1 photo" : `Send ${stagedCount} photos`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {picking && (
        <div className="pp-app-sheet-scrim" role="presentation" onClick={() => setPicking(null)}>
          <div className="pp-app-sheet" role="dialog" aria-modal="true" aria-label={`Add ${picking.label}`} onClick={(e) => e.stopPropagation()}>
            <div className="pp-app-sheet-head">
              <span className="pp-app-sheet-title">{picking.label}</span>
              {/* The coach's word on how to take this one, when there is one (21 Oct, Alex). */}
              <span className="pp-app-sheet-sub">{picking.hint || "Only your coach sees this."}</span>
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
            {/* Take it off (17 Oct): a photo picked on this visit just goes; a sent one is removed from the sheet. */}
            {(staged[picking.id] || picking.src) && (
              <button type="button" className="pp-app-sheet-remove" onClick={() => removePhoto(picking)} disabled={saving}>
                Remove photo
              </button>
            )}
            <button type="button" className="pp-app-sheet-cancel" onClick={() => setPicking(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// The Progress pictures row under the Account tab.
export function ProgressPicturesRow() {
  const openPhotos = useOpenPhotos();
  return (
    <button type="button" className="pp-app-account-btn" onClick={() => openPhotos?.()}>
      <span className="settings-data-row">
        <span className="home-dark-row-title">Shape update</span>
        <ArrowRightIcon />
      </span>
    </button>
  );
}
