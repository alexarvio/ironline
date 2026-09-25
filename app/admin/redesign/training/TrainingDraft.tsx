"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addExerciseToLibraryAction, addGymAction, addProgramWeekAction, addSessionAction, applyDayChangesAction, cancelProgramScheduleAction, clearExerciseDemoAction, copyProgramDayAction, copyProgramWeekAction, createProgramWithAction, deployProgramAction, removeGymAction, removeProgramWeekAction, removeSessionAction, removeVideoRequestAction, renameProgramAction, saveTrainingNoteAction, reorderSessionsAction, requestExerciseVideoAction, scheduleProgramDeployAction, sendChatMessageAction, sendVideoReplyAction, setExerciseAlternativesAction, setExerciseDemoLinkAction, setHomeGymAction, updateClientPhaseAction, uploadExerciseVideoAction, type DayChangesPayload } from "../../../lib/actions";
import type { MessageLink } from "../../../lib/messageLinks";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, ToggleGroup, ToggleGroupItem } from "../../../components/ui/basics";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { CalendarIcon, ChatIcon, ChevronDownIcon, ColumnsIcon, CopyIcon, DumbbellIcon, MoreIcon, PlayIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { VideoIcon } from "../../VideoRequestButton";
import PhaseDatesDialog from "../PhaseDatesDialog";
import PhaseGoalsCard from "../PhaseGoalsCard";
import CoachNoteCard from "../CoachNoteCard";
import { SortableItem, SortableList } from "../Sortable";
import Picker from "../Picker";
import DatePick from "../DatePick";

// The calmer builder, as a draft on real data. Nothing here saves: every
// action ends in a toast. What it settles, against the current builder:
//
// - One row an exercise: the name (note, and tempo / rest when their columns
//   are off, under it), the columns switched on, what the client did, and
//   the 7 / 30 day trends. A click on a trend opens every set the client
//   logged on it, week by week.
// - One status a session. Fewer borders. The week strip is plain chips with
//   one pill a session, filled once the client did it.
// - Every control is a shadcn part: menus, dialogs, tabs, toggles, toasts.
// - Edits queue on the session's own bar at its foot: cells typed into, rows
//   added, removed or dragged into a new order, the name. Apply lands them.

export type Gym = { id: number; name: string; home: boolean };
export type Library = { slug: string; label: string; exercises: { id: number; name: string }[] }[];
export type DraftRow = {
  id: number;
  /** The library exercise behind the row: demos are set per exercise. */
  exerciseId: number;
  name: string;
  sets: number;
  reps: string;
  kg: number | null;
  gymKg: { gym: string; kg: number | null }[];
  rpe: number | null;
  tempo: string | null;
  rest: number | null;
  note: string | null;
  logged: { set: number; kg: number | null; reps: number | null; rpe: number | null; gym: string | null }[];
  video: { requestId: number; state: "asked" | "in" | "replied"; note: string | null; reply: string | null } | null;
  /** The demo the client sees on this exercise: the library's, else one set on this row long ago. */
  demo: { url: string; source: "library" | "row" } | null;
  history: { week: number; label: string; target: number | null; targetReps: string; setsPlanned: number; sets: { n: number; kg: number | null; reps: number | null; rpe: number | null }[]; best: number | null; e1rm: number | null; gym: string | null; current: boolean }[];
  /** What the client did instead, when they swapped the exercise. */
  swap: string | null;
  /** The swap in full: what, when, and the sets logged on it (kept out of this row's numbers). */
  /** The chat about this exercise, both sides, oldest first. */
  exerciseChat: { mine: boolean; text: string; when: string }[];
  swapInfo: { name: string; typed: boolean; when: string; sets: { set: number; kg: number | null; reps: number | null; rpe: number | null; gym: string | null }[] } | null;
  /** What the coach offers instead when the machine is taken. */
  alternatives: { exerciseId: number; name: string; note: string }[];
  d7: number | null;
  d30: number | null;
};
export type DraftCardio = { id: number; name: string; time: string; pace: string; incline: string; distance: string; notes: string; done: boolean };
export type DraftSession = { id: number; number: number; name: string; setsPlanned: number; setsLogged: number; gym: string | null; skip: string | null; duration: number | null; ended: string | null; note: string | null; rows: DraftRow[]; cardio: DraftCardio[] };
export type DraftProgram = {
  id: number;
  programs: { id: number; name: string; weeks: number; state: "live" | "past" | "scheduled" | "draft" }[];
  name: string;
  status: "live" | "past" | "scheduled" | "draft";
  totalWeeks: number;
  /** The programme's first week number in the client's calendar; a screen week index + this - 1 is the server's week. */
  startWeek: number;
  /** The training phase on the plan that carries its dates, if one does. */
  phaseId: number | null;
  /** The coach's goals for the phase, up to three. */
  goals: string[];
  /** The coach's note to the client on this phase, top of their Training tab. */
  coachNote: string;
  startDate: string | null;
  endDate: string | null;
  weekIdx: number;
  liveIdx: number;
  weeks: { index: number; label: string; trained: boolean[]; state: "past" | "live" | "ahead" }[];
  sessions: DraftSession[];
  gyms: Gym[];
  /** The client's note to the coach on this programme. */
  note: { text: string; when: string } | null;
};

// ---- Draft-only bits ---------------------------------------------------------
const draftOnly = (what: string) => toast(what, { description: "Not wired yet: the old Training tab still does this." });
const savedToast = (what: string) => toast.success("Saved", { description: what });
const fd = (o: Record<string, string | number | null | undefined>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) if (v != null) f.set(k, String(v));
  return f;
};
const LB = 2.20462;
// Weights to the nearest half: a set logged in pounds is stored as kilos
// with long decimals (110 lb is 49.8952 kg), which read as noise.
const half = (x: number) => Math.round(x * 2) / 2;
const kgOf = (v: number | null, lbs: boolean) => (v == null ? "—" : `${half(lbs ? v * LB : v)}`);
const restOf = (s: number | null) => (s == null ? null : s >= 60 && s % 60 === 0 ? `${s / 60} min` : s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`);
const MAX_SESSIONS = 7;
const MAX_COLS = 6;

type AddedExercise = { kind: "exercise"; exerciseId: number | null; name: string; sets: number | string; reps: string; kg: number | null; rpe?: string; tempo?: string; rest?: string };
type AddedCardio = { kind: "cardio"; name: string; time: string; pace: string; incline: string; distance: string; note: string };
type Added = { key: number } & (AddedExercise | AddedCardio);
type Edits = { name?: string; note?: string; sets?: string; reps?: string; kg?: number | null; gymKg?: Record<string, number | null>; rpe?: string; tempo?: string; rest?: string };
type CardioEdit = Partial<Pick<DraftCardio, "name" | "time" | "pace" | "incline" | "distance" | "notes">>;
type Pending = { added: Added[]; removed: number[]; cardioRemoved: number[]; edits: Record<number, Edits>; cardioEdits: Record<number, CardioEdit>; order: number[] | null; renamed: string | null; alsoRemaining: boolean };
const emptyPending = (): Pending => ({ added: [], removed: [], cardioRemoved: [], edits: {}, cardioEdits: {}, order: null, renamed: null, alsoRemaining: false });
const pendingCount = (p: Pending) => p.added.length + p.removed.length + p.cardioRemoved.length + Object.keys(p.edits).length + Object.keys(p.cardioEdits).length + (p.order ? 1 : 0) + (p.renamed != null ? 1 : 0);

type Dlg =
  | { kind: "progress"; rowId: number }
  | { kind: "editExercise"; sessionId: number; rowId: number }
  | { kind: "editCardio"; sessionId: number; cardioId: number }
  | { kind: "video"; rowId: number }
  | { kind: "demo"; rowId: number }
  | { kind: "alternatives"; rowId: number }
  | { kind: "exerciseChat"; sessionId: number; rowId: number }
  | { kind: "message"; label: string; link: MessageLink }
  | { kind: "copySession"; sessionId: number }
  | { kind: "copyWeek" }
  | { kind: "deleteSession"; sessionId: number }
  | { kind: "deploy" }
  | { kind: "backToDraft" }
  | { kind: "dates" }
  | { kind: "gyms" }
  | { kind: "newProgram" }
  | { kind: "note" }
  | { kind: "removeWeek" }
  | { kind: "addWeek" }
  | null;

export default function TrainingDraft({ clientId, firstName, program, library }: { clientId: number; firstName: string; program: DraftProgram; library: Library }) {
  const router = useRouter();
  const [lbs, setLbs] = useState(false);
  const unit = lbs ? "lbs" : "kg";
  // The product's six columns, six at a time; what the client did and the
  // two trends are always there. Cardio has its own four.
  const [picked, setCols] = useState({ sets: true, reps: true, weight: true, rpe: true, tempo: false, rest: false });
  const [ccols, setCcols] = useState({ time: true, pace: true, incline: true, distance: true });
  const [colTab, setColTab] = useState<"exercises" | "cardio">("exercises");
  // A column is on when the coach ticked it, or when any exercise in the
  // week has something in it: a tempo the coach set is never hidden.
  const [sessions, setSessions] = useState<DraftSession[]>(program.sessions);
  const [, startTransition] = useTransition();
  // Every save goes to the server, then the page re-reads; what is on screen
  // follows the server's answer (derived-state resets below).
  const act = (fn: () => Promise<unknown>, said?: string) =>
    startTransition(async () => {
      const r = await fn();
      router.refresh();
      if (r && typeof r === "object" && "ok" in r && (r as { ok: boolean }).ok === false) toast.error((r as { error?: string }).error ?? "Something went wrong");
      else if (typeof r === "string" && r) toast.error(r);
      else if (said) savedToast(said);
    });
  const [seenProgram, setSeenProgram] = useState(program);
  if (seenProgram !== program) {
    setSeenProgram(program);
    setSessions(program.sessions);
  }
  const inUse = {
    rpe: sessions.some((x) => x.rows.some((r) => r.rpe != null)),
    tempo: sessions.some((x) => x.rows.some((r) => !!r.tempo)),
    rest: sessions.some((x) => x.rows.some((r) => r.rest != null)),
  };
  const cols = { ...picked, rpe: picked.rpe || inUse.rpe, tempo: picked.tempo || inUse.tempo, rest: picked.rest || inUse.rest };
  const onCount = Object.values(cols).filter(Boolean).length;
  const [gyms, setGyms] = useState<Gym[]>(program.gyms);
  const [seenGyms, setSeenGyms] = useState(program.gyms);
  if (seenGyms !== program.gyms) {
    setSeenGyms(program.gyms);
    setGyms(program.gyms);
  }
  const multiGym = gyms.length > 1;
  // Room for the figures: the name and the log stretch with the screen, the
  // figure columns keep a set width, so on a wide screen they get more air.
  const GAP = 24;
  const exWidths = [cols.sets && 72, cols.reps && 88, cols.weight && 92, cols.rpe && 68, cols.tempo && 88, cols.rest && 84].filter((w): w is number => typeof w === "number");
  const gridCols = `20px minmax(220px, 1.5fr)${exWidths.map((w) => ` ${w}px`).join("")} minmax(180px, 1fr) minmax(260px, 1.3fr) 80px 80px 112px`;
  const colStyle = { gridTemplateColumns: gridCols, columnGap: GAP } as const;
  // The band the exercise figures take up, gaps included: cardio's figures
  // share it, so the name, "did" and ⋯ columns line up across both tables.
  const bandW = exWidths.reduce((t, w) => t + w, 0) + Math.max(0, exWidths.length - 1) * GAP;
  // A cardio column shows when it is ticked and at least one row has a value in it.
  type CardioShow = { time: boolean; pace: boolean; incline: boolean; distance: boolean; note: boolean };
  const cardioStyleFor = (show: CardioShow) => {
    const m = Object.values(show).filter(Boolean).length;
    // With the exercise band too narrow for the figures, the band grows.
    const w = Math.max(bandW, m * 92 + Math.max(0, m - 1) * GAP);
    return { grid: { gridTemplateColumns: `20px minmax(220px, 1.5fr) ${w}px minmax(180px, 1fr) minmax(260px, 1.3fr) 80px 80px 112px`, columnGap: GAP } as const, band: { gridTemplateColumns: `repeat(${Math.max(1, m)}, minmax(0, 1fr))`, columnGap: GAP } as const };
  };
  // Old rows kept bare figures ("6"); shown with the unit the form now adds.
  const unitOf = (v: string, u: string) => (!v ? "—" : /^\s*[\d.,]+\s*$/.test(v) ? `${v.trim()}${u}` : v);

  // The week's sessions, and the weeks, live in state so delete, reorder and
  // add can show what they would do.
  const [weeks, setWeeks] = useState(program.weeks);
  const [seenWeeks, setSeenWeeks] = useState(program.weeks);
  if (seenWeeks !== program.weeks) {
    setSeenWeeks(program.weeks);
    setWeeks(program.weeks);
  }
  /** The server's week number for a week index on screen. */
  const weekNo = (index: number) => program.startWeek + index - 1;
  // The week on screen. The server loads one week's sessions; weeks added here
  // live only on this screen, their sessions kept by index while another week
  // shows, and the loaded week joins them the moment the coach leaves it.
  const [viewIdx, setViewIdx] = useState(program.weekIdx);
  const week = weeks[viewIdx - 1] ?? weeks[0];
  const [stash, setStash] = useState<Record<number, DraftSession[]>>({});
  const isLocal = (index: number) => index === viewIdx || index in stash;
  const [pending, setPending] = useState<Record<number, Pending>>({});
  const pend = (id: number) => pending[id] ?? emptyPending();
  const patch = (id: number, f: (p: Pending) => Pending) => setPending((prev) => ({ ...prev, [id]: f(prev[id] ?? emptyPending()) }));
  // What is being added, and where. A cardio being typed is already a pending
  // change (key: its row in the session's queue), so the bar shows at once.
  const [adding, setAdding] = useState<{ session: number; kind: "exercise" | "cardio"; key?: number } | null>(null);
  const restSeconds = (v: string): number | null => {
    const m = v.trim().match(/^(\d+)(?::(\d{2}))?\s*(s|sec|min|m)?$/i);
    if (!m) return null;
    const a = Number(m[1]);
    if (m[2]) return a * 60 + Number(m[2]);
    return /^m/i.test(m[3] ?? "") ? a * 60 : a;
  };
  /** The queued changes on a session, in the shape the server applies. */
  const payloadOf = (s: DraftSession, p: Pending): DayChangesPayload => {
    const str = (v: number | null | undefined) => (v == null ? "" : String(v));
    const fields: DayChangesPayload["fields"] = {};
    const gymsOut: NonNullable<DayChangesPayload["gyms"]> = {};
    for (const [id, e] of Object.entries(p.edits)) {
      const f: DayChangesPayload["fields"][string] = {};
      if (e.sets !== undefined) f.sets = e.sets;
      if (e.reps !== undefined) f.reps = e.reps;
      if (e.kg !== undefined) f.targetWeight = str(e.kg);
      if (e.rpe !== undefined) f.rpe = e.rpe;
      if (e.tempo !== undefined) f.tempo = e.tempo;
      if (e.rest !== undefined) f.rest = e.rest;
      if (e.note !== undefined) f.notes = e.note;
      if (Object.keys(f).length) fields[id] = f;
      if (e.gymKg) {
        const byGym: Record<string, string> = {};
        for (const [gymName, kg] of Object.entries(e.gymKg)) {
          const g = gyms.find((x) => x.name === gymName);
          if (g && !g.home) byGym[String(g.id)] = str(kg);
        }
        if (Object.keys(byGym).length) gymsOut[id] = byGym;
      }
    }
    return {
      programDayId: s.id,
      alsoRemaining: p.alsoRemaining,
      label: p.renamed,
      rest: null,
      fields,
      custom: {},
      gyms: gymsOut,
      cardio: {
        fields: Object.fromEntries(Object.entries(p.cardioEdits).map(([id, e]) => [id, { ...e }])),
        removed: p.cardioRemoved,
        // Typed without a name (the activity), it goes out as plain "Cardio".
        added: p.added.filter((a): a is Added & AddedCardio => a.kind === "cardio").map((a) => ({ name: a.name.trim() || "Cardio", time: a.time, pace: a.pace, incline: a.incline, distance: a.distance, notes: a.note })),
        order: null,
      },
      removed: p.removed,
      added: p.added
        .filter((a): a is Added & AddedExercise => a.kind === "exercise" && a.exerciseId != null)
        .map((a) => ({ exerciseId: a.exerciseId!, fields: { sets: String(a.sets), reps: a.reps, targetWeight: str(a.kg), rpe: a.rpe ?? "", tempo: a.tempo ?? "", rest: a.rest ?? "" } })),
      order: p.order,
    };
  };
  const applyPending = (sessionId: number) => {
    const p = pend(sessionId);
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const kept = (p.order ?? s.rows.map((r) => r.id)).map((id) => s.rows.find((r) => r.id === id)!).filter((r) => r && !p.removed.includes(r.id));
        const rows = kept.map((r) => {
          const e = p.edits[r.id];
          if (!e) return r;
          return {
            ...r,
            name: e.name ?? r.name,
            note: e.note !== undefined ? e.note.trim() || null : r.note,
            sets: e.sets !== undefined ? Math.max(1, parseInt(e.sets, 10) || r.sets) : r.sets,
            reps: e.reps !== undefined ? e.reps : r.reps,
            kg: e.kg !== undefined ? e.kg : r.kg,
            rpe: e.rpe !== undefined ? (e.rpe.trim() === "" ? null : Number(e.rpe) || r.rpe) : r.rpe,
            tempo: e.tempo !== undefined ? e.tempo.trim() || null : r.tempo,
            rest: e.rest !== undefined ? (e.rest.trim() === "" ? null : restSeconds(e.rest) ?? r.rest) : r.rest,
          };
        });
        const addedRows: DraftRow[] = p.added
          .filter((a): a is Added & AddedExercise => a.kind === "exercise")
          .map((a, i) => ({ id: -(Date.now() + i + 1), exerciseId: a.exerciseId ?? 0, name: a.name, sets: Math.max(1, parseInt(String(a.sets), 10) || 3), reps: a.reps, kg: a.kg, gymKg: gyms.map((g) => ({ gym: g.name, kg: a.kg })), rpe: null, tempo: null, rest: null, note: null, logged: [], video: null, demo: null, history: [], swap: null, swapInfo: null, exerciseChat: [], alternatives: [], d7: null, d30: null }));
        const addedCardio: DraftCardio[] = p.added
          .filter((a): a is Added & AddedCardio => a.kind === "cardio")
          .map((a, i) => ({ id: -(Date.now() + 500 + i), name: a.name, time: a.time, pace: a.pace, incline: a.incline, distance: a.distance, notes: a.note, done: false }));
        const all = [...rows, ...addedRows];
        return {
          ...s,
          name: p.renamed ?? s.name,
          rows: all,
          cardio: [...s.cardio.filter((c) => !p.cardioRemoved.includes(c.id)).map((c) => ({ ...c, ...(p.cardioEdits[c.id] ?? {}) })), ...addedCardio],
          setsPlanned: all.reduce((t, r) => t + r.sets, 0),
        };
      })
    );
    setPending((prev) => ({ ...prev, [sessionId]: emptyPending() }));
  };
  // A demo set or taken off in this sitting, by row; a row not touched reads its own.
  const [demos, setDemos] = useState<Record<number, DraftRow["demo"]>>({});
  // Every session starts folded; the coach opens the one they want.
  const [open, setOpen] = useState<number | null>(null);
  // Arriving from a link in a message (#session-ID, or #session-ID-ex-ROW for
  // an exercise): that session unfolds and comes into view; an exercise's row
  // is scrolled to and marked for a moment. After the first paint, so the
  // server's closed rows match. (The pattern read "d+" for a while, so no
  // link ever matched and the week opened folded.)
  const [flashRow, setFlashRow] = useState<number | null>(null);
  // Rows whose swap is opened underneath them.
  const [openSwaps, setOpenSwaps] = useState<number[]>([]);
  const toggleSwap = (id: number) => setOpenSwaps((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  useEffect(() => {
    const m = /^#session-(\d+)(?:-ex-(\d+))?$/.exec(window.location.hash);
    if (!m) return;
    const id = Number(m[1]);
    const row = m[2] ? Number(m[2]) : null;
    let clear: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      setOpen(id);
      setTimeout(() => {
        const target = (row != null && document.getElementById(`row-${row}`)) || document.getElementById(`session-${id}`);
        target?.scrollIntoView({ behavior: "smooth", block: row != null ? "center" : "start" });
        if (row != null) {
          setFlashRow(row);
          clear = setTimeout(() => setFlashRow(null), 2400);
        }
      }, 80);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (clear) clearTimeout(clear);
    };
  }, []);
  const [videos, setVideos] = useState<Record<number, DraftRow["video"]>>(() => Object.fromEntries(program.sessions.flatMap((s) => s.rows.map((r) => [r.id, r.video]))));
  const [seenVideos, setSeenVideos] = useState(program.sessions);
  if (seenVideos !== program.sessions) {
    setSeenVideos(program.sessions);
    setVideos(Object.fromEntries(program.sessions.flatMap((s) => s.rows.map((r) => [r.id, r.video]))));
    setDemos({});
  }
  const [noteSeen, setNoteSeen] = useState(false);
  const [dlg, setDlg] = useState<Dlg>(null);
  const close = () => setDlg(null);
  const rowById = (id: number) => sessions.flatMap((s) => s.rows).find((r) => r.id === id) ?? null;
  const sessionById = (id: number) => sessions.find((s) => s.id === id) ?? null;

  // Drag to reorder: exercises inside a session (queued on its bar), and
  // sessions inside the week.
  // (SortableList / SortableItem; the order is saved on drop.)
  const orderOf = (s: DraftSession) => pend(s.id).order ?? s.rows.map((r) => r.id);

  const today = new Date().toISOString().slice(0, 10);
  const weekDate = (index: number) => {
    if (!program.startDate) return null;
    const d = new Date(`${program.startDate}T00:00:00`);
    d.setDate(d.getDate() + (index - 1) * 7);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const startHasCome = !!program.startDate && program.startDate <= today;
  const showWeek = (index: number) => {
    const back = stash[index];
    if (index === viewIdx || !back) return;
    setStash((prev) => {
      const next = { ...prev, [viewIdx]: sessions };
      delete next[index];
      return next;
    });
    setSessions(back);
    setViewIdx(index);
    setOpen(back.find((s) => s.setsLogged < s.setsPlanned)?.id ?? back[0]?.id ?? null);
  };
  // Weeks are added and removed on the server (the dialogs below); the page then lands on the right one.
  const later = weeks.filter((w) => w.index > viewIdx);
  const laterLabel = later.length === 0 ? "" : later.length === 1 ? `W${later[0].index}` : `W${later[0].index}–W${later[later.length - 1].index}`;

  return (
    <div className="rd">
      {/* ---- Header: the programme, where it is, its actions. */}
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Programme</span>
          <h1 className="rd-title">
            {program.programs.length > 1 ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="rd-switch" aria-label="Switch programme">
                  {program.name}
                  <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="pb-menu rd-switch-menu">
                  {program.programs.map((p) => (
                    <DropdownMenuItem key={p.id} asChild>
                      <Link href={`/admin/redesign/training?client=${clientId}&program=${p.id}`} className={p.id === program.id ? "on" : ""}>
                        <span className="rd-switch-name">{p.name}</span>
                        <span className={`rd-status ${p.state}`}>{stateLabel(p.state)}</span>
                        <small>{p.weeks} wk</small>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDlg({ kind: "newProgram" })}>
                    <PlusIcon /> New programme
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              program.name
            )}
            <span className="rd-title-weeks">({weeks.length} weeks)</span>
            <span className={`rd-status ${program.status}`}>{stateLabel(program.status)}</span>
          </h1>
          {program.startDate && (
            <span className="rd-sub">
              {fmtDate(program.startDate)}
              {program.endDate && ` – ${fmtDate(program.endDate)}`}
            </span>
          )}
        </div>
        <div className="rd-head-actions">
          {/* The client's note on the programme sits with the header's actions, so the week strip has the whole row. */}
          {program.note && (
            <button type="button" className={`rd-note${noteSeen ? "" : " unseen"}`} onClick={() => setDlg({ kind: "note" })} title={`${firstName}'s note on this programme`}>
              <ChatIcon />
              <span>
                Note from {firstName}
                <small>{program.note.when}</small>
              </span>
            </button>
          )}
          {program.status === "draft" && (
            <button type="button" className="rd-btn primary" onClick={() => setDlg({ kind: "deploy" })}>
              {startHasCome ? "Make it live" : "Schedule it"}
            </button>
          )}
          {program.status === "scheduled" && (
            <>
              <button type="button" className="rd-btn" onClick={() => setDlg({ kind: "backToDraft" })}>
                Back to draft
              </button>
              <button type="button" className="rd-btn primary" onClick={() => setDlg({ kind: "deploy" })}>
                Make it live now
              </button>
            </>
          )}
          <ToggleGroup type="single" value={lbs ? "lbs" : "kg"} onValueChange={(v) => v && setLbs(v === "lbs")} aria-label="Unit">
            <ToggleGroupItem value="kg">Kg</ToggleGroupItem>
            <ToggleGroupItem value="lbs">Lbs</ToggleGroupItem>
          </ToggleGroup>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="rd-btn ghost" aria-label="More for the programme">
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={() => setDlg({ kind: "gyms" })}>
                <DumbbellIcon /> Client gyms
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ColumnsIcon /> Columns shown
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="pb-menu rd-colmenu">
                  {/* Exercises | Cardio across the top; one side's columns at a time. */}
                  <div className="rd-coltabs" role="tablist" onKeyDown={(e) => e.stopPropagation()}>
                    {(["exercises", "cardio"] as const).map((k) => (
                      <button key={k} type="button" role="tab" aria-selected={colTab === k} className={colTab === k ? "on" : ""} onClick={() => setColTab(k)}>
                        {k === "exercises" ? "Exercises" : "Cardio"}
                      </button>
                    ))}
                  </div>
                  {colTab === "exercises" ? (
                    <>
                      {(
                        [
                          ["sets", "Sets"],
                          ["reps", "Reps"],
                          ["weight", "Weight"],
                          ["rpe", "RPE"],
                          ["tempo", "Tempo"],
                          ["rest", "Rest"],
                        ] as const
                      ).map(([k, label]) => (
                        <DropdownMenuCheckboxItem
                          key={k}
                          checked={cols[k]}
                          disabled={(!cols[k] && onCount >= MAX_COLS) || (k in inUse && inUse[k as keyof typeof inUse])}
                          onCheckedChange={(v) => setCols((c) => ({ ...c, [k]: !!v }))}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {label}
                          {k in inUse && inUse[k as keyof typeof inUse] && <small className="rd-menu-inuse">in use</small>}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => draftOnly("Custom column")}>
                        <PlusIcon /> Custom column
                      </DropdownMenuItem>
                      <p className="rd-menu-hint">{MAX_COLS} at a time. Notes always show under the name.</p>
                    </>
                  ) : (
                    <>
                      {(
                        [
                          ["time", "Time"],
                          ["pace", "Pace"],
                          ["incline", "Incline"],
                          ["distance", "Distance"],
                        ] as const
                      ).map(([k, label]) => (
                        <DropdownMenuCheckboxItem key={k} checked={ccols[k]} onCheckedChange={(v) => setCcols((c) => ({ ...c, [k]: !!v }))} onSelect={(e) => e.preventDefault()}>
                          {label}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <p className="rd-menu-hint">What a cardio row shows under its name.</p>
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={() => setDlg({ kind: "dates" })}>
                <CalendarIcon /> Edit dates
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDlg({ kind: "newProgram" })}>
                <PlusIcon /> New programme
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ---- The coach's goals for this phase, shown on the client's Home. */}
      <PhaseGoalsCard phaseId={program.phaseId} phaseName={program.name} firstName={firstName} goals={program.goals} />
      {program.phaseId != null && <CoachNoteCard firstName={firstName} note={program.coachNote} what="training" save={(text) => saveTrainingNoteAction(program.phaseId!, text)} />}

      {/* ---- The weeks: plain chips, one pill a session. */}
      <div className="rd-weekrow">
        <Tabs value={String(viewIdx)} className="rd-weeks">
          <TabsList className="rd-weeklist">
            {weeks.map((w) => (
              <TabsTrigger key={w.index} value={String(w.index)} asChild>
                <Link
                  href={`/admin/redesign/training?client=${clientId}&program=${program.id}&week=${w.index}`}
                  className={`rd-week ${w.state}`}
                  title={`${w.label}: ${w.trained.filter(Boolean).length} of ${w.trained.length} sessions done`}
                  onClick={(e) => {
                    // A week held on this screen switches in place; the rest load from the server.
                    if (isLocal(w.index)) {
                      e.preventDefault();
                      showWeek(w.index);
                    }
                  }}
                >
                  <span>
                    {w.label}
                    {w.state === "live" && <i className="rd-live-dot" title="This week" aria-label="This week" />}
                  </span>
                  {/* One bar a session, green once the client did it; the count says the same in words. */}
                  <span className="rd-pills" aria-hidden="true">
                    {w.trained.length === 0 ? <em>no sessions</em> : w.trained.map((t, i) => <i key={i} className={t ? "on" : ""} />)}
                  </span>
                  {/* The Monday the week starts on; the bars above already say how many sessions and how many are done. */}
                  <small>{weekDate(w.index) ?? (w.trained.length === 0 ? "no sessions" : w.state === "ahead" ? `${w.trained.length} planned` : `${w.trained.filter(Boolean).length} of ${w.trained.length} sessions`)}</small>
                </Link>
              </TabsTrigger>
            ))}
            <button type="button" className="rd-week add" onClick={() => setDlg({ kind: "addWeek" })}>
              <span>+ Week</span>
              <span className="rd-pills" aria-hidden="true">
                <em>&nbsp;</em>
              </span>
              <small>{weekDate(weeks.length + 1) ?? "add one"}</small>
            </button>
          </TabsList>
        </Tabs>
      </div>

      {/* ---- The week's sessions. */}
      <div className="rd-weekhead">
        <h2>
          {week.label} <span>· {week.state === "ahead" ? `${week.trained.length} sessions planned` : `${week.trained.filter(Boolean).length} of ${week.trained.length} sessions done`}</span>
        </h2>
        <div className="rd-weekhead-actions">
          {week.state === "ahead" && week.index === weeks.length && weeks.length > 1 && (
            <button type="button" className="rd-btn ghost wide" onClick={() => setDlg({ kind: "removeWeek" })}>
              <TrashIcon /> Remove week
            </button>
          )}
          {viewIdx > 1 && week.state !== "past" && (
            <button type="button" className="rd-btn" onClick={() => setDlg({ kind: "copyWeek" })}>
              <CopyIcon /> Copy week {viewIdx - 1} here
            </button>
          )}
        </div>
      </div>

      <div className="rd-sessions">
        <SortableList
          ids={sessions.map((s) => s.id)}
          label="session"
          onMove={(ids) => {
            setSessions(ids.map((id) => sessions.find((x) => x.id === id)!));
            act(() => reorderSessionsAction(clientId, weekNo(viewIdx), ids as number[]), "Session order changed");
          }}
        >
        {sessions.map((s) => {
          const p = pend(s.id);
          const isOpen = open === s.id;
          const name = p.renamed ?? s.name;
          const complete = s.setsPlanned > 0 && s.setsLogged >= s.setsPlanned && s.cardio.every((c) => c.done);
          // The states worth a word: done, skipped, or begun and left with
          // sets or cardio still to log (ended early, or partly logged), as
          // the client's app calls it too.
          const status = s.skip ? { text: "Skipped", cls: "warn" } : complete ? { text: "Completed", cls: "good" } : s.ended || s.setsLogged > 0 ? { text: "Unfinished", cls: "unfinished" } : null;
          const rows = orderOf(s)
            .map((id) => s.rows.find((r) => r.id === id)!)
            .filter((r) => r && !p.removed.includes(r.id));
          return (
            <SortableItem key={s.id} id={s.id} as="section" anchor={`session-${s.id}`} className={`rd-session${isOpen ? " open" : ""}`}>
              {(sessionGrip) => (
              <>
              <div className="rd-session-head">
                <span className="rd-grip" {...sessionGrip}>
                  ⋮⋮
                </span>
                <button type="button" className="rd-session-toggle" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen} aria-label={isOpen ? `Fold ${name}` : `Open ${name}`}>
                  <span className={`rd-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                    <ChevronDownIcon />
                  </span>
                </button>
                {/* The name, then the counts in columns of their own, so every
                    session's line up down the week. */}
                <span className="rd-session-namecol">
                  <SessionName value={name} onChange={(v) => patch(s.id, (q) => ({ ...q, renamed: v === s.name ? null : v }))} />
                </span>
                <span className="rd-session-count">
                  {rows.length} {rows.length === 1 ? "exercise" : "exercises"}
                </span>
                <span className="rd-session-count">{s.cardio.length ? `${s.cardio.length} cardio` : ""}</span>
                {/* On the right, right to left: the state, the time, the gym,
                    a swap, the client's note. */}
                {/* Unlabelled columns on the right, each a set width with its
                    pill centred, so they line up down the week whatever the
                    gym: (left to right) a swap, the client's note, the time,
                    the gym, the state. */}
                <span className="rd-session-tags">
                  {/* The swap and the client's note come and go, so they pack
                      against the time with no empty slot; the time, gym and
                      state keep their set columns. */}
                  <span className="rd-tagextras">
                    {s.note && (
                      <span className="rd-tag note" title={`${firstName}'s note: ${s.note}`} aria-label={`${firstName} left a note: ${s.note}`}>
                        <ChatIcon />
                      </span>
                    )}
                    {(() => {
                      // A video from the client in this session: waiting for a reply, or answered.
                      const vs = rows.map((r) => videos[r.id] ?? null).filter((v) => v && (v.state === "in" || v.state === "replied"));
                      if (vs.length === 0) return null;
                      const waiting = vs.some((v) => v!.state === "in");
                      return (
                        <span className={`rd-flag video ${waiting ? "in" : "replied"}`} title={waiting ? `${firstName} sent a video · waiting for your reply` : "Their video · replied"} aria-label={waiting ? "A video is waiting for your reply" : "Video replied"}>
                          <VideoIcon />
                        </span>
                      );
                    })()}
                    {(() => {
                      const n = rows.filter((r) => r.swap).length;
                      return n > 0 ? (
                        <span className="rd-swapdot static" title={`${firstName} swapped ${n} exercise${n === 1 ? "" : "s"} in this session`} aria-label={`${n} swapped`}>
                          <SwapIcon />
                          {n > 1 && <b>{n}</b>}
                        </span>
                      ) : null;
                    })()}
                  </span>
                  <span className="rd-tagslot time">{s.duration != null && <span className="rd-tag time">{s.duration} min</span>}</span>
                  <span className="rd-tagslot gym">{s.gym && <span className="rd-tag gym" title={s.gym}>{s.gym}</span>}</span>
                  <span className="rd-tagslot state">{status ? <span className={`rd-pill ${status.cls}`}>{status.text}</span> : rows.length + s.cardio.length > 0 ? <span className="rd-pill idle">Not started</span> : null}</span>
                </span>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="rd-btn ghost" aria-label={`More for ${name}`}>
                    <MoreIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="pb-menu">
                    <DropdownMenuItem onSelect={() => setDlg({ kind: "message", label: `${name}, ${week.label}`, link: { kind: "session", dayId: s.id } })}>
                      <ChatIcon /> Message about this session
                    </DropdownMenuItem>
                    {(rows.length > 0 || s.cardio.length > 0) && (
                      <DropdownMenuItem onSelect={() => setDlg({ kind: "copySession", sessionId: s.id })}>
                        <CopyIcon /> Duplicate session
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "deleteSession", sessionId: s.id })}>
                      <TrashIcon /> Delete session
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {isOpen && (
                <div className="rd-rows">
                  {s.skip && <p className="rd-skip">{firstName} couldn&rsquo;t train: &ldquo;{s.skip}&rdquo;</p>}
                  {s.note && <p className="rd-session-note">{firstName} wrote: &ldquo;{s.note}&rdquo;</p>}
                  <div className="rd-cols" aria-hidden="true" style={colStyle}>
                    <span />
                    <span>Exercise</span>
                    {cols.sets && <span>Sets</span>}
                    {cols.reps && <span>Reps</span>}
                    {cols.weight && <span>{unit}</span>}
                    {cols.rpe && <span>RPE</span>}
                    {cols.tempo && <span>Tempo</span>}
                    {cols.rest && <span>Rest</span>}
                    <span>Note</span>
                    <span>{firstName} did</span>
                    <span>7 days</span>
                    <span>30 days</span>
                    <span />
                  </div>

                  <SortableList
                    ids={rows.map((r) => r.id)}
                    label="exercise"
                    onMove={(ids) => {
                      // Rows taken off the session stay at the end of the order, unseen.
                      const next = [...(ids as number[]), ...orderOf(s).filter((id) => !ids.includes(id))];
                      const same = next.every((id, i) => id === s.rows[i]?.id);
                      patch(s.id, (q) => ({ ...q, order: same ? null : next }));
                    }}
                  >
                  {rows.map((r) => {
                    const e = p.edits[r.id] ?? {};
                    const edit = (f: Edits) => patch(s.id, (q) => ({ ...q, edits: { ...q.edits, [r.id]: { ...(q.edits[r.id] ?? {}), ...f } } }));
                    const video = videos[r.id] ?? null;
                    const shownName = e.name ?? r.name;
                    const under = e.note !== undefined ? e.note : (r.note ?? "");
                    return (
                      <SortableItem key={r.id} id={r.id} anchor={`row-${r.id}`} className={`rd-row${Object.keys(e).length ? " edited" : ""}${flashRow === r.id ? " flash" : ""}`}>
                        {(rowGrip) => (
                        <>
                        <div className="rd-row-main" style={colStyle}>
                          <span className="rd-grip" {...rowGrip}>
                            ⋮⋮
                          </span>
                          <span className="rd-ex">
                            <span className="rd-ex-name">
                              <button type="button" className="rd-ex-btn" onClick={() => setDlg({ kind: "editExercise", sessionId: s.id, rowId: r.id })} title="Edit this exercise">
                                {shownName}
                              </button>
                            </span>
                            {/* The demo set on it, in the same spot on every row. */}
                            <span className="rd-demo-slot">
                              {(() => {
                                const demo = demos[r.id] === undefined ? r.demo : demos[r.id];
                                return demo ? (
                                  <a className="rd-demo" href={demo.url} target="_blank" rel="noopener noreferrer" title="Demo set · play it" aria-label={`Play the demo for ${r.name}`}>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                                    </svg>
                                  </a>
                                ) : null;
                              })()}
                            </span>
                          </span>
                          {cols.sets && <Cell value={e.sets ?? String(r.sets)} onChange={(v) => edit({ sets: v })} label="Sets" width="sm" />}
                          {cols.reps && <Cell value={e.reps ?? r.reps} onChange={(v) => edit({ reps: v })} label="Reps" placeholder="8-10" />}
                          {cols.weight && (
                            <span title={multiGym ? r.gymKg.map((g) => `${g.gym}: ${kgOf(g.kg, lbs)} ${unit}`).join("\n") : undefined}>
                              <WeightCell key={unit} kg={e.kg !== undefined ? e.kg : r.kg} lbs={lbs} onChange={(v) => edit({ kg: v })} />
                            </span>
                          )}
                          {cols.rpe && <Cell value={e.rpe ?? (r.rpe == null ? "" : String(r.rpe))} onChange={(v) => edit({ rpe: v })} label="RPE" width="sm" />}
                          {cols.tempo && <Cell value={e.tempo ?? (r.tempo ?? "")} onChange={(v) => edit({ tempo: v })} label="Tempo" />}
                          {cols.rest && <Cell value={e.rest ?? (restOf(r.rest) ?? "")} onChange={(v) => edit({ rest: v })} label="Rest" />}
                          <span className="rd-cell rd-notecol">
                            <input className="rd-cell-box" value={under} onChange={(ev) => edit({ note: ev.target.value })} placeholder="Add a note" aria-label={`Note on ${r.name}`} maxLength={300} />
                          </span>
                          <span className="rd-did">
                            {r.logged.length === 0 ? (
                              <em>{week.state === "ahead" ? "" : "Not logged"}</em>
                            ) : (
                              r.logged.map((l) => {
                                const over = l.kg != null && r.kg != null ? l.kg - r.kg : 0;
                                return (
                                  <span key={l.set} className={`rd-set${over > 0 ? " up" : over < 0 ? " down" : ""}`} title={l.gym ?? undefined}>
                                    {kgOf(l.kg, lbs)}×{l.reps ?? "—"}
                                    {l.rpe != null && <small>@{l.rpe}</small>}
                                  </span>
                                );
                              })
                            )}
                          </span>
                          {[r.d7, r.d30].map((dv, i) => (
                            <button key={i} type="button" className={`rd-trendcell${dv == null ? " none" : dv > 0 ? " up" : dv < 0 ? " down" : " same"}`} title={`${r.name}: every set ${firstName} logged`} onClick={() => setDlg({ kind: "progress", rowId: r.id })}>
                              {dv == null ? "—" : dv === 0 ? "=" : `${dv > 0 ? "+" : "−"}${Math.abs(dv).toFixed(1)}%`}
                            </button>
                          ))}
                          <span className="rd-row-more">
                            {/* Three fixed slots, so each kind lines up down the table:
                                their messages about it, a video they sent, a swap
                                (opens what they did). */}
                            <span className="rd-flags">
                              <span className="rd-flag-slot">
                                {r.exerciseChat.some((m) => !m.mine) && (
                                  <button
                                    type="button"
                                    className="rd-flag chat"
                                    onClick={() => setDlg({ kind: "exerciseChat", sessionId: s.id, rowId: r.id })}
                                    title={`${firstName} wrote about ${r.name} · read and reply`}
                                    aria-label={`Read what ${firstName} wrote about ${r.name}, and reply`}
                                  >
                                    <ChatIcon />
                                  </button>
                                )}
                              </span>
                              <span className="rd-flag-slot">
                                {video && (video.state === "in" || video.state === "replied") && (
                                  <button
                                    type="button"
                                    className={`rd-flag video ${video.state}`}
                                    onClick={() => setDlg({ kind: "video", rowId: r.id })}
                                    title={video.state === "in" ? `${firstName}'s video is in · watch and reply` : "Their video · replied"}
                                    aria-label={video.state === "in" ? `Watch ${firstName}'s video` : "Their video, replied"}
                                  >
                                    <VideoIcon />
                                  </button>
                                )}
                              </span>
                              <span className="rd-flag-slot">
                                {r.swap && (
                                  <button
                                    type="button"
                                    className={`rd-swapdot${openSwaps.includes(r.id) ? " on" : ""}`}
                                    onClick={() => toggleSwap(r.id)}
                                    aria-expanded={openSwaps.includes(r.id)}
                                    title={`${firstName} did ${r.swap} instead`}
                                    aria-label={`Swapped for ${r.swap}: show what they did`}
                                  >
                                    <SwapIcon />
                                  </button>
                                )}
                              </span>
                            </span>
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${r.name}`}>
                                <MoreIcon />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="pb-menu">
                                <DropdownMenuItem onSelect={() => setDlg({ kind: "video", rowId: r.id })}>
                                  <VideoIcon />
                                  {!video ? "Ask for a video" : video.state === "asked" ? "Video asked for · waiting" : video.state === "in" ? "Watch their video · reply" : "Their video · replied"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDlg({ kind: "demo", rowId: r.id })}>
                                  <PlayIcon /> {(demos[r.id] === undefined ? r.demo : demos[r.id]) ? "Demo video · change" : "Add demo"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDlg({ kind: "alternatives", rowId: r.id })}>
                                  <DumbbellIcon /> {r.alternatives.length ? `Alternatives · ${r.alternatives.length}` : "Add alternative"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDlg({ kind: "message", label: `${r.name} · ${name}, ${week.label}`, link: { kind: "exercise", dayId: s.id, assignmentId: r.id } })}>
                                  <ChatIcon /> Message {firstName} about it
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => patch(s.id, (q) => ({ ...q, removed: [...q.removed, r.id] }))}>
                                  <TrashIcon /> Remove from session
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </span>
                        </div>
                        {/* What they did instead, opened from the orange circle: the
                            exercise, when, and the sets logged on it. Those sets are
                            the swap's, so they stay out of this row's numbers. */}
                        {r.swapInfo && (
                          <div className={`rd-swaprow${openSwaps.includes(r.id) ? " open" : ""}`} aria-hidden={!openSwaps.includes(r.id)}>
                            <div className="rd-swaprow-clip">
                              {/* On the row's own columns: the words under the name, the
                                  sets in the "did" column, in the swap's orange. */}
                              <div className="rd-swaprow-body" style={colStyle}>
                                <span />
                                <span className="rd-swaprow-text" style={{ gridColumn: `2 / ${4 + exWidths.length}` }}>
                                  <span className="rd-swapdot static" aria-hidden="true">
                                    <SwapIcon />
                                  </span>
                                  <b>
                                    {firstName} did {r.swapInfo.name} instead
                                  </b>
                                </span>
                                <span className="rd-did rd-swaprow-sets">
                                  {r.swapInfo.sets.length === 0 ? (
                                    <em>No sets logged on it yet</em>
                                  ) : (
                                    r.swapInfo.sets.map((l) => (
                                      <span key={l.set} className="rd-set swap" title={l.gym ?? undefined}>
                                        {kgOf(l.kg, lbs)}×{l.reps ?? "—"}
                                        {l.rpe != null && <small>@{l.rpe}</small>}
                                      </span>
                                    ))
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        </>
                        )}
                      </SortableItem>
                    );
                  })}
                  </SortableList>

                  {/* Exercises added but not applied yet: under the others, where Apply puts them, above the cardio. */}
                  {p.added.filter((r): r is Added & AddedExercise => r.kind === "exercise").map((r) => {
                    // A new row is edited in place before Apply, like any other.
                    const editAdded = (f: Partial<AddedExercise>) =>
                      patch(s.id, (q) => ({ ...q, added: q.added.map((x) => (x.key === r.key && x.kind === "exercise" ? { ...x, ...f } : x)) }));
                    return (
                    <div key={r.key} className="rd-row new">
                      <div className="rd-row-main" style={colStyle}>
                        <span />
                        <span className="rd-ex">
                          <span className="rd-ex-name">{r.name}</span>
                          <small>New · not applied yet</small>
                        </span>
                        {cols.sets && <Cell value={String(r.sets)} onChange={(v) => editAdded({ sets: v })} label="Sets" width="sm" />}
                        {cols.reps && <Cell value={r.reps} onChange={(v) => editAdded({ reps: v })} label="Reps" />}
                        {cols.weight && <WeightCell key={unit} kg={r.kg} lbs={lbs} onChange={(v) => editAdded({ kg: v })} />}
                        {cols.rpe && <Cell value={r.rpe ?? ""} onChange={(v) => editAdded({ rpe: v })} label="RPE" width="sm" />}
                        {cols.tempo && <Cell value={r.tempo ?? ""} onChange={(v) => editAdded({ tempo: v })} label="Tempo" />}
                        {cols.rest && <Cell value={r.rest ?? ""} onChange={(v) => editAdded({ rest: v })} label="Rest" />}
                        <span />
                        <span className="rd-did">
                          <em />
                        </span>
                        <span />
                        <span />
                        <span className="rd-row-more">
                          <button type="button" className="rd-btn ghost sm" onClick={() => patch(s.id, (q) => ({ ...q, added: q.added.filter((x) => x.key !== r.key) }))} aria-label={`Don't add ${r.name}`} title="Don't add it">
                            <TrashIcon />
                          </button>
                        </span>
                      </div>
                    </div>
                    );
                  })}

                  {(s.cardio.some((c) => !p.cardioRemoved.includes(c.id)) || p.added.some((r) => r.kind === "cardio")) && (() => {
                    const live = s.cardio.filter((c) => !p.cardioRemoved.includes(c.id));
                    const fresh = p.added.filter((r): r is Added & AddedCardio => r.kind === "cardio");
                    const show: CardioShow = {
                      time: ccols.time && (live.some((c) => c.time.trim()) || fresh.some((r) => r.time.trim())),
                      pace: ccols.pace && (live.some((c) => c.pace.trim()) || fresh.some((r) => r.pace.trim())),
                      incline: ccols.incline && (live.some((c) => c.incline.trim()) || fresh.some((r) => r.incline.trim())),
                      distance: ccols.distance && (live.some((c) => c.distance.trim()) || fresh.some((r) => r.distance.trim())),
                      note: live.some((c) => c.notes.trim()) || fresh.some((r) => r.note.trim()),
                    };
                    const cs = cardioStyleFor(show);
                    return (
                    <div className="rd-cardio">
                      <div className="rd-cols" aria-hidden="true" style={cs.grid}>
                        <span />
                        <span>Cardio</span>
                        <span className="rd-cband" style={cs.band}>
                          {show.time && <span>Time</span>}
                          {show.pace && <span>Pace</span>}
                          {show.incline && <span>Incline</span>}
                          {show.distance && <span>Distance</span>}
                          {show.note && <span>Note</span>}
                        </span>
                        <span />
                        <span>{firstName} did</span>
                        <span />
                        <span />
                        <span />
                      </div>
                      {s.cardio
                        .filter((c0) => !p.cardioRemoved.includes(c0.id))
                        .map((c0) => ({ ...c0, ...(p.cardioEdits[c0.id] ?? {}) }))
                        .map((c) => (
                          <div key={c.id} className={`rd-row cardio${p.cardioEdits[c.id] ? " edited" : ""}`}>
                            <div className="rd-row-main" style={cs.grid}>
                              <span />
                              <span className="rd-ex">
                                <span className="rd-ex-name">
                                  <button type="button" className="rd-ex-btn" onClick={() => setDlg({ kind: "editCardio", sessionId: s.id, cardioId: c.id })} title="Edit this cardio">
                                    {c.name}
                                  </button>
                                </span>
                              </span>
                              <span className="rd-cband" style={cs.band}>
                                {show.time && <span className="rd-num">{unitOf(c.time, " min")}</span>}
                                {show.pace && <span className="rd-num">{unitOf(c.pace, " km/h")}</span>}
                                {show.incline && <span className="rd-num">{unitOf(c.incline, "%")}</span>}
                                {show.distance && <span className="rd-num">{unitOf(c.distance, " km")}</span>}
                                {show.note && <span className="rd-note-cell">{c.notes || <em>—</em>}</span>}
                              </span>
                              <span />
                              <span className="rd-did">{c.done ? <span className="rd-set up">Done</span> : <em>{week.state === "ahead" ? "" : "Not done"}</em>}</span>
                              <span />
                              <span />
                              <span className="rd-row-more">
                                <button type="button" className="rd-btn ghost sm" onClick={() => patch(s.id, (q) => ({ ...q, cardioRemoved: [...q.cardioRemoved, c.id] }))} aria-label={`Remove ${c.name}`} title="Remove from session">
                                  <TrashIcon />
                                </button>
                              </span>
                            </div>
                          </div>
                        ))}
                      {p.added
                        // The one still being typed shows in its form below, not twice.
                        .filter((r): r is Added & AddedCardio => r.kind === "cardio" && !(adding?.kind === "cardio" && adding.key === r.key))
                        .map((r) => (
                          <div key={r.key} className="rd-row cardio new">
                            <div className="rd-row-main" style={cs.grid}>
                              <span />
                              <span className="rd-ex">
                                <span className="rd-ex-name">{r.name}</span>
                                <small>New · not applied yet</small>
                              </span>
                              <span className="rd-cband" style={cs.band}>
                                {show.time && <span className="rd-num">{r.time || "—"}</span>}
                                {show.pace && <span className="rd-num">{r.pace || "—"}</span>}
                                {show.incline && <span className="rd-num">{r.incline || "—"}</span>}
                                {show.distance && <span className="rd-num">{r.distance || "—"}</span>}
                                {show.note && <span className="rd-note-cell">{r.note || <em>—</em>}</span>}
                              </span>
                              <span />
                              <span className="rd-did">
                                <em />
                              </span>
                              <span />
                              <span />
                              <span className="rd-row-more">
                                <button type="button" className="rd-btn ghost sm" onClick={() => patch(s.id, (q) => ({ ...q, added: q.added.filter((x) => x.key !== r.key) }))} aria-label={`Don't add ${r.name}`} title="Don't add it">
                                  <TrashIcon />
                                </button>
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                    );
                  })()}

                  {adding?.session === s.id ? (
                    adding.kind === "exercise" ? (
                      <AddExerciseRow library={library} onPick={(nm, exerciseId) => patch(s.id, (q) => ({ ...q, added: [...q.added, { key: Date.now() + Math.random(), kind: "exercise", exerciseId, name: nm, sets: "", reps: "", kg: null }] }))} onClose={() => setAdding(null)} />
                    ) : (
                      <AddCardioRow
                        onChange={(c) => {
                          // The first keystroke queues it (the bar appears); every one after updates it; cleared or dropped, it comes off.
                          const key = adding.key ?? Date.now() + Math.random();
                          if (adding.key == null && c) setAdding({ ...adding, key });
                          patch(s.id, (q) => {
                            const rest = q.added.filter((x) => x.key !== key);
                            return { ...q, added: c ? (q.added.some((x) => x.key === key) ? q.added.map((x) => (x.key === key ? { key, kind: "cardio", ...c } : x)) : [...rest, { key, kind: "cardio", ...c }]) : rest };
                          });
                        }}
                        onClose={() => setAdding(null)}
                      />
                    )
                  ) : (
                    <div className="rd-add">
                      <button type="button" className="rd-btn ghost wide" onClick={() => setAdding({ session: s.id, kind: "exercise" })}>
                        <PlusIcon /> Exercise
                      </button>
                      <button type="button" className="rd-btn ghost wide" onClick={() => setAdding({ session: s.id, kind: "cardio" })}>
                        <PlusIcon /> Cardio
                      </button>
                    </div>
                  )}

                  {pendingCount(p) > 0 && (
                    <PendingBar
                      p={p}
                      laterLabel={laterLabel}
                      onAlso={(v) => patch(s.id, (q) => ({ ...q, alsoRemaining: v }))}
                      onDiscard={() => setPending((prev) => ({ ...prev, [s.id]: emptyPending() }))}
                      onApply={() => {
                        const payload = payloadOf(s, p);
                        const said = `${name}: ${pendingCount(p)} ${pendingCount(p) === 1 ? "change" : "changes"} applied${p.alsoRemaining && laterLabel ? `, and to ${laterLabel}` : ""}`;
                        applyPending(s.id);
                        act(() => applyDayChangesAction(payload), said);
                      }}
                    />
                  )}
                </div>
              )}
              </>
              )}
            </SortableItem>
          );
        })}
        </SortableList>
        {sessions.length < MAX_SESSIONS ? (
          <button
            type="button"
            className="rd-session add"
            onClick={() => {
              const n = sessions.length + 1;
              act(() => addSessionAction(fd({ clientId, week: weekNo(viewIdx) })), `Session ${n} added`);
            }}
          >
            + Add session
          </button>
        ) : (
          <p className="rd-full">{MAX_SESSIONS} sessions is the most a week can hold.</p>
        )}
      </div>

      {/* ---- Dialogs. One open at a time. */}
      <Dialog open={dlg != null} onOpenChange={(o) => !o && close()}>
        {dlg?.kind === "progress" && rowById(dlg.rowId) && <ProgressDialog row={rowById(dlg.rowId)!} lbs={lbs} unit={unit} multiGym={multiGym} />}

        {dlg?.kind === "editExercise" && rowById(dlg.rowId) && (
          <EditExerciseDialog
            row={rowById(dlg.rowId)!}
            current={pend(dlg.sessionId).edits[dlg.rowId] ?? {}}
            library={library}
            onSave={(v) => {
              const { sessionId, rowId } = dlg;
              patch(sessionId, (q) => ({ ...q, edits: { ...q.edits, [rowId]: { ...(q.edits[rowId] ?? {}), ...v } } }));
              close();
            }}
          />
        )}

        {dlg?.kind === "editCardio" && sessionById(dlg.sessionId)?.cardio.find((c) => c.id === dlg.cardioId) && (
          <EditCardioDialog
            cardio={{ ...sessionById(dlg.sessionId)!.cardio.find((c) => c.id === dlg.cardioId)!, ...(pend(dlg.sessionId).cardioEdits[dlg.cardioId] ?? {}) }}
            onSave={(v) => {
              const { sessionId, cardioId } = dlg;
              patch(sessionId, (q) => ({ ...q, cardioEdits: { ...q.cardioEdits, [cardioId]: { ...(q.cardioEdits[cardioId] ?? {}), ...v } } }));
              close();
            }}
          />
        )}

        {dlg?.kind === "alternatives" && rowById(dlg.rowId) && (
          <AlternativesDialog
            row={rowById(dlg.rowId)!}
            firstName={firstName}
            library={library}
            onSave={(list) => {
              const row = rowById(dlg.rowId)!;
              close();
              act(
                () => setExerciseAlternativesAction(row.id, list.map((x) => ({ exerciseId: x.exerciseId, note: x.note }))),
                list.length ? `${list.length} alternative${list.length === 1 ? "" : "s"} for ${row.name}` : `Alternatives taken off ${row.name}`
              );
            }}
          />
        )}

        {dlg?.kind === "demo" && rowById(dlg.rowId) && (
          <DemoDialog
            row={rowById(dlg.rowId)!}
            demo={demos[dlg.rowId] === undefined ? rowById(dlg.rowId)!.demo : demos[dlg.rowId]}
            onSave={(v) => {
              const row = rowById(dlg.rowId)!;
              close();
              if (v.url) {
                setDemos((d) => ({ ...d, [row.id]: { url: v.url!, source: "library" } }));
                act(() => setExerciseDemoLinkAction(fd({ exerciseId: row.exerciseId, demoUrl: v.url })), `Demo on ${row.name} · every client's sheet with it`);
              } else if (v.file) {
                const f = new FormData();
                f.set("exerciseId", String(row.exerciseId));
                f.set("file", v.file);
                act(() => uploadExerciseVideoAction(f), `Demo on ${row.name} · every client's sheet with it`);
              }
            }}
            onRemove={() => {
              const row = rowById(dlg.rowId)!;
              close();
              setDemos((d) => ({ ...d, [row.id]: null }));
              act(() => clearExerciseDemoAction(fd({ exerciseId: row.exerciseId })), `Demo taken off ${row.name}`);
            }}
          />
        )}

        {dlg?.kind === "video" && rowById(dlg.rowId) && (
          <VideoDialog
            row={rowById(dlg.rowId)!}
            video={videos[dlg.rowId] ?? null}
            firstName={firstName}
            where={`${sessions.find((s) => s.rows.some((r) => r.id === dlg.rowId))?.name ?? "Session"}, ${week.label}`}
            onAsk={(note) => {
              const rowId = dlg.rowId;
              close();
              act(() => requestExerciseVideoAction(rowId, note), `Video asked for. ${firstName} sees it on the exercise.`);
            }}
            onCancel={() => {
              const v = videos[dlg.rowId];
              close();
              if (v) act(() => removeVideoRequestAction(v.requestId), "Request withdrawn");
            }}
            onReply={(reply) => {
              const v = videos[dlg.rowId];
              close();
              if (v) act(() => sendVideoReplyAction(v.requestId, reply), `Reply sent. ${firstName} gets a notification.`);
            }}
          />
        )}

        {dlg?.kind === "exerciseChat" && rowById(dlg.rowId) && (
          <ExerciseChatDialog
            row={rowById(dlg.rowId)!}
            firstName={firstName}
            onSend={(text) => {
              const f = fd({ clientId, text });
              f.set("link", JSON.stringify({ kind: "exercise", dayId: dlg.sessionId, assignmentId: dlg.rowId }));
              act(() => sendChatMessageAction(f));
            }}
          />
        )}

        {dlg?.kind === "message" && (
          <MessageDialog
            firstName={firstName}
            label={dlg.label}
            onSend={(text) => {
              const link = dlg.link;
              close();
              const f = fd({ clientId, text });
              f.set("link", JSON.stringify(link));
              act(() => sendChatMessageAction(f), `Message sent. It's on ${firstName}'s Home, linked to this.`);
            }}
          />
        )}

        {dlg?.kind === "copySession" && sessionById(dlg.sessionId) && (
          <CopySessionDialog
            source={sessionById(dlg.sessionId)!}
            others={sessions.filter((x) => x.id !== dlg.sessionId)}
            canAdd={sessions.length < MAX_SESSIONS}
            nextNumber={sessions.length + 1}
            laterLabel={laterLabel}
            onCopy={(to, also) => {
              const src = sessionById(dlg.sessionId)!;
              const n = sessions.length + 1;
              const target = to === "new" ? null : sessionById(to);
              close();
              act(() => copyProgramDayAction(fd({ fromDayId: src.id, toDayId: to === "new" ? "new" : to, applyToRemainingWeeks: also ? "1" : null })), to === "new" ? `Added as Session ${n}${also && laterLabel ? `, and in ${laterLabel}` : ""}` : `Replaced ${target?.name ?? "session"}${also && laterLabel ? `, and in ${laterLabel}` : ""}`);
            }}
          />
        )}

        {dlg?.kind === "copyWeek" && (
          <ConfirmDialog
            title={`Copy Week ${viewIdx - 1} here`}
            description={`Replaces ${week.label}'s sessions with Week ${viewIdx - 1}'s: its sessions, exercises and cardio. Nothing the client logged is touched.`}
            confirm="Copy week"
            tick={laterLabel ? `Also copy it to ${laterLabel}` : null}
            onConfirm={(also) => {
              const from = weekNo(viewIdx - 1);
              const targets = also ? weeks.filter((w) => w.index >= viewIdx).map((w) => weekNo(w.index)) : [weekNo(viewIdx)];
              close();
              act(async () => {
                for (const to of targets) await copyProgramWeekAction(fd({ clientId, fromWeek: from, toWeek: to }));
              }, `Week ${viewIdx - 1} copied to ${week.label}${also ? ` and ${laterLabel}` : ""}`);
            }}
          />
        )}

        {dlg?.kind === "deleteSession" && sessionById(dlg.sessionId) && (
          <ConfirmDialog
            title={`Delete ${sessionById(dlg.sessionId)!.name}`}
            description="The session goes, with its exercises, cardio and anything the client logged on them. The sessions after it move up."
            confirm="Delete"
            danger
            onConfirm={() => {
              const gone = sessionById(dlg.sessionId)!;
              close();
              act(() => removeSessionAction(fd({ programDayId: gone.id })), `${gone.name} deleted`);
            }}
          />
        )}

        {dlg?.kind === "removeWeek" && (
          <ConfirmDialog
            title={`Remove ${week.label}`}
            description={sessions.length ? `Its ${sessions.length} ${sessions.length === 1 ? "session goes" : "sessions go"} with it. The programme gets a week shorter.` : "An empty week at the end of the programme. The programme gets a week shorter."}
            confirm="Remove week"
            danger
            onConfirm={() => {
              const idx = viewIdx;
              const label = week.label;
              close();
              startTransition(async () => {
                await removeProgramWeekAction(fd({ clientId, programId: program.id, week: idx }));
                savedToast(`${label} removed`);
                router.push(`/admin/redesign/training?client=${clientId}&program=${program.id}&week=${Math.max(1, idx - 1)}`);
              });
            }}
          />
        )}

        {dlg?.kind === "addWeek" && (
          <AddWeekDialog
            next={weeks.length + 1}
            date={weekDate(weeks.length + 1)}
            source={week}
            sessionCount={sessions.length}
            onAdd={(copy) => {
              const n = weeks.length + 1;
              const label = week.label;
              const from = viewIdx;
              close();
              startTransition(async () => {
                await addProgramWeekAction(fd({ clientId, programId: program.id, copyFrom: copy ? from : null }));
                savedToast(`Week ${n} added${copy ? `, a copy of ${label}` : ""}`);
                router.push(`/admin/redesign/training?client=${clientId}&program=${program.id}&week=${n}`);
              });
            }}
          />
        )}

        {dlg?.kind === "deploy" && program.status === "draft" && !startHasCome && (
          <PhaseDatesDialog
            title="Schedule it"
            name={program.name}
            weeks={weeks.length}
            start={program.startDate}
            end={program.endDate}
            firstName={firstName}
            what="the programme"
            confirm="Schedule it"
            onConfirm={(v) => {
              close();
              act(async () => {
                if (v.name && v.name !== program.name) await renameProgramAction(fd({ programId: program.id, name: v.name }));
                if (program.phaseId) await updateClientPhaseAction(fd({ id: program.phaseId, track: "training", name: v.name || program.name, start: v.start, end: v.end }));
                await scheduleProgramDeployAction(fd({ programId: program.id, date: v.start, time: "09:00" }));
              }, `${v.name || program.name} scheduled: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
            }}
          />
        )}
        {dlg?.kind === "deploy" && !(program.status === "draft" && !startHasCome) && (
          <ConfirmDialog
            title={program.status === "scheduled" ? "Make it live now" : startHasCome ? "Make it live" : "Schedule it"}
            description={
              program.status === "scheduled"
                ? `${program.name} goes live this week instead of ${program.startDate ? fmtDate(program.startDate) : "its start"}. ${firstName} sees it on their Training tab straight away.`
                : startHasCome
                  ? `${program.name} goes live this week. ${firstName} sees it on their Training tab straight away and gets a notification.`
                  : `${program.name} goes out on ${program.startDate ? fmtDate(program.startDate) : "its start date"} by itself. Until then only you see it.`
            }
            confirm={program.status === "scheduled" ? "Make it live now" : startHasCome ? "Make it live" : "Schedule it"}
            onConfirm={() => {
              const now = program.status === "scheduled" || startHasCome;
              close();
              act(() => (now ? deployProgramAction(fd({ programId: program.id })) : scheduleProgramDeployAction(fd({ programId: program.id, date: program.startDate, time: "09:00" }))), now ? `${program.name} is live` : `${program.name} scheduled`);
            }}
          />
        )}

        {dlg?.kind === "backToDraft" && (
          <ConfirmDialog
            title="Back to draft"
            description={`${program.name} stops being scheduled. ${firstName} won't see it until it is scheduled again.`}
            confirm="Back to draft"
            onConfirm={() => {
              close();
              act(() => cancelProgramScheduleAction(fd({ programId: program.id })), `${program.name} is a draft again`);
            }}
          />
        )}

        {dlg?.kind === "dates" && (
          <PhaseDatesDialog
            title="Dates"
            name={program.name}
            weeks={weeks.length}
            start={program.startDate}
            end={program.endDate}
            firstName={firstName}
            what="the programme"
            confirm="Save dates"
            onConfirm={(v) => {
              close();
              act(async () => {
                if (v.name && v.name !== program.name) await renameProgramAction(fd({ programId: program.id, name: v.name }));
                if (program.phaseId) await updateClientPhaseAction(fd({ id: program.phaseId, track: "training", name: v.name || program.name, start: v.start, end: v.end }));
              }, `${v.name || program.name}: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
            }}
          />
        )}

        {dlg?.kind === "gyms" && (
          <GymsDialog
            firstName={firstName}
            gyms={gyms}
            onAdd={(nm) => act(() => addGymAction(clientId, nm), `${nm} added`)}
            onRemove={(id) => {
              const g = gyms.find((x) => x.id === id);
              act(() => removeGymAction(id), `${g?.name ?? "Gym"} removed`);
            }}
            onHome={(id) => act(() => setHomeGymAction(id), "Home gym changed")}
          />
        )}

        {dlg?.kind === "newProgram" && (
          <NewProgramDialog
            onCreate={(v) => {
              close();
              startTransition(async () => {
                const id = await createProgramWithAction(clientId, v.name, v.weeks, v.start || null);
                savedToast(`${v.name || "New programme"} · ${v.weeks} weeks, a draft`);
                if (id) router.push(`/admin/redesign/training?client=${clientId}&program=${id}&week=1`);
                else router.refresh();
              });
            }}
          />
        )}

        {dlg?.kind === "note" && program.note && (
          <NoteDialog
            firstName={firstName}
            note={program.note}
            onSeen={() => {
              setNoteSeen(true);
              close();
            }}
          />
        )}
      </Dialog>

    </div>
  );
}

// ---- Small parts -------------------------------------------------------------

export const stateLabel = (s: string) => (s === "live" ? "Live" : s === "past" ? "Past" : s === "scheduled" ? "Scheduled" : "Draft");
export const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** The session's name, typed into in place; Enter or blur keeps it, Esc puts it back. */
function SessionName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing)
    return (
      <button
        type="button"
        className="rd-session-name"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        title="Rename"
      >
        {value}
      </button>
    );
  return (
    <input
      className="rd-session-name-box"
      value={draft}
      autoFocus
      maxLength={40}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() && draft.trim() !== value) onChange(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      aria-label="Session name"
    />
  );
}

/** One editable cell: reads as a figure, types like a box. */
function Cell({ value, onChange, label, placeholder, width }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; width?: "sm" }) {
  return (
    <span className="rd-cell">
      <input className={`rd-cell-box${width === "sm" ? " sm" : ""}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "—"} aria-label={label} />
    </span>
  );
}

/** A weight cell: kept in kg, typed and shown in the unit picked. Keyed by
 *  unit where it is used, so a flip re-reads the figure. */
function WeightCell({ kg, lbs, label, onChange }: { kg: number | null; lbs: boolean; label?: string; onChange: (kg: number | null) => void }) {
  const [text, setText] = useState(kg == null ? "" : String(half(lbs ? kg * LB : kg)));
  return (
    <span className="rd-cell">
      {label && <small>{label}</small>}
      <input
        className="rd-cell-box"
        value={text}
        placeholder={lbs ? "lbs" : "kg"}
        aria-label={label ? `Weight at ${label}` : "Weight"}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value.replace(",", "."));
          onChange(Number.isFinite(n) ? Math.round((lbs ? n / LB : n) * 10000) / 10000 : null);
        }}
      />
    </span>
  );
}

/** The session's own pending bar, at its foot: what changed here, in counts. */
function PendingBar({ p, laterLabel, onAlso, onDiscard, onApply }: { p: Pending; laterLabel: string; onAlso: (v: boolean) => void; onDiscard: () => void; onApply: () => void }) {
  const n = pendingCount(p);
  const ex = p.added.filter((r) => r.kind === "exercise").length;
  const ca = p.added.filter((r) => r.kind === "cardio").length;
  const edited = Object.keys(p.edits).length + Object.keys(p.cardioEdits).length;
  const parts = [
    ex ? `${ex} ${ex === 1 ? "exercise" : "exercises"} added` : null,
    ca ? `${ca} cardio added` : null,
    p.removed.length + p.cardioRemoved.length ? `${p.removed.length + p.cardioRemoved.length} removed` : null,
    edited ? `${edited} ${edited === 1 ? "row" : "rows"} changed` : null,
    p.order ? "order changed" : null,
    p.renamed != null ? "renamed" : null,
  ].filter(Boolean);
  return (
    <div className="rd-pending" role="region" aria-label="Unsaved changes to this session">
      <span className="rd-pending-count">
        {n} {n === 1 ? "change" : "changes"}
      </span>
      <span className="rd-pending-text">{parts.join(" · ")}</span>
      {laterLabel && (
        <label className="rd-pending-also">
          <input type="checkbox" checked={p.alsoRemaining} onChange={(e) => onAlso(e.target.checked)} /> Apply to the rest of the programme
        </label>
      )}
      <button type="button" className="rd-pending-ghost" onClick={onDiscard}>
        Discard
      </button>
      <button type="button" className="rd-pending-apply" onClick={onApply}>
        Apply
      </button>
      <span className="rd-pending-note">Draft page: Apply keeps it on this page only, until a reload.</span>
    </div>
  );
}

// Shared by the two add rows: the click that opened the row must not also
// close it, so the outside-click listener goes on after that click, once.
export function useClickAway(wrap: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  // On click, not mousedown: closing on the press collapsed the row before
  // the release, so a button further down (Apply, say) slid out from under
  // the pointer and the click was lost. Now the button gets its click first.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      // A menu the row opened (a Picker, a dropdown) floats outside the row
      // in a layer of its own; a click in it is not a click away.
      if (t && typeof t.closest === "function" && t.closest("[data-slot='dropdown-menu-content'], [data-radix-popper-content-wrapper], .pb-menu")) return;
      // A button the click itself took off the page (a group opening, the
      // list turning into the create form) is no longer inside anything, so
      // it looked like a click away and shut the row: it was a click in it.
      if (t && !t.isConnected) return;
      if (!wrap.current?.contains(e.target as Node)) close.current();
    };
    const t = setTimeout(() => document.addEventListener("click", onClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", onClick);
    };
  }, [wrap]);
}

/** The add-exercise row: one search bar. Type for matches; the chevron opens
 *  the groups, a group its exercises. A pick becomes a row and the bar stays
 *  for the next one. Esc, the ×, or a click away closes it. */
function AddExerciseRow({ library, onPick, onClose }: { library: Library; onPick: (name: string, exerciseId: number) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [creating, setCreating] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useClickAway(wrap, onClose);
  useEffect(() => {
    box.current?.focus();
  }, []);
  const needle = q.trim().toLowerCase();
  // What the list shows: matches while typing; else the picked group's
  // exercises; else, with the chevron open, the groups.
  const matches = needle ? library.flatMap((g) => g.exercises.filter((e) => e.name.toLowerCase().includes(needle)).map((e) => ({ id: e.id, name: e.name, group: g.label }))).slice(0, 8) : [];
  const inGroup = !needle && group ? (library.find((g) => g.slug === group)?.exercises ?? []).map((e) => ({ id: e.id, name: e.name, group: "" })) : [];
  const list = needle ? matches : inGroup;
  const showGroups = !needle && browse && !group;
  const idOf = (name: string) => library.flatMap((g) => g.exercises).find((e) => e.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  const pick = (name: string, id: number | null = idOf(name)) => {
    if (id == null) {
      setCreating(true);
      return;
    }
    onPick(name, id);
    setQ("");
    setCursor(0);
    setGroup(null);
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
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
            setGroup(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (group) setGroup(null);
              else if (browse) setBrowse(false);
              else onClose();
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!needle && !browse) setBrowse(true);
              setCursor((c) => Math.min(c + 1, Math.max(0, list.length - 1)));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            }
            if (e.key === "Enter") {
              if (list[cursor]) pick(list[cursor].name);
              else if (needle) pick(q.trim());
            }
          }}
          placeholder={group ? `${library.find((g) => g.slug === group)?.label ?? ""} · type to narrow` : "Search exercises"}
          aria-label="Search exercises"
        />
        <button
          type="button"
          className={`rd-addrow-chev${browse ? " open" : ""}`}
          onClick={() => {
            setBrowse((o) => !o);
            setGroup(null);
            box.current?.focus();
          }}
          aria-label={browse ? "Hide groups" : "Browse by group"}
          aria-expanded={browse}
        >
          <ChevronDownIcon />
        </button>
        <button type="button" className="rd-addrow-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {creating && (
        <CreateExercise
          library={library}
          initial={q.trim()}
          onCreate={async (name, group) => {
            setCreating(false);
            const f = new FormData();
            f.set("name", name);
            f.set("muscleGroup", group);
            const made = await addExerciseToLibraryAction(f);
            if (made) pick(made.name, made.id);
          }}
          onCancel={() => {
            setCreating(false);
            box.current?.focus();
          }}
        />
      )}
      {!creating && showGroups && (
        <div className="rd-addrow-list" role="listbox" aria-label="Groups">
          {library.map((g) => (
            <button key={g.slug} type="button" role="option" aria-selected={false} className="rd-addrow-item" onClick={() => setGroup(g.slug)}>
              {g.label}
              <small>{g.exercises.length}</small>
            </button>
          ))}
          <button type="button" className="rd-addrow-item create" onClick={() => setCreating(true)}>
            <PlusIcon /> Create your own exercise
          </button>
        </div>
      )}
      {!creating && group && !needle && (
        <div className="rd-addrow-list" role="listbox" aria-label={library.find((g) => g.slug === group)?.label}>
          <button type="button" className="rd-addrow-back" onClick={() => setGroup(null)}>
            ‹ All groups
          </button>
          {list.map((m, i) => (
            <button key={m.id} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}`} onMouseEnter={() => setCursor(i)} onClick={() => pick(m.name)}>
              {m.name}
            </button>
          ))}
        </div>
      )}
      {!creating && needle && (
        <div className="rd-addrow-list" role="listbox">
          {list.map((m, i) => (
            <button key={m.id} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}`} onMouseEnter={() => setCursor(i)} onClick={() => pick(m.name)}>
              {m.name}
              {m.group && <small>{m.group}</small>}
            </button>
          ))}
          <button type="button" className={`rd-addrow-item create${list.length === 0 ? " on" : ""}`} onClick={() => setCreating(true)}>
            <PlusIcon /> Create &ldquo;{q.trim()}&rdquo; as your own exercise
          </button>
        </div>
      )}
    </div>
  );
}

/** Creating an exercise of your own: a name and its group. It goes to the
 *  library (yours, not every coach's) and onto the session. */
function CreateExercise({ library, initial, onCreate, onCancel }: { library: Library; initial: string; onCreate: (name: string, group: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial);
  const [group, setGroup] = useState(library[0]?.slug ?? "other");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  const ok = name.trim().length > 0;
  return (
    <div className="rd-create" onKeyDown={(e) => (e.key === "Escape" ? onCancel() : e.key === "Enter" && ok ? onCreate(name.trim(), group) : null)}>
      <span className="rd-eyebrow">Create your own exercise</span>
      <div className="rd-create-row">
        <input ref={first} className="rd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Exercise name" maxLength={60} />
        <Picker value={group} onChange={setGroup} label="Muscle group" options={library.map((g) => ({ value: g.slug, label: g.label, hint: `${g.exercises.length}` }))} />
        <button type="button" className="rd-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="rd-btn primary" disabled={!ok} onClick={() => onCreate(name.trim(), group)}>
          Add to library and session
        </button>
      </div>
      <p className="rd-addrow-hint">Lands in your library under {library.find((g) => g.slug === group)?.label ?? "Other"}, so it is there next time.</p>
    </div>
  );
}

/** Editing an exercise row: replace the exercise (or create your own), and its note.
 *  "Replace", not "swap": a swap is the client doing something else for a session. */
function EditExerciseDialog({ row, current, library, onSave }: { row: DraftRow; current: Edits; library: Library; onSave: (v: { name?: string; note?: string }) => void }) {
  const [name, setName] = useState(current.name ?? row.name);
  const [note, setNote] = useState(current.note ?? row.note ?? "");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const needle = q.trim().toLowerCase();
  const matches = needle ? library.flatMap((g) => g.exercises.filter((e) => e.name.toLowerCase().includes(needle)).map((e) => ({ id: e.id, name: e.name, group: g.label }))).slice(0, 6) : [];
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>Edit {row.name}</DialogTitle>
        <DialogDescription>Replace the exercise in the programme, or change the note {row.logged.length ? "· what the client logged stays" : ""}.</DialogDescription>
      </DialogHeader>
      <div className="rd-field">
        <span>Exercise</span>
        <span className="rd-about">{name}</span>
      </div>
      {creating ? (
        <CreateExercise
          library={library}
          initial={q.trim()}
          onCreate={(n) => {
            setName(n);
            setQ("");
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <div className="rd-field">
          <span>Replace with</span>
          <input className="rd-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library" />
          {needle && (
            <div className="rd-addrow-list">
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="rd-addrow-item"
                  onClick={() => {
                    setName(m.name);
                    setQ("");
                  }}
                >
                  {m.name}
                  <small>{m.group}</small>
                </button>
              ))}
              <button type="button" className="rd-addrow-item create" onClick={() => setCreating(true)}>
                <PlusIcon /> Create &ldquo;{q.trim()}&rdquo; as your own exercise
              </button>
            </div>
          )}
        </div>
      )}
      <label className="rd-field">
        <span>Note for the client</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What to watch for" />
      </label>
      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" onClick={() => onSave({ ...(name !== row.name ? { name } : {}), ...(note !== (row.note ?? "") ? { note } : {}) })}>
          Save
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

/** What the client can do instead when the machine is taken: exercises from
 *  the library (the add-exercise search), each with an optional note. Saved
 *  on this session for the rest of the programme. */
function AlternativesDialog({ row, firstName, library, onSave }: { row: DraftRow; firstName: string; library: Library; onSave: (list: DraftRow["alternatives"]) => void }) {
  const [list, setList] = useState(row.alternatives);
  const [adding, setAdding] = useState(row.alternatives.length === 0);
  const edit = (exerciseId: number, note: string) => setList((l) => l.map((x) => (x.exerciseId === exerciseId ? { ...x, note } : x)));
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>Alternatives for {row.name}</DialogTitle>
        <DialogDescription>What {firstName} can do instead when the machine is taken. They pick one from the swap in their workout.</DialogDescription>
      </DialogHeader>
      {list.length > 0 && (
        <ul className="rd-alt-list">
          {list.map((x) => (
            <li key={x.exerciseId} className="rd-alt-row">
              <span className="rd-alt-name">{x.name}</span>
              <input className="rd-input" value={x.note} onChange={(e) => edit(x.exerciseId, e.target.value)} placeholder="Note · optional, e.g. same reps, a little lighter" maxLength={200} />
              <button type="button" className="rd-btn ghost sm" onClick={() => setList((l) => l.filter((y) => y.exerciseId !== x.exerciseId))} aria-label={`Remove ${x.name}`}>
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <AddExerciseRow
          library={library}
          onPick={(name, exerciseId) => {
            if (exerciseId !== row.exerciseId && !list.some((x) => x.exerciseId === exerciseId)) setList((l) => [...l, { exerciseId, name, note: "" }]);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      ) : (
        list.length < 8 && (
          <button type="button" className="rd-btn rd-alt-add" onClick={() => setAdding(true)}>
            <PlusIcon /> Add alternative
          </button>
        )
      )}
      <p className="rd-addrow-hint">Saved on this session for the rest of the programme.</p>
      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" onClick={() => onSave(list)}>
          Save
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Editing a cardio row: the same fields it was added with. */
function EditCardioDialog({ cardio, onSave }: { cardio: DraftCardio; onSave: (v: CardioEdit) => void }) {
  const [c, setC] = useState({ name: cardio.name, time: cardio.time, pace: cardio.pace, incline: cardio.incline, distance: cardio.distance, notes: cardio.notes });
  const set = (k: keyof typeof c) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value });
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>Edit {cardio.name}</DialogTitle>
      </DialogHeader>
      <label className="rd-field">
        <span>Activity</span>
        <input value={c.name} onChange={set("name")} autoFocus />
      </label>
      <div className="rd-field-row">
        <label className="rd-field">
          <span>Time (min)</span>
          <input value={c.time} onChange={set("time")} placeholder="15" />
        </label>
        <label className="rd-field">
          <span>Pace (km/h)</span>
          <input value={c.pace} onChange={set("pace")} placeholder="6" />
        </label>
        <label className="rd-field">
          <span>Incline (%)</span>
          <input value={c.incline} onChange={set("incline")} placeholder="8" />
        </label>
        <label className="rd-field">
          <span>Distance (km)</span>
          <input value={c.distance} onChange={set("distance")} placeholder="3" />
        </label>
      </div>
      <label className="rd-field">
        <span>Note</span>
        <input value={c.notes} onChange={set("notes")} placeholder="Easy, cool-down" />
      </label>
      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!c.name.trim()} onClick={() => onSave({ ...c, name: c.name.trim() })}>
          Save
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Cardio: a short form. Enter, or clicking away, puts the row on the change bar; Esc or × drops it. */
// A cardio typed in place, no Add button: the first keystroke puts it on the
// session's bar (onChange), every keystroke after updates it there. Enter,
// clicking away or × closes the form and leaves it queued; Esc drops it.
function AddCardioRow({ onChange, onClose }: { onChange: (c: Omit<AddedCardio, "kind"> | null) => void; onClose: () => void }) {
  const blank = { name: "", time: "", pace: "", incline: "", distance: "", note: "" };
  const [c, setC] = useState(blank);
  const first = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // A bare number gets its unit; anything else is kept as typed.
  const withUnit = (v: string, u: string) => (/^\s*[\d.,]+\s*$/.test(v) ? `${v.trim()}${u}` : v.trim());
  useClickAway(wrap, onClose);
  useEffect(() => {
    first.current?.focus();
  }, []);
  const set = (k: keyof typeof c) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...c, [k]: e.target.value };
    setC(next);
    const any = Object.values(next).some((v) => v.trim());
    onChange(any ? { ...next, name: next.name.trim(), time: withUnit(next.time, " min"), pace: withUnit(next.pace, " km/h"), incline: withUnit(next.incline, "%"), distance: withUnit(next.distance, " km"), note: next.note.trim() } : null);
  };
  return (
    <div
      ref={wrap}
      className="rd-addrow"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onChange(null);
          onClose();
        } else if (e.key === "Enter") onClose();
      }}
    >
      <div className="rd-cardio-form">
        <label className="wide">
          <span>Activity</span>
          <input ref={first} value={c.name} onChange={set("name")} placeholder="Incline walk" />
        </label>
        <label>
          <span>Time (min)</span>
          <input value={c.time} onChange={set("time")} placeholder="15" inputMode="decimal" />
        </label>
        <label>
          <span>Pace (km/h)</span>
          <input value={c.pace} onChange={set("pace")} placeholder="6" inputMode="decimal" />
        </label>
        <label>
          <span>Incline (%)</span>
          <input value={c.incline} onChange={set("incline")} placeholder="8" inputMode="decimal" />
        </label>
        <label>
          <span>Distance (km)</span>
          <input value={c.distance} onChange={set("distance")} placeholder="3" inputMode="decimal" />
        </label>
        <label className="wide">
          <span>Note</span>
          <input value={c.note} onChange={set("note")} placeholder="Easy, cool-down" />
        </label>
        <button type="button" className="rd-addrow-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="rd-addrow-hint">It goes on the bar below as you type, until Apply · Enter closes · Esc drops it.</p>
    </div>
  );
}

// ---- Dialogs ------------------------------------------------------------------

function ProgressDialog({ row, lbs, unit, multiGym }: { row: DraftRow; lbs: boolean; unit: string; multiGym: boolean }) {
  // The breakdown behind the 7 / 30 day figures, read top to bottom: what is
  // asked, the verdict in three numbers, the curve, then week by week.
  const h = row.history;
  const logged = h.filter((w) => w.sets.length > 0 && w.best != null);
  const shown = (kg: number) => (lbs ? Math.round(kg * LB * 2) / 2 : Math.round(kg * 2) / 2);
  // Up to the week on screen: the verdict is about where the client is now.
  const cur = h.find((w) => w.current) ?? null;
  const upTo = logged.filter((w) => !cur || w.week <= cur.week);
  // The weeks in a row, most recent back, where the estimated one-rep max did
  // not go up (weight and reps together, so fewer reps at a bit more weight
  // is not progress).
  const est = (w: (typeof h)[number]) => w.e1rm ?? 0;
  const stall = (() => {
    let n = 0;
    for (let i = upTo.length - 1; i > 0; i--) {
      if (est(upTo[i]) > est(upTo[i - 1]) + 0.05) break;
      n++;
    }
    return n;
  })();
  const lastStep = upTo.length > 1 ? est(upTo[upTo.length - 1]) - est(upTo[upTo.length - 2]) : null;
  const verdict =
    upTo.length === 0
      ? { text: "Nothing logged yet", cls: "none" }
      : upTo.length === 1
      ? { text: "First week logged", cls: "none" }
      : lastStep != null && lastStep < -0.05
      ? { text: "Dropping", cls: "down" }
      : stall >= 2
      ? { text: `Stalled ${stall} weeks`, cls: "flat" }
      : stall === 1
      ? { text: "Flat last week", cls: "flat" }
      : { text: "Progressing", cls: "up" };
  // Against the coach's targets, a week at a time: each set on target when
  // its reps reach the bottom of the range at the target weight or heavier;
  // at the top when they reach the top of it. With no weight set, reps only.
  const range = (r: string): { lo: number; hi: number } | null => {
    const m = r.match(/(\d+)\s*(?:[-–to]+\s*(\d+))?/);
    if (!m) return null;
    const lo = Number(m[1]);
    const hi = m[2] ? Number(m[2]) : lo;
    return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
  };
  const onTarget = (w: (typeof h)[number]) => {
    const r = range(w.targetReps);
    if (!r || w.sets.length === 0) return null;
    const heavyEnough = (kg: number | null) => w.target == null || (kg != null && kg >= w.target - 0.01);
    const hit = w.sets.filter((st) => st.reps != null && st.reps >= r.lo && heavyEnough(st.kg)).length;
    const top = w.sets.filter((st) => st.reps != null && st.reps >= r.hi && heavyEnough(st.kg)).length;
    const n = w.sets.length;
    return top === n && r.hi > r.lo
      ? { text: "Top of range", cls: "top" }
      : hit === n
      ? { text: "On target", cls: "up" }
      : hit === 0
      ? { text: "Below target", cls: "down" }
      : { text: `${hit} of ${n} on target`, cls: "flat" };
  };
  const pct = (v: number | null) => (v == null ? "—" : v === 0 ? "0%" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`);
  const tone = (v: number | null) => (v == null ? "none" : v > 0 ? "up" : v < 0 ? "down" : "flat");

  // The last four weeks, up to the one on screen (fewer when the programme
  // is younger): the chart and the table both show just these.
  const lastWk = cur?.week ?? (h.length ? h[h.length - 1].week : 1);
  const firstWk = Math.max(h.length ? h[0].week : 1, lastWk - 3);
  const win = h.filter((w) => w.week >= firstWk && w.week <= lastWk);
  const winLogged = win.filter((w) => w.sets.length > 0 && w.best != null);
  // The curve: each week's best set, the target dashed across.
  // Taller than it is busy, so the line has room to rise and fall.
  const W = 480;
  const H = 150;
  const pad = { l: 34, r: 14, t: 24, b: 22 };
  const values = [...winLogged.map((w) => w.best!), ...win.map((w) => w.target).filter((t): t is number => t != null)];
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  // Room above the highest point and below the lowest: at least 2.5% of the
  // weight and 1 kg, more on a wide range (60 to 60.5 draws from about 58.5 to 62).
  const margin = Math.max(1, hi * 0.025, (hi - lo) * 0.25);
  const yLo = lo - margin;
  const yHi = hi + margin;
  const weeksShown = Array.from({ length: lastWk - firstWk + 1 }, (_, i) => firstWk + i);
  const xw = (wk: number) => pad.l + (lastWk === firstWk ? (W - pad.l - pad.r) / 2 : ((wk - firstWk) / (lastWk - firstWk)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - yLo) / (yHi - yLo)) * (H - pad.t - pad.b);
  const pts = winLogged.map((w) => ({ w, px: xw(w.week), py: y(w.best!) }));
  const labelOf = (wk: number) => h.find((w) => w.week === wk)?.label.replace("Week ", "W") ?? `W${wk}`;
  const target = cur?.target ?? row.kg;

  return (
    <DialogContent className="rd-dlg rd-progress rd-progress2">
      <DialogHeader>
        <DialogTitle>{row.name}</DialogTitle>
      </DialogHeader>

      {/* 1 · What is asked, on one line. */}
      <div className="rp-target">
        <span>
          <b>
            {row.sets} × {row.reps || "—"}
          </b>
        </span>
        <span>
          <b>{kgOf(row.kg, lbs)}</b> {unit}
        </span>
        {multiGym &&
          row.gymKg
            .filter((g) => g.kg !== row.kg)
            .map((g) => (
              <span key={g.gym}>
                <b>{kgOf(g.kg, lbs)}</b> {unit} at {g.gym}
              </span>
            ))}
        {row.rpe != null && (
          <span>
            RPE <b>{row.rpe}</b>
          </span>
        )}
        {row.tempo && (
          <span>
            Tempo <b>{row.tempo}</b>
          </span>
        )}
        {restOf(row.rest) && (
          <span>
            Rest <b>{restOf(row.rest)}</b>
          </span>
        )}
        {row.note && <em>&ldquo;{row.note}&rdquo;</em>}
      </div>

      {/* 2 · The verdict in three numbers. */}
      <div className="rp-stats">
        <div className={`rp-stat ${tone(row.d7)}`}>
          <small>vs last week</small>
          <b>{pct(row.d7)}</b>
          {row.d7 == null && upTo.length > 0 && <em>Not logged the week before</em>}
        </div>
        <div className={`rp-stat ${tone(row.d30)}`}>
          <small>over 4 weeks</small>
          <b>{pct(row.d30)}</b>
        </div>
        <div className={`rp-stat ${verdict.cls}`}>
          <small>Trend</small>
          <b>{verdict.text}</b>
        </div>
      </div>

      {/* 3 · The curve over the last four weeks: the best set each week, the target dashed. */}
      {pts.length > 0 && (
        <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${row.name}: best set by week`}>
          {target != null && (
            <>
              <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} className="rp-target-line" />
              <text x={pad.l - 6} y={y(target) + 3} className="rp-axis" textAnchor="end">
                {shown(target)}
              </text>
            </>
          )}
          {/* The scale's top and bottom, so the headroom reads. */}
          <text x={pad.l - 6} y={y(yHi) + 3} className="rp-axis" textAnchor="end">
            {shown(yHi)}
          </text>
          <text x={pad.l - 6} y={y(yLo) + 3} className="rp-axis" textAnchor="end">
            {shown(yLo)}
          </text>
          {pts.length > 1 && <polyline points={pts.map((q) => `${q.px},${q.py}`).join(" ")} className="rp-line" />}
          {pts.map((q) => (
            <g key={q.w.week}>
              <circle cx={q.px} cy={q.py} r={q.w.current ? 5 : 3.5} className={`rp-dot${q.w.current ? " now" : ""}`} />
              <text x={q.px} y={q.py - 8} className="rp-val" textAnchor="middle">
                {shown(q.w.best!)}
              </text>
            </g>
          ))}
          {weeksShown.map((wk) => (
            <text key={wk} x={xw(wk)} y={H - 4} className={`rp-axis${wk === lastWk ? " now" : ""}`} textAnchor="middle">
              {labelOf(wk)}
            </text>
          ))}
        </svg>
      )}

      {/* 4 · The last four weeks set by set, as before, with each week's change
          from the week before on its first row. */}
      <table className="rd-progress-table rp-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Set</th>
            <th>Weight ({unit})</th>
            <th>Reps</th>
            <th>RPE</th>
            {h.some((w) => w.gym) && <th>Gym</th>}
            <th>Target</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {[...winLogged].reverse().map((w) => {
            const prev = logged.find((q) => q.week === w.week - 1) ?? null;
            const stepPct = prev && est(prev) > 0 ? Math.round(((est(w) - est(prev)) / est(prev)) * 1000) / 10 : null;
            const verdictW = onTarget(w);
            return w.sets.map((st, i) => {
              return (
                <tr key={`${w.week}-${st.n}`} className={`${w.current ? "now" : ""}${i === 0 ? " first" : ""}`}>
                  <td>{i === 0 && w.label}</td>
                  <td>{st.n}</td>
                  <td>{st.kg != null ? kgOf(st.kg, lbs) : "—"}</td>
                  <td>{st.reps ?? "—"}</td>
                  <td>{st.rpe ?? "—"}</td>
                  {h.some((q) => q.gym) && <td>{i === 0 ? w.gym ?? "" : ""}</td>}
                  <td>{i === 0 && verdictW && <span className={`rp-hit ${verdictW.cls}`}>{verdictW.text}</span>}</td>
                  <td className={`rp-change ${stepPct == null ? "none" : stepPct > 0 ? "up" : stepPct < 0 ? "down" : "flat"}`}>{i === 0 ? pct(stepPct) : ""}</td>
                </tr>
              );
            });
          })}
          {winLogged.length === 0 && (
            <tr className="none">
              <td colSpan={8}>Nothing logged on this exercise in the last four weeks.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="rp-howto">
        The percentages and the trend compare each week&rsquo;s best set with its reps counted, as an estimated one-rep max (weight × (1 + reps ÷ 30)): more reps at the same weight is progress, and fewer reps at a little more weight is not. <b>Vs last week</b> is against the week before;{" "}
        <b>over 4 weeks</b> against the earliest week logged in the last four; <b>Change</b> is each week against the one before. <b>Target</b> checks each set against what you asked that week: on target when its reps reach the bottom of the range at the target weight or heavier, <b>top of range</b> when every set reached the top (time to go heavier). The chart shows the heaviest weight each week, with your target dashed.
      </p>
    </DialogContent>
  );
}

