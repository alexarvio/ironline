"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { removeProgressPhotoAction, uploadProgressPhotoAction } from "../lib/actions";
import { fitJpeg } from "../lib/coverJpeg";
import { ChevronLeftIcon } from "../components/icons";
import CoachSays from "./CoachSays";
import FitTitle from "./FitTitle";
import ProgressCompare from "./ProgressCompare";
import PhotoDeck from "./PhotoDeck";
import PhotoPeriodHistoryRow from "./PhotoPeriodHistoryRow";
import { landOnSoon } from "../lib/landOn";
import { Bars } from "./Bars";

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


/** The banner's photo, as globals.css draws it (`.tr-banner.ci-banner.pp-banner`): keep the two the same. */
export const SHAPE_UPDATE_BANNER = "/home/progress-pics.jpg";

// Fetched and decoded while Home sits, so the banner is there the moment Shape update opens (4 Nov, Alex: it came in
// half a second late). Every other banner's picture is an <img> already on Home (the phase cards), so the browser has
// it; this one is a CSS background on a screen not yet mounted, so its fetch only began on opening. Held here so the
// browser keeps it for the page's life.
let warmed: HTMLImageElement | null = null;
export function warmShapeUpdateBanner() {
  if (warmed || typeof window === "undefined") return;
  warmed = new Image();
  warmed.decoding = "async";
  warmed.src = SHAPE_UPDATE_BANNER;
  warmed.decode?.().catch(() => {});
}

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
  // Photos picked but not sent yet; leaving would lose them, so Back asks, in place (3 Nov, Alex: as the check-in and Add an
  // event ask, never the browser's alert): the sheet's send row turns into the question.
  const [unsent, setUnsent] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const back = () => {
    if (unsent) return setLeaving(true);
    onBack();
  };
  // Nothing left unsent (the picks taken off, or sent): the question goes with them.
  const unsentChange = useCallback((u: boolean) => {
    setUnsent(u);
    if (!u) setLeaving(false);
  }, []);

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
          <FitTitle className="tr-name">{open ? open.title : "Nothing open"}</FitTitle>
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
            <OpenSheet clientId={data.clientId} sheet={data.openSheet} onUnsentChange={unsentChange} leaving={leaving} onKeep={() => setLeaving(false)} onLeave={onBack} />
          </div>
        ) : (
          !data.hasAngles && <p className="pp-app-empty">None yet</p>
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

        {/* (3 Nov, Alex: words mockup) `Next shape update | 12 Nov` with the drawn bar; no next date, no line. (6 Nov, Alex: no "sheet".) */}
        {view === "sheet" && data.hasAngles && data.nextLabel && (
          <p className="pp-app-foot">
            <Bars parts={["Next shape update", data.nextLabel]} />
          </p>
        )}
      </main>
    </>
  );
}

type Staged = { file: File; preview: string };

