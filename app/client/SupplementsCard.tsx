"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "../components/icons";

// The coach's supplements, folded into the foot of the calories card: one
// row with a chevron and how many are ticked, opening to the list. Each item
// has a tick the client can use as a reminder for today. The ticks are the
// client's own: kept in this browser session for today's date, never sent,
// never seen by the coach, whose list stays a reference list.
//
// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx).
export type SupplementRow = { name: string; quantity: string; timing: string; notes: string };

export default function SupplementsCard({ date, rows }: { date: string; rows: SupplementRow[] }) {
  const storageKey = `ironline.nutrition.taken.${date}`;
  const [open, setOpen] = useState(false);
  const [taken, setTaken] = useState<string[]>([]);
  // Read after mount: the server render has no storage.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) setTaken(saved.filter((x): x is string => typeof x === "string"));
    } catch {}
  }, [storageKey]);

  const toggle = (name: string) =>
    setTaken((prev) => {
      const next = prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name];
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });

  return (
    <div className="nd-supps">
      <button type="button" className="nd-supps-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="nd-supps-title">Supplements</span>
        {/* How many the coach has set; the ticks inside are optional. */}
        <span className="nd-supps-count" aria-label={`${rows.length} supplement${rows.length === 1 ? "" : "s"}`}>
          {rows.length}
        </span>
        <span className="nd-supps-chev" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div className="nd-supps-list">
          {rows.map((r, i) => {
            const on = taken.includes(r.name);
            return (
              <button
                key={`${r.name}-${i}`}
                type="button"
                className={`nd-supp${on ? " taken" : ""}`}
                aria-pressed={on}
                onClick={() => toggle(r.name)}
              >
                <span className="nd-check" aria-hidden="true">
                  {on && <CheckIcon />}
                </span>
                <span className="nd-supp-main">
                  <span className="nd-supp-name">{r.name}</span>
                  {r.notes && <span className="nd-supp-note">{r.notes}</span>}
                </span>
                <span className="nd-supp-dose">
                  {r.quantity && <span className="nd-supp-qty">{r.quantity}</span>}
                  {r.timing && <span className="nd-supp-timing">{r.timing}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