// ---- The demo video on an exercise: what the client sees now, and a link or
// a file to set it. Per exercise, not per row: it follows the exercise onto
// every client's sheet until the coach changes it.
function DemoDialog({ row, demo, onSave, onRemove }: { row: DraftRow; demo: DraftRow["demo"]; onSave: (v: { url?: string; file?: File }) => void; onRemove: () => void }) {
  const [how, setHow] = useState<"link" | "file">("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const uploaded = !!demo && demo.url.startsWith("/uploads/");
  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  };
  const linkOk = /^https?:\/\/\S+$/i.test(url.trim());
  const ok = how === "link" ? linkOk : !!file;
  return (
    <DialogContent className="rd-dlg rd-demo-dlg">
      <DialogHeader>
        <DialogTitle>
          <span className="rq-title-row">
            {row.name}
            <span className="rq-state rd-demo-tag">Demo video</span>
            <span className={`rq-state ${demo ? "rd-demo-on" : "rd-demo-off"}`}>{demo ? "Attached" : "None yet"}</span>
          </span>
        </DialogTitle>
        <DialogDescription>Shows on every client&rsquo;s sheet that has {row.name}, so a demo is set once.</DialogDescription>
      </DialogHeader>

      <div className="rd-field">
        <span>The client sees</span>
        {demo ? (
          <a href={demo.url} target="_blank" rel="noreferrer" className="rd-demo-current">
            <PlayIcon />
            <span className="rd-demo-current-main">
              <b>{uploaded ? "An uploaded video" : host(demo.url) ?? demo.url}</b>
              <small>{uploaded ? "From your files" : demo.url}</small>
            </span>
            <em>{demo.source === "row" ? "set on this row only" : "open"}</em>
          </a>
        ) : (
          <p className="rd-dlg-hint">Nothing yet.</p>
        )}
      </div>

      <div className="rd-field">
        <span>{demo ? "Replace it with" : "Attach"}</span>
        <div className="rd-btn-group rq-groups" role="group" aria-label="How to attach">
          <button type="button" className={how === "link" ? "on" : ""} aria-pressed={how === "link"} onClick={() => setHow("link")}>
            Paste a link
          </button>
          <button type="button" className={how === "file" ? "on" : ""} aria-pressed={how === "file"} onClick={() => setHow("file")}>
            Upload a file
          </button>
        </div>
      </div>

      {how === "link" ? (
        <label className="rd-field">
          <span>Link</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" inputMode="url" autoFocus />
          <small className="rd-dlg-hint">{url.trim() && !linkOk ? "That is not a link the client can open." : linkOk ? `Opens on ${host(url) ?? "the web"}.` : "YouTube, Vimeo, a Drive share: anything the client can open."}</small>
        </label>
      ) : (
        <label className="rd-field">
          <span>File</span>
          <span className={`rd-demo-drop${file ? " has" : ""}`}>
            <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Pick a video file" />
            {file ? (
              <>
                <b>{file.name}</b>
                <small>{Math.max(1, Math.round(file.size / 1048576))} MB · click to change</small>
              </>
            ) : (
              <>
                <b>Pick a video</b>
                <small>MP4 or MOV, straight off your computer</small>
              </>
            )}
          </span>
        </label>
      )}

      <DialogFooter>
        {demo && (
          <button type="button" className="rd-btn danger" onClick={onRemove}>
            <TrashIcon /> Remove
          </button>
        )}
        <span className="rd-dlg-hint grow" />
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!ok} onClick={() => onSave(how === "link" ? { url: url.trim() } : { file: file! })}>
          {demo ? "Replace" : "Attach"}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

function VideoDialog({ row, video, firstName, where, onAsk, onCancel, onReply }: { row: DraftRow; video: DraftRow["video"]; firstName: string; where: string; onAsk: (note: string) => void; onCancel: () => void; onReply: (reply: string) => void }) {
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>{!video ? "Ask for a video" : video.state === "asked" ? "Video asked for" : `${firstName}'s video`}</DialogTitle>
        <DialogDescription>
          {row.name} · {where}
        </DialogDescription>
      </DialogHeader>
      {!video && (
        <>
          <label className="rd-field">
            <span>What you want to see</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Film the top set from the side, please." autoFocus />
          </label>
          <p className="rd-dlg-hint">It shows on this exercise in this session of {firstName}&rsquo;s app, with a camera to film or upload it. Up to two minutes.</p>
          <DialogFooter>
            <DialogClose className="rd-btn">Cancel</DialogClose>
            <button type="button" className="rd-btn primary" onClick={() => onAsk(note.trim())}>
              Ask {firstName}
            </button>
          </DialogFooter>
        </>
      )}
      {video?.state === "asked" && (
        <>
          <p className="rd-dlg-para">
            Waiting for {firstName}. {video.note && <em>&ldquo;{video.note}&rdquo;</em>}
          </p>
          <DialogFooter>
            <button type="button" className="rd-btn danger" onClick={onCancel}>
              Withdraw the request
            </button>
            <DialogClose className="rd-btn primary">Close</DialogClose>
          </DialogFooter>
        </>
      )}
      {(video?.state === "in" || video?.state === "replied") && (
        <>
          <div className="rd-video-stub" role="img" aria-label={`${firstName}'s video`}>
            <PlayIcon />
            <span>{firstName}&rsquo;s video · 0:42</span>
          </div>
          {video.state === "replied" ? (
            <p className="rd-dlg-para">
              <b>Your reply</b> {video.reply}
            </p>
          ) : (
            <>
              <label className="rd-field">
                <span>Your reply</span>
                <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Depth is good. Keep the knees tracking over the toes on the way up." autoFocus />
              </label>
              <p className="rd-dlg-hint">A note, or a video of your own (a screen recording of theirs, drawn over). {firstName} gets a notification.</p>
            </>
          )}
          <DialogFooter>
            <DialogClose className="rd-btn">Close</DialogClose>
            {video.state === "in" && (
              <button type="button" className="rd-btn primary" disabled={!reply.trim()} onClick={() => onReply(reply.trim())}>
                Send reply
              </button>
            )}
          </DialogFooter>
        </>
      )}
    </DialogContent>
  );
}

