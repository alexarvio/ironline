"use client";

import type { ClientPhase, PhaseTrack } from "../lib/db";
import { PhaseDialog } from "./PhaseDialogButton";

// The last step of the same flow on every track: a draft that has been
// filled in gets a name and a span, and goes out. It is the phase dialog in
// its "schedule" mode — one dialog for scheduling and editing a phase — and
// this wrapper only keeps the props the Nutrition and Measurements tabs
// already pass.
//
// A training phase's length is its programme's — weeks are added in the
// builder — so there the coach picks when it starts and the calendar draws
// the length it already has. Everywhere else both ends are theirs to pick.
export default function SchedulePhaseDialog({
  phase,
  today,
  others = [],
  lockedWeeks = null,
  defaultStart = null,
  onClose,
}: {
  phase: ClientPhase;
  today: string;
  others?: { name: string; start_week: string; end_week: string; track: PhaseTrack; id: number }[];
  /** A training phase's weeks come from its programme and cannot be picked here. */
  lockedWeeks?: number | null;
  /** Opened by "Make it live": the span slides to begin on the week given,
      keeping its length, so the dialog already says what the button said. */
  defaultStart?: string | null;
  onClose: () => void;
}) {
  return (
    <PhaseDialog
      mode="schedule"
      clientId={phase.client_id}
      phase={phase}
      today={today}
      others={others}
      lockedWeeks={lockedWeeks}
      defaultStart={defaultStart ?? undefined}
      onClose={onClose}
    />
  );
}
