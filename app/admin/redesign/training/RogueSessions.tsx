"use client";

import { useState } from "react";
import { ChevronDownIcon } from "../../../components/icons";
import type { DraftRogue } from "./TrainingDraft";

// The client's rogue sessions under the week's own (19 Oct, Alex): workouts
// they made themselves, off the plan. Built from the session card's own parts
// (head, pills, column heads, rows) so they read as sessions: the head says
// how many exercises, when, how long and whether it ended; open, the table is
// Exercise, then Sets, KG and Reps centred. Read only, and counted in nothing.

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const num = (n: number | null) => (n == null ? "–" : String(Math.round(n * 100) / 100));
/** "60" when every set is the same, else each in turn: "60 · 65 · 70". */
const each = (xs: (number | null)[]) => (xs.length === 0 ? "–" : xs.every((x) => x === xs[0]) ? num(xs[0]) : xs.map(num).join(" · "));
const GRID = { gridTemplateColumns: "minmax(200px, 1fr) 90px 140px 140px" };

export default function RogueSessions({ items, firstName }: { items: DraftRogue[]; firstName: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (items.length === 0) return null;
  return (
    <div className="rg">
      <div className="rg-head">
        <span className="rg-eyebrow">Rogue sessions</span>
        <span className="rg-sub">{firstName}&rsquo;s own, off the plan · not counted in the week</span>
      </div>
      {items.map((r) => {
        const isOpen = open === r.id;
        const count = r.exercises.length + r.cardio.length;
        return (
          <section key={r.id} className={`rd-session rg-session${isOpen ? " open" : ""}`}>
            <div className="rd-session-head" onClick={() => setOpen(isOpen ? null : r.id)}>
              <button type="button" className="rd-session-toggle" onClick={(e) => (e.stopPropagation(), setOpen(isOpen ? null : r.id))} aria-expanded={isOpen} aria-label={isOpen ? "Fold rogue session" : "Open rogue session"}>
                <span className={`rd-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </button>
              <span className="rd-session-namecol">
                <span className="rg-name">Rogue session</span>
              </span>
              <span className="rd-session-count">
                {count} {count === 1 ? "exercise" : "exercises"}
              </span>
              <span className="rd-session-tags">
                {r.started && <span className="rd-pill quiet">{day(r.started)}</span>}
                {r.duration != null && <span className="rd-pill quiet">{r.duration} min</span>}
                <span className={`rd-pill${r.ended ? " good" : ""}`}>{r.ended ? "Completed" : "In progress"}</span>
              </span>
            </div>
            {isOpen && (
              <div className="rd-rows">
                <div className="rd-cols rg-cols" aria-hidden="true" style={GRID}>
                  <span>Exercise</span>
                  <span>Sets</span>
                  <span>KG</span>
                  <span>Reps</span>
                </div>
                {r.exercises.map((e) => (
                  <div key={e.id} className="rd-row">
                    <div className="rd-row-main static rg-row" style={GRID}>
                      <span className="rd-ex">{e.name}</span>
                      <span>{e.sets.length || "–"}</span>
                      <span>{each(e.sets.map((s) => s.kg))}</span>
                      <span>{each(e.sets.map((s) => s.reps))}</span>
                    </div>
                  </div>
                ))}
                {r.cardio.map((c) => {
                  const bits = [c.time && `${c.time} min`, c.distance && `${c.distance} km`, c.pace && `${c.pace} km/h`, c.incline && `${c.incline}% incline`].filter(Boolean).join(" · ");
                  return (
                    <div key={`c${c.id}`} className="rd-row cardio">
                      <div className="rd-row-main static rg-row" style={GRID}>
                        <span className="rd-ex">
                          {c.name} <small className="rg-tag">Cardio</small>
                        </span>
                        <span className="rg-span">{bits || (c.done ? "Done" : "Not logged")}</span>
                      </div>
                    </div>
                  );
                })}
                {r.note && <p className="rd-session-note">{firstName} wrote: &ldquo;{r.note}&rdquo;</p>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
