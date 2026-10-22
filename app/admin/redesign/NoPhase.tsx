"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "../../components/ui/dialog";
import { addClientPhaseAction } from "../../lib/actions";
import type { PhaseTrack } from "../../lib/db";
import { PhaseDialog, phaseForm, type DraftPlan } from "./plan/PlanDraft";

// Training, Nutrition or Lifestyle the first time, before the client has a phase on that track and nothing is set up
// there. In the admin's voice (22 Oct, Alex: the old centred card and navy button were left over): the track's name as
// the title, no eyebrow and no room for a fact line, then one hairline card, `No phase yet` and New phase, as
// Lifestyle's Tracked metrics says it. New phase opens the Plan's own phase dialog; once the phase is made, the tab
// shows its usual screen.

const TITLE: Record<PhaseTrack, string> = { training: "Training", nutrition: "Nutrition", lifestyle: "Lifestyle" };

export default function NoPhase({ clientId, firstName, track, plan }: { clientId: number; firstName: string; track: PhaseTrack; plan: DraftPlan }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="rd trn rls">
      <header className="trn-head bare">
        <div className="trn-head-main">
          <div className="trn-name-row">
            <h1 className="trn-name">{TITLE[track]}</h1>
          </div>
        </div>
      </header>
      <section className="rls-section">
        <div className="rls-card">
          <div className="rls-empty">
            <span>No phase yet</span>
            <button type="button" className="trn-btn primary" onClick={() => setOpen(true)} disabled={pending}>
              New phase
            </button>
          </div>
        </div>
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
