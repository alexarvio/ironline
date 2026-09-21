"use client";

import { ReactNode, useEffect, useState, useTransition } from "react";
import { ExpandProvider, WeightUnitProvider, type BuilderWeightUnit } from "./BuilderContext";

const UNIT_KEY = "ironline:builder-weight-unit";
import WeekRail from "./WeekRail";
import ProgramNotePeek from "./ProgramNotePeek";
import PhaseHeader, { usePhases, type PhaseOption, type PhaseStatus } from "./PhaseHeader";
import ProgramDatesDialog from "./ProgramDatesDialog";
import { PhaseDialog, type PhaseNeighbour, type PhaseProgramInfo } from "./PhaseDialogButton";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import {
  cancelProgramScheduleAction,
  createProgramAction,
  deployProgramAction,
  removeProgramAction,
  removeProgramWeekAction,
} from "../lib/actions";
import type { ClientPhase } from "../lib/db";

// One capsule on the week rail. The seven ticks report what the client
// ACTUALLY trained — trained / planned-but-missed / rest — rather than what
// was planned, so adherence is visible without opening each week.
export type WeekCard = {
  week: number;
  label: string;
  days: { dayOfWeek: number; state: "trained" | "missed" | "rest"; title: string }[];
  isLive: boolean;
  /** A session in this week has news the coach has not opened. */
  hasNew?: boolean;
  /** True when the week is training history (live or past) and must stay. */
  locked: boolean;
  meta: string;
};

export type BuilderProgram = {
  id: number;
  name: string;
  status: "live" | "draft" | "past";
  /** What the header band says it is: a draft with a date reads Scheduled. */
  state: PhaseStatus;
  totalWeeks: number;
  /** "Aug 18 – Sep 28"; empty while a draft has no date to run from. */
  dates: string;
  /** The Monday it starts, for ordering; null while it has none. */
  start: string | null;
  /** Which of its weeks the client is in — the live programme only. */
  liveWeek: number | null;
  /** Its phase on the Plan tab, once it has one: what "Edit dates" edits. */
  phase: { phase: ClientPhase; program: PhaseProgramInfo } | null;
  defaultWeek: number;
  weekCards: WeekCard[];
  // Per week (1-based within the program): the seven day cards, rendered
  // server-side. Switching weeks is a pure client-side swap.
  weekContents: Record<number, ReactNode>;
  weekSummaries: Record<number, string>;
  // "Copy week N here", pre-rendered per target week — a form posting to a
  // server action, so it can't be built from a callback on this side of the
  // boundary. Absent for week 1, which has nothing before it to copy.
  copySlots: Record<number, ReactNode>;
  /** The last week that has a split — what "copy" on the rail should clone. */
  copyFromWeek: number | null;
  /** The client's note about this programme, with when it was last written. */
  clientNote?: { text: string; updatedAt: string; from: string } | null;
};

