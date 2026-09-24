"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPhotoSlotAction, removePhotoSlotAction, reorderPhotoSlotsAction, savePhotoPeriodNoteAction, savePhotoScheduleAction, sendChatMessageAction, setPhotoSlotPausedAction } from "../../../lib/actions";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/basics";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { CameraIcon, ChatIcon, ChevronDownIcon, ChevronLeftIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { ConfirmDialog, MessageDialog, useClickAway } from "../training/TrainingDraft";
import Picker from "../Picker";
import DatePick from "../DatePick";
import { SortableItem, SortableList } from "../Sortable";

// The calmer Progress pictures tab, as a draft on real data, in the Training
// draft's sheet. Two cards: what is asked for, and what came in.
//
// - Sheet setup: when sheets open and how often, how to take them, and one
//   row an angle (asked for or paused, how many photos it has). Changes queue
//   on the card's bar until Apply. "+ Add angle" opens a row with the usual
//   angles to click in, or one of your own.
// - Sheets: one row a sheet with the photos in, the weigh-in inside it, the
//   plan phases it fell in. A row opens into its photos and the coach's four
//   notes; a photo opens big with the same angle from earlier sheets under
//   it. Compare puts two sheets side by side, one angle at a time.
// Nothing here saves: every action ends in a toast.

export type Cadence = "weekly" | "biweekly" | "monthly" | "sixweekly";
export type Cell = { slotId: number; label: string; src: string | null; shot: string | null; shotDay: string | null };
export type Note = { shape: string; strengths: string; improvements: string; next_steps: string };
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
  phases: { nutrition: string | null; training: string | null };
};
export type DraftPictures = {
  cadence: Cadence;
  startDate: string | null;
  instructions: string;
  slots: { id: number; label: string; paused: boolean; count: number }[];
  sheets: Sheet[];
};

