"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { applyMetricChangesAction } from "../lib/actions";

// Tracked metrics are changed as a draft, like a session in the builder or
// the nutrition targets: adding, removing and switching daily / weekly queue
// here, and nothing reaches the client's check-in until Apply. Discard puts
// the list back. The bar says what is queued in counts ("5 metrics added"),
// not as a list: the list is right above it.

export type PendingAdd = { tempId: number; name: string; unit: string; group: string; cadence: "daily" | "weekly"; source: "library" | "custom" };

type Ctx = {
  adds: PendingAdd[];
  removes: Set<number>;
  cadence: Record<number, "daily" | "weekly">;
  add: (items: Omit<PendingAdd, "tempId">[]) => void;
  /** A saved metric: queue its removal (again: keep it). A queued one: drop it. */
  toggleRemove: (id: number) => void;
  setCadence: (id: number, value: "daily" | "weekly", saved: "daily" | "weekly" | null) => void;
};

const MetricsPendingContext = createContext<Ctx | null>(null);
export const useMetricsPending = () => useContext(MetricsPendingContext);

/** The "blank board" note: gone once something is queued, as the queued rows take its place. */
export function WhenNothingQueued({ children }: { children: ReactNode }) {
  const p = useContext(MetricsPendingContext);
  return p && p.adds.length > 0 ? null : <>{children}</>;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function MetricsPendingProvider({ clientId, phaseId, children }: { clientId: number; phaseId: number | null; children: ReactNode }) {
  const [adds, setAdds] = useState<PendingAdd[]>([]);
  const [removes, setRemoves] = useState<Set<number>>(new Set());
  const [cadence, setCadenceMap] = useState<Record<number, "daily" | "weekly">>({});
  const [nextTemp, setNextTemp] = useState(-1);
  const [busy, run] = useTransition();
  const [failed, setFailed] = useState(false);

  const ctx = useMemo<Ctx>(
    () => ({
      adds,
      removes,
      cadence,
      add: (items) => {
        // The same name twice would be two columns of the same thing.
        const have = new Set(adds.map((a) => a.name.toLowerCase()));
        const fresh = items.filter((i) => i.name.trim() && !have.has(i.name.toLowerCase()));
        setAdds([...adds, ...fresh.map((i, n) => ({ ...i, tempId: nextTemp - n }))]);
        setNextTemp(nextTemp - fresh.length);
      },
      toggleRemove: (id) => {
        if (id < 0) return setAdds(adds.filter((a) => a.tempId !== id));
        const next = new Set(removes);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setRemoves(next);
      },
      setCadence: (id, value, saved) => {
        if (id < 0) return setAdds(adds.map((a) => (a.tempId === id ? { ...a, cadence: value } : a)));
        const next = { ...cadence };
        if (value === saved) delete next[id];
        else next[id] = value;
        setCadenceMap(next);
      },
    }),
    [adds, removes, cadence, nextTemp]
  );

  // A switch on a metric that is also being removed is not a change worth counting.
  const switched = Object.keys(cadence).filter((id) => !removes.has(Number(id)));
  const parts = [
    adds.length ? `${plural(adds.length, "metric", "metrics")} added` : null,
    removes.size ? `${removes.size} removed` : null,
    switched.length ? `${switched.length} switched daily / weekly` : null,
  ].filter(Boolean);
  const count = adds.length + removes.size + switched.length;

  const discard = () => {
    setAdds([]);
    setRemoves(new Set());
    setCadenceMap({});
    setFailed(false);
  };
  const apply = () =>
    run(async () => {
      const ok = await applyMetricChangesAction({
        clientId,
        phaseId,
        adds: adds.map(({ name, unit, group, cadence: c, source }) => ({ name, unit, group, cadence: c, source })),
        removes: [...removes],
        cadence: switched.map((id) => ({ id: Number(id), value: cadence[Number(id)] })),
      });
      if (ok) discard();
      else setFailed(true);
    });

  return (
    <MetricsPendingContext.Provider value={ctx}>
      {children}
      {count > 0 && (
        <div className={`pb-pending mx-pending${failed ? " failed" : ""}`} role="region" aria-label="Unsaved changes to the tracked metrics">
          <span className="pb-pending-count">{plural(count, "change", "changes")}</span>
          <span className="pb-pending-summary">{parts.join(" · ")}</span>
          <div className="pb-pending-right">
            {failed ? <span className="pb-pending-status">Couldn&rsquo;t save</span> : busy && <span className="pb-pending-status">Saving…</span>}
            <button type="button" className="pb-pending-ghost" onClick={discard} disabled={busy}>
              Discard
            </button>
            <button type="button" className="pb-pending-apply" onClick={apply} disabled={busy}>
              {failed ? "Retry" : busy ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>
      )}
    </MetricsPendingContext.Provider>
  );
}
