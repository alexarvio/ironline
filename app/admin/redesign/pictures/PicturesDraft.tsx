"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addPhotoSlotAction, remindProgressPicturesAction, removePhotoAngleAction, reorderPhotoSlotsAction, savePhotoPeriodNoteAction, savePhotoScheduleAction, sendChatMessageAction, setPhotoSlotPausedAction, updatePhotoSlotAction } from "../../../lib/actions";
import type { MessageLink } from "../../../lib/messageLinks";
import type { PhaseTrack } from "../../../lib/db";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { SepJoin } from "../Sep";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent } from "../../../components/ui/popover";
import { CameraIcon, ChatIcon, ChevronDownIcon, ChevronLeftIcon, MoreIcon, PencilIcon, PlayIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { MessageDialog, useClickAway } from "../training/TrainingDraft";
import { GripIcon } from "../training/TrainingParts";
import { TrackIcon } from "../plan/PlanDraft";
import DatePick from "../DatePick";
import { SortableItem, SortableList } from "../Sortable";
import { useOpenChat } from "../ChatPanel";
import { useHoldWhile, useSaveQueue } from "../useSaveQueue";
import { dayMonth } from "../../../lib/dayMonth";
import { TRACK_LABEL, TRACK_PALETTE } from "../../phaseChrome";

// The Progress pictures tab (21 Oct, Alex), built as Training's header:
//
// - Header: the client's pictures, the open sheet (or the next one) as a tag,
//   the save status; the facts under it; Sheet setup and ⋯ on the right.
// - Sheet setup (folded under its pill): when sheets open, how often, how to
//   take them, and the angles asked for. Every change saves itself.
// - The sheet in focus: its photos (or two sheets side by side), the weigh-in,
//   the plan's phases, Remind and Comment, and the coach's four notes.
// - All sheets: one row a sheet, newest first; a row puts it in focus.

export type Cadence = "weekly" | "biweekly" | "monthly" | "sixweekly";
export type Cell = { slotId: number; label: string; src: string | null; shot: string | null; shotDay: string | null };
export type Note = { shape: string; strengths: string; improvements: string; next_steps: string };
export type SheetPhase = { track: PhaseTrack; name: string };
export type Sheet = {
  period: string;
  title: string;
  live: boolean;
  complete: boolean;
  dateLabel: string;
  inCount: number;
  total: number;
  cells: Cell[];
  note: Note;
  savedLabel: string | null;
  weight: number | null;
  /** Every non-draft phase the sheet's day fell in: Lifestyle, Training, Nutrition. */
  phases: SheetPhase[];
};
export type DraftPictures = {
  cadence: Cadence;
  startDate: string | null;
  instructions: string;
  slots: { id: number; label: string; paused: boolean; count: number }[];
  sheets: Sheet[];
  /** The next day a sheet opens, while an angle is asked for. */
  nextSheet: string | null;
  /** The start date, else the oldest sheet's day. */
  since: string | null;
  /** The coach already reminded the client about the open sheet today. */
  remindedToday: boolean;
};

type Slot = DraftPictures["slots"][number];
type Schedule = { startDate: string; cadence: Cadence; instructions: string };
type Dlg = { kind: "message"; label: string; link: MessageLink } | { kind: "photo"; period: string; slotId: number } | { kind: "removeAngle"; slot: Slot } | null;

const QUIET_MS = 800;
const ROWS_SHOWN = 12;
const REPEATS: { value: Cadence; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "biweekly", label: "2 weeks" },
  { value: "monthly", label: "Month" },
  { value: "sixweekly", label: "6 weeks" },
];
const EVERY: Record<Cadence, string> = { weekly: "every week", biweekly: "every 2 weeks", monthly: "every month", sixweekly: "every 6 weeks" };
const RHYTHM: Record<Cadence, string> = { weekly: "weekly", biweekly: "every 2 weeks", monthly: "monthly", sixweekly: "every 6 weeks" };
const SUGGESTED = ["Front relaxed", "Front flexed", "Back", "Back flexed", "Side left", "Side right", "Legs"];
const NOTE_FIELDS: { name: keyof Note; label: string }[] = [
  { name: "shape", label: "Shape" },
  { name: "strengths", label: "What's strong" },
  { name: "improvements", label: "What we can improve" },
  { name: "next_steps", label: "Next steps" },
];
const sameNote = (a: Note, b: Note) => NOTE_FIELDS.every((f) => a[f.name].trim() === b[f.name].trim());
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fd = (o: Record<string, string | number | null | undefined>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) if (v != null) f.set(k, String(v));
  return f;
};
/** A sheet's state in words and its tone: Complete green, open rust, the rest grey. */
const stateOf = (sh: Sheet): { text: string; tone: "good" | "open" | "quiet" } =>
  sh.complete ? { text: "Complete", tone: "good" } : sh.live ? { text: sh.inCount === 0 ? "Open" : `${sh.inCount} of ${sh.total} in`, tone: "open" } : { text: `${sh.total - sh.inCount} missing`, tone: "quiet" };
