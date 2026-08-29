import { ReactNode } from "react";
import ProgramNameForm from "./ProgramNameForm";
import ProgramWeeksForm from "./ProgramWeeksForm";
import ProgramDeployControls from "./ProgramDeployControls";
import ProgramWeekSwitcher from "./ProgramWeekSwitcher";
import TrainingColumnsPanel from "./TrainingColumnsPanel";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import { removeProgramAction } from "../lib/actions";
import type { TrainingColumn, TrainingProgram } from "../lib/queries";

type ProgramKind = "deployed" | "draft" | "past";

const KIND_LABEL: Record<ProgramKind, string> = { deployed: "Deployed", draft: "Draft", past: "Past" };
const KIND_PILL_CLASS: Record<ProgramKind, string> = { deployed: "published", draft: "draft", past: "" };

// One bordered, self-contained container per program — everything needed to
// build and ship it lives inside: name, length, column customization, the
// week-by-week day editor, and (for a draft) deploy/schedule. Header holds
// just identity (name + length, status pinned to the far right); deploy/
// schedule/delete live in their own footer at the very bottom of the card,
// pinned to the right — kept apart from the header so it doesn't compete
// with the name/status row, and apart from the day editor above it so it
// reads as "the action for this whole card" rather than attached to
// whichever week happens to be showing.
export default function ProgramCard({
  clientId,
  program,
  kind,
  defaultWeekIndex,
  weekContents,
  columns,
  canDelete,
  weekLinkBase,
}: {
  clientId: number;
  program: TrainingProgram;
  kind: ProgramKind;
  defaultWeekIndex: number;
  weekContents: Record<number, ReactNode>;
  columns: TrainingColumn[];
  canDelete?: boolean;
  weekLinkBase: string;
}) {
  return (
    <div className={`plan-card plan-card-${kind}`}>
      <div className="plan-card-header">
        <div className="plan-card-title-row">
          <ProgramNameForm programId={program.id} defaultName={program.name ?? ""} placeholder="Program name" />
          {kind === "draft" ? (
            <ProgramWeeksForm programId={program.id} defaultWeeks={program.total_weeks} />
          ) : (
            <span className="plan-card-weeks-note">
              {program.total_weeks} week{program.total_weeks === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <span className={`status-pill ${KIND_PILL_CLASS[kind]}`}>{KIND_LABEL[kind]}</span>
      </div>
      <div className="plan-card-body">
        <TrainingColumnsPanel clientId={clientId} columns={columns} />
        {kind === "deployed" && (
          <p className="empty-note" style={{ marginTop: 0 }}>
            The client can see this right now.
          </p>
        )}
        <ProgramWeekSwitcher totalWeeks={program.total_weeks} defaultWeek={defaultWeekIndex} weekContents={weekContents} />
      </div>
      {kind === "draft" && (
        <div className="plan-card-footer">
          <ProgramDeployControls programId={program.id} scheduledAt={program.scheduled_at} />
          {canDelete && (
            <ConfirmDeleteButton
              action={removeProgramAction}
              hiddenFields={{ programId: program.id, weekLinkBase }}
              label={`Delete draft ${program.name || "program"}`}
            />
          )}
        </div>
      )}
    </div>
  );
}