// The open sheet, like a check-in, as a section that comes open while it is
// to do: a card per angle, a tap opening the phone's own picker (4 Nov), Save to
// send them, and once all are in it folds like the earlier ones, with Edit
// inside to reopen it. Save sends one
// photo at a time so a weak connection fails on one photo, not all of them.
function OpenSheet({
  clientId,
  sheet,
  onUnsentChange,
  leaving = false,
  onKeep,
  onLeave,
}: {
  clientId: number;
  sheet: NonNullable<ProgressPicturesProps["openSheet"]>;
  onUnsentChange: (unsent: boolean) => void;
  /** Back was tapped with photos not sent: the send row asks Leave without sending? (3 Nov, Alex). */
  leaving?: boolean;
  onKeep?: () => void;
  onLeave?: () => void;
}) {
  const [staged, setStaged] = useState<Record<number, Staged>>({});
  // Picked photos that have already gone up during the current Save.
  const [sent, setSent] = useState<number[]>([]);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  // A tap on an angle opens the phone's own picker in one tap (4 Nov, Alex: "do that for shape update please"; our
  // Take a photo | Choose from library sheet came before the iPhone's own Photo Library | Take Photo or Video |
  // Choose File, two menus for one photo): one hidden field, opened by .click() from the tile, remembering which angle asked.
  const photoInput = useRef<HTMLInputElement>(null);
  const photoFor = useRef<Slot | null>(null);
  const askPhoto = (slot: Slot) => {
    photoFor.current = slot;
    photoInput.current?.click();
  };
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  // A sent photo being taken off while the sheet is edited (4 Nov, Alex: "bring it back"), and one that would not go.
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeFailed, setRemoveFailed] = useState(false);
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
  // Gone from the screen (Compare), its picks go with it: nothing left to ask about.
  useEffect(() => () => onUnsentChange(false), [onUnsentChange]);
  // Asked to leave: the sheet comes open and its send row, now the question, is brought into view.
  const saveRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => saveRow.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    return () => clearTimeout(t);
  }, [leaving]);

  const total = sheet.slots.length;
  const hinted = sheet.slots.filter((s) => s.hint?.trim());
  const inCount = sheet.slots.filter((s) => s.src).length;
  // Folded once every angle is in and nothing new is waiting.
  const collapsed = inCount === total && stagedCount === 0 && !editing && !saving;

  const pick = (slot: Slot, file: File) => {
    const preview = URL.createObjectURL(file);
    previews.current.push(preview);
    setFailed(false);
    setRemoveFailed(false);
    setJustSaved(false);
    setStaged((s) => ({ ...s, [slot.id]: { file, preview } }));
  };

  // Takes a sent photo off the sheet, as the old sheet's Remove photo did (17 Oct); asked on the card first (4 Nov,
  // Alex). The card waits dimmed and lands empty with the refreshed sheet, its counts with it.
  const removePhoto = (slot: Slot) => {
    setFailed(false);
    setRemoveFailed(false);
    setJustSaved(false);
    setRemovingId(slot.id);
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("slotId", String(slot.id));
    fd.set("period", sheet.period);
    startSaving(async () => {
      let ok = true;
      try {
        await removeProgressPhotoAction(fd);
      } catch {
        ok = false;
      }
      startSaving(() => {
        setRemovingId(null);
        if (!ok) setRemoveFailed(true);
      });
    });
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
    setRemoveFailed(false);
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

      {(open || leaving) && (
        <div className="pp-todo-body">
          {failed && (
            <p className="pp-app-fail" role="alert">
              A photo didn&rsquo;t send. Check your connection and press Save again.
            </p>
          )}
          {removeFailed && (
            <p className="pp-app-fail" role="alert">
              Photo not removed. Try again
            </p>
          )}

          {/* How to take them, first (17 Oct, Alex): the coach's general instructions sit above the cards, read before the camera comes out. */}
          {/* The coach's word on how to take each angle (21 Oct, Alex) was the title of our sheet; with the phone's own
              picker in its place (4 Nov, Alex) it reads here, under the general instructions, each angle by its name. */}
          {(sheet.instructions || hinted.length > 0) && (
            <div className="pp-todo-coach first">
              <CoachSays label="How to take them">
                {sheet.instructions}
                {hinted.length > 0 && (
                  <span className={`pp-todo-hints${sheet.instructions ? "" : " alone"}`}>
                    {hinted.map((s) => (
                      <span key={s.id} className="pp-todo-hint">
                        <b>{s.label}</b> {s.hint}
                      </span>
                    ))}
                  </span>
                )}
              </CoachSays>
            </div>
          )}

          {/* The angles the coach asks for as a swipe of big cards (17 Oct, Alex); an empty one is a card too, a tap adds or changes its photo. */}
          <PhotoDeck
            disabled={saving}
            onTap={(i) => askPhoto(sheet.slots[i])}
            onRemove={(i) => removePhoto(sheet.slots[i])}
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
                // A sent photo while editing (4 Nov, Alex): Remove on its card. One picked and not sent has Cancel for that.
                removable: editing && !!s.src && !item && !uploading,
                removing: removingId === s.id,
                ...(removingId === s.id ? { state: "Removing…", tone: null, action: null } : {}),
              };
            })}
          />

          {leaving && stagedCount > 0 ? (
            // The check-in's question (.cki-confirm; 3 Nov, Alex): Keep puts the send row back, Leave throws the picks away and goes back.
            <div ref={saveRow} className="pp-todo-save pp-leave">
              <div className="cki-confirm" role="alertdialog" aria-label={`Leave without sending ${stagedCount === 1 ? "1 photo" : `${stagedCount} photos`}?`}>
                <span className="cki-confirm-text">Leave without sending {stagedCount === 1 ? "1 photo" : `${stagedCount} photos`}?</span>
                <button type="button" className="keep" onClick={onKeep}>
                  Keep
                </button>
                <button
                  type="button"
                  className="discard"
                  onClick={() => {
                    cancel();
                    onLeave?.();
                  }}
                >
                  Leave
                </button>
              </div>
            </div>
          ) : (stagedCount > 0 || editing || saving) && (
            <div ref={saveRow} className="pp-todo-save">
              {stagedCount > 0 && inCount > 0 && !saving && (
                <button type="button" className="pp-app-save-cancel" onClick={cancel}>
                  Cancel
                </button>
              )}
              {/* A photo being removed is no send (4 Nov): Done stays, held still, and the send pill never says Sending… for it. */}
              {stagedCount === 0 && editing && (!saving || removingId !== null) ? (
                <button
                  type="button"
                  className="pp-app-save-btn secondary"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setRemoveFailed(false);
                  }}
                >
                  Done
                </button>
              ) : (
                <button type="button" className="pp-app-save-btn" onClick={save} disabled={saving}>
                  {saving && removingId === null ? "Sending…" : stagedCount === 1 ? "Send 1 photo" : `Send ${stagedCount} photos`}
                </button>
              )}
            </div>
          )}
          {/* A sheet sent in part can be edited too (4 Nov, Alex: "I uploaded a progress pic, I saved it, but I can't edit
              it now"): Edit photos in words under the photos once one is sent, as the finished sheet's own. */}
          {!leaving && !editing && !saving && stagedCount === 0 && inCount > 0 && (
            <button
              type="button"
              className="pp-todo-edit"
              onClick={() => {
                setEditing(true);
                setJustSaved(false);
              }}
            >
              Edit photos
            </button>
          )}
        </div>
      )}

      {/* No capture (4 Nov, Alex): the iPhone's own sheet offers Take Photo as well as the library. As the food diary's camera. */}
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so picking the same file twice still fires.
          e.target.value = "";
          const slot = photoFor.current;
          photoFor.current = null;
          if (file && slot) pick(slot, file);
        }}
      />
    </article>
  );
}
