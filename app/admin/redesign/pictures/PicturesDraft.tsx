"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addPhotoSlotAction, remindProgressPicturesAction, removePhotoAngleAction, savePhotoSetupAction, sendChatMessageAction, setPhotoSlotPausedAction } from "../../../lib/actions";
import type { MessageLink } from "../../../lib/messageLinks";
import type { PhaseTrack } from "../../../lib/db";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { SepJoin } from "../Sep";
import CompareDialog from "./CompareDialog";
import { Fold } from "../Fold";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent } from "../../../components/ui/popover";
import { CameraIcon, ChatIcon, ChevronLeftIcon, MoreIcon, PlayIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { MessageDialog, useClickAway } from "../training/TrainingDraft";
import { GripIcon } from "../training/TrainingParts";
import { TrackIcon } from "../plan/PlanDraft";
import DateText from "../DateText";
import { MonthRange } from "../MonthRange";
import { SortableItem, SortableList } from "../Sortable";
import { useOpenChat } from "../ChatPanel";
import { useHoldWhile, useSaveQueue } from "../useSaveQueue";
import { dayMonth, logDate } from "../../../lib/dayMonth";
import { TRACK_LABEL, TRACK_PALETTE } from "../../phaseChrome";

// The Progress pictures tab (21 Oct, Alex), built as Training's header:
//
// - Header: the client's pictures, the open sheet (or the next one) as a tag,
//   the save status; Sheet setup and ⋯ on the right.
// - Sheet setup: a pop-up, as a phase's: the month, the start, the rhythm, the
//   instructions, and the angles, each with a word on how to take it. Save.
// - The newest sheet alone: its photos (empty places while it is open), the
//   weigh-in, the plan's phases, Remind, and a comment for the client that
//   goes to the chat, linked to the sheet (no notes of its own).
//   Compare opens the same angle from the sheets picked, side by side.
// - All sheets: a log, a row a sheet, newest first; a row opens Compare on it.

export type Cadence = "weekly" | "biweekly" | "monthly" | "sixweekly";
export type Cell = { slotId: number; label: string; src: string | null; shot: string | null; shotDay: string | null };
export type SheetPhase = { id: number; track: PhaseTrack; name: string };
export type Sheet = {
  period: string;
  title: string;
  live: boolean;
  complete: boolean;
  dateLabel: string;
  inCount: number;
  total: number;
  cells: Cell[];
  weight: number | null;
  /** Every non-draft phase that ran while the sheet was open: Lifestyle, Training, Nutrition. */
  phases: SheetPhase[];
};
export type DraftPictures = {
  cadence: Cadence;
  startDate: string | null;
  instructions: string;
  /** The angles asked for, in order; hint: how to take it, shown to the client as they add it (21 Oct). */
  slots: { id: number; label: string; hint: string; paused: boolean; count: number }[];
  sheets: Sheet[];
  /** The next day a sheet opens, while an angle is asked for. */
  nextSheet: string | null;
  /** The start date, else the oldest sheet's day. */
  since: string | null;
  /** Nothing open: the next sheet, on its own day, its places empty (21 Oct, Alex). */
  upcoming: Sheet | null;
  /** The coach already reminded the client about the open sheet today. */
  remindedToday: boolean;
};

type Dlg = { kind: "message"; label: string; link: MessageLink } | { kind: "photo"; period: string; slotId: number; /** Opened from Compare: closing it goes back there. */ back?: string[] } | { kind: "setup" } | { kind: "compare"; periods: string[] } | null;

const ROWS_SHOWN = 12;
const REPEATS: { value: Cadence; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "biweekly", label: "2 weeks" },
  { value: "monthly", label: "Month" },
  { value: "sixweekly", label: "6 weeks" },
];
const RHYTHM: Record<Cadence, string> = { weekly: "weekly", biweekly: "every 2 weeks", monthly: "monthly", sixweekly: "every 6 weeks" };
const SUGGESTED = ["Front relaxed", "Front flexed", "Back", "Back flexed", "Side left", "Side right", "Legs"];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fd = (o: Record<string, string | number | null | undefined>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) if (v != null) f.set(k, String(v));
  return f;
};
/** A sheet's state in words and its tone: Complete green, open rust, the rest grey. */
const stateOf = (sh: Sheet): { text: string; tone: "good" | "open" | "quiet" } =>
  sh.complete ? { text: "Complete", tone: "good" } : sh.live ? { text: sh.inCount === 0 ? "Open" : `${sh.inCount} of ${sh.total} in`, tone: "open" } : { text: `${sh.total - sh.inCount} missing`, tone: "quiet" };
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Props = { clientId: number; firstName: string; plan: DraftPictures };

/** A client switch starts the tab afresh: nothing typed for one client lands on another. */
export default function PicturesDraft(props: Props) {
  return <Pictures key={props.clientId} {...props} />;
}