const kgChange = (d: number) => `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} kg`;

type Props = { clientId: number; firstName: string; plan: DraftPictures };

/** A client switch starts the tab afresh: nothing typed for one client lands on another. */
export default function PicturesDraft(props: Props) {
  return <Pictures key={props.clientId} {...props} />;
}

function Pictures({ clientId, firstName, plan }: Props) {
  const router = useRouter();
  // The re-read after a save, until it lands: a copy on screen from before the save mustn't be taken for it.
  const [refreshing, startRefresh] = useTransition();
  const reRead = () => startRefresh(() => router.refresh());
  const q = useSaveQueue(reRead);

  // ---- Schedule: the day and the rhythm save at once, the instructions a moment after typing stops.
  const savedSchedule: Schedule = { startDate: plan.startDate ?? "", cadence: plan.cadence, instructions: plan.instructions };
  const [sched, setSched] = useState(savedSchedule);
  const schedNow = useRef(sched);
  useEffect(() => {
    schedNow.current = sched;
  });
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendSchedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setTyping(false);
    const x = schedNow.current;
    q.save(async () => {
      await savePhotoScheduleAction(clientId, { startDate: x.startDate, cadence: x.cadence, instructions: x.instructions });
      return true;
    });
  };
  const changeSchedule = (patch: Partial<Schedule>, quiet = false) => {
    const next = { ...schedNow.current, ...patch };
    schedNow.current = next;
    setSched(next);
    if (!quiet) return sendSchedule();
    setTyping(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(sendSchedule, QUIET_MS);
  };

  // ---- Angles: changed on screen at once, saved behind it. A new one is faded until the re-read gives it its number.
  const [slots, setSlots] = useState(plan.slots);
  const tempIds = useRef(0);
  const nameTaken = (label: string, except?: number) => slots.some((s) => s.id !== except && s.label.trim().toLowerCase() === label.trim().toLowerCase());
  const addAngle = (label: string) => {
    const v = label.trim();
    if (!v || nameTaken(v)) return;
    tempIds.current += 1;
    setSlots((prev) => [...prev, { id: -tempIds.current, label: v, paused: false, count: 0 }]);
    q.save(async () => {
      await addPhotoSlotAction(fd({ clientId, label: v }));
      return true;
    });
  };
  const renameAngle = (s: Slot, label: string) => {
    setSlots((prev) => prev.map((x) => (x.id === s.id ? { ...x, label } : x)));
    q.save(async () => {
      await updatePhotoSlotAction(fd({ id: s.id, label }));
      return true;
    });
  };
  const pauseAngle = (s: Slot) => {
    const paused = !s.paused;
    setSlots((prev) => prev.map((x) => (x.id === s.id ? { ...x, paused } : x)));
    q.save(async () => {
      await setPhotoSlotPausedAction(s.id, paused);
      return true;
    });
  };
  // The photos the confirm showed go with it, no more: when the client has uploaded since the page was read,
  // nothing goes and the confirm asks again with the real count (the re-read puts the row back).
  const removeAngle = (s: Slot) => {
    setSlots((prev) => prev.filter((x) => x.id !== s.id));
    q.save(async () => {
      const r = await removePhotoAngleAction(s.id, s.count);
      if (r && !r.removed) setDlg({ kind: "removeAngle", slot: { ...s, count: r.count } });
      return true;
    });
  };
  // No drag while a new angle waits for its number (its place would be lost).
  const canDrag = !slots.some((s) => s.id < 0);
  const moveAngles = (ids: (number | string)[]) => {
    if (!canDrag) return;
    const next = ids.map((id) => slots.find((s) => s.id === id)).filter((s): s is Slot => !!s);
    setSlots(next);
    q.save(async () => {
      await reorderPhotoSlotsAction(clientId, next.map((s) => s.id));
      return true;
    });
  };
  const [renaming, setRenaming] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  // Keyboard focus that would otherwise fall to the page: back on + Angle after its list closes with Esc or ×,
  // back on the angle's name after a rename ends with Enter or Esc, kept in the rename field when ⋯ › Rename opens it.
  const setupRef = useRef<HTMLElement>(null);
  const addBtn = useRef<HTMLButtonElement>(null);
  const refocusAdd = useRef(false);
  const refocusName = useRef<number | null>(null);
  const renamePicked = useRef(false);
  const closeAdd = (refocus: boolean) => {
    refocusAdd.current = refocus;
    setAdding(false);
  };
  useEffect(() => {
    if (adding || !refocusAdd.current) return;
    refocusAdd.current = false;
    addBtn.current?.focus();
  }, [adding]);
  useEffect(() => {
    if (renaming != null || refocusName.current == null) return;
    const id = refocusName.current;
    refocusName.current = null;
    setupRef.current?.querySelector<HTMLButtonElement>(`[data-angle="${id}"]`)?.focus();
  }, [renaming]);

  const [dlg, setDlg] = useState<Dlg>(null);

  // ---- Notes on a sheet: what was last sent, until the re-read brings it back; and what is typed and not yet
  // saved, a draft a sheet, so putting another sheet in focus keeps it.
  const [sentNotes, setSentNotes] = useState<Record<string, Note>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, Note>>({});
  const savedNote = (sh: Sheet) => sentNotes[sh.period] ?? sh.note;
  const unsavedNote = plan.sheets.some((sh) => noteDrafts[sh.period] && !sameNote(noteDrafts[sh.period], savedNote(sh)));
  const dropDraft = (period: string) =>
    setNoteDrafts((prev) => {
      const next = { ...prev };
      delete next[period];
      return next;
    });

  // What is saved comes back with the page's re-read and replaces the screen's copy, by content,
  // never while a change waits, saves, failed or its re-read is on its way (that would undo it on screen).
  // The instructions stay as typed when the saved copy only lost their trailing space or line (the server trims).
  const setupKey = JSON.stringify([plan.cadence, plan.startDate, plan.instructions, plan.slots, plan.sheets.map((s) => [s.period, s.note])]);
  const [seenSetup, setSeenSetup] = useState(setupKey);
  if (seenSetup !== setupKey && !typing && !q.saving && !q.failed && !refreshing) {
    setSeenSetup(setupKey);
    setSched((s) => ({ ...savedSchedule, instructions: s.instructions.trim() === savedSchedule.instructions.trim() ? s.instructions : savedSchedule.instructions }));
    setSlots(plan.slots);
    setSentNotes({});
  }

  // Leaving the tab with instructions typed: they go now.
  useEffect(
    () => () => {
      if (timer.current) sendSchedule();
    },
    // Unmount only; the refs hold what is current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useHoldWhile(typing || q.saving || q.failed || unsavedNote);

  // ---- Sheets: one in focus, on its own or beside another.
  const sheets = plan.sheets;
  const chrono = [...sheets].reverse();
  const openSheet = sheets.find((x) => x.live) ?? null;
  const fallback = openSheet ?? sheets[0] ?? null;
  const [selP, setSelP] = useState<string | null>(fallback?.period ?? null);
  const sel = sheets.find((x) => x.period === selP) ?? fallback;
  const [vs, setVs] = useState(false);
  const [cmpP, setCmpP] = useState<string | null>(null);
  const cmp = sel && sheets.length > 1 ? (sheets.find((x) => x.period === cmpP && x.period !== sel.period) ?? chrono.find((x) => x.period !== sel.period) ?? null) : null;
  const comparing = vs && !!cmp;
  const [all, setAll] = useState(false);
  const focusRef = useRef<HTMLElement>(null);
  const focusHead = useRef<HTMLHeadingElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  // A row puts its sheet in focus: the keyboard goes up with the scroll, to the sheet's title.
  const focusOn = (period: string) => {
    setSelP(period);
    const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      focusHead.current?.focus({ preventScroll: true });
      focusRef.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    });
  };
  const showAll = () => {
    setAll(true);
    requestAnimationFrame(() => tableRef.current?.querySelectorAll<HTMLButtonElement>(".rp-trow")[ROWS_SHOWN]?.focus());
  };
  const [remindedNow, setRemindedNow] = useState<string | null>(null);
  const reminded = !!sel && sel.live && (plan.remindedToday || remindedNow === sel.period);
  const remind = (sh: Sheet) => {
    setRemindedNow(sh.period);
    q.save(async () => {
      await remindProgressPicturesAction(clientId);
      return true;
    });
  };

  // ---- Setup panel: folded under its pill; open at first when nothing is asked for yet.
  const [setupOpen, setSetupOpen] = useState(plan.slots.length === 0);
  const setupId = useId();
  const active = slots.filter((s) => !s.paused).length;

  const close = () => setDlg(null);
  // Messaging slides the chat in from the right (ChatPanel); outside the shell, the message dialog.
  const openChat = useOpenChat();
  const message = (label: string, link: MessageLink) => (openChat ? openChat({ area: "Lifestyle", label, link }) : setDlg({ kind: "message", label, link }));
  const comment = (sh: Sheet) => message(`Progress pictures · ${sh.title}, ${sh.dateLabel}`, { kind: "photos", period: sh.period });
  const photoSheet = dlg?.kind === "photo" ? (sheets.find((x) => x.period === dlg.period) ?? null) : null;

  // The header's facts, the dates last.
  const meta = [sheets.length > 0 ? plural(sheets.length, "sheet") : null, slots.length > 0 ? EVERY[sched.cadence] : null, plan.since ? `since ${dayMonth(plan.since)}` : null].filter((x): x is string => !!x);
  const repeats = REPEATS.filter((r) => r.value !== "sixweekly" || plan.cadence === "sixweekly" || sched.cadence === "sixweekly");
  const shownRows = all ? sheets : sheets.slice(0, ROWS_SHOWN);
  const cols = Math.max(1, sel?.cells.length ?? 0);

  return (
    <div className="rd trn rls rp">
      {/* ---- Header, as Training's. */}
      <header className="trn-head">
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
                Not saved ·{" "}
                <button type="button" onClick={q.retry}>
                  Retry
                </button>
              </span>
            ) : (
              <span className={`trn-allsaved${q.saving || typing ? " saving" : ""}`} role="status">
                {q.saving || typing ? "Saving…" : "All changes saved"}
              </span>
            )}
          </div>
          {meta.length > 0 && (
            <span className="trn-meta">
              {meta.map((m, i) => (
                <span key={m} className={i > 0 ? "trn-meta-part" : undefined}>
                  {m}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="trn-head-actions">
          <button type="button" className={`rp-setup-btn${setupOpen ? " on" : ""}`} aria-expanded={setupOpen} aria-controls={setupId} onClick={() => setSetupOpen((o) => !o)}>
            <SlidersIcon />
            Sheet setup
            <small>
              <SepJoin parts={[plural(active, "angle"), RHYTHM[sched.cadence]]} />
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

      {/* ---- Sheet setup: when, how often, how, and which angles. Every change saves itself. */}
      {setupOpen && (
        <section ref={setupRef} id={setupId} className="rp-setup" aria-label="Sheet setup">
          <div className="rp-col">
            <h3>Schedule</h3>
            <div className="rp-field">
              <span className="rp-label">Starts</span>
              <DatePick value={sched.startDate} onChange={(v) => changeSchedule({ startDate: v })} label="Starts" clearable className="rp-start" />
            </div>
            <div className="rp-field">
              <span className="rp-label" id={`${setupId}-repeat`}>
                Repeat
              </span>
              <div className="rd-btn-group" role="radiogroup" aria-labelledby={`${setupId}-repeat`}>
                {repeats.map((r) => (
                  <button key={r.value} type="button" role="radio" aria-checked={sched.cadence === r.value} className={sched.cadence === r.value ? "on" : ""} onClick={() => sched.cadence !== r.value && changeSchedule({ cadence: r.value })}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="rp-field">
              <span className="rp-label">Instructions for {firstName}</span>
              <GrowText className="rp-line rp-instr" value={sched.instructions} maxLength={600} onChange={(v) => changeSchedule({ instructions: v }, true)} placeholder="Morning, before breakfast. Same spot and light each time…" />
            </label>
          </div>
          <div className="rp-col">
            <h3>Angles</h3>
            <div className="rp-angles">
              <SortableList ids={slots.map((s) => s.id)} label="angle" onMove={moveAngles}>
                {slots.map((s) => {
                  const incoming = s.id < 0;
                  const last = sheets.find((sh) => sh.cells.some((c) => c.slotId === s.id && c.src));
                  return (
                    <SortableItem key={s.id} id={s.id} className={`rp-angle${s.paused ? " paused" : ""}${incoming ? " trn-incoming" : ""}`}>
                      {(grip) => (
                        <>
                          <span className="rd-grip trn-grip rp-grip" {...(canDrag ? grip : {})}>
                            <GripIcon />
                          </span>
                          {renaming === s.id ? (
                            <AngleRename
                              initial={s.label}
                              taken={(v) => nameTaken(v, s.id)}
                              onDone={(v, byKey) => {
                                if (byKey) refocusName.current = s.id;
                                setRenaming(null);
                                if (v != null && v !== s.label) renameAngle(s, v);
                              }}
                            />
                          ) : (
                            <button type="button" className="rp-angle-name" data-angle={s.id} onClick={() => !incoming && setRenaming(s.id)} title="Rename" aria-label={`Rename ${s.label}`}>
                              {s.label}
                            </button>
                          )}
                          <span className="rp-angle-sub">
                            {s.paused && <em>Paused</em>}
                            {s.count > 0 ? <SepJoin parts={[plural(s.count, "photo"), last && `last ${last.title}`]} /> : s.paused ? null : "None yet"}
                          </span>
                          <span className="rp-angle-more">
                            {!incoming && (
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger className="trn-row-more" aria-label={`More for ${s.label}`}>
                                  <MoreIcon />
                                </DropdownMenuTrigger>
                                {/* After Rename the field keeps the focus: only then the menu doesn't hand it back to ⋯ as it closes. */}
                                <DropdownMenuContent
                                  align="end"
                                  className="pb-menu"
                                  onCloseAutoFocus={(e) => {
                                    if (!renamePicked.current) return;
                                    renamePicked.current = false;
                                    e.preventDefault();
                                  }}
                                >
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      renamePicked.current = true;
                                      setRenaming(s.id);
                                    }}
                                  >
                                    <PencilIcon /> Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => pauseAngle(s)}>
                                    {s.paused ? <PlayIcon /> : <PauseIcon />} {s.paused ? "Resume" : "Pause"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "removeAngle", slot: s })}>
                                    <TrashIcon /> Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </span>
                        </>
                      )}
                    </SortableItem>
                  );
                })}
              </SortableList>
              {adding ? (
                <AddAngle have={slots.map((s) => s.label.trim().toLowerCase())} onAdd={addAngle} onClose={closeAdd} />
              ) : (
                <button ref={addBtn} type="button" className="rp-add-angle" onClick={() => setAdding(true)}>
                  <PlusIcon /> Angle
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {!sel ? (
        <div className="rp-card rp-empty">No sheets yet</div>
      ) : (
        <>
          {/* ---- The sheet in focus. */}
          <section ref={focusRef} className="rp-focus" aria-label={sel.title}>
            <div className="rp-selhead">
              <h2 ref={focusHead} tabIndex={-1}>
                {sel.title}
              </h2>
              <span className="rp-selmeta">
                <SepJoin parts={[sel.dateLabel, stateOf(sel).text]} />
              </span>
              {sheets.length > 1 && cmp && (
                <div className="rp-selright">
                  <div className="rd-btn-group" role="radiogroup" aria-label="Show">
                    <button type="button" role="radio" aria-checked={!vs} className={!vs ? "on" : ""} onClick={() => setVs(false)}>
                      This sheet
                    </button>
                    <button type="button" role="radio" aria-checked={vs} className={vs ? "on" : ""} onClick={() => setVs(true)}>
                      vs {cmp.title}
                    </button>
                  </div>
                  {/* The sheet compared with is named once, in the capsule; this only picks another. */}
                  {vs && (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className="trn-btn rp-cmp" aria-label={`Compare with ${cmp.title}`}>
                        <ChevronDownIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="pb-menu">
                        {chrono
                          .filter((x) => x.period !== sel.period)
                          .map((x) => (
                            <DropdownMenuCheckboxItem key={x.period} checked={x.period === cmp.period} onCheckedChange={() => setCmpP(x.period)}>
                              {x.title} <small className="rp-menu-date">{x.dateLabel}</small>
                            </DropdownMenuCheckboxItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>
            <div className="rp-card rp-sheet">
              {/* Tiles stay a sensible size: capped across, and side by side (vs) four slots a row at most. */}
              <div className={`rp-grid${comparing ? " vs" : ""}`} style={{ "--rp-cols": comparing ? Math.min(cols, 4) : cols, "--rp-cols-narrow": Math.min(cols, comparing ? 2 : 3) } as React.CSSProperties}>
                {sel.cells.map((c) => {
                  const status = c.src ? "in" : sel.live ? "waiting" : "missing";
                  const other = comparing && cmp ? (cmp.cells.find((x) => x.slotId === c.slotId) ?? null) : null;
                  return (
                    <div key={c.slotId} className="rp-slot">
                      <div className={`rp-tiles${comparing ? " vs" : ""}`}>
                        {comparing && cmp && <Tile cell={other} sheet={cmp} label={c.label} tag={cmp.title} emptyText={`No ${cmp.title}`} onOpen={(slotId) => setDlg({ kind: "photo", period: cmp.period, slotId })} />}
                        <Tile cell={c} sheet={sel} label={c.label} tag={comparing ? sel.title : c.shotDay} emptyText={sel.live ? "Waiting" : "Missing"} onOpen={(slotId) => setDlg({ kind: "photo", period: sel.period, slotId })} />
                      </div>
                      <div className="rp-cap">
                        <b>{c.label}</b>
                        <span className={`rp-cap-state ${status}`}>{status === "in" ? "In" : status === "waiting" ? "Waiting" : "Missing"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rp-foot">
                <span className="rp-weight">
                  <span className="rp-label">Weight</span>
                  <b>{sel.weight == null ? "—" : `${sel.weight} kg`}</b>
                </span>
                <span className="rp-div" aria-hidden="true" />
                <span className="rp-phases">
                  <PhaseTags phases={sel.phases} />
                </span>
                <span className="rp-acts">
                  {/* Reminded keeps the focus (aria-disabled, not disabled): the keyboard isn't dropped to the page. */}
                  {sel.live && !sel.complete && (
                    <button type="button" className="rp-pill" aria-disabled={reminded || undefined} onClick={() => !reminded && remind(sel)}>
                      {reminded ? "Reminded" : `Remind ${firstName}`}
                    </button>
                  )}
                  <button type="button" className="rp-pill ink" onClick={() => comment(sel)}>
                    Comment
                  </button>
                </span>
              </div>
              <SheetNotes
                saved={savedNote(sel)}
                value={noteDrafts[sel.period] ?? savedNote(sel)}
                onChange={(note) => {
                  const period = sel.period;
                  const saved = savedNote(sel);
                  // A draft only while it differs from what is saved, letter for letter.
                  if (NOTE_FIELDS.every((f) => note[f.name] === saved[f.name])) dropDraft(period);
                  else setNoteDrafts((prev) => ({ ...prev, [period]: note }));
                }}
                onSave={(note) => {
                  const period = sel.period;
                  setSentNotes((prev) => ({ ...prev, [period]: note }));
                  dropDraft(period);
                  q.save(async () => {
                    await savePhotoPeriodNoteAction(fd({ clientId, period, ...note }));
                    return true;
                  });
                }}
              />
            </div>
          </section>

          {/* ---- All sheets, newest first. */}
          <section className="rls-section">
            <div className="trn-weekhead">
              <div>
                <h2>All sheets</h2>
              </div>
            </div>
            <div ref={tableRef} className="rp-card rp-table">
              <div className="rp-thead" aria-hidden="true">
                <span>Sheet</span>
                <span>Photos</span>
                <span>Weight</span>
                <span>Phases</span>
                <span className="end">State</span>
              </div>
              {shownRows.map((sh) => {
                const i = sheets.indexOf(sh);
                const before = sheets.slice(i + 1).find((x) => x.weight != null);
                const change = sh.weight != null && before?.weight != null ? Math.round((sh.weight - before.weight) * 10) / 10 : null;
                const st = stateOf(sh);
                const on = sh.period === sel.period;
                return (
                  <button key={sh.period} type="button" className={`rp-trow${on ? " on" : ""}`} aria-current={on ? "true" : undefined} aria-label={`${sh.title}, ${sh.dateLabel}, ${sh.inCount} of ${sh.total} photos, ${st.text}`} onClick={() => focusOn(sh.period)}>
                    <span className="rp-tsheet">
                      <b>{sh.title}</b>
                      <small>{sh.dateLabel}</small>
                    </span>
                    <span className={`rp-bars${sh.complete ? " done" : ""}`} aria-hidden="true">
                      {sh.cells.map((c) => (
                        <i key={c.slotId} className={c.src ? "in" : ""} />
                      ))}
                    </span>
                    <span className="rp-tweight">
                      {sh.weight == null ? <span className="none">—</span> : `${sh.weight} kg`}
                      {change != null && Math.abs(change) >= 0.05 && <small>{kgChange(change)}</small>}
                    </span>
                    <span className="rp-phases">{sh.phases.length > 0 ? <PhaseTags phases={sh.phases} small /> : <span className="none">—</span>}</span>
                    <span className="rp-tstate">
                      <span className={`trn-state${st.tone === "good" ? " good" : st.tone === "open" ? " warn" : ""}`}>{st.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {!all && sheets.length > ROWS_SHOWN && (
              <button type="button" className="rp-showall" onClick={showAll}>
                Show all {sheets.length}
              </button>
            )}
          </section>
        </>
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
        {dlg?.kind === "photo" && photoSheet && <PhotoDialog sheet={photoSheet} sheets={sheets} slotId={dlg.slotId} onMove={(period, slotId) => setDlg({ kind: "photo", period, slotId })} />}
        {dlg?.kind === "removeAngle" && (
          <RemoveAngleDialog
            slot={dlg.slot}
            firstName={firstName}
            onClose={close}
            onRemove={() => {
              const s = dlg.slot;
              close();
              removeAngle(s);
            }}
          />
        )}
      </Dialog>
    </div>
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
        <span key={`${p.track}-${p.name}`} className={`rp-phase${small ? " sm" : ""}`} style={{ color: TRACK_PALETTE[p.track].ink, background: TRACK_PALETTE[p.track].tint }} title={`${TRACK_LABEL[p.track]} · ${p.name}`}>
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
function GrowText({ value, onChange, className, placeholder, maxLength, label }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; maxLength?: number; label?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => fitText(ref.current), [value]);
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
  }, []);
  return <textarea ref={ref} rows={1} className={className} value={value} maxLength={maxLength} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

/** An angle's name typed in place: Enter or a click away keeps it, Esc leaves it. Empty or taken is refused,
 *  with the fact under it, and the field stays open (a click away too) until it is fixed or Esc. */
function AngleRename({ initial, taken, onDone }: { initial: string; taken: (v: string) => boolean; onDone: (v: string | null, byKey: boolean) => void }) {
  const [v, setV] = useState(initial);
  const [fact, setFact] = useState<string | null>(null);
  const check = (x: string) => (!x ? "Needs a name." : taken(x) ? `${x} is already an angle.` : null);
  // Once only: Enter or Esc closes the field, and the blur that follows mustn't count again.
  const settled = useRef(false);
  const done = (x: string | null, byKey: boolean) => {
    if (settled.current) return;
    settled.current = true;
    onDone(x, byKey);
  };
  return (
    <span className="rp-angle-edit">
      <input
        className="rp-angle-input"
        value={v}
        autoFocus
        maxLength={40}
        onChange={(e) => {
          setV(e.target.value);
          setFact(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") done(null, true);
          if (e.key === "Enter") {
            const x = v.trim();
            const why = check(x);
            if (why) setFact(why);
            else done(x, true);
          }
        }}
        onBlur={() => {
          if (settled.current) return;
          const x = v.trim();
          const why = check(x);
          if (why) setFact(why);
          else done(x, false);
        }}
        aria-label="Angle name"
        aria-invalid={!!fact}
      />
      {fact && (
        <span className="rp-angle-fact" role="alert">
          {fact}
        </span>
      )}
    </span>
  );
}

/** + Angle's dropdown, as + Item's on Nutrition: the search at its top, the usual angles, and one of your own pinned at the foot. */
/** onClose(true): closed from the keyboard's reach (Esc, ×, + Angle again), so the focus goes back to + Angle; a click away leaves it where it went. */
function AddAngle({ have, onAdd, onClose }: { have: string[]; onAdd: (label: string) => void; onClose: (refocus: boolean) => void }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useClickAway(wrap, () => onClose(false));
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
    <div ref={wrap} className="rd-addrow rp-addrow">
      <Popover open onOpenChange={() => {}}>
        <PopoverAnchor asChild>
          <button type="button" className="rp-add-angle on" onClick={() => onClose(true)} aria-expanded="true">
            <PlusIcon /> Angle
          </button>
        </PopoverAnchor>
        <PopoverContent
          className="rd-addpop rls-findpop rp-findpop"
          align="center"
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
            <div className="rd-addpop-scroll" role="listbox" aria-label="Angles">
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

/** The coach's four notes on a sheet, each on a clean line. Cancel and Save show once something differs from what is saved.
 *  The draft lives with the tab (a draft a sheet), so another sheet in focus doesn't lose it. */
function SheetNotes({ saved, value: v, onChange, onSave }: { saved: Note; value: Note; onChange: (note: Note) => void; onSave: (note: Note) => void }) {
  const changed = !sameNote(v, saved);
  return (
    <div className="rp-notes">
      <div className="rp-notes-grid">
        {NOTE_FIELDS.map((f) => (
          <label key={f.name} className="rp-note">
            <span className="rp-label">{f.label}</span>
            <GrowText className="rp-line" value={v[f.name]} maxLength={2000} onChange={(x) => onChange({ ...v, [f.name]: x })} />
          </label>
        ))}
      </div>
      {changed && (
        <div className="rp-notes-foot">
          <button type="button" className="rp-cancel" onClick={() => onChange(saved)}>
            Cancel
          </button>
          <button type="button" className="rp-save" onClick={() => onSave(v)}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

/** Removing an angle: its photos go with it, so a tick first when it has any. */
function RemoveAngleDialog({ slot, firstName, onRemove, onClose }: { slot: Slot; firstName: string; onRemove: () => void; onClose: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const has = slot.count > 0;
  return (
    <DialogContent
      className="dlh"
      role="alertdialog"
      onOpenAutoFocus={(ev) => {
        ev.preventDefault();
        setTimeout(() => cancel.current?.focus(), 60);
      }}
    >
      <div className="dlh-head">
        <DialogTitle className="dlh-title">Remove {slot.label}?</DialogTitle>
        <button type="button" className="dlh-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <DialogDescription className="dlh-what">{has ? `${firstName} is no longer asked for it, and its ${plural(slot.count, "photo")} are permanently deleted. It can’t be undone.` : `${firstName} is no longer asked for it.`}</DialogDescription>
      {has && (
        <button type="button" role="checkbox" aria-checked={agreed} className="dlh-ack" onClick={() => setAgreed((x) => !x)}>
          <span className={`dlh-box${agreed ? " on" : ""}`} aria-hidden="true">
            {agreed ? "✓" : ""}
          </span>
          Delete {firstName}&rsquo;s {slot.label} photos too
        </button>
      )}
      <div className="dlh-foot">
        <button ref={cancel} type="button" className="dlh-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="dlh-delete" disabled={has && !agreed} onClick={onRemove}>
          Remove
        </button>
      </div>
    </DialogContent>
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