/** The chat about one exercise, over the Training screen: both sides' messages
 *  about it, oldest first, and a reply linked to it. The reply is an ordinary
 *  chat message, so it is in the full chat and on the client's side too. */
function ExerciseChatDialog({ row, firstName, onSend }: { row: DraftRow; firstName: string; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  // Always at the newest, on opening and when a reply lands.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [row.exerciseChat.length]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };
  return (
    <DialogContent className="rd-dlg rd-exchat">
      <DialogHeader>
        <DialogTitle>{row.name}</DialogTitle>
        <DialogDescription>What you and {firstName} said about it.</DialogDescription>
      </DialogHeader>
      <div ref={list} className="rd-exchat-list">
        {row.exerciseChat.map((m, i) => (
          <div key={i} className={`rd-exchat-msg${m.mine ? " mine" : ""}`}>
            <span className="rd-exchat-text">{m.text}</span>
            <small>{m.when}</small>
          </div>
        ))}
      </div>
      <div className="rd-exchat-compose">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Reply to ${firstName}…`}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="button" className="rd-btn primary" disabled={!text.trim()} onClick={send}>
          Send
        </button>
      </div>
    </DialogContent>
  );
}

export function MessageDialog({ firstName, label, onSend }: { firstName: string; label: string; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>Message {firstName}</DialogTitle>
      </DialogHeader>
      <div className="rd-field">
        <span>About</span>
        <span className="rd-about">{label}</span>
      </div>
      <label className="rd-field">
        <span>Message</span>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What you noticed, and what to do about it." autoFocus onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim() && onSend(text.trim())} />
      </label>
      <DialogFooter>
        <span className="rd-dlg-hint grow">Lands on {firstName}&rsquo;s Home, linked to this.</span>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!text.trim()} onClick={() => onSend(text.trim())}>
          Send
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

function CopySessionDialog({ source, others, canAdd, nextNumber, laterLabel, onCopy }: { source: DraftSession; others: DraftSession[]; canAdd: boolean; nextNumber: number; laterLabel: string; onCopy: (to: "new" | number, also: boolean) => void }) {
  const [to, setTo] = useState<"new" | number>(canAdd ? "new" : (others[0]?.id ?? "new"));
  const [also, setAlso] = useState(false);
  const count = `${source.rows.length} ${source.rows.length === 1 ? "exercise" : "exercises"}${source.cardio.length ? ` and ${source.cardio.length} cardio` : ""}`;
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>Copy {source.name}</DialogTitle>
        <DialogDescription>{count}, to:</DialogDescription>
      </DialogHeader>
      <div className="rd-choices" role="radiogroup">
        {canAdd && (
          <label className={`rd-choice${to === "new" ? " on" : ""}`}>
            <input type="radio" name="to" checked={to === "new"} onChange={() => setTo("new")} />
            <span>
              <b>New session</b>
              <small>Adds Session {nextNumber} to this week</small>
            </span>
          </label>
        )}
        {others.map((o) => (
          <label key={o.id} className={`rd-choice${to === o.id ? " on" : ""}`}>
            <input type="radio" name="to" checked={to === o.id} onChange={() => setTo(o.id)} />
            <span>
              <b>{o.name}</b>
              <small>{o.rows.length ? `Replaces its ${o.rows.length} ${o.rows.length === 1 ? "exercise" : "exercises"}` : "Empty"}</small>
            </span>
          </label>
        ))}
      </div>
      {laterLabel && (
        <label className="rd-tick">
          <input type="checkbox" checked={also} onChange={(e) => setAlso(e.target.checked)} />
          Also do this in the remaining weeks ({laterLabel})
        </label>
      )}
      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" onClick={() => onCopy(to, also)}>
          {to === "new" ? `Add as Session ${nextNumber}` : `Replace ${others.find((o) => o.id === to)?.name ?? "session"}`}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

export function ConfirmDialog({ title, description, confirm, danger, tick, onConfirm }: { title: string; description: string; confirm: string; danger?: boolean; tick?: string | null; onConfirm: (also: boolean) => void }) {
  const [also, setAlso] = useState(false);
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {tick && (
        <label className="rd-tick">
          <input type="checkbox" checked={also} onChange={(e) => setAlso(e.target.checked)} />
          {tick}
        </label>
      )}
      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className={`rd-btn ${danger ? "danger-solid" : "primary"}`} onClick={() => onConfirm(also)} autoFocus>
          {confirm}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

function GymsDialog({ firstName, gyms, onAdd, onRemove, onHome }: { firstName: string; gyms: Gym[]; onAdd: (name: string) => void; onRemove: (id: number) => void; onHome: (id: number) => void }) {
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
  };
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>{firstName}&rsquo;s gyms</DialogTitle>
        <DialogDescription>Each gym keeps its own weights. The home gym&rsquo;s weight is the plain figure; {firstName} picks the gym at the start of a session.</DialogDescription>
      </DialogHeader>
      <div className="rd-gymlist">
        {gyms.map((g) => (
          <div key={g.id} className="rd-gymrow">
            <span className="rd-gymname">
              {g.name}
              {g.home && <em>Home</em>}
            </span>
            {!g.home && (
              <button type="button" className="rd-btn ghost wide" onClick={() => onHome(g.id)}>
                Make home
              </button>
            )}
            <button type="button" className="rd-btn ghost sm" onClick={() => onRemove(g.id)} aria-label={`Remove ${g.name}`} title="Remove (what was logged there stays)">
              <TrashIcon />
            </button>
          </div>
        ))}
        {gyms.length === 0 && <p className="rd-dlg-hint">No gyms yet: the weights are one figure.</p>}
      </div>
      <div className="rd-field-row">
        <input className="rd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gym name" maxLength={40} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button type="button" className="rd-btn" onClick={add} disabled={!name.trim()}>
          <PlusIcon /> Add gym
        </button>
      </div>
      <DialogFooter>
        <DialogClose className="rd-btn primary">Done</DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

/** A new week at the end: blank, or a copy of the week on screen. */
function AddWeekDialog({ next, date, source, sessionCount, onAdd }: { next: number; date: string | null; source: { label: string }; sessionCount: number; onAdd: (copy: boolean) => void }) {
  const [copy, setCopy] = useState(sessionCount > 0);
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>Add Week {next}</DialogTitle>
        <DialogDescription>{date ? `Starts ${date}. ` : ""}Blank, or a copy of the week on screen?</DialogDescription>
      </DialogHeader>
      <div className="rd-choices" role="radiogroup">
        <label className={`rd-choice${!copy ? " on" : ""}`}>
          <input type="radio" name="addweek" checked={!copy} onChange={() => setCopy(false)} />
          <span>
            <b>Blank week</b>
            <small>No sessions yet; add them one by one</small>
          </span>
        </label>
        <label className={`rd-choice${copy ? " on" : ""}${sessionCount === 0 ? " off" : ""}`}>
          <input type="radio" name="addweek" checked={copy} disabled={sessionCount === 0} onChange={() => setCopy(true)} />
          <span>
            <b>Copy of {source.label}</b>
            <small>{sessionCount === 0 ? `${source.label} has no sessions to copy` : `Its ${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}, exercises and cardio; nothing logged comes along`}</small>
          </span>
        </label>
      </div>
      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" onClick={() => onAdd(copy)} autoFocus>
          {copy ? `Add as copy of ${source.label}` : "Add blank week"}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewProgramDialog({ onCreate }: { onCreate: (v: { name: string; weeks: number; start: string }) => void }) {
  const [name, setName] = useState("");
  // Typed, not picked: any whole number of weeks from 1 to 52.
  const [weeksText, setWeeksText] = useState("8");
  const weeks = Math.round(Number(weeksText));
  const weeksOk = Number.isFinite(weeks) && weeks >= 1 && weeks <= 52;
  const [start, setStart] = useState("");
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>New programme</DialogTitle>
        <DialogDescription>A draft: only you see it until it is scheduled. It lands on the Plan tab&rsquo;s training lane.</DialogDescription>
      </DialogHeader>
      <label className="rd-field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Strength Block" maxLength={60} autoFocus />
      </label>
      <div className="rd-field-row">
        <label className="rd-field rd-field-weeks">
          <span>Length</span>
          <span className="rd-weeks-field">
            <input type="number" inputMode="numeric" min={1} max={52} step={1} value={weeksText} onChange={(e) => setWeeksText(e.target.value)} aria-label="Length in weeks" />
            <small>{weeksOk && weeks === 1 ? "week" : "weeks"}</small>
          </span>
        </label>
        <label className="rd-field">
          <span>Starts</span>
          <DatePick value={start} onChange={setStart} label="Starts" placeholder="Pick the start" />
        </label>
      </div>
      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!weeksOk} onClick={() => onCreate({ name: name.trim(), weeks, start })}>
          Create draft
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

function NoteDialog({ firstName, note, onSeen }: { firstName: string; note: { text: string; when: string }; onSeen: () => void }) {
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>Note from {firstName}</DialogTitle>
        <DialogDescription>On this programme · {note.when}</DialogDescription>
      </DialogHeader>
      <p className="rd-dlg-para rd-note-text">{note.text}</p>
      <DialogFooter>
        <button type="button" className="rd-btn primary" onClick={onSeen}>
          Got it
        </button>
      </DialogFooter>
    </DialogContent>
  );
}


// Two arrows passing each other: a swap.
function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h13" />
      <path d="m17 20 4-4-4-4" />
      <path d="M21 16H8" />
    </svg>
  );
}
