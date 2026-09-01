"use client";

import { useEffect, useRef, useState } from "react";
import { addMetricsFromLibraryAction } from "../lib/actions";

export type LibraryPackView = {
  id: string;
  label: string;
  group: string;
  cadence: "daily" | "weekly" | "monthly";
  items: { name: string; unit: string; already: boolean }[];
};

// The metric library: the coach's own spreadsheets, section for section, so
// setting a client up is ticking boxes rather than retyping forty rows.
//
// It floats rather than expanding in place — the setup list below must not
// reflow while the coach is picking — and commits everything ticked with one
// button, because adding seven metrics one at a time is the thing this is
// meant to replace.
export default function MetricLibrary({ clientId, packs }: { clientId: number; packs: LibraryPackView[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const key = (packId: string, name: string) => `${packId}::${name}`;

  const selected = packs.flatMap((p) =>
    p.items
      .filter((i) => !i.already && picked[key(p.id, i.name)])
      .map((i) => ({ name: i.name, unit: i.unit, group: p.group, cadence: p.cadence }))
  );

  const setPack = (pack: LibraryPackView, on: boolean) => {
    setPicked((prev) => {
      const next = { ...prev };
      pack.items.forEach((i) => {
        if (!i.already) next[key(pack.id, i.name)] = on;
      });
      return next;
    });
  };

  return (
    <div className="ml-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`ml-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Metric library
        <span className={`ml-chev${open ? " open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="ml-pop" role="dialog" aria-label="Metric library">
          <div className="ml-groups">
            {packs.map((pack) => {
              const available = pack.items.filter((i) => !i.already);
              const allOn = available.length > 0 && available.every((i) => picked[key(pack.id, i.name)]);
              return (
                <section key={pack.id} className="ml-group">
                  <div className="ml-group-head">
                    <span className="ml-group-name">{pack.label}</span>
                    <span className="ml-cadence">{pack.cadence}</span>
                    <span className="ml-group-actions">
                      <button type="button" onClick={() => setPack(pack, true)} disabled={available.length === 0}>
                        all
                      </button>
                      <button type="button" onClick={() => setPack(pack, false)} disabled={available.length === 0}>
                        none
                      </button>
                    </span>
                  </div>
                  <div className="ml-items">
                    {pack.items.map((item) => {
                      // Anything already on the check-in is greyed and marked,
                      // so it can't be added twice.
                      if (item.already) {
                        return (
                          <span key={item.name} className="ml-item added" title="Already on this client's check-in">
                            {item.name}
                            <em>added</em>
                          </span>
                        );
                      }
                      const k = key(pack.id, item.name);
                      return (
                        <label key={item.name} className="ml-item">
                          <input
                            type="checkbox"
                            checked={!!picked[k]}
                            onChange={(e) => setPicked((p) => ({ ...p, [k]: e.target.checked }))}
                          />
                          {item.name}
                          {item.unit && <em>{item.unit}</em>}
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <form
            action={addMetricsFromLibraryAction}
            className="ml-commit"
            onSubmit={() => {
              setPicked({});
              setOpen(false);
            }}
          >
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="picks" value={JSON.stringify(selected)} />
            <button type="submit" className="btn" disabled={selected.length === 0}>
              {selected.length === 0
                ? "Pick some metrics"
                : `Add ${selected.length} to check-in`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
