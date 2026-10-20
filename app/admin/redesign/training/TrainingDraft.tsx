"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhaseDialog, phaseForm as planPhaseForm, type DraftPlan } from "../plan/PlanDraft";
import { addExerciseToLibraryAction, addExerciseVariationAction, markProgramNoteSeenAction, markVideoSeenAction, setRowDemoHiddenAction, setRowVariationAction, addGymAction, addProgramWeekAction, addSessionAction, applyDayChangesAction, applyDayToLaterWeeksAction, addClientPhaseAction, cancelProgramScheduleAction, clearExerciseDemoAction, copyProgramDayAction, copyProgramWeekAction, deployProgramAction, removeGymAction, removeExerciseVariationAction, removeProgramWeekAction, deletePhaseAction, removeSessionAction, removeVideoRequestAction, renameProgramAction, reorderSessionsAction, requestExerciseVideoAction, scheduleProgramDeployAction, sendChatMessageAction, sendVideoReplyAction, setExerciseAlternativesAction, setCardioAlternativesAction, setExerciseDemoLinkAction, setHomeGymAction, updateClientPhaseAction, uploadExerciseVideoAction, type DayChangesPayload } from "../../../lib/actions";
import type { MessageLink } from "../../../lib/messageLinks";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent } from "../../../components/ui/popover";
import { CalendarIcon, ChatIcon, ChevronDownIcon, ChevronRightIcon, ColumnsIcon, CopyIcon, DumbbellIcon, EyeIcon, MoreIcon, PlayIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { PhotoIcon, VideoIcon } from "../../VideoRequestButton";
import RogueSessions from "./RogueSessions";
import MediaReviewModal, { reviewable, type MediaReview, type ThreadItem } from "../media-review/MediaReviewModal";
import PhaseDatesDialog from "../PhaseDatesDialog";
import PhaseSwitcher from "../PhaseSwitcher";
import { AfterWorkoutCheck, GoalsNotePills, GripIcon, WeekRail } from "./TrainingParts";
import "./trn.css";
import { SortableItem, SortableList } from "../Sortable";
import { useOpenChat } from "../ChatPanel";
import Picker from "../Picker";
import AskVideoDialog from "./AskVideoDialog";
import SessionSubstitutesDialog from "./SessionSubstitutesDialog";
import VariationDialog from "./VariationDialog";
import DemoVideoDialog, { type CoachClip } from "./DemoVideoDialog";
import ClientGymsDialog from "./ClientGymsDialog";
import DeleteSessionDialog from "./DeleteSessionDialog";
import ScheduleDialog from "./ScheduleDialog";
import { addDays } from "../phases/timeline";
import { stateTagStyle } from "../../phaseChrome";
import ExerciseProgressDialog from "./ExerciseProgressDialog";
import DatePick from "../DatePick";
import { dayMonth } from "../../../lib/dayMonth";

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

export type Gym = { id: number; name: string; home: boolean; /** The picker's colour and the gym's use (15 Oct), for the gyms pop-up. */ color: string; rgb: string; sessions8w: number; lastSessionAt: string | null; /** The picture the client gave it in their app (20 Oct), and whether it is a gym, home or hotel. */ logo?: string | null; kind?: "gym" | "home" | "hotel" };
export type Library = { slug: string; label: string; exercises: { id: number; name: string; /** Its muscle group and its demo (15 Oct): the substitutes and variation pop-ups. */ group?: string; video?: string | null; /** The coach's default cue (Library page): the note it starts with when added. */ cue?: string; /** Close grip, wide grip… (Library page): one can be picked per row; its own cue, if any, is the note the row starts with. */ variations?: PickedVariation[] }[] }[];
/** A variation as the picker hands it over with the exercise. */
export type PickedVariation = { id: number; name: string; cue?: string; /** Its own demo (15 Oct). */ video?: string | null };
/** A cardio movement from the coach's library, offered when a cardio is added, with its default cue. */
export type CardioMove = { name: string; cue: string };
export type DraftRow = {
  id: number;
  /** The library exercise behind the row: demos are set per exercise. */
  exerciseId: number;
  /** The exercise's variation asked for (close grip…); its name is already in `name`. */
  variationId?: number | null;
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
  video: { requestId: number; /** Ask every session (15 Oct). */ recurring?: boolean; state: "asked" | "in" | "replied"; note: string | null; reply: string | null; /** The file the client sent, and the one the coach sent back (9 Oct). */ src: string | null; replySrc: string | null; /** A photo or a video; sent unasked; about the swap; with the client's words (9 Oct). */ media: "video" | "photo"; fromClient: boolean; about: "swap" | null; clientNote: string | null; /** When it came in and when it was answered; a recorded review's length and drawings (12 Oct). */ sentAt?: string | null; repliedAt?: string | null; replyDurationMs?: number | null; replyAnnotations?: number | null } | null;
  /** The demo the client sees on this exercise: the library's, else one set on this row long ago. */
  demo: { url: string; source: "library" | "row" } | null;
  /** How many of the coach's clients have this exercise on a sheet. */
  demoClients?: number;
  /** The coach keeping that demo off this prescription for this client. */
  demoHidden: boolean;
  history: { week: number; label: string; target: number | null; targetReps: string; setsPlanned: number; sets: { n: number; kg: number | null; reps: number | null; rpe: number | null }[]; best: number | null; e1rm: number | null; gym: string | null; /** yyyy-mm-dd of the session (15 Oct). */ date: string | null; current: boolean }[];
  /** What the client did instead, when they swapped the exercise. */
  swap: string | null;
  /** The swap in full: what, when, and the sets logged on it (kept out of this row's numbers). */
  /** The chat about this exercise, both sides, oldest first. */
  exerciseChat: { id: number; mine: boolean; text: string; when: string; at?: number; media?: { path: string; type: string } | null }[];
  swapInfo: { name: string; typed: boolean; when: string; sets: { set: number; kg: number | null; reps: number | null; rpe: number | null; gym: string | null }[] } | null;
  /** What the coach offers instead when the machine is taken, on this session. */
  alternatives: { exerciseId: number; name: string; note: string }[];
  /** The library's substitutes for the exercise (14 Oct), offered too unless libraryOff. */
  librarySubstitutes: { exerciseId: number; name: string; note: string }[];
  libraryOff: boolean;
  /** Library substitutes switched off on this session (15 Oct). */
  libraryHidden: number[];
  /** The client's last top set on each variation of this exercise (15 Oct), null being the standard exercise. */
  variationLast: { variationId: number | null; weight: number; reps: number; date: string }[];
  d7: number | null;
  d30: number | null;
};
/** swap: what the client did instead; alternatives: what the coach offers (names, with a note). */
export type DraftCardio = { id: number; name: string; time: string; pace: string; incline: string; distance: string; notes: string; done: boolean; swap?: string | null; alternatives?: { name: string; note: string }[] };
export type DraftSession = { id: number; number: number; name: string; setsPlanned: number; setsLogged: number; gym: string | null; skip: string | null; duration: number | null; ended: string | null; note: string | null; /** What the client answered on ending the session (the workout questionnaire): 1 to 10, a number, or words. */ answers?: { label: string; kind: "scale" | "number" | "text"; value: number | null; text: string | null; unit: string }[]; rows: DraftRow[]; cardio: DraftCardio[]; /** The later weeks (screen index) with this session's slot and nothing logged in it: what "Also delete it from" reaches. */ laterWeeks?: number[] };
/** A workout the client ended, with what they answered on ending it (the answers feed). */
export type DraftAnswered = { dayId: number; weekIdx: number; weekLabel: string; name: string; ended: string; duration: number | null; gym: string | null; note: string | null; answers: { label: string; kind: "scale" | "number" | "text"; value: number | null; text: string | null; unit: string }[] };
/** A rogue session as the coach sees it: when, how long, and what was logged. */
export type DraftRogue = {
  id: number;
  started: string | null;
  ended: string | null;
  duration: number | null;
  note: string | null;
  exercises: { id: number; name: string; sets: { n: number; kg: number | null; reps: number | null }[] }[];
  cardio: { id: number; name: string; time: string; distance: string; pace: string; incline: string; done: boolean }[];
};

export type DraftProgram = {
  id: number;
  /** The plan behind the tab (10 Oct): today, this week, every phase and programme, for the New phase dialog the Plan tab has. */
  planCtx: Pick<DraftPlan, "today" | "thisWeek" | "phases" | "programs">;
  /** Every workout ended in this programme, newest first, with its answers. */
  answersFeed: DraftAnswered[];
  programs: { id: number; name: string; weeks: number; state: "live" | "past" | "scheduled" | "draft" }[];
  name: string;
  status: "live" | "past" | "scheduled" | "draft";
  totalWeeks: number;
  /** The programme's first week number in the client's calendar; a screen week index + this - 1 is the server's week. */
  startWeek: number;
  /** The training phase on the plan that carries its dates, if one does. */
  phaseId: number | null;
  /** What the client is asked as they end a workout in it: 1 to 10, a value, or words. */
  workoutQuestions: { id: string; label: string; kind?: "scale" | "number" | "text"; unit?: string }[];
  /** The coach's goals for the phase, up to three. */
  goals: string[];
  /** The coach's note to the client on this phase, top of their Training tab. */
  coachNote: string;
  startDate: string | null;
  endDate: string | null;
  weekIdx: number;
  liveIdx: number;
  /** trained: each session completed; missed: begun and left unfinished; skipped: the client said they couldn't do it. Neither: not started. */
  /** print: what a copy of the week would carry, so a week the same as another offers no copy of it. */
  weeks: { index: number; label: string; print: string; trained: boolean[]; missed: boolean[]; skipped: boolean[]; state: "past" | "live" | "ahead" }[];
  sessions: DraftSession[];
  /** The client's rogue sessions (19 Oct), by week index: their own workouts off the plan, read only. */
  rogue: Record<number, DraftRogue[]>;
  gyms: Gym[];
  /** The client's note to the coach on this programme. */
  /** The client's note on it; seen: the coach has opened this version. */
  note: { text: string; when: string; seen: boolean } | null;
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
/** The clock, for autosave's pauses (kept out of render). */
const nowMs = () => Date.now();
const MAX_COLS = 6;
/** Weeks in as few words as they take: "week 5", "weeks 5–6", "weeks 4 and 6", "weeks 2, 4 and 6". */
const weeksWords = (indexes: number[]) => {
  const ws = [...indexes].sort((a, b) => a - b);
  if (ws.length === 0) return "";
  if (ws.length === 1) return `week ${ws[0]}`;
  if (ws.every((w, i) => i === 0 || w === ws[i - 1] + 1)) return `weeks ${ws[0]}–${ws[ws.length - 1]}`;
  return `weeks ${ws.slice(0, -1).join(", ")} and ${ws[ws.length - 1]}`;
};

type AddedExercise = { kind: "exercise"; exerciseId: number | null; /** The exercise's variation picked with it; its name is already in `name`. */ variationId?: number | null; name: string; sets: number | string; reps: string; kg: number | null; rpe?: string; tempo?: string; rest?: string; note?: string };
type AddedCardio = { kind: "cardio"; name: string; time: string; pace: string; incline: string; distance: string; note: string };
type Added = { key: number } & (AddedExercise | AddedCardio);
type Edits = { name?: string; note?: string; sets?: string; reps?: string; kg?: number | null; gymKg?: Record<string, number | null>; rpe?: string; tempo?: string; rest?: string };
type CardioEdit = Partial<Pick<DraftCardio, "name" | "time" | "pace" | "incline" | "distance" | "notes">>;
type Pending = { added: Added[]; removed: number[]; cardioRemoved: number[]; edits: Record<number, Edits>; cardioEdits: Record<number, CardioEdit>; order: number[] | null; renamed: string | null; alsoRemaining: boolean };
const emptyPending = (): Pending => ({ added: [], removed: [], cardioRemoved: [], edits: {}, cardioEdits: {}, order: null, renamed: null, alsoRemaining: false });
const pendingCount = (p: Pending) => p.added.length + p.removed.length + p.cardioRemoved.length + Object.keys(p.edits).length + Object.keys(p.cardioEdits).length + (p.order ? 1 : 0) + (p.renamed != null ? 1 : 0);

type Dlg =
  | { kind: "progress"; rowId: number }
  | { kind: "variation"; rowId: number }
  | { kind: "editExercise"; sessionId: number; rowId: number }
  | { kind: "editCardio"; sessionId: number; cardioId: number }
  | { kind: "cardioAlternatives"; sessionId: number; cardioId: number }
  | { kind: "video"; rowId: number }
  | { kind: "demo"; rowId: number }
  | { kind: "alternatives"; rowId: number }
  | { kind: "newVariation"; rowId: number }
  | { kind: "message"; label: string; link: MessageLink }
  | { kind: "copySession"; sessionId: number }
  | { kind: "applyLater"; sessionId: number }
  | { kind: "copyWeek"; from: number }
  | { kind: "copyForward" }
  | { kind: "deleteSession"; sessionId: number }
  | { kind: "removeRow"; sessionId: number; rowId: number }
  | { kind: "removeCardio"; sessionId: number; cardioId: number }
  | { kind: "deploy" }
  | { kind: "backToDraft" }
  | { kind: "dates" }
  | { kind: "gyms" }
  | { kind: "newProgram" }
  | { kind: "note" }
  | { kind: "removeWeek" }
  | { kind: "deletePhase" }
  | null;

export default function TrainingDraft({ clientId, firstName, program, library, cardioMoves = [], coachVideos = [] }: { clientId: number; firstName: string; program: DraftProgram; library: Library; cardioMoves?: CardioMove[]; coachVideos?: CoachClip[] }) {
  // An exercise added from the library starts with its default cue as the note (5 Oct).
  const cueOf = (exerciseId: number | null) => (exerciseId == null ? "" : library.flatMap((g) => g.exercises).find((e) => e.id === exerciseId)?.cue ?? "");
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
  // Compared by content: every refresh hands in new objects with the same
  // values, and resetting on those collapsed panels and threw work away.
  const sessionsKey = JSON.stringify(program.sessions);
  const [seenProgram, setSeenProgram] = useState(sessionsKey);
  // Sessions being added: shown at once (20 Oct, Alex: Add session waited for the save and the page's read), until the read brings the real ones.
  const [incoming, setIncoming] = useState(0);
  if (seenProgram !== sessionsKey) {
    setSeenProgram(sessionsKey);
    setSessions(program.sessions);
    setIncoming(0);
  }
  const inUse = {
    rpe: sessions.some((x) => x.rows.some((r) => r.rpe != null)),
    tempo: sessions.some((x) => x.rows.some((r) => !!r.tempo)),
    rest: sessions.some((x) => x.rows.some((r) => r.rest != null)),
  };
  const cols = { ...picked, rpe: picked.rpe || inUse.rpe, tempo: picked.tempo || inUse.tempo, rest: picked.rest || inUse.rest };
  const onCount = Object.values(cols).filter(Boolean).length;
  const [gyms, setGyms] = useState<Gym[]>(program.gyms);
  const gymsKey = JSON.stringify(program.gyms);
  const [seenGyms, setSeenGyms] = useState(gymsKey);
  if (seenGyms !== gymsKey) {
    setSeenGyms(gymsKey);
    setGyms(program.gyms);
  }
  const multiGym = gyms.length > 1;
  // Room for the figures: the name and the log stretch with the screen, the
  // figure columns keep a set width, so on a wide screen they get more air.
  const GAP = 24;
  const exWidths = [cols.sets && 72, cols.weight && 92, cols.reps && 88, cols.rpe && 68, cols.tempo && 88, cols.rest && 84].filter((w): w is number => typeof w === "number");
  const gridCols = `20px minmax(220px, 1.5fr)${exWidths.map((w) => ` ${w}px`).join("")} minmax(180px, 1fr) minmax(260px, 1.3fr) 80px 80px 112px`;
  const colStyle = { gridTemplateColumns: gridCols, columnGap: GAP } as const;
  // The narrowest the table can be (every column at its minimum, the gaps and
  // the row's padding): every row takes at least this, so on a narrow window
  // they scroll sideways together inside the card and stay lined up.
  const tableMinW = 20 + 220 + exWidths.reduce((t, w) => t + w, 0) + 180 + 260 + 80 + 80 + 112 + (exWidths.length + 7) * GAP + 14;
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
  const weeksKey = JSON.stringify(program.weeks);
  const [seenWeeks, setSeenWeeks] = useState(weeksKey);
  if (seenWeeks !== weeksKey) {
    setSeenWeeks(weeksKey);
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
  // When each session last changed: autosave waits for a pause (20 Oct).
  const changedAt = useRef<Record<number, number>>({});
  const patch = (id: number, f: (p: Pending) => Pending) => {
    changedAt.current[id] = nowMs();
    setPending((prev) => ({ ...prev, [id]: f(prev[id] ?? emptyPending()) }));
  };
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
        .map((a) => ({ exerciseId: a.exerciseId!, variationId: a.variationId ?? null, fields: { sets: String(a.sets).trim() || "3", reps: a.reps, targetWeight: str(a.kg), rpe: a.rpe ?? "", tempo: a.tempo ?? "", rest: a.rest ?? "", notes: a.note ?? "" } })),
      order: p.order,
      // An exercise replaced in its Edit dialog (by name, from the library): the row keeps its place and figures.
      swap: Object.fromEntries(
        Object.entries(p.edits)
          .map(([id, e]) => [id, e.name ? (library.flatMap((g) => g.exercises).find((x) => x.name.toLowerCase() === e.name!.toLowerCase())?.id ?? null) : null] as const)
          .filter((x): x is readonly [string, number] => x[1] != null),
      ),
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
          .map((a, i) => ({ id: -(Date.now() + i + 1), exerciseId: a.exerciseId ?? 0, name: a.name, sets: Math.max(1, parseInt(String(a.sets), 10) || 3), reps: a.reps, kg: a.kg, gymKg: gyms.map((g) => ({ gym: g.name, kg: a.kg })), rpe: Number(a.rpe) || null, tempo: a.tempo?.trim() || null, rest: restSeconds(a.rest ?? ""), note: a.note?.trim() || null, logged: [], video: null, demo: null, demoHidden: false, history: [], swap: null, swapInfo: null, exerciseChat: [], alternatives: [], librarySubstitutes: [], libraryOff: false, libraryHidden: [], variationLast: [], d7: null, d30: null }));
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

  // ---- Autosave (20 Oct, Alex: no Apply bar). A session's changes save on
  // their own once the coach pauses: a second after the last change, never
  // while a box in that session is being typed in (or a cardio typed), never
  // while a removal's Undo is still on screen, and at once when the page is
  // hidden or left. One save at a time per session; a change made while one
  // is out goes right after. A save that fails keeps its changes queued and
  // the week's line says so, with Retry. One status for it all, on the
  // week's line (20 Oct, Alex: not per session).
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const inFlight = useRef<Record<number, boolean>>({});
  const again = useRef<Record<number, boolean>>({});
  const pendingRef = useRef(pending);
  const flushRef = useRef<(id: number) => void>(() => {});
  /** Two queues as one: what failed to save, under what came since (the newer wins). */
  const mergePending = (old: Pending, now: Pending): Pending => ({
    added: [...old.added, ...now.added],
    removed: [...new Set([...old.removed, ...now.removed])],
    cardioRemoved: [...new Set([...old.cardioRemoved, ...now.cardioRemoved])],
    edits: Object.fromEntries([...new Set([...Object.keys(old.edits), ...Object.keys(now.edits)])].map((k) => [k, { ...(old.edits[Number(k)] ?? {}), ...(now.edits[Number(k)] ?? {}) }])),
    cardioEdits: Object.fromEntries([...new Set([...Object.keys(old.cardioEdits), ...Object.keys(now.cardioEdits)])].map((k) => [k, { ...(old.cardioEdits[Number(k)] ?? {}), ...(now.cardioEdits[Number(k)] ?? {}) }])),
    order: now.order ?? old.order,
    renamed: now.renamed ?? old.renamed,
    alsoRemaining: false,
  });
  const flush = (sessionId: number) => {
    const p = pend(sessionId);
    if (pendingCount(p) === 0) return;
    if (inFlight.current[sessionId]) {
      again.current[sessionId] = true;
      return;
    }
    const payload = payloadOf({ id: sessionId } as DraftSession, { ...p, alsoRemaining: false });
    applyPending(sessionId);
    // A cardio still open in its form is saved now: the form closes, so the next keystroke can't add it twice.
    if (adding?.session === sessionId && adding.kind === "cardio" && adding.key != null && p.added.some((x) => x.key === adding.key)) setAdding(null);
    inFlight.current[sessionId] = true;
    setSaving((x) => ({ ...x, [sessionId]: true }));
    setFailed((x) => ({ ...x, [sessionId]: false }));
    const fail = (why: string) => {
      // Nothing of it was kept: the changes go back in the queue (under any made since) and the screen back to what is saved.
      setPending((prev) => ({ ...prev, [sessionId]: mergePending(p, prev[sessionId] ?? emptyPending()) }));
      setSeenProgram("");
      setFailed((x) => ({ ...x, [sessionId]: true }));
      toast.error("Not saved", { description: why });
    };
    void applyDayChangesAction(payload)
      .then((r) => {
        if (r && r.ok === false) fail(r.error ?? "Something went wrong");
      })
      .catch(() => fail("Check the connection, then Retry."))
      .finally(() => {
        inFlight.current[sessionId] = false;
        setSaving((x) => ({ ...x, [sessionId]: false }));
        router.refresh();
        if (again.current[sessionId]) {
          again.current[sessionId] = false;
          flushRef.current(sessionId);
        }
      });
  };
  const blocked = (sessionId: number) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || !el.closest(`#session-${sessionId}`)) return false;
    // A cardio being typed in its form, or any box in the session being typed in (not the exercise search).
    if (adding?.session === sessionId && adding.kind === "cardio" && el.closest(".rd-addrow")) return true;
    return el.matches("input, textarea") && !el.closest(".rd-addrow");
  };
  const tick = useRef<(force?: boolean) => void>(() => {});
  useEffect(() => {
    pendingRef.current = pending;
    flushRef.current = flush;
    tick.current = (force = false) => {
      const now = nowMs();
      for (const [key, p] of Object.entries(pending)) {
        const id = Number(key);
        if (pendingCount(p) === 0) continue;
        if (!force && (failed[id] || now - (changedAt.current[id] ?? 0) < 1000 || blocked(id))) continue;
        flush(id);
      }
    };
  });
  const anyPending = Object.values(pending).some((p) => pendingCount(p) > 0);
  useEffect(() => {
    if (!anyPending) return;
    const t = setInterval(() => tick.current(), 400);
    return () => clearInterval(t);
  }, [anyPending]);
  useEffect(() => {
    const now = () => tick.current(true);
    const hidden = () => document.visibilityState === "hidden" && now();
    // Closing or reloading with something not saved yet: the browser asks first.
    const ask = (e: BeforeUnloadEvent) => {
      const busy = Object.values(inFlight.current).some(Boolean) || Object.values(pendingRef.current).some((p) => pendingCount(p) > 0);
      if (!busy) return;
      now();
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("pagehide", now);
    window.addEventListener("beforeunload", ask);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", now);
      window.removeEventListener("beforeunload", ask);
      document.removeEventListener("visibilitychange", hidden);
      // Leaving the tab or the client: what is waiting goes now.
      now();
    };
  }, []);
  /** Before a copy (duplicate, apply to the weeks after, copy week): what these sessions still have waiting is saved first, so the copy has it. */
  const settle = async (ids: number[]) => {
    for (let i = 0; i < 25; i++) {
      for (const id of ids) flushRef.current(id);
      const busy = ids.some((id) => inFlight.current[id] || pendingCount(pendingRef.current[id] ?? emptyPending()) > 0);
      if (!busy) return;
      await new Promise((r) => setTimeout(r, 150));
    }
  };
  // A row just added waits (faded) for the page read that brings its real id.
  // That read can get lost (a dropped connection, a dev server rebuilding), and
  // the row stayed faded and locked (20 Oct, Alex). So while one waits: read
  // again every two seconds, three times, then fall back to what is saved.
  const landing = sessions.some((x) => x.rows.some((r) => r.id < 0) || x.cardio.some((c) => c.id < 0));
  const landingTries = useRef(0);
  useEffect(() => {
    if (!landing) {
      landingTries.current = 0;
      return;
    }
    const t = setInterval(() => {
      if (Object.values(inFlight.current).some(Boolean)) return;
      landingTries.current += 1;
      if (landingTries.current <= 3) router.refresh();
      else setSeenProgram("");
    }, 2000);
    return () => clearInterval(t);
  }, [landing, router]);
  const weekFailed = Object.values(failed).some(Boolean);
  const weekSaving = anyPending || Object.values(saving).some(Boolean);
  const retry = () => {
    setFailed({});
    for (const [key, p] of Object.entries(pending)) if (pendingCount(p) > 0) flush(Number(key));
  };
  // A demo set or taken off in this sitting, by row; a row not touched reads its own.
  const [demos, setDemos] = useState<Record<number, DraftRow["demo"]>>({});
  // Every session starts folded; the coach opens the one they want.
  const [open, setOpen] = useState<number | null>(null);
  // Another week loaded (a week chip, a link): the screen stays (units,
  // columns, scroll), the week on it changes and its sessions start folded.
  const [seenWeekIdx, setSeenWeekIdx] = useState(program.weekIdx);
  if (seenWeekIdx !== program.weekIdx) {
    setSeenWeekIdx(program.weekIdx);
    // The week on screen already (showWeek put it in the URL, and a page read
    // brought its fresh rows): nothing folds. Another week: start folded.
    if (program.weekIdx !== viewIdx) {
      setViewIdx(program.weekIdx);
      setOpen(null);
    }
    setStash((prev) => {
      const next = { ...prev };
      delete next[program.weekIdx];
      return next;
    });
  }
  // Arriving from a link in a message (#session-ID, or #session-ID-ex-ROW for
  // an exercise): that session unfolds and comes into view; an exercise's row
  // is scrolled to and marked for a moment. After the first paint, so the
  // server's closed rows match. (The pattern read "d+" for a while, so no
  // link ever matched and the week opened folded.)
  const [flashRow, setFlashRow] = useState<number | null>(null);
  // Rows whose swap is opened underneath them.
  const [openSwaps, setOpenSwaps] = useState<number[]>([]);
  const toggleSwap = (id: number) => setOpenSwaps((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  // A row's messages open in the chat panel (9 Oct), on the latest of them,
  // the reply already about the exercise. They used to unfold under the row.
  // Replying to what the client said slides the chat with them in from the
  // right (ChatPanel), the reply pointing at it; outside the shell, the
  // message dialog as before.
  const openChat = useOpenChat();
  const replyTo = (label: string, link: MessageLink, focus: number | null = null, draft?: string) => (openChat ? openChat({ area: "Training", label, link, ...(draft ? { draft } : {}) }, focus) : setDlg({ kind: "message", label, link }));
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
  const [seenVideos, setSeenVideos] = useState(sessionsKey);
  if (seenVideos !== sessionsKey) {
    setSeenVideos(sessionsKey);
    setVideos(Object.fromEntries(program.sessions.flatMap((s) => s.rows.map((r) => [r.id, r.video]))));
    setDemos({});
  }
  // New until opened; opening it is saved, so it stays read until the client writes again (30 Sep).
  const noteKey = program.note ? `${program.id}:${program.note.when}:${program.note.text}` : "";
  const [openedNote, setOpenedNote] = useState<string | null>(null);
  const noteSeen = !program.note || program.note.seen || openedNote === noteKey;
  const [dlg, setDlg] = useState<Dlg>(null);
  // Renaming the phase in place (20 Oct, Alex): a click on the title makes it a line to type on; a click away or Enter saves, Esc leaves it.
  const [renaming, setRenaming] = useState<string | null>(null);
  const commitRename = () => {
    if (renaming == null) return;
    const v = renaming.trim();
    setRenaming(null);
    if (v && v !== program.name) act(() => renameProgramAction(fd({ programId: program.id, name: v })), `Renamed to ${v}`);
  };
  const close = () => setDlg(null);
  const rowById = (id: number) => sessions.flatMap((s) => s.rows).find((r) => r.id === id) ?? null;
  // Taking a row or a cardio off, once the warning is confirmed (20 Oct, Alex).
  const takeOff = (sessionId: number, what: { row?: number; cardio?: number }) => {
    setDlg(null);
    patch(sessionId, (q) => ({ ...q, removed: what.row != null ? [...q.removed, what.row] : q.removed, cardioRemoved: what.cardio != null ? [...q.cardioRemoved, what.cardio] : q.cardioRemoved }));
  };
  const removeRowCopy = (r: DraftRow) => ({
    title: `Remove ${r.name}?`,
    what: `${r.sets} ${r.sets === 1 ? "set" : "sets"} · ${r.logged.length ? `${r.logged.length} logged` : "nothing logged"}`,
    warn: r.logged.length ? `${firstName}'s ${r.logged.length} logged ${r.logged.length === 1 ? "set goes" : "sets go"} with it.` : null,
  });
  const removeCardioCopy = (c: DraftCardio) => ({ title: `Remove ${c.name}?`, what: c.done ? "Done" : "Not done yet", warn: c.done ? `What ${firstName} logged on it goes with it.` : null });
  const sessionById = (id: number) => sessions.find((s) => s.id === id) ?? null;

  // Drag to reorder: exercises inside a session (queued on its bar), and
  // sessions inside the week.
  // (SortableList / SortableItem; the order is saved on drop.)
  const orderOf = (s: DraftSession) => pend(s.id).order ?? s.rows.map((r) => r.id);

  const today = new Date().toISOString().slice(0, 10);
  /** A week's first day. The rail is a grid, so its cards keep the month's name ("19 Oct"); the add-week pop-up's fact line is day/month. */
  const weekStart = (index: number) => (program.startDate ? addDays(program.startDate, (index - 1) * 7) : null);
  const weekDate = (index: number) => {
    const d = weekStart(index);
    return d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
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
    // The URL follows (6 Oct): a page read after any save used to hand back
    // the URL's week and snap the screen to it, folded.
    const u = new URL(window.location.href);
    u.searchParams.set("week", String(index));
    router.replace(u.pathname + u.search, { scroll: false });
  };
  // Weeks are added and removed on the server (the dialogs below); the page then lands on the right one.
  const later = weeks.filter((w) => w.index > viewIdx);
  const laterLabel = later.length === 0 ? "" : later.length === 1 ? `W${later[0].index}` : `W${later[0].index}–W${later[later.length - 1].index}`;
  // A copy that would change nothing isn't offered (20 Oct, Alex: Week 4 was Week 3 and still said "Copy week 3 here").
  const sameWeeks = (a: number, b: number) => weeks.find((w) => w.index === a)?.print === weeks.find((w) => w.index === b)?.print;
  // An empty week copies nothing (copyProgramWeek), so it is never offered as a source.
  const copyable = (i: number) => (weeks.find((w) => w.index === i)?.trained.length ?? 0) > 0 && !sameWeeks(i, viewIdx);
  const copyFromChoices = weeks.filter((w) => w.index !== viewIdx && copyable(w.index));
  // Copy forward reaches only the later weeks that differ (20 Oct, Alex: "Copy to weeks 4–6" when week 4 was already the same).
  const forwardTo = later.filter((w) => !sameWeeks(w.index, viewIdx));
  const forwardChanges = forwardTo.length > 0;
  const forwardLabel = weeksWords(forwardTo.map((w) => w.index));
  // + Week's menu (20 Oct, Alex: the add-week pop-up was too black): Blank, or a copy of the week before the new one, or of the one on screen; added at once.
  const addWeek = (from: number | null) => {
    const n = weeks.length + 1;
    startTransition(async () => {
      await addProgramWeekAction(fd({ clientId, programId: program.id, copyFrom: from }));
      savedToast(`Week ${n} added${from ? `, a copy of Week ${from}` : ""}`);
      router.push(`${window.location.pathname}?client=${clientId}&tab=training&program=${program.id}&week=${n}`, { scroll: false });
    });
  };
  const lastWeek = weeks[weeks.length - 1];
  const addFrom = [lastWeek, viewIdx !== lastWeek?.index ? weeks.find((w) => w.index === viewIdx) : undefined]
    .filter((w): w is (typeof weeks)[number] => !!w && w.trained.length > 0)
    .map((w) => ({ index: w.index, sessions: w.trained.length }));

  return (
    <div className={`rd trn${program.status === "past" ? " rd-past" : ""}`}>
      {program.status === "past" && (
        <div className="rd-past-note" role="note">
          <b>Ended.</b> This programme is here to look back on; nothing in it can be changed.
        </div>
      )}
      {/* ---- Header (19 Oct restructure): the programme's name, its switcher (▾) and state, its weeks and dates; on the right the goals and note pills, the unit and the menu. */}
      <header className="trn-head">
        <div className="trn-head-main">
          <span className="trn-eyebrow">Programme</span>
          <div className="trn-name-row">
            <h1 className="trn-name">
              {renaming != null ? (
                <input
                  className="trn-name-input"
                  value={renaming}
                  autoFocus
                  maxLength={60}
                  size={Math.max(8, renaming.length + 1)}
                  onChange={(e) => setRenaming(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={commitRename}
                  aria-label="Phase name"
                />
              ) : (
                <>
                  {/* Click the name to type it (20 Oct, Alex); the ▾ beside it switches programme. */}
                  <button type="button" className="trn-name-btn" onClick={() => setRenaming(program.name)} title="Rename">
                    {program.name}
                  </button>
                  <PhaseSwitcher name="" currentId={program.id} items={program.programs} hrefFor={(id) => `/admin/redesign/training?client=${clientId}&program=${id}`} label="Switch programme" newLabel="New programme" onNew={() => setDlg({ kind: "newProgram" })} />
                </>
              )}
            </h1>
            {/* The state is where its actions live (20 Oct, Alex): a draft or a scheduled programme's tag opens what can be done with it. */}
            {program.status === "draft" || program.status === "scheduled" ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className={`trn-status trn-status-btn ${program.status}`} style={stateTagStyle(program.status)} aria-label={`${stateLabel(program.status)}: change`}>
                  {stateLabel(program.status)}
                  <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="pb-menu">
                  {program.status === "draft" ? (
                    <DropdownMenuItem onSelect={() => setDlg({ kind: "deploy" })}>{startHasCome ? "Make it live" : "Schedule it"}</DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onSelect={() => setDlg({ kind: "deploy" })}>Make it live now</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDlg({ kind: "backToDraft" })}>Back to draft</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className={`trn-status ${program.status}`} style={stateTagStyle(program.status)}>{program.status === "past" ? "Ended" : stateLabel(program.status)}</span>
            )}
          </div>
          <span className="trn-meta">
            {weeks.length} {weeks.length === 1 ? "week" : "weeks"}
            {program.startDate && ` · ${fmtDate(program.startDate)}${program.endDate ? ` – ${fmtDate(program.endDate)}` : ""}`}
          </span>
        </div>
        <div className="trn-head-actions">
          {/* The client's note on the programme sits with the header's actions, so the week strip has the whole row. */}
          {program.note && (
            <button type="button" className={`rd-note${noteSeen ? "" : " unseen"}`} onClick={() => {
              setDlg({ kind: "note" });
              // Opened is read: the dot goes, and stays gone until the client writes again.
              if (!noteSeen) {
                setOpenedNote(noteKey);
                void markProgramNoteSeenAction(program.id);
              }
            }} title={`${firstName}'s note on this programme`}>
              <ChatIcon />
              <span>
                Note from {firstName}
                <small>{program.note.when}</small>
              </span>
            </button>
          )}
          {/* The goals and note as pills (they were two full-width bars), one pop-over under them. */}
          {program.phaseId != null && <GoalsNotePills firstName={firstName} phaseId={program.phaseId} goals={program.goals} note={program.coachNote} />}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="trn-more" aria-label="More for the programme">
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
                          ["weight", "Weight"],
                          ["reps", "Reps"],
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
              {/* Deleting the phase from here too (20 Oct, Alex), not only from Plan. */}
              {program.phaseId != null && (
                <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "deletePhase" })}>
                  <TrashIcon /> Delete phase
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ---- The weeks: a card each, one bar a session, NOW on this calendar week. */}
      <WeekRail
        weeks={weeks}
        viewIdx={viewIdx}
        dateOf={weekDate}
        hrefFor={(index) => `/admin/redesign/training?client=${clientId}&program=${program.id}&week=${index}`}
        isLocal={isLocal}
        onShow={showWeek}
        onAdd={addWeek}
        addFrom={addFrom}
      />

      {/* ---- The week's sessions. */}
      <div className="trn-weekhead">
        <div>
          <h2>Week {week.index}</h2>
          <span>
            {/* No date here (20 Oct, Alex): the week rail above already dates every week. */}
            {week.trained.filter(Boolean).length} of {week.trained.length} sessions done
            {/* Every change saves itself (20 Oct): the week says so. */}
            {weekFailed ? (
              <span className="trn-allsaved failed" role="alert">
                Not saved ·{" "}
                <button type="button" onClick={retry}>
                  Retry
                </button>
              </span>
            ) : (
              <span className={`trn-allsaved${weekSaving ? " saving" : ""}`} role="status">
                {weekSaving ? "Saving…" : "All changes saved"}
              </span>
            )}
          </span>
        </div>
        <div className="trn-weekhead-actions">
          {/* Any week with nothing logged can go (20 Oct, Alex: it was only the last); a live programme's only from the weeks still to come. The ones after move up. */}
          {weeks.length > 1 && (program.status !== "live" || week.state === "ahead") && !week.trained.some(Boolean) && !week.missed.some(Boolean) && sessions.every((x) => x.setsLogged === 0) && (
            <button type="button" className="trn-btn ghost" onClick={() => setDlg({ kind: "removeWeek" })}>
              <TrashIcon /> Remove week
            </button>
          )}
          {week.state !== "past" && weeks.length > 1 && viewIdx > 1 && copyable(viewIdx - 1) && (
            <button type="button" className="trn-btn" onClick={() => setDlg({ kind: "copyWeek", from: viewIdx - 1 })}>
              <CopyIcon /> Copy week {viewIdx - 1} here
            </button>
          )}
          {week.state !== "past" && weeks.length > 1 && viewIdx === 1 && copyFromChoices.length > 0 && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="trn-btn">
                <CopyIcon /> Copy from…
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="pb-menu">
                {copyFromChoices.map((w) => (
                  <DropdownMenuItem key={w.index} onSelect={() => setDlg({ kind: "copyWeek", from: w.index })}>
                    Week {w.index}
                    <small className="rd-menu-inuse">{w.trained.length} {w.trained.length === 1 ? "session" : "sessions"}</small>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Build one week, fill the rest in one go (20 Oct, Alex). */}
          {later.length > 0 && sessions.length > 0 && forwardChanges && (
            <button type="button" className="trn-btn" onClick={() => setDlg({ kind: "copyForward" })}>
              <CopyIcon /> Copy to {forwardLabel}
            </button>
          )}
          {/* KG / LBS beside the sessions it changes (20 Oct, Alex: it was in the programme's header). */}
          <div className="trn-unit" role="radiogroup" aria-label="Unit">
            {(["kg", "lbs"] as const).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={unit === u} className={unit === u ? "on" : ""} onClick={() => setLbs(u === "lbs")}>
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* One card, a 60px row a session; the row opens the session's table under it. */}
      <div className="rd-sessions trn-list">
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
          // In progress while the client is in it (sets logged, not ended); Unfinished once ended short.
          const status = s.skip ? { text: "Skipped", cls: "warn" } : complete ? { text: "Completed", cls: "good" } : s.ended ? { text: "Unfinished", cls: "warn" } : s.setsLogged > 0 ? { text: "In progress", cls: "live" } : { text: "Not started", cls: "idle" };
          const rows = orderOf(s)
            .map((id) => s.rows.find((r) => r.id === id)!)
            .filter((r) => r && !p.removed.includes(r.id));
          // The icon columns on the rows (30 Sep): one for each kind some row
          // in this session has, so a lone swap sits beside the chat with no
          // empty video slot between, and each kind still lines up down the rows.
          const videoIn = (id: number) => {
            const v = videos[id];
            return !!v && (v.state === "in" || v.state === "replied");
          };
          const flagCols = {
            chat: rows.some((r) => r.exerciseChat.some((m) => !m.mine)),
            video: rows.some((r) => videoIn(r.id)),
            swap: rows.some((r) => r.swap),
            // Sets the client added beyond the prescription (12 Oct, "Add a set").
            extra: rows.some((r) => extraOf(r) > 0),
          };
          return (
            <SortableItem key={s.id} id={s.id} as="section" anchor={`session-${s.id}`} className={`rd-session${isOpen ? " open" : ""}`}>
              {(sessionGrip) => (
              <>
              <div
                className="rd-session-head trn-row"
                // A click anywhere on the row opens or folds the session, bar the
                // grip, the buttons and (open) the name, which renames.
                onClick={(ev) => {
                  if ((ev.target as HTMLElement).closest("input, textarea, select, button, a, [role=button], [role^=menuitem], .rd-grip")) return;
                  setOpen(isOpen ? null : s.id);
                }}
              >
                <span className="rd-grip trn-grip" {...sessionGrip}>
                  <GripIcon />
                </span>
                <span className="trn-row-name">
                  {isOpen ? <SessionName value={name} onChange={(v) => patch(s.id, (q) => ({ ...q, renamed: v === s.name ? null : v }))} /> : <b>{name}</b>}
                  <small>
                    {rows.length} {rows.length === 1 ? "exercise" : "exercises"}
                    {s.cardio.length ? ` · ${s.cardio.length} cardio` : ""}
                  </small>
                  {/* The fold beside the title (20 Oct, Alex); the row's far end is the ··· menu. */}
                  <button type="button" className="trn-row-toggle" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen} aria-label={isOpen ? `Fold ${name}` : `Open ${name}`}>
                    <span className={`trn-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                      <ChevronRightIcon />
                    </span>
                  </button>
                </span>
                {/* What wants the coach: the client's note, a video, extra sets, a swap. */}
                <span className="trn-row-flags">
                  {s.note && (
                    <span className="rd-tag note" title={`${firstName}'s note: ${s.note}`} aria-label={`${firstName} left a note: ${s.note}`}>
                      <ChatIcon />
                    </span>
                  )}
                  {(() => {
                    const vs = rows.map((r) => videos[r.id] ?? null).filter((v) => v && (v.state === "in" || v.state === "replied"));
                    if (vs.length === 0) return null;
                    const waiting = vs.some((v) => v!.state === "in");
                    const photo = vs.every((v) => v!.media === "photo");
                    const word = photo ? "photo" : "video";
                    return (
                      <span className={`rd-flag video ${waiting ? "in" : "replied"}`} title={waiting ? `${firstName} sent a ${word} · waiting for your reply` : `Their ${word} · replied`} aria-label={waiting ? `A ${word} is waiting for your reply` : `${photo ? "Photo" : "Video"} replied`}>
                        {photo ? <PhotoIcon /> : <VideoIcon />}
                      </span>
                    );
                  })()}
                  {(() => {
                    const n = rows.reduce((t, r) => t + extraOf(r), 0);
                    return n > 0 ? (
                      <span className="rd-extradot static" title={`${firstName} added ${n} extra set${n === 1 ? "" : "s"} in this session`} aria-label={`${n} extra set${n === 1 ? "" : "s"}`}>
                        +{n}
                      </span>
                    ) : null;
                  })()}
                  {(() => {
                    const n = rows.filter((r) => r.swap).length;
                    return n > 0 ? (
                      <span className="rd-swapdot static" title={`${firstName} substituted ${n} exercise${n === 1 ? "" : "s"} in this session`} aria-label={`${n} substituted`}>
                        <SwapIcon />
                        {n > 1 && <b>{n}</b>}
                      </span>
                    ) : null;
                  })()}
                </span>
                {/* "Not started" only where it can be: this week, or a past week left undone; a week still to come shows nothing (20 Oct, Alex). */}
                {!(status.cls === "idle" && week.state === "ahead") && <span className={`trn-state ${status.cls}`}>{status.text}</span>}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="trn-row-more" aria-label={`More for ${name}`}>
                    <MoreIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="pb-menu">
                    {/* Only once the programme is live, as on an exercise's menu. */}
                    {program.status === "live" && (
                      <DropdownMenuItem onSelect={() => replyTo(`${name}, ${week.label}`, { kind: "session", dayId: s.id })}>
                        <ChatIcon /> Message about this session
                      </DropdownMenuItem>
                    )}
                    {(rows.length > 0 || s.cardio.length > 0) && (
                      <DropdownMenuItem onSelect={() => setDlg({ kind: "copySession", sessionId: s.id })}>
                        <CopyIcon /> Duplicate session
                      </DropdownMenuItem>
                    )}
                    {/* This session into the same slot of every later week (12 Oct). */}
                    {(rows.length > 0 || s.cardio.length > 0) && laterLabel && (
                      <DropdownMenuItem onSelect={() => setDlg({ kind: "applyLater", sessionId: s.id })}>
                        <CopyIcon /> Apply to remaining weeks
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
                <div className="rd-rows rd-rows-scroll" style={{ "--rd-minw": `${tableMinW}px` } as React.CSSProperties}>
                  {s.skip && <p className="rd-skip">{firstName} couldn&rsquo;t train: &ldquo;{s.skip}&rdquo;</p>}
                  {/* Answers in words only: the numbers are the head row's pills already. */}
                  {!!s.answers?.some((a) => a.text != null) && (
                    <p className="rd-session-note">
                      {firstName} answered: {s.answers.filter((a) => a.text != null).map((a) => `${a.label}: “${a.text}”`).join(" · ")}
                    </p>
                  )}
                  {s.note && (
                    <p className="rd-session-note rd-session-note-reply">
                      <span>
                        {firstName} wrote: &ldquo;{s.note}&rdquo;
                      </span>
                      <button type="button" className="rd-note-reply" onClick={() => replyTo(`${name}, ${week.label}`, { kind: "session", dayId: s.id })}>
                        <ChatIcon /> Reply
                      </button>
                    </p>
                  )}
                  <div className="rd-cols" aria-hidden="true" style={colStyle}>
                    <span />
                    <span>Exercise</span>
                    {cols.sets && <span>Sets</span>}
                    {cols.weight && <span>{unit}</span>}
                    {cols.reps && <span>Reps</span>}
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
                      <SortableItem key={r.id} id={r.id} anchor={`row-${r.id}`} className={`rd-row${Object.keys(e).length ? " edited" : ""}${flashRow === r.id ? " flash" : ""}${r.id < 0 ? " trn-landing" : ""}`}>
                        {(rowGrip) => (
                        <>
                        <div
                          className={`rd-row-main${r.exerciseChat.length ? " has-chat" : ""}`}
                          style={colStyle}
                          // A row with messages about it opens them underneath on a
                          // click anywhere that isn't a value or a button (1 Oct).
                          onClick={(ev) => {
                            if (!r.exerciseChat.length) return;
                            if ((ev.target as HTMLElement).closest("input, textarea, select, button, a, [role=button], [role=menuitem], .rd-grip")) return;
                            replyTo(`${r.name} · ${name}, ${week.label}`, { kind: "exercise", dayId: s.id, assignmentId: r.id }, r.exerciseChat[r.exerciseChat.length - 1]?.id ?? null);
                          }}
                        >
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
                                // Hidden from this client: the dot stays, greyed, so a demo is known to exist.
                                return demo ? (
                                  <a className={`rd-demo${r.demoHidden ? " off" : ""}`} href={demo.url} target="_blank" rel="noopener noreferrer" title={r.demoHidden ? `Demo hidden from ${firstName} · play it` : "Demo set · play it"} aria-label={`Play the demo for ${r.name}${r.demoHidden ? ` (hidden from ${firstName})` : ""}`}>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                                    </svg>
                                  </a>
                                ) : null;
                              })()}
                            </span>
                          </span>
                          {cols.sets && <Cell value={e.sets ?? String(r.sets)} onChange={(v) => edit({ sets: v })} label="Sets" width="sm" />}
                          {cols.weight && (
                            <span title={multiGym ? r.gymKg.map((g) => `${g.gym}: ${kgOf(g.kg, lbs)} ${unit}`).join("\n") : undefined}>
                              <WeightCell key={unit} kg={e.kg !== undefined ? e.kg : r.kg} lbs={lbs} onChange={(v) => edit({ kg: v })} />
                            </span>
                          )}
                          {cols.reps && <Cell value={e.reps ?? r.reps} onChange={(v) => edit({ reps: v })} label="Reps" placeholder="8-10" />}
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
                                  <span key={l.set} className={`rd-set${over > 0 ? " up" : over < 0 ? " down" : ""}${l.set > r.sets ? " extra" : ""}`} title={l.set > r.sets ? `Extra set${l.gym ? ` · ${l.gym}` : ""}` : l.gym ?? undefined}>
                                    {kgOf(l.kg, lbs)}×{l.reps ?? "—"}
                                    {l.rpe != null && <small>@{l.rpe}</small>}
                                  </span>
                                );
                              })
                            )}
                          </span>
                          {[r.d7, r.d30].map((dv, i) => (
                            <button key={i} type="button" className={`rd-trendcell rd-keep${dv == null ? " none" : dv > 0 ? " up" : dv < 0 ? " down" : " same"}`} title={`${r.name}: every set ${firstName} logged`} onClick={() => setDlg({ kind: "progress", rowId: r.id })}>
                              {dv == null ? "—" : dv === 0 ? "=" : `${dv > 0 ? "+" : "−"}${Math.abs(dv).toFixed(1)}%`}
                            </button>
                          ))}
                          <span className="rd-row-more">
                            {/* A slot for each kind the session has (flagCols), so
                                each lines up down the table: their messages about
                                it, a video they sent, a swap (opens what they did). */}
                            <span className="rd-flags">
                              {flagCols.chat && (
                              <span className="rd-flag-slot">
                                {r.exerciseChat.some((m) => !m.mine) && (
                                  <button
                                    type="button"
                                    className="rd-flag chat"
                                    onClick={() => replyTo(`${r.name} · ${name}, ${week.label}`, { kind: "exercise", dayId: s.id, assignmentId: r.id }, r.exerciseChat[r.exerciseChat.length - 1]?.id ?? null)}
                                    title={`${firstName} wrote about ${r.name} · read and reply`}
                                    aria-label={`Read what ${firstName} wrote about ${r.name}, and reply`}
                                  >
                                    <ChatIcon />
                                  </button>
                                )}
                              </span>
                              )}
                              {flagCols.video && (
                              <span className="rd-flag-slot">
                                {video && videoIn(r.id) && (
                                  <button
                                    type="button"
                                    className={`rd-flag video ${video.state}`}
                                    onClick={() => setDlg({ kind: "video", rowId: r.id })}
                                    title={video.state === "in" ? `${firstName}'s ${video.media} is in · ${video.media === "photo" ? "look" : "watch"} and reply` : `Their ${video.media} · replied`}
                                    aria-label={video.state === "in" ? `${video.media === "photo" ? "See" : "Watch"} ${firstName}'s ${video.media}` : `Their ${video.media}, replied`}
                                  >
                                    {video.media === "photo" ? <PhotoIcon /> : <VideoIcon />}
                                  </button>
                                )}
                              </span>
                              )}
                              {flagCols.extra && (
                              <span className="rd-flag-slot">
                                {extraOf(r) > 0 && (
                                  <span className="rd-extradot static" title={`${firstName} added ${extraOf(r)} extra set${extraOf(r) === 1 ? "" : "s"}: ${r.sets} prescribed, ${r.sets + extraOf(r)} done`} aria-label={`${extraOf(r)} extra set${extraOf(r) === 1 ? "" : "s"}`}>
                                    +{extraOf(r)}
                                  </span>
                                )}
                              </span>
                              )}
                              {flagCols.swap && (
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
                              )}
                            </span>
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${r.name}`}>
                                <MoreIcon />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="pb-menu">
                                <DropdownMenuItem onSelect={() => setDlg({ kind: "video", rowId: r.id })}>
                                  {video?.media === "photo" && video.state !== "asked" ? <PhotoIcon /> : <VideoIcon />}
                                  {!video ? "Ask for a video" : video.state === "asked" ? `Video asked for · waiting${video.recurring ? " · every session" : ""}` : video.media === "photo" ? (video.state === "in" ? "See their photo · reply" : "Their photo · replied") : video.state === "in" ? "Watch their video · reply" : "Their video · replied"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDlg({ kind: "demo", rowId: r.id })}>
                                  <PlayIcon /> {(demos[r.id] === undefined ? r.demo : demos[r.id]) ? "Demo video · change" : "Add demo"}
                                </DropdownMenuItem>
                                {/* The exercise has a demo, but this client needs no guidance on it: keep it off this row (and the weeks after). */}
                                {r.id > 0 && (demos[r.id] === undefined ? r.demo : demos[r.id]) && (
                                  <DropdownMenuItem onSelect={() => act(() => setRowDemoHiddenAction(r.id, !r.demoHidden), r.demoHidden ? `Demo back on for ${firstName}` : `Demo hidden from ${firstName} on ${r.name}`)}>
                                    <EyeIcon /> {r.demoHidden ? "Show the demo again" : `Hide the demo from ${firstName}`}
                                  </DropdownMenuItem>
                                )}
                                {/* Which of the exercise's variations (close grip…) this row asks for, from the Library; a new one can be made here too. */}
                                {r.id > 0 &&
                                  (() => {
                                    const variations = library.flatMap((g) => g.exercises).find((e) => e.id === r.exerciseId)?.variations ?? [];
                                    const current = variations.find((v) => v.id === r.variationId) ?? null;
                                    const base = current ? r.name.slice(0, -(current.name.length + 3)) : r.name;
                                    const pickVariation = (id: number | null) => act(() => setRowVariationAction(r.id, id), `${base}${id != null ? ` · ${variations.find((v) => v.id === id)?.name}` : ""} · ${firstName} sees it from this week`);
                                    return (
                                      <DropdownMenuItem onSelect={() => setDlg({ kind: "variation", rowId: r.id })}>
                                        <ColumnsIcon /> Variation · {current ? current.name : "standard"}
                                      </DropdownMenuItem>
                                    );
                                  })()}
                                <DropdownMenuItem onSelect={() => setDlg({ kind: "alternatives", rowId: r.id })}>
                                  <DumbbellIcon /> {(() => {
                                    const n = r.alternatives.length || r.librarySubstitutes.filter((s) => !r.libraryHidden.includes(s.exerciseId)).length;
                                    return n ? `Substitutes · ${n}${r.alternatives.length ? " · this session" : ""}` : "Substitutes";
                                  })()}
                                </DropdownMenuItem>
                                {/* Only once the programme is live: before that the client has nothing of it to talk about. */}
                                {program.status === "live" && (
                                  <DropdownMenuItem onSelect={() => replyTo(`${r.name} · ${name}, ${week.label}`, { kind: "exercise", dayId: s.id, assignmentId: r.id })}>
                                    <ChatIcon /> Message {firstName} about it
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "removeRow", sessionId: s.id, rowId: r.id })}>
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
                        {/* The messages about this exercise, opened under it. */}
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
                          <small>New</small>
                        </span>
                        {cols.sets && <Cell value={String(r.sets)} onChange={(v) => editAdded({ sets: v })} label="Sets" width="sm" />}
                        {cols.weight && <WeightCell key={unit} kg={r.kg} lbs={lbs} onChange={(v) => editAdded({ kg: v })} />}
                        {cols.reps && <Cell value={r.reps} onChange={(v) => editAdded({ reps: v })} label="Reps" />}
                        {cols.rpe && <Cell value={r.rpe ?? ""} onChange={(v) => editAdded({ rpe: v })} label="RPE" width="sm" />}
                        {cols.tempo && <Cell value={r.tempo ?? ""} onChange={(v) => editAdded({ tempo: v })} label="Tempo" />}
                        {cols.rest && <Cell value={r.rest ?? ""} onChange={(v) => editAdded({ rest: v })} label="Rest" />}
                        <span className="rd-cell rd-notecol">
                          <input className="rd-cell-box" value={r.note ?? ""} onChange={(ev) => editAdded({ note: ev.target.value })} placeholder="Add a note" aria-label={`Note on ${r.name}`} maxLength={300} />
                        </span>
                        <span className="rd-did">
                          <em />
                        </span>
                        <span />
                        <span />
                        <span className="rd-row-more">
                          <button type="button" className="rd-btn ghost sm" onClick={() => patch(s.id, (q) => ({ ...q, added: q.added.filter((x) => x.key !== r.key) }))} aria-label={`Take ${r.name} off`} title="Take it off">
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
                                {/* The client did something else instead (the bike was taken). */}
                                {c.swap && <span className="rd-cardio-swap">Did {c.swap} instead</span>}
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
                                {/* What the client can do instead when the machine is taken. */}
                                <button type="button" className="rd-btn ghost sm rd-cardio-alt" onClick={() => setDlg({ kind: "cardioAlternatives", sessionId: s.id, cardioId: c.id })} title={c.alternatives?.length ? `Alternatives · ${c.alternatives.length}` : "Add alternative"} aria-label={`Alternatives for ${c.name}`}>
                                  <DumbbellIcon />
                                  {c.alternatives?.length ? <b>{c.alternatives.length}</b> : null}
                                </button>
                                <button type="button" className="rd-btn ghost sm" onClick={() => setDlg({ kind: "removeCardio", sessionId: s.id, cardioId: c.id })} aria-label={`Remove ${c.name}`} title="Remove from session">
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
                                <small>New</small>
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
                                <button type="button" className="rd-btn ghost sm" onClick={() => patch(s.id, (q) => ({ ...q, added: q.added.filter((x) => x.key !== r.key) }))} aria-label={`Take ${r.name} off`} title="Take it off">
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
                      <AddExerciseRow library={library} onPick={(nm, exerciseId) => patch(s.id, (q) => ({ ...q, added: [...q.added, { key: Date.now() + Math.random(), kind: "exercise", exerciseId, name: nm, sets: "", reps: "", kg: null, ...(cueOf(exerciseId) ? { note: cueOf(exerciseId) } : {}) }] }))} onClose={() => setAdding(null)} />
                    ) : (
                      <AddCardioRow
                        moves={cardioMoves}
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
                      {!complete && (
                        <button type="button" className="rd-btn ghost wide" onClick={() => setAdding({ session: s.id, kind: "exercise" })}>
                          <PlusIcon /> Exercise
                        </button>
                      )}
                      <button type="button" className="rd-btn ghost wide" onClick={() => setAdding({ session: s.id, kind: "cardio" })}>
                        <PlusIcon /> Cardio
                      </button>
                    </div>
                  )}

                </div>
              )}
              </>
              )}
            </SortableItem>
          );
        })}
        </SortableList>
        {Array.from({ length: incoming }, (_, i) => (
          <section key={`incoming-${i}`} className="rd-session trn-incoming" aria-busy="true">
            <div className="rd-session-head trn-row">
              <span className="rd-grip trn-grip" aria-hidden="true">
                <GripIcon />
              </span>
              <span className="trn-row-name">
                <b>Session {sessions.length + i + 1}</b>
                <small>0 exercises</small>
              </span>
            </div>
          </section>
        ))}
        {sessions.length + incoming < MAX_SESSIONS ? (
          <button
            type="button"
            className="trn-add"
            onClick={() => {
              const n = sessions.length + incoming + 1;
              setIncoming((k) => k + 1);
              act(async () => {
                try {
                  const r: unknown = await addSessionAction(fd({ clientId, week: weekNo(viewIdx) }));
                  // Refused: the placeholder goes; act says why.
                  if ((r && typeof r === "object" && "ok" in r && (r as { ok: boolean }).ok === false) || (typeof r === "string" && r)) setIncoming(0);
                  return r;
                } catch (e) {
                  setIncoming(0);
                  throw e;
                }
              }, `Session ${n} added`);
            }}
          >
            + Add session
          </button>
        ) : (
          <p className="rd-full trn-full">{MAX_SESSIONS} sessions is the most a week can hold.</p>
        )}
      </div>

      {/* The client's own workouts this week, off the plan (19 Oct): read only, slim rows under the week's card. */}
      <RogueSessions items={program.rogue[viewIdx] ?? []} firstName={firstName} grid={colStyle} cols={cols} unit={unit} minW={tableMinW} kgOf={(kg) => (kg == null ? null : half(lbs ? kg * LB : kg))} />

      {/* ---- What the client rates as a workout ends, and what they answered (was the workout questionnaire). */}
      <AfterWorkoutCheck
        programId={program.id}
        firstName={firstName}
        questions={program.workoutQuestions}
        answers={program.answersFeed}
        href={(it) => `/admin/redesign/training?client=${clientId}&tab=training&program=${program.id}&week=${it.weekIdx}#session-${it.dayId}`}
      />

      {/* ---- Dialogs. One open at a time. */}
      <Dialog open={dlg != null} onOpenChange={(o) => !o && close()}>
        {dlg?.kind === "progress" && rowById(dlg.rowId) && (
          (() => {
            const row = rowById(dlg.rowId)!;
            const session = sessions.find((x) => x.rows.some((r) => r.id === row.id));
            return (
              <ExerciseProgressDialog
                exerciseName={row.name}
                firstName={firstName}
                targets={{ sets: row.sets, reps: row.reps, kg: row.kg, rpe: row.rpe }}
                gyms={[...gyms].sort((a, b) => Number(b.home) - Number(a.home)).map((g) => g.name)}
                sessions={row.history
                  .filter((h) => h.sets.some((x) => x.kg != null && x.reps != null))
                  .map((h) => ({ date: h.date, planWeek: h.week, gym: h.gym, sets: h.sets.filter((x) => x.kg != null && x.reps != null).map((x) => ({ weight: x.kg!, reps: x.reps!, rpe: x.rpe })) }))}
                today={today}
                lbs={lbs}
                onMessage={(draft) => {
                  close();
                  replyTo(`${row.name} · ${session?.name ?? "Session"}, ${week.label}`, { kind: "exercise", dayId: session?.id ?? 0, assignmentId: row.id }, null, draft);
                }}
                onClose={close}
              />
            );
          })()
        )}

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

        {dlg?.kind === "cardioAlternatives" && sessionById(dlg.sessionId)?.cardio.find((c) => c.id === dlg.cardioId) && (
          <CardioAlternativesDialog
            cardio={sessionById(dlg.sessionId)!.cardio.find((c) => c.id === dlg.cardioId)!}
            firstName={firstName}
            onSave={(list) => {
              const c = sessionById(dlg.sessionId)!.cardio.find((x) => x.id === dlg.cardioId)!;
              close();
              act(() => setCardioAlternativesAction(c.id, list), list.length ? `${list.length} alternative${list.length === 1 ? "" : "s"} for ${c.name}` : `Alternatives taken off ${c.name}`);
            }}
          />
        )}

        {dlg?.kind === "alternatives" && rowById(dlg.rowId) && (
          <SessionSubstitutesDialog
            row={rowById(dlg.rowId)!}
            firstName={firstName}
            session={sessions.find((s) => s.rows.some((r) => r.id === dlg.rowId))?.name ?? "Session"}
            library={library}
            onSave={async (list, hidden) => {
              const row = rowById(dlg.rowId)!;
              const session = sessions.find((s) => s.rows.some((r) => r.id === row.id))?.name ?? "this session";
              // A session's own picks replace the library's (15 Oct); an empty list means the library's are offered.
              await setExerciseAlternativesAction(row.id, list.map((x) => ({ exerciseId: x.exerciseId, note: x.note })), list.length > 0, hidden);
              close();
              router.refresh();
              toast.success(`Substitutes saved for ${session}`);
            }}
            onClose={close}
          />
        )}

        {dlg?.kind === "demo" && rowById(dlg.rowId) && (
          <DemoVideoDialog
            exerciseName={rowById(dlg.rowId)!.name}
            clientsUsing={rowById(dlg.rowId)!.demoClients ?? 1}
            current={demos[dlg.rowId] === undefined ? rowById(dlg.rowId)!.demo : demos[dlg.rowId]}
            videos={coachVideos}
            onClose={close}
            onLink={async (url) => {
              const row = rowById(dlg.rowId)!;
              await setExerciseDemoLinkAction(fd({ exerciseId: row.exerciseId, variationId: row.variationId ?? null, demoUrl: url }));
              setDemos((d) => ({ ...d, [row.id]: { url, source: "library" } }));
              close();
              toast.success(`Demo updated${(row.demoClients ?? 1) > 1 ? ` for ${row.demoClients} clients` : ""}`);
              router.refresh();
            }}
            onUpload={async (file) => {
              const row = rowById(dlg.rowId)!;
              const f = new FormData();
              f.set("exerciseId", String(row.exerciseId));
              if (row.variationId != null) f.set("variationId", String(row.variationId));
              f.set("file", file);
              await uploadExerciseVideoAction(f);
              close();
              toast.success(`Demo updated${(row.demoClients ?? 1) > 1 ? ` for ${row.demoClients} clients` : ""}`);
              router.refresh();
            }}
            onRemove={async () => {
              const row = rowById(dlg.rowId)!;
              await clearExerciseDemoAction(fd({ exerciseId: row.exerciseId, variationId: row.variationId ?? null }));
              setDemos((d) => ({ ...d, [row.id]: null }));
              router.refresh();
            }}
          />
        )}

        {/* A photo or video that came in: the media review (12 Oct), one modal for all of them. */}
        {dlg?.kind === "video" && rowById(dlg.rowId) && reviewable(videos[dlg.rowId]) && (
          <MediaReviewModal
            key={`${dlg.rowId}-${videos[dlg.rowId]!.requestId}`}
            review={reviewOf(rowById(dlg.rowId)!, videos[dlg.rowId]!, sessions.find((s) => s.rows.some((r) => r.id === dlg.rowId)) ?? null, viewIdx, firstName, (kg) => `${kgOf(kg, lbs)} ${unit}`)}
            onClose={close}
          />
        )}
        {/* Asking for a video, or editing the ask (15 Oct, AskVideoDialog): no request yet, or one still unanswered that the coach made. */}
        {dlg?.kind === "video" && rowById(dlg.rowId) && (!videos[dlg.rowId] || (videos[dlg.rowId]!.state === "asked" && !videos[dlg.rowId]!.fromClient)) && (
          <AskVideoDialog
            firstName={firstName}
            exerciseName={rowById(dlg.rowId)!.swap ?? rowById(dlg.rowId)!.name}
            session={sessions.find((s) => s.rows.some((r) => r.id === dlg.rowId))?.name ?? "Session"}
            week={week.index}
            targets={[rowById(dlg.rowId)!.reps ? `${rowById(dlg.rowId)!.sets} × ${rowById(dlg.rowId)!.reps}` : rowById(dlg.rowId)!.sets ? `${rowById(dlg.rowId)!.sets} sets` : "", rowById(dlg.rowId)!.rpe != null ? `RPE ${rowById(dlg.rowId)!.rpe}` : ""].filter(Boolean).join(" · ")}
            existing={videos[dlg.rowId] ? { note: videos[dlg.rowId]!.note ?? "", recurring: !!videos[dlg.rowId]!.recurring } : null}
            onAsk={async (note, recurring) => {
              const rowId = dlg.rowId;
              const session = sessions.find((s) => s.rows.some((r) => r.id === rowId))?.name ?? "Session";
              await requestExerciseVideoAction(rowId, note, recurring);
              close();
              router.refresh();
              toast.success(recurring ? `Asked ${firstName} for a video, every ${session} session` : `Asked ${firstName} for a video`);
            }}
            onWithdraw={
              videos[dlg.rowId]
                ? () => {
                    const v = videos[dlg.rowId]!;
                    close();
                    act(() => removeVideoRequestAction(v.requestId), "Request withdrawn");
                  }
                : undefined
            }
            onClose={close}
          />
        )}
        {dlg?.kind === "video" && rowById(dlg.rowId) && videos[dlg.rowId] && !(videos[dlg.rowId]!.state === "asked" && !videos[dlg.rowId]!.fromClient) && !reviewable(videos[dlg.rowId]) && (
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
              act(async () => (await settle([src.id]), copyProgramDayAction(fd({ fromDayId: src.id, toDayId: to === "new" ? "new" : to, applyToRemainingWeeks: also ? "1" : null }))), to === "new" ? `Added as Session ${n}${also && laterLabel ? `, and in ${laterLabel}` : ""}` : `Replaced ${target?.name ?? "session"}${also && laterLabel ? `, and in ${laterLabel}` : ""}`);
            }}
          />
        )}

        {dlg?.kind === "applyLater" && sessionById(dlg.sessionId) && (
          <ConfirmDialog
            title={`Apply ${sessionById(dlg.sessionId)!.name} to ${laterLabel}`}
            description={`${sessionById(dlg.sessionId)!.name} in each of those weeks becomes what it is in ${week.label}: its ${sessionById(dlg.sessionId)!.rows.length} ${sessionById(dlg.sessionId)!.rows.length === 1 ? "exercise" : "exercises"}${sessionById(dlg.sessionId)!.cardio.length ? " and cardio" : ""}. Anything the client logged on those sessions goes with them.`}
            confirm="Apply"
            onConfirm={() => {
              const src = sessionById(dlg.sessionId)!;
              close();
              act(async () => (await settle([src.id]), applyDayToLaterWeeksAction(src.id)), `${src.name} applied to ${laterLabel}`);
            }}
          />
        )}

        {dlg?.kind === "copyForward" && forwardTo.length > 0 && (
          <ConfirmDialog
            title={`Copy ${week.label} to ${forwardLabel}?`}
            // Said plainly (20 Oct, Alex: "what does this mean?").
            description={`${forwardLabel.charAt(0).toUpperCase()}${forwardLabel.slice(1)} ${forwardTo.length === 1 ? "becomes" : "become"} ${week.label}, cardio included. Sessions with logged sets stay as they are.`}
            confirm="Copy"
            onConfirm={() => {
              const from = weekNo(viewIdx);
              const targets = forwardTo.map((w) => weekNo(w.index));
              const label = week.label;
              const toWords = forwardLabel;
              close();
              act(async () => {
                await settle(Object.keys(pendingRef.current).map(Number));
                for (const to of targets) await copyProgramWeekAction(fd({ clientId, fromWeek: from, toWeek: to }));
              }, `${label} copied to ${toWords}`);
            }}
          />
        )}
        {dlg?.kind === "copyWeek" && (
          <ConfirmDialog
            title={`Copy Week ${dlg.from} here`}
            description={`This week becomes Week ${dlg.from}, cardio included. Sessions with logged sets stay as they are.`}
            confirm="Copy week"
            tick={laterLabel ? "Also apply to the rest of the programme" : null}
            onConfirm={(also) => {
              const from = weekNo(dlg.from);
              const targets = also ? weeks.filter((w) => w.index >= viewIdx).map((w) => weekNo(w.index)) : [weekNo(viewIdx)];
              close();
              act(async () => {
                await settle(Object.keys(pendingRef.current).map(Number));
                for (const to of targets) await copyProgramWeekAction(fd({ clientId, fromWeek: from, toWeek: to }));
              }, `Week ${dlg.from} copied to ${week.label}${also ? ` and ${laterLabel}` : ""}`);
            }}
          />
        )}

        {/* Which variation the client does on this session (15 Oct, VariationDialog): Standard or one from the library, from which week; a new one made inline; one deleted. */}
        {dlg?.kind === "variation" && rowById(dlg.rowId) && (
          (() => {
            const row = rowById(dlg.rowId)!;
            const ex = library.flatMap((g) => g.exercises).find((e) => e.id === row.exerciseId);
            const variations = ex?.variations ?? [];
            const current = variations.find((v) => v.id === row.variationId) ?? null;
            const base = current ? row.name.slice(0, -(current.name.length + 3)) : row.name;
            const session = sessions.find((x) => x.rows.some((r) => r.id === row.id))?.name ?? "Session";
            const lastOf = (id: number | null) => row.variationLast.find((x) => x.variationId === id) ?? null;
            const options = [{ variationId: null as number | null, name: "Standard", video: ex?.video ?? null, last: lastOf(null) }, ...variations.map((v) => ({ variationId: v.id as number | null, name: v.name, video: v.video ?? null, last: lastOf(v.id) }))];
            return (
              <VariationDialog
                firstName={firstName}
                exerciseName={base}
                group={ex?.group ?? null}
                session={session}
                week={week.index}
                lbs={lbs}
                current={row.variationId ?? null}
                options={options}
                onSave={async (variationId, scope) => {
                  await setRowVariationAction(row.id, variationId, scope);
                  close();
                  router.refresh();
                  const name = options.find((o) => o.variationId === variationId)?.name ?? "Standard";
                  toast.success(scope === "from" ? `${firstName} on ${name} from Week ${week.index}` : scope === "just" ? `${firstName} on ${name} for Week ${week.index}` : `${firstName} on ${name} for the whole programme`);
                }}
                onCreate={async (name) => {
                  const made = await addExerciseVariationAction(row.exerciseId, name);
                  router.refresh();
                  return made ? { variationId: made.id, name: made.name, video: null, last: null } : null;
                }}
                onDelete={async (variationId) => {
                  await removeExerciseVariationAction(row.exerciseId, variationId);
                  router.refresh();
                }}
                onClose={close}
              />
            );
          })()
        )}
        {/* Taking an exercise or a cardio off a session asks first (20 Oct, Alex), in the delete pop-up's style. */}
        {dlg?.kind === "removeRow" && rowById(dlg.rowId) && <RemoveDialog {...removeRowCopy(rowById(dlg.rowId)!)} onRemove={() => takeOff(dlg.sessionId, { row: dlg.rowId })} onClose={close} />}
        {dlg?.kind === "removeCardio" && sessionById(dlg.sessionId)?.cardio.find((c) => c.id === dlg.cardioId) && (
          <RemoveDialog {...removeCardioCopy(sessionById(dlg.sessionId)!.cardio.find((c) => c.id === dlg.cardioId)!)} onRemove={() => takeOff(dlg.sessionId, { cardio: dlg.cardioId })} onClose={close} />
        )}
        {dlg?.kind === "deleteSession" && sessionById(dlg.sessionId) && (
          (() => {
            const gone = sessionById(dlg.sessionId)!;
            return (
              <DeleteSessionDialog
                number={gone.number}
                name={/^Session \d+$/.test(gone.name) ? null : gone.name}
                programme={program.name}
                firstName={firstName}
                exercises={gone.rows.length}
                cardioBlocks={gone.cardio.length}
                loggedSets={gone.setsLogged}
                lastLoggedAt={gone.ended}
                hasUploads={gone.rows.some((r) => !!r.video?.src)}
                sessionsAfter={sessions.filter((x) => x.number > gone.number).map((x) => x.number)}
                // Only the later weeks that have this session, unlogged (20 Oct, Alex); none, and there is no tick.
                laterLabel={weeksWords(gone.laterWeeks ?? [])}
                onDelete={async (alsoLater) => {
                  const more = await removeSessionAction(fd({ programDayId: gone.id, alsoLater: alsoLater ? 1 : null }));
                  close();
                  router.refresh();
                  toast.success(`${gone.name} deleted${more ? ` here and from ${more} later ${more === 1 ? "week" : "weeks"}` : ""}`);
                }}
                onClose={close}
              />
            );
          })()
        )}

        {dlg?.kind === "removeWeek" && (
          <ConfirmDialog
            title={`Remove ${week.label}`}
            description={[sessions.length ? `${sessions.length} ${sessions.length === 1 ? "session goes" : "sessions go"} with it.` : "It's empty.", viewIdx < weeks.length ? "The weeks after move up." : ""].filter(Boolean).join(" ")}
            confirm="Remove week"
            danger
            onConfirm={() => {
              const idx = viewIdx;
              const label = week.label;
              close();
              startTransition(async () => {
                await removeProgramWeekAction(fd({ clientId, programId: program.id, week: idx }));
                savedToast(`${label} removed`);
                router.push(`${window.location.pathname}?client=${clientId}&tab=training&program=${program.id}&week=${Math.max(1, idx - 1)}`, { scroll: false });
              });
            }}
          />
        )}

        {dlg?.kind === "deletePhase" && program.phaseId != null && (
          (() => {
            // The phase is its programme (20 Oct, Alex): both go. Sessions the client trained go too, so that needs a tick.
            const logged = weeks.reduce((t, w) => t + w.trained.filter(Boolean).length + w.missed.filter(Boolean).length, 0);
            return (
              <DeletePhaseDialog
                name={program.name}
                logged={logged}
                firstName={firstName}
                onDelete={() => {
                  const id = program.phaseId!;
                  close();
                  startTransition(async () => {
                    await deletePhaseAction(id);
                    savedToast(`${program.name} deleted`);
                    router.push(`${window.location.pathname}?client=${clientId}&tab=training`, { scroll: false });
                  });
                }}
                onClose={close}
              />
            );
          })()
        )}

        {/* Scheduling is not editing dates (20 Oct, Alex): the week it starts and the time it goes live; the length stays as built. */}
        {dlg?.kind === "deploy" && program.status === "draft" && !startHasCome && (
          <ScheduleDialog
            name={program.name}
            weeks={weeks.length}
            start={program.startDate}
            today={program.planCtx.today}
            others={program.planCtx.phases.filter((p) => p.track === "training" && p.id !== program.phaseId && !p.draft && p.program?.status !== "draft").map((p) => ({ name: p.name, from: p.start_week, to: addDays(p.end_week, 6) }))}
            onClose={close}
            onSchedule={(v) => {
              close();
              act(async () => {
                if (program.phaseId) await updateClientPhaseAction(fd({ id: program.phaseId, track: "training", name: program.name, start: v.start, end: v.end }));
                await scheduleProgramDeployAction(fd({ programId: program.id, date: v.start, time: v.time }));
              }, `${program.name} goes live ${fmtDate(v.start)} at ${v.time}`);
            }}
          />
        )}
        {dlg?.kind === "deploy" && !(program.status === "draft" && !startHasCome) && (
          <ConfirmDialog
            title={program.status === "scheduled" ? "Make it live now" : startHasCome ? "Make it live" : "Schedule it"}
            description={
              program.status === "scheduled"
                ? `Live this week instead of ${program.startDate ? fmtDate(program.startDate) : "its start"}.`
                : startHasCome
                  ? "Live this week."
                  : `Goes out on ${program.startDate ? fmtDate(program.startDate) : "its start date"}.`
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
            description={`${program.name} stops being scheduled.`}
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
                // A new end (typed, or + 1 week) is a new length: the programme gains or loses weeks.
                if (program.phaseId) await updateClientPhaseAction(fd({ id: program.phaseId, track: "training", name: v.name || program.name, start: v.start, end: v.end, adjustProgram: v.weeks !== weeks.length ? "1" : null }));
              }, `${v.name || program.name}: ${fmtDate(v.start)} – ${fmtDate(v.end)}`);
            }}
          />
        )}

        {dlg?.kind === "gyms" && (
          <ClientGymsDialog
            firstName={firstName}
            gyms={gyms}
            today={today}
            onAdd={async (nm) => {
              const made = await addGymAction(clientId, nm);
              router.refresh();
              return made ? { id: made.id, name: made.name, home: gyms.length === 0, color: "#1d3466", rgb: "29,52,102", sessions8w: 0, lastSessionAt: null } : null;
            }}
            onHome={async (id) => {
              await setHomeGymAction(id);
              router.refresh();
            }}
            onRemove={async (id) => {
              await removeGymAction(id);
              router.refresh();
            }}
            onClose={close}
          />
        )}

        {/* The Plan tab's New phase dialog, here too (10 Oct): a training phase with its programme, new or one waiting. */}
        {dlg?.kind === "newProgram" && (
          <PhaseDialog
            clientId={clientId}
            firstName={firstName}
            today={program.planCtx.today}
            thisWeek={program.planCtx.thisWeek}
            phase={null}
            track="training"
            lockTrack
            others={program.planCtx.phases}
            programs={program.planCtx.programs}
            onSave={(v) => {
              close();
              startTransition(async () => {
                const made = await addClientPhaseAction(planPhaseForm({ clientId, ...v }));
                savedToast(`${v.name} drafted: ${v.programId ? "on its programme" : "a new programme"}`);
                if (made?.programId) router.push(`${window.location.pathname}?client=${clientId}&tab=training&program=${made.programId}&week=1`, { scroll: false });
                else router.refresh();
              });
            }}
            onSend={() => {}}
          />
        )}

        {dlg?.kind === "note" && program.note && (
          <NoteDialog
            firstName={firstName}
            note={program.note}
            onSeen={() => {
              close();
            }}
          />
        )}
      </Dialog>

    </div>
  );
}

