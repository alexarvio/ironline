"use client";

import { useState } from "react";
import type { ClientPhase } from "../lib/db";
import { PhaseDialog } from "./PhaseDialogButton";
import SchedulePhaseDialog from "./SchedulePhaseDialog";
import DeployNowDialog from "./DeployNowDialog";
import { deployPhaseNowAction } from "../lib/actions";
import { phaseRange, phaseWeekIndex, phaseWeeks } from "../lib/phases";
import PhaseHeader, { usePhases, type PhaseOption } from "./PhaseHeader";

// The Measurements tab's phase band: which lifestyle phase the metrics below
// belong to, where it stands, and the dialogs behind its two buttons.
// Editing dates, scheduling and drafting all go through the same dialogs as
// the Plan tab, so a phase means one thing everywhere.

export type RailPhase = ClientPhase & { status: "past" | "now" | "next" | "draft" };

const STATUS = { now: "live", next: "scheduled", draft: "draft", past: "past" } as const;

const mondayOf = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addWeeks = (monday: string, weeks: number) => {
  const d = new Date(`${monday}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function LifestylePhaseHeader({
  clientId,
  today,
  phases,
  selectedId,
}: {
  clientId: number;
  today: string;
  phases: RailPhase[];
  /** Decided on the server, so the metrics below are the ones it asks for. */
  selectedId: number | null;
}) {
  const thisWeek = mondayOf(today);
  const options: PhaseOption[] = phases.map((p) => ({
    id: p.id,
    name: p.name,
    status: STATUS[p.status],
    start: p.start_week,
    dates: phaseRange(p.start_week, p.end_week),
    weeks: phaseWeeks(p.start_week, p.end_week),
    week: p.status === "now" ? phaseWeekIndex(p.start_week, p.end_week, today) : null,
  }));
  // The metric list is built on the server from the phase, so picking one is
  // a navigation rather than a swap of what is already on screen.
  const { current, select } = usePhases(options, { initialId: selectedId, navigate: true });
  const phase = phases.find((p) => p.id === current?.id) ?? null;

  const [editing, setEditing] = useState<RailPhase | null>(null);
  const [adding, setAdding] = useState(false);
  const [scheduling, setScheduling] = useState<{ phase: RailPhase; from: string | null } | null>(null);
  // Deploy now / Make it live: straight out this week, no dates to pick.
  const [deploying, setDeploying] = useState<RailPhase | null>(null);
  const runningNow = phases.find((p) => p.status === "now") ?? null;
  const nextSet = (id: number) => phases.filter((p) => p.id !== id && p.status === "next").sort((a, b) => a.start_week.localeCompare(b.start_week))[0] ?? null;

  // A new phase starts the week after the last one ends, else this week.
  const lastEnd = phases.reduce<string | null>((max, p) => (!max || p.end_week > max ? p.end_week : max), null);
  const start = lastEnd && addWeeks(lastEnd, 1) > thisWeek ? addWeeks(lastEnd, 1) : thisWeek;
  const others = phases.map((p) => ({ id: p.id, track: p.track, name: p.name, start_week: p.start_week, end_week: p.end_week }));

  return (
    <>
      <PhaseHeader
        kind="lifestyle"
        phases={options}
        currentId={current?.id ?? null}
        onSelect={select}
        onNew={() => setAdding(true)}
        secondary={
          phase && phase.status === "draft" ? (
            // For later: its dates, in the phase dialog.
            <button type="button" className="ph-minor" onClick={() => setScheduling({ phase, from: null })}>
              Schedule
            </button>
          ) : undefined
        }
        primary={
          phase && phase.status === "draft" ? (
            <button type="button" className="ph-primary" onClick={() => setDeploying(phase)}>
              Deploy now
            </button>
          ) : phase && phase.status === "next" ? (
            <button type="button" className="ph-primary" onClick={() => setDeploying(phase)}>
              Make it live
            </button>
          ) : undefined
        }
        editDates={
          phase && (
            <button type="button" className="nw-edit-phase" onClick={() => setEditing(phase)}>
              Edit dates
            </button>
          )
        }
        emptyAction={
          <button type="button" className="ph-primary" onClick={() => setAdding(true)}>
            Create the first phase
          </button>
        }
      />

      {deploying && (
        <DeployNowDialog
          track="lifestyle"
          name={deploying.name}
          weeks={phaseWeeks(deploying.start_week, deploying.end_week)}
          today={today}
          running={runningNow && runningNow.id !== deploying.id ? { name: runningNow.name, start_week: runningNow.start_week } : null}
          next={nextSet(deploying.id)}
          onConfirm={() => deployPhaseNowAction(deploying.id)}
          onClose={() => setDeploying(null)}
        />
      )}
      {scheduling && (
        <SchedulePhaseDialog
          phase={scheduling.phase}
          today={today}
          others={others}
          defaultStart={scheduling.from}
          onClose={() => setScheduling(null)}
        />
      )}
      {editing && <PhaseDialog clientId={clientId} phase={editing} today={today} others={others} onClose={() => setEditing(null)} />}
      {adding && (
        <PhaseDialog
          clientId={clientId}
          today={today}
          defaultTrack="lifestyle"
          defaultStart={start}
          defaultEnd={addWeeks(start, 3)}
          others={others}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
