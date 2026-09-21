"use client";

import { useTransition } from "react";
import { copyPhaseMetricsAction } from "../lib/actions";

// A draft phase starts blank, which is right — but most phases ask for much
// of what the last one did, so there is one button to start from it rather
// than ticking the same dozen boxes again. It copies; the phase it came from
// keeps everything it had.
export default function CopyPhaseMetrics({ clientId, fromId, toId, fromName }: { clientId: number; fromId: number; toId: number; fromName: string }) {
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className="mx-copy-metrics"
      disabled={busy}
      onClick={() => start(() => copyPhaseMetricsAction(clientId, fromId, toId, true))}
    >
      {busy ? "Copying…" : `Start from ${fromName}`}
    </button>
  );
}
