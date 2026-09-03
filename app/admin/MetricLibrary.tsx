"use client";

import { useEffect, useRef, useState } from "react";
import { addMetricDefinitionAction, addMetricsFromLibraryAction } from "../lib/actions";

export type LibraryPackView = {
  id: string;
  label: string;
  group: string;
  cadence: "daily" | "weekly" | "monthly";
  items: { name: string; unit: string; already: boolean }[];
};

// The add-a-column row, with the metric library living INSIDE the name field.
//
// The chevron at the right edge of that input is the library: putting it
// there rather than as a separate button elsewhere means "type a name" and
// "pick a name" are the same control, which is how the coach thinks about it.
// The dropdown floats, so nothing below it reflows while they're picking.
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
      // Everything is added daily; the row toggle changes it afterwards.
      .map((i) => ({ name: i.name, unit: i.unit, group: p.group, cadence: "daily" as const }))
  );

  const setPack = (pack: LibraryPackView, on: boolean) =>
    setPicked((prev) => {
      const next = { ...prev };
      pack.items.forEach((i) => {
        if (!i.already) next[key(pack.id, i.name)] = on;
      });
      return next;
    });

  return (
    <div className="ms-addrow" ref={wrapRef}>
      <form action={addMetricDefinitionAction} className="ms-addrow-form">
        <input type="hidden" name="clientId" value={clientId} />
        {/* Manually added metrics land in "Other" — there's no group picker
            here because choosing one is the library's job. */}
        <input type="hidden" name="category" value="other" />
        {/* Every column starts daily; the Daily / Weekly / Monthly toggle on
            its row changes that afterwards. Deciding it here as well was a
            second place for the same choice. */}
        <input type="hidden" name="frequency" value="daily" />

        <div className={`ms-namefield${open ? " open" : ""}`}>
          <input name="name" type="text" placeholder="Column name, or pick from the library" aria-label="Column name" />
          <button
            type="button"
            className={`ms-namechev${open ? " open" : ""}`}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Open the metric library"
          >
            ▾
          </button>
        </div>

        <input name="unit" type="text" placeholder="Unit (e.g. kg)" aria-label="Unit" className="ms-unitfield" />

        <button type="submit" className="ad-btn-primary">
          Add column
        </button>
      </form>

      {open && (
        <div className="ml-pop" role="dialog" aria-label="Metric library">
          <div className="ml-pop-head">
            <span className="ad-microlabel">Metric library</span>
            <form
              action={addMetricsFromLibraryAction}
              onSubmit={() => {
                setPicked({});
                setOpen(false);
              }}
            >
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="picks" value={JSON.stringify(selected)} />
              <button type="submit" className="ad-btn-primary" disabled={selected.length === 0}>
                {selected.length === 0 ? "Pick some metrics" : `Add ${selected.length} to check-in`}
              </button>
            </form>
          </div>

          <div className="ml-groups">
            {packs.map((pack) => {
              const available = pack.items.filter((i) => !i.already);
              return (
                <section key={pack.id} className="ml-group">
                  <div className="ml-group-head">
                    <span className="ml-group-name">{pack.label}</span>
                    <span className="ml-rule" />
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
        </div>
      )}
    </div>
  );
}