// ---- Small parts -------------------------------------------------------------

/** The word on a session's state pill, for sizing its column: "" when it has none. */

export const stateLabel = (s: string) => (s === "live" ? "Live" : s === "past" ? "Past" : s === "scheduled" ? "Scheduled" : "Draft");
/** A date in words is day/month (20 Oct, Alex: "starts 9/11", not "9 Nov"); a year only when it isn't this one. Training, Nutrition and Lifestyle headers share it. */
export const fmtDate = (iso: string) => dayMonth(iso.slice(0, 10));

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
      // As wide as the name, so what follows it doesn't move while it is typed (20 Oct, Alex).
      size={Math.max(draft.length, 6)}
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

/** Deleting a phase and its programme: what goes, and a tick when the client's logged sessions go with it. */
export function DeletePhaseDialog({ name, logged, firstName, onDelete, onClose }: { name: string; logged: number; firstName: string; onDelete: () => void; onClose: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
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
        <DialogTitle className="dlh-title">Delete {name}?</DialogTitle>
        <button type="button" className="dlh-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {/* Not what goes, just that it is for good (20 Oct, Alex). */}
      <DialogDescription className="dlh-what">This permanently deletes the phase. It can&rsquo;t be undone.</DialogDescription>
      {logged > 0 && (
        <>
          <button type="button" role="checkbox" aria-checked={agreed} className="dlh-ack" onClick={() => setAgreed((x) => !x)}>
            <span className={`dlh-box${agreed ? " on" : ""}`} aria-hidden="true">
              {agreed ? "✓" : ""}
            </span>
            Delete {firstName}&rsquo;s logged sessions too
          </button>
        </>
      )}
      <div className="dlh-foot">
        <button ref={cancel} type="button" className="dlh-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="dlh-delete" disabled={logged > 0 && !agreed} onClick={onDelete}>
          Delete
        </button>
      </div>
    </DialogContent>
  );
}

