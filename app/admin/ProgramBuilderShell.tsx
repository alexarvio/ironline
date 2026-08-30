"use client";

import { ReactNode, useState } from "react";
import { ExpandProvider } from "./BuilderContext";

// One week's entry in the strip above the day cards: seven slot bars (one
// per weekday, filled when that day has training on it) plus a count, so a
// coach can see at a glance which weeks of a block are still empty.
export type WeekCard = {
  week: number;
  label: string;
  slots: boolean[];
  isLive: boolean;
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
};

// The Program Builder's interactive frame: which program you're editing,
// which of its weeks is showing, and whether the day cards are expanded.
// Everything with a server action behind it (renaming, deploying, copying a
// week, editing an exercise) is passed in already-rendered, so this stays a
// pure selection layer.
export default function ProgramBuilderShell({
  programs,
  columnsSlot,
  newProgramSlot,
  emptySlot,
}: {
  programs: BuilderProgram[];
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
            <span className="pb-editing-meta">{program.meta}</span>
          </div>
        </div>
        <div className="pb-editing-actions">{program.actionsSlot}</div>
      </div>

      <div className="pb-weeks">
        {program.weekCards.map((w) => (
          <button
            key={w.week}
            type="button"
            className={`pb-week${w.week === activeWeek ? " active" : ""}`}
            onClick={() => {
              setWeek(w.week);
              setExpand({ signal: 0, open: false });
            }}
          >
            <div className="pb-week-top">
              <span className="pb-week-label">{w.label}</span>
              {w.isLive && <span className="pb-week-dot" aria-label="Live week" />}
            </div>
            <div className="pb-week-slots">
              {w.slots.map((filled, i) => (
                <span key={i} className={`pb-week-slot${filled ? " filled" : ""}`} />
              ))}
            </div>
            <div className="pb-week-meta">{w.meta}</div>
          </button>
        ))}
      </div>

      <div className="pb-toolbar">
        <div className="pb-toolbar-left">
          <span className="pb-eyebrow">Columns</span>
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
