"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "../../components/ui/dialog";
import { PlusIcon } from "../../components/icons";
import { addClientPhaseAction } from "../../lib/actions";
import type { PhaseTrack } from "../../lib/db";
import { PhaseDialog, phaseForm, type DraftPlan } from "./plan/PlanDraft";

// Training, Nutrition or Measurements the first time, before the client has
// a phase on that track and nothing is set up there: one button, "Create a
// training phase" (or nutrition, or lifestyle), which opens the Plan's own
// phase dialog, the calendar and all. Once the phase is made, the tab shows
// its usual screen (26 Sep).

const WORD: Record<PhaseTrack, string> = { training: "training", nutrition: "nutrition", lifestyle: "lifestyle" };
// The tab's own header, as its usual screen has it.
const HEAD: Record<PhaseTrack, { eyebrow: string; title: string }> = {
  training: { eyebrow: "Training", title: "Programme" },
  nutrition: { eyebrow: "Nutrition", title: "Targets" },
  lifestyle: { eyebrow: "Measurements", title: "Check-ins" },
};

export default function NoPhase({ clientId, firstName, track, plan }: { clientId: number; firstName: string; track: PhaseTrack; plan: DraftPlan }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="rd">
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">{HEAD[track].eyebrow}</span>
          <h1 className="rd-title">{HEAD[track].title}</h1>
        </div>
      </header>
      {/* One card, everything centred in it: what is missing, and the button. */}
      <section className="rd-session open rd-nophase">
        <b className="rd-nophase-title">
          {firstName} has no {WORD[track]} phase yet
        </b>
        <button type="button" className="rd-btn primary rd-nophase-btn" onClick={() => setOpen(true)} disabled={pending}>
          <PlusIcon /> Create a {WORD[track]} phase
        </button>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <PhaseDialog
            clientId={clientId}
            firstName={firstName}
            today={plan.today}
            thisWeek={plan.thisWeek}
            phase={null}
            track={track}
            others={plan.phases}
            programs={plan.programs}
            onSave={(v) => {
              setOpen(false);
              start(async () => {
                await addClientPhaseAction(phaseForm({ clientId, ...v }));
                toast.success("Saved", { description: `${v.name} drafted` });
                router.refresh();
              });
            }}
            onSend={() => setOpen(false)}
          />
        )}
      </Dialog>
    </div>
  );
}
