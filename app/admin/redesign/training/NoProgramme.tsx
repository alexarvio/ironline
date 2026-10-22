"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "../../../components/ui/dialog";
import { createProgramWithAction } from "../../../lib/actions";
import { NewProgramDialog } from "./TrainingDraft";

// Training for a client with a training phase but no programme yet: makes the first one, with the New programme
// dialog (26 Sep; it was a dead end before, the only way in being the Plan). In the admin's voice (22 Oct, Alex), as
// NoPhase: the track's name as the title, one hairline card, `No programme yet` and New programme.
export default function NoProgramme({ clientId }: { clientId: number; firstName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="rd trn rls">
      <header className="trn-head bare">
        <div className="trn-head-main">
          <div className="trn-name-row">
            <h1 className="trn-name">Training</h1>
          </div>
        </div>
      </header>
      <section className="rls-section">
        <div className="rls-card">
          <div className="rls-empty">
            <span>No programme yet</span>
            <button type="button" className="trn-btn primary" onClick={() => setOpen(true)} disabled={pending}>
              New programme
            </button>
          </div>
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <NewProgramDialog
            onCreate={(v) => {
              setOpen(false);
              start(async () => {
                const id = await createProgramWithAction(clientId, v.name, v.weeks, v.start || null);
                toast.success("Saved", { description: `${v.name || "New programme"}: ${v.weeks} weeks, a draft` });
                if (id) router.push(`/admin/redesign/training?client=${clientId}&program=${id}&week=1`, { scroll: false });
                else router.refresh();
              });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