/** Taking a row off a session, in the delete pop-up's style: the title, one line of what it is, the logged sets in red when there are any. Cancel holds the focus. */
function RemoveDialog({ title, what, warn, onRemove, onClose }: { title: string; what: string; warn: string | null; onRemove: () => void; onClose: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
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
        <DialogTitle className="dlh-title">{title}</DialogTitle>
        <button type="button" className="dlh-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <DialogDescription className="dlh-what">{what}</DialogDescription>
      {warn && <p className="dlh-warn">{warn}</p>}
      <div className="dlh-foot">
        <button ref={cancel} type="button" className="dlh-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="dlh-delete" onClick={onRemove}>
          Remove
        </button>
      </div>
    </DialogContent>
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
  const show = (v: number | null) => (v == null ? "" : String(half(lbs ? v * LB : v)));
  const [text, setText] = useState(show(kg));
  // A new saved figure (a page read after a save) shows, unless the box is being typed in.
  const [seenKg, setSeenKg] = useState(kg);
  const [focused, setFocused] = useState(false);
  if (kg !== seenKg && !focused) {
    setSeenKg(kg);
    setText(show(kg));
  }
  return (
    <span className="rd-cell">
      {label && <small>{label}</small>}
      <input
        className="rd-cell-box"
        value={text}
        placeholder={lbs ? "lbs" : "kg"}
        aria-label={label ? `Weight at ${label}` : "Weight"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value.replace(",", "."));
          onChange(Number.isFinite(n) ? Math.round((lbs ? n / LB : n) * 10000) / 10000 : null);
        }}
      />
    </span>
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
  const matches = needle ? library.flatMap((g) => g.exercises.filter((e) => e.name.toLowerCase().includes(needle)).map((e) => ({ id: e.id, name: e.name, group: g.label }))) : [];
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
  // The list floats over the page under the bar (20 Oct, Alex): it no longer
  // stretches the session, six rows show and the rest scroll, and Create
  // stays pinned at its foot. In a layer of its own, so the session's
  // sideways-scrolling table can't clip it.
  const open = !creating && (showGroups || (!!group && !needle) || !!needle);
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pop.current?.querySelector(".rd-addrow-item.on")?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);
  return (
    <div ref={wrap} className="rd-addrow">
      <Popover open={open} onOpenChange={() => {}}>
        <PopoverAnchor asChild>
          <div className={`rd-addrow-bar${open ? " open" : ""}`}>
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
        </PopoverAnchor>
        <PopoverContent
          ref={pop}
          className="rd-addpop"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          // The bar is outside the panel; a click in it is not a click away.
          onInteractOutside={(e) => {
            if (wrap.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          {showGroups && (
            <>
              <div className="rd-addpop-scroll" role="listbox" aria-label="Groups">
                {library.map((g) => (
                  <button key={g.slug} type="button" role="option" aria-selected={false} className="rd-addrow-item" onClick={() => setGroup(g.slug)}>
                    {g.label}
                    <small>{g.exercises.length}</small>
                  </button>
                ))}
              </div>
              <button type="button" className="rd-addrow-item create" onClick={() => setCreating(true)}>
                <PlusIcon /> Create your own exercise
              </button>
            </>
          )}
          {group && !needle && (
            <>
              <button type="button" className="rd-addrow-back" onClick={() => setGroup(null)}>
                ‹ All groups
              </button>
              <div className="rd-addpop-scroll" role="listbox" aria-label={library.find((g) => g.slug === group)?.label}>
                {list.map((m, i) => (
                  <button key={m.id} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}`} onMouseEnter={() => setCursor(i)} onClick={() => pick(m.name)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {needle && (
            <>
              {list.length > 0 && (
                <div className="rd-addpop-scroll" role="listbox" aria-label="Exercises">
                  {list.map((m, i) => (
                    <button key={m.id} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}`} onMouseEnter={() => setCursor(i)} onClick={() => pick(m.name)}>
                      {m.name}
                      {m.group && <small>{m.group}</small>}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className={`rd-addrow-item create${list.length === 0 ? " on solo" : ""}`} onClick={() => setCreating(true)}>
                <PlusIcon /> Create &ldquo;{q.trim()}&rdquo; as your own exercise
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
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

/** Editing an exercise row: replace the exercise from the library (search, or
 *  the chevron to browse group by group, or create your own).
 *  "Replace", not "swap": a swap is the client doing something else for a session. */
function EditExerciseDialog({ row, current, library, onSave }: { row: DraftRow; current: Edits; library: Library; onSave: (v: { name?: string }) => void }) {
  const [name, setName] = useState(current.name ?? row.name);
  const [replacing, setReplacing] = useState(true);
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>Edit {row.name}</DialogTitle>
        <DialogDescription>Replace the exercise in the programme{row.logged.length ? " · what the client logged stays" : ""}.</DialogDescription>
      </DialogHeader>
      <div className="rd-field">
        <span>Exercise</span>
        <span className="rd-about">{name}</span>
      </div>
      {replacing ? (
        <div className="rd-field">
          <span>Replace with</span>
          <AddExerciseRow library={library} onPick={(n) => setName(n)} onClose={() => setReplacing(false)} />
        </div>
      ) : (
        <button type="button" className="rd-btn rd-alt-add" onClick={() => setReplacing(true)}>
          Replace exercise
        </button>
      )}
      <DialogFooter>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" onClick={() => onSave(name !== row.name ? { name } : {})}>
          Save
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

/** What the client can do instead when the machine is taken: exercises from
 *  the library (the add-exercise search), each with an optional note. Saved
 *  on this session for the rest of the programme. */
/**
 * What the client answered on ending each workout, one row a workout, newest
 * first, laid out like the Measurements check-in log: the day, the session,
 * the answers in a line, the time it took; open a row for the answers as
 * tiles and the client's note, and a link to that session in its week.
 */
/** Alternatives for a cardio: names (cardio is typed, not picked from the library), each with an optional note. */
function CardioAlternativesDialog({ cardio, firstName, onSave }: { cardio: DraftCardio; firstName: string; onSave: (list: { name: string; note: string }[]) => void }) {
  const [list, setList] = useState(cardio.alternatives ?? []);
  const [draft, setDraft] = useState("");
  const add = () => {
    const name = draft.trim();
    if (name && name.toLowerCase() !== cardio.name.trim().toLowerCase() && !list.some((x) => x.name.toLowerCase() === name.toLowerCase())) setList((l) => [...l, { name, note: "" }]);
    setDraft("");
  };
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>Alternatives for {cardio.name}</DialogTitle>
        <DialogDescription>What {firstName} can do instead when the machine is taken. They pick one from &ldquo;Substitute today&rdquo; in their workout, and it counts as done.</DialogDescription>
      </DialogHeader>
      {list.length > 0 && (
        <ul className="rd-alt-list">
          {list.map((x, i) => (
            <li key={x.name} className="rd-alt-row">
              <span className="rd-alt-name">{x.name}</span>
              <input className="rd-input" value={x.note} onChange={(e) => setList((l) => l.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))} placeholder="Note · optional, e.g. same time, keep it easy" maxLength={200} />
              <button type="button" className="rd-btn ghost sm" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label={`Remove ${x.name}`}>
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {list.length < 8 && (
        <div className="rd-alt-type">
          <input
            className="rd-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Rower, stair climber, incline walk…"
            maxLength={60}
            autoFocus
            aria-label="An alternative"
          />
          <button type="button" className="rd-btn" onClick={add} disabled={!draft.trim()}>
            <PlusIcon /> Add
          </button>
        </div>
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
function AddCardioRow({ moves = [], onChange, onClose }: { /** The coach's cardio movements (Library), offered as the activity is typed. */ moves?: CardioMove[]; onChange: (c: Omit<AddedCardio, "kind"> | null) => void; onClose: () => void }) {
  const blank = { name: "", time: "", pace: "", incline: "", distance: "", note: "" };
  const [c, setC] = useState(blank);
  const first = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // A bare number gets its unit; anything else is kept as typed.
  const withUnit = (v: string, u: string) => (/^\s*[\d.,]+\s*$/.test(v) ? `${v.trim()}${u}` : v.trim());
  useClickAway(wrap, onClose);
  // First the activity, picked the way an exercise is (19 Oct, Alex: cardio
  // had only the browser's own suggestion list): the search bar over the
  // Library's cardio, open at once since the list is short; a name not in it
  // is used as typed. Then the numbers.
  const [picked, setPicked] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const needle = q.trim().toLowerCase();
  const list = needle ? moves.filter((m) => m.name.toLowerCase().includes(needle)) : moves;
  useEffect(() => {
    (picked ? timeRef : first).current?.focus();
  }, [picked]);
  const emit = (next: typeof blank) => {
    const any = Object.values(next).some((v) => v.trim());
    onChange(any ? { ...next, name: next.name.trim(), time: withUnit(next.time, " min"), pace: withUnit(next.pace, " km/h"), incline: withUnit(next.incline, "%"), distance: withUnit(next.distance, " km"), note: next.note.trim() } : null);
  };
  const choose = (name: string) => {
    const nm = name.trim();
    if (!nm) return;
    const move = moves.find((m) => m.name.toLowerCase() === nm.toLowerCase());
    const next = { ...c, name: move?.name ?? nm, note: c.note.trim() ? c.note : move?.cue ?? "" };
    setC(next);
    emit(next);
    setPicked(true);
  };
  // The list floats over the page under the bar, as the exercise search's does (20 Oct, Alex).
  const showList = list.length > 0 || !!needle;
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pop.current?.querySelector(".rd-addrow-item.on")?.scrollIntoView({ block: "nearest" });
  }, [cursor]);
  if (!picked) {
    return (
      <div ref={wrap} className="rd-addrow">
        <Popover open={showList} onOpenChange={() => {}}>
        <PopoverAnchor asChild>
        <div className={`rd-addrow-bar${showList ? " open" : ""}`}>
          <input
            ref={first}
            className="rd-addrow-search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((i) => Math.min(i + 1, Math.max(0, list.length - 1)));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter") choose(list[cursor]?.name ?? q);
            }}
            placeholder="Search cardio"
            aria-label="Search cardio"
          />
          <button type="button" className="rd-addrow-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        </PopoverAnchor>
        <PopoverContent
          ref={pop}
          className="rd-addpop"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (wrap.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          {list.length > 0 && (
            <div className="rd-addpop-scroll" role="listbox" aria-label="Cardio">
              {list.map((m, i) => (
                <button key={m.name} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}`} onMouseEnter={() => setCursor(i)} onClick={() => choose(m.name)}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
          {needle && !moves.some((m) => m.name.toLowerCase() === needle) && (
            <button type="button" className={`rd-addrow-item create${list.length === 0 ? " solo" : ""}`} onClick={() => choose(q)}>
              <PlusIcon /> Use &ldquo;{q.trim()}&rdquo;
            </button>
          )}
        </PopoverContent>
        </Popover>
        {!needle && moves.length === 0 && <p className="rd-addrow-hint">Type the activity, e.g. Incline walk.</p>}
      </div>
    );
  }
  const set = (k: keyof typeof c) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...c, [k]: e.target.value };
    // A movement from the library brings its default cue as the note, when none is typed yet.
    if (k === "name" && !c.note.trim()) {
      const move = moves.find((m) => m.name.toLowerCase() === next.name.trim().toLowerCase());
      if (move?.cue) next.note = move.cue;
    }
    setC(next);
    emit(next);
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
          <input value={c.name} onChange={set("name")} placeholder="Incline walk" autoComplete="off" />
        </label>
        <label>
          <span>Time (min)</span>
          <input ref={timeRef} value={c.time} onChange={set("time")} placeholder="15" inputMode="decimal" />
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
      <p className="rd-addrow-hint">Saves once you&rsquo;re done · Enter closes · Esc drops it.</p>
    </div>
  );
}

// ---- Dialogs ------------------------------------------------------------------

function reviewOf(row: DraftRow, video: NonNullable<DraftRow["video"]>, session: DraftSession | null, weekNo: number, firstName: string, weight: (kg: number | null) => string): MediaReview {
  const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);
  const thread: ThreadItem[] = [];
  // What was said about the exercise in the chat; the review's own copy there is the review below.
  for (const m of row.exerciseChat) {
    if (m.media && m.media.path === video.replySrc) continue;
    const words = m.text || (m.media ? (m.media.type === "image" ? "A photo" : m.media.type === "video" ? "A video" : "A file") : "");
    if (!words) continue;
    thread.push({ id: `c${m.id}`, kind: "text", mine: m.mine, text: words, at: m.at ?? 0 });
  }
  if (video.replySrc) {
    thread.push({ id: `r${video.requestId}`, kind: "review", url: video.replySrc, durationMs: video.replyDurationMs ?? null, annotations: video.replyAnnotations ?? null, message: video.reply, at: ms(video.repliedAt) });
  } else if (video.reply && !row.exerciseChat.some((m) => m.mine && m.text === video.reply)) {
    // A written reply from before the chat carried them.
    thread.push({ id: `n${video.requestId}`, kind: "text", mine: true, text: video.reply, at: ms(video.repliedAt) });
  }
  return {
    requestId: video.requestId,
    unseen: video.state === "in",
    client: { firstName, name: firstName, avatarPath: null },
    exercise: { name: row.name, session: session?.name ?? "Session", week: weekNo, day: session?.number ?? 1 },
    requested: !video.fromClient,
    media: [{ kind: video.media, url: video.src! }],
    sentAt: video.sentAt ?? null,
    sets: row.logged.map((l) => ({ n: l.set, label: `${weight(l.kg)} × ${l.reps ?? "—"}` })),
    clientMessage: video.clientNote ? { text: video.clientNote, at: video.sentAt ?? null } : null,
    thread: thread.sort((a, b) => a.at - b.at),
  };
}

function VideoDialog({ row, video, firstName, where, onAsk, onCancel, onReply }: { row: DraftRow; video: DraftRow["video"]; firstName: string; where: string; onAsk: (note: string) => void; onCancel: () => void; onReply: (reply: string) => void }) {
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  // Opened with the client's video in it: seen, so it stops being news (9 Oct).
  const seenId = video?.state === "in" && video.src ? video.requestId : null;
  useEffect(() => {
    if (seenId != null) void markVideoSeenAction(seenId);
  }, [seenId]);
  // A photo or video that came in opens the media review instead (12 Oct, MediaReviewModal); this dialog asks for one, waits, or says it is not here yet.
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>{!video ? "Ask for a video" : video.state === "asked" ? "Video asked for" : `${firstName}'s ${video.media}${video.about === "swap" ? " of the substitute" : ""}`}</DialogTitle>
        <DialogDescription>
          {row.name} · {where}
          {video && video.state !== "asked" && video.fromClient ? ` · sent unasked` : ""}
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
          {/* The video itself (9 Oct): the stub with a fixed "0:42" stood here, and the coach could not watch what the client sent. */}
          {video.src && video.media === "photo" ? (
            <img className="rd-video" src={video.src} alt={`${firstName}'s photo`} />
          ) : video.src ? (
            <video className="rd-video" src={video.src} controls playsInline preload="metadata" aria-label={`${firstName}'s video`} />
          ) : (
            <div className="rd-video-stub" role="img" aria-label={`${firstName}'s video`}>
              <PlayIcon />
              <span>{firstName}&rsquo;s video is not here yet</span>
            </div>
          )}
          {video.clientNote && (
            <p className="rd-dlg-para">
              <b>{firstName} wrote</b> {video.clientNote}
            </p>
          )}
          {video.state === "replied" && video.replySrc && <video className="rd-video" src={video.replySrc} controls playsInline preload="metadata" aria-label="Your reply video" />}
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

/** A yes-or-no, in the hairline style (20 Oct, Alex): the title, one short line, an optional tick, Cancel and the action (black, or red words when it takes something away). */
export function ConfirmDialog({ title, description, confirm, danger, tick, onConfirm }: { title: string; description: string; confirm: string; danger?: boolean; tick?: string | null; onConfirm: (also: boolean) => void }) {
  const [also, setAlso] = useState(false);
  return (
    <DialogContent className="dlh">
      <div className="dlh-head">
        <DialogTitle className="dlh-title">{title}</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <DialogDescription className="dlh-what">{description}</DialogDescription>
      {tick && (
        <button type="button" role="checkbox" aria-checked={also} className="dlh-ack" onClick={() => setAlso((x) => !x)}>
          <span className={`dlh-box ink${also ? " on" : ""}`} aria-hidden="true">
            {also ? "✓" : ""}
          </span>
          {tick}
        </button>
      )}
      <div className="dlh-foot">
        <DialogClose className="dlh-cancel">Cancel</DialogClose>
        <button type="button" className={danger ? "dlh-delete" : "dlh-go"} onClick={() => onConfirm(also)} autoFocus>
          {confirm}
        </button>
      </div>
    </DialogContent>
  );
}

export function NewProgramDialog({ onCreate }: { onCreate: (v: { name: string; weeks: number; start: string }) => void }) {
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


/** Sets the client logged beyond the prescription ("Add a set", 12 Oct). A swapped row's sets are the swap's. */
const extraOf = (r: { sets: number; swap: string | null; logged: { set: number }[] }) => (r.swap ? 0 : r.logged.filter((l) => l.set > r.sets).length);

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