const savedToast = (what: string) => toast.success("Saved", { description: what });
type Repeat = Cadence | "custom";
const CADENCES: { value: Repeat; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "biweekly", label: "Two weeks" },
  { value: "monthly", label: "Month" },
  { value: "custom", label: "Custom…" },
];
const repeatLabel = (r: Repeat, weeks: number) => (r === "custom" ? `every ${weeks} ${weeks === 1 ? "week" : "weeks"}` : r === "sixweekly" ? "every six weeks" : `every ${CADENCES.find((c) => c.value === r)?.label.toLowerCase()}`);
const SUGGESTED = ["Front relaxed", "Front flexed", "Back", "Back flexed", "Side left", "Side right", "Legs"];
const NOTE_FIELDS: { name: keyof Note; label: string; placeholder: string }[] = [
  { name: "shape", label: "Shape", placeholder: "How they're looking overall" },
  { name: "strengths", label: "What's strong", placeholder: "What's going well" },
  { name: "improvements", label: "What we can improve", placeholder: "Areas to keep working on" },
  { name: "next_steps", label: "Next steps", placeholder: "What to focus on next" },
];
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const daysApart = (a: string, b: string) => Math.abs(Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000));
const kgDelta = (from: number, to: number) => {
  const d = Math.round((to - from) * 10) / 10;
  return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)} kg`;
};

type Setup = { cadence: Repeat; customWeeks: number; startDate: string; instructions: string; slots: DraftPictures["slots"] };
type Dlg = { kind: "message"; label: string; period?: string } | { kind: "photo"; period: string; slotId: number } | { kind: "removeAngle"; slotId: number } | null;

export default function PicturesDraft({ clientId, firstName, plan }: { clientId: number; firstName: string; plan: DraftPictures }) {
  // ---- Setup: a working copy against what is live.
  const initial: Setup = { cadence: plan.cadence === "sixweekly" ? "custom" : plan.cadence, customWeeks: plan.cadence === "sixweekly" ? 6 : 3, startDate: plan.startDate ?? "", instructions: plan.instructions, slots: plan.slots };
  const [saved, setSaved] = useState(initial);
  const [s, setS] = useState(initial);
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Every save goes to the server, then the page re-reads; what is on screen follows.
  const act = (fn: () => Promise<unknown>, said?: string) =>
    startTransition(async () => {
      await fn();
      router.refresh();
      if (said) savedToast(said);
    });
  const fd = (o: Record<string, string | number | null | undefined>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) if (v != null) f.set(k, String(v));
    return f;
  };
  const [seenPlan, setSeenPlan] = useState(plan);
  if (seenPlan !== plan) {
    setSeenPlan(plan);
    setSaved(initial);
    setS(initial);
  }
  const [adding, setAdding] = useState(false);
  const changes = (() => {
    let c = (s.cadence !== saved.cadence || (s.cadence === "custom" && s.customWeeks !== saved.customWeeks) ? 1 : 0) + (s.startDate !== saved.startDate ? 1 : 0) + (s.instructions.trim() !== saved.instructions.trim() ? 1 : 0);
    const before = new Map(saved.slots.map((x) => [x.id, x]));
    c += saved.slots.filter((x) => !s.slots.some((y) => y.id === x.id)).length;
    for (const x of s.slots) {
      const b = before.get(x.id);
      if (!b) c += 1;
      else if (b.paused !== x.paused || b.label !== x.label) c += 1;
    }
    // The angles dragged into a new order: one change.
    const kept = s.slots.filter((x) => before.has(x.id)).map((x) => x.id);
    if (kept.some((id, i) => id !== saved.slots.filter((b) => kept.includes(b.id))[i]?.id)) c += 1;
    return c;
  })();
  const isNew = (id: number) => !saved.slots.some((x) => x.id === id);

  // ---- Sheets: one open at a time; compare puts two side by side.
  const sheets = plan.sheets;
  const [open, setOpen] = useState<string | null>(sheets.find((x) => x.live)?.period ?? sheets[0]?.period ?? null);
  const [mode, setMode] = useState<"sheets" | "compare">("sheets");
  const [notes, setNotes] = useState<Record<string, { note: Note; saved: string | null }>>(() => Object.fromEntries(sheets.map((x) => [x.period, { note: x.note, saved: x.savedLabel }])));
  const [dlg, setDlg] = useState<Dlg>(null);
  const close = () => setDlg(null);
  const photoSheet = dlg?.kind === "photo" ? (sheets.find((x) => x.period === dlg.period) ?? null) : null;

  const aGrid = { gridTemplateColumns: "20px minmax(200px, 1.4fr) 150px minmax(120px, 1fr) 32px", columnGap: 24 } as const;
  const sGrid = { gridTemplateColumns: "20px minmax(160px, 1fr) 140px 110px minmax(200px, 1.3fr) 110px 32px", columnGap: 24 } as const;

  return (
    <div className="rd">
      {/* ---- Header. */}
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Progress pictures</span>
          <h1 className="rd-title">
            {firstName}&rsquo;s pictures
            {sheets.length > 0 && (
              <span className="rd-title-weeks">
                ({sheets.length} {sheets.length === 1 ? "sheet" : "sheets"})
              </span>
            )}
            {sheets.some((x) => x.live) && <span className="rd-status live">Sheet open</span>}
          </h1>
        </div>
        <div className="rd-head-actions">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="rd-btn ghost" aria-label="More for progress pictures">
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={() => setDlg({ kind: "message", label: "Progress pictures" })}>
                <ChatIcon /> Message about pictures
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ---- Sheet setup: when, how, and which angles. */}
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>Sheet setup</h2>
        </div>
        <div className="rd-rows">
          <div className="rp-when">
            <div className="rp-when-row">
              <span className="rp-word">Starts on</span>
              <DatePick value={s.startDate} onChange={(v) => setS((x) => ({ ...x, startDate: v }))} label="Day the first sheet opens" placeholder="Pick a day" className="rp-date" />
              <span className="rp-word">Repeat every</span>
              <Picker value={s.cadence} onChange={(v) => setS((x) => ({ ...x, cadence: v }))} label="How often a new sheet opens" options={CADENCES.map((c) => ({ value: c.value, label: c.label }))} />
              {s.cadence === "custom" && (
                <span className="rp-custom">
                  <input type="number" min={1} max={52} className="rd-cell-box rp-weeks" value={s.customWeeks} onChange={(e) => setS((x) => ({ ...x, customWeeks: Math.max(1, Math.min(52, Number(e.target.value) || 1)) }))} aria-label="Weeks between sheets" />
                  <span className="rp-word">{s.customWeeks === 1 ? "week" : "weeks"}</span>
                </span>
              )}
            </div>
            <label className="rp-how">
              <span className="rd-cols rp-how-label">Picture instructions</span>
              <textarea className="rd-cell-box rp-instructions" rows={2} maxLength={600} value={s.instructions} onChange={(e) => setS((x) => ({ ...x, instructions: e.target.value }))} placeholder="Morning, before breakfast. Same spot and light each time, phone at chest height, relaxed stance." />
            </label>
          </div>
          {s.slots.length > 0 && (
            <div className="rd-cols" aria-hidden="true" style={aGrid}>
              <span />
              <span>Angle</span>
              <span>Photos in</span>
              <span>Latest</span>
              <span />
            </div>
          )}
          <SortableList ids={s.slots.map((a) => a.id)} label="angle" onMove={(ids) => setS((x) => ({ ...x, slots: ids.map((id) => x.slots.find((y) => y.id === id)!).filter(Boolean) }))}>
          {s.slots.map((a) => {
            const latest = sheets.find((x) => x.cells.some((c) => c.slotId === a.id && c.src));
            return (
              <SortableItem key={a.id} id={a.id} className={`rd-row${isNew(a.id) ? " new" : ""}`}>
                {(angleGrip) => (
                <div className="rd-row-main static" style={aGrid}>
                  <span className="rd-grip" {...angleGrip}>
                    ⋮⋮
                  </span>
                  <span className="rd-ex">
                    <span className="rd-ex-name">{a.label}</span>
                    {isNew(a.id) && <small>New · not applied yet</small>}
                  </span>
                  <span className={`rd-num${a.count ? "" : " quiet"}`}>{a.count ? `${a.count} ${a.count === 1 ? "photo" : "photos"}` : "none yet"}</span>
                  <span className="rm-last">
                    {latest ? (
                      <>
                        {latest.title}
                        <small>{latest.cells.find((c) => c.slotId === a.id)?.shotDay}</small>
                      </>
                    ) : (
                      <span className="rm-last none">—</span>
                    )}
                  </span>
                  <span className="rd-row-more">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${a.label}`}>
                        <MoreIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="pb-menu">
                        <DropdownMenuItem variant="destructive" onSelect={() => (isNew(a.id) || a.count === 0 ? setS((x) => ({ ...x, slots: x.slots.filter((y) => y.id !== a.id) })) : setDlg({ kind: "removeAngle", slotId: a.id }))}>
                          <TrashIcon /> {isNew(a.id) ? "Don't add it" : "Remove angle"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
                )}
              </SortableItem>
            );
          })}
          </SortableList>
          {adding ? (
            <AddAngleRow have={s.slots.map((x) => x.label.toLowerCase())} onAdd={(label) => setS((x) => ({ ...x, slots: [...x.slots, { id: -(Date.now() + x.slots.length), label, paused: false, count: 0 }] }))} onClose={() => setAdding(false)} />
          ) : (
            <button type="button" className="rd-session add rm-additem" onClick={() => setAdding(true)}>
              + Add angle
            </button>
          )}
          {changes > 0 && (
            <div className="rd-pending">
              <span className="rd-pending-count">{changes}</span>
              <span className="rd-pending-text">
                {changes === 1 ? "change" : "changes"} to the sheet · {firstName} still sees the current one until applied
              </span>
              <button type="button" className="rd-pending-ghost" onClick={() => setS(saved)}>
                Discard
              </button>
              <button
                type="button"
                className="rd-pending-apply"
                onClick={() => {
                  const next = { ...s, slots: s.slots.filter((x) => x.label.trim()) };
                  setSaved(next);
                  setS(next);
                  // The server keeps four rhythms; a custom one lands on the nearest.
                  const cadence = next.cadence !== "custom" ? next.cadence : next.customWeeks <= 1 ? "weekly" : next.customWeeks <= 2 ? "biweekly" : next.customWeeks <= 4 ? "monthly" : "sixweekly";
                  const before = saved.slots;
                  act(async () => {
                    await savePhotoScheduleAction(clientId, { startDate: next.startDate, cadence, instructions: next.instructions });
                    for (const gone of before.filter((b) => !next.slots.some((x) => x.id === b.id))) await removePhotoSlotAction(fd({ id: gone.id }));
                    for (const x of next.slots) {
                      if (x.id < 0) await addPhotoSlotAction(fd({ clientId, label: x.label }));
                      else if (before.find((b) => b.id === x.id)?.paused !== x.paused) await setPhotoSlotPausedAction(x.id, x.paused);
                    }
                    const kept = next.slots.filter((x) => x.id > 0).map((x) => x.id);
                    if (kept.some((id, i) => before.filter((b) => kept.includes(b.id))[i]?.id !== id)) await reorderPhotoSlotsAction(clientId, kept);
                  }, `Sheet setup: ${repeatLabel(next.cadence, next.customWeeks)}, ${next.slots.length} ${next.slots.length === 1 ? "angle" : "angles"}`);
                }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ---- Sheets: what came in. */}
      <section className="rd-session open rn-card">
        <div className="rn-card-head">
          <h2>Sheets</h2>
          {sheets.length > 1 && (
            <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as "sheets" | "compare")} aria-label="Show">
              <ToggleGroupItem value="sheets">Feed</ToggleGroupItem>
              <ToggleGroupItem value="compare">Compare</ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
        {sheets.length === 0 ? (
          <p className="rd-full">{s.slots.length === 0 ? `No angles asked for yet. Add one above and ${firstName} gets a sheet to fill.` : s.startDate && s.startDate > new Date().toISOString().slice(0, 10) ? `The first sheet opens ${fmtDate(s.startDate)}.` : `Photos land here the moment ${firstName} submits.`}</p>
        ) : mode === "compare" ? (
          <CompareView sheets={sheets} />
        ) : (
          <div className="rd-rows">
            <div className="rd-cols" aria-hidden="true" style={sGrid}>
              <span />
              <span>Sheet</span>
              <span>Photos</span>
              <span>Weight</span>
              <span>Phases</span>
              <span>State</span>
              <span />
            </div>
            {sheets.map((sh, i) => {
              const isOpen = open === sh.period;
              const prev = sheets[i + 1];
              const state = sh.live ? { text: "Open", cls: "" } : sh.complete ? { text: "Complete", cls: "up" } : { text: `${sh.total - sh.inCount} missing`, cls: "down" };
              return (
                <div key={sh.period} className={`rd-row rn-day${isOpen ? " open" : ""}`}>
                  <div className="rd-row-main" style={sGrid} onClick={() => setOpen((x) => (x === sh.period ? null : sh.period))} role="button" tabIndex={0} aria-expanded={isOpen} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen((x) => (x === sh.period ? null : sh.period)))}>
                    <span className={`rd-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                      <ChevronDownIcon />
                    </span>
                    <span className="rd-ex">
                      <span className="rd-ex-name">{sh.title}</span>
                      <small>{sh.dateLabel}</small>
                    </span>
                    <span className="rp-dots" title={sh.cells.map((c) => `${c.label}: ${c.src ? "in" : "missing"}`).join("\n")}>
                      {sh.cells.map((c) => (
                        <i key={c.slotId} className={c.src ? "on" : ""} />
                      ))}
                    </span>
                    <span className={`rd-num${sh.weight == null ? " quiet" : ""}`}>
                      {sh.weight == null ? "—" : `${sh.weight} kg`}
                      {sh.weight != null && prev?.weight != null && <small className={`rp-delta${sh.weight < prev.weight ? " down" : sh.weight > prev.weight ? " up" : ""}`}>{kgDelta(prev.weight, sh.weight)}</small>}
                    </span>
                    <span className="rp-phases">
                      {sh.phases.training && <span className="rd-pill">{sh.phases.training}</span>}
                      {sh.phases.nutrition && <span className="rd-pill quiet">{sh.phases.nutrition}</span>}
                      {!sh.phases.training && !sh.phases.nutrition && <span className="rd-num quiet">—</span>}
                    </span>
                    <span>
                      <span className={`rd-set rn-vs ${state.cls}`}>{state.text}</span>
                    </span>
                    <span className="rd-row-more" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${sh.title}`}>
                          <MoreIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="pb-menu">
                          <DropdownMenuItem onSelect={() => setDlg({ kind: "message", label: `Progress pictures · ${sh.title}, ${sh.dateLabel}`, period: sh.period })}>
                            <ChatIcon /> Message about this sheet
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  </div>
                  {isOpen && (
                    <div className="rp-body">
                      <div className="rp-shots">
                        {sh.cells.map((c) => (
                          <button key={c.slotId} type="button" className="rp-shot" onClick={() => c.src && setDlg({ kind: "photo", period: sh.period, slotId: c.slotId })} disabled={!c.src} aria-label={c.src ? `Open ${c.label}` : `${c.label}: ${sh.live ? "waiting" : "never sent"}`}>
                            {c.src ? (
                              // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
                              <img src={c.src} alt="" />
                            ) : (
                              <span className="rp-hole">
                                <CameraIcon />
                                {sh.live ? "Waiting" : "Never sent"}
                              </span>
                            )}
                            <span className="rp-shot-cap">
                              <b>{c.label}</b>
                              <small>{c.shotDay ?? ""}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                      <SheetNotes
                        key={sh.period}
                        state={notes[sh.period] ?? { note: sh.note, saved: sh.savedLabel }}
                        onSave={(note) => {
                          setNotes((prev) => ({ ...prev, [sh.period]: { note, saved: "just now" } }));
                          act(() => savePhotoPeriodNoteAction(fd({ clientId, period: sh.period, ...note })), `Notes on ${sh.title} · ${firstName} sees them on the sheet`);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Dialogs. One open at a time. */}
      <Dialog open={dlg != null} onOpenChange={(o) => !o && close()}>
        {dlg?.kind === "message" && (
          <MessageDialog
            firstName={firstName}
            label={dlg.label}
            onSend={(text) => {
              const { label, period } = dlg;
              close();
              const f = fd({ clientId, text });
              f.set("link", JSON.stringify(period ? { kind: "photos", period } : { kind: "photos" }));
              act(() => sendChatMessageAction(f));
              toast.success("Sent", { description: `${firstName} gets it on Home, linked to ${label}.` });
            }}
          />
        )}
        {dlg?.kind === "photo" && photoSheet && <PhotoDialog sheet={photoSheet} sheets={sheets} slotId={dlg.slotId} onMove={(period, slotId) => setDlg({ kind: "photo", period, slotId })} />}
        {dlg?.kind === "removeAngle" && (
          <ConfirmDialog
            title={`Remove ${s.slots.find((x) => x.id === dlg.slotId)?.label ?? "angle"}?`}
            description={`${firstName} is no longer asked for it. The ${s.slots.find((x) => x.id === dlg.slotId)?.count ?? 0} photos already in stay on their sheets. Pausing keeps the angle for later.`}
            confirm="Remove angle"
            danger
            onConfirm={() => {
              setS((x) => ({ ...x, slots: x.slots.filter((y) => y.id !== dlg.slotId) }));
              close();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

/** A new angle: the usual ones to click in, or one typed. */
function AddAngleRow({ have, onAdd, onClose }: { have: string[]; onAdd: (label: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState(true);
  const box = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useClickAway(wrap, onClose);
  useEffect(() => {
    box.current?.focus();
  }, []);
  const needle = q.trim().toLowerCase();
  const list = SUGGESTED.filter((x) => !needle || x.toLowerCase().includes(needle));
  const taken = (label: string) => have.includes(label.toLowerCase());
  const exact = needle && !SUGGESTED.some((x) => x.toLowerCase() === needle);
  const pick = (label: string) => {
    if (taken(label)) return;
    onAdd(label);
    setQ("");
    setBrowse(false);
    box.current?.focus();
  };
  return (
    <div ref={wrap} className="rd-addrow">
      <div className={`rd-addrow-bar${browse || needle ? " open" : ""}`}>
        <input
          ref={box}
          className="rd-addrow-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && q.trim()) pick(list[0] && !exact ? list[0] : q.trim());
          }}
          placeholder="Name an angle"
          aria-label="Angle name"
        />
        <button
          type="button"
          className={`rd-addrow-chev${browse ? " open" : ""}`}
          onClick={() => {
            setBrowse((o) => !o);
            box.current?.focus();
          }}
          aria-label={browse ? "Hide the usual angles" : "The usual angles"}
          aria-expanded={browse}
        >
          <ChevronDownIcon />
        </button>
        <button type="button" className="rd-addrow-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {(browse || needle) && (
        <div className="rd-addrow-list" role="listbox" aria-label="Angles">
          {list.map((x) => (
            <button key={x} type="button" role="option" aria-selected={false} className={`rd-addrow-item${taken(x) ? " taken" : ""}`} disabled={taken(x)} onClick={() => pick(x)}>
              {x}
              {taken(x) && <small>on the sheet</small>}
            </button>
          ))}
          {exact && (
            <button type="button" className={`rd-addrow-item create${list.length === 0 ? " on" : ""}`} onClick={() => pick(q.trim())}>
              <PlusIcon /> Add &ldquo;{q.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
      <p className="rd-addrow-hint">An angle is one photo {"you ask for"} on every sheet. Nothing reaches the sheet until Apply.</p>
    </div>
  );
}

/** The coach's four notes on one sheet: always open to type into; the bar
 *  comes up under them the moment they differ from what is saved. */
function SheetNotes({ state, onSave }: { state: { note: Note; saved: string | null }; onSave: (note: Note) => void }) {
  const [v, setV] = useState<Note>(state.note);
  const changed = NOTE_FIELDS.some((f) => v[f.name].trim() !== state.note[f.name].trim());
  return (
    <div className="rp-notes">
      <div className="rp-notes-head">
        <span className="rd-cols rp-notes-label">Your notes</span>
        {state.saved && !changed && <span className="rp-saved">✓ Saved {state.saved}</span>}
      </div>
      <div className="rp-notes-grid">
        {NOTE_FIELDS.map((f) => (
          <label key={f.name} className="rd-field">
            <span>{f.label}</span>
            <textarea rows={3} value={v[f.name]} onChange={(e) => setV((x) => ({ ...x, [f.name]: e.target.value }))} placeholder={f.placeholder} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && changed && onSave(v)} />
          </label>
        ))}
      </div>
      {changed && (
        <div className="rd-pending rp-bar">
          <span className="rd-pending-count">{NOTE_FIELDS.filter((f) => v[f.name].trim() !== state.note[f.name].trim()).length}</span>
          <span className="rd-pending-text">Notes changed · the client sees them on this sheet once saved</span>
          <button type="button" className="rd-pending-ghost" onClick={() => setV(state.note)}>
            Discard
          </button>
          <button type="button" className="rd-pending-apply" onClick={() => onSave(v)}>
            Save notes
          </button>
        </div>
      )}
    </div>
  );
}

/** One photo big: ← → through the sheet's angles, and the same angle from earlier sheets under it. */
function PhotoDialog({ sheet, sheets, slotId, onMove }: { sheet: Sheet; sheets: Sheet[]; slotId: number; onMove: (period: string, slotId: number) => void }) {
  const cells = sheet.cells.filter((c) => c.src);
  const index = Math.max(
    0,
    cells.findIndex((c) => c.slotId === slotId),
  );
  const cell = cells[index] ?? cells[0];
  const step = (d: number) => cells.length > 1 && onMove(sheet.period, cells[(index + d + cells.length) % cells.length].slotId);
  const earlier = sheets
    .filter((x) => x.period !== sheet.period)
    .map((x) => ({ sheet: x, cell: x.cells.find((c) => c.slotId === cell.slotId && c.src) }))
    .filter((x): x is { sheet: Sheet; cell: Cell } => !!x.cell);
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
    <DialogContent className="rd-dlg rp-photodlg">
      <DialogHeader>
        <DialogTitle>
          {cell.label} · {sheet.title}
        </DialogTitle>
        <DialogDescription>
          {cell.shot ? `Shot ${cell.shot}` : sheet.dateLabel}
          {sheet.weight != null && ` · ${sheet.weight} kg`}
        </DialogDescription>
      </DialogHeader>
      <div className="rp-big">
        {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
        <img src={cell.src ?? ""} alt={`${cell.label}, ${sheet.title}`} />
        {cells.length > 1 && (
          <>
            <button type="button" className="rd-btn ghost rp-arrow left" onClick={() => step(-1)} aria-label="Previous angle">
              <ChevronLeftIcon />
            </button>
            <button type="button" className="rd-btn ghost rp-arrow right" onClick={() => step(1)} aria-label="Next angle">
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
          <span className="rd-cols rp-notes-label">Same angle, other sheets</span>
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
      <DialogFooter>
        <span className="rd-dlg-hint grow">← → move through the angles.</span>
        {cell.src && (
          <a className="rd-btn" href={cell.src} target="_blank" rel="noopener noreferrer">
            Open full size
          </a>
        )}
        <DialogClose className="rd-btn">Close</DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

// Two sheets side by side, one angle at a time, at a size the coach picks.
const SIZES = [
  { id: "s", label: "S", px: 240 },
  { id: "m", label: "M", px: 340 },
  { id: "l", label: "L", px: 460 },
  { id: "xl", label: "XL", px: 620 },
];
function CompareView({ sheets }: { sheets: Sheet[] }) {
  const chrono = [...sheets].reverse();
  const [left, setLeft] = useState(chrono[0].period);
  const [right, setRight] = useState(sheets[0].period);
  const L = sheets.find((x) => x.period === left) ?? chrono[0];
  const R = sheets.find((x) => x.period === right) ?? sheets[0];
  const angles = [...R.cells, ...L.cells.filter((c) => !R.cells.some((r) => r.slotId === c.slotId))];
  const [slot, setSlot] = useState<number | null>(null);
  const slotId = angles.some((a) => a.slotId === slot) ? slot : (angles[0]?.slotId ?? null);
  const [size, setSize] = useState("m");
  const px = SIZES.find((z) => z.id === size)?.px ?? 340;
  const weight = L.weight != null && R.weight != null ? kgDelta(L.weight, R.weight) : null;
  return (
    <div className="rp-compare">
      <div className="rp-compare-tools">
        <div className="rp-compare-picks">
          <SheetPick sheets={sheets} chrono={chrono} value={left} exclude={right} onChange={setLeft} label="First sheet" />
          <span className="rp-word">vs</span>
          <SheetPick sheets={sheets} chrono={chrono} value={right} exclude={left} onChange={setRight} label="Second sheet" />
          <span className="rp-hint">
            {daysApart(L.period, R.period)} days apart{weight ? ` · ${weight}` : ""}
          </span>
        </div>
        <div className="rp-compare-picks">
          <div className="rd-btn-group" role="group" aria-label="Angle">
            {angles.map((a) => (
              <button key={a.slotId} type="button" className={a.slotId === slotId ? "on" : ""} aria-pressed={a.slotId === slotId} onClick={() => setSlot(a.slotId)}>
                {a.label}
              </button>
            ))}
          </div>
          <div className="rd-btn-group" role="group" aria-label="Size">
            {SIZES.map((z) => (
              <button key={z.id} type="button" className={size === z.id ? "on" : ""} aria-pressed={size === z.id} onClick={() => setSize(z.id)}>
                {z.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="rp-pair">
        {[L, R].map((x, i) => {
          const c = x.cells.find((y) => y.slotId === slotId);
          return (
            <figure key={`${i}-${x.period}`} className="rp-pair-side" style={{ maxWidth: px }}>
              {c?.src ? (
                <a className="rp-pair-frame" href={c.src} target="_blank" rel="noopener noreferrer" title="Open full size">
                  {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
                  <img src={c.src} alt={`${c.label}, ${x.title}`} />
                </a>
              ) : (
                <span className="rp-pair-frame rp-hole">
                  <CameraIcon />
                  {x.live ? "Waiting" : "Never sent"}
                </span>
              )}
              {/* The sheet on the left; the day it was shot and the weigh-in on the right. */}
              <figcaption className={i === 1 ? "accent" : ""}>
                <b>{x.title}</b>
                <small>
                  {c?.shotDay ?? x.dateLabel}
                  {x.weight != null && ` · ${x.weight} kg`}
                </small>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

/** One of the two sheets in Compare, picked from a menu, oldest first. */
function SheetPick({ sheets, chrono, value, exclude, onChange, label }: { sheets: Sheet[]; chrono: Sheet[]; value: string; /** The other side of the pair: the same sheet twice compares nothing. */ exclude: string; onChange: (v: string) => void; label: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="rd-btn" aria-label={label}>
        {sheets.find((x) => x.period === value)?.title}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="pb-menu">
        {chrono.map((x) => (
          <DropdownMenuItem key={x.period} disabled={x.period === exclude} className={x.period === value ? "on" : ""} onSelect={() => onChange(x.period)}>
            {x.title} <small className="rp-menu-date">{x.dateLabel}</small>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