function Pictures({ clientId, firstName, plan }: Props) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const reRead = () => startRefresh(() => router.refresh());
  const q = useSaveQueue(reRead);
  const [dlg, setDlg] = useState<Dlg>(null);
  // A photo opened from Compare goes back to Compare when it closes.
  const close = () => setDlg((d) => (d?.kind === "photo" && d.back ? { kind: "compare", periods: d.back } : null));

  // ---- A comment typed on the sheet, not sent yet: leaving the page asks first.
  const [commentTyped, setCommentTyped] = useState(false);
  useHoldWhile(q.saving || q.failed || commentTyped);

  // ---- Sheets, newest first. The top of the tab is the newest alone (21 Oct, Alex): the one open now, or the last one.
  const sheets = plan.sheets;
  const latest = sheets[0] ?? null;
  // The top: the sheet open now (until every photo is in), else the next one on its own day (21 Oct, Alex).
  const openSheet = sheets.find((s) => s.live) ?? null;
  const top = openSheet ?? plan.upcoming;
  // All sheets: the closed ones; the open one sits at the top until it is done.
  const closed = sheets.filter((s) => !s.live);
  // An empty place taken off the top (×): gone at once, saved behind it.
  const [dropped, setDropped] = useState<number[]>([]);
  const topCells = top ? top.cells.filter((c) => !dropped.includes(c.slotId)) : [];
  const dropAngle = (slotId: number) => {
    const slot = plan.slots.find((x) => x.id === slotId);
    setDropped((xs) => [...xs, slotId]);
    q.save(async () => {
      // Never asked for yet: it goes. With photos on earlier sheets: paused, so they stay (Sheet setup can resume it).
      const r = slot && slot.count === 0 ? await removePhotoAngleAction(slotId, 0) : undefined;
      if (!r?.removed) await setPhotoSlotPausedAction(slotId, true);
      return true;
    });
  };
  const oldest = sheets[sheets.length - 1] ?? null;
  const [all, setAll] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const showAll = () => {
    setAll(true);
    requestAnimationFrame(() => tableRef.current?.querySelectorAll<HTMLButtonElement>(".rp-trow")[ROWS_SHOWN]?.focus());
  };
  // + Add on the sheet (21 Oct, Alex): a new angle from the same search, saved at once; faded until the re-read brings it.
  const [addingTile, setAddingTile] = useState(false);
  const addTile = useRef<HTMLButtonElement>(null);
  const [pendingAngles, setPendingAngles] = useState<string[]>([]);
  const shownPending = pendingAngles.filter((l) => !plan.slots.some((x) => x.label.trim().toLowerCase() === l.toLowerCase()));
  const quickAdd = (label: string) => {
    setPendingAngles((xs) => [...xs, label]);
    q.save(async () => {
      await addPhotoSlotAction(fd({ clientId, label }));
      return true;
    });
  };
  // A row of All sheets open on its photos, one at a time.
  const [openRow, setOpenRow] = useState<string | null>(null);
  // Compare: the first sheet beside the newest.
  const openCompare = (period?: string) => {
    if (!latest) return;
    const other = period && period !== latest.period ? period : oldest && oldest.period !== latest.period ? oldest.period : null;
    setDlg({ kind: "compare", periods: other ? [other, latest.period] : [latest.period] });
  };
  const [remindedNow, setRemindedNow] = useState<string | null>(null);
  const reminded = !!openSheet && (plan.remindedToday || remindedNow === openSheet.period);
  const remind = (sh: Sheet) => {
    setRemindedNow(sh.period);
    q.save(async () => {
      await remindProgressPicturesAction(clientId);
      return true;
    });
  };

  const active = plan.slots.filter((s) => !s.paused).length;
  // Messaging slides the chat in from the right (ChatPanel); outside the shell, the message dialog.
  const openChat = useOpenChat();
  const message = (label: string, link: MessageLink) => (openChat ? openChat({ area: "Lifestyle", label, link }) : setDlg({ kind: "message", label, link }));
  const photoSheet = dlg?.kind === "photo" ? (sheets.find((x) => x.period === dlg.period) ?? null) : null;
  const shownRows = all ? closed : closed.slice(0, ROWS_SHOWN);
  // The sheet's tiles: its angles, any just added, and + Add.
  const cols = topCells.length + shownPending.length + 1;

  return (
    <div className="rd trn rls rp">
      {/* ---- Header, as Training's; no fact line (21 Oct, Alex). */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <span className="trn-eyebrow">Progress pictures</span>
          <div className="trn-name-row">
            <h1 className="trn-name">{firstName}&rsquo;s pictures</h1>
            {openSheet ? (
              <span className="trn-status rp-tag open">{openSheet.title} open</span>
            ) : plan.nextSheet ? (
              <span className="trn-status rp-tag next">Next {dayMonth(plan.nextSheet)}</span>
            ) : null}
            {q.failed ? (
              <span className="trn-allsaved failed" role="alert">
                Not saved{" "}
                <button type="button" onClick={q.retry}>
                  Retry
                </button>
              </span>
            ) : (
              <span className={`trn-allsaved${q.saving ? " saving" : ""}`} role="status">
                {q.saving ? "Saving…" : "All changes saved"}
              </span>
            )}
          </div>
        </div>
        <div className="trn-head-actions">
          {/* Sheet setup is a pop-up, as a phase's (21 Oct, Alex): the calendar, the rhythm, the instructions and the angles. */}
          <button type="button" className="rp-setup-btn" aria-haspopup="dialog" onClick={() => setDlg({ kind: "setup" })}>
            <SlidersIcon />
            Sheet setup
            <small>
              <SepJoin parts={[plural(active, "angle"), RHYTHM[plan.cadence]]} />
            </small>
          </button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="trn-more" aria-label="More for progress pictures">
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={() => message("Progress pictures", { kind: "photos" })}>
                <ChatIcon /> Message about progress pictures
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {!top ? (
        sheets.length === 0 && <div className="rp-card rp-empty">No sheets yet</div>
      ) : (
        // ---- The top (21 Oct, Alex): the sheet open now, until every photo is in; then the next one, on its own day,
        // its places empty, where its angles are added (+ Add) and taken off (× on an empty place).
        <section className="rp-focus" aria-label={top.title}>
          <div className="rp-selhead">
            <h2>{top.title}</h2>
            <span className="rp-selmeta">{top.dateLabel}</span>
            {sheets.length > 1 && (
              <div className="rp-selright">
                <button type="button" className="trn-btn rp-cmp-btn" aria-haspopup="dialog" onClick={() => openCompare()}>
                  <CompareIcon /> Compare
                </button>
              </div>
            )}
          </div>
          <div className="rp-card rp-sheet">
            <div className="rp-grid" style={{ "--rp-cols": cols, "--rp-cols-narrow": Math.min(cols, 3) } as React.CSSProperties}>
              {topCells.map((c) => {
                const status = c.src ? "in" : top.live ? "waiting" : null;
                return (
                  <div key={c.slotId} className="rp-slot">
                    <div className="rp-tilewrap">
                      <Tile cell={c} sheet={top} label={c.label} tag={c.shotDay} emptyText={top.live ? "Waiting" : ""} onOpen={(slotId) => setDlg({ kind: "photo", period: top.period, slotId })} />
                      {/* An empty place can go: the client isn't asked for it any more (its earlier photos stay). */}
                      {!c.src && (
                        <button type="button" className="rp-drop" onClick={() => dropAngle(c.slotId)} aria-label={`Stop asking for ${c.label}`} title="Take it off">
                          ×
                        </button>
                      )}
                    </div>
                    <div className="rp-cap">
                      <b>{c.label}</b>
                      {status && <span className={`rp-cap-state ${status}`}>{status === "in" ? "In" : "Waiting"}</span>}
                    </div>
                  </div>
                );
              })}
              {shownPending.map((label) => (
                <div key={`new-${label}`} className="rp-slot trn-incoming">
                  <Tile cell={null} sheet={top} label={label} tag={null} emptyText={top.live ? "Waiting" : ""} onOpen={() => {}} />
                  <div className="rp-cap">
                    <b>{label}</b>
                  </div>
                </div>
              ))}
              <div className="rp-slot">
                {addingTile ? (
                  <AddAngle
                    tile
                    have={[...plan.slots.map((x) => x.label.trim().toLowerCase()), ...shownPending.map((l) => l.toLowerCase())]}
                    onAdd={(label) => {
                      quickAdd(label);
                      setAddingTile(false);
                    }}
                    onClose={(refocus) => {
                      setAddingTile(false);
                      if (refocus) requestAnimationFrame(() => addTile.current?.focus());
                    }}
                  />
                ) : (
                  <button ref={addTile} type="button" className="rp-tile rp-addtile" onClick={() => setAddingTile(true)} aria-label="Add an angle">
                    <span>
                      <PlusIcon /> Add
                    </span>
                  </button>
                )}
              </div>
            </div>
            <div className="rp-foot">
              {top.live && (
                <>
                  <span className="rp-weight">
                    <span className="rp-label">Weight</span>
                    <b>{top.weight == null ? "—" : `${top.weight} kg`}</b>
                  </span>
                  <span className="rp-div" aria-hidden="true" />
                </>
              )}
              <span className="rp-phases">
                <PhaseTags phases={top.phases} />
              </span>
              {/* Reminded keeps the focus (aria-disabled, not disabled): the keyboard isn't dropped to the page. */}
              {top.live && !top.complete && (
                <span className="rp-acts">
                  <button type="button" className="rp-pill" aria-disabled={reminded || undefined} onClick={() => !reminded && remind(top)}>
                    {reminded ? "Reminded" : `Remind ${firstName}`}
                  </button>
                </span>
              )}
            </div>
            {/* A comment on the open sheet goes to the chat, linked to it (21 Oct, Alex): no notes of its own. */}
            {top.live && (
              <SheetComment
                firstName={firstName}
                onTyped={setCommentTyped}
                onSend={async (text) => {
                  const f = fd({ clientId, text });
                  f.set("link", JSON.stringify({ kind: "photos", period: top.period }));
                  await sendChatMessageAction(f);
                  reRead();
                  toast.success("Sent", { description: `In the chat, linked to ${top.title}.` });
                }}
              />
            )}
          </div>
        </section>
      )}

      {/* ---- All sheets, newest first, the closed ones (the open one is at the top until it is done): a log, the rows
          together as every log in the app (21 Oct, Alex). A row opens in place on its photos (the chevron after its title). */}
      {closed.length > 0 && (
        <section className="rls-section">
          <div className="trn-weekhead">
            <div>
              <h2>All sheets</h2>
            </div>
          </div>
          <div ref={tableRef} className="rp-card rp-table">
            <div className="rp-thead" aria-hidden="true">
              <span>Date</span>
              <span>Sheet</span>
              <span>Photos</span>
              <span>Weight</span>
              <span>Phases</span>
              <span className="end">State</span>
            </div>
            {shownRows.map((sh) => {
              const st = stateOf(sh);
              const isOpen = openRow === sh.period;
              return (
                <div key={sh.period} className={`rp-tgroup${isOpen ? " open" : ""}`}>
                  <button type="button" className="rp-trow" aria-expanded={isOpen} aria-label={`${logDate(sh.period)}, ${sh.title}, ${sh.inCount} of ${sh.total} photos, ${st.text}`} onClick={() => setOpenRow((x) => (x === sh.period ? null : sh.period))}>
                    {/* The date first, the chevron after it, then the sheet's name (21 Oct, Alex: as every log). */}
                    <span className="rp-tdate">
                      <span className="rd-logdate">{logDate(sh.period)}</span>
                      <Fold open={isOpen} />
                    </span>
                    <span className="rp-tsheet">
                      <b>{sh.title}</b>
                    </span>
                    <span className={`rp-bars${sh.complete ? " done" : ""}`} aria-hidden="true">
                      {sh.cells.map((c) => (
                        <i key={c.slotId} className={c.src ? "in" : ""} />
                      ))}
                    </span>
                    {/* The weigh-in alone: a change is Compare's to show (21 Oct, Alex). */}
                    <span className="rp-tweight">{sh.weight == null ? <span className="none">—</span> : `${sh.weight} kg`}</span>
                    <span className="rp-phases">{sh.phases.length > 0 ? <PhaseTags phases={sh.phases} small /> : <span className="none">—</span>}</span>
                    <span className="rp-tstate">
                      <span className={`trn-state${st.tone === "good" ? " good" : st.tone === "open" ? " warn" : ""}`}>{st.text}</span>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="rp-tbody">
                      <div className="rp-grid rp-tgrid" style={{ "--rp-cols": Math.max(1, sh.cells.length), "--rp-cols-narrow": Math.min(Math.max(1, sh.cells.length), 3) } as React.CSSProperties}>
                        {sh.cells.map((c) => (
                          <div key={c.slotId} className="rp-slot">
                            <Tile cell={c} sheet={sh} label={c.label} tag={c.shotDay} emptyText="Missing" onOpen={(slotId) => setDlg({ kind: "photo", period: sh.period, slotId })} />
                            <div className="rp-cap">
                              <b>{c.label}</b>
                              <span className={`rp-cap-state ${c.src ? "in" : "missing"}`}>{c.src ? "In" : "Missing"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!all && closed.length > ROWS_SHOWN && (
            <button type="button" className="rp-showall" onClick={showAll}>
              Show all {closed.length}
            </button>
          )}
        </section>
      )}

      {/* ---- Dialogs. One open at a time. */}
      <Dialog open={dlg != null} onOpenChange={(o) => !o && close()}>
        {dlg?.kind === "message" && (
          <MessageDialog
            firstName={firstName}
            label={dlg.label}
            onSend={(text) => {
              const { label, link } = dlg;
              close();
              const f = fd({ clientId, text });
              f.set("link", JSON.stringify(link));
              void sendChatMessageAction(f).then(reRead);
              toast.success("Sent", { description: `${firstName} gets it on Home, linked to ${label}.` });
            }}
          />
        )}
        {dlg?.kind === "photo" && photoSheet && <PhotoDialog sheet={photoSheet} sheets={sheets} slotId={dlg.slotId} onMove={(period, slotId) => setDlg({ kind: "photo", period, slotId, back: dlg.back })} />}
        {dlg?.kind === "setup" && (
          <SetupDialog
            clientId={clientId}
            firstName={firstName}
            plan={plan}
            onSaved={() => {
              close();
              reRead();
            }}
          />
        )}
        {dlg?.kind === "compare" && <CompareDialog clientId={clientId} sheets={sheets} initial={dlg.periods} onOpenPhoto={(period, slotId) => setDlg({ kind: "photo", period, slotId, back: dlg.periods })} />}
      </Dialog>
    </div>
  );
}

/** Sheet setup, as a phase's pop-up (21 Oct, Alex): the month on the left, the start date (typed or picked), how often a
 *  sheet opens and the instructions on the right; under them the angles, each with a word on how to take it.
 *  Cancel / Save: nothing reaches the client before Save. Removing an angle with photos asks for a tick first. */
type AngleDraft = { key: number; id: number | null; label: string; hint: string; paused: boolean; count: number };
function SetupDialog({ clientId, firstName, plan, onSaved }: { clientId: number; firstName: string; plan: DraftPictures; onSaved: () => void }) {
  const today = isoOf(new Date());
  const startAngles = (): AngleDraft[] => plan.slots.map((s) => ({ key: s.id, id: s.id, label: s.label, hint: s.hint, paused: s.paused, count: s.count }));
  const [start, setStart] = useState(plan.startDate ?? "");
  const [cadence, setCadence] = useState<Cadence>(plan.cadence);
  const [instructions, setInstructions] = useState(plan.instructions);
  const [angles, setAngles] = useState<AngleDraft[]>(startAngles);
  const [cursor, setCursor] = useState((plan.startDate || today).slice(0, 7));
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Photo counts the server came back with (sent since the page was read), kept across rounds: the tick asks again with them.
  const [recount, setRecount] = useState<Record<number, number>>({});
  const newKey = useRef(0);
  const addRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const removed = plan.slots.filter((s) => !angles.some((a) => a.id === s.id)).map((s) => ({ id: s.id, label: s.label, photos: Math.max(recount[s.id] ?? 0, s.count) }));
  const doomed = removed.filter((r) => r.photos > 0);
  const doomedCount = doomed.reduce((t, r) => t + r.photos, 0);
  // The tick is for these photos alone: another angle removed, or more photos counted, and it asks again.
  const doomedKey = doomed.map((d) => `${d.id}:${d.photos}`).join(",");
  const [agreedFor, setAgreedFor] = useState<string | null>(null);
  const agreed = agreedFor === doomedKey;
  const names = angles.map((a) => a.label.trim().toLowerCase());
  const blank = angles.some((a) => !a.label.trim());
  const twin = angles.find((a, i) => !!a.label.trim() && names.indexOf(a.label.trim().toLowerCase()) !== i) ?? null;
  const shape = (xs: AngleDraft[]) => JSON.stringify(xs.map((a) => [a.id, a.label.trim(), a.hint.trim(), a.paused]));
  const changed = start !== (plan.startDate ?? "") || cadence !== plan.cadence || instructions.trim() !== plan.instructions.trim() || shape(angles) !== shape(startAngles());
  const ok = changed && !blank && !twin && (doomedCount === 0 || agreed) && !saving;
  const repeats = REPEATS.filter((r) => r.value !== "sixweekly" || plan.cadence === "sixweekly");
  const edit = (key: number, f: Partial<AngleDraft>) => setAngles((xs) => xs.map((a) => (a.key === key ? { ...a, ...f } : a)));
  const save = async () => {
    setSaving(true);
    setError(null);
    const r = await savePhotoSetupAction(clientId, {
      startDate: start,
      cadence,
      instructions: instructions.trim(),
      angles: angles.map((a) => ({ id: a.id, label: a.label.trim(), hint: a.hint.trim(), paused: a.paused })),
      removed: removed.map((x) => ({ id: x.id, photos: x.photos })),
    }).catch(() => ({ ok: false as const, error: "Not saved: check the connection and try again." }));
    setSaving(false);
    if (r.ok) return onSaved();
    setError(r.error);
    if ("recount" in r && r.recount) {
      const fresh = r.recount;
      setRecount((prev) => ({ ...prev, ...Object.fromEntries(fresh.map((x) => [x.id, x.photos])) }));
    }
  };
  // Remove: the focus goes to the next angle's name, or + Angle when none is left.
  const removeAngle = (key: number) => {
    const at = angles.findIndex((x) => x.key === key);
    const next = angles[at + 1] ?? angles[at - 1] ?? null;
    setAngles((xs) => xs.filter((x) => x.key !== key));
    requestAnimationFrame(() => {
      const el = next ? listRef.current?.querySelector<HTMLInputElement>(`[data-angle="${next.key}"]`) : null;
      (el ?? addRef.current)?.focus();
    });
  };
  return (
    <DialogContent
      className="npd rp-setupdlg"
      style={{ "--npd-c": "#141a24", "--npd-rgb": "20,26,36" } as React.CSSProperties}
      // Esc while an angle is lifted from the keyboard cancels the drag alone, not the pop-up and what was typed in it.
      onEscapeKeyDown={(e) => {
        if ((e.target as Element | null)?.closest?.('[aria-roledescription="sortable"][aria-pressed="true"]')) e.preventDefault();
      }}
    >
      <div className="npd-head">
        <DialogTitle className="npd-title">Sheet setup</DialogTitle>
        <span className="npd-tools">
          <DialogClose className="npd-x" aria-label="Close">
            ✕
          </DialogClose>
        </span>
      </div>
      <DialogDescription className="sr-only">When {firstName}&rsquo;s sheets open, how to take them, and the angles asked for</DialogDescription>

      <div className="npd-cols">
        <MonthRange
          from={start}
          to={start}
          onPick={(d) => setStart(d)}
          planned={[]}
          cursor={cursor}
          setCursor={setCursor}
          today={today}
          plain
          legend={null}
        />
        <div className="npd-side">
          <div className="npd-dates">
            <div className="npd-date arm">
              <span className="npd-date-head">Starts</span>
              <DateText
                value={start}
                onChange={(v) => {
                  setStart(v);
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setCursor(v.slice(0, 7));
                }}
                label="Starts"
              />
            </div>
            {/* No start: the sheets follow the calendar again. */}
            {start && (
              <button type="button" className="rp-clear" onClick={() => setStart("")}>
                Clear
              </button>
            )}
          </div>
          <div className="npd-field">
            <span className="npd-label" id="rp-repeat-label">
              Repeat
            </span>
            <div className="npd-seg" role="radiogroup" aria-labelledby="rp-repeat-label">
              {repeats.map((r) => (
                <button key={r.value} type="button" role="radio" aria-checked={cadence === r.value} className={cadence === r.value ? "on" : ""} onClick={() => setCadence(r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <label className="npd-field">
            <span className="npd-label">Instructions for {firstName}</span>
            <GrowText className="npd-line npd-grow" value={instructions} maxLength={600} onChange={setInstructions} placeholder="Morning, before breakfast. Same spot and light each time…" />
          </label>
        </div>
      </div>

      {/* ---- The angles: drag to reorder, the name and a word on how to take it typed in place, ⋯ to pause or remove. */}
      <div className="npd-field rp-anglesfield">
        <span className="npd-label">Angles</span>
        {angles.length > 0 && (
          <div ref={listRef}>
          <SortableList ids={angles.map((a) => a.key)} label="angle" onMove={(ids) => setAngles(ids.map((k) => angles.find((a) => a.key === k)).filter((a): a is AngleDraft => !!a))}>
            {angles.map((a) => (
              <SortableItem key={a.key} id={a.key} className={`rp-arow${a.paused ? " paused" : ""}`}>
                {(grip) => (
                  <>
                    <span className="rp-agrip" {...grip}>
                      <GripIcon />
                    </span>
                    <input className="rp-aname" data-angle={a.key} value={a.label} onChange={(e) => edit(a.key, { label: e.target.value })} maxLength={40} aria-label="Angle" aria-invalid={!a.label.trim() || twin?.key === a.key || undefined} />
                    <input className="rp-ahint" value={a.hint} onChange={(e) => edit(a.key, { hint: e.target.value })} maxLength={200} placeholder="Add an instruction" aria-label={`How to take ${a.label || "this angle"}`} />
                    {a.paused && <em className="rp-apaused">Paused</em>}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className="rp-amore" aria-label={`More for ${a.label || "this angle"}`}>
                        <MoreIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="pb-menu">
                        <DropdownMenuItem onSelect={() => edit(a.key, { paused: !a.paused })}>
                          {a.paused ? <PlayIcon /> : <PauseIcon />} {a.paused ? "Resume" : "Pause"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => removeAngle(a.key)}>
                          <TrashIcon /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </SortableItem>
            ))}
          </SortableList>
          </div>
        )}
        {adding ? (
          <AddAngle
            have={angles.map((a) => a.label.trim().toLowerCase())}
            onAdd={(label) => {
              newKey.current += 1;
              setAngles((xs) => [...xs, { key: -newKey.current, id: null, label, hint: "", paused: false, count: 0 }]);
            }}
            onClose={(refocus) => {
              setAdding(false);
              if (refocus) requestAnimationFrame(() => addRef.current?.focus());
            }}
          />
        ) : (
          <button ref={addRef} type="button" className="rp-add" onClick={() => setAdding(true)}>
            <PlusIcon /> Angle
          </button>
        )}
        {(blank || twin) && <p className="rp-afact">{blank ? "Every angle needs a name." : `Two angles are called ${twin!.label.trim()}.`}</p>}
      </div>

      {/* Removing an angle takes its photos with it: a tick first (design rules 4). */}
      {doomedCount > 0 && (
        <button type="button" role="checkbox" aria-checked={agreed} className="dlh-ack rp-ack" onClick={() => setAgreedFor(agreed ? null : doomedKey)}>
          <span className={`dlh-box${agreed ? " on" : ""}`} aria-hidden="true">
            {agreed ? "✓" : ""}
          </span>
          Delete {firstName}&rsquo;s {plural(doomedCount, "photo")} of {doomed.map((d) => d.label).join(", ")} too
        </button>
      )}
      <div className="npd-foot">
        {error && <span className="rp-err">{error}</span>}
        <DialogClose className="npd-cancel">Cancel</DialogClose>
        <button type="button" className="npd-save" disabled={!ok} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </DialogContent>
  );
}



/** One photo in the focus card, or the empty place for it; a click opens it big. */
function Tile({ cell, sheet, label, tag, emptyText, onOpen }: { cell: Cell | null; sheet: Sheet; label: string; tag: string | null; emptyText: string; onOpen: (slotId: number) => void }) {
  const status = cell?.src ? "in" : sheet.live ? "waiting" : "missing";
  return (
    <button type="button" className="rp-tile" disabled={!cell?.src} onClick={() => cell?.src && onOpen(cell.slotId)} aria-label={`${label}, ${sheet.title}, ${status}`}>
      {cell?.src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
          <img src={cell.src} alt="" />
          {tag && <span className="rp-datetag">{tag}</span>}
        </>
      ) : (
        <span className="rp-hole">
          <CameraIcon />
          <span>{emptyText}</span>
        </span>
      )}
    </button>
  );
}

/** A track's tag, as every track tag wears it (phaseChrome's palette): its tint behind, its icon and words in its ink. */
function PhaseTags({ phases, small = false }: { phases: SheetPhase[]; small?: boolean }) {
  return (
    <>
      {phases.map((p) => (
        <span key={p.id} className={`rp-phase${small ? " sm" : ""}`} style={{ color: TRACK_PALETTE[p.track].ink, background: TRACK_PALETTE[p.track].tint }} title={`${TRACK_LABEL[p.track]} · ${p.name}`}>
          <TrackIcon track={p.track} size={small ? 10 : 11} />
          <span>{p.name}</span>
        </span>
      ))}
    </>
  );
}

/** Fits a textarea to its words. Not while it isn't drawn (the tab mounts hidden): it would measure 0. */
function fitText(el: HTMLTextAreaElement | null) {
  if (!el || el.getClientRects().length === 0) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
}

/** A textarea on a clean line that grows with its words; fitted again when it is shown or its width changes. */
function GrowText({ value, onChange, className, placeholder, maxLength, label, textRef }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; maxLength?: number; label?: string; /** The textarea, for a caller that focuses it. */ textRef?: React.RefObject<HTMLTextAreaElement | null> }) {
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = textRef ?? own;
  useLayoutEffect(() => fitText(ref.current), [value, ref]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = -1;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width === width) return;
      width = e.contentRect.width;
      fitText(el);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return <textarea ref={ref} rows={1} className={className} value={value} maxLength={maxLength} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

/** + Angle's dropdown, as + Item's on Nutrition: the search at its top, the usual angles, and one of your own pinned at the foot. */
/** onClose(true): closed from the keyboard's reach (Esc, ×, + Angle again), so the focus goes back to + Angle; a click away leaves it where it went. */
function AddAngle({ have, onAdd, onClose, tile = false }: { have: string[]; onAdd: (label: string) => void; onClose: (refocus: boolean) => void; /** Anchored on the sheet's dashed + Add tile instead of the + Angle words. */ tile?: boolean }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const listBox = useRef<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const listRef = useCallback((el: HTMLDivElement | null) => {
    listBox.current = el;
    setScrollEl(el);
  }, []);
  useClickAway(wrap, () => onClose(false));
  // The row under the arrows stays in view inside the list's own scroll.
  useEffect(() => {
    listBox.current?.querySelector<HTMLElement>(".rd-addrow-item.on")?.scrollIntoView({ block: "nearest" });
  }, [cursor]);
  // The list floats outside Sheet setup (portalled), where the pop-up's scroll lock cancels the wheel and a finger
  // (both land on the document, where React listens too, so stopping them there can't help): the list scrolls itself.
  useEffect(() => {
    const el = scrollEl;
    if (!el) return;
    let y = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    };
    const onStart = (e: TouchEvent) => {
      y = e.touches[0]?.clientY ?? 0;
    };
    const onMove = (e: TouchEvent) => {
      const now = e.touches[0]?.clientY ?? y;
      el.scrollTop += y - now;
      y = now;
      if (e.cancelable) e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
    };
  }, [scrollEl]);
  const needle = q.trim().toLowerCase();
  const list = SUGGESTED.filter((x) => !needle || x.toLowerCase().includes(needle)).map((x) => ({ label: x, taken: have.includes(x.toLowerCase()) }));
  // A name of the coach's own already on the list: said so, not offered again.
  const ownTaken = needle && have.includes(needle) && !SUGGESTED.some((x) => x.toLowerCase() === needle);
  const exact = !!needle && (SUGGESTED.some((x) => x.toLowerCase() === needle) || have.includes(needle));
  const pick = (label: string) => {
    if (have.includes(label.trim().toLowerCase())) return;
    onAdd(label);
    setQ("");
    setCursor(0);
    box.current?.focus();
  };
  return (
    <div ref={wrap} className={`rd-addrow rp-addrow${tile ? " rp-addtile-wrap" : ""}`}>
      <Popover open onOpenChange={() => {}}>
        <PopoverAnchor asChild>
          {tile ? (
            <button type="button" className="rp-tile rp-addtile on" onClick={() => onClose(true)} aria-expanded="true" aria-label="Add an angle">
              <span>
                <PlusIcon /> Add
              </span>
            </button>
          ) : (
            <button type="button" className="rp-add on" onClick={() => onClose(true)} aria-expanded="true">
              <PlusIcon /> Angle
            </button>
          )}
        </PopoverAnchor>
        <PopoverContent
          className="rd-addpop rls-findpop rp-findpop"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            box.current?.focus();
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (wrap.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <div className="rd-addrow-bar open">
            <input
              ref={box}
              className="rd-addrow-search"
              value={q}
              maxLength={40}
              onChange={(e) => {
                setQ(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose(true);
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, Math.max(0, list.length - 1)));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                }
                if (e.key === "Enter") {
                  const at = list[cursor];
                  if (at && !at.taken && (!needle || at.label.toLowerCase().includes(needle))) pick(at.label);
                  else if (needle && !exact) pick(q.trim());
                }
              }}
              placeholder="Name an angle"
              aria-label="Name an angle"
            />
            <button type="button" className="rd-addrow-x" onClick={() => onClose(true)} aria-label="Close">
              ×
            </button>
          </div>
          {(list.length > 0 || ownTaken) && (
            <div ref={listRef} className="rd-addpop-scroll" role="listbox" aria-label="Angles">
              {list.map((m, i) => (
                <button key={m.label} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}${m.taken ? " taken" : ""}`} disabled={m.taken} onMouseEnter={() => setCursor(i)} onClick={() => pick(m.label)}>
                  {m.label}
                  {m.taken && <small>On the list</small>}
                </button>
              ))}
              {ownTaken && (
                <button type="button" role="option" aria-selected={false} className="rd-addrow-item taken" disabled>
                  {q.trim()}
                  <small>On the list</small>
                </button>
              )}
            </div>
          )}
          {needle && !exact && (
            <button type="button" className={`rd-addrow-item create${list.length === 0 ? " on solo" : ""}`} onClick={() => pick(q.trim())}>
              <PlusIcon /> Add &ldquo;{q.trim()}&rdquo;
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** A comment on the sheet (21 Oct, Alex): the words on the page, no box; a line, Cancel and Send once something is typed.
 *  Send puts it in the chat with the client, linked to the sheet. */
function SheetComment({ firstName, onTyped, onSend }: { firstName: string; onTyped: (typed: boolean) => void; onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // The words as they are now, read after a send comes back.
  const now = useRef("");
  const box = useRef<HTMLTextAreaElement>(null);
  const typed = !!text.trim();
  const set = (v: string) => {
    now.current = v;
    setText(v);
    onTyped(!!v.trim());
  };
  // Cancel and Send take their buttons away: the focus goes back to the comment, not the top of the page.
  const refocus = () => requestAnimationFrame(() => box.current?.focus());
  const send = async () => {
    if (!typed || sending) return;
    setSending(true);
    const sent = text.trim();
    try {
      await onSend(sent);
      // Words added while it was sending stay, unsent.
      set(now.current.trim() === sent ? "" : now.current);
      refocus();
    } catch {
      toast.error("Not sent", { description: "Check the connection, then Send again." });
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="rp-comment">
      <GrowText textRef={box} className={`rp-line rp-comment-line${typed ? " typed" : ""}`} value={text} maxLength={2000} onChange={set} placeholder={`Add a comment for ${firstName}`} label={`Comment for ${firstName}`} />
      {typed && (
        <div className="rp-comment-foot">
          <button
            type="button"
            className="rp-cancel"
            onClick={() => {
              set("");
              refocus();
            }}
          >
            Cancel
          </button>
          <button type="button" className="rp-save" disabled={sending} onClick={() => void send()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}

/** One photo big: ← → through the sheet's angles, and the same angle from other sheets under it. */
function PhotoDialog({ sheet, sheets, slotId, onMove }: { sheet: Sheet; sheets: Sheet[]; slotId: number; onMove: (period: string, slotId: number) => void }) {
  const cells = sheet.cells.filter((c) => c.src);
  const index = Math.max(
    0,
    cells.findIndex((c) => c.slotId === slotId)
  );
  const cell = cells[index] ?? cells[0];
  const step = (d: number) => cells.length > 1 && onMove(sheet.period, cells[(index + d + cells.length) % cells.length].slotId);
  const earlier = cell
    ? sheets
        .filter((x) => x.period !== sheet.period)
        .map((x) => ({ sheet: x, cell: x.cells.find((c) => c.slotId === cell.slotId && c.src) }))
        .filter((x): x is { sheet: Sheet; cell: Cell } => !!x.cell)
    : [];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- step reads the latest index each render
  }, [index, sheet.period, cells.length]);
  if (!cell) return null;
  return (
    <DialogContent className="rp-photodlg">
      <div className="dlh-head">
        <div className="rp-photodlg-titles">
          <DialogTitle className="dlh-title">
            <SepJoin parts={[cell.label, sheet.title]} />
          </DialogTitle>
          <DialogDescription className="rp-photodlg-fact">
            <SepJoin parts={[cell.shot ?? sheet.dateLabel, sheet.weight != null && `${sheet.weight} kg`]} />
          </DialogDescription>
        </div>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <div className="rp-big">
        {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
        <img src={cell.src ?? ""} alt={`${cell.label}, ${sheet.title}`} />
        {cells.length > 1 && (
          <>
            <button type="button" className="rp-arrow left" onClick={() => step(-1)} aria-label="Previous angle">
              <ChevronLeftIcon />
            </button>
            <button type="button" className="rp-arrow right" onClick={() => step(1)} aria-label="Next angle">
              <ChevronLeftIcon />
            </button>
          </>
        )}
      </div>
      <div className="rp-strip">
        {cells.map((c) => (
          <button key={c.slotId} type="button" className={`rp-mini${c.slotId === cell.slotId ? " on" : ""}`} onClick={() => onMove(sheet.period, c.slotId)} aria-label={c.label} aria-current={c.slotId === cell.slotId}>
            {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
            <img src={c.src ?? ""} alt="" />
            <small>{c.label}</small>
          </button>
        ))}
      </div>
      {earlier.length > 0 && (
        <>
          <span className="rp-label">Same angle, other sheets</span>
          <div className="rp-strip">
            {earlier.map(({ sheet: x, cell: c }) => (
              <button key={x.period} type="button" className="rp-mini" onClick={() => onMove(x.period, c.slotId)} aria-label={`${c.label}, ${x.title}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
                <img src={c.src ?? ""} alt="" />
                <small>{x.title}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {cell.src && (
        <div className="rp-photodlg-foot">
          <a className="rp-full" href={cell.src} target="_blank" rel="noopener noreferrer">
            Open full size
          </a>
        </div>
      )}
    </DialogContent>
  );
}

/** Compare's mark: two frames side by side. */
function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="7.5" height="14" rx="1.5" />
      <rect x="13.5" y="5" width="7.5" height="14" rx="1.5" />
    </svg>
  );
}

/** Sheet setup's mark: three sliders. */
function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

/** Pause, in the angle's menu. */
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
      <path d="M9 6v12M15 6v12" />
    </svg>
  );
}
