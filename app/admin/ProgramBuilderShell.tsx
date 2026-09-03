"use client";

import { ReactNode, useState } from "react";
import { ExpandProvider } from "./BuilderContext";
import WeekRail from "./WeekRail";

// One capsule on the week rail. The seven ticks report what the client
// ACTUALLY trained — trained / planned-but-missed / rest — rather than what
// was planned, so adherence is visible without opening each week.
export type WeekCard = {
  week: number;
  label: string;
  days: { dayOfWeek: number; state: "trained" | "missed" | "rest"; title: string }[];
  isLive: boolean;
  /** True when the week is training history (live or past) and must stay. */
  locked: boolean;
  meta: string;
};

export type BuilderProgram = {
  id: number;
  name: string;
  status: "live" | "draft" | "past";
  statusLabel: string;
  totalWeeks: number;
  meta: string;
  defaultWeek: number;
  weekCards: WeekCard[];
  // Per week (1-based within the program): the seven day cards, rendered
  // server-side. Switching weeks is a pure client-side swap.
  weekContents: Record<number, ReactNode>;
  weekSummaries: Record<number, string>;
  // Deploy/schedule buttons for a draft, or the "live" readout — built
  // server-side because they're forms posting to server actions.
  actionsSlot: ReactNode;
  nameSlot: ReactNode;
  // "Copy week N here", pre-rendered per target week — a form posting to a
  // server action, so it can't be built from a callback on this side of the
  // boundary. Absent for week 1, which has nothing before it to copy.
  copySlots: Record<number, ReactNode>;
  /** The last week that has a split — what "copy" on the rail should clone. */
  copyFromWeek: number | null;
};

// The Program Builder's interactive frame: which program you're editing,
// which of its weeks is showing, and whether the day cards are expanded.
// Everything with a server action behind it (renaming, deploying, copying a
// week, editing an exercise) is passed in already-rendered, so this stays a
// pure selection layer.
export default function ProgramBuilderShell({
  programs,
  clientId,
  columnsSlot,
  newProgramSlot,
  emptySlot,
}: {
  programs: BuilderProgram[];
  clientId: number;
  columnsSlot: ReactNode;
  newProgramSlot: ReactNode;
  emptySlot: ReactNode;
}) {
  // Default to the draft if there is one — that's the thing a coach opens
  // this screen to work on — otherwise whatever is live.
  const initial = programs.find((p) => p.status === "draft") ?? programs[0];
  const [programId, setProgramId] = useState<number | null>(initial?.id ?? null);
  const program = programs.find((p) => p.id === programId) ?? initial;
  const [week, setWeek] = useState(initial?.defaultWeek ?? 1);
  const [expand, setExpand] = useState({ signal: 0, open: false });

  const selectProgram = (p: BuilderProgram) => {
    setProgramId(p.id);
    setWeek(p.defaultWeek);
    setExpand({ signal: 0, open: false });
  };

  if (!program) {
    return (
      <div className="pb-main">
        {emptySlot}
        <div className="pb-programs">{newProgramSlot}</div>
      </div>
    );
  }

  // A week the current program doesn't have (left over from switching) falls
  // back to its default rather than rendering nothing.
  const activeWeek = program.weekContents[week] ? week : program.defaultWeek;

  return (
    <div className="pb-main">
      <div className="pb-programs">
        {programs.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pb-program-chip${p.id === program.id ? " active" : ""}`}
            onClick={() => selectProgram(p)}
          >
            <span className="pb-program-name">{p.name || "Untitled program"}</span>
            <span className={`status-pill ${p.status}`}>{p.statusLabel}</span>
            <span className="pb-program-weeks">{p.totalWeeks}w</span>
          </button>
        ))}
        {newProgramSlot}
      </div>

      <div className="pb-editing">
        <div className="pb-editing-left">
          <div className="pb-eyebrow">Editing</div>
          <div className="pb-editing-name-row">
            {program.nameSlot}
          </div>
        </div>
        <div className="pb-editing-actions">{program.actionsSlot}</div>
      </div>

      <WeekRail
        weeks={program.weekCards.map((w) => ({
          weekNumber: w.week,
          label: w.label,
          days: w.days,
          meta: w.meta,
          isLive: w.isLive,
          // The only week left can't go either; delete the programme instead.
          removable: !w.locked && program.weekCards.length > 1,
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

      <div className="pb-toolbar">
        <div className="pb-toolbar-left">
          {columnsSlot}
        </div>
        <div className="pb-toolbar-right">
          <span className="pb-week-summary">{program.weekSummaries[activeWeek]}</span>
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

      <ExpandProvider value={expand}>
        <div className="pb-days">{program.weekContents[activeWeek]}</div>
      </ExpandProvider>
    </div>
  );
}
