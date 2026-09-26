"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "../../../components/ui/dialog";
import { PlusIcon } from "../../../components/icons";
import { createProgramWithAction } from "../../../lib/actions";
import { NewProgramDialog } from "./TrainingDraft";

// Training for a client with no programme yet: says so, and makes the first
// one, with the same New programme dialog as the programme header (26 Sep;
// it was a dead end before, the only way in being the Plan).
export default function NoProgramme({ clientId, firstName }: { clientId: number; firstName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="rd-noprog">
      <p className="rd-empty">{firstName} has no programme yet.</p>
      <button type="button" className="rd-btn primary" onClick={() => setOpen(true)} disabled={pending}>
        <PlusIcon /> New programme
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <NewProgramDialog
            onCreate={(v) => {
              setOpen(false);
              start(async () => {
                const id = await createProgramWithAction(clientId, v.name, v.weeks, v.start || null);
                toast.success("Saved", { description: `${v.name || "New programme"} · ${v.weeks} weeks, a draft` });
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