// The Program Builder's interactive frame: which program you're editing,
// which of its weeks is showing, and whether the day cards are expanded.
// Everything with a server action behind it (renaming, deploying, copying a
// week, editing an exercise) is passed in already-rendered, so this stays a
// pure selection layer.
export default function ProgramBuilderShell({
  programs,
  clientId,
  today,
  others,
  weekLinkBase,
  initialProgramId,
  columnsSlot,
  emptySlot,
  gymsSlot,
}: {
  programs: BuilderProgram[];
  clientId: number;
  /** Server-local date, so "is this live" agrees with the Plan tab. */
  today: string;
  /** The client's other phases, for the dialog's overlap warning. */
  others: PhaseNeighbour[];
  weekLinkBase: string;
  /** `?phase=` as the server read it, so a linked programme opens straight away. */
  initialProgramId: number | null;
  columnsSlot: ReactNode;
  emptySlot: ReactNode;
  /** The client's gyms: they apply to every programme, not to one of them. */
  gymsSlot?: ReactNode;
}) {
  const options: PhaseOption[] = programs.map((p) => ({
    id: p.id,
    name: p.name || "Untitled programme",
    status: p.state,
    start: p.start,
    dates: p.dates,
    weeks: p.totalWeeks,
    week: p.liveWeek,
  }));
  const { current, select } = usePhases(options, { initialId: initialProgramId });
  // A programme that was not here a moment ago is the one just made with
  // "+ New programme": open it. The tab used to stay on the live one, so
  // making a programme looked like it did nothing.
  const ids = options.map((o) => o.id).join(",");
  const [seenIds, setSeenIds] = useState(ids);
  if (ids !== seenIds) {
    const before = new Set(seenIds.split(",").map(Number));
    const fresh = options.find((o) => !before.has(o.id));
    setSeenIds(ids);
    if (fresh) select(fresh.id);
  }
  const program = programs.find((p) => p.id === current?.id) ?? programs[0];

  const [week, setWeek] = useState(program?.defaultWeek ?? 1);
  const [expand, setExpand] = useState({ signal: 0, open: false });
  // "Edit dates" edits the phase; "Schedule it" sends the draft out.
  const [dates, setDates] = useState<false | "edit" | "schedule">(false);
  const [busy, run] = useTransition();
  // Kg or lbs for reading weights; remembered in this browser.
  const [unit, setUnit] = useState<BuilderWeightUnit>("kg");
  useEffect(() => {
    try {
      if (localStorage.getItem(UNIT_KEY) === "lb") setUnit("lb");
    } catch {}
  }, []);
  const flipUnit = () => {
    const next: BuilderWeightUnit = unit === "kg" ? "lb" : "kg";
    setUnit(next);
    try {
      if (next === "lb") localStorage.setItem(UNIT_KEY, "lb");
      else localStorage.removeItem(UNIT_KEY);
    } catch {}
  };

  // Switching programme lands on the week that programme opens to, with the
  // day cards back to folded — a different programme is a different sheet.
  const [seenId, setSeenId] = useState(program?.id ?? null);
  if (program && program.id !== seenId) {
    setSeenId(program.id);
    setWeek(program.defaultWeek);
    setExpand({ signal: 0, open: false });
  }

  const post = (action: (fd: FormData) => Promise<void>, fields: Record<string, string | number>) =>
    run(async () => {
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => fd.set(k, String(v)));
      await action(fd);
    });
  const newProgram = () => post(createProgramAction, { clientId, weekLinkBase });

  if (!program) {
    return (
      <div className="pb-main">
        <section className="pb-head-card ph-card">
          <PhaseHeader
            kind="programme"
            phases={[]}
            currentId={null}
            onSelect={select}
            onNew={newProgram}
            newLabel="+ New programme"
            emptyAction={
              <button type="button" className="ph-primary" onClick={newProgram} disabled={busy}>
                Create the first programme
              </button>
            }
          />
          <div className="pb-head-body">
            {gymsSlot && <div className="pb-programs-gyms">{gymsSlot}</div>}
            {emptySlot}
          </div>
        </section>
      </div>
    );
  }

  // A week the current program doesn't have (left over from switching) falls
  // back to its default rather than rendering nothing.
  const activeWeek = program.weekContents[week] ? week : program.defaultWeek;
  const activeCard = program.weekCards.find((w) => w.week === activeWeek);

  return (
    <div className="pb-main">
      {/* One card, because it is one thing: the programme being edited. Which
          programme that is, is the heading — the switcher's menu holds the
          rest. Under the band, its weeks, and under the week its sessions. */}
      <section className="pb-head-card ph-card pb-program-card">
      <PhaseHeader
        kind="programme"
        phases={options}
        currentId={program.id}
        onSelect={select}
        onNew={newProgram}
        newLabel="+ New programme"
        secondary={
          program.state === "scheduled" ? (
            <button
              type="button"
              className="ph-minor"
              onClick={() => post(cancelProgramScheduleAction, { programId: program.id })}
              disabled={busy}
            >
              Cancel
            </button>
          ) : program.state === "draft" ? (
            <ConfirmDeleteButton
              action={removeProgramAction}
              hiddenFields={{ programId: program.id, weekLinkBase }}
              label={`Delete draft ${program.name || "programme"}`}
            />
          ) : undefined
        }
        primary={
          program.state === "draft" ? (
            <button type="button" className="ph-primary" onClick={() => setDates("schedule")} disabled={busy}>
              Schedule it
            </button>
          ) : program.state === "scheduled" ? (
            <button
              type="button"
              className="ph-primary"
              onClick={() => post(deployProgramAction, { programId: program.id })}
              disabled={busy}
            >
              Make it live
            </button>
          ) : undefined
        }
        editDates={
          <button type="button" className="nw-edit-phase" onClick={() => setDates("edit")}>
            Edit dates
          </button>
        }
      />

      {dates &&
        (program.phase ? (
          dates === "schedule" && program.state === "draft" ? (
            // Named, dated and sent out: blue while it is scheduled, and its
            // length is the programme's, so a click moves the whole span.
            <PhaseDialog
              mode="schedule"
              clientId={clientId}
              phase={program.phase.phase}
              today={today}
              others={others}
              lockedWeeks={program.totalWeeks}
              onClose={() => setDates(false)}
            />
          ) : (
            <PhaseDialog
              clientId={clientId}
              phase={program.phase.phase}
              program={program.phase.program}
              today={today}
              others={others}
              onClose={() => setDates(false)}
            />
          )
        ) : (
          <ProgramDatesDialog programId={program.id} name={program.name} onClose={() => setDates(false)} />
        ))}

      <div className="pb-head-body">
      <div className="pb-rail-row">
      <WeekRail
        weeks={program.weekCards.map((w) => ({
          weekNumber: w.week,
          label: w.label,
          days: w.days,
          meta: w.meta,
          isLive: w.isLive,
          hasNew: w.hasNew,
        }))}
        selectedWeek={activeWeek}
        nextWeekNumber={program.totalWeeks + 1}
        copyFromWeek={program.copyFromWeek}
        onSelect={(week) => {
          setWeek(week);
          setExpand({ signal: 0, open: false });
        }}
        clientId={clientId}
        programId={program.id}
      />
      <ProgramNotePeek programId={program.id} note={program.clientNote ?? null} />
      </div>
      </div>

      {/* The week picked on the rail, inside the same card as the rail. */}
      <div className="pb-week-body">
      <div className="pb-week-head">
        <span className="pb-week-title">{activeCard?.label ?? `Week ${activeWeek}`}</span>
        {activeCard && <span className="pb-week-sub">{activeCard.meta}</span>}
        {/* Removing the week on screen, at the end of its own heading. A live
            or past week is training history and stays; so does the only week
            left — delete the programme instead. */}
        {activeCard && !activeCard.locked && program.weekCards.length > 1 && (
          <span className="pb-week-head-end">
            <ConfirmDeleteButton
              action={removeProgramWeekAction}
              hiddenFields={{ clientId, programId: program.id, week: activeCard.week }}
              label={`Remove ${activeCard.label}`}
              description="Its exercises and anything logged on them are deleted, and the weeks after it move up one."
            />
          </span>
        )}
      </div>
      <div className="pb-toolbar">
        {/* The gyms and the columns belong to the client and to the table,
            not to the phase, so they sit with the table rather than in the
            band above it. */}
        {gymsSlot && <div className="pb-programs-gyms">{gymsSlot}</div>}
        <div className="pb-toolbar-right">
          {columnsSlot}
          <button
            type="button"
            className="pb-unit"
            onClick={flipUnit}
            aria-label={unit === "kg" ? "Weights shown in kg. Show them in lbs" : "Weights shown in lbs. Show them in kg"}
            title="Show weights in kg or lbs. Goals are still typed in kg."
          >
            <span className={unit === "kg" ? "on" : undefined}>Kg</span>
            <span className={unit === "lb" ? "on" : undefined}>Lbs</span>
          </button>
          <button
            type="button"
            className="pb-toolbar-btn"
            onClick={() => setExpand((e) => ({ signal: e.signal + 1, open: !e.open }))}
          >
            {expand.open ? "Collapse all" : "Expand all"}
          </button>
          {program.copySlots[activeWeek]}
        </div>
      </div>

      <WeightUnitProvider value={unit}>
        <ExpandProvider value={expand}>
          <div className="pb-days">{program.weekContents[activeWeek]}</div>
        </ExpandProvider>
      </WeightUnitProvider>
      </div>
      </section>
    </div>
  );
}
